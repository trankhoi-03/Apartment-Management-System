import { useState, useEffect } from "react";
import api from "../../api/axios";

const EMPTY = { full_name: "", phone: "", email: "", id_card_number: "" };

export default function TenantFormModal({ tenant, onClose, onSaved }) {
  const isEdit = !!tenant;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncTenantData = () => {
      if (tenant) {
        setForm({
          full_name: tenant.full_name,
          phone: tenant.phone,
          email: tenant.email ?? "",
          id_card_number: tenant.id_card_number ?? "",
        });
      } else {
        setForm(EMPTY); 
      }
    };

    Promise.resolve().then(syncTenantData);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      full_name: form.full_name,
      phone: form.phone,
      ...(form.email && { email: form.email }),
      ...(form.id_card_number && { id_card_number: form.id_card_number }),
    };

    try {
      if (isEdit) {
        await api.patch(`/tenants/${tenant.id}`, payload);
      } else {
        await api.post("/tenants", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-5">
          {isEdit ? `Sửa thông tin: ${tenant.full_name}` : "Thêm người thuê mới"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ tên *
            </label>
            <input name="full_name" value={form.full_name} onChange={handleChange}
              required placeholder="Nguyễn Văn A"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại *
            </label>
            <input name="phone" value={form.phone} onChange={handleChange}
              required placeholder="0912345678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (dùng để nhận bill)
            </label>
            <input name="email" value={form.email} onChange={handleChange}
              type="email" placeholder="example@gmail.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số CCCD/CMND
            </label>
            <input name="id_card_number" value={form.id_card_number} onChange={handleChange}
              placeholder="012345678901"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         font-medium text-gray-700 hover:bg-gray-50 transition">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                         disabled:bg-blue-300 text-white rounded-xl text-sm
                         font-medium transition">
              {loading ? "Đang lưu..." : (isEdit ? "Lưu thay đổi" : "Thêm người thuê")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}