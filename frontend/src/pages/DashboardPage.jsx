import { useEffect, useState } from "react";
import api from "../api/axios";

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

function RoomCard({ room }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.inactive;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-bold text-gray-800">Phòng {room.room_number}</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <p>Giá thuê: <span className="font-medium text-gray-800">
          {room.base_rent.toLocaleString("vi-VN")}đ
        </span></p>
        {room.area_sqm && <p>Diện tích: {room.area_sqm} m²</p>}
        <p>Đồng hồ nước: {room.is_water_meter ? "✅ Có" : "❌ Không"}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [rooms, setRooms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/houses").catch(() => ({ data: [] })),
      api.get("/rooms").catch(() => ({ data: [] }))
    ])
      .then(([housesRes, roomsRes]) => {
        setHouses(housesRes.data);
        setRooms(roomsRes.data);
      })
      .catch(() => setError("Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
  }, []);


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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tổng quan</h1>
        
        {houses.length > 0 && (
          <select
            value={selectedHouse}
            onChange={(e) => setSelectedHouse(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700"
          >
            <option value="all">🏢 Tất cả nhà trọ</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                🏠 {h.name} {h.address ? `- ${h.address}` : ""}
              </option>
            ))}
          </select>
        )}
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

      <h2 className="text-lg font-semibold text-gray-700 mb-4">Danh sách phòng</h2>
      {filteredRooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏠</p>
          <p>Chưa có phòng nào trong nhà trọ này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}