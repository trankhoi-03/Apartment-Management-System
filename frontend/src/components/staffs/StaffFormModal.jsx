import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function StaffFormModal({ houses = [], selectedHouseId, onClose, onSaved }) {
  const [form, setForm] = useState({
    phone: "",
    house_id: selectedHouseId || (houses.length > 0 ? houses[0].id.toString() : ""),
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const setDefaultHouse = () => {
      if (!form.house_id && houses.length > 0) {
        setForm(prev => ({ ...prev, house_id: houses[0].id.toString() }));
      }
    };

    Promise.resolve().then(setDefaultHouse);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houses.length]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post('/staffs', {
        phone: form.phone,
        house_id: parseInt(form.house_id)
      });
      
      alert("Đã cấp quyền thành công!");
      onSaved(); 
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Hãy đăng ký tài khoản cho nhân viên ở trang Đăng ký trước.");
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Nhân viên này đã quản lý nhà trọ này rồi.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Cấp quyền nhân viên</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại nhân viên *</label>
            <input 
              type="text" 
              name="phone"
              required
              placeholder="vd: 0912345678"
              value={form.phone} 
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn nhà trọ *</label>
            <select 
              name="house_id"
              required
              value={form.house_id} 
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {houses.map(h => <option key={h.id} value={h.id.toString()}>{h.name}</option>)}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
              <Link to="/register" className="block mt-2 font-semibold hover:underline">
                &rarr; Đi tới trang Đăng ký
              </Link>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl text-sm font-medium transition">
              {loading ? "Đang xử lý..." : "Cấp quyền"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}