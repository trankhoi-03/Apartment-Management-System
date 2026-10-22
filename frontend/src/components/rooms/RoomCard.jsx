import "../../styles/components/RoomCard.css";

const STATUS_CONFIG = {
  vacant: {
    label: "Trống",
    className: "room-card__status--vacant",
  },
  occupied: {
    label: "Đang thuê",
    className: "room-card__status--occupied",
  },
  inactive: {
    label: "Ngừng thuê",
    className: "room-card__status--inactive",
  },
};

export default function RoomCard({ room, onClick, isSelected, onDuplicate, isOwner = false }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.inactive;
  
  const houseName = room.computed_house?.name;
  const houseColor = room.computed_house?.theme_color || "var(--semantic-stroke-brand-base)";

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
      className={`room-card shadow-sm p-5 cursor-pointer hover:shadow-md transition relative group
                  ${isSelected ? "room-card--selected" : ""}
                  ${isExpiring ? "room-card--expiring" : ""}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="room-card__title text-lg font-bold flex items-center gap-2">
            Phòng {room.room_number}
            {isExpiring && (
              <span 
                title={daysLeft < 0 ? `Đã quá hạn ${Math.abs(daysLeft)} ngày` : `Còn ${daysLeft} ngày hết hạn`} 
                className="room-card__warning animate-pulse text-sm font-semibold whitespace-nowrap"
              >
                {daysLeft < 0 ? `Đã quá hạn ${Math.abs(daysLeft)} ngày` : `HĐ còn ${daysLeft} ngày`}
              </span>
            )}
          </h3>
          
          {houseName && (
            <p className="room-card__house text-xs font-medium mt-0.5">
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
              className="room-card__duplicate p-1 transition"
            >
              📋
            </button>
          )}
          <span className={`room-card__status text-xs font-semibold px-2.5 py-1 whitespace-nowrap ${cfg.className}`}>
            {cfg.label}
          </span>
        </div>
      </div>
      
      <div className="room-card__secondary space-y-1 text-sm">
        <p>
          Giá cost:{" "}
          <span className="room-card__price font-medium">
            {room.cost_price?.toLocaleString("vi-VN")}đ
          </span>
        </p>
        {room.area_sqm && (
          <p>Diện tích: {room.area_sqm} m²</p>
        )}
        <p>
          Đồng hồ nước: {room.is_water_meter ? "✅ Có" : "❌ Không"}
        </p>
      </div>
    </div>
  );
}