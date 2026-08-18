/**
 * PASSAGE データモデル（仕様書 11章）
 * MVP では localStorage に、この形のまま永続化する。
 */

export type TripStatus = 'planning' | 'upcoming' | 'journey' | 'completed'

export type BudgetCategory = 'stay' | 'food' | 'transit' | 'activity' | 'other'

export type TravelMode = 'walk' | 'car' | 'train' | 'bus' | 'flight' | 'other'

export type ItineraryItemType = 'sightseeing' | 'meal' | 'stay' | 'transit'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface TravelSegment {
  mode: TravelMode
  durationMin: number
  distanceKm?: number
  route?: GeoPoint[] // THE THREAD 描画用
}

export interface Spot {
  id: string
  name: string
  category: string
  location: GeoPoint
  photoUrls: string[]
  openingHours?: string
  closedDays?: string[]
  estimatedStayMin?: number
  priceLevel?: 1 | 2 | 3 | 4
  aiRecommended?: boolean
  source: 'user' | 'ai'
}

export interface ItineraryItem {
  id: string
  spotId: string
  type: ItineraryItemType
  plannedArrival?: string // "09:30"
  plannedDeparture?: string
  actualArrival?: string // JOURNEY モードで記録
  actualDeparture?: string
  travelToNext?: TravelSegment
  notes?: string
  cost?: number
  costCategory?: BudgetCategory
}

export interface ItineraryDay {
  id: string
  date: string // ISO date "2027-05-01"
  items: ItineraryItem[]
}

export interface Budget {
  currency: string
  planned: Record<BudgetCategory, number>
  actual?: Record<BudgetCategory, number>
}

export interface Companion {
  id: string
  name: string
  role: 'organizer' | 'member'
}

export interface MemoryEntry {
  id: string
  tripId: string
  narrative: string // AI 生成の旅行記本文
  totalDistanceKm: number
  totalCost: number
  visitedSpotCount: number
  routeGeoJson?: object // THE THREAD の完成形
  heroPhotoUrl?: string
  generatedAt: string
  edited?: boolean
}

export interface Trip {
  id: string
  title: string // "HOKKAIDO"
  destination: string
  startDate: string // ISO date
  endDate: string
  coverPhotoUrl?: string
  status: TripStatus
  budget: Budget
  itinerary: ItineraryDay[]
  spots: Spot[]
  companions: Companion[]
  memory?: MemoryEntry
  createdAt: string
  updatedAt: string
}

export type JourneyStatus = 'on_time' | 'at_risk' | 'delayed'

export interface JourneyState {
  tripId: string
  currentLocation?: GeoPoint
  nextItemId?: string
  delayMinutes: number // 0 以下なら順調
  status: JourneyStatus
  lastUpdated: string
}

/* --- AI エージェント（12章のアダプター境界） --- */

export interface TripContext {
  destination: string
  startDate: string
  endDate: string
  interests: string[]
  pace: 'relaxed' | 'balanced' | 'packed'
  companions: number
  budgetHint?: number
}

export type QuestSeverity = 'info' | 'warn' | 'risk'

/** Timeline 上の該当ノードに QuestChip として出す検証結果 */
export interface ItineraryWarning {
  itemId: string
  severity: QuestSeverity
  message: string
}

export interface ReplanSuggestion {
  id: string
  title: string
  detail: string
  savedMinutes: number
  /** 採用時に旅程へ適用する操作 */
  action:
    | { kind: 'shorten'; itemId: string; minutes: number }
    | { kind: 'swap'; itemIdA: string; itemIdB: string }
    | { kind: 'drop'; itemId: string }
    | { kind: 'shift'; minutes: number }
}

export interface AIAgentProvider {
  suggestSpots(context: TripContext): Promise<Spot[]>
  optimizeItinerary(trip: Trip): Promise<{ days: ItineraryDay[]; warnings: ItineraryWarning[] }>
  detectDelay(journey: JourneyState, trip: Trip): Promise<ReplanSuggestion[]>
  generateTravelogue(trip: Trip): Promise<MemoryEntry>
}

export interface MapProvider {
  searchPlaces(query: string, near?: GeoPoint): Promise<Spot[]>
  getRoute(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<TravelSegment>
  watchCurrentLocation(cb: (p: GeoPoint) => void): () => void
}

/* --- ユーザー設定（Settings 画面） --- */

/** 基本の移動手段。徒歩・バスは「基本」の選択肢としては細かすぎるため除外する。 */
export type DefaultTravelMode = 'car' | 'train' | 'flight' | 'other'

/** 旅のテンポ。TripContext の pace と同じ語彙を使い、AI ヒアリングの初期値と揃える。 */
export type PaceLevel = 'relaxed' | 'balanced' | 'packed'

/** ユーザーの基本的な旅行嗜好。Trip ではなくアプリ全体に紐づく。 */
export interface TravelStylePreferences {
  /** 出発地（例: 水戸）。自由入力。 */
  departure: string
  defaultTravelMode: DefaultTravelMode
  defaultPartySize: number
  /** 好みのジャンル。spotSeeds の INTEREST_TAGS と同じ語彙を使う。 */
  interests: string[]
  pace: PaceLevel
  /** 1 日の運転時間の上限（分）。undefined は「特に制限なし」。 */
  driveLimitMin?: number
  /** 早朝から動きたいか。 */
  earlyStart: boolean
  /** 夜遅くまで行動したいか。 */
  lateNight: boolean
  /** 自然文でのこだわりメモ。将来 AI が読み取る前提の自由記述欄（現状は保存のみ）。 */
  freeNotes: string
}

/** AI が旅程を作る際に踏まえてほしいルール。 */
export interface PlanningRulePreferences {
  /** 1 スポットあたりの標準滞在時間（分）。 */
  standardStayMin: number
  /** 食事にかける時間（分）。 */
  mealDurationMin: number
  /** 移動時間に余裕を持たせる。 */
  bufferTime: boolean
  /** 予定を詰め込みすぎない。 */
  avoidOverpacking: boolean
  /** 同じエリアの予定をまとめる。 */
  groupByArea: boolean
  /** 雨天時の代替候補を優先する。 */
  preferRainyAlternatives: boolean
}

/** AI 監視機能ごとの利用意向。バックエンド未実装のため、値は「実装され次第使いたいか」を表す。 */
export interface MonitoringPreferences {
  openingHours: boolean
  weather: boolean
  traffic: boolean
  hotelPrice: boolean
  reservation: boolean
  planSuggestion: boolean
  issueNotify: boolean
}

export interface AppPreferences {
  travelStyle: TravelStylePreferences
  planningRules: PlanningRulePreferences
  monitoring: MonitoringPreferences
}
