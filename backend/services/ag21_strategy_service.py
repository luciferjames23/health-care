"""Deterministic CEO Strategy Console answers grounded only in AG-21 outputs."""
import json
import os
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests

from services.ag21_management_service import bottleneck_feed, executive_summary, queue_department_waiting_counts, queue_waiting_count, queue_waiting_details


SOURCE_LABELS = {
    "queue": "Queue",
    "follow_up": "Follow-up",
    "feedback": "Feedback",
    "diagnostics": "X-ray orders",
    "radiology": "Radiology review",
}
FEED_SOURCE_KEYS = {
    "queue": ("queue",),
    "follow_up": ("follow_up",),
    "escalation": ("escalations",),
    "callback": ("callbacks",),
    "feedback": ("feedback",),
    "xray": ("xray",),
    "radiology": ("radiology",),
}

INTENT_TYPES = {"EXECUTIVE_SUMMARY", "TOP_PRIORITIES", "COUNT", "LIST", "OLDEST", "FILTER", "COMPARE", "EVIDENCE", "WHY", "RECOMMEND", "UNSUPPORTED"}
DOMAIN_PATTERNS = (
    ("XRAY", (r"x[ -]?rays?", r"radiolog(?:y|ic) orders?", r"projections?")),
    ("RADIOLOGY_REVIEW", (r"radiolog(?:ist|y) review", r"stud(?:y|ies|ies')", r"scans?", r"not reviewed", r"pending reviews?")),
    ("FOLLOW_UP", (r"follow[ -]?ups?", r"overdue tasks?")),
    ("ESCALATION", (r"escalations?", r"clinical issues?")),
    ("CALLBACK", (r"callbacks?", r"call backs?")),
    ("FEEDBACK", (r"feedback", r"complaints?", r"service recovery")),
    ("QUEUE", (r"queue", r"waiting patients?", r"patients? (?:are )?waiting", r"waiting (?:under|in)\s+[a-z]", r"waiting for\s+dr\.?\s+[a-z]", r"wait time")),
    ("DISCHARGE", (r"discharg(?:e|es|ed|ing)", r"beds?")),
)


def _domain_from_text(text):
    value = (text or "").casefold()
    matches = [domain for domain, patterns in DOMAIN_PATTERNS if any(re.search(pattern, value) for pattern in patterns)]
    if len(matches) > 1 and set(matches) == {"ESCALATION", "CALLBACK"}:
        return "OVERALL"
    return matches[0] if len(matches) == 1 else ("OVERALL" if not matches else None)


_NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}


def _requested_list_limit(text, default=10):
    value = (text or "").casefold()
    match = re.search(r"\b(?:top|first)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b", value)
    if not match:
        match = re.search(r"\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:most important|highest priority|important|priority)\b", value)
    if not match:
        return default
    token = match.group(1)
    return max(1, min(int(token) if token.isdigit() else _NUMBER_WORDS[token], 25))


