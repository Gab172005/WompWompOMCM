"""Stable undirected segment IDs derived from existing OSRM coordinates.

No data-file or request-schema changes: these are valid closed_roads identifiers.
The complete modeled route is unavailable when one of its segments is blocked.
"""
import math


def segment_id(a, b):
    def key(point):
        return ",".join(str(math.floor(value * 100000 + 0.5)) for value in point)
    return "segment:" + ":".join(sorted([key(a), key(b)]))


def route_segments(route):
    points = route["coordinates"]
    return {segment_id(a, b) for a, b in zip(points, points[1:])}
