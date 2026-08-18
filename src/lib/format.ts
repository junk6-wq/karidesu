export function formatCurrency(value: number, currency = 'JPY'): string {
  const rounded = Math.round(value)
  if (currency === 'JPY') return `¥${rounded.toLocaleString('ja-JP')}`
  return `${currency} ${rounded.toLocaleString('en-US')}`
}

export function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} KM`
  return `${Math.round(km).toLocaleString('en-US')} KM`
}

export function formatCount(n: number, unit: string): string {
  return `${n} ${unit}`
}
