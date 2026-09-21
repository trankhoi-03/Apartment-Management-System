import { useState, useEffect } from "react";
import api from "../../api/axios";

const EMPTY = {
  room_number: "", area_sqm: "", cost_price: "", is_water_meter: true, house_id: "", feature_and_furniture: [] 
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


function CreatableTagInput({ value = [], onChange, availableTags = [], placeholder }) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false); 

  const handleAddTag = (rawInput) => {
    const newTags = rawInput
      .split(",")
      .map(t => t.trim())
      .filter(t => t !== "" && !value.includes(t)); 

    if (newTags.length > 0) {
      onChange([...value, ...newTags]);
    }
    setInputValue("");
    setShowDropdown(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange(value.filter(t => t !== tagToRemove));
  };

  const unselectedTags = availableTags.filter(t => !value.includes(t));
  
  const filteredTags = unselectedTags.filter(t => 
    t.toLowerCase().includes(inputValue.toLowerCase())
  );

  const isExactMatch = availableTags.some(t => t.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 p-2 border border-gray-300 rounded-xl bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 min-h-[46px]">
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 font-medium text-sm rounded-lg border border-blue-200">
            {tag}
            <button 
              type="button" 
              onClick={() => handleRemoveTag(tag)} 
              className="text-blue-400 hover:text-red-500 font-bold leading-none mb-0.5 ml-1 transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => { 
            const val = e.target.value;
            if (val.includes(",")) {
              handleAddTag(val);
            } else {
              setInputValue(val); 
              setShowDropdown(val.trim().length > 0); 
            }
          }}
          onFocus={() => {
            if (inputValue.trim().length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            if (inputValue.trim()) {
              handleAddTag(inputValue);
            }
            setTimeout(() => setShowDropdown(false), 150);
          }}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
          placeholder={value.length === 0 ? placeholder : "Thêm nội thất..."}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (inputValue) handleAddTag(inputValue);
            }
          }}
        />
      </div>
      
      {showDropdown && inputValue.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filteredTags.map(tag => (
            <div 
              key={tag} 
              onMouseDown={(e) => { e.preventDefault(); handleAddTag(tag); }} 
              className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              {tag}
            </div>
          ))}
          
          {!isExactMatch && (
            <div 
              onMouseDown={(e) => { e.preventDefault(); handleAddTag(inputValue); }}
              className="px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer border-t border-gray-50 font-medium transition-colors"
            >
              <span className="mr-2">⊕</span> Thêm "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}

      {unselectedTags.length > 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowAllTags(!showAllTags)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
          >
            <span className="w-4 h-4 flex items-center justify-center bg-gray-100 rounded-full">
              {showAllTags ? "▲" : "▼"}
            </span>
            {showAllTags ? "Thu gọn gợi ý" : "Hiện danh sách nội thất sẵn có"}
          </button>

          {showAllTags && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-wrap gap-2 animate-fade-in">
              {unselectedTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:border-blue-300 hover:text-blue-700 hover:shadow-sm transition-all"
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoomFormModal({ room, houses = [], selectedHouseId, onClose, onSaved }) {
  const isEdit = Boolean(room && room.id);
  const isDuplicate = Boolean(room && !room.id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableTags, setAvailableTags] = useState([]);

  useEffect(() => {
    const syncRoomData = () => {
      if (room) {
        setForm({
          room_number: room.room_number || "",
          area_sqm: room.area_sqm ?? "",
          cost_price: room.cost_price ?? "",
          is_water_meter: room.is_water_meter ?? true,
          house_id: room.house_id ?? (selectedHouseId || (houses.length > 0 ? houses[0].id : "")),
          feature_and_furniture: room.feature_and_furniture?.length > 0 
            ? (Array.isArray(room.feature_and_furniture) ? room.feature_and_furniture : room.feature_and_furniture.split(",").map(t => t.trim()))
            : [],
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

  useEffect(() => {
    api.get("/tags").then(res => {
      const validTypes = ["furniture", "amenity", "feature"];
      const featureTags = res.data
        .filter(t => validTypes.includes(t.type))
        .map(t => t.name);
        
      setAvailableTags(featureTags);
    }).catch(console.error);
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // const furnituresArray = form.furnitures
    //   ? form.furnitures.split(",").map(item => item.trim()).filter(item => item !== "")
    //   : [];

    const payload = {
      room_number: form.room_number,
      cost_price: Number(form.cost_price),
      is_water_meter: form.is_water_meter,
      house_id: Number(form.house_id),
      feature_and_furniture: form.feature_and_furniture,
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Đặc điểm & Nội thất
            </label>
            <CreatableTagInput 
              value={form.feature_and_furniture} 
              availableTags={availableTags}
              onChange={(newTags) => setForm(f => ({ ...f, feature_and_furniture: newTags }))}
              placeholder="vd: Máy lạnh, Có ban công, Gác lửng..."
            />
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