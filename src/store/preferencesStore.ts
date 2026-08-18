import { create } from 'zustand'
import type { AppPreferences, MonitoringPreferences, PlanningRulePreferences, TravelStylePreferences } from '@/types'
import { load, save } from '@/lib/storage/local'

const STORAGE_KEY = 'preferences'

export function defaultPreferences(): AppPreferences {
  return {
    travelStyle: {
      departure: '',
      defaultTravelMode: 'car',
      defaultPartySize: 2,
      interests: [],
      pace: 'balanced',
      driveLimitMin: undefined,
      earlyStart: false,
      lateNight: false,
      freeNotes: '',
    },
    planningRules: {
      standardStayMin: 60,
      mealDurationMin: 60,
      bufferTime: true,
      avoidOverpacking: true,
      groupByArea: true,
      preferRainyAlternatives: false,
    },
    monitoring: {
      openingHours: false,
      weather: false,
      traffic: false,
      hotelPrice: false,
      reservation: false,
      planSuggestion: false,
      issueNotify: false,
    },
  }
}

/**
 * 保存済みデータと初期値をマージする。
 * 新しい設定項目を追加しても、古い localStorage の内容が壊れないようにする。
 */
function merge(stored: Partial<AppPreferences> | null): AppPreferences {
  const base = defaultPreferences()
  if (!stored) return base
  return {
    travelStyle: { ...base.travelStyle, ...stored.travelStyle },
    planningRules: { ...base.planningRules, ...stored.planningRules },
    monitoring: { ...base.monitoring, ...stored.monitoring },
  }
}

interface PreferencesState {
  preferences: AppPreferences
  updateTravelStyle(patch: Partial<TravelStylePreferences>): void
  updatePlanningRules(patch: Partial<PlanningRulePreferences>): void
  updateMonitoring(patch: Partial<MonitoringPreferences>): void
  resetPreferences(): void
}

function persist(preferences: AppPreferences) {
  save(STORAGE_KEY, preferences)
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  preferences: merge(load<Partial<AppPreferences> | null>(STORAGE_KEY, null)),

  updateTravelStyle(patch) {
    const preferences = {
      ...get().preferences,
      travelStyle: { ...get().preferences.travelStyle, ...patch },
    }
    set({ preferences })
    persist(preferences)
  },

  updatePlanningRules(patch) {
    const preferences = {
      ...get().preferences,
      planningRules: { ...get().preferences.planningRules, ...patch },
    }
    set({ preferences })
    persist(preferences)
  },

  updateMonitoring(patch) {
    const preferences = {
      ...get().preferences,
      monitoring: { ...get().preferences.monitoring, ...patch },
    }
    set({ preferences })
    persist(preferences)
  },

  resetPreferences() {
    const preferences = defaultPreferences()
    set({ preferences })
    persist(preferences)
  },
}))
