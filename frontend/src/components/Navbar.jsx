import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/",        label: "Tổng quan",  icon: "📊" },
  { to: "/rooms",   label: "Phòng & HĐ", icon: "🚪" },
  { to: "/tenants", label: "Người thuê", icon: "👥" },
  { to: "/bills",   label: "Hoá đơn",    icon: "🧾" },
  { to: "/incidents", label: "Sự cố",    icon: "⚠️" },
  { to: "/staffs",  label: "Nhân viên",  icon: "👨‍💼", ownerOnly: true },
  { to: "/finance", label: "Tài chính",  icon: "💰", ownerOnly: true }
];

export default function Navbar() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem("user_role") || "staff"; 
  const isOwner = userRole === "owner";
  
  // Lấy tên người dùng từ localStorage, nếu chưa có thì hiển thị mặc định
  const userName = localStorage.getItem("full_name") || (isOwner ? "Chủ trọ" : "Nhân viên");

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("premium_monthly");

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("full_name"); // Xoá tên khi đăng xuất
    navigate("/login");
  }

  async function handlePayment() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/subscriptions/create-vietqr-payment?plan_key=${selectedPlan}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Tạo giao dịch thất bại");
      
      window.location.href = data.checkoutUrl;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* GIAO DIỆN DESKTOP */}
      <nav className="hidden md:flex bg-white border-b border-gray-200 sticky top-0 z-50 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 w-full">

          {/* Logo App */}
          <span className="font-extrabold text-blue-600 text-xl whitespace-nowrap mr-8 shrink-0">
            🏠 Phòng trọ
          </span>

          {/* Cụm Navigation Links */}
          <div className="flex items-center gap-1.5 overflow-hidden">
            {NAV_ITEMS.map((item) => {
              if (item.ownerOnly && !isOwner) return null;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200
                     ${isActive
                       ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50"
                       : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`
                  }
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {/* Cụm Bên phải: Nút Gia hạn + Lời chào ngang + Đăng xuất */}
          <div className="flex items-center gap-4 shrink-0 ml-auto pl-4">
            
            {/* Nút Gia hạn/Nâng cấp */}
            {/* <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition whitespace-nowrap shadow-sm"
            >
              ⭐ Gia hạn/ Nâng cấp
            </button> */}

            {/* Đường phân cách mờ */}
            <div className="h-5 w-px bg-gray-200"></div>

            {/* Thông tin User (Hiển thị hàng ngang) */}
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <span className="text-gray-500 font-medium">Xin chào,</span>
              <strong className="text-gray-800">{userName}</strong>
            </div>

            {/* Nút Đăng xuất */}
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all whitespace-nowrap flex items-center gap-1.5"
            >
              Đăng xuất
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

        </div>
      </nav>

      {/* MOBILE HEADER */}
      <header className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-40 flex justify-between items-center px-4 h-14">
        <div className="flex flex-col justify-center">
          <span className="font-bold text-blue-600 text-base leading-tight whitespace-nowrap">
            🏠 Phòng trọ
          </span>
          {/* HIỂN THỊ TÊN USER TRÊN MOBILE */}
          <span className="text-[10px] text-gray-500 leading-tight">
            Chào, <strong className="text-gray-700">{userName}</strong>
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* <button
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg whitespace-nowrap"
          >
            ⭐ Gia hạn
          </button> */}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 px-2.5 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 border-t border-gray-200 pb-safe">
        <div className="flex justify-around items-center h-16 px-1">
          {NAV_ITEMS.map((item) => {
            if (item.ownerOnly && !isOwner) return null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-full h-full space-y-1 transition ${
                    isActive ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`text-xl ${isActive ? "scale-110" : "scale-100"} transition-transform`}>
                      {item.icon}
                    </span>
                    <span className="text-[10px] font-medium whitespace-nowrap text-center">
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* MODAL CHỌN GÓI & THANH TOÁN VIETQR (giữ nguyên) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 text-center mb-1">
              Nâng cấp / Gia hạn tài khoản
            </h3>
            <p className="text-xs text-gray-500 text-center mb-5">
              Mở khóa không giới hạn phòng và tính năng quản lý chuyên nghiệp
            </p>

            <div className="space-y-3 mb-6">
              <label
                onClick={() => setSelectedPlan("premium_monthly")}
                className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition ${
                  selectedPlan === "premium_monthly"
                    ? "border-blue-600 bg-blue-50/40"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div>
                  <p className="font-bold text-gray-800">Gói 1 Tháng</p>
                  <p className="text-xs text-gray-500">Mở rộng không giới hạn phòng</p>
                </div>
                <span className="font-bold text-blue-600">99.000đ</span>
              </label>

              <label
                onClick={() => setSelectedPlan("premium_yearly")}
                className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition relative ${
                  selectedPlan === "premium_yearly"
                    ? "border-blue-600 bg-blue-50/40"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="absolute -top-2.5 right-3 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Tiết kiệm 17%
                </span>
                <div>
                  <p className="font-bold text-gray-800">Gói 1 Năm (12 Tháng)</p>
                  <p className="text-xs text-gray-500">Thanh toán trọn gói cả năm</p>
                </div>
                <span className="font-bold text-blue-600">990.000đ</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Đóng
              </button>
              <button
                onClick={handlePayment}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
              >
                {loading ? "Đang tạo mã..." : "Quét mã VietQR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}