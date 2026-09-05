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
      <nav className="hidden md:flex bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14 w-full">

          <span className="font-bold text-blue-600 text-lg whitespace-nowrap">
            🏠 Phòng trọ
          </span>

          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              if (item.ownerOnly && !isOwner) return null;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition
                     ${isActive
                       ? "bg-blue-50 text-blue-600"
                       : "text-gray-600 hover:bg-gray-100"}`
                  }
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            {/* THÊM HIỂN THỊ TÊN USER Ở ĐÂY */}
            <span className="text-sm text-gray-500 whitespace-nowrap">
              Xin chào, <strong className="text-gray-800">{userName}</strong>
            </span>

            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              {/* <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition whitespace-nowrap shadow-sm"
              >
                ⭐ Gia hạn / Nâng cấp
              </button> */}

              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition whitespace-nowrap"
              >
                Đăng xuất
              </button>
            </div>
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