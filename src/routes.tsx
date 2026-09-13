import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router"

import { LoadingRows } from "@/components/page"
import { RequireAuth } from "@/components/require-auth"
import { CollectionPage } from "@/pages/collection"
import { CollectionsPage } from "@/pages/collections"
import { LoginPage } from "@/pages/login"
import { OverviewPage } from "@/pages/overview"
import { PushPage } from "@/pages/push"

const JourneysPage = lazy(() =>
  import("@/pages/journeys").then((module) => ({
    default: module.JourneysPage,
  }))
)

const JourneyStatsPage = lazy(() =>
  import("@/pages/journey-stats").then((module) => ({
    default: module.JourneyStatsPage,
  }))
)

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:name" element={<CollectionPage />} />
        <Route path="/push" element={<PushPage />} />
        <Route
          path="/journeys"
          element={
            <Suspense fallback={<LoadingRows label="Loading journeys" />}>
              <JourneysPage />
            </Suspense>
          }
        />
        <Route
          path="/journeys/:journeyId/stats"
          element={
            <Suspense fallback={<LoadingRows label="Loading journey stats" />}>
              <JourneyStatsPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
