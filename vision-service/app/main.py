from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import uuid4

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .detector import SignalForHelpDetector
from .models import (
    GestureMetadata,
    ImageMetadata,
    PrivacyMetadata,
    QualityMetadata,
    SafetyMetadata,
    VisionMetadata,
)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(
    title="AssistMob Vision Metadata API",
    version="1.0.0",
    description="Detecção local e supervisionada do Signal for Help.",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "VISION_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

detector = SignalForHelpDetector()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "processor": "opencv", "gesture": "SIGNAL_FOR_HELP"}


@app.post("/api/v1/vision/analyze", response_model=VisionMetadata)
async def analyze_frame(
    file: UploadFile = File(...),
    session_id: str = Form(..., min_length=8, max_length=120),
    device_id: str | None = Form(default=None, max_length=100),
) -> VisionMetadata:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Formato de imagem não suportado")

    payload = await file.read(MAX_IMAGE_BYTES + 1)
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Imagem excede o limite de 5 MB")

    encoded = np.frombuffer(payload, dtype=np.uint8)
    frame = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=422, detail="Não foi possível decodificar a imagem")

    height, width = frame.shape[:2]
    brightness = float(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).mean())
    blur_score = float(cv2.Laplacian(frame, cv2.CV_64F).var())
    usable = brightness >= 25.0 and blur_score >= 20.0

    detection = detector.analyze(frame, session_id)
    sequence = detection["sequence"]
    confirmed = bool(sequence.confirmed and usable)

    return VisionMetadata(
        schema_version="1.0",
        event_id=str(uuid4()),
        session_id=session_id,
        device_id=device_id,
        captured_at=datetime.now(timezone.utc),
        processor="opencv-python",
        landmark_model="mediapipe-hands",
        hand_detected=detection["hand_detected"],
        hand_count=detection["hand_count"],
        handedness=detection["handedness"],
        bounding_box=detection["bounding_box"],
        image=ImageMetadata(
            width=width,
            height=height,
            color_space="BGR",
            raw_image_stored=False,
        ),
        gesture=GestureMetadata(
            name="SIGNAL_FOR_HELP",
            phase=detection["phase"],
            sequence_state=sequence.state,
            confidence=detection["confidence"],
            sequence_progress=sequence.progress,
            confirmed=confirmed,
        ),
        safety=SafetyMetadata(
            requires_human_review=True,
            recommended_action="CHECK_IN_SAFELY",
            automatic_emergency_call=False,
        ),
        quality=QualityMetadata(
            brightness=round(brightness, 2),
            blur_score=round(blur_score, 2),
            usable=usable,
        ),
        privacy=PrivacyMetadata(
            image_stored=False,
            landmarks_stored=False,
            retention_seconds=0,
        ),
    )
