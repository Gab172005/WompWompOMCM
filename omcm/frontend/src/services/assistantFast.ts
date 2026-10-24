import type { FunctionCall, ToolResult } from "../types/assistant";
import { addIsoDays, getManilaToday, useAppStore } from "../store/useAppStore";
import { HEALTHCARE_NEED_FACTORS } from "./healthcareNeed";

type Execute = (call: FunctionCall) => ToolResult;
interface Place {
  psgc: string;
  name: string;
  municipality?: string;
  level: string;
  population: number;
  score: number;
  rank: number;
  provisional: boolean;
  needScore?: number;
  needRank?: number;
  needCoverage?: number;
}
interface Facilities {
  facilities: { name: string; straightLineKm?: number }[];
}
export interface FastReply {
  text: string;
  results: ToolResult[];
}
const clean = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[?!.,]+$/, "")
    .trim();
const nameKey = (value: string) =>
  clean(value)
    .replace(
      /\b(city of|city|municipality of|municipality|barangay|brgy|in)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");
const numbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const number = (value?: string) =>
  value === undefined ? undefined : (numbers[value] ?? Number(value));
const nameOf = (p: Place) =>
  p.municipality ? `${p.name}, ${p.municipality}` : p.name;
const pages: Record<string, string> = {
  map: "map",
  "laguna map": "map",
  dashboard: "map",
  "clinic planning": "optimization",
  "plan clinics": "optimization",
  optimization: "optimization",
  simulation: "simulation",
  "30-day simulation": "simulation",
  "30 day simulation": "simulation",
  simulator: "simulation",
  "public view": "public",
  public: "public",
  analytics: "analytics",
  settings: "settings",
  "driver tracking": "driver",
  "fleet simulator": "driver",
  driver: "driver",
  workspace: "workspace",
};

/** Only complete, unambiguous intents run locally. Everything else keeps Gemini.
 * Each lookup/action uses the same validated tools as Gemini, never canned data.
 */
export function fastAssistant(
  value: string,
  execute: Execute,
): FastReply | null {
  const q = clean(value)
    .replace(/^(?:(?:please|kindly)\s+|(?:can|could|would) you\s+)+/, "")
    .replace(/\s+(?:please|for me)$/, "");
  const results: ToolResult[] = [];
  const call = (name: string, args: FunctionCall["args"] = {}) => {
    const result = execute({ name, args });
    results.push(result);
    return result;
  };
  const finish = (text?: string): FastReply => ({
    text:
      results.find((r) => !r.ok)?.error ??
      text ??
      results
        .map((r) => r.summary)
        .filter(Boolean)
        .join(" "),
    results,
  });
  const action = (name: string, args: FunctionCall["args"]) => {
    call(name, args);
    return finish();
  };

  if (
    /^(hi|hello|hello there|hey|help|help me|what can you do|kumusta|kamusta)$/.test(
      q,
    )
  )
    return finish(
      "I can find Laguna communities and nearby facilities, explain need scores, open pages, and update map or practice-plan controls. Try “Show Los Baños” or “Open the 30-day simulation.”",
    );

  const plan = q.match(
    /^(?:open|show|go to) (?:the )?(?:clinic planning|plan clinics|optimization)(?: page| screen)? with (\d+|one|two|three|four|five|six) (?:available |mobile )?clinics?$/,
  );
  if (plan) return action("configure_plan", { clinic_count: number(plan[1]) });
  const nav = q.match(
    /^(?:open|show|view|go to|navigate to|take me to|bring me to|switch to|buksan|pumunta sa|ipakita ang) (?:the )?(.+?)(?: page| screen)?$/,
  );
  if (nav && Object.hasOwn(pages, nav[1]))
    return action("navigate", { page: pages[nav[1]] });

  const schedule = q.match(
    /^(?:show|open|view) (?:(today|tomorrow)'?s? )?(?:(?:public|approved|clinic) )*schedules?(?: for (today|tomorrow|\d{4}-\d{2}-\d{2}))?$/,
  );
  if (schedule) {
    const day = schedule[2] || schedule[1] || "today";
    return action("show_schedule", {
      date:
        day === "today"
          ? getManilaToday()
          : day === "tomorrow"
            ? addIsoDays(getManilaToday(), 1)
            : day,
    });
  }
  const layer = q.match(
    /^(show|hide|enable|disable|turn on|turn off) (?:the )?(hospitals?|fixed clinics?|osm clinics?|mobile clinics?)(?: layer| markers)?$/,
  );
  if (layer)
    return action("configure_map", {
      [layer[2].startsWith("hospital")
        ? "hospitals"
        : layer[2].startsWith("mobile")
          ? "mobile_clinics"
          : "fixed_clinics"]: /^(show|enable|turn on)$/.test(layer[1]),
    });
  const metric = q.match(
    /^(?:show|open|view|switch to) (?:the )?(population density|density|healthcare need|need score|disaster risk|morbidity)(?: map| heatmap| layer)$/,
  );
  if (metric)
    return action("configure_map", {
      metric: metric[1].includes("density")
        ? "density"
        : metric[1] === "disaster risk"
          ? "disasterRisk"
          : metric[1] === "morbidity"
            ? "morbidity"
            : "score",
    });
  const playback = q.match(
    /^(play|pause|resume|next day)(?: the)?(?: simulation)?$/,
  );
  if (
    playback &&
    (q.includes("simulation") || useAppStore.getState().panel === "simulation")
  )
    return action("configure_simulation", {
      action: {
        play: "play",
        pause: "pause",
        resume: "play",
        "next day": "next_day",
      }[playback[1]],
    });
  if (
    /^apply (?:these|those|the) (?:simulation |clinic )?(?:suggestions|recommendations|locations)$/.test(
      q,
    ) &&
    (q.includes("simulation") || useAppStore.getState().panel === "simulation")
  )
    return action("configure_simulation", { action: "apply" });
  const suggestions = q.match(
    /^(?:get|show|generate) (?:the )?(?:optimizer suggestions|recommended locations|clinic recommendations)(?: for (\d+|one|two|three|four|five) (?:available |mobile )?clinics?)?$/,
  );
  if (suggestions && useAppStore.getState().panel === "simulation")
    return action("configure_simulation", {
      strategy: "optimizer",
      action: "recommend",
      ...(suggestions[1] ? { clinic_count: number(suggestions[1]) } : {}),
    });

  if (
    /^(?:explain|what is|what's|how is) (?:the )?(?:healthcare )?need score(?: calculated)?$/.test(
      q,
    )
  ) {
    return finish(
      "The Healthcare Need Score compares planning priority out of 100; higher scores mean greater estimated need.\n\n" +
        Object.values(HEALTHCARE_NEED_FACTORS)
          .map((f) => `• ${f.label}: ${Math.round(f.weight * 100)}%`)
          .join("\n") +
        "\n\nMissing inputs are excluded and remaining weights rescaled. Illness inputs are sample data. The municipal placement score and 30-day simulation use different profiles.",
    );
  }
  // A compound or negative request must never be partly executed by guessing.
  const nearby = q.match(
    /^(?:show|find|locate|select) (.+?) (?:and|with) (?:the )?(?:nearest|nearby) (hospitals|clinics)$/,
  );
  if (!nearby && /\b(and|then|but|not|don't|without|except)\b/.test(q))
    return null;

  const ranking = q.match(
    /^(?:show|list|find|which(?: are)?|what are|give me) (?:the )?(?:(top|bottom) )?(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten) )?(?:(highest|lowest)[ -])?(?:(?:healthcare )?need|population|density|disaster risk|morbidity)[ -]?(?:score[ -]?)?(?:barangays|municipalities|cities)(?: in (.+))?$/,
  );
  if (ranking && (ranking[1] || ranking[3])) {
    const result = call("rank_places", {
      level: /municipalities|cities/.test(q) ? "municipality" : "barangay",
      limit: number(ranking[2]) ?? 5,
      direction: /lowest|bottom/.test(q) ? "lowest" : "highest",
      metric: /population/.test(q)
        ? "population"
        : /density/.test(q)
          ? "density"
          : /disaster risk/.test(q)
            ? "disasterRisk"
            : /morbidity/.test(q)
              ? "morbidity"
              : "score",
      ...(ranking[4] ? { municipality: ranking[4] } : {}),
    });
    if (!result.ok) return finish();
    const data = result.data as { metric: string; places: Place[] };
    return finish(
      data.places
        .map(
          (p, i) =>
            `${i + 1}. ${nameOf(p)}: ${data.metric === "score" ? `${p.score}/100` : (p as unknown as Record<string, number>)[data.metric].toLocaleString()}${p.provisional ? " · Provisional" : ""}`,
        )
        .join("\n") + "\n\nBased on the app's baseline planning data.",
    );
  }

  const selectedQuestion = q.match(
    /^(?:show|what is|what's|tell me) (?:the )?(?:its|this place's|the selected (?:place|barangay|municipality)'?s?) (?:population|need score|healthcare need score|rank|details)$/,
  );
  const detailQuestion = q.match(
    /^(?:show|what is|what's|tell me) (?:the )?(population|need score|healthcare need score|rank|details) (?:of|for|in) (.+)$/,
  );
  const nearQuestion = q.match(
    /^(?:show|find|list) (?:the )?(?:nearest|nearby) (hospitals|clinics) (?:to|near|in) (.+)$/,
  );
  const directPlace = q.match(
    /^(?:show|find|locate|select|zoom to|focus on|go to|take me to|tell me about) (.+)$/,
  );
  const query =
    nearby?.[1] ?? detailQuestion?.[2] ?? nearQuestion?.[2] ?? directPlace?.[1];
  let selected: Place | undefined;
  if (selectedQuestion) {
    const s = useAppStore.getState(),
      psgc = s.selectedBarangayPsgc ?? s.selectedPsgc;
    if (!psgc)
      return finish(
        "Select a community or include its name so I can retrieve its details.",
      );
    const result = call("get_place_details", { psgc });
    if (!result.ok) return finish();
    selected = result.data as Place;
  } else if (query) {
    const match = call("search_places", { query, limit: 30 });
    if (!match.ok) return null;
    const exact = (match.data as { places: Place[] }).places.filter(
      (p) =>
        nameKey(p.name) === nameKey(query) ||
        nameKey(nameOf(p)) === nameKey(query) ||
        p.psgc === query,
    );
    if (!exact.length) return null;
    if (exact.length > 1)
      return finish(
        `Which community do you mean?\n${exact.map((p) => `• ${nameOf(p)}`).join("\n")}`,
      );
    selected = exact[0];
    if (directPlace || nearby) {
      const result = call("select_place", { psgc: selected.psgc });
      if (!result.ok) return finish();
    }
    const detail = call("get_place_details", { psgc: selected.psgc });
    if (!detail.ok) return finish();
    selected = detail.data as Place;
  }
  if (selected) {
    const score = selected.needScore ?? selected.score,
      rank = selected.needRank ?? selected.rank;
    let answer = `${nameOf(selected)}\nPopulation: ${selected.population.toLocaleString()}\nHealthcare Need Score: ${score}/100 · Rank #${rank}${selected.provisional ? " · Provisional" : ""}`;
    const kind = nearby?.[2] ?? nearQuestion?.[1];
    if (kind) {
      const result = call("find_facilities", {
        kind: kind === "hospitals" ? "hospital" : "clinic",
        near_psgc: selected.psgc,
        limit: 3,
      });
      if (!result.ok) return finish();
      answer +=
        `\n\nNearest mapped ${kind}:\n` +
        (result.data as Facilities).facilities
          .map((f) => `• ${f.name}: ${f.straightLineKm?.toFixed(2)} km`)
          .join("\n") +
        "\nStraight-line distances; records do not establish live availability.";
    }
    return finish(answer);
  }
  return null;
}

/** A successful screen action needs no extra paid model call just to confirm it. */
export function actionConfirmation(
  question: string,
  calls: FunctionCall[],
  results: ToolResult[],
): string | null {
  if (
    /\b(why|how|what|explain|tell|describe|compare|summari[sz]e|bakit|paano|ano)\b/i.test(
      question,
    )
  )
    return null;
  const actions = new Set([
    "navigate",
    "select_place",
    "configure_map",
    "configure_plan",
    "configure_simulation",
    "show_schedule",
  ]);
  if (!calls.length || !calls.every((c) => actions.has(c.name))) return null;
  return (
    results
      .map((r) => (r.ok ? r.summary : r.error))
      .filter(Boolean)
      .join(" ") || null
  );
}
