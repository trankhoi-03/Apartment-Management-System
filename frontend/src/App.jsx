import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import LandingPage from "./pages/LandingPage"; 
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import RoomsPage from "./pages/RoomPage";
import TenantsPage from "./pages/TenantPage"; 
import BillsPage from "./pages/BillPage";
import IncidentsPage from "./pages/IncidentPage";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}


function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-6">{children}</main>
    </div>
  );
}

function HomeRoute() {
  const token = localStorage.getItem("access_token");
  if (token) {
    return (
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    );
  }
  // Nếu chưa đăng nhập -> Hiển thị Landing Page
  return <LandingPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/" element={<HomeRoute />} />

        <Route path="/rooms" element={
          <ProtectedRoute>
            <AppLayout><RoomsPage /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/tenants" element={
          <ProtectedRoute>
            <AppLayout><TenantsPage /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/bills" element={
          <ProtectedRoute>
            <AppLayout><BillsPage /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/incidents" element={
          <ProtectedRoute>
            <AppLayout><IncidentsPage /></AppLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}