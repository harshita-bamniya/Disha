import { useCallback, useRef } from 'react'

export interface DragReorderHandlers {
  onDragStart: (i: number) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (i: number) => void
}

/** Generic HTML5 drag-and-drop list reorder — works for sections, entries, or bullets alike. */
export function useDragReorder<T>(items: T[], onReorder: (newItems: T[]) => void): DragReorderHandlers {
  const dragIdx = useRef<number | null>(null)

  const onDragStart = useCallback((i: number) => { dragIdx.current = i }, [])
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  const onDrop = useCallback((toIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return
    const updated = [...items]
    const [moved] = updated.splice(dragIdx.current, 1)
    updated.splice(toIdx, 0, moved)
    dragIdx.current = null
    onReorder(updated)
  }, [items, onReorder])

  return { onDragStart, onDragOver, onDrop }
}
