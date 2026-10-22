// Shared form checks for the Resident and Driver apps.

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

// Philippine mobile: 09XX XXX XXXX or +63 9XX XXX XXXX
export function normalizePhone(v) {
  const digits = v.replace(/\D/g, '')
  if (/^09\d{9}$/.test(digits)) return `+63 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  if (/^639\d{9}$/.test(digits)) return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  if (/^9\d{9}$/.test(digits)) return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  return null
}

// 0-3: weak / fair / strong
export function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score++
  if (pw.length >= 12 || /[^A-Za-z0-9]/.test(pw)) score++
  return score
}
