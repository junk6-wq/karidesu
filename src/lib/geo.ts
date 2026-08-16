import type { GeoPoint } from '@/types'

const EARTH_RADIUS_KM = 6371

/** 2 点間の大円距離（km）。MVP では移動距離をこの直線距離で近似する。 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 移動手段ごとの平均巡航速度（km/h）。実 API 導入までの暫定値。 */
const SPEED_KMH: Record<string, number> = {
  walk: 4.5,
  car: 42,
  train: 65,
  bus: 30,
  flight: 500,
  other: 35,
}

/** 距離と手段から所要時間（分）を推定する。 */
export function estimateDurationMin(distanceKm: number, mode: string): number {
  const speed = SPEED_KMH[mode] ?? SPEED_KMH.other
  // 乗り換え・駐車・手前の徒歩などの固定オーバーヘッド
  const overhead = mode === 'walk' ? 0 : mode === 'flight' ? 90 : 8
  return Math.max(1, Math.round((distanceKm / speed) * 60 + overhead))
}

export function centroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) return { lat: 36.2048, lng: 138.2529 }
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  )
  return { lat: sum.lat / points.length, lng: sum.lng / points.length }
}
