import { useState, useEffect } from "react";
import api from "../../api/axios";

function FormattedNumberInput({ name, value, onChange, placeholder, required, className }) {
  const formatNumber = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const numericValue = val.toString().replace(/\D/g, "");
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleInputChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    onChange({ target: { name, value: rawValue, type: "text" } });
  };

  return (
    <input type="text" name={name} value={formatNumber(value)} onChange={handleInputChange} placeholder={placeholder} required={required} className={className} inputMode="numeric" />
  );
}


export default function EditBillModal({ bill, onClose, onSaved }) {
  const [form, setForm] = useState({
    electric_new: "",
    water_new: "",
    default_water_amount: "",
    service_fee: "",
    cleaning_fee: "",            
    internet_fee: "",           
    additional_fee: "",          
    additional_fee_reason: "",
    discount_amount: "" 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncDataToForm = async () => { 
      if (bill) {
        let initialElectric = "";
        let initialWater = "";
        
        try {
            const res = await api.get(`/bills/${bill.id}/utility-reading`);
            initialElectric = res.data.electric_new;
            initialWater = res.data.water_new;
        } catch (error) {
            console.error("Không lấy được số điện nước cũ", error);
        }

        setForm({
          electric_new: initialElectric, 
          water_new: initialWater,       
          default_water_amount: bill.default_water_amount ?? bill.water_amount ?? "", 
          service_fee: bill.service_fee ?? 0,
          cleaning_fee: bill.cleaning_fee ?? 0, 
          internet_fee: bill.internet_fee ?? 0, 
          additional_fee: bill.additional_fee ?? 0,
          additional_fee_reason: bill.additional_fee_reason ?? "",
          discount_amount: bill.discount_amount ?? 0
        });
      }
    };

    syncDataToForm(); 
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
      const payload = {};
      if (form.electric_new !== "") payload.electric_new = Number(form.electric_new);
      if (form.water_new !== "") payload.water_new = Number(form.water_new);
      if (form.default_water_amount !== "") payload.default_water_amount = Number(form.default_water_amount);
      if (form.service_fee !== "") payload.service_fee = Number(form.service_fee);
      if (form.cleaning_fee !== "") payload.cleaning_fee = Number(form.cleaning_fee);
      if (form.internet_fee !== "") payload.internet_fee = Number(form.internet_fee);
      if (form.additional_fee !== "") payload.additional_fee = Number(form.additional_fee);
      if (form.additional_fee_reason !== "") payload.additional_fee_reason = form.additional_fee_reason;
      if (form.discount_amount !== "") payload.discount_amount = Number(form.discount_amount);

      await api.patch(`/bills/${bill.id}/edit`, payload);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col my-auto">
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Sửa hóa đơn</h2>
          <p className="text-sm text-gray-500">
            Tháng {bill.billing_month} — {bill.computed_room?.room_number ? `Phòng ${bill.computed_room.room_number}` : `HĐ #${bill.contract_id}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5 max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện mới (kWh)</label>
              <input name="electric_new" type="number" min="0" value={form.electric_new} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {isWaterMeter ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số nước mới (m³)</label>
                <input name="water_new" type="number" min="0" value={form.water_new} onChange={handleChange} placeholder="Nhập số khối" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiền nước cố định (đ)</label>
                <FormattedNumberInput 
                  name="default_water_amount" 
                  value={form.default_water_amount} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-gray-100">
             <p className="text-sm font-semibold text-gray-700 mb-3">Các khoản phí & Giảm trừ</p>
             <div className="mb-4">
               <label className="block text-xs font-medium text-gray-500 mb-1">Giảm trừ tiền phòng (đ)</label>
               <FormattedNumberInput name="discount_amount" value={form.discount_amount} onChange={handleChange} placeholder="0" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
             </div>
             <div className="grid grid-cols-2 gap-4 mb-4">
               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Phí dịch vụ (đ)</label>
                 <FormattedNumberInput name="service_fee" value={form.service_fee} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Phí vệ sinh (đ)</label>
                 <FormattedNumberInput name="cleaning_fee" value={form.cleaning_fee} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Phí internet (đ)</label>
                 <FormattedNumberInput name="internet_fee" value={form.internet_fee} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-500 mb-1">Phí phát sinh (đ)</label>
                 <FormattedNumberInput name="additional_fee" value={form.additional_fee} onChange={handleChange} placeholder="0" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lý do phát sinh</label>
            <input name="additional_fee_reason" value={form.additional_fee_reason} onChange={handleChange} placeholder="vd: Sửa ống nước" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </form>

        <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Huỷ</button>
          <button disabled={loading} onClick={(e) => { e.currentTarget.closest(".fixed").querySelector("form").requestSubmit(); }} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition">{loading ? "Đang tính lại..." : "Cập nhật hóa đơn"}</button>
        </div>
      </div>
    </div>
  );
}