def _feedback_title(evidence):
    categories = evidence.get("categories")
    if isinstance(categories, str):
        try:
            categories = json.loads(categories)
        except (ValueError, TypeError):
            pass
    if isinstance(categories, dict):
        categories = list(categories.values())
    if isinstance(categories, (list, tuple)):
        parts = [str(part).strip() for part in categories if part is not None and str(part).strip()]
        if parts:
            return " / ".join(parts[:2])[:100]
    elif isinstance(categories, str) and categories.strip():
        return categories.strip()[:100]
    summary = evidence.get("ai_summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()[:100]
    return "Feedback requiring action"


def _feedback_excerpt(evidence, max_chars=150):
    text = evidence.get("original_feedback")
    if not isinstance(text, str) or not text.strip():
        return "Feedback text unavailable"
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= max_chars else text[:max_chars - 1].rstrip() + "…"


def _feedback_result(item):
    evidence = item.get("evidence") or {}
    rating = evidence.get("rating")
    return {
        **item,
        "source_record_id": item.get("source_record_id"),
        "bottleneck_id": item.get("bottleneck_id"),
        "source_agent": item.get("source_agent"),
        "category": item.get("category"),
        "title": _feedback_title(evidence),
        "raised_by": "Unavailable",
        "rating": rating,
        "sentiment": evidence.get("sentiment"),
        "severity": evidence.get("severity"),
        "source_status": evidence.get("status") or item.get("source_status"),
        "age_minutes": item.get("age_minutes"),
        "created_at": evidence.get("created_at") or item.get("source_timestamp"),
        "feedback_excerpt": _feedback_excerpt(evidence),
        # Carry the already-authorized AG-21 source record into the existing drawer.
    }


def _deterministic_intent(question, context_question=""):
    q = re.sub(r"\s+", " ", (question or "").casefold()).strip()
    context = (context_question or "").casefold()
    domain = _domain_from_text(q)
    contextual_records = bool(re.search(r"\b(those|these|them|ones|orders?|items?|records?|cases?)\b|\b(?:pending|requested)\s+(?:orders?|items?|records?|ones?)\b", q))
    if domain in (None, "OVERALL") and context and (contextual_records or any(word in q for word in ("only", "urgent", "oldest", "next", "more", "first", "second", "third", "last", "details", "open"))):
        domain = _domain_from_text(context)
    if _is_unsupported(q):
        return {"intent": "UNSUPPORTED", "domain": domain or "OVERALL", "filters": {"priority": None}}
    evidence_match = re.search(r"\b(evidence|sources?|proof|prove|provenance|details?)\b", q)
    list_action = re.search(r"\b(show|list|display|open)\b", q)
    list_subject = re.search(r"\b(x[ -]?rays?|orders?|items?|cases?|records?|them|those|these|ones)\b", q)
    metric_wording = re.search(r"\b(count|number|metric|calculated|calculation|where did|where does|come from)\b|\bsource\b.{0,30}\b\d+\b.{0,30}\b(x[ -]?rays?|orders?)\b", q)
    if evidence_match and list_action and list_subject and not metric_wording:
        return {"intent": "LIST", "domain": domain or "OVERALL", "filters": {"priority": None, "limit": _requested_list_limit(q)}, "modifier": "WITH_EVIDENCE"}
    if any(word in q for word in ("source", "evidence", "proof", "prove", "where did", "where does", "come from", "provenance", "how do you know", "how did you get", "source of this number", "explain this number", "that number", "this number", "calculated", "calculation")):
        return {"intent": "EVIDENCE", "domain": _domain_from_text(context) if domain == "OVERALL" and context and _domain_from_text(context) != "OVERALL" else domain, "filters": {"priority": None}}
    if domain == "FEEDBACK" and ("detail" in q or "open feedback" in q or re.search(r"\b(first|second|third|last)\b|\bfeedback\s+#?\d+\b", q)):
        return {"intent": "EVIDENCE", "domain": domain, "filters": {"priority": None}}
    if re.search(r"\bwhy\b|root cause|reason for", q):
        return {"intent": "WHY", "domain": domain or "OVERALL", "filters": {"priority": None}}
    if any(word in q for word in ("recommend", "should we", "what should management", "suggested focus")):
        return {"intent": "RECOMMEND", "domain": domain or "OVERALL", "filters": {"priority": None}}
    if any(word in q for word in ("compare", "versus", " vs ", "difference between")) or ("department" in q and re.search(r"\b(?:largest|biggest|highest)\b", q)):
        return {"intent": "COMPARE", "domain": domain or "OVERALL", "filters": {"priority": None}}
    if any(phrase in q for phrase in ("executive summary", "overview of operations", "summarize operations", "operational overview")):
        return {"intent": "EXECUTIVE_SUMMARY", "domain": domain or "OVERALL", "filters": {"priority": None}}
    priority = "URGENT" if "urgent" in q else ("HIGH_OR_CRITICAL" if "high severity" in q or "highest priority" in q else ("HIGH" if "high priority" in q else None))
    requested_limit = _requested_list_limit(q)
    if domain == "FEEDBACK" and ("need attention" in q or "needs attention" in q or "need action" in q) and not any(term in q for term in ("how many", "count", "number of")):
        return {"intent": "LIST", "domain": domain, "filters": {"priority": priority, "limit": requested_limit}}
    if domain == "FEEDBACK" and context and re.search(r"\bnext\s+\d+|\bshow next\b", q):
        return {"intent": "LIST", "domain": domain, "filters": {"priority": priority, "limit": _requested_list_limit(q, 5)}}
    if priority and any(word in q for word in ("only", "ones", "filter")) and domain not in (None, "OVERALL"):
        return {"intent": "FILTER", "domain": domain, "filters": {"priority": priority}}
    if "backlog" in q and domain == "XRAY":
        return {"intent": "LIST", "domain": domain, "filters": {"priority": priority, "limit": requested_limit}}
    if any(word in q for word in ("oldest", "longest", "waited longest", "waiting longest", "waited the most")):
        intent = "OLDEST"
    elif any(word in q for word in ("how many", "count", "number of", "backlog", "how much", "what's the .*count")):
        intent = "COUNT"
    elif any(word in q for word in ("list", "show", "which", "pending", "awaiting", "incomplete", "unresolved", "open", "any .*waiting")):
        if domain in (None, "OVERALL") and "pending" in q:
            return None
        intent = "LIST" if domain not in (None, "OVERALL") else "TOP_PRIORITIES"
    elif domain == "OVERALL" and any(word in q for word in ("attention", "focus", "priority", "urgent", "today", "overview", "summary", "needs attention")):
        intent = "TOP_PRIORITIES"
    elif domain not in (None, "OVERALL"):
        intent = "COUNT" if domain in {"FOLLOW_UP", "FEEDBACK", "ESCALATION", "CALLBACK", "RADIOLOGY_REVIEW"} else "LIST"
    else:
        intent = None
    if intent:
        if domain == "FEEDBACK" and any(term in q for term in ("top", "most important", "highest priority", "next")):
            intent = "LIST"
        return {"intent": intent, "domain": domain or "OVERALL", "filters": {"priority": priority, "limit": requested_limit}}
    return None


def _llm_classify_intent(question, context_question=""):
    """Classify only; structured output is never used to generate answer facts."""
    key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    model = os.getenv("AG21_INTENT_MODEL") or (os.getenv("DISCHARGE_LLM_MODEL", "openai/gpt-oss-20b") if os.getenv("GROQ_API_KEY") else "gpt-4o-mini")
    endpoint = "https://api.groq.com/openai/v1/chat/completions" if os.getenv("GROQ_API_KEY") else "https://api.openai.com/v1/chat/completions"
    allowed_intents = ", ".join(sorted(INTENT_TYPES))
    allowed_domains = "QUEUE, FOLLOW_UP, ESCALATION, CALLBACK, FEEDBACK, XRAY, RADIOLOGY_REVIEW, DISCHARGE, OVERALL"
    prompt = (
        "Classify the user's management question. Return JSON only with intent, domain, filters.priority. "
        f"Allowed intents: {allowed_intents}. Allowed domains: {allowed_domains}. "
        "Use null priority unless explicitly requested (URGENT or HIGH). Do not answer the question or infer facts. "
        f"Context question: {context_question[:500]}\nQuestion: {question[:1000]}"
    )
    try:
        response = requests.post(endpoint, headers={"Authorization": f"Bearer {key.strip()}", "Content-Type": "application/json"},
                                 json={"model": model, "temperature": 0, "response_format": {"type": "json_object"},
                                       "messages": [{"role": "system", "content": "Return only the requested intent classification JSON."}, {"role": "user", "content": prompt}]}, timeout=4)
        response.raise_for_status()
        parsed = json.loads(response.json()["choices"][0]["message"]["content"])
        intent, domain = parsed.get("intent"), parsed.get("domain")
        priority = (parsed.get("filters") or {}).get("priority")
        if intent not in INTENT_TYPES or domain not in {"QUEUE", "FOLLOW_UP", "ESCALATION", "CALLBACK", "FEEDBACK", "XRAY", "RADIOLOGY_REVIEW", "DISCHARGE", "OVERALL"}:
            return None
        if priority not in (None, "URGENT", "HIGH"):
            priority = None
        return {"intent": intent, "domain": domain, "filters": {"priority": priority}}
    except Exception:
        return None


def classify_management_intent(question, *, context_question=""):
    deterministic = _deterministic_intent(question, context_question)
    if deterministic:
        return deterministic, False
    classified = _llm_classify_intent(question, context_question)
    if classified:
        return classified, True
    return {"intent": "UNSUPPORTED", "domain": _domain_from_text(context_question) or "OVERALL", "filters": {"priority": None}}, False


def _metric_source(summary, section_name, metric, metric_title):
    section = summary.get(section_name) or {}
    metrics = section.get("metrics") or {}
    value = metrics.get(metric)
    provenance = metrics.get(f"{metric}_provenance")
    if value is None or not isinstance(provenance, dict):
        return None
    if provenance.get("data_origin") != "PERSISTED_DATABASE" or provenance.get("synthetic_values_used") is not False:
        return None
    if provenance.get("data_status") != "AVAILABLE" or provenance.get("record_count") != value:
        return None
    return {
        "kind": "METRIC",
        "source_module": provenance.get("source_module"),
        "source_tables": provenance.get("source_tables", []),
        "metric": metric_title,
        "value": value,
        "provenance": provenance,
    }


def _verified_metric_catalog(summary):
    """Return only KPI values whose existing provenance payload is verified."""
    definitions = (
        ("FEEDBACK", "feedback", "requiring_action", "Feedback requiring action",
         (r"\bfeedback\b.*\b(?:requiring|requires?) action\b", r"\bfeedback count\b", r"\bfeedback cases?\b.*\bcount\b")),
        ("FOLLOW_UP", "follow_up", "overdue", "Overdue follow-ups",
         (r"\boverdue\b.*\bfollow[ -]?ups?\b", r"\bfollow[ -]?ups?\b.*\boverdue\b")),
        ("ESCALATION", "follow_up", "open_clinical_escalations", "Open clinical escalations",
         (r"\bopen\b.*\bescalations?\b", r"\bescalations?\b.*\bopen\b")),
        ("CALLBACK", "follow_up", "pending_callbacks", "Pending callbacks",
         (r"\bpending callbacks?\b",)),
        ("CALLBACK", "follow_up", "urgent_pending_callbacks", "Urgent pending callbacks",
         (r"\burgent callbacks?\b", r"\burgent pending callbacks?\b")),
        ("XRAY", "diagnostics", "requested_orders", "Requested X-ray orders",
         (r"\brequested\b.*\bx[ -]?rays?\b", r"\bx[ -]?rays?\b.*\b(?:requested|orders?|count)\b")),
        ("RADIOLOGY_REVIEW", "radiology", "studies_awaiting_review", "Studies awaiting radiology review",
         (r"\b(?:radiology|stud(?:y|ies))\b.*\b(?:review|awaiting)\b", r"\bawaiting radiology review\b")),
        ("QUEUE", "queue", "waiting", "Queue waiting",
         (r"\bqueue\b.*\bwaiting\b", r"\bqueue waiting\b")),
        ("DISCHARGE", "discharge", "summaries_evaluated", "Current discharge summaries evaluated",
         (r"\bdischarge summaries evaluated\b",)),
        ("DISCHARGE", "discharge", "eligible_current_status", "Currently eligible summaries",
         (r"\beligible summaries\b",)),
        ("DISCHARGE", "discharge", "blocked_current_status", "Currently blocked summaries",
         (r"\bblocked summaries\b",)),
    )
    metrics = []
    for domain, section, key, title, patterns in definitions:
        source = _metric_source(summary, section, key, title)
        if source:
            metrics.append({"domain": domain, "source": source, "patterns": patterns})
    return metrics


def _bottleneck_source(item):
    evidence = item.get("evidence") or {}
    return {
        "kind": "BOTTLENECK",
        "bottleneck_id": item.get("bottleneck_id"),
        "source_module": item.get("source_agent"),
        "source_table": evidence.get("source_table"),
        "source_record_id": item.get("source_record_id"),
        "source_status": item.get("source_status"),
        "source_priority": item.get("source_priority"),
        "source_timestamp": item.get("source_timestamp"),
        "timestamp_used_for_age": evidence.get("timestamp_used_for_age"),
        "age_minutes": item.get("age_minutes"),
        "category": item.get("category"),
        "source_origin": evidence.get("source_origin"),
        "data_origin": "PERSISTED_DATABASE",
        "synthetic_values_used": False,
    }


def _is_unsupported(question):
    q = question.casefold()
    if any(word in q for word in ("cleaner", "cleaners", "nurse", "nurses", "staffing", "staff member", "move staff")):
        return "AG-21 does not have verified staffing-capacity data to recommend a specific reassignment."
    if "insurance" in q or "preauthorization" in q or "pre-authorization" in q or re.search(r"\btpa\b", q):
        return "Reliable preauthorization waiting duration is not available in the current verified AG-21 dataset."
    if any(word in q for word in ("bed delay", "beds delayed", "bed release", "bed availability", "why are beds")):
        return "AG-21 does not have sufficient verified source data to determine bed-delay root cause."
    if "discharge" in q and any(word in q for word in ("why", "delay", "delayed", "root cause", "cause")):
        return "AG-21 does not currently have sufficient verified lifecycle data to determine discharge delay duration or root cause reliably."
    if any(word in q for word in ("predict", "forecast", "tomorrow", "by what time", "when will", "revenue", "financial", "money", "rupee", "₹", "cost saving", "staff outcome")):
        return "AG-21 does not have verified predictive, staffing, or financial-impact evidence for that request."
    return None


def _display_age(value):
    if value is None:
        return None
    value = max(0, int(round(value)))
    if value >= 1440:
        return f"{value // 1440}d {(value % 1440) // 60}h"
    if value >= 60:
        return f"{value // 60}h {value % 60}m"
    return f"{value}m"


def _feedback_position(question):
    match = re.search(r"\b(?:feedback\s*)?(\d+|first|second|third|last)\b", (question or "").casefold())
    if not match:
        return 1
    token = match.group(1)
    return {"first": 1, "second": 2, "third": 3, "last": -1}.get(token, max(1, int(token)) if token.isdigit() else 1)


def _metric(summary, section, key, title, sources):
    source = _metric_source(summary, section, key, title)
    if source:
        sources.append(source)
        return source["value"]
    return None


def _status_for(summary, feed, section_names=(), feed_names=()):
    states = []
    for name in section_names:
        states.append((summary.get(name) or {}).get("data_status", "UNAVAILABLE"))
    feed_states = feed.get("source_status") or {}
    for name in feed_names:
        states.append(feed_states.get(name, "UNAVAILABLE"))
    if not states or all(state == "UNAVAILABLE" for state in states):
        return "UNAVAILABLE"
    return "PARTIAL" if any(state != "AVAILABLE" for state in states) else "AVAILABLE"


def _unavailable_limitations(summary, feed, section_names=(), feed_names=()):
    limitations = []
    for name in section_names:
        if (summary.get(name) or {}).get("data_status") == "UNAVAILABLE":
            limitations.append(f"The AG-21 {SOURCE_LABELS.get(name, name)} summary source is unavailable.")
    for name in feed_names:
        if (feed.get("source_status") or {}).get(name) == "UNAVAILABLE":
            limitations.append(f"The AG-21 {name.replace('_', ' ')} bottleneck source is unavailable.")
    return limitations


def answer_management_question(question, *, context_question=None, context_items=None):
    question = (question or "").strip()
    context_question = (context_question or "").strip()
    intent, llm_classified = classify_management_intent(question, context_question=context_question)
    evidence_followup = "evidence" in question.casefold() and bool(context_question)
    effective_question = context_question if evidence_followup else question
    q = question.casefold()
    if evidence_followup:
        q = effective_question.casefold()
    elif context_question and any(token in q for token in ("those", "these", "which of them", "first", "second", "third", "last", "details", "open")):
        context = context_question.casefold()
        if "feedback" in context:
            q += " feedback"
        elif "follow" in context:
            q += " follow-up"
        elif "callback" in context:
            q += " callback"
    domain = intent.get("domain", "OVERALL")
    if intent.get("intent") in {"TOP_PRIORITIES", "EXECUTIVE_SUMMARY"}:
        q += " executive summary top priorities attention"
    elif intent.get("intent") == "OLDEST":
        q += " oldest pending work item"
    elif intent.get("intent") == "COUNT":
        q += " how many count"
    elif intent.get("intent") in {"LIST", "FILTER"}:
        q += " list pending"
    q += {"QUEUE": " queue", "FOLLOW_UP": " follow-up overdue", "ESCALATION": " escalation clinical",
          "CALLBACK": " callback pending", "FEEDBACK": " feedback require action", "XRAY": " x-ray pending",
          "RADIOLOGY_REVIEW": " radiology study review", "DISCHARGE": " discharge", "OVERALL": ""}.get(domain, "")
    priority_filter = intent.get("filters", {}).get("priority")
    if priority_filter:
        q += " " + priority_filter.casefold()

    try:
        summary = executive_summary()
    except Exception:
        summary = {}
    try:
        feed = bottleneck_feed(limit=500)
    except Exception:
        feed = {"data_status": "UNAVAILABLE", "items": [], "source_status": {key: "UNAVAILABLE" for key in FEED_SOURCE_KEYS["queue"] + FEED_SOURCE_KEYS["follow_up"] + FEED_SOURCE_KEYS["escalation"] + FEED_SOURCE_KEYS["callback"] + FEED_SOURCE_KEYS["feedback"] + FEED_SOURCE_KEYS["xray"] + FEED_SOURCE_KEYS["radiology"]}}

    generated_at = datetime.now(timezone.utc).isoformat()
    items = feed.get("items") or []
    sources = []
    limitations = []
    feedback_results = []
    answer_type = "EXECUTIVE_SUMMARY"
    status = "AVAILABLE"
    unsupported = _is_unsupported(question)
    unclear_pending = domain == "OVERALL" and "pending" in question.casefold() and intent.get("intent") != "OLDEST" and not context_question
    if unclear_pending:
        answer = "Pending items are available for follow-ups, callbacks, X-rays, feedback, and radiology review. Which area would you like?"
        answer_type = "CLARIFICATION"
        status = "AVAILABLE" if feed.get("data_status") == "AVAILABLE" else "PARTIAL"
        limitations.append("The question did not specify an operational area, so AG-21 did not select records.")
    elif unsupported:
        answer = unsupported
        answer_type = "INSUFFICIENT_EVIDENCE"
        status = "PARTIAL"
        limitations.append(unsupported)
    elif intent.get("intent") == "WHY":
        answer_type = "INSUFFICIENT_EVIDENCE"
        domain_metrics = {
            "XRAY": ("diagnostics", "requested_orders", "Requested X-ray orders"),
            "FEEDBACK": ("feedback", "requiring_action", "Feedback requiring action"),
            "FOLLOW_UP": ("follow_up", "overdue", "Overdue follow-ups"),
            "ESCALATION": ("follow_up", "open_clinical_escalations", "Open clinical escalations"),
            "CALLBACK": ("follow_up", "pending_callbacks", "Pending callbacks"),
            "RADIOLOGY_REVIEW": ("radiology", "studies_awaiting_review", "Studies awaiting review"),
            "QUEUE": ("queue", "waiting", "Queue waiting"),
        }
        metric_info = domain_metrics.get(domain)
        value = _metric(summary, *metric_info, sources) if metric_info else None
        if value is not None:
            if domain == "XRAY":
                requested = {}
                for item in items:
                    evidence = item.get("evidence") or {}
                    if item.get("category") == "XRAY" and evidence.get("order_status") == "Requested":
                        requested.setdefault(evidence.get("order_id") or item.get("source_record_id"), item)
                sources.extend(_bottleneck_source(item) for item in requested.values())
                premise = re.search(r"\b(\d+)\b", question)
                correction = f" The {premise.group(1)} in the question does not match the current verified count." if premise and int(premise.group(1)) != value else ""
                answer = (f"There are currently {value} X-ray orders in Requested status.{correction} "
                          f"AG-21 can verify persisted order status, priority, age, and available workflow evidence for {len(requested)} distinct orders. "
                          "The current verified fields do not explain why the orders remain Requested. I can show the pending orders and their available evidence.")
            else:
                answer = f"Current verified fact: {value} {metric_info[2].lower()}. The available AG-21 fields do not establish why these items remain pending. Review the linked source records and workflow status to identify the next operational step."
            limitations.append("The current verified AG-21 sources show workload/status, but do not establish a reliable root cause.")
            status = "PARTIAL"
        else:
            answer = "The current verified AG-21 sources do not provide a relevant workload fact or establish a reliable root cause. Review the source workflow records for available status details."
            limitations.append("No applicable verified metric or root-cause evidence was available for this request.")
            status = "UNAVAILABLE"
    elif intent.get("intent") == "EVIDENCE":
        answer_type = "EVIDENCE"
        answer = "The current AG-21 source references and metric provenance are attached below."
        provenance_resolution = False
        detail_request = domain == "FEEDBACK" and ("detail" in question.casefold() or "open" in question.casefold() or bool(re.search(r"\b(first|second|third|last)\b|\bfeedback\s+#?\d+\b", question.casefold())))
        catalog = _verified_metric_catalog(summary)
        explicit_matches = [entry for entry in catalog if any(re.search(pattern, question.casefold()) for pattern in entry["patterns"])]
        # "Urgent pending callbacks" is a more specific KPI phrase than the general callback count.
        if "urgent" in question.casefold() and any(entry["source"]["metric"] == "Urgent pending callbacks" for entry in explicit_matches):
            explicit_matches = [entry for entry in explicit_matches if entry["source"]["metric"] != "Pending callbacks"]
        number = re.search(r"\b\d+\b", question)
        if not detail_request and explicit_matches:
            provenance_resolution = True
            sources = [entry["source"] for entry in explicit_matches]
            if len(explicit_matches) == 1:
                domain = explicit_matches[0]["domain"]
            else:
                domain = "OVERALL"
                matching = "; ".join(f"{source['metric']}: {source['value']}" for source in sources)
                answer = f"This request names more than one AG-21 metric: {matching}. Please specify which metric's provenance you want."
                answer_type = "CLARIFICATION"
                status = "PARTIAL"
        elif not detail_request and number:
            provenance_resolution = True
            matches = [entry for entry in catalog if str(entry["source"]["value"]) == number.group(0)]
            sources = [entry["source"] for entry in matches]
            if len(matches) == 1:
                domain = matches[0]["domain"]
            elif matches:
                domain = "OVERALL"
                matching = "; ".join(f"{source['metric']} ({', '.join(source.get('source_tables') or [])})" for source in sources)
                answer = f"{number.group(0)} currently matches more than one AG-21 metric: {matching}. Please specify which metric you mean."
                answer_type = "CLARIFICATION"
                status = "PARTIAL"
            else:
                domain = "OVERALL"
                answer = f"I could not match {number.group(0)} to a current AG-21 KPI. Please specify the metric, for example feedback requiring action or overdue follow-ups."
                answer_type = "CLARIFICATION"
                status = "PARTIAL"
        domain_metrics = {
            "QUEUE": (("queue", "waiting", "Queue waiting"),),
            "FOLLOW_UP": (("follow_up", "overdue", "Overdue follow-ups"),),
            "ESCALATION": (("follow_up", "open_clinical_escalations", "Open clinical escalations"),),
            "CALLBACK": (("follow_up", "pending_callbacks", "Pending callbacks"),),
            "FEEDBACK": (("feedback", "requiring_action", "Feedback requiring action"),),
            "XRAY": (("diagnostics", "requested_orders", "Requested X-ray orders"),),
            "RADIOLOGY_REVIEW": (("radiology", "studies_awaiting_review", "Studies awaiting review"),),
            "DISCHARGE": (("discharge", "summaries_evaluated", "Current discharge summaries evaluated"),
                          ("discharge", "eligible_current_status", "Currently eligible summaries"),
                          ("discharge", "blocked_current_status", "Currently blocked summaries")),
        }
        if domain == "CALLBACK" and "urgent" in question.casefold():
            domain_metrics["CALLBACK"] = (("follow_up", "urgent_pending_callbacks", "Urgent pending callbacks"),)
        if not provenance_resolution:
            for section_name, metric_name, label in domain_metrics.get(domain, ()):
                if not any(source.get("metric") == label for source in sources):
                    _metric(summary, section_name, metric_name, label, sources)
        category_for_domain = {"QUEUE": "QUEUE", "FOLLOW_UP": "FOLLOWUP", "ESCALATION": "ESCALATION", "CALLBACK": "CALLBACK", "FEEDBACK": "FEEDBACK", "XRAY": "XRAY", "RADIOLOGY_REVIEW": "RADIOLOGY_REVIEW"}.get(domain)
        candidates = [item for item in items if category_for_domain is None or item.get("category") == category_for_domain]
        if domain == "FEEDBACK":
            explicit_records = any(term in question.casefold() for term in ("detail", "open")) or bool(re.search(r"\b(first|second|third|last)\b|\bfeedback\s+#?\d+\b", question.casefold()))
            if explicit_records:
                current_by_id = {str(item.get("source_record_id")): item for item in candidates}
                ordered_context = [current_by_id[str(record_id)] for record_id in (context_items or []) if str(record_id) in current_by_id]
                selection_pool = ordered_context or candidates
                position = _feedback_position(question)
                selected_feedback = ([selection_pool[-1]] if position == -1 and selection_pool else selection_pool[position - 1:position])
            else:
                selected_feedback = []
            feedback_results = [_feedback_result(item) for item in selected_feedback]
            if selected_feedback:
                sources.extend(_bottleneck_source(item) for item in selected_feedback)
        # Provenance questions cite the metric itself. Record evidence is included only
        # when the user explicitly asks to inspect a particular record.
        metric_sources = [source for source in sources if source.get("kind") == "METRIC"]
        metric_source = metric_sources[0] if metric_sources else None
        if feedback_results:
            position = _feedback_position(question)
            ordinal = {1: "first", 2: "second", 3: "third"}.get(position, "last" if position == -1 else str(position))
            prior_result = " from the previous result" if context_items else " from the current pending list"
            answer = f"Showing details for the {ordinal} feedback case{prior_result}: {feedback_results[0]['title']}."
        elif provenance_resolution and answer_type == "CLARIFICATION":
            pass
        elif len(metric_sources) > 1:
            matching = "; ".join(f"{source['metric']}: {source['value']} ({', '.join(source.get('source_tables') or [])})" for source in metric_sources)
            answer = f"The number matches multiple verified AG-21 metrics: {matching}. The attached source references show each metric's persisted rule; no individual records are listed."
        elif metric_source:
            provenance = metric_source.get("provenance") or {}
            fields = ", ".join(provenance.get("fields") or []) or "the persisted metric fields"
            origin = provenance.get("data_origin") or "Persisted database records"
            summary_text = (f"{metric_source['value']} feedback cases currently require action." if metric_source.get("metric") == "Feedback requiring action"
                            else f"{metric_source['value']} {metric_source['metric'].lower()}.")
            answer = (f"{summary_text} This is calculated from {', '.join(provenance.get('source_tables') or metric_source.get('source_tables') or ['the persisted source'])} "
                      f"using fields {fields} and the recorded rule: {provenance.get('filter_description') or 'see the metric provenance attached below'}. "
                      f"Data origin: {origin}. Synthetic/default values used: No. ")
            if domain == "FEEDBACK" and metric_source.get("metric") == "Feedback requiring action":
                breakdown = {}
                for item in items:
                    if item.get("category") == "FEEDBACK":
                        state = str(item.get("source_status") or "Unknown").replace("_", " ").title()
                        breakdown[state] = breakdown.get(state, 0) + 1
                if sum(breakdown.values()) == metric_source["value"] and breakdown:
                    answer += "Current breakdown: " + "; ".join(f"{state}: {count}" for state, count in sorted(breakdown.items())) + ". "
            answer += "No individual records are listed because this is a metric provenance answer."
        elif not feedback_results:
            answer = "No matching verified persisted metric provenance is available for that number or operational area."
            status = "UNAVAILABLE"
    elif intent.get("intent") == "RECOMMEND":
        answer_type = "RECOMMENDATION"
        answer = "Suggested focus: review the oldest verified items first, then high-severity escalations, urgent X-rays, and unresolved high-severity feedback where those persisted priorities are available."
        status = _status_for(summary, feed, ("follow_up", "feedback", "diagnostics", "radiology"), tuple(feed.get("source_status", {})))
        limitations.append("This is a review ordering based on available AG-21 age and persisted priority fields; it does not establish operational impact.")
        for item in items:
            category = item.get("category")
            priority = str(item.get("source_priority") or "").upper()
            if (category == "ESCALATION" and priority in {"HIGH", "CRITICAL"}) or (category == "XRAY" and priority == "URGENT") or (category == "FEEDBACK" and priority in {"HIGH", "CRITICAL"}):
                sources.append(_bottleneck_source(item))
    elif intent.get("intent") == "COMPARE" and domain == "QUEUE" and "department" in q:
        dept_counts = queue_department_waiting_counts()
        if dept_counts:
            top = dept_counts[0]
            answer = f"{top.get('department_name') or 'Department unavailable'} has the largest current waiting queue with {top.get('waiting', 0)} patients."
            sources.append({"kind": "AGGREGATE", "source_module": "AG-06", "source_tables": ["queue_entries", "queue_sessions", "departments"], "metric": "Waiting by department", "value": top.get("waiting"), "department": top.get("department_name"), "provenance": {"data_origin": "PERSISTED_DATABASE", "synthetic_values_used": False, "fields": ["queue_status", "queue_date", "department_id"], "filter_description": "current-date queue entries with persisted queue_status WAITING grouped by department"}})
            answer_type = "QUEUE_DEPARTMENT_COMPARISON"
            status = "AVAILABLE"
        else:
            answer = "Department-level waiting counts are unavailable from the current persisted queue summary."
            status = "UNAVAILABLE"
            answer_type = "INSUFFICIENT_EVIDENCE"
    elif intent.get("intent") == "COMPARE":
        answer_type = "COMPARE"
        candidates = (
            ("follow_up", "overdue", "Overdue follow-ups"),
            ("feedback", "requiring_action", "Feedback requiring action"),
            ("follow_up", "open_clinical_escalations", "Open clinical escalations"),
            ("follow_up", "pending_callbacks", "Pending callbacks"),
            ("diagnostics", "requested_orders", "Requested X-ray orders"),
            ("radiology", "studies_awaiting_review", "Studies awaiting radiology review"),
            ("queue", "waiting", "Queue entries waiting"),
        )
        values = []
        for section_name, metric_name, label in candidates:
            value = _metric(summary, section_name, metric_name, label, sources)
            if value is not None:
                values.append((label, value))
        answer = "Verified AG-21 workload comparison\n" + "\n".join(f"• {label}: {value}" for label, value in values) if values else "AG-21 has no verified metrics available for this comparison."
        status = _status_for(summary, feed, tuple(section for section, _, _ in candidates), tuple(feed.get("source_status", {}))) if values else "UNAVAILABLE"
    elif evidence_followup:
        # Re-evaluate the referenced prior question against current AG-21 data.
        answer_type = "EVIDENCE"
        answer = "Evidence for the referenced AG-21 question is attached below. Values and records were re-read from the current AG-21 summary and bottleneck feed."
    elif "discharge" in q:
        section = summary.get("discharge") or {}
        metrics = section.get("metrics") or {}
        if section.get("data_status") != "UNAVAILABLE" and section.get("source") and all(isinstance(metrics.get(k), int) for k in ("summaries_evaluated", "eligible_current_status", "blocked_current_status")):
            value = metrics["summaries_evaluated"]
            answer = f"The current persisted discharge-summary table contains {value} evaluated summaries: {metrics['eligible_current_status']} currently eligible and {metrics['blocked_current_status']} blocked by their persisted approval status. This does not represent all active admissions or establish discharge delay."
            for key, metric_name in (("summaries_evaluated", "Current discharge summaries evaluated"),
                                     ("eligible_current_status", "Currently eligible summaries"),
                                     ("blocked_current_status", "Currently blocked summaries")):
                citation = _metric_source(summary, "discharge", key, metric_name)
                if citation:
                    sources.append(citation)
            limitations.extend(section.get("limitations") or [])
            status = "PARTIAL"
            answer_type = "DISCHARGE_STATUS"
        else:
            answer = "AG-21 does not currently have sufficient verified discharge-summary data to answer that question."
            status = "UNAVAILABLE"
            limitations.append("The current discharge summary source is unavailable or lacks verified status counts.")
            answer_type = "INSUFFICIENT_EVIDENCE"
    elif any(token in q for token in ("what needs attention", "top priorit", "right now", "executive summary", "summarize", "overview")):
        candidates = [
            ("follow_up", "overdue", "Overdue follow-ups"),
            ("feedback", "requiring_action", "Feedback cases requiring action"),
            ("follow_up", "open_clinical_escalations", "Open clinical escalations"),
            ("follow_up", "pending_callbacks", "Pending callbacks"),
            ("diagnostics", "requested_orders", "Requested X-ray orders"),
            ("radiology", "studies_awaiting_review", "Studies awaiting radiology review"),
            ("queue", "waiting", "Queue entries waiting"),
        ]
        facts = []
        relevant_sections, relevant_feeds = [], list(feed.get("source_status", {}).keys())
        for section, metric, label in candidates:
            relevant_sections.append(section)
            value = _metric(summary, section, metric, label, sources)
            if value is not None:
                facts.append((value, label))
        facts.sort(reverse=True)
        if facts:
            answer = "Current verified AG-21 workload counts include " + "; ".join(f"{value} {label.lower()}" for value, label in facts[:4]) + ". Review the oldest unresolved source records first where age is available."
            status = _status_for(summary, feed, relevant_sections, relevant_feeds)
            limitations.extend(_unavailable_limitations(summary, feed, relevant_sections, relevant_feeds))
        else:
            answer = "AG-21 could not retrieve verified operational summary values at this time."
            status = "UNAVAILABLE"
            limitations.append("No verified AG-21 summary metrics were available.")
    elif domain == "QUEUE" and intent.get("intent") in {"LIST", "OLDEST", "COUNT"}:
        answer_type = "QUEUE_LIST"
        department_match = re.search(r"\b(?:under|in|for)\s+(?:the\s+)?([a-z][a-z &'-]*?)(?:\s+(?:queue|department|patients?|who|still|waiting)|[?.!]|$)", question, re.I)
        if not department_match:
            department_match = re.search(r"\b(?:show|list)\s+(?:the\s+)?([A-Z][A-Za-z &'-]+?)\s+(?:queue|department)\b", question)
        doctor_match = re.search(r"\b(?:for|under)\s+(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", question, re.I)
        department = department_match.group(1).strip() if department_match and not doctor_match else None
        if department and department.casefold() in {"queue", "waiting queue"}:
            department = None
        doctor = doctor_match.group(1).strip() if doctor_match else None
        try:
            count = queue_waiting_count(department=department, doctor=doctor)
            queue_rows = queue_waiting_details(datetime.now(timezone.utc), department=department, doctor=doctor, limit=10)
            queue_detail_unavailable = False
        except Exception:
            count, queue_rows, queue_detail_unavailable = None, [], True
        if intent.get("intent") == "OLDEST":
            queue_rows.sort(key=lambda item: item.get("age_minutes") if item.get("age_minutes") is not None else -1, reverse=True)
        items = queue_rows
        sources = [{"kind": "RECORD", "source_module": "AG-06", "source_tables": ["queue_entries", "queue_sessions", "patients", "doctors", "departments"], "source_record_id": item["source_record_id"], "status": item["source_status"]} for item in queue_rows]
        scope = f" matching {department} department" if department else (f" for {doctor}" if doctor else "")
        answer = f"**{count} {'patient is' if count == 1 else 'patients are'} currently waiting{scope}.**" if count is not None else "The queue source is currently unavailable; AG-21 could not verify waiting entries."
        if intent.get("intent") == "COUNT":
            queue_rows = []
            items = []
            sources = []
            answer_type = "QUEUE_COUNT"
            answer = f"AG-21 found {count} persisted patients currently waiting{scope}." if count is not None else "The queue source is currently unavailable; AG-21 could not verify the waiting count."
        if queue_rows:
            lines = []
            for index, item in enumerate(queue_rows, 1):
                checked_in = datetime.fromisoformat(item["checked_in_at"]).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%I:%M %p").lstrip("0") if item.get("checked_in_at") else "Unavailable"
                age = f"{item['age_minutes']} min" if item.get("age_minutes") is not None else "Unavailable"
                lines.append(
                    f"{index}. **{item['patient_display']}**\n"
                    f"   - Department: {item['department']}\n"
                    f"   - Doctor: {item['doctor']}\n"
                    f"   - Token: {item['token']}\n"
                    f"   - Status: {item['source_status'].replace('_', ' ').title()}\n"
                    f"   - Checked in: {checked_in}\n"
                    f"   - Waiting: {age}"
                )
            answer += "\n\n" + "\n\n".join(lines)
            answer += f"\n\nShowing 1–{count} of {count}."
        elif queue_detail_unavailable or feed.get("source_status", {}).get("queue") != "AVAILABLE":
            answer = "The queue source is currently unavailable; AG-21 could not verify waiting entries."
        else:
            answer += " No matching persisted queue entries were found."
        status = "AVAILABLE" if not queue_detail_unavailable and feed.get("source_status", {}).get("queue") == "AVAILABLE" else "UNAVAILABLE"
        limitations.append("Patient display uses first name and last initial from the persisted patient relationship; contact details and identifiers are not exposed.")
        limitations.append("Queue wait age is calculated by AG-21 from persisted checked_in_at; queue status and timestamps are source values.")
    elif intent.get("intent") == "OLDEST" or ("oldest" in q and any(token in q for token in ("pending", "unresolved", "work", "item", "task"))):
        eligible = [item for item in items if item.get("age_minutes") is not None]
        category_for_domain = {"QUEUE": "QUEUE", "FOLLOW_UP": "FOLLOWUP", "ESCALATION": "ESCALATION", "CALLBACK": "CALLBACK", "FEEDBACK": "FEEDBACK", "XRAY": "XRAY", "RADIOLOGY_REVIEW": "RADIOLOGY_REVIEW"}.get(domain)
        if category_for_domain:
            eligible = [item for item in eligible if item.get("category") == category_for_domain]
        if priority_filter:
            eligible = [item for item in eligible if str(item.get("source_priority") or "").upper() == priority_filter]
        unique_items = {}
        for item in eligible:
            unique_items.setdefault(item.get("bottleneck_id"), item)
        eligible = list(unique_items.values())
        eligible.sort(key=lambda item: item.get("age_minutes") or 0, reverse=True)
        chosen = eligible[:(_requested_list_limit(question) if domain == "FEEDBACK" else 5)]
        if domain == "FEEDBACK":
            feedback_results = [_feedback_result(item) for item in chosen]
            sources = [_bottleneck_source(item) for item in chosen]
            answer = f"Oldest feedback cases requiring action (showing {len(chosen)}):"
        if chosen:
            for item in chosen:
                sources.append(_bottleneck_source(item))
            def display_age(value):
                if value >= 1440: return f"{int(value // 1440)}d {int((value % 1440) // 60)}h"
                if value >= 60: return f"{int(value // 60)}h {int(value % 60)}m"
                return f"{int(value)}m"
            heading = f"Oldest feedback cases requiring action (showing {len(chosen)}):" if domain == "FEEDBACK" else "Oldest verified pending items"
            answer = heading + "\n" + "\n".join(
                f"{index}. {item['category'].replace('_', ' ').title()} — {display_age(item['age_minutes'])} ({item['source_status'] or 'status unavailable'})"
                for index, item in enumerate(chosen, 1)
            ) + "\nAges use source-specific persisted timestamps and are not SLA measurements."
            feed_names = tuple(feed.get("source_status", {}).keys())
            status = _status_for(summary, feed, (), feed_names)
            limitations.extend(_unavailable_limitations(summary, feed, (), feed_names))
            limitations.append("Oldest-item comparisons use each workflow's AG-21 age anchor; no common SLA or lifecycle clock is inferred.")
            limitations.append("Age ranking is limited to the AG-21 bottleneck items returned in this query (maximum 500).")
        else:
            answer = "No current AG-21 bottleneck has a usable source timestamp for age ranking."
            status = "PARTIAL" if feed.get("data_status") != "UNAVAILABLE" else "UNAVAILABLE"
            limitations.append("Source timestamps required for age ranking are unavailable.")
    elif "queue" in q and any(token in q for token in ("longest", "oldest", "wait", "waiting")):
        chosen = max((item for item in items if item.get("category") == "QUEUE" and item.get("source_status") == "WAITING" and item.get("age_minutes") is not None), key=lambda item: item["age_minutes"], default=None)
        if chosen:
            sources.append(_bottleneck_source(chosen))
            department = (chosen.get("evidence") or {}).get("department_id")
            answer = f"The longest current recorded queue wait is {round(chosen['age_minutes'])} minutes for queue entry {chosen['source_record_id']}" + (f" in department ID {department}." if department is not None else ".") + " This age is calculated from persisted checked_in_at; a display name is not available in the AG-21 evidence."
            status = _status_for(summary, feed, (), ("queue",))
        else:
            waiting_count = _metric(summary, "queue", "waiting", "Queue Waiting", sources)
            if (feed.get("source_status") or {}).get("queue") == "UNAVAILABLE":
                answer = f"AG-21 reports {waiting_count} queue entries with persisted queue_status WAITING, but the queue bottleneck source is unavailable for wait-age detail." if waiting_count is not None else "The AG-21 queue summary and bottleneck evidence are unavailable."
            elif waiting_count == 0:
                answer = "AG-21 currently reports 0 queue entries with persisted queue_status WAITING, and no queue bottleneck has a checked_in_at timestamp available for wait-age comparison."
            else:
                answer = "No current queue bottleneck has a persisted check-in timestamp available for wait-age comparison."
            status = "PARTIAL" if (feed.get("source_status") or {}).get("queue") == "AVAILABLE" else "UNAVAILABLE"
            limitations.append("Queue wait age requires checked_in_at; queue waiting counts do not require it.")
            limitations.extend(_unavailable_limitations(summary, feed, (), ("queue",)))
    elif "follow" in q and any(token in q for token in ("how many", "overdue", "count")):
        value = _metric(summary, "follow_up", "overdue", "Overdue follow-ups", sources)
        answer = f"{value} follow-up tasks are overdue under the verified AG-21 rule: due_date is before calculation time and status is not COMPLETED or CANCELLED." if value is not None else "The overdue follow-up metric is currently unavailable from verified AG-21 data."
        status = (summary.get("follow_up") or {}).get("data_status", "UNAVAILABLE")
        status = _status_for(summary, feed, ("follow_up",), ("follow_up",))
        limitations.extend(_unavailable_limitations(summary, feed, ("follow_up",), ("follow_up",)))
        if value is None:
            limitations.append("Overdue follow-up source or metric provenance is unavailable.")
            limitations.extend(_unavailable_limitations(summary, feed, ("follow_up",), ("follow_up",)))
    elif ("escalat" in q) and any(token in q for token in ("open", "clinical", "how many", "count", "still")):
        value = _metric(summary, "follow_up", "open_clinical_escalations", "Open clinical escalations", sources)
        answer = f"{value} clinical escalations have persisted status OPEN or ACKNOWLEDGED." if value is not None else "The open escalation count is unavailable from verified AG-21 data."
        status = (summary.get("follow_up") or {}).get("data_status", "UNAVAILABLE")
        status = _status_for(summary, feed, ("follow_up",), ("escalations",))
        limitations.extend(_unavailable_limitations(summary, feed, ("follow_up",), ("escalations",)))
        if value is None:
            limitations.extend(_unavailable_limitations(summary, feed, ("follow_up",), ("escalations",)))
    elif "callback" in q and any(token in q for token in ("urgent", "pending", "how many", "count")):
        if "urgent" in q:
            value = _metric(summary, "follow_up", "urgent_pending_callbacks", "Urgent pending callbacks", sources)
            answer = f"{value} callbacks have persisted priority URGENT and status PENDING or IN_PROGRESS." if value is not None else "The urgent callback count is unavailable from verified AG-21 data."
        else:
            value = _metric(summary, "follow_up", "pending_callbacks", "Pending callbacks", sources)
            answer = f"{value} callbacks have persisted status PENDING or IN_PROGRESS." if value is not None else "The pending callback count is unavailable from verified AG-21 data."
        status = _status_for(summary, feed, ("follow_up",), ("callbacks",))
        limitations.extend(_unavailable_limitations(summary, feed, ("follow_up",), ("callbacks",)))
        if value is None:
            limitations.extend(_unavailable_limitations(summary, feed, ("follow_up",), ("callbacks",)))
        if status == "UNAVAILABLE":
            limitations.append("The AG-21 callback bottleneck source is unavailable.")
    elif any(token in q for token in ("high severity", "critical severity", "top severity")) or ("severity" in q and "those" in q):
        selected = [item for item in items if str(item.get("source_priority") or "").upper() in {"HIGH", "CRITICAL"}]
        if "feedback" in q:
            selected = [item for item in selected if item.get("category") == "FEEDBACK"]
        sources.extend(_bottleneck_source(item) for item in selected)
        answer = f"AG-21 lists {len(selected)} current HIGH or CRITICAL severity bottleneck records" + (" in feedback." if "feedback" in q else ".")
        status = _status_for(summary, feed, (), tuple(feed.get("source_status", {}).keys()))
    elif "feedback" in q:
        chosen = [item for item in items if item.get("category") == "FEEDBACK"]
        if any(token in q for token in ("high", "severity", "priority")):
            chosen = [item for item in chosen if str(item.get("source_priority") or "").upper() in {"HIGH", "CRITICAL"}]
        if any(token in q for token in ("how many", "count", "require action", "requires action", "what feedback")):
            value = _metric(summary, "feedback", "requiring_action", "Feedback requiring action", sources)
            answer = f"{value} unresolved feedback records require action (requires_action = true and status OPEN or IN_PROGRESS)." if value is not None else "The unresolved feedback metric is unavailable from verified AG-21 data."
            status = _status_for(summary, feed, ("feedback",), ("feedback",))
            limitations.extend(_unavailable_limitations(summary, feed, ("feedback",), ("feedback",)))
            if value is None:
                limitations.extend(_unavailable_limitations(summary, feed, ("feedback",), ("feedback",)))
        else:
            sources.extend(_bottleneck_source(item) for item in chosen)
            answer = f"AG-21 lists {len(chosen)} unresolved feedback bottleneck records" + (" with HIGH or CRITICAL severity." if any(token in q for token in ("high", "severity", "priority")) else ".")
            status = _status_for(summary, feed, ("feedback",), ("feedback",))
    elif "x-ray" in q or "xray" in q or "x rays" in q or "x-rays" in q:
        xray_orders = _metric(summary, "diagnostics", "requested_orders", "Requested X-ray orders", sources)
        xray_items = [item for item in items if item.get("category") == "XRAY"]
        requested_by_order = {}
        for item in xray_items:
            evidence = item.get("evidence") or {}
            if evidence.get("order_status") == "Requested":
                requested_by_order.setdefault(evidence.get("order_id"), item)
        if xray_orders is not None and any(token in q for token in ("how many", "count", "requested")):
            sources.extend(_bottleneck_source(item) for item in requested_by_order.values())
            answer = f"{xray_orders} Chest X-ray orders have persisted order status Requested (order-level count). AG-21 lists {len(requested_by_order)} linked pending projection workflow records."
        elif requested_by_order:
            sources.extend(_bottleneck_source(item) for item in requested_by_order.values())
            if xray_orders is not None:
                answer = f"The verified order-level Requested count is {xray_orders}. Bottleneck evidence identifies {len(requested_by_order)} distinct orders with pending persisted workflow records: " + ", ".join(str(order_id) for order_id in requested_by_order if order_id) + "."
                limitations.append("The bottleneck feed has workflow details for fewer distinct orders than the order-level Requested metric; AG-21 cannot cite workflow details for the remaining order from this feed.")
                status = "PARTIAL"
            else:
                answer = f"AG-21 has {len(requested_by_order)} distinct Chest X-ray orders represented by pending persisted workflow records: " + ", ".join(str(order_id) for order_id in requested_by_order if order_id) + "."
            answer += " Projection-record origin is shown in each source reference; migration/backfill or unknown origin is not treated as proof of live acquisition."
        else:
            if xray_orders is not None and xray_orders > 0:
                answer = f"The verified order-level metric reports {xray_orders} Chest X-ray orders with status Requested, but no corresponding bottleneck detail is available from the current feed."
            else:
                answer = "No Chest X-ray orders with status Requested are currently shown by the verified order-level metric."
        status = _status_for(summary, feed, ("diagnostics",), ("xray",))
        if xray_orders is not None and xray_orders > len(requested_by_order):
            status = "PARTIAL"
            if not any("workflow details" in limitation for limitation in limitations):
                limitations.append("The order-level Requested count exceeds distinct X-ray orders represented in the bottleneck feed; details for the remaining requested order are not available from this feed.")
        limitations.extend(_unavailable_limitations(summary, feed, ("diagnostics",), ("xray",)))
        if any(ref.get("source_origin") in {"MIGRATION_OR_BACKFILL", "ORIGIN_UNKNOWN"} for ref in sources):
            limitations.append("Some projection workflow rows have migration/backfill or unknown origin; they are persisted workflow records, not proven live acquisition events.")
    elif "radiology" in q or ("stud" in q and "review" in q):
        chosen = [item for item in items if item.get("category") == "RADIOLOGY_REVIEW"]
        sources.extend(_bottleneck_source(item) for item in chosen)
        metric_source = _metric_source(summary, "radiology", "studies_awaiting_review", "Studies awaiting radiology review")
        if metric_source and (feed.get("source_status") or {}).get("radiology") != "UNAVAILABLE":
            sources.insert(0, metric_source)
            value = metric_source["value"]
            answer = f"{value} order-linked radiology scans have reviewed_at IS NULL in the summary. The bottleneck feed lists {len(chosen)} records under its current review-status inclusion rule."
        elif metric_source:
            sources.insert(0, metric_source)
            answer = f"{metric_source['value']} order-linked radiology scans have reviewed_at IS NULL, but detailed radiology bottleneck records are unavailable."
        else:
            answer = f"AG-21 lists {len(chosen)} radiology review bottleneck records." if (feed.get("source_status") or {}).get("radiology") == "AVAILABLE" else "Radiology review evidence is unavailable."
        status = _status_for(summary, feed, ("radiology",), ("radiology",))
    elif "follow" in q:
        chosen = [item for item in items if item.get("category") == "FOLLOWUP"]
        sources.extend(_bottleneck_source(item) for item in chosen[:25])
        answer = f"AG-21 lists {len(chosen)} overdue follow-up task bottleneck records. Source status and due-time evidence are attached." if (feed.get("source_status") or {}).get("follow_up") == "AVAILABLE" else "The follow-up bottleneck source is unavailable."
        status = (feed.get("source_status") or {}).get("follow_up", "UNAVAILABLE")
    elif any(token in q for token in ("attention", "priorit", "summary")):
        answer = "AG-21 could not retrieve verified management metrics for this request."
        status = "UNAVAILABLE"
        limitations.append("No applicable verified AG-21 summary evidence was available.")
    elif intent.get("intent") == "UNSUPPORTED":
        answer = "I can’t answer that reliably from the current verified AG-21 sources. Please ask about queue, follow-ups, escalations, callbacks, feedback, X-ray orders, radiology review, or supported discharge-summary status."
        answer_type = "INSUFFICIENT_EVIDENCE"
        status = "PARTIAL"
        limitations.append("The request did not map to a verified AG-21 operational fact.")
    elif intent.get("intent") not in {"TOP_PRIORITIES", "LIST", "FILTER", "COUNT", "OLDEST", "EVIDENCE", "RECOMMEND", "WHY", "COMPARE", "UNSUPPORTED", "EXECUTIVE_SUMMARY"}:
        answer = "AG-21 can answer current questions about queue, follow-up, clinical escalations, callbacks, feedback, X-ray orders, radiology review, and the persisted discharge summary. It does not infer unsupported causes, staffing needs, predictions, or impacts."
        answer_type = "INSUFFICIENT_EVIDENCE"
        status = "PARTIAL"
        limitations.append("The requested question did not map to a currently verified AG-21 evidence domain.")

    if intent.get("intent") in {"TOP_PRIORITIES", "EXECUTIVE_SUMMARY"} and not unsupported:
        candidates = [
            ("follow_up", "overdue", "Overdue follow-ups"),
            ("feedback", "requiring_action", "Feedback requiring action"),
            ("diagnostics", "requested_orders", "Requested X-ray orders"),
            ("radiology", "studies_awaiting_review", "Studies awaiting radiology review"),
            ("queue", "waiting", "Queue entries waiting"),
        ]
        priority_facts = []
        sources = []
        severity = ((summary.get("follow_up") or {}).get("metrics") or {}).get("escalations_by_severity") or {}
        high_escalations = sum(value for key, value in severity.items() if str(key).upper() in {"HIGH", "CRITICAL"} and isinstance(value, int))
        if high_escalations:
            priority_facts.append((high_escalations, "Open high/critical clinical escalations"))
            sources.extend(_bottleneck_source(item) for item in items if item.get("category") == "ESCALATION" and str(item.get("source_priority") or "").upper() in {"HIGH", "CRITICAL"})
        callback_priorities = ((summary.get("follow_up") or {}).get("metrics") or {}).get("callbacks_by_priority") or {}
        high_callbacks = sum(value for key, value in callback_priorities.items() if str(key).upper() in {"HIGH", "CRITICAL"} and isinstance(value, int))
        if high_callbacks:
            priority_facts.append((high_callbacks, "High-priority pending callbacks"))
            sources.extend(_bottleneck_source(item) for item in items if item.get("category") == "CALLBACK" and str(item.get("source_priority") or "").upper() in {"HIGH", "CRITICAL"})
        urgent_orders = {}
        for item in items:
            evidence = item.get("evidence") or {}
            if item.get("category") == "XRAY" and str(item.get("source_priority") or "").upper() == "URGENT" and evidence.get("order_status") == "Requested":
                urgent_orders.setdefault(evidence.get("order_id") or item.get("source_record_id"), item)
        if urgent_orders:
            priority_facts.append((len(urgent_orders), "Urgent X-ray orders with pending workflow evidence"))
            sources.extend(_bottleneck_source(item) for item in urgent_orders.values())
        unresolved_high = ((summary.get("feedback") or {}).get("metrics") or {}).get("unresolved_high_severity")
        if isinstance(unresolved_high, int) and unresolved_high:
            priority_facts.append((unresolved_high, "Unresolved high-severity feedback"))
            sources.extend(_bottleneck_source(item) for item in items if item.get("category") == "FEEDBACK" and str(item.get("source_priority") or "").upper() in {"HIGH", "CRITICAL"})
        for section_name, metric_name, label in candidates:
            value = _metric(summary, section_name, metric_name, label, sources)
            if value is not None:
                priority_facts.append((value, label))
        if priority_facts:
            answer = "Current management priorities (persisted severity/priority first, then backlog)\n" + "\n".join(
                f"{index}. {value} {label.lower()}." for index, (value, label) in enumerate(priority_facts, start=1)
            ) + "\nSuggested focus: review the listed high-severity and urgent items first, then work through overdue follow-ups, actionable feedback, pending orders/reviews, and queue waiting."
            answer_type = intent.get("intent")
            priority_sections = ("follow_up", "feedback", "diagnostics", "radiology", "queue")
            status = _status_for(summary, feed, priority_sections, tuple(feed.get("source_status", {})))
            limitations.extend(_unavailable_limitations(summary, feed, priority_sections, tuple(feed.get("source_status", {}))))
        else:
            answer = "AG-21 could not retrieve verified operational summary values at this time."
            status = "UNAVAILABLE"
            limitations.append("No verified AG-21 summary metrics were available.")

    if intent.get("intent") in {"LIST", "FILTER"} and not unsupported and answer_type != "QUEUE_LIST":
        category_for_domain = {"QUEUE": "QUEUE", "FOLLOW_UP": "FOLLOWUP", "ESCALATION": "ESCALATION", "CALLBACK": "CALLBACK", "FEEDBACK": "FEEDBACK", "XRAY": "XRAY", "RADIOLOGY_REVIEW": "RADIOLOGY_REVIEW"}.get(domain)
        selected = [item for item in items if category_for_domain and item.get("category") == category_for_domain]
        if domain == "XRAY":
            selected = [item for item in selected if (item.get("evidence") or {}).get("order_status") == "Requested"]
        if priority_filter:
            selected = [item for item in selected if (str(item.get("source_priority") or "").upper() in {"HIGH", "CRITICAL"} if priority_filter == "HIGH_OR_CRITICAL" else str(item.get("source_priority") or "").upper() == priority_filter)]
        distinct = {}
        for item in selected:
            evidence = item.get("evidence") or {}
            identifier = evidence.get("order_id") if domain == "XRAY" else item.get("source_record_id")
            distinct.setdefault(identifier or item.get("bottleneck_id"), item)
        listed = list(distinct.values())
        is_next_page = bool(re.search(r"\bnext\s*(?:\d+|five|ten)?\b|\bmore\b", question.casefold()) and context_question)
        list_offset = _requested_list_limit(context_question) if is_next_page else 0
        response_limit = _requested_list_limit(question, 5) if is_next_page else intent.get("filters", {}).get("limit", 10)
        shown = listed[list_offset:list_offset + response_limit]
        sources = [_bottleneck_source(item) for item in shown]
        if domain == "XRAY":
            order_metric = _metric_source(summary, "diagnostics", "requested_orders", "Requested X-ray orders")
            if order_metric:
                sources.insert(0, order_metric)
            count = order_metric["value"] if order_metric and not priority_filter else len(listed)
            status = _status_for(summary, feed, ("diagnostics",), ("xray",))
            if not priority_filter and count > len(listed):
                status = "PARTIAL"
                missing = count - len(listed)
                missing_text = "order has" if missing == 1 else "orders have"
                limitations.append(f"{count} requested orders are recorded. Detailed workflow evidence is available for {len(listed)} distinct orders. {missing} {missing_text} no detailed workflow evidence in the current AG-21 feed.")
            answer = f"{count} X-ray orders are currently in Requested status. Detailed workflow evidence is available for {len(listed)} distinct orders.\n"
            lines = []
            for item in shown:
                evidence = item.get("evidence") or {}
                fields = [f"Accession {evidence['accession_number']}" if evidence.get("accession_number") else "Accession unavailable",
                          evidence.get("examination"), evidence.get("projection"),
                          f"Priority {item.get('source_priority')}" if item.get("source_priority") else None,
                          f"Order {evidence.get('order_status')}" if evidence.get("order_status") else None,
                          f"Workflow {evidence.get('projection_status')}" if evidence.get("projection_status") else None,
                          f"Age {_display_age(item.get('age_minutes'))}" if item.get("age_minutes") is not None else None]
                lines.append("• " + " · ".join(str(value) for value in fields if value))
            answer += "\n".join(lines)
        else:
            answer = f"{len(listed)} {domain.replace('_', ' ').lower()} items are currently listed in verified pending-workflow evidence."
            feed_names = {"QUEUE": ("queue",), "FOLLOW_UP": ("follow_up",), "ESCALATION": ("escalations",), "CALLBACK": ("callbacks",), "FEEDBACK": ("feedback",), "XRAY": ("xray",), "RADIOLOGY_REVIEW": ("radiology",)}.get(domain, ())
            status = _status_for(summary, feed, (), feed_names)
            if domain == "RADIOLOGY_REVIEW":
                metric = _metric_source(summary, "radiology", "studies_awaiting_review", "Studies awaiting review")
                if metric:
                    sources.insert(0, metric)
                summary_count = metric["value"] if metric else len(listed)
                answer = f"{summary_count} studies are awaiting radiologist review. Detailed bottleneck evidence is available for {len(listed)} distinct records:"
                lines = []
                for index, item in enumerate(shown, 1):
                    evidence = item.get("evidence") or {}
                    details = [f"Accession {evidence['accession_number']}" if evidence.get("accession_number") else "Accession unavailable",
                               "Examination unavailable in current bottleneck evidence",
                               f"Review status {evidence.get('review_status') or item.get('source_status') or 'Unavailable'}",
                               f"Priority {evidence.get('priority')}" if evidence.get("priority") else None,
                               f"Age {_display_age(item.get('age_minutes'))}" if item.get("age_minutes") is not None else None]
                    lines.append(f"{index}. " + " · ".join(str(value) for value in details if value))
                answer += "\n" + "\n".join(lines) if lines else "\nNo detailed radiology review records are available."
            elif listed:
                answer += "\n" + "\n".join(f"• {item.get('title') or item.get('category', 'Work item')} · {item.get('source_status') or 'Status unavailable'}" for item in shown)
        if domain == "FEEDBACK":
            feedback_results = [_feedback_result(item) for item in shown]
            sources = [_bottleneck_source(item) for item in shown]
            if is_next_page:
                answer = f"Next {len(shown)} feedback cases requiring action:"
            elif response_limit < 10:
                answer = f"Top {len(shown)} feedback cases requiring action:"
            else:
                answer = f"Feedback cases requiring action (showing {len(shown)} of {len(listed)}):"
        if list_offset > 0 and list_offset >= len(listed):
            answer += "No additional matching items are available."
        elif listed:
            answer += f"\nShowing {list_offset + 1}–{min(list_offset + response_limit, len(listed))} of {len(listed)}."
        if len(listed) > list_offset + response_limit:
            next_limit = response_limit
            answer += f" Ask ‘show next {next_limit}’ or use View Sources."

    if intent.get("intent") == "COUNT" and domain == "FEEDBACK" and not unsupported:
        value = next((source.get("value") for source in sources if source.get("metric") == "Feedback requiring action"), None)
        if value is not None:
            by_status = {}
            for item in items:
                if item.get("category") == "FEEDBACK":
                    state = str(item.get("source_status") or "Unknown").replace("_", " ").title()
                    by_status[state] = by_status.get(state, 0) + 1
            answer = f"{value} feedback cases currently require action."
            if by_status:
                answer += "\n" + "\n".join(f"• {state}: {count}" for state, count in sorted(by_status.items()))
    unavailable_sources = _unavailable_limitations(summary, feed, ("queue", "follow_up", "feedback", "diagnostics", "radiology", "discharge"), tuple((feed.get("source_status") or {}).keys()))
    if not summary:
        unavailable_sources.append("The AG-21 summary retrieval failed; this answer can use only available bottleneck evidence.")
    if unavailable_sources:
        limitations.extend(unavailable_sources)
        if status == "AVAILABLE":
            status = "PARTIAL"

    if not sources:
        sources.append({"kind": "LIMITATION", "source_module": "AG-21 Management Copilot", "source_tables": [],
                        "metric": "Evidence coverage for requested claim", "value": "No supporting verified AG-21 fact was selected",
                        "provenance": {"data_status": status, "data_origin": "NO_SUPPORTING_SOURCE", "synthetic_values_used": False,
                                       "calculated_at": generated_at}})
    if evidence_followup:
        limitations = ["Sources reflect a fresh AG-21 read for the referenced question; earlier chat text does not override current source records."] + limitations
    return {
        "answer": answer,
        "answer_type": answer_type,
        "intent": intent.get("intent"),
        **({"modifier": intent["modifier"]} if intent.get("modifier") else {}),
        "domain": domain,
        "filters": intent.get("filters", {}),
        **({"items": feedback_results} if domain == "FEEDBACK" and intent.get("intent") in {"LIST", "FILTER", "OLDEST", "EVIDENCE"} else {}),
        **({"items": items} if answer_type == "QUEUE_LIST" else {}),
        "generated_at": generated_at,
        "data_status": status,
        "sources": sources,
        "limitations": list(dict.fromkeys(limitations)),
        "llm_used": llm_classified,
        "conversation_context_used": bool(context_question),
    }
