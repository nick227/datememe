import { randomInt } from 'crypto'

/**
 * STUB — no real email provider is wired up (no SMTP/SendGrid/Resend credentials
 * available). This logs instead of sending. Swap the body of this one function for
 * a real provider call before production; every call site is already correct and
 * won't need to change.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`[email stub] to=${to} subject="${subject}"\n${body}\n`)
}

/** 6-digit code, entered by hand in-app — no web page exists to host a clickable link. */
export function generateOtp(): string {
  return String(randomInt(100000, 1000000))
}
