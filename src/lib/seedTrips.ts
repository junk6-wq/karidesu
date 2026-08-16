import type { Budget, ItineraryDay, Spot, Trip } from '@/types'
import { uid } from '@/lib/id'
import { addMinutes, nowHHMM, toISODate, toMinutes } from '@/lib/time'
import { COVER_PHOTOS, spotSeeds } from '@/lib/providers/spotSeeds'

/**
 * 初回起動時のデモデータ。
 * PLAN / JOURNEY / MEMORY の 3 モードすべてを開いた瞬間に体験できるよう、
 * 「進行中の旅」「これからの旅」「終わった旅」を 1 本ずつ用意する。
 * Settings から全消去すれば空状態（S01 の空画面）を確認できる。
 */

function shift(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

function budget(planned: Partial<Budget['planned']>, actual?: Partial<Budget['planned']>): Budget {
  const zero = { stay: 0, food: 0, transit: 0, activity: 0, other: 0 }
  return {
    currency: 'JPY',
    planned: { ...zero, ...planned },
    actual: actual ? { ...zero, ...actual } : { ...zero },
  }
}

/** 種データからそのまま Spot を起こす（デモ用に ID を固定生成）。 */
function spotsFrom(destination: string, names: string[]): Spot[] {
  const pool = spotSeeds[destination] ?? []
  return names.flatMap((name) => {
    const seed = pool.find((s) => s.name === name)
    if (!seed) return []
    return [
      {
        id: uid('spot'),
        name: seed.name,
        category: seed.category,
        location: seed.location,
        photoUrls: seed.photoUrls,
        openingHours: seed.openingHours,
        closedDays: seed.closedDays,
        estimatedStayMin: seed.estimatedStayMin,
        priceLevel: seed.priceLevel,
        source: 'user' as const,
      },
    ]
  })
}

/**
 * スポット配列を日ごとに割り付け、開始時刻から順に予定を積む。
 * どの日も空にならないよう、余りは前の日から 1 件ずつ配る。
 */
function daysFrom(dates: string[], spots: Spot[], firstStart = '09:30'): ItineraryDay[] {
  const base = Math.floor(spots.length / dates.length)
  const extra = spots.length % dates.length
  let cursor = 0

  return dates.map((date, dayIndex) => {
    let clock = firstStart
    const size = base + (dayIndex < extra ? 1 : 0)
    const slice = spots.slice(cursor, cursor + size)
    cursor += size
    return {
      id: uid('day'),
      date,
      items: slice.map((spot) => {
        const stay = spot.estimatedStayMin ?? 60
        const plannedArrival = clock
        const plannedDeparture = addMinutes(plannedArrival, stay)
        clock = addMinutes(plannedDeparture, 45)
        return {
          id: uid('item'),
          spotId: spot.id,
          type: spot.category === '食事' ? ('meal' as const) : ('sightseeing' as const),
          plannedArrival,
          plannedDeparture,
        }
      }),
    }
  })
}

/**
 * 進行中デモの体裁を整える。
 *  - 過ぎた日は到着済みにする
 *  - 今日の予定は「いまから少し先」に置き直す（固定時刻のままだと常に大遅刻に見える）
 */
function makeLive(days: ItineraryDay[]): ItineraryDay[] {
  const todayISO = toISODate(new Date())
  const startMin = (toMinutes(nowHHMM()) ?? 540) + 35

  return days.map((day) => {
    if (day.date < todayISO) {
      return {
        ...day,
        items: day.items.map((i) => ({
          ...i,
          actualArrival: i.plannedArrival,
          actualDeparture: i.plannedDeparture,
        })),
      }
    }
    if (day.date !== todayISO) return day

    let clock = Math.min(startMin, 20 * 60)
    return {
      ...day,
      items: day.items.map((item) => {
        const arrival = clock
        const stay =
          (toMinutes(item.plannedDeparture ?? '') ?? arrival + 60) -
          (toMinutes(item.plannedArrival ?? '') ?? arrival)
        clock = arrival + Math.max(30, stay) + 45
        return {
          ...item,
          plannedArrival: addMinutes('00:00', arrival),
          plannedDeparture: addMinutes('00:00', arrival + Math.max(30, stay)),
        }
      }),
    }
  })
}

export function seedTrips(): Trip[] {
  const now = new Date().toISOString()

  /* --- 1. 進行中の旅（JOURNEY モードが開く） --- */
  const naganoSpots = spotsFrom('長野', [
    '上高地 河童橋',
    '大王わさび農場',
    '白馬岩岳マウンテンリゾート',
    '善光寺',
    '万座温泉',
    '軽井沢 旧軽井沢銀座',
  ])
  const nagano: Trip = {
    id: uid('trip'),
    title: 'SHINSHU',
    destination: '長野',
    startDate: shift(-1),
    endDate: shift(2),
    coverPhotoUrl: COVER_PHOTOS['長野'],
    status: 'journey',
    budget: budget(
      { stay: 68000, food: 42000, transit: 31000, activity: 24000, other: 8000 },
      { stay: 68000, food: 15400, transit: 12800, activity: 6200, other: 1500 },
    ),
    itinerary: makeLive(
      daysFrom([shift(-1), shift(0), shift(1), shift(2)], naganoSpots, '09:00'),
    ),
    spots: naganoSpots,
    companions: [
      { id: uid('cmp'), name: 'あなた', role: 'organizer' },
      { id: uid('cmp'), name: 'パートナー', role: 'member' },
    ],
    createdAt: now,
    updatedAt: now,
  }

  /* --- 2. これからの旅（PLAN モード） --- */
  // 実際に車で回れる順番に並べておく（AI の移動時間検証が現実的な値になる）
  const hokkaidoSpots = spotsFrom('北海道', [
    '札幌 二条市場',
    '小樽 運河',
    '登別温泉 地獄谷',
    '美瑛 青い池',
    '富良野 ファーム富田',
  ])
  const hokkaido: Trip = {
    id: uid('trip'),
    title: 'HOKKAIDO',
    destination: '北海道',
    startDate: shift(46),
    endDate: shift(50),
    coverPhotoUrl: COVER_PHOTOS['北海道'],
    status: 'upcoming',
    budget: budget({ stay: 132000, food: 68000, transit: 74000, activity: 30000, other: 8000 }),
    itinerary: daysFrom(
      [shift(46), shift(47), shift(48), shift(49), shift(50)],
      hokkaidoSpots,
      '10:00',
    ),
    spots: hokkaidoSpots,
    companions: [{ id: uid('cmp'), name: 'あなた', role: 'organizer' }],
    createdAt: now,
    updatedAt: now,
  }

  /* --- 3. 終わった旅（MEMORY モードが開く） --- */
  const kyotoSpots = spotsFrom('京都', [
    '伏見稲荷大社',
    '錦市場',
    '清水寺',
    '嵐山 竹林の小径',
    '銀閣寺と哲学の道',
  ])
  const kyoto: Trip = {
    id: uid('trip'),
    title: 'KYOTO',
    destination: '京都',
    startDate: shift(-38),
    endDate: shift(-35),
    coverPhotoUrl: COVER_PHOTOS['京都'],
    status: 'completed',
    budget: budget(
      { stay: 54000, food: 38000, transit: 29000, activity: 12000, other: 6000 },
      { stay: 51200, food: 44300, transit: 28600, activity: 9800, other: 7400 },
    ),
    itinerary: makeLive(
      daysFrom([shift(-38), shift(-37), shift(-36), shift(-35)], kyotoSpots, '09:30'),
    ),
    spots: kyotoSpots,
    companions: [
      { id: uid('cmp'), name: 'あなた', role: 'organizer' },
      { id: uid('cmp'), name: '友人', role: 'member' },
    ],
    createdAt: now,
    updatedAt: now,
  }

  return [nagano, hokkaido, kyoto]
}
