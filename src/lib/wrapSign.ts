import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.WRAP_SIGN_SECRET || process.env.CRON_SECRET
  if (!s) throw new Error('WRAP_SIGN_SECRET or CRON_SECRET must be set')
  return s
}

export function signWrapUrl(uid: string, year: number, month: number, format: string): string {
  return createHmac('sha256', secret())
    .update(`${uid}:${year}:${month}:${format}`)
    .digest('hex')
}

export function verifyWrapSig(uid: string, year: number, month: number, format: string, sig: string): boolean {
  const expected = signWrapUrl(uid, year, month, format)
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch { return false }
}
