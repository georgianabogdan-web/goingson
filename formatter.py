"""Format Granola meeting data into Markdown and JSON for storage."""

import json
from datetime import datetime
from typing import Optional


def format_transcript_markdown(doc: dict, transcript: list[dict]) -> str:
    """Format a meeting document and transcript as readable Markdown."""
    lines = []

    # Title
    title = doc.get("title", "Untitled Meeting")
    lines.append(f"# {title}")
    lines.append("")

    # Metadata
    meeting_date = doc.get("meeting_date") or doc.get("created_at", "Unknown")
    lines.append(f"**Date:** {_format_date(meeting_date)}")

    if doc.get("workspace_name"):
        lines.append(f"**Workspace:** {doc['workspace_name']}")

    # Participants / attendees
    attendees = doc.get("attendees") or doc.get("participants") or []
    if attendees:
        if isinstance(attendees[0], dict):
            names = [a.get("name") or a.get("email", "Unknown") for a in attendees]
        else:
            names = attendees
        lines.append(f"**Participants:** {', '.join(names)}")

    lines.append(f"**Document ID:** {doc.get('document_id', doc.get('id', 'Unknown'))}")
    lines.append("")

    # Notes content (if available in the document)
    notes = _extract_notes(doc)
    if notes:
        lines.append("## Notes")
        lines.append("")
        lines.append(notes)
        lines.append("")

    # Transcript
    lines.append("## Transcript")
    lines.append("")

    if not transcript:
        lines.append("*No transcript available.*")
    else:
        current_speaker = None
        for utterance in transcript:
            text = utterance.get("text", "").strip()
            if not text:
                continue

            speaker = utterance.get("speaker") or utterance.get("source", "")
            timestamp = utterance.get("start_timestamp")

            # Format timestamp
            ts_str = ""
            if timestamp:
                try:
                    ts = float(timestamp)
                    minutes = int(ts // 60)
                    seconds = int(ts % 60)
                    ts_str = f"[{minutes:02d}:{seconds:02d}] "
                except (ValueError, TypeError):
                    ts_str = f"[{timestamp}] "

            # Show speaker changes
            if speaker and speaker != current_speaker:
                current_speaker = speaker
                lines.append(f"**{speaker}:**")

            lines.append(f"{ts_str}{text}")
            lines.append("")

    return "\n".join(lines)


def format_transcript_json(doc: dict, transcript: list[dict]) -> str:
    """Format a meeting document and transcript as structured JSON."""
    output = {
        "document_id": doc.get("document_id", doc.get("id")),
        "title": doc.get("title", "Untitled Meeting"),
        "meeting_date": doc.get("meeting_date") or doc.get("created_at"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "workspace_id": doc.get("workspace_id"),
        "workspace_name": doc.get("workspace_name"),
        "attendees": doc.get("attendees") or doc.get("participants") or [],
        "notes": _extract_notes(doc),
        "transcript": transcript,
        "export_timestamp": datetime.utcnow().isoformat() + "Z",
    }
    return json.dumps(output, indent=2, ensure_ascii=False, default=str)


def make_filename(doc: dict, extension: str) -> str:
    """Generate a filename for a meeting document."""
    date_str = doc.get("meeting_date") or doc.get("created_at", "")
    title = doc.get("title", "Untitled")

    # Clean the date
    if date_str:
        try:
            from granola_client import _parse_date
            dt = _parse_date(date_str)
            date_prefix = dt.strftime("%Y-%m-%d")
        except (ValueError, ImportError):
            date_prefix = date_str[:10]
    else:
        date_prefix = "unknown-date"

    # Clean the title for use as filename
    clean_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title)
    clean_title = clean_title.strip().replace(" ", "-")[:80]

    return f"{date_prefix}_{clean_title}.{extension}"


def _format_date(date_str: str) -> str:
    """Format a date string for display."""
    try:
        from granola_client import _parse_date
        dt = _parse_date(date_str)
        return dt.strftime("%B %d, %Y at %I:%M %p")
    except (ValueError, ImportError):
        return date_str


def _extract_notes(doc: dict) -> Optional[str]:
    """Extract notes content from a document."""
    # Granola stores notes in ProseMirror format or as plain text
    content = doc.get("content") or doc.get("notes") or doc.get("body")
    if not content:
        return None

    if isinstance(content, str):
        return content

    if isinstance(content, dict):
        # ProseMirror format - extract text
        return _prosemirror_to_text(content)

    return None


def _prosemirror_to_text(node: dict) -> str:
    """Convert ProseMirror JSON to plain text."""
    if not isinstance(node, dict):
        return ""

    text_parts = []

    if node.get("type") == "text":
        text_parts.append(node.get("text", ""))

    for child in node.get("content", []):
        text_parts.append(_prosemirror_to_text(child))

    # Add newlines after block-level elements
    if node.get("type") in ("paragraph", "heading", "bulletList", "orderedList", "listItem"):
        text_parts.append("\n")

    return "".join(text_parts)
