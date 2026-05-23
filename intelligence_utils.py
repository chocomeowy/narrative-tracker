import re
from datetime import datetime
from urllib.parse import urlparse, urlunparse


ALLOWED_STAGES = ["Incubation", "Breakthrough", "Peak Hype", "Fatigue"]
STAGE_INDEX = {stage: index for index, stage in enumerate(ALLOWED_STAGES)}

BLOG_DOMAIN_HINTS = (
    "blog.",
    "medium.com",
    "substack.com",
    "wordpress.com",
    "blogspot.",
)

PRIMARY_DOMAIN_HINTS = (
    ".gov",
    ".edu",
    "congress.gov",
    "senate.gov",
    "ustr.gov",
    "usitc.gov",
    "wto.org",
    "oecd.org",
    "iras.gov.sg",
    "imda.gov.sg",
    "ethereum.org",
    "bitcoin.org",
)


def utc_now_iso():
    return datetime.utcnow().isoformat() + "Z"


def stable_id(value):
    slug = re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")
    return slug or "trend"


def normalize_url(url):
    if not isinstance(url, str):
        return None
    url = url.strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return urlunparse((parsed.scheme, parsed.netloc.lower(), parsed.path.rstrip("/"), "", parsed.query, ""))


def source_type_for_url(url):
    domain = urlparse(url).netloc.lower()
    if "wikipedia.org" in domain:
        return "wikipedia"
    if any(hint in domain for hint in BLOG_DOMAIN_HINTS):
        return "blog"
    if any(hint in domain for hint in PRIMARY_DOMAIN_HINTS):
        return "primary"
    return "secondary"


def find_source_date(url, raw_intel):
    normalized = normalize_url(url)
    if not normalized:
        return None
    for item in raw_intel or []:
        if not isinstance(item, dict):
            continue
        item_url = normalize_url(item.get("url") or item.get("href"))
        if item_url == normalized:
            return item.get("date") or item.get("published") or item.get("published_date")
    return None


def extract_date_from_url(url):
    if not url:
        return None
    # 1. Look for YYYY/MM/DD or YYYY-MM-DD bounded by slashes
    match = re.search(r'/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/', url)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # 2. Look for YYYY/MM/DD or YYYY-MM-DD generally
    match = re.search(r'\b(20\d{2})[/-](0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])\b', url)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # 3. Look for month names: /2026/may/15/
    months_pattern = r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)'
    match = re.search(fr'/(\d{{4}})/{months_pattern}/(\d{{1,2}})/', url, re.IGNORECASE)
    if match:
        year, month_name, day = match.groups()
        month_map = {"jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06", 
                     "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"}
        month = month_map[month_name.lower()[:3]]
        return f"{year}-{month}-{day.zfill(2)}"
        
    # 4. Look for apr-2025 or similar
    match = re.search(fr'\b{months_pattern}[-/_](\d{{4}})\b', url, re.IGNORECASE)
    if match:
        month_name, year = match.groups()
        month_map = {"jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06", 
                     "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"}
        month = month_map[month_name.lower()[:3]]
        return f"{year}-{month}-01"

    # 5. Look for YYYY/MM
    match = re.search(r'/(\d{4})/(\d{2})/', url)
    if match:
        year, month = match.groups()
        return f"{year}-{month}-01"

    return None


def clean_sources(source_links, raw_intel):
    seen = set()
    clean_links = []
    invalid_links = []

    for link in source_links or []:
        normalized = normalize_url(link)
        if not normalized:
            invalid_links.append(str(link))
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        clean_links.append(normalized)

    details = []
    for link in clean_links:
        pub_date = find_source_date(link, raw_intel)
        if not pub_date:
            pub_date = extract_date_from_url(link)
        details.append({
            "url": link,
            "domain": urlparse(link).netloc.lower().replace("www.", ""),
            "type": source_type_for_url(link),
            "published_date": pub_date,
        })

    counts = {
        "total_sources": len(details),
        "primary_source_count": sum(1 for item in details if item["type"] == "primary"),
        "secondary_source_count": sum(1 for item in details if item["type"] == "secondary"),
        "wikipedia_source_count": sum(1 for item in details if item["type"] == "wikipedia"),
        "blog_source_count": sum(1 for item in details if item["type"] == "blog"),
    }
    counts["has_primary_sources"] = counts["primary_source_count"] > 0
    counts["source_risk"] = (
        "low" if counts["has_primary_sources"]
        else "medium" if counts["total_sources"] > 1 and counts["wikipedia_source_count"] < counts["total_sources"]
        else "high"
    )

    return clean_links, details, counts, invalid_links


