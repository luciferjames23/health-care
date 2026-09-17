# Phase 4 WhatsApp Engine Preservation Checklist

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Preserved & Protected  
**Target Subsystem:** `backend/agent/`, `backend/voice/`, `backend/knowledge/`

---

## 1. Protected Subsystem Inventory & Audit

Per rule 6 of the mission prompt:
> *Treat `healthcare-poc/backend/agent/*`, `backend/voice/*`, `backend/api/whatsapp_routes.py`, `backend/api/agent_routes.py`, and `backend/knowledge/*` as frozen. Port them in as a working subsystem with identical behavior — only update import paths, config, and DB connection wiring as needed. Do not refactor, rename, or alter any of its logic or prompts.*

| Subsystem File | Preservation Status | Integrity Audit Result |
| :--- | :---: | :--- |
| `backend/agent/agent_service.py` | **100% Frozen** | Intent routing, LLM prompts, state engine untouched. |
| `backend/agent/llm_intent_router.py` | **100% Frozen** | Gemini 3.5 intent router logic untouched. |
| `backend/agent/intent_detector.py` | **100% Frozen** | Intent classification patterns untouched. |
| `backend/agent/entity_extractor.py` | **100% Frozen** | Entity extraction regex and LLM rules untouched. |
| `backend/agent/conversation_stages.py` | **100% Frozen** | Stage machine state transitions untouched. |
| `backend/agent/language_service.py` | **100% Frozen** | Multilingual STT/TTS translation logic untouched. |
| `backend/agent/state_manager.py` | **100% Frozen** | Conversation context manager untouched. |
| `backend/agent/grounding_validator.py` | **100% Frozen** | RAG response grounding verification untouched. |
| `backend/voice/speech_to_text.py` | **100% Frozen** | Voice transcription engine untouched. |
| `backend/voice/text_to_speech.py` | **100% Frozen** | Voice synthesis engine untouched. |
| `backend/voice/whatsapp_client.py` | **100% Frozen** | Meta WhatsApp Cloud API client untouched. |

---

## 2. API Contract Verification
- `GET /api/whatsapp/webhook` returns raw `hub.challenge` text with HTTP 200 on token match.
- `POST /api/whatsapp/webhook` handles incoming text, voice (audio media ID), button interactive clicks, and delivery status updates (`SENT`, `DELIVERED`, `READ`, `FAILED`).
