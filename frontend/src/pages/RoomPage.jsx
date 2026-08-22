import { useEffect, useState } from "react";
import api from "../api/axios";
import RoomCard from "../components/rooms/RoomCard";
import RoomDrawer from "../components/rooms/RoomDrawer";
import RoomFormModal from "../components/rooms/RoomFormModal";
import HouseFormModal from "../components/houses/HouseFormModal";
import ContractTemplateSettings from "../components/houses/ContractTemplateSettings";

const STATUS_FILTERS = [
  { key: "all",      label: "Tất cả" },
  { key: "vacant",   label: "Trống" },
  { key: "occupied", label: "Đang thuê" },
];

export default function RoomsPage() {
  const userRole = localStorage.getItem("user_role") || "staff";
  const isOwner = userRole === "owner";
  const [rooms, setRooms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [contracts, setContracts] = useState([]); 
  const [selectedHouse, setSelectedHouse] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); 
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [showHouseForm, setShowHouseForm] = useState(false);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [housesRes, roomsRes, contractsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/contracts").catch(() => ({ data: [] }))
      ]);
      setHouses(housesRes.data);
      setRooms(roomsRes.data);
      setContracts(contractsRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function handleCardClick(room) {
    setSelectedRoom((prev) => prev?.id === room.id ? null : room);
  }

  function handleRoomSaved() {
    setShowForm(false);
    const wasEditingExisting = editingRoom && editingRoom.id;
    setEditingRoom(null);
    loadData();
    if (wasEditingExisting) {
      api.get(`/rooms/${wasEditingExisting}`).then((res) => setSelectedRoom(res.data));
    }
  }

  function handleRoomDeleted() {
    setSelectedRoom(null);
    loadData();
  }

  function handleEditRoom(room) {
    setEditingRoom(room);
    setShowForm(true);
  }

  function handleDuplicateRoom(room) {
    const duplicatedData = {
      room_number: `${room.room_number}_copy`,
      base_rent: room.base_rent,
      area_sqm: room.area_sqm,
      is_water_meter: room.is_water_meter,
      house_id: room.house_id,
      furnitures: room.furnitures,
      // Không truyền 'id' để RoomFormModal hiểu là tạo mới (POST)
    };
    setEditingRoom(duplicatedData);
    setShowForm(true);
  }

  function handleAddRoom() {
    setEditingRoom(null);
    setShowForm(true);
  }

  async function handleDeleteHouse() {
    if (selectedHouse === "all") return;

    const houseToDelete = houses.find(h => h.id === Number(selectedHouse));
    if (!houseToDelete) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa "${houseToDelete.name}"?\nLưu ý: Bạn phải xóa hết tất cả các phòng trong nhà này trước khi xóa nhà.`)) {
      return;
    }

    try {
      await api.delete(`/houses/${selectedHouse}`);
      alert("Đã xóa nhà trọ thành công!");
      setSelectedHouse("all"); 
      loadData(); 
    } catch (err) {
      alert(err.response?.data?.detail || "Không thể xóa nhà trọ này.");
    }
  }

  const enrichedRooms = rooms.map(room => {
    const house = houses.find(h => h.id === room.house_id);
    const activeContract = contracts.find(c => c.room_id === room.id && c.status === "active");
    
    return {
      ...room,
      computed_house: house,
      computed_active_contract: activeContract
    };
  });

  const houseFilteredRooms = selectedHouse === "all"
    ? enrichedRooms
    : enrichedRooms.filter((r) => r.house_id === Number(selectedHouse));

  const finalDisplayedRooms = houseFilteredRooms.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <h1 className="text-2xl font-bold text-gray-800 mr-2 whitespace-nowrap">Phòng & Hợp đồng</h1>
          
          {houses.length > 0 && (
            <select
              value={selectedHouse}
              onChange={(e) => setSelectedHouse(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700 max-w-[200px] sm:max-w-xs md:max-w-md truncate"
            >
              <option value="all">🏢 Tất cả nhà trọ</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  🏠 {h.name} {h.address ? `- ${h.address}` : ""}
                </option>
              ))}
            </select>
          )}

          {isOwner && (
            <div className="flex items-center gap-2 bg-gray-100/70 p-1 rounded-xl">
              <button 
                onClick={() => setShowHouseForm(true)}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold transition whitespace-nowrap shadow-sm border border-gray-200"
              >
                + Thêm nhà
              </button>
              
              {houses.length > 0 && selectedHouse !== "all" && (
                <button
                  onClick={handleDeleteHouse}
                  className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold transition whitespace-nowrap shadow-sm border border-gray-200 hover:border-red-200"
                >
                  🗑️ Xóa nhà
                </button>
              )}
            </div>
          )}
        </div>

        {isOwner && (
          <div className="flex-shrink-0 mt-2 xl:mt-0">
            <button onClick={handleAddRoom}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap w-full sm:w-auto shadow-sm">
              + Thêm phòng
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">        
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {STATUS_FILTERS.map((f) => {
            const count = houseFilteredRooms.filter(r => f.key === "all" ? true : r.status === f.key).length;
            
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap
                  ${statusFilter === f.key 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"}`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${statusFilter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {isOwner && houses.length > 0 && (
          <div className="flex-shrink-0">
            <button
              disabled={selectedHouse === "all"}
              onClick={() => setShowTemplateSettings(true)}
              title={selectedHouse === "all" ? "Vui lòng chọn một nhà cụ thể để cài đặt mẫu HĐ" : "Cài đặt mẫu hợp đồng cho nhà này"}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap w-full sm:w-auto shadow-sm border ${
                selectedHouse === "all" 
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100"
              }`}
            >
              📝 Mẫu hợp đồng
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400">Đang tải...</p>
        </div>
      ) : finalDisplayedRooms.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🏠</p>
          <p>Không có phòng nào phù hợp với bộ lọc.</p>
          
          {statusFilter === "all" && isOwner && (
            <button onClick={handleAddRoom}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
              + Thêm phòng đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {finalDisplayedRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isOwner={isOwner}
              onClick={handleCardClick}
              onDuplicate={handleDuplicateRoom}
              isSelected={selectedRoom?.id === room.id}
            />
          ))}
        </div>
      )}

      {selectedRoom && (
        <RoomDrawer
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onEdit={handleEditRoom}
          onDuplicate={handleDuplicateRoom}
          onDeleted={handleRoomDeleted}
          onContractChanged={loadData}
        />
      )}

      {showForm && (
        <RoomFormModal
          room={editingRoom}
          houses={houses} 
          selectedHouseId={selectedHouse !== "all" ? selectedHouse : ""} 
          onClose={() => { setShowForm(false); setEditingRoom(null); }}
          onSaved={handleRoomSaved}
        />
      )}

      {showHouseForm && (
        <HouseFormModal 
          onClose={() => setShowHouseForm(false)}
          onSaved={() => {
            setShowHouseForm(false);
            loadData(); 
          }}
        />
      )}

      {showTemplateSettings && selectedHouse !== "all" && (
        <ContractTemplateSettings
          houseId={selectedHouse}
          onClose={() => setShowTemplateSettings(false)}
        />
      )}
    </div>
  );
}