import { useQuery } from '@tanstack/react-query'
import { applicationsApi } from '@/api/applications'
import { resumeLibraryApi } from '@/api/resumeLibrary'

export function useJobEligibility(jobId: string | undefined) {
  return useQuery({
    queryKey: ['eligibility', jobId],
    queryFn: () => applicationsApi.checkEligibility(jobId!),
    enabled: !!jobId,
  })
}

export function useApplyFormConfig(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['apply-form', jobId],
    queryFn: () => applicationsApi.getForm(jobId!).catch(() => null),
    enabled: !!jobId && enabled,
  })
}

export function useResumeLibrary(enabled: boolean) {
  return useQuery({
    queryKey: ['resume-library'],
    queryFn: resumeLibraryApi.list,
    enabled,
  })
}
