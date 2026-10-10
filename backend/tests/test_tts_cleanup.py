"""Edge-noise cleanup for Gemini TTS audio.

Measured on real cached clips: ~40% ended with ~110 ms of near-full-scale noise right after the speech
faded out (heard as an old-TV "switch-off" burst) and began with a ~10 ms click. The cleanup must remove
those without touching good audio, and must never turn a bad cache file into a server error.
"""
import array
import io
import math
import wave

from app.ai import speech

RATE = 24000


def _tone(ms: int, amp: int = 3000, hz: int = 220) -> list[int]:
    return [int(amp * math.sin(2 * math.pi * hz * i / RATE)) for i in range(RATE * ms // 1000)]


def _silence(ms: int) -> list[int]:
    return [0] * (RATE * ms // 1000)


def _burst(ms: int) -> list[int]:
    return [20000 if i % 2 == 0 else -20000 for i in range(RATE * ms // 1000)]   # loud, harsh


def _pcm(samples: list[int]) -> bytes:
    return array.array("h", samples).tobytes()


def _samples(pcm: bytes) -> list[int]:
    a = array.array("h")
    a.frombytes(pcm)
    return list(a)


def _rms(xs: list[int]) -> float:
    return math.sqrt(sum(x * x for x in xs) / len(xs)) if xs else 0.0


def test_trailing_noise_burst_after_the_speech_is_removed():
    speech_part = _tone(800) + _silence(60)
    out = _samples(speech.clean_pcm(_pcm(speech_part + _burst(110)), RATE))
    assert len(out) < len(speech_part) + len(_burst(110))             # burst gone
    assert _rms(out[-RATE // 33:]) < 200                                # the last 30 ms are quiet
    assert _rms(out[RATE // 10: RATE // 2]) > 1500                      # the speech itself is intact


def test_leading_click_is_removed():
    out = _samples(speech.clean_pcm(_pcm(_burst(10) + _silence(30) + _tone(600)), RATE))
    assert _rms(out[: RATE // 100]) < 200


def test_clean_audio_is_kept_apart_from_a_short_fade():
    clean = _tone(1000)
    out = _samples(speech.clean_pcm(_pcm(clean), RATE))
    assert len(out) == len(clean)                                       # nothing trimmed
    assert out[len(out) // 2] == clean[len(clean) // 2]                 # the middle is untouched
    assert abs(out[-1]) <= 5 and abs(out[0]) <= 5                       # faded at both ends


def test_loud_speech_that_runs_to_the_end_is_not_mistaken_for_a_burst():
    # a burst only counts after a quiet gap; continuous loud speech must survive
    loud_speech = _tone(1000, amp=12000)
    out = _samples(speech.clean_pcm(_pcm(loud_speech), RATE))
    assert len(out) == len(loud_speech)


def test_very_short_and_odd_inputs_do_not_crash():
    assert speech.clean_pcm(b"", RATE) == b""
    assert len(speech.clean_pcm(_pcm(_tone(5)), RATE)) > 0
    assert speech.clean_pcm(b"\x01", RATE) == b""                       # a stray odd byte is dropped


def test_new_speech_is_cleaned_when_wrapped_as_wav():
    wav = speech.pcm_to_wav(_pcm(_tone(800) + _silence(60) + _burst(110)), RATE)
    with wave.open(io.BytesIO(wav)) as w:
        out = _samples(w.readframes(w.getnframes()))
    assert _rms(out[-RATE // 33:]) < 200


def test_cached_wavs_are_cleaned_and_corrupt_ones_pass_through_unharmed():
    raw = io.BytesIO()
    with wave.open(raw, "wb") as w:                                     # a legacy, never-cleaned cache file
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(_pcm(_tone(500) + _silence(60) + _burst(110)))
    cleaned = speech.clean_wav(raw.getvalue())
    with wave.open(io.BytesIO(cleaned)) as w:
        assert _rms(_samples(w.readframes(w.getnframes()))[-RATE // 33:]) < 200

    # not WAV at all, or a truncated header: served unchanged, never an exception (this used to be a 500)
    for junk in (b"RIFFwav", b"", b"not audio"):
        assert speech.clean_wav(junk) == junk
