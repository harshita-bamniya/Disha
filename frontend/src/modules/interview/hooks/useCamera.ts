import { useCallback, useEffect, useRef, useState } from 'react'

/** Camera + mic for the live room. Audio level drives the "speaking" border. */
export function useCamera() {
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animRef = useRef<number>(0)
  const lastLevelUpdateRef = useRef(0)
  const [camOn, setCamOn] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // The room renders its <video> only after the session loads, which is usually
  // later than the camera stream arrives. A callback ref attaches the stream
  // whenever the element mounts, whichever of the two happens first.
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current
      el.play().catch(() => {})
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoElRef.current) {
          videoElRef.current.srcObject = stream
          videoElRef.current.play().catch(() => {})
        }
        setCamOn(true)

        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        ctx.createMediaStreamSource(stream).connect(analyser)
        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length
          // State update is throttled to ~8/sec; the page re-renders on each.
          const now = performance.now()
          if (now - lastLevelUpdateRef.current > 120) {
            lastLevelUpdateRef.current = now
            setAudioLevel(Math.min(100, avg * 2.5))
          }
          animRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch((err: DOMException) => {
        if (err.name === 'NotAllowedError') setError('Camera and microphone access was denied. You can still type your answers.')
        else if (err.name === 'NotFoundError') setError('No camera or microphone found. You can still type your answers.')
        else setError('Could not access camera or microphone. You can still type your answers.')
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(animRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  const toggleCam = () => {
    const next = !camOn
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = next })
    setCamOn(next)
  }

  const toggleMic = (onMicChange?: (on: boolean) => void) => {
    const next = !micOn
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
    onMicChange?.(next)
  }

  const getStream = () => streamRef.current

  return { videoRef, camOn, micOn, audioLevel, error, toggleCam, toggleMic, getStream }
}
