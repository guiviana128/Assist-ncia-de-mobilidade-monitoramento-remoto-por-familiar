from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BoundingBox(ApiModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(ge=0.0, le=1.0)
    height: float = Field(ge=0.0, le=1.0)


class ImageMetadata(ApiModel):
    width: int
    height: int
    color_space: str
    raw_image_stored: bool


class GestureMetadata(ApiModel):
    name: str
    phase: str
    sequence_state: str
    confidence: float = Field(ge=0.0, le=1.0)
    sequence_progress: float = Field(ge=0.0, le=1.0)
    confirmed: bool


class SafetyMetadata(ApiModel):
    requires_human_review: bool
    recommended_action: str
    automatic_emergency_call: bool


class QualityMetadata(ApiModel):
    brightness: float
    blur_score: float
    usable: bool


class PrivacyMetadata(ApiModel):
    image_stored: bool
    landmarks_stored: bool
    retention_seconds: int


class VisionMetadata(ApiModel):
    schema_version: str
    event_id: str
    session_id: str
    device_id: str | None
    captured_at: datetime
    processor: str
    landmark_model: str
    hand_detected: bool
    hand_count: int
    handedness: str | None
    bounding_box: BoundingBox | None
    image: ImageMetadata
    gesture: GestureMetadata
    safety: SafetyMetadata
    quality: QualityMetadata
    privacy: PrivacyMetadata
