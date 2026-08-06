import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
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

// Layout chung cho tất cả trang cần đăng nhập
// Navbar cố định trên đầu, nội dung trang bên dưới
function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — đều dùng chung AppLayout có Navbar */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout><DashboardPage /></AppLayout>
          </ProtectedRoute>
        } />

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