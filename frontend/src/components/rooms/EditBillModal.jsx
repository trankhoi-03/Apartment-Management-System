import { useState, useEffect } from "react";
import api from "../../api/axios";

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


export default function EditBillModal({ bill, onClose, onSaved }) {
  const [form, setForm] = useState({
    electric_new: "",
    water_new: "",
    default_water_amount: "",
    service_fee: "",
    additional_fee: "",          
    additional_fee_reason: ""    
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncDataToForm = () => {
      if (bill) {
        setForm({
          electric_new: bill.electric_new ?? "", 
          water_new: bill.water_new ?? "",
          default_water_amount: bill.default_water_amount ?? "",
          service_fee: bill.service_fee ?? 0,
          additional_fee: bill.additional_fee ?? 0,
          additional_fee_reason: bill.additional_fee_reason ?? ""
        });
      }
    };

    Promise.resolve().then(syncDataToForm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.patch(`/bills/${bill.id}/edit`, {
        electric_new: Number(form.electric_new),
        water_new: Number(form.water_new),
        default_water_amount: Number(form.default_water_amount),
        service_fee: Number(form.service_fee),
        additional_fee: Number(form.additional_fee), 
        additional_fee_reason: form.additional_fee_reason
      });
      onSaved();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Có lỗi xảy ra khi sửa hóa đơn.");
    } finally {
      setLoading(false);
    }
  }

  if (!bill) return null;

  const isWaterMeter = bill.computed_room?.is_water_meter !== false;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Sửa hóa đơn</h2>
        <p className="text-sm text-gray-500 mb-5">
          Tháng {bill.billing_month} — {bill.computed_room?.room_number ? `Phòng ${bill.computed_room.room_number}` : `HĐ #${bill.contract_id}`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện mới (kWh) *
            </label>
            <input 
              name="electric_new" 
              type="number" 
              min="0"
              value={form.electric_new} 
              onChange={handleChange} 
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          {isWaterMeter ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số nước mới (m³)
              </label>
              <input 
                name="water_new" 
                type="number" 
                min="0"
                value={form.water_new} 
                onChange={handleChange}
                placeholder="Nhập số khối nước"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tiền nước cố định (đ)
              </label>
              <FormattedNumberInput 
                name="water_amount" 
                value={form.water_amount} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phí dịch vụ (đ)
            </label>
            <FormattedNumberInput 
              name="service_fee" 
              value={form.service_fee} 
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phí phát sinh (đ)
              </label>
              <FormattedNumberInput 
                name="additional_fee" 
                value={form.additional_fee} 
                onChange={handleChange}
                placeholder="vd: 150000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lý do phát sinh
              </label>
              <input 
                name="additional_fee_reason" 
                value={form.additional_fee_reason} 
                onChange={handleChange}
                placeholder="vd: Sửa ống nước"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition">
              {loading ? "Đang tính lại..." : "Cập nhật hóa đơn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}