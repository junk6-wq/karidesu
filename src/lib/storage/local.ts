/**
 * localStorage ラッパー。
 * 12章の方針どおり、将来 Supabase / Firebase へ差し替えられるよう
 * ストア側からは load/save の 2 関数だけに依存させる。
 */

const PREFIX = 'passage:'

export function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 容量超過などは黙って諦める（UI を壊さないことを優先）
  }
}

export function remove(key: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* noop */
  }
}
