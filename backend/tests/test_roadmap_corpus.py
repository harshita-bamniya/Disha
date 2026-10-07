"""Blueprint grounding in the market-roles catalogue (pure logic, fake corpus)."""
import uuid
from types import SimpleNamespace as NS

from app.modules.roadmap_engine import corpus, targeting


def _role(role, req=(), pref=(), resp="", company="Acme"):
    return NS(id=uuid.uuid4(), job_role=role, company_name=company, industry="Tech", required_skills=list(req),
              preferred_skills=list(pref), key_responsibilities=resp, job_description="")


def test_select_roles_drops_roles_below_the_floor():
    roles = [_role("Regulatory Affairs Analyst"), _role("ESG Reporting Analyst"), _role("Strategy Analyst")]
    vecs = [[1.0, 0.0], [0.6, 0.8], [0.0, 1.0]]            # cosines against the job vector: 1.0, 0.6, 0.0
    picked = corpus.select_roles("Regulatory Affairs Officer", [1.0, 0.0], roles, vecs)
    assert [r.job_role for r in picked] == ["Regulatory Affairs Analyst"]


def test_select_roles_caps_and_orders_best_first():
    roles = [_role(f"Compliance Analyst {i}") for i in range(20)]
    vecs = [[1.0, 0.0]] * 20
    assert len(corpus.select_roles("Compliance Analyst", [1.0, 0.0], roles, vecs)) == corpus.ROLE_MAX


def test_no_embedding_means_no_roles():
    roles = [_role("Compliance Analyst")]
    assert corpus.select_roles("Compliance Analyst", None, roles, [None]) == []


def test_evidence_counts_roles_that_mention_the_skill():
    roles = [
        _role("Compliance Analyst", ["Regulatory compliance", "Report writing"]),
        _role("Policy Analyst", resp="Draft policy briefs and report writing for ministers"),
        _role("Data Analyst", ["SQL", "Excel"]),
    ]
    skills = [{"name": "Report Writing"}, {"name": "SQL Querying", "core_topic": "SQL"}, {"name": "Kubernetes Operations"}]
    corpus.compute_evidence(skills, [corpus.role_text(r) for r in roles], ["live posting asks for report writing"])
    assert skills[0]["evidence"] == {"roles_matched": 2, "roles_total": 3, "postings_matched": 1, "postings_total": 1}
    assert skills[1]["evidence"]["roles_matched"] == 1        # matched through core_topic
    assert skills[2]["evidence"]["roles_matched"] == 0


def test_grounding_counts_catalogue_roles():
    skills = [{"id": f"s{i}", "name": f"S{i}", "evidence": {"roles_matched": m, "roles_total": 10,
                                                            "postings_matched": 0, "postings_total": 1}}
              for i, m in enumerate([4, 3, 2, 1, 0])]
    g = targeting.grounding(skills)
    assert g["level"] == "grounded" and g["skills_with_postings"] == 4


def test_grounding_unverified_when_catalogue_has_nothing():
    skills = [{"id": f"s{i}", "name": f"S{i}", "evidence": {"roles_matched": 0, "roles_total": 0,
                                                            "postings_matched": 0, "postings_total": 1}}
              for i in range(8)]
    assert targeting.grounding(skills)["level"] == "unverified"


def test_sources_record_lists_exactly_the_corpus_used():
    roles = [_role("Regulatory Affairs Analyst", company="Tata Power")]
    live = [NS(id=uuid.uuid4(), title="Compliance Officer")]
    rec = corpus.sources_record(roles, live)
    assert rec["roles_total"] == 1 and rec["roles_used"][0]["company"] == "Tata Power"
    assert rec["postings_total"] == 1 and rec["corpus"] == "market_roles"
    assert corpus.sources_record([], live)["corpus"] == "live_postings_only"


def test_prompt_block_contains_only_corpus_roles():
    roles = [_role("Regulatory Affairs Analyst", ["DPDP"], company="Tata Power", resp="File returns")]
    block = corpus.roles_block(roles, [])
    assert "Tata Power" in block and "[R1]" in block and "[P" not in block


