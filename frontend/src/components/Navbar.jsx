import { NavLink, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/",        label: "Tổng quan"   },
  { to: "/rooms",   label: "Phòng & HĐ"  },
  { to: "/tenants", label: "Người thuê"  },
  { to: "/bills",   label: "Hoá đơn"     },
  { to: "/incidents", label: "Sự cố"     }
];

export default function Navbar() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    navigate("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">

        <span className="font-bold text-blue-600 text-lg whitespace-nowrap">
          🏠 Phòng trọ
        </span>

        <div className="flex items-center gap-1 overflow-x-auto">
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
  );
}