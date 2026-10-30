"""Cliente HTTP do backend Amparo (somente biblioteca padrão, sem dependências extras)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Optional


class BackendError(RuntimeError):
    pass


class BackendClient:
    def __init__(self, base_url: str, robot_id: str, api_key: str, timeout: float = 2.0):
        self.base_url = base_url.rstrip("/")
        self.robot_id = robot_id
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, method: str, path: str, body: Optional[dict] = None) -> tuple[int, Any]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json", "X-API-Key": self.api_key},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:200]
            raise BackendError(f"HTTP {error.code} em {path}: {detail}") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise BackendError(f"Backend indisponível ({self.base_url}): {error}") from error

    def send_state(self, state: dict) -> dict:
        _, body = self._request("POST", f"/robot/{self.robot_id}/state", state)
        return body or {}

    def claim_mission(self, min_priority: int) -> Optional[dict]:
        status, body = self._request("POST", f"/robot/{self.robot_id}/missions/claim?minPriority={min_priority}")
        return body if status == 200 else None

    def complete_mission(self, mission_id: int, success: bool, message: str) -> None:
        self._request("POST", f"/robot/{self.robot_id}/missions/{mission_id}/complete",
                      {"success": success, "message": message[:300]})
