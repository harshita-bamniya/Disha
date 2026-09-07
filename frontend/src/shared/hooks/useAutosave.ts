import { useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Debounced autosave — skips the initial mount, saves `delay`ms after the last change. */
export function useAutosave<T>(value: T, save: (value: T) => Promise<unknown>, delay = 600): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const isFirst = useRef(true)
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setStatus('saving')
    const t = setTimeout(() => {
      saveRef.current(value)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay])

  return status
}