# ── salary benchmark ─────────────────────────────────────────────────────────

from app.modules.roadmap_engine import salary


def test_salary_from_roles_needs_three_and_uses_median():
    assert salary.from_roles([(5, 8), (6, 9)]) is None
    got = salary.from_roles([(4, 7), (6, 9), (30, 40)])
    assert (got["min"], got["max"], got["n"], got["basis"]) == (6, 9, 3, "reference_roles")


def test_salary_benchmark_rows_need_shared_words():
    rows = [NS(role_category="FinTech Startup", specific_role="Regulatory/Compliance Analyst (Perfios)", entry_min=6, entry_max=9),
            NS(role_category="Consulting – MBB", specific_role="Research Analyst", entry_min=8, entry_max=13)]
    got = salary.from_benchmark_rows("Compliance & Regulatory Affairs Officer", "Compliance Regulatory Specialist", rows)
    assert (got["min"], got["max"], got["n"]) == (6, 9, 1)
    assert salary.from_benchmark_rows("Senior Backend Engineer", "Backend Engineer", rows) is None


# ── Skill Framework bridge ───────────────────────────────────────────────────

from app.modules.roadmap_engine import skill_bridge


def _fw(activity, developed, translation, depth):
    return NS(upsc_activity=activity, skill_developed=developed, corporate_translation=translation, skill_depth=depth)


FW = [
    _fw("GS-II: Polity, Constitution, Governance", "Constitutional & Legislative Knowledge", "Regulatory Affairs; Legal Research", 9),
    _fw("Essay Writing Practice", "Thesis construction; structured argument", "Business Communication; Report Writing", 8),
    _fw("Mock tests", "Speed", "Regulatory Affairs", 4),            # too shallow to count
]


def test_bridge_needs_a_row_linking_both_sides():
    got = skill_bridge.bridge("Regulatory Compliance", ["Polity"], FW)
    assert got and got[0] == "Polity" and got[1].skill_depth == 9
    assert skill_bridge.bridge("Regulatory Compliance", ["Cooking"], FW) is None       # learner side not in any row
    assert skill_bridge.bridge("Kubernetes", ["Polity"], FW) is None                    # job side not in any row


def test_shallow_rows_do_not_count():
    assert skill_bridge.bridge("Regulatory Affairs", ["Mock tests"], [FW[2]]) is None


def test_generic_words_do_not_bridge():
    assert skill_bridge.bridge("Data Analysis", ["Research methods"], [_fw("Research", "Analysis skills", "Analysis", 9)]) is None


def test_apply_resets_unfounded_partials_and_never_touches_known():
    skills = [{"id": "a", "name": "Report Writing"}, {"id": "b", "name": "Kubernetes"}, {"id": "c", "name": "Regulatory Compliance"}]
    status = {"a": {"status": "learn", "matched": None}, "b": {"status": "partial", "matched": "Polity"},
              "c": {"status": "known", "matched": "Law"}}
    out = skill_bridge.apply(skills, status, ["Essay Writing"], FW)
    assert status["a"]["status"] == "partial" and status["a"]["matched"] == "Essay Writing"
    assert status["b"]["status"] == "learn" and status["b"]["matched"] is None
    assert status["c"]["status"] == "known"
    assert out == {"backed": 1, "reset_to_learn": 1, "added": 1}


def test_one_shared_word_in_a_long_skill_name_is_not_enough():
    rows = [_fw("Optional Subject Mastery (Public Administration)", "Administrative theory", "Policy Consultant; Governance; Implementation", 9)]
    assert skill_bridge.bridge("ISO/IEC 27001:2022 Implementation Basics", ["Public Administration"], rows) is None


def test_learner_skill_must_be_fully_named_by_the_row():
    rows = [_fw("GS-IV: Ethics, Integrity & Aptitude", "Ethical Reasoning; Governance Values", "Compliance & Ethics; Government Regulations", 8)]
    assert skill_bridge.bridge("Government Regulations Compliance", ["Quantitative Aptitude"], rows) is None
    assert skill_bridge.bridge("Government Regulations Compliance", ["Ethics"], rows) is not None
