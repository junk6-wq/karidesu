import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint } from '@/types'

export interface MapMarker {
  id: string
  position: GeoPoint
  label: string
  /** 訪問済み / 次 / 未来 でノードの状態を変える（Timeline Node と同じ文法） */
  state?: 'done' | 'next' | 'future'
}

export interface MapLayerProps {
  markers: MapMarker[]
  /** THE THREAD を地図上に落とした線 */
  route?: GeoPoint[]
  /** 塗りつぶし済みの割合。JOURNEY / MEMORY で軌跡を金色に描く */
  progress?: number
  current?: GeoPoint
  className?: string
  interactive?: boolean
  onSelect?: (id: string) => void
  focusId?: string
}

const COLOR = {
  gold: '#c6a15b',
  teal: '#4d7f7c',
  porcelain: '#f5f3ec',
}

function nodeIcon(state: MapMarker['state'], index: number): L.DivIcon {
  const isNext = state === 'next'
  const done = state === 'done'
  const bg = done ? COLOR.gold : isNext ? COLOR.gold : 'transparent'
  const border = done || isNext ? COLOR.gold : 'rgba(245,243,236,0.55)'
  const color = done || isNext ? '#0e1521' : COLOR.porcelain
  return L.divIcon({
    className: '',
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:50%;
      background:${bg};border:1.5px solid ${border};color:${color};
      font-family:var(--f-mono);font-size:11px;font-weight:600;
      box-shadow:${isNext ? '0 0 0 6px rgba(198,161,91,0.22)' : 'none'};
      backdrop-filter:blur(4px);
    ">${String(index + 1).padStart(2, '0')}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

/**
 * Map Layer（7章）。Leaflet + 無料タイルで作り、
 * 12章の方針どおり将来 Google Maps へ差し替えられるよう
 * 呼び出し側には GeoPoint しか見せない。
 */
export function MapLayer({
  markers,
  route,
  progress = 1,
  current,
  className = '',
  interactive = true,
  onSelect,
  focusId,
}: MapLayerProps) {
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // 初期化は 1 回だけ
  useEffect(() => {
    if (!holder.current || mapRef.current) return
    const map = L.map(holder.current, {
      zoomControl: interactive,
      scrollWheelZoom: false,
      dragging: interactive,
      attributionControl: true,
    }).setView([36.2048, 138.2529], 6)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
      className: 'map-chart-tiles',
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [interactive])

  // マーカー・軌跡の描き直し
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const line = route ?? markers.map((m) => m.position)
    const latlngs = line.map((p) => [p.lat, p.lng] as [number, number])

    if (latlngs.length > 1) {
      // 未到達区間: 海図の測線のような点線
      L.polyline(latlngs, {
        color: COLOR.teal,
        weight: 2,
        opacity: 0.75,
        dashArray: '6 8',
      }).addTo(layer)

      // 到達済み区間: THE THREAD の金の軌跡
      const filled = Math.max(0, Math.min(1, progress))
      if (filled > 0) {
        const cut = Math.max(2, Math.round(latlngs.length * filled))
        L.polyline(latlngs.slice(0, cut), {
          color: COLOR.gold,
          weight: 3,
          opacity: 0.95,
          lineCap: 'round',
        }).addTo(layer)
      }
    }

    markers.forEach((m, i) => {
      const marker = L.marker([m.position.lat, m.position.lng], {
        icon: nodeIcon(m.state, i),
        keyboard: false,
      })
        .bindTooltip(m.label, { direction: 'top', offset: [0, -14] })
        .addTo(layer)
      if (onSelect) marker.on('click', () => onSelect(m.id))
    })

    if (current) {
      L.circleMarker([current.lat, current.lng], {
        radius: 7,
        color: COLOR.porcelain,
        weight: 2,
        fillColor: COLOR.gold,
        fillOpacity: 1,
      })
        .bindTooltip('現在地', { direction: 'top', offset: [0, -8] })
        .addTo(layer)
    }

    const all = [...latlngs, ...(current ? [[current.lat, current.lng] as [number, number]] : [])]
    if (all.length === 1) {
      map.setView(all[0], 11)
    } else if (all.length > 1) {
      map.fitBounds(L.latLngBounds(all), { padding: [36, 36], maxZoom: 12 })
    }
    // 親のレイアウト確定後にサイズを取り直す
    setTimeout(() => map.invalidateSize(), 60)
  }, [markers, route, progress, current, onSelect])

  // Timeline のスクロール連動: 選択中スポットへ寄る
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusId) return
    const target = markers.find((m) => m.id === focusId)
    if (target) map.panTo([target.position.lat, target.position.lng], { animate: true })
  }, [focusId, markers])

  return <div ref={holder} className={className} />
}
