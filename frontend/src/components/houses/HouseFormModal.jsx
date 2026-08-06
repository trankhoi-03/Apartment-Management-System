import { useState } from "react";
import api from "../../api/axios";


const THEME_COLORS = [
  "#EF4444", // Đỏ
  "#F97316", // Cam
  "#F59E0B", // Vàng cam
  "#EAB308", // Vàng
  "#22C55E", // Xanh lá
  "#14B8A6", // Xanh ngọc
  "#06B6D4", // Xanh cyan
  "#3B82F6", // Xanh dương
  "#6366F1", // Chàm
  "#8B5CF6", // Tím
  "#D946EF", // Hồng tím
  "#F43F5E", // Hồng đỏ
  "#64748B", // Xám
  "#111827", // Đen
];

export default function HouseFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", address: "", theme_color: "#3B82F6" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/houses", form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || "Có lỗi xảy ra khi tạo nhà trọ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-5">Thêm nhà trọ mới</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên nhà trọ <span className="text-red-400">*</span>
            </label>
            <input 
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              required
              maxLength={100}
              placeholder="vd: Nhà trọ A"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Địa chỉ <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
            </label>
            <input 
              name="address" 
              value={form.address} 
              onChange={handleChange}
              placeholder="vd: 122 đường B, Quận C"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Màu chủ đề <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
            </label>
            <div className="flex flex-wrap gap-2.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
              {THEME_COLORS.map((color) => {
                const isSelected = form.theme_color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, theme_color: color })}
                    className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center
                      ${isSelected ? "ring-2 ring-offset-2 ring-gray-800 scale-110 shadow-sm" : "hover:scale-110 border border-black/10"}
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Chọn màu ${color}`}
                  >
                    {isSelected && (
                      <svg className="w-4 h-4 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Màu này sẽ giúp phân biệt các nhà trọ trên giao diện.
            </p>
          </div>

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
              {loading ? "Đang lưu..." : "Thêm nhà trọ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}