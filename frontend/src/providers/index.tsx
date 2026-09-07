import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ToastContainer } from '@/shared/components/feedback/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})

interface AppProvidersProps {
  children: ReactNode
}

/**
 * Composes all top-level React providers in one place.
 * Order: outermost (GoogleOAuth) → QueryClient → children.
 * ToastContainer is rendered here so toasts are accessible from any page.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastContainer />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}

// Re-export queryClient for use in mutation callbacks outside React tree
export { queryClient }
