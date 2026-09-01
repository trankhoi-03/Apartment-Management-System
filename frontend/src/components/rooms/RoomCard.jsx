const STATUS_CONFIG = {
  vacant:   { label: "Trống",      color: "bg-green-100 text-green-700"  },
  occupied: { label: "Đang thuê",  color: "bg-blue-100 text-blue-700"    },
  inactive: { label: "Ngừng thuê", color: "bg-gray-100 text-gray-500"    },
};

export default function RoomCard({ room, onClick, isSelected, onDuplicate, isOwner = false }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.inactive;
  
  const houseName = room.computed_house?.name;
  const houseColor = room.computed_house?.theme_color || "#3B82F6";

  const contract = room.computed_active_contract;
  let isExpiring = false;
  let daysLeft = null;

  if (contract && contract.end_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(contract.end_date);
    endDate.setHours(0, 0, 0, 0);
    daysLeft = Math.round((endDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 30) {
      isExpiring = true;
    }
  }

  return (
    <div
      onClick={() => onClick && onClick(room)}
      style={{ borderLeft: `6px solid ${houseColor}` }}
      className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer hover:shadow-md transition relative group
                  ${isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"}
                  ${isExpiring ? "bg-orange-50/30" : ""}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            Phòng {room.room_number}
            {isExpiring && (
              <span 
                title={daysLeft < 0 ? `Đã quá hạn ${Math.abs(daysLeft)} ngày` : `Còn ${daysLeft} ngày hết hạn`} 
                className="text-red-500 animate-pulse text-base"
              >
                HĐ còn {daysLeft < 0 ? ` ${Math.abs(daysLeft)} ngày` : ` ${daysLeft} ngày`}
              </span>
            )}
          </h3>
          
          {houseName && (
            <p className="text-xs font-medium text-blue-600 mt-0.5">
              🏢 {houseName}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          {isOwner && onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(room);
              }}
              title="Sao chép phòng này"
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            >
              📋
            </button>
          )}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>
      
      <div className="space-y-1 text-sm text-gray-600">
        <p>Giá cost: <span className="font-medium text-gray-800">
          {room.cost_price?.toLocaleString("vi-VN")}đ
        </span></p>
        {room.area_sqm && <p>Diện tích: {room.area_sqm} m²</p>}
        <p>Đồng hồ nước: {room.is_water_meter ? "✅ Có" : "❌ Không"}</p>
      </div>
    </div>
  );
}