"""Phase 4 interview voice and language: languages, speech providers (with the
network faked), opt-in answer-audio storage, and the voice service limits.
Pure unit tests (no database, no network).
"""
from __future__ import annotations

import asyncio
import base64
import io
import os
import time
import wave
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ai import language, speech
from app.ai.providers.groq import RateLimitedError
from app.modules.interview import audio_store
from app.modules.interview.service import voice

SESSION_ID = "3f2b8c1e-1111-4a2b-9c3d-123456789abc"


def run(coro):
    return asyncio.run(coro)


# ── languages ─────────────────────────────────────────────────────────────────

class TestLanguage:
    def test_unknown_language_falls_back_to_english(self):
        assert language.normalize("klingon") == "en"
        assert language.normalize(None) == "en"
        assert language.normalize("hinglish") == "hinglish"

    def test_english_adds_no_generation_instruction(self):
        assert language.instruction("en") == ""

    def test_hindi_and_hinglish_instructions_name_the_script(self):
        assert "Devanagari" in language.instruction("hi")
        assert "Roman script" in language.instruction("hinglish")

    def test_feedback_never_judges_language_or_accent(self):
        for code in ("en", "hi", "hinglish"):
            text = language.feedback_instruction(code)
            assert "accent" in text and "code-switching" in text

    def test_english_feedback_has_no_translation_demand(self):
        assert "Write all feedback" not in language.feedback_instruction("en")
        assert "Hindi" in language.feedback_instruction("hi")

    def test_hinglish_lets_the_recogniser_autodetect(self):
        assert language.LANGUAGES["hinglish"]["whisper"] is None
        assert language.LANGUAGES["hi"]["whisper"] == "hi"

    def test_public_list(self):
        assert [l["code"] for l in language.public_list()] == ["en", "hi", "hinglish"]


# ── speech providers ──────────────────────────────────────────────────────────

def _settings(**kw):
    base = dict(
        groq_api_key="", gemini_api_key="", gemini_model="gem", interview_stt_groq_model="whisper-x",
        interview_stt_gemini_model="", interview_tts_gemini_model="tts-x", interview_tts_gemini_fallback_models="tts-y, tts-z", interview_tts_voice="Kore",
        interview_max_audio_mb=1, interview_tts_max_chars=50, interview_tts_calls_per_session=2,
        interview_audio_retention_days=30, upload_dir=".",
    )
    base.update(kw)
    return SimpleNamespace(**base)


class TestCapabilities:
    def test_nothing_configured(self):
        with patch.object(speech, "get_settings", return_value=_settings()):
            caps = speech.capabilities()
        assert caps["server_stt"] is False and caps["server_tts"] is False

    def test_groq_gives_stt_and_gemini_gives_tts(self):
        with patch.object(speech, "get_settings", return_value=_settings(groq_api_key="g")):
            assert speech.stt_provider() == "groq" and speech.tts_available() is False
        with patch.object(speech, "get_settings", return_value=_settings(gemini_api_key="k")):
            assert speech.stt_provider() == "gemini" and speech.tts_available() is True


class TestPcmToWav:
    def test_produces_a_playable_wav(self):
        pcm = (b"\x00\x01" * 2400)  # 0.1 s at 24 kHz, 16-bit mono
        wav = speech.pcm_to_wav(pcm, 24000)
        with wave.open(io.BytesIO(wav)) as w:
            assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
            assert w.getnframes() == 2400

    def test_sample_rate_is_read_from_the_mime_type(self):
        assert speech._sample_rate("audio/L16;codec=pcm;rate=16000") == 16000
        assert speech._sample_rate(None) == 24000


class TestSttPrompt:
    def test_includes_domain_terms_up_to_twelve(self):
        prompt = speech.build_stt_prompt("en", [f"term{i}" for i in range(20)])
        assert "term0" in prompt and "term11" in prompt and "term12" not in prompt

    def test_is_language_specific_and_bounded(self):
        assert "Hindi" in speech.build_stt_prompt("hinglish") or "Roman" in speech.build_stt_prompt("hinglish")
        assert len(speech.build_stt_prompt("en", ["x" * 100] * 12)) <= 400


