import { NavLink, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/",        label: "Tổng quan",  icon: "📊" },
  { to: "/rooms",   label: "Phòng & HĐ", icon: "🚪" },
  { to: "/tenants", label: "Người thuê", icon: "👥" },
  { to: "/bills",   label: "Hoá đơn",    icon: "🧾" },
  { to: "/incidents", label: "Sự cố",    icon: "⚠️" }
];

export default function Navbar() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    navigate("/login");
  }

  return (
    <>
      {/* 💻 GIAO DIỆN DESKTOP */}
      <nav className="hidden md:flex bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14 w-full">

          <span className="font-bold text-blue-600 text-lg whitespace-nowrap">
            🏠 Phòng trọ
          </span>

          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
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
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="ml-2 text-sm text-gray-500 hover:text-red-500
                       px-3 py-1.5 rounded-lg hover:bg-red-50 transition whitespace-nowrap"
          >
            Đăng xuất
          </button>

        </div>
      </nav>

      {/* 📱 MOBILE HEADER  */}
      <header className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-40 flex justify-between items-center px-4 h-14">
        <span className="font-bold text-blue-600 text-lg whitespace-nowrap">
          🏠 Phòng trọ
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
        >
          Đăng xuất
        </button>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 border-t border-gray-200 pb-safe">
        <div className="flex justify-around items-center h-16 px-1">
          {NAV_ITEMS.map((item) => (
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
          ))}
        </div>
      </nav>
    </>
  );
}