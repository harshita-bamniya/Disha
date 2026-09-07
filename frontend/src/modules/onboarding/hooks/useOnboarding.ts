import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { onboardingApi } from '@/api/onboarding'

export const ONBOARDING_STATUS_KEY = ['onboarding', 'status']
export const ONBOARDING_OPTIONS_KEY = ['onboarding', 'options']
export const ONBOARDING_PROFILE_KEY = ['onboarding', 'profile']

export function useOnboardingOptions() {
  return useQuery({
    queryKey: ONBOARDING_OPTIONS_KEY,
    queryFn: onboardingApi.getOptions,
    staleTime: Infinity,   // static data — never needs refetching
    gcTime: Infinity,
  })
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: onboardingApi.getStatus,
    staleTime: 0,
  })
}

export function useOnboardingProfile() {
  return useQuery({
    queryKey: ONBOARDING_PROFILE_KEY,
    queryFn: onboardingApi.getProfile,
  })
}

function useStepMutation(
  mutationFn: (data: any) => Promise<any>,
  nextStep: number | 'done' | 'dashboard',
) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Update cache synchronously so OnboardingGate sees the new current_step
      // before navigation, preventing a race-condition redirect back to step 1.
      queryClient.setQueryData(ONBOARDING_STATUS_KEY, {
        current_step: data.current_step ?? (typeof nextStep === 'number' ? nextStep : 1),
        is_completed: data.is_completed ?? false,
      })
      // Every step writes to the same aspirant profile the dashboard's
      // ProfileCompletionCard reads — without this, completing e.g. Skills
      // still shows "Add skills" unchecked until a hard page reload, because
      // that query was never told the underlying data changed.
      queryClient.invalidateQueries({ queryKey: ONBOARDING_PROFILE_KEY })
      queryClient.invalidateQueries({ queryKey: ['krs', 'dashboard'] })
      // For 'done' steps the component handles its own navigation
      // (e.g. Step7 shows the InsightCard first), so we skip here.
      if (nextStep === 'dashboard') {
        navigate('/app/dashboard')
      } else if (nextStep !== 'done') {
        navigate(`/app/onboarding/step/${nextStep}`)
      }
    },
  })
}

export const useOnboardingSteps = () => ({
  // Step 1 is the only mandatory step — completing it unlocks the dashboard
  // (OnboardingGate only checks current_step >= 2). Steps 2-6 walk through
  // sequentially right after, same as LinkedIn/Indeed-style progressive
  // profile wizards — each one is still skippable (see SkipLink in each page),
  // and a user can also just navigate to the dashboard directly at any point
  // since the gate doesn't force them back. Step 6 (preferences) completes
  // registration — Step6Preferences handles its own navigation afterward
  // (it shows the BeginablAI insight card first), so nextStep is 'done' here.
  personal:       useStepMutation(onboardingApi.savePersonal, 2),
  education:      useStepMutation(onboardingApi.saveEducation, 3),
  upscJourney:    useStepMutation(onboardingApi.saveUpscJourney, 4),
  workExperience: useStepMutation(onboardingApi.saveWorkExperience, 5),
  skills:         useStepMutation(onboardingApi.saveSkills, 6),
  preferences:    useStepMutation(onboardingApi.savePreferences, 'done'),
})

/** One-time learning setup — asked before a user's first roadmap/job-plan
 * generation, not during registration. Lives outside useOnboardingSteps
 * since it isn't part of the numbered onboarding stepper. */
export function useSaveLearningSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: onboardingApi.saveLearningSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_PROFILE_KEY })
      queryClient.invalidateQueries({ queryKey: ['krs', 'dashboard'] })
    },
  })
}
