import { useState, useEffect } from "react";
import api from "../../api/axios";

const EMPTY = {
  room_number: "", area_sqm: "", cost_price: "", is_water_meter: true, house_id: "", furnitures: ""
};

function FormattedNumberInput({ name, value, onChange, placeholder, required, className }) {
  const formatNumber = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const numericValue = val.toString().replace(/\D/g, "");
    // Thêm dấu phẩy phân cách hàng nghìn (VD: 3,000,000)
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleInputChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    
    onChange({
      target: {
        name,
        value: rawValue,
        type: "text", 
      },
    });
  };

  return (
    <input
      type="text"
      name={name}
      value={formatNumber(value)}
      onChange={handleInputChange}
      placeholder={placeholder}
      required={required}
      className={className}
      inputMode="numeric" // Giúp hiển thị bàn phím số trên điện thoại
    />
  );
}

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

export default function RoomFormModal({ room, houses = [], selectedHouseId, onClose, onSaved }) {
  const isEdit = Boolean(room && room.id);
  const isDuplicate = Boolean(room && !room.id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncRoomData = () => {
      if (room) {
        setForm({
          room_number: room.room_number || "",
          area_sqm: room.area_sqm ?? "",
          cost_price: room.cost_price ?? "",
          is_water_meter: room.is_water_meter ?? true,
          house_id: room.house_id ?? (selectedHouseId || (houses.length > 0 ? houses[0].id : "")),
          furnitures: room.furnitures?.length > 0 
            ? (Array.isArray(room.furnitures) ? room.furnitures.join(", ") : room.furnitures)
            : "",
        });
      } else {
        setForm({
          ...EMPTY,
          house_id: selectedHouseId || (houses.length > 0 ? houses[0].id : ""),
        });
      }
    };

    Promise.resolve().then(syncRoomData);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, houses.length, selectedHouseId]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const furnituresArray = form.furnitures
      ? form.furnitures.split(",").map(item => item.trim()).filter(item => item !== "")
      : [];

    const payload = {
      room_number: form.room_number,
      cost_price: Number(form.cost_price),
      is_water_meter: form.is_water_meter,
      house_id: Number(form.house_id),
      furnitures: furnituresArray, 
      ...(form.area_sqm !== "" && { area_sqm: Number(form.area_sqm) }),
    };

    try {
      if (isEdit) {
        await api.patch(`/rooms/${room.id}`, payload);
      } else {
        await api.post("/rooms", payload);
      }
      onSaved();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(`Lỗi dữ liệu: ${detail[0].msg} (tại ${detail[0].loc.join(" -> ")})`);
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Có lỗi xảy ra khi lưu phòng.");
      }
    } finally {
      setLoading(false);
    }
  }

  const modalTitle = isEdit 
    ? `Sửa phòng ${room.room_number}` 
    : isDuplicate 
      ? "Sao chép phòng mới" 
      : "Thêm phòng mới";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-5">
          {modalTitle}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thuộc nhà trọ *</label>
            <select 
              name="house_id" 
              value={form.house_id} 
              onChange={handleChange} 
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="" disabled>-- Chọn nhà trọ --</option>
              {houses.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số phòng *</label>
            <input 
              name="room_number" 
              value={form.room_number} 
              onChange={handleChange} 
              required
              placeholder="vd: P101"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giá cost (đ/tháng) *</label>
            <FormattedNumberInput 
              name="cost_price" 
              value={form.cost_price} 
              onChange={handleChange}
              required 
              className={INPUT} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diện tích (m²)</label>
            <FormattedNumberInput 
              name="area_sqm" 
              value={form.area_sqm} 
              onChange={handleChange}
              required 
              className={INPUT} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội thất đi kèm</label>
            <input name="furnitures" value={form.furnitures} onChange={handleChange}
              placeholder="vd: Máy lạnh, Tủ lạnh, Giường gỗ..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Các món nội thất cách nhau bởi dấu phẩy.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input name="is_water_meter" type="checkbox"
              checked={form.is_water_meter} onChange={handleChange}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-gray-700">Phòng có đồng hồ nước riêng</span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition">
              {loading ? "Đang lưu..." : (isEdit ? "Lưu thay đổi" : "Thêm phòng")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}