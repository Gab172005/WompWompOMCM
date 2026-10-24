"""Public conversation transport; app tools enforce their own view permissions.

This endpoint cannot publish schedules or mutate backend planning data.
"""
import json
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from services.assistant import AssistantUnavailable, generate, settings

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class Content(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "model"]
    parts: list[dict] = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def check_parts(self):
        for part in self.parts:
            if not set(part).issubset({"text", "functionCall", "functionResponse", "thoughtSignature", "thought"}):
                raise ValueError("Unsupported assistant content.")
            if not any(key in part for key in ("text", "functionCall", "functionResponse")):
                raise ValueError("Empty assistant content.")
            if "text" in part and (not isinstance(part["text"], str) or len(part["text"]) > 16000):
                raise ValueError("Assistant text exceeds 16000 characters.")
            if "functionCall" in part and self.role != "model":
                raise ValueError("Function calls require a model turn.")
            if "functionResponse" in part and self.role != "user":
                raise ValueError("Function responses require a user turn.")
        return self


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contents: list[Content] = Field(min_length=1, max_length=80)
    context: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def check_size(self):
        if self.contents[-1].role != "user":
            raise ValueError("End with a user message or app tool results.")
        if len(json.dumps(self.model_dump())) > 300000:
            raise ValueError("Conversation is too long. Start a new conversation.")
        if len(json.dumps(self.context)) > 20000:
            raise ValueError("App context is too large.")
        return self


@router.get("/status")
def status():
    try:
        key, model = settings()
        return {"configured": bool(key), "model": model}
    except AssistantUnavailable as error:
        raise HTTPException(error.status, str(error)) from None


@router.post("")
def assistant(body: AssistantRequest):
    try:
        return generate([turn.model_dump() for turn in body.contents], body.context)
    except AssistantUnavailable as error:
        raise HTTPException(error.status, str(error)) from None
