/** Google reCAPTCHA v3 helper — loads the script once, then executes for a
 * given action. Resolves to undefined (no-op) when no site key is configured,
 * so local dev works without ever touching Google's servers. */

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, opts: { action: string }) => Promise<string>
    }
  }
}

let scriptLoaded: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (scriptLoaded) return scriptLoaded
  scriptLoaded = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'))
    document.head.appendChild(script)
  })
  return scriptLoaded
}

export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  if (!SITE_KEY) return undefined
  try {
    await loadScript()
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window.grecaptcha!.execute(SITE_KEY, { action }).then(resolve).catch(reject)
      })
    })
  } catch {
    // Don't block the user's submission just because the CAPTCHA script
    // failed to load (ad blockers, offline, etc.) — backend will reject if
    // it actually requires a token, otherwise it no-ops the same as here.
    return undefined
  }
}
