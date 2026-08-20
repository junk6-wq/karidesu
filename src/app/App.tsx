import { Navigate, Route, Routes } from 'react-router-dom'
import { HomeScreen } from '@/features/home/HomeScreen'
import { TripCreateScreen } from '@/features/plan/TripCreateScreen'
import { TripLayout } from '@/features/trip/TripLayout'
import { TripOverviewScreen } from '@/features/plan/TripOverviewScreen'
import { ItineraryScreen } from '@/features/plan/ItineraryScreen'
import { SpotsScreen } from '@/features/plan/SpotsScreen'
import { BudgetScreen } from '@/features/plan/BudgetScreen'
import { AgentPanelScreen } from '@/features/plan/AgentPanelScreen'
import { SpotPickScreen } from '@/features/plan/SpotPickScreen'
import { JourneyScreen } from '@/features/journey/JourneyScreen'
import { JourneyRouteScreen } from '@/features/journey/JourneyRouteScreen'
import { MemoryScreen } from '@/features/memory/MemoryScreen'
import { MemoryStatsScreen } from '@/features/memory/MemoryStatsScreen'
import { ShareScreen } from '@/features/memory/ShareScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { WishlistScreen } from '@/features/wishlist/WishlistScreen'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/wishlist" element={<WishlistScreen />} />
      <Route path="/trip/new" element={<TripCreateScreen />} />
      {/* デッキは没入表示にしたいので、モードタブを持つ TripLayout の外に置く */}
      <Route path="/trip/:id/pick" element={<SpotPickScreen />} />
      {/* 共有は特定のモードに属さない単発の操作。モードタブの外に出して、
          PLAN からも MEMORY からも同じ見た目で開けるようにする */}
      <Route path="/trip/:id/share" element={<ShareScreen />} />

      <Route path="/trip/:id" element={<TripLayout />}>
        <Route index element={<TripOverviewScreen />} />
        <Route path="plan/itinerary" element={<ItineraryScreen />} />
        <Route path="plan/spots" element={<SpotsScreen />} />
        <Route path="plan/budget" element={<BudgetScreen />} />
        <Route path="agent" element={<AgentPanelScreen />} />

        <Route path="journey" element={<JourneyScreen />} />
        <Route path="journey/route" element={<JourneyRouteScreen />} />

        <Route path="memory" element={<MemoryScreen />} />
        <Route path="memory/stats" element={<MemoryStatsScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
