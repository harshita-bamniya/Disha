import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useRecordedVoice } from './useRecordedVoice'
import { useVoiceInput } from './useVoiceInput'

const LANG_BCP47: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', hinglish: 'hi-IN' }

interface Options {
  sessionId: string
  language?: string
  /** The server can transcribe (from /interview/capabilities). */
  serverStt: boolean
  setAnswer: Dispatch<SetStateAction<string>>
  onError: (message: string) => void
}

/**
 * Voice input for a single answer: server transcription when the backend has
 * it (Hindi/Hinglish capable, every browser), otherwise the browser's own
 * recogniser. If the server says transcription is unavailable mid-way, it
 * switches to the browser recogniser for the rest of the page.
 */
export function useAnswerVoice({ sessionId, language = 'en', serverStt, setAnswer, onError }: Options) {
  const [serverFailed, setServerFailed] = useState(false)

  const onBrowserText = useCallback((text: string) => setAnswer(text), [setAnswer])
  const browser = useVoiceInput(onBrowserText, LANG_BCP47[language] ?? 'en-IN')

  const onSegment = useCallback(
    (text: string) => setAnswer(prev => (prev.trim() ? `${prev.trim()} ` : '') + text),
    [setAnswer],
  )
  const recorded = useRecordedVoice({
    sessionId,
    onSegment,
    onError: (message, fatal) => { onError(message); if (fatal) setServerFailed(true) },
    getStream: () => null,
  })

  if (serverStt && recorded.supported && !serverFailed) return recorded
  return { listening: browser.listening, transcribing: false, supported: browser.supported, start: browser.start, stop: browser.stop }
}
