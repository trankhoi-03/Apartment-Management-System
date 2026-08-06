import React from 'react';

const STATUS_CONFIG = {
  vacant:   { label: "Trống",      color: "bg-green-100 text-green-700"  },
  occupied: { label: "Đang thuê",  color: "bg-blue-100 text-blue-700"    },
  inactive: { label: "Ngừng thuê", color: "bg-gray-100 text-gray-500"    },
};

export default function RoomCard({ room, onClick, isSelected }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.inactive;
  
  const houseName = room.computed_house?.name;
  const houseColor = room.computed_house?.theme_color || "#3B82F6";

  return (
    <div
      onClick={() => onClick && onClick(room)}
      style={{ borderLeft: `6px solid ${houseColor}` }}
      className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer hover:shadow-md transition 
                  ${isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Phòng {room.room_number}</h3>
          
          {houseName && (
            <p className="text-xs font-medium text-blue-600 mt-0.5">
              🏢 {houseName}
            </p>
          )}
        </div>
        
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
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