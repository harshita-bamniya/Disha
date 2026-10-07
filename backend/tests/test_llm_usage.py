from types import SimpleNamespace

from app.ai import llm_usage as usage


def test_summarise_folds_fields_and_prices_only_when_given():
    raw = {"roadmap|m1|calls": 2, "roadmap|m1|in": 1_000_000, "roadmap|m1|out": 500_000, "resume_match|m2|calls": 1,
           "resume_match|m2|in": 10, "resume_match|m2|out": 5}
    rows = usage.summarise(raw, {"m1": {"in": 0.10, "out": 0.40}})
    a = next(r for r in rows if r["model"] == "m1")
    assert (a["calls"], a["in"], a["out"], a["usd"]) == (2, 1_000_000, 500_000, 0.3)
    assert next(r for r in rows if r["model"] == "m2")["usd"] is None          # no price supplied: no invented cost


def test_record_never_raises_when_redis_is_down(monkeypatch):
    import app.database as database
    monkeypatch.setattr(database, "get_redis_client", lambda: (_ for _ in ()).throw(ConnectionError("down")))
    usage.record("roadmap", "m", 1, 2)
    usage.record_message("roadmap", SimpleNamespace(model="m", input_tokens=None, output_tokens=None))


def test_bad_price_json_is_ignored(monkeypatch):
    monkeypatch.setenv("LLM_PRICES", "{not json")
    assert usage.prices() == {}
