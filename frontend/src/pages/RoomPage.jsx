import { useEffect, useState } from "react";
import api from "../api/axios";
import RoomCard from "../components/rooms/RoomCard";
import RoomDrawer from "../components/rooms/RoomDrawer";
import RoomFormModal from "../components/rooms/RoomFormModal";
import HouseFormModal from "../components/houses/HouseFormModal";
import ContractTemplateSettings from "../components/houses/ContractTemplateSettings";


const STATUS_TAGS = [
  { id: "status_vacant", label: "Trống" },
  { id: "status_occupied", label: "Đang thuê" },
];

export default function RoomsPage() {
  const userRole = localStorage.getItem("user_role") || "staff";
  const isOwner = userRole === "owner";
  
  const [rooms, setRooms] = useState([]);
  const [houses, setHouses] = useState([]);
  const [contracts, setContracts] = useState([]); 
  const [selectedHouse, setSelectedHouse] = useState("all");
  const [loading, setLoading] = useState(true);
  
  const [selectedTags, setSelectedTags] = useState([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

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

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, []);

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
      cost_price: room.cost_price,
      area_sqm: room.area_sqm,
      is_water_meter: room.is_water_meter,
      house_id: room.house_id,
      feature_and_furniture: room.feature_and_furniture || room.furnitures,
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
    if (!confirm(`Bạn có chắc chắn muốn xóa "${houseToDelete.name}"?\nLưu ý: Bạn phải xóa hết tất cả các phòng trong nhà này trước khi xóa nhà.`)) return;

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
    return { ...room, computed_house: house, computed_active_contract: activeContract };
  });

  const houseFilteredRooms = selectedHouse === "all"
    ? enrichedRooms
    : enrichedRooms.filter((r) => r.house_id === Number(selectedHouse));

  const uniqueAmenities = Array.from(
    new Set(
      houseFilteredRooms.flatMap(r => {
        const tags = Array.isArray(r.feature_and_furniture) 
          ? r.feature_and_furniture 
          : (r.furnitures || []);
        return tags.map(t => typeof t === 'string' ? t.trim() : "").filter(Boolean);
      })
    )
  ).sort((a, b) => a.localeCompare(b));

  const toggleTag = (tagId) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const finalDisplayedRooms = houseFilteredRooms
    .filter((r) => {
      if (selectedTags.length === 0) return true;

      const selectedStatusIds = selectedTags.filter(tag => tag.startsWith('status_'));
      const selectedFurnitureTags = selectedTags.filter(tag => !tag.startsWith('status_'));

      let isStatusMatch = true;
      if (selectedStatusIds.length > 0) {
        const roomStatusId = `status_${r.status}`;
        isStatusMatch = selectedStatusIds.includes(roomStatusId);
      }

      let isFurnitureMatch = true;
      if (selectedFurnitureTags.length > 0) {
        const roomTags = Array.isArray(r.feature_and_furniture) ? r.feature_and_furniture : (r.furnitures || []);
        const normalizedRoomTags = roomTags.map(t => typeof t === 'string' ? t.trim() : "");
        isFurnitureMatch = selectedFurnitureTags.every(tag => normalizedRoomTags.includes(tag));
      }

      return isStatusMatch && isFurnitureMatch;
    })
    .sort((a, b) => a.room_number.toString().localeCompare(b.room_number.toString(), undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 mb-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0 pr-2">
          <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap shrink-0">Phòng & Hợp đồng</h1>
          
          {houses.length > 0 && (
            <div className="w-full sm:flex-1 min-w-0 max-w-[450px]">
              <select
                value={selectedHouse}
                onChange={(e) => setSelectedHouse(e.target.value)}
                className="w-full block px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700 truncate"
              >
                <option value="all">🏢 Tất cả nhà trọ</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    🏠 {h.name} {h.address ? `- ${h.address}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
  
          {isOwner && (
            <div className="flex flex-1 sm:flex-none items-center gap-1.5 bg-gray-100/70 p-1 rounded-xl border border-gray-100">
              <button 
                onClick={() => setShowHouseForm(true)}
                className="flex-1 sm:flex-none text-center px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold transition whitespace-nowrap shadow-sm border border-gray-200"
              >
                + Thêm nhà
              </button>
              
              {houses.length > 0 && selectedHouse !== "all" && (
                <button
                  onClick={handleDeleteHouse}
                  className="flex-1 sm:flex-none text-center px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold transition whitespace-nowrap shadow-sm border border-gray-200 hover:border-red-200"
                >
                  🗑️ Xóa nhà
                </button>
              )}
            </div>
          )}

          {isOwner && houses.length > 0 && (
            <button
              disabled={selectedHouse === "all"}
              onClick={() => setShowTemplateSettings(true)}
              title={selectedHouse === "all" ? "Vui lòng chọn một nhà cụ thể để cài đặt mẫu HĐ" : "Cài đặt mẫu hợp đồng cho nhà này"}
              className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap shadow-sm border ${
                selectedHouse === "all" 
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100"
              }`}
            >
              📝 Mẫu HĐ
            </button>
          )}
          
          {isOwner && (
            <button onClick={handleAddRoom}
              className="flex-1 sm:flex-none text-center px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap shadow-sm">
              + Thêm phòng
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col relative z-30">
        
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedTags([])}
            className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              selectedTags.length === 0
                ? "border-blue-600 text-blue-700 bg-blue-50/40"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            Tất cả phòng
          </button>

          {STATUS_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
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
                  {houseFilteredRooms.filter(r => r.status === tag.id.replace('status_', '')).length}
                </span>
              </button>
            );
          })}

          {uniqueAmenities.slice(0, 4).map((tag) => {
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
                {tag}
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-3">
          
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Bộ lọc
              <span className="text-gray-400 ml-1">+</span>
            </button>

            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <input 
                      type="text" 
                      placeholder="Tìm đặc điểm, nội thất..." 
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                    {uniqueAmenities
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
                    {uniqueAmenities.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">Chưa có đặc điểm/nội thất nào.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-gray-300 sm:pl-3">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider hidden sm:block">Lọc theo:</span>
              {selectedTags.map(tagId => {
                const isStatus = tagId.startsWith('status_');
                const label = isStatus ? STATUS_TAGS.find(t => t.id === tagId)?.label : tagId;
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400">Đang tải...</p>
        </div>
      ) : finalDisplayedRooms.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🏠</p>
          <p>Không có phòng nào phù hợp với bộ lọc.</p>
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