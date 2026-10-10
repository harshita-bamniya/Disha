import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Camera, CameraOff, Loader2, LogOut, Mic, Square } from 'lucide-react'
import { interviewApi, type InterviewQuestion, type Helpline } from '@/api/interview'
import { toast } from '@/shared/components/feedback/Toast'
import InterviewShell from '../components/InterviewShell'
import SafetyHold from '../components/SafetyHold'
import { useCamera } from '../hooks/useCamera'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useAISpeech } from '../hooks/useAISpeech'
import { useRecordedVoice } from '../hooks/useRecordedVoice'
import { useIntegrityEvents } from '../hooks/useIntegrityEvents'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

interface Panelist {
  name: string
  role: string
}

type AiState = 'idle' | 'thinking' | 'speaking'

// Panel simulation: each persona gets a distinct pitch/rate via the Web Speech
// API so they read as different people, not just a name label on one voice.
const PANELIST_VOICE: Record<string, { pitch: number; rate: number }> = {
  'Hiring Manager':  { pitch: 1.08, rate: 0.95 },
  'Technical Lead':  { pitch: 0.88, rate: 0.98 },
  // Same voice as Technical Lead; a role-appropriate title for non-technical roles.
  'Domain Lead':     { pitch: 0.88, rate: 0.98 },
  'Future Teammate': { pitch: 1.15, rate: 1.05 },
}

const MIN_ANSWER_CHARS = 30
// Browser speech recognition/synthesis language tags (the server voice picks its own).
const LANG_BCP47: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', hinglish: 'hi-IN' }
const DEFAULT_INTERVIEWER = 'Alex'

function InterviewerTile({ state, panelist }: { state: AiState; panelist: Panelist | null }) {
  const name = panelist?.name ?? DEFAULT_INTERVIEWER
  return (
    <div className="iv-tile" data-active={state === 'speaking'}>
      <div className="iv-avatar-wrap">
        <div className="iv-avatar-ring">
          {/* Placeholder avatar. Pass a photo URL via <img> here when one is chosen. */}
          <div className="iv-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</div>
        </div>
      </div>
      {state !== 'idle' && (
        <div className="iv-tile-badge" role="status">
          {state === 'speaking' ? 'Speaking' : 'Thinking…'}
        </div>
      )}
      <div className="iv-name-tag">
        Interviewer ({name}){panelist ? ` · ${panelist.role}` : ''}
      </div>
    </div>
  )
}

