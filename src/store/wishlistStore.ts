import { create } from 'zustand'
import type { WishlistDestination } from '@/types'
import { load, save } from '@/lib/storage/local'
import { uid } from '@/lib/id'

const STORAGE_KEY = 'wishlist'

interface WishlistState {
  items: WishlistDestination[]
  addWishlistDestination(input: { name: string; notes?: string; tags?: string[]; photoUrl?: string }): WishlistDestination
  removeWishlistDestination(id: string): void
  updateWishlistDestination(id: string, patch: Partial<Pick<WishlistDestination, 'name' | 'notes' | 'tags' | 'photoUrl'>>): void
}

function persist(items: WishlistDestination[]) {
  save(STORAGE_KEY, items)
}

/**
 * 「いつか行きたい場所」の置き場。Trip 作成前の段階のメモなので Trip とは独立させる。
 * 行き先提案（destinationSuggest）と TripCreate の行き先候補として参照される。
 */
export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: load<WishlistDestination[]>(STORAGE_KEY, []),

  addWishlistDestination({ name, notes, tags, photoUrl }) {
    const item: WishlistDestination = {
      id: uid('wish'),
      name: name.trim(),
      notes: notes?.trim() || undefined,
      tags: tags ?? [],
      photoUrl,
      addedAt: new Date().toISOString(),
    }
    const items = [item, ...get().items]
    set({ items })
    persist(items)
    return item
  },

  removeWishlistDestination(id) {
    const items = get().items.filter((i) => i.id !== id)
    set({ items })
    persist(items)
  },

  updateWishlistDestination(id, patch) {
    const items = get().items.map((i) => (i.id === id ? { ...i, ...patch } : i))
    set({ items })
    persist(items)
  },
}))