class TestTranscribeFallback:
    def _run(self, groq=None, gemini=None, **settings):
        with patch.object(speech, "get_settings", return_value=_settings(**settings)), \
             patch.object(speech, "_transcribe_groq", groq or AsyncMock()), \
             patch.object(speech, "_transcribe_gemini", gemini or AsyncMock()):
            return run(speech.transcribe(b"audio", "audio/webm", "en"))

    def test_groq_is_tried_first(self):
        groq = AsyncMock(return_value=speech.Transcript("hello", "groq", "w"))
        gemini = AsyncMock()
        assert self._run(groq, gemini, groq_api_key="g", gemini_api_key="k").text == "hello"
        gemini.assert_not_called()

    def test_falls_back_to_gemini_when_groq_fails(self):
        groq = AsyncMock(side_effect=RateLimitedError("slow down"))
        gemini = AsyncMock(return_value=speech.Transcript("from gemini", "gemini", "m"))
        out = self._run(groq, gemini, groq_api_key="g", gemini_api_key="k")
        assert out.provider == "gemini" and out.text == "from gemini"

    def test_no_provider_configured(self):
        with pytest.raises(speech.SpeechUnavailable, match="No speech-to-text"):
            self._run()

    def test_all_providers_failing_reports_both_errors(self):
        groq = AsyncMock(side_effect=RuntimeError("groq down"))
        gemini = AsyncMock(side_effect=RuntimeError("gemini down"))
        with pytest.raises(speech.SpeechUnavailable) as err:
            self._run(groq, gemini, groq_api_key="g", gemini_api_key="k")
        assert "groq down" in str(err.value) and "gemini down" in str(err.value)

    def test_only_gemini_configured_skips_groq(self):
        groq = AsyncMock()
        gemini = AsyncMock(return_value=speech.Transcript("ok", "gemini", "m"))
        self._run(groq, gemini, gemini_api_key="k")
        groq.assert_not_called()


class _FakeResponse:
    def __init__(self, status=200, payload=None):
        self.status_code = status
        self._payload = payload or {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def _fake_client(response):
    class _Client:
        def __init__(self, *a, **k): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **k): return response
    return _Client


