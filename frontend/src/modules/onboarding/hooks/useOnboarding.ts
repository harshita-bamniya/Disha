import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { onboardingApi } from '@/api/onboarding'

export const ONBOARDING_STATUS_KEY = ['onboarding', 'status']

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: onboardingApi.getStatus,
    staleTime: 0,
  })
}

function useStepMutation(
  mutationFn: (data: any) => Promise<any>,
  nextStep: number | 'done',
) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Update cache synchronously so OnboardingGate sees is_completed=true
      // before navigation, preventing the race-condition redirect to step 1.
      queryClient.setQueryData(ONBOARDING_STATUS_KEY, {
        current_step: data.current_step ?? nextStep,
        is_completed: data.is_completed ?? false,
      })
      // For 'done' steps the component handles its own navigation
      // (e.g. Step7 shows the InsightCard first), so we skip here.
      if (nextStep !== 'done') {
        navigate(`/app/onboarding/step/${nextStep}`)
      }
    },
  })
}

export const useOnboardingSteps = () => ({
  personal:       useStepMutation(onboardingApi.savePersonal, 2),
  education:      useStepMutation(onboardingApi.saveEducation, 3),
  upscJourney:    useStepMutation(onboardingApi.saveUpscJourney, 4),
  workExperience: useStepMutation(onboardingApi.saveWorkExperience, 5),
  skills:         useStepMutation(onboardingApi.saveSkills, 6),
  preferences:    useStepMutation(onboardingApi.savePreferences, 7),
  psychology:     useStepMutation(onboardingApi.savePsychology, 'done'),
})