export default function InterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [answer, setAnswer] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [aiState, setAiState] = useState<AiState>('idle')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [responseStartTime, setResponseStartTime] = useState(Date.now())
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [pendingRetry, setPendingRetry] = useState<{ respId: string; questionText: string } | null>(null)
  const [currentPanelist, setCurrentPanelist] = useState<Panelist | null>(null)
  // Both persist across a follow-up (which has no question_id/question_type of
  // its own and inherits the topic of the question it probes) so the submit
  // payload still reports them accurately.
  const [currentQuestionType, setCurrentQuestionType] = useState<string | null>(null)
  const [currentIsFollowUp, setCurrentIsFollowUp] = useState(false)
  // Verified interviews: the server issues each follow-up an id and answers must cite it.
  const [currentFollowupId, setCurrentFollowupId] = useState<string | null>(null)
  // A crisis signal in an answer halts the interview; a distress signal only
  // offers a break. Neither answer is ever scored.
  const [safetyHold, setSafetyHold] = useState<{ message: string; helplines: Helpline[] } | null>(null)
  const [distressMessage, setDistressMessage] = useState<string | null>(null)

  const initDoneRef = useRef(false)
  const networkOk = useNetworkStatus()

  const { data: session, isLoading } = useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: () => interviewApi.getSession(sessionId!),
    enabled: !!sessionId,
  })
  // What the server can do for voice. Without server STT/TTS the room uses the
  // browser's own speech recognition and synthesis, exactly as before.
  const { data: caps, isLoading: capsLoading } = useQuery({
    queryKey: ['interview-capabilities'],
    queryFn: interviewApi.getCapabilities,
    staleTime: Infinity,
    retry: false,
  })
  const bcp47 = LANG_BCP47[session?.language ?? 'en'] ?? 'en-IN'
  const verifiedMode = session?.mode === 'verified'
  const integrity = useIntegrityEvents(sessionId, verifiedMode && session?.status !== 'completed')
  const [serverSttFailed, setServerSttFailed] = useState(false)

  const camera = useCamera()
  const aiSpeech = useAISpeech({ sessionId, serverTts: !!caps?.server_tts, lang: bcp47 })

  const setAnswerRef = useRef(setAnswer)
  setAnswerRef.current = setAnswer
  const onBrowserResult = useCallback((text: string) => setAnswerRef.current(text), [])
  const browserVoice = useVoiceInput(onBrowserResult, bcp47)

  // Server transcription returns one piece of text per recording; append it to
  // whatever the candidate already has (typed or from an earlier recording).
  const onRecordedSegment = useCallback(
    (text: string) => setAnswerRef.current(prev => (prev.trim() ? `${prev.trim()} ` : '') + text),
    [],
  )
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const recordedVoice = useRecordedVoice({
    sessionId: sessionId ?? '',
    onSegment: onRecordedSegment,
    onError: (message, fatal) => {
      toast.danger(message)
      if (fatal) setServerSttFailed(true)   // fall back to the browser recogniser
    },
    getStream: () => cameraRef.current.getStream(),
  })
  const serverStt = !!caps?.server_stt && recordedVoice.supported && !serverSttFailed
  const voice = serverStt
    ? recordedVoice
    : { listening: browserVoice.listening, transcribing: false, supported: browserVoice.supported, start: browserVoice.start, stop: browserVoice.stop }

  // Refs so deferred callbacks (speech onEnd, the resume fetch) never act on a
  // stale render's values.
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  const aiSpeechRef = useRef(aiSpeech)
  aiSpeechRef.current = aiSpeech
  const currentQuestionTypeRef = useRef(currentQuestionType)
  currentQuestionTypeRef.current = currentQuestionType

  // A completed session has nothing left to do in the room.
  useEffect(() => {
    if (session?.status === 'completed') {
      navigate(`/app/interview/report/${sessionId}`, { replace: true })
    }
  }, [session?.status, sessionId, navigate])

  // Fetches the adaptive next action for a just-submitted response. Shared by
  // the submit flow, resume-on-refresh and the manual retry button.
  const fetchNext = useCallback(async (respId: string, answeredQuestionText: string) => {
    setPendingRetry(null)
    setWaitingForNext(true)
    setAiState('thinking')

    try {
      const next = await interviewApi.getNextQuestion(sessionId!, respId)
      setWaitingForNext(false)

      if (next.session_complete || !next.question) {
        setSessionDone(true)
        const doneText = "That concludes our interview. Thank you for your time and thoughtful answers. I'll now prepare your Job Readiness Report."
        setQuestionText(doneText)
        setAiState('speaking')
        aiSpeechRef.current.speak(doneText, () => setAiState('idle'))
        return
      }

      const nextText = next.question.text
      const nextQData: InterviewQuestion | null = next.question.id
        ? { id: next.question.id, question_text: nextText, question_type: next.question.question_type ?? null, difficulty: next.question.difficulty ?? null, language: 'en', career_track_id: null, is_dynamic: true }
        : null
      const panelist: Panelist | null = next.question.panelist_name && next.question.panelist_role
        ? { name: next.question.panelist_name, role: next.question.panelist_role }
        : null
      const isFollowUp = next.action !== 'next_question'

      setQuestionText(nextText)
      setCurrentQuestion(nextQData)
      setCurrentPanelist(panelist)
      setCurrentIsFollowUp(isFollowUp)
      setCurrentFollowupId(isFollowUp ? (next.question.followup_id ?? null) : null)
      if (!isFollowUp) setCurrentQuestionType(nextQData?.question_type ?? null)
      // Follow-ups probe the current question; only planned questions advance the counter.
      if (!isFollowUp) setQuestionIdx(i => i + 1)
      setResponseStartTime(Date.now())
      setAiState('speaking')

      aiSpeechRef.current.speak(nextText, () => {
        setAiState('idle')
        if (cameraRef.current.micOn && !cameraRef.current.error) voiceRef.current.start()
      }, panelist ? PANELIST_VOICE[panelist.role] : undefined)
    } catch {
      setWaitingForNext(false)
      setAiState('idle')
      setPendingRetry({ respId, questionText: answeredQuestionText })
    }
  }, [sessionId])

  // Runs once when session data first arrives.
  useEffect(() => {
    if (!session || capsLoading || initDoneRef.current || session.status === 'completed') return
    initDoneRef.current = true

    interviewApi.startSession(sessionId!).catch(() => {})

    // Resume after a refresh: continue from what's already been submitted.
    if (session.responses && session.responses.length > 0) {
      const sorted = [...session.responses].sort((a, b) => a.sequence_num - b.sequence_num)
      setAnsweredCount(sorted.length)
      // fetchNext advances the counter if the next question is a planned one.
      setQuestionIdx(Math.max(0, sorted.filter(r => !r.is_followup).length - 1))
      setResponseStartTime(Date.now())
      const last = sorted[sorted.length - 1]
      setCurrentQuestionType(last.question_type ?? null)
      fetchNext(last.id, last.question_text)
      return
    }

    const greeting = session.blueprint?.panel_intro
      ? `${session.blueprint.opening_greeting || `Welcome! I'm ${DEFAULT_INTERVIEWER}, your host for today's ${session.job_role || 'interview'}.`} ${session.blueprint.panel_intro}`
      : session.blueprint?.opening_greeting
      || `Welcome! I'm ${DEFAULT_INTERVIEWER}, your AI interviewer for the ${session.job_role || 'interview'} today. Let's get started.`
    const iceBreaker = session.blueprint?.ice_breaker_question
    const firstQText = iceBreaker || session.questions?.[0]?.question_text || 'Tell me about yourself and your background.'
    const firstQData = !iceBreaker ? (session.questions?.[0] ?? null) : null
    // The ice breaker is the host's own question; only a "real" first question
    // inherits a panelist persona.
    const firstPanelist: Panelist | null = !iceBreaker && firstQData?.panelist_name && firstQData?.panelist_role
      ? { name: firstQData.panelist_name, role: firstQData.panelist_role }
      : null

    setAiState('speaking')
    setQuestionText(greeting)

    // Chain greeting -> first question using speech onEnd events.
    aiSpeechRef.current.speak(greeting, () => {
      setQuestionText(firstQText)
      setCurrentQuestion(firstQData)
      setCurrentPanelist(firstPanelist)
      setCurrentQuestionType(firstQData?.question_type ?? null)
      setCurrentIsFollowUp(false)
      setResponseStartTime(Date.now())

      aiSpeechRef.current.speak(firstQText, () => {
        setAiState('idle')
        voiceRef.current.start()
      }, firstPanelist ? PANELIST_VOICE[firstPanelist.role] : undefined)
    })
  }, [session, sessionId, capsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = useMutation({
    mutationFn: async () => {
      const elapsed = Math.round((Date.now() - responseStartTime) / 1000)
      return interviewApi.submitResponse(sessionId!, {
        question_id: currentQuestion?.id ?? undefined,
        followup_id: currentFollowupId ?? undefined,
        question_text: questionText,
        question_type: currentQuestion?.question_type ?? currentQuestionType ?? undefined,
        response_text: answer.trim(),
        response_time_sec: elapsed,
        is_followup: currentIsFollowUp,
      })
    },
    onSuccess: async (result) => {
      const answeredQuestionText = questionText
      setAnswer('')
      voice.stop()
      if (result.safety_hold) {
        aiSpeech.cancel()
        setSafetyHold({ message: result.message ?? '', helplines: result.helplines ?? [] })
        return
      }
      setDistressMessage(result.distress ? (result.message ?? null) : null)
      setAnsweredCount(c => c + 1)
      await fetchNext(result.response_id!, answeredQuestionText)
    },
    onError: () => toast.danger('Could not submit your answer. Please try again.'),
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      setCompleting(true)
      aiSpeech.cancel()
      voice.stop()
      await integrity.flush()
      return interviewApi.completeSession(sessionId!)
    },
    onSuccess: () => navigate(`/app/interview/report/${sessionId}`),
    onError: () => toast.danger('Could not finish the interview. Please try again.'),
    onSettled: () => setCompleting(false),
  })

  const exitRoom = () => {
    if (!window.confirm('Leave the interview? Your answers so far are saved and you can resume it from your interview history.')) return
    aiSpeech.cancel()
    voice.stop()
    navigate('/app/interview/history')
  }

  if (safetyHold) return <SafetyHold message={safetyHold.message} helplines={safetyHold.helplines} />

  if (isLoading || !session || session.status === 'completed' || completing) {
    return (
      <InterviewShell>
        <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '96px 0' }}>
          <Loader2 size={32} className="iv-spin" color="var(--iv-accent)" aria-hidden />
          <p className="iv-muted" style={{ margin: 0 }}>
            {completing ? 'Finishing your interview…'
              : session?.status === 'completed' ? 'Opening your report…' : 'Joining interview…'}
          </p>
        </div>
      </InterviewShell>
    )
  }

  const totalQ = session.total_questions
  const trimmed = answer.trim()
  const canSubmit = trimmed.length >= MIN_ANSWER_CHARS && !submitMutation.isPending && !waitingForNext && !sessionDone && !voice.transcribing
  const busy = waitingForNext || submitMutation.isPending
  const showingAnswer = trimmed.length > 0 && !busy

  return (
    <InterviewShell
      headerRight={
        <button className="iv-btn iv-btn-quiet" onClick={exitRoom}>
          <LogOut size={16} aria-hidden /> Exit
        </button>
      }
    >
      {!networkOk && (
        <div className="iv-banner" role="alert">You're offline. Your answer won't submit until the connection is restored.</div>
      )}
      {distressMessage && (
        <div className="iv-banner" role="status">
          <span style={{ flex: 1 }}>{distressMessage}</span>
          <button className="iv-link-btn" onClick={() => setDistressMessage(null)}>Dismiss</button>
        </div>
      )}
      {pendingRetry && (
        <div className="iv-banner" role="alert">
          <span style={{ flex: 1 }}>Couldn't get the next question. Your answer was saved.</span>
          <button className="iv-btn iv-btn-sm" onClick={() => fetchNext(pendingRetry.respId, pendingRetry.questionText)}>Retry</button>
          <button className="iv-link-btn" onClick={() => completeMutation.mutate()}>End interview instead</button>
        </div>
      )}

      <div className="iv-room-grid">
        <InterviewerTile state={aiState} panelist={currentPanelist} />

        <div className="iv-tile" data-active={voice.listening && camera.audioLevel > 15}>
          {camera.error ? (
            <div className="iv-preview-empty">{camera.error}</div>
          ) : (
            <video ref={camera.videoRef} muted playsInline autoPlay style={{ filter: camera.camOn ? 'none' : 'brightness(0)' }} aria-label="Your camera" />
          )}
          {voice.listening && (
            <div className="iv-tile-badge" role="status"><span className="iv-dot" aria-hidden /> Listening</div>
          )}
          {/* Shown only when the candidate opted in AND answers are really being saved. */}
          {session.saving_audio && serverStt && (
            <div className="iv-rec" aria-label="Your answers are being recorded"><span className="iv-rec-dot" aria-hidden /> Rec</div>
          )}
          <div className="iv-name-tag">You</div>
        </div>
      </div>

      <section className="iv-transcript" aria-label="Transcription" aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="iv-tag">{showingAnswer ? 'Your answer' : 'Interviewer'}</span>
          <span className="iv-muted" style={{ fontSize: 13 }}>
            Question {Math.min(questionIdx + 1, totalQ)} of {totalQ}
          </span>
        </div>
        <p className="iv-transcript-text">
          {voice.transcribing ? 'Transcribing your answer…' : busy ? 'Thinking about your answer…' : showingAnswer ? trimmed : questionText}
        </p>
      </section>

      {verifiedMode && (
        <p className="iv-fineprint" style={{ marginTop: 16 }}>
          This is an employer interview. Switching tabs or leaving this window is noted for the employer and for you. It
          never lowers your score.
        </p>
      )}

      {!sessionDone ? (
        <>
          <div className="iv-controls">
            {voice.supported && (
              <button
                className="iv-icon-btn"
                aria-pressed={voice.listening}
                aria-label={voice.listening ? 'Stop recording' : 'Start recording your answer'}
                disabled={busy || voice.transcribing}
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
              >
                {voice.listening ? <Square size={16} fill="currentColor" aria-hidden /> : <Mic size={18} aria-hidden />}
              </button>
            )}
            <button
              className="iv-icon-btn"
              aria-label={camera.camOn ? 'Turn off camera' : 'Turn on camera'}
              disabled={!!camera.error}
              onClick={camera.toggleCam}
            >
              {camera.camOn ? <Camera size={18} aria-hidden /> : <CameraOff size={18} aria-hidden />}
            </button>

            <button className="iv-btn iv-btn-sm" disabled={!canSubmit} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? <Loader2 size={16} className="iv-spin" aria-hidden /> : 'Submit answer'}
            </button>

            {trimmed.length > 0 && !busy && !voice.listening && !voice.transcribing && (
              <button className="iv-link-btn" onClick={() => setAnswer('')}>
                Clear and record again
              </button>
            )}

            <span className="iv-spacer" />
            {answeredCount > 0 && (
              <button className="iv-btn iv-btn-quiet" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                End interview
              </button>
            )}
          </div>
          {!voice.supported && (
            <p className="iv-fineprint" role="alert">
              This interview is voice only, and voice input isn't supported in this browser. Please open it in Chrome or Edge.
            </p>
          )}
        </>
      ) : (
        <div className="iv-actions" style={{ marginTop: 24 }}>
          <button className="iv-btn" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
            View my report
          </button>
        </div>
      )}
    </InterviewShell>
  )
}
