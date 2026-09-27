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

// Cấu hình các tab trạng thái
const STATUS_TAGS = [
  { id: "status_received", label: "Đã tiếp nhận" },
  { id: "status_processing", label: "Đang xử lý" },
  { id: "status_completed", label: "Hoàn thành" },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedHouse, setSelectedHouse] = useState("all");

  const [selectedTags, setSelectedTags] = useState([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  const [completingIncident, setCompletingIncident] = useState(null);
  const [repairCost, setRepairCost] = useState("");
  const [completingLoading, setCompletingLoading] = useState(false);

  const [editingIncident, setEditingIncident] = useState(null);
  const [editForm, setEditForm] = useState({ description: "", handler_info: "", repair_cost: "" });
  const [editLoading, setEditLoading] = useState(false);

  function handleOpenEdit(incident) {
    setEditingIncident(incident);
    setEditForm({
      description: incident.description || "",
      handler_info: incident.handler_info || "",
      repair_cost: incident.repair_cost ? Number(incident.repair_cost).toLocaleString("en-US") : ""
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditLoading(true);
    try {
      const cost = editForm.repair_cost ? Number(editForm.repair_cost.replace(/\D/g, "")) : null;
      const payload = {
        description: editForm.description,
        handler_info: editForm.handler_info,
        repair_cost: cost
      };
      
      await api.patch(`/incidents/${editingIncident.id}`, payload);
      
      setIncidents((prev) =>
        prev.map((i) => (i.id === editingIncident.id ? { ...i, ...payload } : i))
      );
      setEditingIncident(null);
    } catch {
      alert("Có lỗi xảy ra khi cập nhật sự cố.");
    } finally {
      setEditLoading(false);
    }
  }

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

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmComplete() {
    setCompletingLoading(true);
    try {
      const cost = repairCost ? Number(repairCost.replace(/\D/g, "")) : 0;
      const currentTime = new Date().toISOString();
      await api.patch(`/incidents/${completingIncident.id}`, { 
        status: "completed",
        repair_cost: cost,
        completed_at: currentTime 
      });
      
      setIncidents((prev) =>
        prev.map((i) => (i.id === completingIncident.id ? { ...i, status: "completed", repair_cost: cost, completed_at: currentTime } : i))
      );
      setCompletingIncident(null);
      setRepairCost("");
    } catch {
      alert("Có lỗi xảy ra khi cập nhật trạng thái.");
    } finally {
      setCompletingLoading(false);
    }
  }

  async function handleUpdateStatus(incident, newStatus) {
    try {
      await api.patch(`/incidents/${incident.id}`, { status: newStatus });
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, status: newStatus } : i))
      );
    } catch {
      alert("Có lỗi xảy ra khi cập nhật trạng thái.");
    }
  }

  
  const enrichedIncidents = incidents.map(incident => {
    const room = rooms.find(r => r.id === incident.room_id);
    const house = houses.find(h => h.id === room?.house_id);
    return { ...incident, computed_room: room, computed_house: house };
  });

  
  // Lấy danh sách những người/đơn vị xử lý sự cố (loại bỏ trùng lặp và giá trị rỗng)
  const uniqueHandlers = Array.from(
    new Set(
      enrichedIncidents
        .map(i => i.handler_info?.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const toggleTag = (tagId) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const filteredIncidents = enrichedIncidents.filter((incident) => {
    // 1. Lọc theo nhà trọ
    const matchHouse = 
      selectedHouse === "all" || 
      incident.computed_house?.id?.toString() === selectedHouse;
    
    if (!matchHouse) return false;

    // 2. Nếu không có tag nào được chọn -> Hiện tất cả trong nhà đó
    if (selectedTags.length === 0) return true;

    // Phân loại tags đang được chọn
    const selectedStatusIds = selectedTags.filter(tag => tag.startsWith('status_'));
    const selectedHandlerTags = selectedTags.filter(tag => !tag.startsWith('status_'));

    // 3. Lọc theo Trạng thái (OR logic)
    let isStatusMatch = true;
    if (selectedStatusIds.length > 0) {
      const incidentStatusId = `status_${incident.status}`;
      isStatusMatch = selectedStatusIds.includes(incidentStatusId);
    }

    // 4. Lọc theo Bên xử lý (OR logic)
    let isHandlerMatch = true;
    if (selectedHandlerTags.length > 0) {
      const handlerName = incident.handler_info?.trim();
      isHandlerMatch = handlerName ? selectedHandlerTags.includes(handlerName) : false;
    }

    return isStatusMatch && isHandlerMatch;
  });

  const totalRepairCost = filteredIncidents.reduce((sum, incident) => {
    return sum + (Number(incident.repair_cost) || 0);
  }, 0);

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

      
      {/* ================= HARAVAN-STYLE FILTER BLOCK ================= */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col relative z-30">
        
        {/* ROW 1: Quick Tabs (Tags ngang) */}
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedTags([])}
            className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              selectedTags.length === 0
                ? "border-blue-600 text-blue-700 bg-blue-50/40"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            Tất cả sự cố
          </button>

          {/* Các tab Trạng thái */}
          {STATUS_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            // Đếm số lượng sự cố cho tab này
            const count = enrichedIncidents.filter(i => 
              (selectedHouse === "all" || i.computed_house?.id?.toString() === selectedHouse) && 
              i.status === tag.id.replace('status_', '')
            ).length;

            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "border-blue-600 text-blue-700 bg-blue-50/40"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {tag.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-blue-200/70 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Hiển thị nhanh tối đa 3 tag Bên xử lý ra ngoài hàng tab ngang nếu đang được chọn */}
          {uniqueHandlers.slice(0, 3).map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isSelected
                    ? "border-blue-600 text-blue-700 bg-blue-50/40"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                👷 {tag}
              </button>
            );
          })}
        </div>

        {/* ROW 2: Filter Toolbar & Dropdown */}
        <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-3 rounded-b-xl">
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Lọc bên xử lý
              <span className="text-gray-400 ml-1">+</span>
            </button>

            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <input 
                      type="text" 
                      placeholder="Tìm tên thợ, bên xử lý..." 
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                    {uniqueHandlers
                      .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                      .map(tag => (
                        <label key={tag} className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group">
                          <input 
                            type="checkbox" 
                            checked={selectedTags.includes(tag)}
                            onChange={() => toggleTag(tag)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-blue-700">{tag}</span>
                        </label>
                    ))}
                    {uniqueHandlers.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">Chưa có thông tin bên xử lý nào được lưu.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Hiển thị các tag đang được chọn */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-gray-300 sm:pl-3">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider hidden sm:block">Lọc theo:</span>
              {selectedTags.map(tagId => {
                const isStatus = tagId.startsWith('status_');
                const label = isStatus ? STATUS_TAGS.find(t => t.id === tagId)?.label : `👷 ${tagId}`;
                return (
                  <span key={tagId} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-200">
                    {label}
                    <button onClick={() => toggleTag(tagId)} className="text-blue-400 hover:text-red-500 font-bold leading-none mb-0.5">×</button>
                  </span>
                );
              })}
              <button onClick={() => setSelectedTags([])} className="text-xs font-medium text-gray-500 hover:text-red-600 hover:underline ml-1">
                Xóa lọc
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ================= END HARAVAN-STYLE FILTER ================= */}
      
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center shadow-sm gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 text-lg shadow-sm border border-emerald-100">
            💰
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Tổng chi phí sửa chữa</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Được tính dựa trên kết quả lọc hiện tại</p>
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 tracking-tight">
          {totalRepairCost.toLocaleString("vi-VN")}đ
        </div>
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
                
                <div className="mt-1.5 mb-2 space-y-1">
                  <p className={`text-xs flex items-center gap-1.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                    🕒 <span>{formatDateTime(incident.created_at)}</span>
                  </p>
                  
                  {incident.completed_at && (
                    <p className="text-xs flex items-center gap-1.5 text-green-600 font-medium">
                      ✅ <span>Hoàn thành: {formatDateTime(incident.completed_at)}</span>
                    </p>
                  )}
                </div>
                
                <div className={`p-3 rounded-xl mt-2 flex-1 ${isOverdue ? 'bg-white/70 text-red-900' : 'bg-gray-50 text-gray-700'}`}>
                  <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
                </div>

                {incident.handler_info && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs font-semibold text-blue-800 mb-0.5">👷 Bên xử lý:</p>
                    <p className="text-sm text-blue-900 font-medium">{incident.handler_info}</p>
                  </div>
                )}

                <div className={`mt-4 pt-4 border-t ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                  {incident.status === "received" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(incident)}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(incident, "processing")}
                        className={`flex-[2] px-4 py-2 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 
                          ${isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        ➡️ Xử lý
                      </button>
                    </div>
                  )}
                  
                  {incident.status === "processing" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(incident)}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => setCompletingIncident(incident)}
                        className="flex-[2] px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        ✅ Hoàn thành
                      </button>
                    </div>
                  )}
                  
                  {incident.status === "completed" && (
                    <div className="space-y-2">
                      <div className="w-full px-4 py-2 bg-gray-50 text-gray-500 rounded-xl text-sm font-medium text-center flex flex-col gap-1">
                        <span>Sự cố đã được khắc phục</span>
                        {incident.repair_cost > 0 && (
                          <span className="text-gray-800 font-bold">
                            Chi phí: {Number(incident.repair_cost).toLocaleString("vi-VN")}đ
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleOpenEdit(incident)}
                        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                      >
                        ✏️ Sửa thông tin
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {completingIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận hoàn thành</h3>
            <p className="text-sm text-gray-500 mb-4">
              Nhập chi phí sửa chữa cho sự cố phòng {completingIncident.computed_room?.room_number} (nếu có):
            </p>
            
            <input
              type="text"
              value={repairCost}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setRepairCost(val ? Number(val).toLocaleString("en-US") : "");
              }}
              placeholder="Ví dụ: 150,000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-6"
              inputMode="numeric"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCompletingIncident(null);
                  setRepairCost("");
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmComplete}
                disabled={completingLoading}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-medium transition"
              >
                {completingLoading ? "Đang lưu..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
      {editingIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Sửa thông tin sự cố</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả sự cố <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bên xử lý (Tên/SĐT thợ...)
                </label>
                <input
                  type="text"
                  value={editForm.handler_info}
                  onChange={(e) => setEditForm({...editForm, handler_info: e.target.value})}
                  placeholder="VD: Thợ điện bên B - 0901234567"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chi phí sửa chữa (đ)
                </label>
                <input
                  type="text"
                  value={editForm.repair_cost}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setEditForm({...editForm, repair_cost: val ? Number(val).toLocaleString("en-US") : ""});
                  }}
                  placeholder="Ví dụ: 150,000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  inputMode="numeric"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingIncident(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition"
                >
                  {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}