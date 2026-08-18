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

/** MUST/WANT/AVOID の 3 段階。未設定はニュートラル（候補）を表す。 */
export type SpotPriority = 'must' | 'want' | 'avoid'

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
  /** 旅程生成・再最適化時に AI が優先度として利用する。未設定＝候補。 */
  priority?: SpotPriority
}

/**
 * 旅程への組み込み状況を表す派生ステータス（Spot 自体には持たせない）。
 * 「候補・行きたい・採用済み・完了・除外」は priority と itinerary 参加状況から計算する。
 */
export type SpotLifecycle = 'candidate' | 'wanted' | 'planned' | 'completed' | 'excluded'

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

/** TRIP CHECK の5分類。DayLoad/TripHealth の内訳とも対応させる。 */
export type WarningCategory =
  | 'opening_hours'
  | 'travel_time'
  | 'rest_margin'
  | 'density'
  | 'budget'

/** Timeline 上の該当ノードに QuestChip として出す検証結果 */
export interface ItineraryWarning {
  itemId: string
  severity: QuestSeverity
  message: string
  /** TRIP CHECK での分類。未分類の警告（旧データ・外部由来）も許容するため任意。 */
  category?: WarningCategory
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

/**
 * AI 提案の「変更」1 件分。構造化データとして表現し、文章だけに依存しない
 * （30章 AI Architecture: User Request → AI → Structured Proposal → Validation
 *   → Preview → User Approval → Store Mutation の Structured Proposal 部分）。
 */
export type AIProposalChange =
  | { kind: 'move_item'; itemId: string; toDayId: string; label: string }
  | {
      kind: 'update_time'
      itemId: string
      plannedArrival?: string
      plannedDeparture?: string
      label: string
    }
  | { kind: 'reorder_day'; dayId: string; orderedItemIds: string[]; label: string }
  | { kind: 'add_spot'; dayId: string; spot: Spot; plannedArrival?: string; label: string }
  | { kind: 'remove_item'; itemId: string; label: string }
  | { kind: 'adjust_budget'; category: BudgetCategory; value: number; label: string }

/**
 * ユーザー確認前の AI 提案。適用するまで Store には一切書き込まない。
 * previewItinerary / previewBudget は「変更後の状態」を先に計算したプレビュー。
 */
export interface AIProposal {
  id: string
  /** 結論（一言） */
  summary: string
  /** 根拠。可能な限り数値で裏付ける（例: 「DAY2は移動時間が約3時間10分あります」） */
  reason: string
  benefits: string[]
  drawbacks: string[]
  changes: AIProposalChange[]
  previewItinerary: ItineraryDay[]
  previewBudgetPlanned?: Record<BudgetCategory, number>
  estimatedTimeDeltaMin?: number
  estimatedDistanceDeltaKm?: number
  estimatedBudgetDelta?: number
  /** 0–1。AI の自信度（モックでは経験則で算出） */
  confidence: number
}

export interface TripHealthBreakdown {
  moveEfficiency: number
  openingHours: number
  restMargin: number
  budget: number
  density: number
  weatherResilience: number
}

export interface TripHealth {
  score: number
  breakdown: TripHealthBreakdown
}

export type LoadLevel = 'low' | 'medium' | 'high'

export interface DayLoad {
  dayId: string
  score: number
  level: LoadLevel
}

export interface AIAgentProvider {
  suggestSpots(context: TripContext): Promise<Spot[]>
  optimizeItinerary(trip: Trip): Promise<{ days: ItineraryDay[]; warnings: ItineraryWarning[] }>
  detectDelay(journey: JourneyState, trip: Trip): Promise<ReplanSuggestion[]>
  generateTravelogue(trip: Trip): Promise<MemoryEntry>
  /** 自然言語での編集リクエストを、確認可能な構造化提案（複数可）に変換する。 */
  proposeItineraryChanges(trip: Trip, request: string): Promise<AIProposal[]>
  evaluateTripHealth(trip: Trip, warnings: ItineraryWarning[]): Promise<TripHealth>
  evaluateDayLoad(trip: Trip): Promise<DayLoad[]>
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
