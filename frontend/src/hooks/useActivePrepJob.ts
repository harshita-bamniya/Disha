import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { krsApi } from '../api/krs'
import { usePrepStore } from '../stores/prepStore'

/** Returns the server-synced active prep job context. Keeps Zustand store in sync. */
export function useActivePrepJob() {
  const queryClient = useQueryClient()
  const { activePrep, setActivePrep } = usePrepStore()

  const query = useQuery({
    queryKey: ['active-prep'],
    queryFn: krsApi.getActivePrep,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  })

  // Keep store in sync whenever server data changes
  useEffect(() => {
    if (query.data !== undefined) {
      setActivePrep(query.data)
    }
  }, [query.data, setActivePrep])

  const startPrepMutation = useMutation({
    mutationFn: krsApi.startPrep,
    onSuccess: (ctx) => {
      setActivePrep(ctx)
      queryClient.setQueryData(['active-prep'], ctx)
      queryClient.invalidateQueries({ queryKey: ['krs-jobs'] })
    },
  })

  const clearPrepMutation = useMutation({
    mutationFn: krsApi.clearPrep,
    onSuccess: () => {
      setActivePrep(null)
      queryClient.setQueryData(['active-prep'], null)
      queryClient.invalidateQueries({ queryKey: ['krs-jobs'] })
    },
  })

  return {
    activePrep: query.data ?? activePrep,
    isLoading: query.isLoading,
    startPrep: startPrepMutation.mutate,
    isStartingPrep: startPrepMutation.isPending,
    clearPrep: clearPrepMutation.mutate,
    isClearingPrep: clearPrepMutation.isPending,
  }
}