class TestSynthesize:
    def _speak(self, response, **settings):
        with patch.object(speech, "get_settings", return_value=_settings(gemini_api_key="k", **settings)), \
             patch.object(speech.httpx, "AsyncClient", _fake_client(response)):
            return run(speech.synthesize("Hello there", "en"))

    def test_wraps_returned_pcm_in_wav(self):
        pcm = b"\x00\x02" * 1200
        payload = {"candidates": [{"content": {"parts": [{"inlineData": {
            "data": base64.b64encode(pcm).decode(), "mimeType": "audio/L16;codec=pcm;rate=24000"}}]}}]}
        out = self._speak(_FakeResponse(200, payload))
        assert out.content_type == "audio/wav" and out.provider == "gemini"
        with wave.open(io.BytesIO(out.audio)) as w:
            assert w.getnframes() == 1200

    def test_rate_limit_becomes_speech_unavailable(self):
        with pytest.raises(speech.SpeechUnavailable):
            self._speak(_FakeResponse(429))

    def test_rate_limited_model_fails_over_to_the_next_one(self):
        wav_pcm = {"candidates": [{"content": {"parts": [{"inlineData": {
            "data": base64.b64encode(b"\x00\x02" * 10).decode(), "mimeType": "audio/L16;codec=pcm;rate=24000"}}]}}]}
        calls: list[str] = []

        class _Client:
            def __init__(self, *a, **k): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False
            async def post(self, url, **k):
                calls.append(url.split("/models/")[1].split(":")[0])
                return _FakeResponse(429) if len(calls) == 1 else _FakeResponse(200, wav_pcm)

        with patch.object(speech, "get_settings", return_value=_settings(gemini_api_key="k")),              patch.object(speech.httpx, "AsyncClient", _Client):
            out = run(speech.synthesize("Hello there", "en"))
        assert calls == ["tts-x", "tts-y"] and out.model == "tts-y"

    def test_empty_audio_becomes_speech_unavailable(self):
        with pytest.raises(speech.SpeechUnavailable, match="no audio"):
            self._speak(_FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": "hi"}]}}]}))

    def test_no_key(self):
        with patch.object(speech, "get_settings", return_value=_settings()), pytest.raises(speech.SpeechUnavailable):
            run(speech.synthesize("x", "en"))


# ── opt-in answer audio ───────────────────────────────────────────────────────

@pytest.fixture
def store(tmp_path):
    with patch.object(audio_store, "get_settings", return_value=_settings(upload_dir=str(tmp_path))):
        yield tmp_path


class TestAudioStore:
    def test_save_list_and_resolve(self, store):
        name = audio_store.save_answer_audio(SESSION_ID, b"abc" * 100, "audio/webm;codecs=opus")
        assert name.endswith(".webm") and audio_store.list_answer_audio(SESSION_ID) == [name]
        path, media = audio_store.resolve_answer_audio(SESSION_ID, name)
        assert path.read_bytes() == b"abc" * 100 and media == "audio/webm"

    @pytest.mark.parametrize("evil", ["../secret.txt", "..\\secret.txt", "/etc/passwd", "a/../../b", ""])
    def test_names_cannot_escape_the_session_folder(self, store, evil):
        audio_store.save_answer_audio(SESSION_ID, b"x" * 10, "audio/webm")
        (store / "interview_audio" / "secret.txt").write_text("nope")
        assert audio_store.resolve_answer_audio(SESSION_ID, evil) is None

    def test_session_id_must_be_a_plain_uuid(self, store):
        with pytest.raises(ValueError):
            audio_store.session_dir("../../etc")

    def test_delete_removes_the_session_folder(self, store):
        audio_store.save_answer_audio(SESSION_ID, b"x" * 10, "audio/webm")
        audio_store.delete_session_audio(SESSION_ID)
        assert audio_store.list_answer_audio(SESSION_ID) == []
        audio_store.delete_session_audio("not-a-uuid")  # never raises

    def test_purge_only_removes_old_sessions(self, store):
        old_id, new_id = SESSION_ID, "11111111-2222-3333-4444-555555555555"
        old_name = audio_store.save_answer_audio(old_id, b"x" * 10, "audio/webm")
        audio_store.save_answer_audio(new_id, b"x" * 10, "audio/webm")
        old_file = audio_store.session_dir(old_id) / old_name
        long_ago = time.time() - 40 * 86400
        os.utime(old_file, (long_ago, long_ago))
        assert audio_store.purge_older_than(30) == 1
        assert audio_store.list_answer_audio(old_id) == []
        assert len(audio_store.list_answer_audio(new_id)) == 1

    def test_purge_with_no_storage_is_a_noop(self, store):
        assert audio_store.purge_older_than(30) == 0


# ── voice service ─────────────────────────────────────────────────────────────

USER = SimpleNamespace(id="u1")


def _session(status="in_progress", language="en"):
    return SimpleNamespace(id=SESSION_ID, status=status, language=language, blueprint={"skills_to_assess": ["Policy", "Costing"]})


def _db_for(session, consent=False, tts_used=0):
    from app.models.interview import InterviewConsent, InterviewSession, ModelRun

    db = MagicMock()

    def chain(first=None, scalar=None):
        q = MagicMock()
        q.filter.return_value = q
        q.first.return_value = first
        q.scalar.return_value = scalar
        return q

    queries = {
        InterviewSession: chain(first=session),
        InterviewConsent.id: chain(first=("c",) if consent else None),
    }
    db.query.side_effect = lambda arg: queries.get(arg, chain(scalar=tts_used))
    return db


@pytest.fixture
def voice_env(tmp_path):
    settings = _settings(groq_api_key="g", gemini_api_key="k", upload_dir=str(tmp_path))
    with patch.object(voice, "get_settings", return_value=settings), \
         patch.object(audio_store, "get_settings", return_value=settings), \
         patch.object(speech, "get_settings", return_value=settings), \
         patch.object(voice, "record_speech_run", new=AsyncMock()) as record:
        yield SimpleNamespace(record=record, path=tmp_path)


class TestTranscribeAnswer:
    AUDIO = b"a" * 5000

    def _transcribe(self, voice_env, db, audio=None, **kw):
        stub = AsyncMock(return_value=speech.Transcript("my spoken answer", "groq", "whisper-x"))
        with patch.object(speech, "transcribe", stub):
            out = run(voice.transcribe_answer(SESSION_ID, USER, audio if audio is not None else self.AUDIO, "audio/webm", db))
        return out, stub

    def test_returns_text_and_logs_the_call(self, voice_env):
        out, stub = self._transcribe(voice_env, _db_for(_session()))
        assert out == {"text": "my spoken answer", "saved": False}
        voice_env.record.assert_awaited()
        assert voice_env.record.await_args.args[0] == "stt"
        # domain terms from the blueprint reach the recogniser
        assert stub.await_args.args[3] == ["Policy", "Costing"]

    def test_audio_is_only_saved_with_media_consent(self, voice_env):
        out, _ = self._transcribe(voice_env, _db_for(_session(), consent=False))
        assert out["saved"] is False and audio_store.list_answer_audio(SESSION_ID) == []
        out, _ = self._transcribe(voice_env, _db_for(_session(), consent=True))
        assert out["saved"] is True and len(audio_store.list_answer_audio(SESSION_ID)) == 1

    def test_language_of_the_session_is_used(self, voice_env):
        _, stub = self._transcribe(voice_env, _db_for(_session(language="hinglish")))
        assert stub.await_args.args[2] == "hinglish"

    def test_tiny_recordings_are_ignored_without_calling_the_provider(self, voice_env):
        out, stub = self._transcribe(voice_env, _db_for(_session()), audio=b"x" * 100)
        assert out == {"text": "", "saved": False}
        stub.assert_not_called()

    def test_oversized_recordings_are_rejected(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            self._transcribe(voice_env, _db_for(_session()), audio=b"x" * (1024 * 1024 + 1))
        assert err.value.status == 413

    def test_cannot_transcribe_for_someone_elses_or_a_finished_interview(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            self._transcribe(voice_env, _db_for(None))
        assert err.value.status == 404
        with pytest.raises(voice.VoiceError) as err:
            self._transcribe(voice_env, _db_for(_session(status="completed")))
        assert err.value.status == 400

    def test_provider_outage_is_a_clear_503(self, voice_env):
        with patch.object(speech, "transcribe", AsyncMock(side_effect=speech.SpeechUnavailable("down"))), \
             pytest.raises(voice.VoiceError) as err:
            run(voice.transcribe_answer(SESSION_ID, USER, self.AUDIO, "audio/webm", _db_for(_session())))
        assert err.value.status == 503 and "type your answer" in str(err.value)
        assert voice_env.record.await_args.kwargs["ok"] is False

    def test_not_configured_is_503(self, voice_env):
        with patch.object(speech, "stt_provider", return_value=None), pytest.raises(voice.VoiceError) as err:
            run(voice.transcribe_answer(SESSION_ID, USER, self.AUDIO, "audio/webm", _db_for(_session())))
        assert err.value.status == 503


class TestSpeak:
    def _speak(self, db, text="Welcome to your interview"):
        synth = AsyncMock(return_value=speech.Speech(b"RIFFwav", "audio/wav", "gemini", "tts-x"))
        with patch.object(speech, "synthesize", synth):
            out = run(voice.speak(SESSION_ID, USER, text, db))
        return out, synth

    def test_first_call_generates_and_caches_repeat_calls_are_free(self, voice_env):
        out, synth = self._speak(_db_for(_session()))
        assert out == b"RIFFwav" and synth.await_count == 1
        out2, synth2 = self._speak(_db_for(_session()))
        assert out2 == b"RIFFwav"
        synth2.assert_not_called()
        assert voice_env.record.await_count == 1  # the cache hit is not billed or logged

    def test_cache_is_per_language(self, voice_env):
        self._speak(_db_for(_session(language="en")))
        _, synth = self._speak(_db_for(_session(language="hi")))
        assert synth.await_count == 1

    def test_per_interview_limit(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            self._speak(_db_for(_session(), tts_used=2), text="a brand new sentence")
        assert err.value.status == 429

    def test_text_length_limit(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            self._speak(_db_for(_session()), text="x" * 51)
        assert err.value.status == 413

    def test_blank_text_is_rejected(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            self._speak(_db_for(_session()), text="   ")
        assert err.value.status == 400

    def test_provider_failure_is_a_clear_503(self, voice_env):
        with patch.object(speech, "synthesize", AsyncMock(side_effect=speech.SpeechUnavailable("down"))), \
             pytest.raises(voice.VoiceError) as err:
            run(voice.speak(SESSION_ID, USER, "something new to say", _db_for(_session())))
        assert err.value.status == 503

    def test_not_configured_is_503(self, voice_env):
        with patch.object(speech, "tts_available", return_value=False), pytest.raises(voice.VoiceError) as err:
            run(voice.speak(SESSION_ID, USER, "hello", _db_for(_session())))
        assert err.value.status == 503


class TestStoredAudioAccess:
    def test_only_the_owner_can_list_or_fetch(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            voice.list_audio(SESSION_ID, USER, _db_for(None))
        assert err.value.status == 404
        with pytest.raises(voice.VoiceError) as err:
            voice.get_audio(SESSION_ID, "x.webm", USER, _db_for(None))
        assert err.value.status == 404

    def test_missing_file_is_404(self, voice_env):
        with pytest.raises(voice.VoiceError) as err:
            voice.get_audio(SESSION_ID, "nope.webm", USER, _db_for(_session()))
        assert err.value.status == 404

    def test_owner_gets_their_recording(self, voice_env):
        name = audio_store.save_answer_audio(SESSION_ID, b"z" * 10, "audio/webm")
        assert voice.list_audio(SESSION_ID, USER, _db_for(_session())) == [name]
        path, media = voice.get_audio(SESSION_ID, name, USER, _db_for(_session()))
        assert path.name == name and media == "audio/webm"


class TestSchemaAcceptsVoiceFields:
    def test_language_and_media_consent(self):
        from pydantic import ValidationError

        from app.modules.interview.schemas import CreateSessionRequest

        req = CreateSessionRequest(language="hinglish", consents=["ai_processing", "media"])
        assert req.language == "hinglish" and "media" in req.consents
        with pytest.raises(ValidationError):
            CreateSessionRequest(language="klingon")
        with pytest.raises(ValidationError):
            CreateSessionRequest(consents=["ai_processing", "everything"])
