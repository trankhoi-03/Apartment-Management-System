import { useEffect, useState, useRef, useMemo } from "react";
import api from "../api/axios";
import { Link } from "react-router-dom";

const STATUS_CONFIG = {
  vacant:   { label: "Trống",      color: "bg-green-100 text-green-700"  },
  occupied: { label: "Đang thuê",  color: "bg-blue-100 text-blue-700"    },
  inactive: { label: "Ngừng thuê", color: "bg-gray-100 text-gray-500"    },
};

function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-2xl p-5 ${color}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function RoomCard({ room, house }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.inactive;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-lg font-bold text-gray-800">Phòng {room.room_number}</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>
      
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm text-gray-500">🏢</span>
        <span className="text-sm font-medium text-blue-600">
          {house ? house.name : "Không xác định"}
        </span>
      </div>

      <div className="space-y-1 text-sm text-gray-600">
        <p>Giá cost: <span className="font-medium text-gray-800">
          {room.cost_price.toLocaleString("vi-VN")}đ
        </span></p>
        {room.area_sqm && <p>Diện tích: {room.area_sqm} m²</p>}
        <p>Đồng hồ nước: {room.is_water_meter ? "✅ Có" : "❌ Không"}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const userRole = localStorage.getItem("user_role") || "staff";
  const isOwner = userRole === "owner";
  const [rooms, setRooms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [bills, setBills] = useState([]); 
  
  const [selectedHouse, setSelectedHouse] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get("/houses").catch(() => ({ data: [] })),
      api.get("/rooms").catch(() => ({ data: [] })),
      api.get("/contracts").catch(() => ({ data: [] })),
      api.get("/bills").catch(() => ({ data: [] })) 
    ])
      .then(([housesRes, roomsRes, contractsRes, billsRes]) => {
        setHouses(housesRes.data);
        setRooms(roomsRes.data);
        setContracts(contractsRes.data);
        setBills(billsRes.data);
      })
      .catch(() => setError("Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, []);

  const revenueStats = useMemo(() => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const enrichedBills = bills.map(b => {
      const contract = contracts.find(c => c.id === b.contract_id);
      const room = rooms.find(r => r.id === contract?.room_id);
      return { ...b, computed_house_id: room?.house_id };
    });

    const filteredBills = selectedHouse === "all" 
      ? enrichedBills 
      : enrichedBills.filter(b => b.computed_house_id === Number(selectedHouse));

    // 1. Thực thu chỉ tính theo tháng hiện tại
    const thisMonthBills = filteredBills.filter(b => b.billing_month === currentMonthStr);
    const collectedThisMonth = thisMonthBills.filter(b => b.status === "paid").reduce((sum, b) => sum + Number(b.total_amount), 0);

    // 2. Tổng cần thu tính toán toàn bộ hoá đơn chưa đóng (bất kể tháng nào)
    const uncollectedTotal = filteredBills.filter(b => b.status !== "paid").reduce((sum, b) => sum + Number(b.total_amount), 0);
    const unpaidCountTotal = filteredBills.filter(b => b.status !== "paid").length;

    // 3. Tính toán tháng trước
    const lastMonthBills = filteredBills.filter(b => b.billing_month === lastMonthStr);
    const collectedLastMonth = lastMonthBills.filter(b => b.status === "paid").reduce((sum, b) => sum + Number(b.total_amount), 0);

    let growthLabel = "";
    let isUp = true;
    if (collectedLastMonth > 0) {
      const growth = ((collectedThisMonth - collectedLastMonth) / collectedLastMonth) * 100;
      isUp = growth >= 0;
      growthLabel = `${isUp ? "📈 Tăng" : "📉 Giảm"} ${Math.abs(growth).toFixed(1)}%`;
    } else if (collectedThisMonth > 0) {
      growthLabel = "📈 Tăng 100%";
    }

    return {
      currentMonthStr,
      lastMonthStr, 
      collectedThisMonth,
      uncollectedTotal,       
      unpaidCountTotal,       
      collectedLastMonth,
      growthLabel,
      isUp
    };
  }, [bills, contracts, rooms, selectedHouse]);


  const expiringContracts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return contracts
      .filter((c) => {
        if (c.status !== "active" || !c.end_date) return false;
        const room = rooms.find(r => r.id === c.room_id);
        if (selectedHouse !== "all" && room?.house_id !== Number(selectedHouse)) return false;

        const endDate = new Date(c.end_date);
        endDate.setHours(0, 0, 0, 0);
        
        const diffTime = endDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      })
      .map((c) => {
        const room = rooms.find(r => r.id === c.room_id);
        const house = houses.find(h => h.id === room?.house_id);
        const endDate = new Date(c.end_date);
        endDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((endDate - today) / (1000 * 60 * 60 * 24));
        
        return { ...c, computed_room: room, computed_house: house, days_left: diffDays };
      })
      .sort((a, b) => a.days_left - b.days_left); 
  }, [contracts, rooms, houses, selectedHouse]);


  async function handleExport() {
    try {
      setIsExporting(true);
      const res = await api.get("/data/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `Data_PhongTro_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch {
      alert("Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const res = await api.get("/data/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Mau_Nhap_Lieu_PhongTro.xlsx"); 
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch {
      alert("Không thể tải file mẫu. Vui lòng thử lại.");
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsImporting(true);
      await api.post("/data/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert("Nhập dữ liệu từ Excel thành công!");
      loadData();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Lỗi khi nhập file Excel. Hãy kiểm tra lại định dạng.";
      alert(errorMsg);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  }

  const filteredRooms = selectedHouse === "all" 
    ? rooms 
    : rooms.filter((r) => r.house_id === Number(selectedHouse));

  const total    = filteredRooms.length;
  const occupied = filteredRooms.filter((r) => r.status === "occupied").length;
  const vacant   = filteredRooms.filter((r) => r.status === "vacant").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tổng quan</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 whitespace-nowrap"
          >
            {isExporting ? "⏳ Đang xuất..." : "📤 Xuất dữ liệu"}
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-gray-200 whitespace-nowrap"
              >
                {isImporting ? "⏳ Đang xử lý..." : "📥 Nhập dữ liệu"}
              </button>

              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-blue-200 whitespace-nowrap"
              >
                📄 Tải file mẫu
              </button>

              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleImport} />
            </>
          )}
          
          {houses.length > 0 && (
            <select
              value={selectedHouse}
              onChange={(e) => setSelectedHouse(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700 min-w-[200px]"
            >
              <option value="all">🏢 Tất cả nhà trọ</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>🏠 {h.name} {h.address ? `- ${h.address}` : ""}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Tổng số phòng"   value={total}    color="bg-gray-50"        />
        <StatCard label="Đang có người thuê" value={occupied} color="bg-blue-50"     />
        <StatCard label="Phòng trống"      value={vacant}   color="bg-green-50"      />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Tài chính tháng {revenueStats.currentMonthStr.slice(-2)}/{revenueStats.currentMonthStr.slice(0,4)}</h2>
          <Link to="/bills" className="text-sm font-medium text-blue-600 hover:underline">Quản lý hoá đơn &rarr;</Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-emerald-700 text-sm font-semibold mb-1 flex items-center gap-1.5">
                  💰 Doanh thu
                </p>
                <h3 className="text-3xl font-extrabold text-emerald-900 tracking-tight">
                  {revenueStats.collectedThisMonth.toLocaleString("vi-VN")}đ
                </h3>
              </div>
              {revenueStats.growthLabel && (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm whitespace-nowrap
                  ${revenueStats.isUp ? 'bg-emerald-200 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                  {revenueStats.growthLabel}
                </span>
              )}
            </div>
          </div>

          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-rose-700 text-sm font-semibold mb-1 flex items-center gap-1.5">
                  ⏳ Cần thu (Tổng nợ)
                </p>
                <h3 className="text-3xl font-extrabold text-rose-900 tracking-tight">
                  {revenueStats.uncollectedTotal.toLocaleString("vi-VN")}đ
                </h3>
              </div>
              {revenueStats.unpaidCountTotal > 0 && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-200 text-rose-800 shadow-sm whitespace-nowrap">
                  ⚠️ {revenueStats.unpaidCountTotal} hoá đơn nợ
                </span>
              )}
            </div>
          </div>

        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 flex justify-between items-center text-sm shadow-sm transition hover:bg-blue-50">
           <span className="font-medium text-blue-800 flex items-center gap-2">
             <span>🗓️</span> Tổng doanh thu tháng trước ({revenueStats.lastMonthStr?.slice(-2) || ""}/{revenueStats.lastMonthStr?.slice(0,4) || ""}):
           </span>
           <span className="font-extrabold text-blue-900 text-base">
             {revenueStats.collectedLastMonth.toLocaleString("vi-VN")}đ
           </span>
        </div>
      </div>


      {expiringContracts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-8 shadow-sm">
          <h3 className="text-orange-800 font-bold mb-3 flex items-center gap-2">
            <span className="animate-pulse">⚠️</span> Cảnh báo: Có {expiringContracts.length} hợp đồng sắp hết hạn
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expiringContracts.map(c => {
              const formattedDate = new Date(c.end_date).toLocaleDateString("vi-VN");
              const isOverdue = c.days_left < 0;
              
              return (
                <div key={c.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3.5 rounded-xl border border-orange-100 hover:shadow-md transition">
                  <div className="mb-2 sm:mb-0">
                    <p className="font-bold text-gray-800">
                      Phòng {c.computed_room?.room_number} <span className="text-sm font-normal text-gray-500 ml-1">({c.computed_house?.name})</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">Khách thuê: <span className="font-medium text-gray-800">{c.tenant?.full_name || "N/A"}</span></p>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap
                    ${isOverdue ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}
                  >
                    {isOverdue 
                      ? `Đã quá hạn ${Math.abs(c.days_left)} ngày` 
                      : c.days_left === 0 ? "Hết hạn HÔM NAY" : `Còn ${c.days_left} ngày`
                    }
                    <div className="text-[10px] font-normal opacity-80 text-center mt-0.5">
                      ({formattedDate})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-right">
            <Link to="/rooms" className="text-sm font-semibold text-orange-600 hover:text-orange-700 hover:underline">
              Tới trang Quản lý phòng &rarr;
            </Link>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-700 mb-4">Danh sách phòng</h2>
      {filteredRooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏠</p>
          <p>Chưa có phòng nào trong nhà trọ này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const house = houses.find((h) => h.id === room.house_id);
            return <RoomCard key={room.id} room={room} house={house} />;
          })}
        </div>
      )}
    </div>
  );
}