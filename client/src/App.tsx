import { Outlet, Route, Routes } from "react-router";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GenerateListingPage } from "@/pages/GenerateListingPage";
import { ListingDetailPage } from "@/pages/ListingDetailPage";
import { ListingsPage } from "@/pages/ListingsPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function AppLayout() {
  return (
    <ProtectedRoute>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<ListingsPage />} />
        <Route path="listings/:id" element={<ListingDetailPage />} />
        <Route
          path="agent/generate"
          element={
            <ProtectedRoute role="agent">
              <GenerateListingPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
