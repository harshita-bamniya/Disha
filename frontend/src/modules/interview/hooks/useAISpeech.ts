import { useCallback, useEffect, useRef, useState } from 'react'
import { interviewApi } from '@/api/interview'

export interface VoiceOpts { pitch?: number; rate?: number }

interface Options {
  sessionId?: string
  /** Use the server's text-to-speech (Hindi/Hinglish capable) when available. */
  serverTts?: boolean
  /** BCP-47 tag for the browser voice fallback, e.g. "hi-IN". */
  lang?: string
}

const MAX_SERVER_FAILURES = 2
const FIRST_CHUNK_CHARS = 70      // the first sound waits on one synthesis, so keep that one short
const CHUNK_TARGET_CHARS = 240    // later pieces are fetched while earlier ones play; fewer requests = fewer rate limits
const RETRY_DELAY_MS = 1200

/** Split text at sentence ends: a short first piece (fast first sound), then larger ones. */
export function splitForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text]
  const parts: string[] = []
  let current = ''
  for (const s of sentences) {
    const limit = parts.length === 0 ? FIRST_CHUNK_CHARS : CHUNK_TARGET_CHARS
    if (current && (current + s).length > limit) { parts.push(current.trim()); current = '' }
    current += s
  }
  if (current.trim()) parts.push(current.trim())
  return parts.length ? parts : [text]
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * The interviewer's voice. Uses server TTS when it is configured; any failure
 * falls back to the browser's speech synthesis for that sentence, and after
 * repeated failures the server voice is skipped for the rest of the interview.
 */
export function useAISpeech({ sessionId, serverTts = false, lang = 'en-IN' }: Options = {}) {
  const [speaking, setSpeaking] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const optsRef = useRef({ sessionId, serverTts, lang })
  optsRef.current = { sessionId, serverTts, lang }

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)               // bumps on every speak/cancel so stale callbacks do nothing
  const failuresRef = useRef(0)
  const cacheRef = useRef(new Map<string, string>())  // text -> object URL

  const speakBrowser = useCallback((text: string, onEnd?: () => void, voiceOpts?: VoiceOpts) => {
    if (!window.speechSynthesis) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = optsRef.current.lang
    utt.rate = voiceOpts?.rate ?? 0.95
    utt.pitch = voiceOpts?.pitch ?? 1
    utt.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const wanted = optsRef.current.lang.toLowerCase()
    const preferred =
      voices.find(v => v.lang.toLowerCase() === wanted) ||
      voices.find(v => v.lang.toLowerCase().startsWith(wanted.slice(0, 2))) ||
      voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft') || v.lang === 'en-US')
    if (preferred) utt.voice = preferred
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => { setSpeaking(false); onEnd?.() }
    utt.onerror = () => { setSpeaking(false); onEnd?.() }
    window.speechSynthesis.speak(utt)
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void, voiceOpts?: VoiceOpts) => {
    if (!enabledRef.current) { onEnd?.(); return }
    const { sessionId: sid, serverTts: useServer } = optsRef.current
    if (!useServer || !sid || failuresRef.current >= MAX_SERVER_FAILURES) {
      speakBrowser(text, onEnd, voiceOpts)
      return
    }

    const token = ++tokenRef.current
    let finished = false
    const finish = () => { if (!finished) { finished = true; setSpeaking(false); onEnd?.() } }
    // Long text is spoken in sentence-sized pieces so the first sound starts after
    // one short synthesis (a long greeting takes ~20 s to synthesize in one go).
    const parts = splitForSpeech(text)
    let spokenParts = 0
    const fallBack = () => {
      if (finished || token !== tokenRef.current) return
      failuresRef.current += 1
      finished = true
      speakBrowser(parts.slice(spokenParts).join(' '), onEnd, voiceOpts)
    }
    const urlFor = async (part: string): Promise<string> => {
      const cached = cacheRef.current.get(part)
      if (cached) return cached
      let blob: Blob
      try {
        blob = await interviewApi.speak(sid, part)
      } catch {
        // One retry before giving up: switching to the browser voice mid-sentence is jarring.
        await sleep(RETRY_DELAY_MS)
        if (token !== tokenRef.current) throw new Error('cancelled')
        blob = await interviewApi.speak(sid, part)
      }
      const url = URL.createObjectURL(blob)
      cacheRef.current.set(part, url)
      return url
    }
    const playUrl = (url: string) => new Promise<void>((resolve, reject) => {
      window.speechSynthesis?.cancel()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay = () => setSpeaking(true)
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('audio playback failed'))
      audio.play().catch(reject)
    })

    ;(async () => {
      try {
        // Start the first two pieces together so the second is ready by the time the first ends.
        const pending: Promise<string>[] = []
        const fetchPart = (i: number) => {
          if (i < parts.length && !pending[i]) { pending[i] = urlFor(parts[i]); pending[i].catch(() => {}) }
        }
        fetchPart(0); fetchPart(1)
        for (let i = 0; i < parts.length; i++) {
          const url = await pending[i]
          if (token !== tokenRef.current) return        // cancelled while fetching
          fetchPart(i + 1); fetchPart(i + 2)            // keep two pieces in flight while this plays
          await playUrl(url)
          if (token !== tokenRef.current) return
          failuresRef.current = 0
          spokenParts = i + 1
        }
        finish()
      } catch {
        fallBack()
      }
    })()
  }, [speakBrowser])

  const cancel = useCallback(() => {
    tokenRef.current += 1
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      tokenRef.current += 1
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
      cache.forEach(url => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [])

  return { speaking, enabled, setEnabled, speak, cancel }
}
