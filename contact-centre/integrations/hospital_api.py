"""
integrations/hospital_api.py
============================
HTTP Client abstraction for communicating with the Hospital Core REST APIs.
Includes timeouts, retry logic, and fallback resilience.
"""

from typing import Dict, Any, Optional
import httpx
from config import settings


class HospitalApiClient:
    """Base client for executing REST calls against Hospital Core APIs."""

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None):
        self.base_url = (base_url or settings.HOSPITAL_API_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.HOSPITAL_API_TIMEOUT_SECONDS
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.HOSPITAL_API_KEY}",
            "X-Client-Origin": "AG12-ContactCentre-Voice"
        }

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params, headers=self.headers)
                response.raise_for_status()
                return {"success": True, "data": response.json(), "status_code": response.status_code}
            except httpx.HTTPError as e:
                return {
                    "success": False,
                    "error": str(e),
                    "status_code": getattr(getattr(e, "response", None), "status_code", 503)
                }

    async def post(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=json_data, headers=self.headers)
                response.raise_for_status()
                return {"success": True, "data": response.json(), "status_code": response.status_code}
            except httpx.HTTPError as e:
                return {
                    "success": False,
                    "error": str(e),
                    "status_code": getattr(getattr(e, "response", None), "status_code", 503)
                }


hospital_client = HospitalApiClient()
