import { Route, Routes } from "react-router"

import { RequireAuth } from "@/components/require-auth"
import { CollectionPage } from "@/pages/collection"
import { CollectionsPage } from "@/pages/collections"
import { LoginPage } from "@/pages/login"
import { JourneysPage } from "@/pages/journeys"
import { OverviewPage } from "@/pages/overview"
import { PushPage } from "@/pages/push"

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:name" element={<CollectionPage />} />
        <Route path="/push" element={<PushPage />} />
        <Route path="/journeys" element={<JourneysPage />} />
      </Route>
    </Routes>
  )
}
