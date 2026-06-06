import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import careersApi from '@/api/careers'

export const TRACKS_KEY = ['careers', 'tracks']
export const MY_SELECTIONS_KEY = ['careers', 'mine']

export function useCareerTracks() {
  return useQuery({
    queryKey: TRACKS_KEY,
    queryFn: careersApi.listTracks,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCareerTrack(slug: string) {
  return useQuery({
    queryKey: ['careers', 'track', slug],
    queryFn: () => careersApi.getTrack(slug),
    staleTime: 5 * 60 * 1000,
    enabled: !!slug,
  })
}

export function useMySelections() {
  return useQuery({
    queryKey: MY_SELECTIONS_KEY,
    queryFn: careersApi.mySelections,
    staleTime: 2 * 60 * 1000,
  })
}

export function useSelectTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trackId: string) => careersApi.selectTrack(trackId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRACKS_KEY })
      qc.invalidateQueries({ queryKey: MY_SELECTIONS_KEY })
      // Invalidate individual track cache entries too
      qc.invalidateQueries({ queryKey: ['careers', 'track'] })
    },
  })
}

export function useDeselectTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trackId: string) => careersApi.deselectTrack(trackId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRACKS_KEY })
      qc.invalidateQueries({ queryKey: MY_SELECTIONS_KEY })
      qc.invalidateQueries({ queryKey: ['careers', 'track'] })
    },
  })
}
