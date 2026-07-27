"""Generate a structured scorecard from a completed mock interview transcript."""
from __future__ import annotations
import json
import logging
from sqlalchemy.orm import Session
from app.models.mvp2 import Conversation, Message

logger = logging.getLogger(__name__)

_REPORT_PROMPT = """You are an expert interview coach. Analyse this mock interview transcript and produce a JSON scorecard.

JOB: {job_title} at {company} ({sector})
INTERVIEW TYPE: {interview_type}

TRANSCRIPT:
{transcript}

Return ONLY valid JSON with this exact structure:
{{
  "overall_score": <0-100>,
  "verdict": "<Strong Hire | Hire | Maybe | No Hire>",
  "summary": "<2-3 sentence overall assessment>",
  "competencies": [
    {{"name": "<competency>", "score": <0-100>, "comment": "<1 sentence>"}}
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<area 1>", "<area 2>", "<area 3>"],
  "best_answer": "<quote the single best answer the candidate gave>",
  "weakest_answer": "<quote the weakest answer and why>",
  "answer_analysis": [
    {{
      "question": "<interviewer's question>",
      "original_answer": "<candidate's exact answer, quoted>",
      "score": <0-100>,
      "what_worked": "<1 sentence on what was good>",
      "what_missed": "<1 sentence on what was missing or weak>",
      "rewritten_answer": "<a stronger version of the candidate's answer that they could have given — same facts but better framing, structure, and impact>"
    }}
  ]
}}

Include every candidate answer in answer_analysis, not just the weak ones.
Score competencies relevant to the role: communication, domain knowledge, problem-solving, cultural fit, confidence."""


async def generate_report(conv_id: str, db: Session) -> dict:
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv or conv.context_type != "mock_interview":
        return {"error": "Not a mock interview conversation"}

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
        .all()
    )

    # Build transcript — skip the silent auto-start trigger
    lines = []
    for m in messages:
        role = "Interviewer" if m.role == "assistant" else "Candidate"
        # Skip the hidden auto-start trigger (starts with "Please conduct")
        if m.role == "user" and m.content.startswith("Please conduct"):
            continue
        lines.append(f"{role}: {m.content}")

    transcript = "\n\n".join(lines)
    if not transcript.strip():
        return {"error": "No transcript available yet"}

    cfg = conv.interview_config or {}
    itype = cfg.get("interview_type", "hr")
    itype_label = {"hr": "HR Screening", "technical": "Technical Round", "stress": "Stress Interview"}.get(itype, "Interview")

    prompt = _REPORT_PROMPT.format(
        job_title=cfg.get("job_title", "Unknown Role"),
        company=cfg.get("company", "Unknown Company"),
        sector=cfg.get("sector", "general"),
        interview_type=itype_label,
        transcript=transcript[:6000],  # cap to avoid token overflow
    )

    try:
        from app.ai.providers import create_provider
        provider = create_provider()
        full = ""
        async for chunk in provider.stream(
            "You are an interview evaluation expert. Return only valid JSON.",
            [{"role": "user", "content": prompt}],
        ):
            full += chunk

        # Extract JSON from response
        start = full.find("{")
        end = full.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(full[start:end])
        return {"error": "Could not parse report", "raw": full[:500]}

    except Exception as exc:
        logger.error(f"[INTERVIEW REPORT] Failed: {exc}")
        return {"error": str(exc)}
