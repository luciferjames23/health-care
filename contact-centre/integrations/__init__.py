"""
integrations package for AG-12 Contact Centre
"""
from .hospital_api import hospital_client, HospitalApiClient
from .appointments import AppointmentsIntegration
from .billing import BillingIntegration

__all__ = ["hospital_client", "HospitalApiClient", "AppointmentsIntegration", "BillingIntegration"]
