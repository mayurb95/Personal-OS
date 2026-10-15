import { MONTH_SHORT } from '../../engine/dates'

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrFmt2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** ₹1,23,457 (whole rupees) or with paise when `exact`. */
export function inr(n: number, exact = false): string {
  return (exact ? inrFmt2 : inrFmt).format(n)
}

/** Short form for charts and tight spaces: ₹1.2L, ₹45k, ₹950. */
export function inrShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`
  return `₹${Math.round(n)}`
}

export function monthLabel(month: string): string {
  return `${MONTH_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export const INCOME_CATEGORIES = ['Salary', 'Refund', 'Interest', 'Other income']

const EMOJI: Record<string, string> = {
  'Food & dining': '🍽️',
  Groceries: '🛒',
  Transport: '🚕',
  Fuel: '⛽',
  'Bills & utilities': '💡',
  Rent: '🏠',
  Shopping: '🛍️',
  Travel: '✈️',
  Health: '💊',
  Entertainment: '🎬',
  Subscriptions: '🔁',
  Education: '📚',
  'Personal care': '💇',
  'Gifts & donations': '🎁',
  'Fees & charges': '🧾',
  Salary: '💼',
  Refund: '↩️',
  Interest: '🏦',
  'Other income': '➕',
}

export function categoryEmoji(category: string): string {
  return EMOJI[category] ?? '•'
}

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'THB', 'JPY', 'AUD', 'CAD', 'CHF', 'MYR', 'IDR', 'VND', 'LKR', 'NPR', 'HKD', 'NZD', 'ZAR', 'TRY']
