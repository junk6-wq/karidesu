import type { GeoPoint, MapProvider, Spot, TravelMode, TravelSegment } from '@/types'
import { estimateDurationMin, haversineKm } from '@/lib/geo'
import { uid } from '@/lib/id'
import { spotSeeds } from './spotSeeds'

/**
 * MVP の MapProvider 実装。
 * 検索は種データの前方一致、経路は直線距離、現在地はブラウザの Geolocation API。
 * 12章の方針どおり、将来 Google Maps Platform 実装に丸ごと差し替えられる。
 */
export class LocalMapProvider implements MapProvider {
  async searchPlaces(query: string, near?: GeoPoint): Promise<Spot[]> {
    const q = query.trim()
    if (!q) return []
    const all = Object.values(spotSeeds).flat()
    const hits = all.filter((s) => s.name.includes(q) || s.category.includes(q))
    const sorted = near
      ? hits.sort((a, b) => haversineKm(near, a.location) - haversineKm(near, b.location))
      : hits
    return sorted.slice(0, 8).map((seed) => ({
      id: uid('spot'),
      name: seed.name,
      category: seed.category,
      location: seed.location,
      photoUrls: seed.photoUrls,
      openingHours: seed.openingHours,
      closedDays: seed.closedDays,
      estimatedStayMin: seed.estimatedStayMin,
      priceLevel: seed.priceLevel,
      source: 'user',
    }))
  }

  async getRoute(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<TravelSegment> {
    const distanceKm = haversineKm(from, to)
    return {
      mode,
      distanceKm: Number(distanceKm.toFixed(1)),
      durationMin: estimateDurationMin(distanceKm, mode),
      route: [from, to],
    }
  }

  watchCurrentLocation(cb: (p: GeoPoint) => void): () => void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return () => {}
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => cb({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* 権限拒否・取得失敗時は何もしない（手動報告にフォールバック） */
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }
}

export const mapProvider: MapProvider = new LocalMapProvider()
