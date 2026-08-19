import type { WishlistDestination } from '@/types'
import { spotSeeds, DESTINATION_PRESETS } from '@/lib/providers/spotSeeds'

export interface DestinationSuggestion {
  name: string
  reason: string
  source: 'wishlist' | 'match'
  matchedTags: string[]
}

/** 行き先ごとに、そこにあるスポットのタグを集約したもの。マッチングに使う。 */
function tagProfile(destination: string): string[] {
  const seeds = spotSeeds[destination] ?? []
  return Array.from(new Set(seeds.flatMap((s) => s.tags)))
}

/**
 * 行き先が決まっていないユーザー向けの提案（12章 AI Architecture の対象外＝
 * ルールベースのマッチング）。
 * 1. 行きたい場所リストに登録済みのものを最優先で出す
 * 2. 興味タグとスポットのタグが重なる行き先を、重なりが多い順に補う
 */
export function suggestDestinations(
  interests: string[],
  wishlist: WishlistDestination[],
  limit = 4,
): DestinationSuggestion[] {
  const suggestions: DestinationSuggestion[] = []
  const seen = new Set<string>()

  for (const item of wishlist) {
    if (seen.has(item.name)) continue
    seen.add(item.name)
    const matchedTags = item.tags.filter((t) => interests.includes(t))
    suggestions.push({
      name: item.name,
      reason:
        matchedTags.length > 0
          ? `行きたい場所リストに登録済み・${matchedTags.join('・')}が好みに合っています`
          : '行きたい場所リストに登録済みです',
      source: 'wishlist',
      matchedTags,
    })
  }

  const scored = DESTINATION_PRESETS.filter((d) => !seen.has(d))
    .map((name) => {
      const tags = tagProfile(name)
      const matchedTags = tags.filter((t) => interests.includes(t))
      return { name, matchedTags, score: matchedTags.length }
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)

  for (const s of scored) {
    suggestions.push({
      name: s.name,
      reason: `${s.matchedTags.join('・')}が好みに合っています`,
      source: 'match',
      matchedTags: s.matchedTags,
    })
  }

  return suggestions.slice(0, limit)
}