def normalize_evidence(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        parts = [part.strip() for part in re.split(r";|\n", value) if part.strip()]
        return parts or [value.strip()]
    return []


def normalize_confidence(value, errors, name):
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        errors.append(f"{name}: confidence missing or invalid; defaulted to 0.5")
        return 0.5
    if confidence > 1:
        confidence = confidence / 100
    if confidence < 0 or confidence > 1:
        errors.append(f"{name}: confidence out of range; clamped")
    return max(0, min(confidence, 1))


def velocity_bucket(value):
    text = str(value or "").lower()
    number_match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if number_match:
        number = float(number_match.group(0))
        if number >= 20:
            return 2
        if number > 0:
            return 1
        if number <= -10:
            return -2
        if number < 0:
            return -1
    if any(word in text for word in ("extreme", "surging", "accelerating", "high")):
        return 2
    if any(word in text for word in ("medium", "stable", "steady")):
        return 0
    if any(word in text for word in ("low", "dropping", "declining", "fatigue")):
        return -1
    return 0


def detect_changes(trend, previous):
    if not previous:
        return {
            "is_new": True,
            "stage_delta": "new",
            "velocity_delta": "new",
            "new_sources": trend.get("source_links", []),
            "dropped_sources": [],
            "summary_changed": False,
        }

    old_stage = previous.get("stage", "Incubation")
    new_stage = trend.get("stage", "Incubation")
    stage_delta = STAGE_INDEX.get(new_stage, 0) - STAGE_INDEX.get(old_stage, 0)

    old_velocity = velocity_bucket(previous.get("velocity"))
    new_velocity = velocity_bucket(trend.get("velocity"))
    old_sources = set(normalize_url(url) for url in previous.get("source_links", []) if normalize_url(url))
    new_sources = set(normalize_url(url) for url in trend.get("source_links", []) if normalize_url(url))

    return {
        "is_new": False,
        "stage_delta": stage_delta,
        "previous_stage": old_stage,
        "velocity_delta": new_velocity - old_velocity,
        "previous_velocity": previous.get("velocity"),
        "new_sources": sorted(new_sources - old_sources),
        "dropped_sources": sorted(old_sources - new_sources),
        "summary_changed": (previous.get("summary") or previous.get("description")) != trend.get("summary"),
    }


def validate_and_enrich_trends(ai_trends, previous_trends=None, raw_intel=None, max_trends=25):
    previous_by_name = {item.get("name", ""): item for item in previous_trends or [] if item.get("name")}
    validation_errors = []
    enriched = []
    seen_names = set()

    if not isinstance(ai_trends, list):
        return [], ["AI output trends must be a list"], {"accepted": 0, "rejected": 0}

    for index, raw_trend in enumerate(ai_trends[:max_trends]):
        if not isinstance(raw_trend, dict):
            validation_errors.append(f"trend[{index}]: rejected non-object trend")
            continue

        name = str(raw_trend.get("name") or raw_trend.get("title") or "").strip()
        if not name:
            validation_errors.append(f"trend[{index}]: rejected missing name")
            continue
        if name.lower() in seen_names:
            validation_errors.append(f"{name}: rejected duplicate name")
            continue
        seen_names.add(name.lower())

        stage = str(raw_trend.get("stage") or "Incubation").strip()
        if stage not in ALLOWED_STAGES:
            validation_errors.append(f"{name}: invalid stage '{stage}'; defaulted to Incubation")
            stage = "Incubation"

        source_links, source_details, source_quality, invalid_links = clean_sources(raw_trend.get("source_links", []), raw_intel)
        for link in invalid_links:
            validation_errors.append(f"{name}: dropped invalid source URL '{link}'")

        confidence = normalize_confidence(raw_trend.get("confidence", 0.5), validation_errors, name)
        evidence = normalize_evidence(raw_trend.get("evidence") or raw_trend.get("keywords"))
        if not evidence:
            validation_errors.append(f"{name}: evidence missing")
        if not source_links:
            validation_errors.append(f"{name}: source_links missing")

        trend = {
            "id": raw_trend.get("id") or stable_id(name),
            "name": name,
            "stage": stage,
            "velocity": str(raw_trend.get("velocity") or "Stable"),
            "category": str(raw_trend.get("category") or "General").strip() or "General",
            "summary": str(raw_trend.get("summary") or raw_trend.get("description") or "No summary available.").strip(),
            "evidence": evidence,
            "source_links": source_links,
            "source_details": source_details,
            "source_quality": source_quality,
            "confidence": confidence,
            "reasoning": str(raw_trend.get("reasoning") or raw_trend.get("rationale") or "").strip(),
            "validation_flags": [],
        }

        if source_quality["source_risk"] == "high":
            trend["validation_flags"].append("weak_source_support")
        if source_quality["wikipedia_source_count"] and source_quality["wikipedia_source_count"] == source_quality["total_sources"]:
            trend["validation_flags"].append("wikipedia_only")
        if source_quality["blog_source_count"] and source_quality["blog_source_count"] == source_quality["total_sources"]:
            trend["validation_flags"].append("blog_only")

        trend["changed_since_previous_run"] = detect_changes(trend, previous_by_name.get(name))
        enriched.append(trend)

    if len(ai_trends) > max_trends:
        validation_errors.append(f"AI returned {len(ai_trends)} trends; kept first {max_trends}")

    stats = {
        "accepted": len(enriched),
        "rejected": max(0, len(ai_trends) - len(enriched)),
        "validation_error_count": len(validation_errors),
    }
    return enriched, validation_errors, stats


def build_updated_documents(current_map, archive_map, ai_trends, briefing_text, model_id, focus, raw_intel):
    current_trends = current_map.get("trends", []) if isinstance(current_map, dict) else []
    archive_trends = archive_map.get("archived_trends", []) if isinstance(archive_map, dict) else []
    validated_trends, validation_errors, validation_stats = validate_and_enrich_trends(ai_trends, current_trends, raw_intel)

    previous_by_name = {trend.get("name", ""): trend for trend in current_trends if trend.get("name")}
    active_names = {trend["name"] for trend in validated_trends}
    updated_archive = list(archive_trends)
    now = utc_now_iso()

    for name, dropped_trend in previous_by_name.items():
        if name in active_names:
            continue
        archived = dropped_trend.copy()
        archived["archived_at"] = now
        archived["archive_reason"] = "not_returned_by_latest_agent_run"
        updated_archive.append(archived)

    search_result_count = len([item for item in raw_intel or [] if isinstance(item, dict) and item.get("url")])
    status = "success"
    if not validated_trends:
        status = "failed"
    elif validation_errors:
        status = "warning"

    run_health = {
        "status": status,
        "model": model_id,
        "focus": focus,
        "timestamp": now,
        "search_result_count": search_result_count,
        "validation_error_count": len(validation_errors),
        "validation_failures": validation_errors[:50],
    }

    updated_map = {
        "last_updated": now,
        "executive_briefing": briefing_text,
        "trends": validated_trends,
        "intelligence_metadata": {
            "agent": model_id,
            "focus": focus,
            "timestamp": now,
            "active_narratives": len(validated_trends),
            "validation": validation_stats,
            "run_health": run_health,
        },
        "run_health": run_health,
    }

    updated_archive_doc = {
        "last_updated": now,
        "archived_trends": updated_archive,
    }
    return updated_map, updated_archive_doc
