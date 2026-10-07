/** Loads the Razorpay Checkout script once and opens it in recurring
 * (subscription) mode. Resolves with the handler payload on success, rejects
 * on dismissal or script-load failure. */

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

let scriptPromise: Promise<void> | null = null

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Razorpay checkout. Check your connection and try again.'))
    }
    document.body.appendChild(script)
  })
  return scriptPromise
}

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

export interface OpenRazorpayCheckoutOptions {
  keyId: string
  subscriptionId: string
  name?: string
  description?: string
  prefillEmail?: string
  prefillName?: string
}

export async function openRazorpayCheckout(opts: OpenRazorpayCheckoutOptions): Promise<RazorpayCheckoutResult> {
  await loadRazorpayScript()

  return new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay({
      key: opts.keyId,
      subscription_id: opts.subscriptionId,
      name: opts.name ?? 'DISHA AI',
      description: opts.description ?? 'Subscription',
      prefill: { email: opts.prefillEmail, name: opts.prefillName },
      theme: { color: '#0B1F3A' },
      handler: (response: RazorpayCheckoutResult) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
    })
    razorpay.open()
  })
}
