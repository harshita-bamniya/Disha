import { useCallback, useRef, useState } from 'react'

// The DOM typings don't ship the Web Speech recognition interfaces, so declare
// the small slice we use.
interface RecognitionResult { 0: { transcript: string } }
interface RecognitionEvent { results: ArrayLike<RecognitionResult> }
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

/** Browser speech-to-text (Chrome/Edge). Phase 4 replaces this with server STT. */
export function useVoiceInput(onResult: (text: string) => void, lang: string = 'en-US') {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const shouldListenRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const supported = !!getRecognitionCtor()

  const start = useCallback(() => {
    const SR = getRecognitionCtor()
    if (!SR) return
    shouldListenRef.current = true

    const launch = () => {
      if (!shouldListenRef.current) return
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = lang
      rec.onresult = e => {
        onResultRef.current(Array.from(e.results).map(r => r[0].transcript).join(''))
      }
      rec.onend = () => {
        if (shouldListenRef.current) setTimeout(launch, 200)
        else setListening(false)
      }
      rec.onerror = () => {
        if (shouldListenRef.current) setTimeout(launch, 500)
      }
      rec.start()
      recognitionRef.current = rec
      setListening(true)
    }
    launch()
  }, [lang])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}
