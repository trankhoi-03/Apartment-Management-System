import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";

const STATUS_CONFIG = {
  received:   { label: "Đã tiếp nhận", color: "bg-orange-100 text-orange-700" },
  processing: { label: "Đang xử lý",   color: "bg-blue-100 text-blue-700" },
  completed:  { label: "Hoàn thành",   color: "bg-green-100 text-green-700" },
};

const formatDateTime = (dateString) => {
  if (!dateString) return "Không rõ thời gian";
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const checkIsOverdue = (dateString, status) => {
  if (status !== "received" || !dateString) return false;
  
  const createdDate = new Date(dateString);
  const now = new Date();
  
  const diffTime = now - createdDate;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  return diffDays > 3;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedHouse, setSelectedHouse] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [housesRes, roomsRes, incidentsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/incidents").catch(() => ({ data: [] }))
      ]);
      setHouses(housesRes.data);
      setRooms(roomsRes.data);
      setIncidents(incidentsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleUpdateStatus(incident, newStatus) {
    try {
      await api.patch(`/incidents/${incident.id}`, { status: newStatus });
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, status: newStatus } : i))
      );
    } catch (err) {
      alert("Có lỗi xảy ra khi cập nhật trạng thái.");
    }
  }

  
  const enrichedIncidents = incidents.map(incident => {
    const room = rooms.find(r => r.id === incident.room_id);
    const house = houses.find(h => h.id === room?.house_id);
    return { ...incident, computed_room: room, computed_house: house };
  });

  
  const filteredIncidents = enrichedIncidents.filter((incident) => {
    // 1. Lọc theo nhà trọ
    const matchHouse = 
      selectedHouse === "all" || 
      incident.computed_house?.id?.toString() === selectedHouse;
    
    // 2. Lọc theo trạng thái
    const matchStatus = 
      selectedStatus === "all" || 
      incident.status === selectedStatus;

    return matchHouse && matchStatus;
  });

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh] text-gray-400">Đang tải...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sự cố & Hư hỏng</h1>
          <p className="text-sm text-gray-500 mt-1">Danh sách các sự cố cần xử lý</p>
        </div>

        
        {houses.length > 0 && (
          <select
            value={selectedHouse}
            onChange={(e) => setSelectedHouse(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700 min-w-[200px]"
          >
            <option value="all">🏢 Tất cả nhà trọ</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id.toString()}>
                🏠 {h.name} {h.address ? `- ${h.address}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setSelectedStatus("all")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            selectedStatus === "all"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setSelectedStatus("received")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            selectedStatus === "received"
              ? "bg-orange-500 text-white shadow-md"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Đã tiếp nhận
        </button>
        <button
          onClick={() => setSelectedStatus("processing")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            selectedStatus === "processing"
              ? "bg-blue-500 text-white shadow-md"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Đang xử lý
        </button>
        <button
          onClick={() => setSelectedStatus("completed")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            selectedStatus === "completed"
              ? "bg-green-500 text-white shadow-md"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Hoàn thành
        </button>
      </div>

      
      {filteredIncidents.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
          <p className="text-4xl mb-3">🛠️</p>
          <p>Không tìm thấy sự cố nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIncidents.map((incident) => {
            const cfg = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.received;
            const isOverdue = checkIsOverdue(incident.created_at, incident.status);

            return (
              <div 
                key={incident.id} 
                className={`rounded-2xl border shadow-sm p-5 transition flex flex-col h-full 
                  ${isOverdue 
                    ? "bg-red-50 border-red-400 shadow-red-100" 
                    : "bg-white border-gray-100 hover:shadow-md"}`}
              >
                
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    
                    {isOverdue && (
                      <span className="text-[10px] font-bold text-red-600 bg-white border border-red-300 px-2 py-0.5 rounded-md animate-pulse whitespace-nowrap">
                        ⚠️ Quá hạn 3 ngày
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>ID: #{incident.id}</span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800">
                  Phòng {incident.computed_room?.room_number ?? "N/A"}
                </h3>
                {incident.computed_house && (
                  <p className="text-xs font-medium text-blue-600 mt-0.5">
                    🏢 {incident.computed_house.name}
                  </p>
                )}
                
                <p className={`text-xs mt-1.5 mb-2 flex items-center gap-1.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  🕒 <span>{formatDateTime(incident.created_at)}</span>
                </p>
                
                <div className={`p-3 rounded-xl mt-2 flex-1 ${isOverdue ? 'bg-white/70 text-red-900' : 'bg-gray-50 text-gray-700'}`}>
                  <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
                </div>

                <div className={`mt-4 pt-4 border-t ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                  {incident.status === "received" && (
                    <button
                      onClick={() => handleUpdateStatus(incident, "processing")}
                      className={`w-full px-4 py-2 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 
                        ${isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      ➡️ Bắt đầu xử lý
                    </button>
                  )}
                  
                  {incident.status === "processing" && (
                    <button
                      onClick={() => handleUpdateStatus(incident, "completed")}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                    >
                      ✅ Đánh dấu hoàn thành
                    </button>
                  )}
                  
                  {incident.status === "completed" && (
                    <div className="w-full px-4 py-2 bg-gray-50 text-gray-500 rounded-xl text-sm font-medium text-center">
                      Sự cố đã được khắc phục
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}