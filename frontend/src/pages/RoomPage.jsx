import { useEffect, useState } from "react";
import api from "../api/axios";
import RoomCard from "../components/rooms/RoomCard";
import RoomDrawer from "../components/rooms/RoomDrawer";
import RoomFormModal from "../components/rooms/RoomFormModal";
import HouseFormModal from "../components/houses/HouseFormModal";

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
  const [selectedHouse, setSelectedHouse] = useState("all");
  
  const [statusFilter, setStatusFilter] = useState("all"); 

  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showHouseForm, setShowHouseForm] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [housesRes, roomsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] }))
      ]);
      setHouses(housesRes.data);
      setRooms(roomsRes.data);
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
    setEditingRoom(null);
    loadData();
    if (editingRoom && editingRoom !== "new") {
      api.get(`/rooms/${editingRoom.id}`).then((res) => setSelectedRoom(res.data));
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

  function handleAddRoom() {
    setEditingRoom(null);
    setShowForm(true);
  }

  const enrichedRooms = rooms.map(room => {
    const house = houses.find(h => h.id === room.house_id);
    return {
      ...room,
      computed_house: house
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
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Phòng & Hợp đồng</h1>
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
          {isOwner && (
            <button 
              onClick={() => setShowHouseForm(true)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition whitespace-nowrap"
            >
              + Thêm nhà
            </button>
          )}
        </div>
        {isOwner && (
          <button onClick={handleAddRoom}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap">
            + Thêm phòng
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {STATUS_FILTERS.map((f) => {
          const count = houseFilteredRooms.filter(r => f.key === "all" ? true : r.status === f.key).length;
          
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400">Đang tải...</p>
        </div>
      ) : finalDisplayedRooms.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🏠</p>
          <p>Không có phòng nào phù hợp với bộ lọc.</p>
          {statusFilter === "all" && (
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
              onClick={handleCardClick}
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
    </div>
  );
}