import { useCallback, useEffect, useRef, useState } from 'react'
import { interviewApi } from '@/api/interview'

// Server-side speech-to-text: record the answer, send it to the backend for
// transcription (Groq Whisper / Gemini), hand the text back. Works for Hindi
// and Hinglish and in every browser that has MediaRecorder, unlike the
// browser's own recogniser. The recording stops by itself after a short
// silence, so a candidate doesn't have to tap "stop".

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
const SPEECH_RMS = 6            // loudness (0-128 scale) that counts as speech
const SILENCE_STOP_MS = 2500    // stop this long after the candidate last spoke
const MAX_RECORDING_MS = 150_000
const MIN_BLOB_BYTES = 800

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m))
}

interface Options {
  sessionId: string
  onSegment: (text: string) => void
  /** `fatal` means server transcription itself is unavailable: switch to the browser recogniser. */
  onError: (message: string, fatal: boolean) => void
  /** The room's existing camera/mic stream, so a second permission prompt isn't needed. */
  getStream: () => MediaStream | null
}

export function useRecordedVoice({ sessionId, onSegment, onError, getStream }: Options) {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const callbacks = useRef({ onSegment, onError, getStream })
  callbacks.current = { onSegment, onError, getStream }

  const supported =
    typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const stopVad = () => {
    if (vadTimerRef.current) clearInterval(vadTimerRef.current)
    vadTimerRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const start = useCallback(async () => {
    if (!supported || recorderRef.current) return

    let source = callbacks.current.getStream()
    let ownStream: MediaStream | null = null
    if (!source || source.getAudioTracks().length === 0) {
      try {
        ownStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        source = ownStream
      } catch {
        callbacks.current.onError('Microphone unavailable. You can type your answer instead.', false)
        return
      }
    }

    const audioStream = new MediaStream(source.getAudioTracks())
    const mime = pickMime()
    const recorder = new MediaRecorder(audioStream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = async () => {
      stopVad()
      recorderRef.current = null
      setListening(false)
      ownStream?.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' })
      if (blob.size < MIN_BLOB_BYTES) return
      setTranscribing(true)
      try {
        const { text } = await interviewApi.transcribeAnswer(sessionId, blob)
        if (text.trim()) callbacks.current.onSegment(text.trim())
        else callbacks.current.onError("We couldn't hear that. Try again, or type your answer.", false)
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        const unavailable = status === 503
        callbacks.current.onError(
          unavailable
            ? 'Voice recognition is unavailable right now. Switching to your browser\'s speech recognition.'
            : 'Could not transcribe that. Try again, or type your answer.',
          unavailable,
        )
      } finally {
        setTranscribing(false)
      }
    }

    recorder.start()
    recorderRef.current = recorder
    setListening(true)

    // Stop automatically after the candidate has spoken and then gone quiet.
    try {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      void ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(audioStream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const startedAt = Date.now()
      let heardSpeech = false
      let lastVoiceAt = startedAt
      vadTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += (v - 128) * (v - 128)
        const rms = Math.sqrt(sum / buf.length)
        const now = Date.now()
        if (rms > SPEECH_RMS) { heardSpeech = true; lastVoiceAt = now }
        if ((heardSpeech && now - lastVoiceAt > SILENCE_STOP_MS) || now - startedAt > MAX_RECORDING_MS) {
          if (recorder.state !== 'inactive') recorder.stop()
        }
      }, 150)
    } catch {
      // No silence detection available: the candidate stops it manually.
    }
  }, [sessionId, supported])

  useEffect(() => () => {
    stopVad()
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  return { listening, transcribing, supported, start, stop }
}
