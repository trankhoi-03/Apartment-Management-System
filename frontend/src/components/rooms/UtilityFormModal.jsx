import { useState } from "react";
import api from "../../api/axios";

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

export default function UtilityFormModal({ room, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    billing_month: new Date().toISOString().slice(0, 7), 
    electric_old: "",
    electric_new: "",
    water_old: "",
    water_new: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        room_id: room.id,
        billing_month: form.billing_month,
        electric_old: Number(form.electric_old),
        electric_new: Number(form.electric_new),
        water_old: room.is_water_meter ? Number(form.water_old) : 0,
        water_new: room.is_water_meter ? Number(form.water_new) : 0,
      };

      await api.post("/utility", payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || "Có lỗi xảy ra. Vui lòng kiểm tra lại số liệu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Ghi Điện / Nước</h2>
        <p className="text-sm text-gray-500 mb-5">Phòng {room.room_number}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tháng ghi nhận</label>
            <input type="month" name="billing_month" value={form.billing_month}
              onChange={handleChange} required className={INPUT} />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">⚡ Điện (kWh)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Số cũ</label>
                <input type="number" name="electric_old" min="0" value={form.electric_old}
                  onChange={handleChange} required className={INPUT} placeholder="vd: 100" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Số mới</label>
                <input type="number" name="electric_new" min="0" value={form.electric_new}
                  onChange={handleChange} required className={INPUT} placeholder="vd: 150" />
              </div>
            </div>
          </div>

          {room.is_water_meter && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">💧 Nước (m³)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Số cũ</label>
                  <input type="number" name="water_old" min="0" value={form.water_old}
                    onChange={handleChange} required className={INPUT} placeholder="vd: 20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Số mới</label>
                  <input type="number" name="water_new" min="0" value={form.water_new}
                    onChange={handleChange} required className={INPUT} placeholder="vd: 25" />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         font-medium text-gray-700 hover:bg-gray-50 transition">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                         text-white rounded-xl text-sm font-medium transition">
              {loading ? "Đang lưu..." : "Lưu số liệu"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}