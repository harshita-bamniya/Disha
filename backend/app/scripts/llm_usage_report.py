"""Print LLM calls and tokens per feature and model.   python -m app.scripts.llm_usage_report [days]"""
import sys

from app.ai import llm_usage as usage

if __name__ == "__main__":
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    rows = usage.report(days)
    if not rows:
        print("No usage recorded in that window.")
    for r in rows:
        cost = f"${r['usd']}" if r["usd"] is not None else "n/a (set LLM_PRICES)"
        print(f"{r['feature']:<14} {r['model']:<28} calls={r['calls']:<5} in={r['in']:<9} out={r['out']:<9} cost={cost}")
