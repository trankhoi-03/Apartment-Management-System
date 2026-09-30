import { useState, useEffect, useRef } from "react";
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

// Component chọn tháng
function VietnameseMonthPicker({ value, onChange, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const currentYear = value ? parseInt(value.split('-')[0], 10) : new Date().getFullYear();
  const currentMonth = value ? parseInt(value.split('-')[1], 10) : new Date().getMonth() + 1;
  
  const [viewYear, setViewYear] = useState(currentYear);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMonthSelect = (month) => {
    const monthStr = String(month).padStart(2, "0");
    onChange(`${viewYear}-${monthStr}`);
    setIsOpen(false); 
  };

  return (
    <div className="relative inline-block w-full sm:w-auto text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setViewYear(currentYear); 
          setIsOpen(!isOpen);
        }}
        className={`${className} flex items-center justify-between gap-3 min-w-[200px] hover:border-blue-400 transition-colors`}
      >
        <span>📅 Tháng {String(currentMonth).padStart(2, "0")} năm {currentYear}</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-[280px] p-4 bg-white border border-gray-200 rounded-2xl shadow-xl left-0 sm:right-0 origin-top animate-fade-in">
          <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-xl p-1 border border-gray-100">
            <button type="button" onClick={() => setViewYear(viewYear - 1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-bold text-gray-800 text-sm tracking-wide">NĂM {viewYear}</span>
            <button type="button" onClick={() => setViewYear(viewYear + 1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[...Array(12)].map((_, index) => {
              const monthNum = index + 1;
              const isSelected = currentYear === viewYear && currentMonth === monthNum;
              return (
                <button
                  key={monthNum}
                  type="button"
                  onClick={() => handleMonthSelect(monthNum)}
                  className={`py-2.5 text-sm font-semibold rounded-xl transition-all
                    ${isSelected 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-600 ring-offset-1' 
                      : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-100 hover:border-blue-200'
                    }`}
                >
                  Tháng {monthNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Hàm format tháng từ YYYY-MM sang MM/YYYY
function formatBillingMonth(monthStr) {
  if (!monthStr) return "";
  if (monthStr.includes("-")) {
    const parts = monthStr.split("-");
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`;
    }
  }
  return monthStr;
}

export default function EditBillModal({ bill, onClose, onSaved }) {
  const [billingMonth, setBillingMonth] = useState("");
  
  const [form, setForm] = useState({
    rent_amount: "",
    electric_new: "",
    water_new: "",
    default_water_amount: "",
    service_fee: "",
    cleaning_fee: "",            
    internet_fee: "",           
    additional_fee: "",          
    additional_fee_reason: "",
    discount_amount: "",
    discount_reason: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // States dành cho chức năng điều chỉnh tiền phòng
  const [isAdjustingRent, setIsAdjustingRent] = useState(false);
  const [daysStayed, setDaysStayed] = useState("");
  const [originalRent, setOriginalRent] = useState("");

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

        setBillingMonth(bill.billing_month || "");

        setForm({
          rent_amount: bill.rent_amount ?? "",
          electric_new: initialElectric, 
          water_new: initialWater,       
          default_water_amount: bill.default_water_amount ?? bill.water_amount ?? "", 
          service_fee: bill.service_fee ?? 0,
          cleaning_fee: bill.cleaning_fee ?? 0, 
          internet_fee: bill.internet_fee ?? 0, 
          additional_fee: bill.additional_fee ?? 0,
          additional_fee_reason: bill.additional_fee_reason ?? "",
          discount_amount: bill.discount_amount ?? 0,
          discount_reason: bill.discount_reason ?? ""
        });
        
        // Reset trạng thái điều chỉnh khi tải hoá đơn mới
        setIsAdjustingRent(false);
        setDaysStayed("");
      }
    };

    syncDataToForm(); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id]);

  // Logic tự động tính tiền phòng khi nhập ngày ở
  useEffect(() => {
    if (!isAdjustingRent || !billingMonth) return;
    
    const [year, month] = billingMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Number(daysStayed);
    
    if (daysStayed !== "" && days >= 0 && days <= daysInMonth) {
      const adjusted = Math.round((Number(originalRent || 0) / daysInMonth) * days);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(f => ({ ...f, rent_amount: String(adjusted) }));
    } else if (daysStayed === "") {
      setForm(f => ({ ...f, rent_amount: String(originalRent) }));
    }
  }, [isAdjustingRent, daysStayed, billingMonth, originalRent]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {};
      
      // Chèn billingMonth vào payload
      if (billingMonth !== "") payload.billing_month = billingMonth;

      if (form.rent_amount !== "") payload.rent_amount = Number(form.rent_amount);
      if (form.electric_new !== "") payload.electric_new = Number(form.electric_new);
      if (form.water_new !== "") payload.water_new = Number(form.water_new);
      if (form.default_water_amount !== "") payload.default_water_amount = Number(form.default_water_amount);
      if (form.service_fee !== "") payload.service_fee = Number(form.service_fee);
      if (form.cleaning_fee !== "") payload.cleaning_fee = Number(form.cleaning_fee);
      if (form.internet_fee !== "") payload.internet_fee = Number(form.internet_fee);
      if (form.additional_fee !== "") payload.additional_fee = Number(form.additional_fee);
      if (form.additional_fee_reason !== "") payload.additional_fee_reason = form.additional_fee_reason;
      if (form.discount_amount !== "") payload.discount_amount = Number(form.discount_amount);
      if (form.discount_reason !== "") payload.discount_reason = form.discount_reason;

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
            Tháng {formatBillingMonth(billingMonth)} — {bill.computed_room?.room_number ? `Phòng ${bill.computed_room.room_number}` : `HĐ #${bill.contract_id}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5 max-h-[70vh]">
          
          {/* 0. Tháng xuất bill */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tháng xuất bill <span className="text-red-500">*</span>
            </label>
            <VietnameseMonthPicker 
              value={billingMonth} 
              onChange={setBillingMonth} 
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-blue-400"
            />
          </div>

          {/* 1. Tiền thuê nhà & Chức năng Điều chỉnh */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiền thuê nhà (đ) <span className="text-red-500">*</span>
            </label>
            <FormattedNumberInput 
              name="rent_amount" 
              value={form.rent_amount} 
              onChange={handleChange} 
              placeholder="Nhập tiền thuê nhà..." 
              required 
              className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAdjustingRent ? 'bg-gray-100 pointer-events-none opacity-80' : ''}`} 
            />
            
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdjustingRent}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsAdjustingRent(checked);
                    if (checked) {
                      setOriginalRent(form.rent_amount);
                    } else {
                      setForm(f => ({ ...f, rent_amount: originalRent }));
                      setDaysStayed("");
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Điều chỉnh tiền phòng theo ngày ở</span>
              </label>
              
              {isAdjustingRent && (
                <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Số ngày ở thực tế</label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={daysStayed}
                    onChange={(e) => setDaysStayed(e.target.value)}
                    placeholder="vd: 10"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {daysStayed !== "" && billingMonth && (
                    <div className="mt-2.5 bg-white p-2.5 border border-gray-200 rounded-lg shadow-sm">
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Tháng {billingMonth.split("-")[1]} có <strong>{new Date(billingMonth.split("-")[0], billingMonth.split("-")[1], 0).getDate()}</strong> ngày.
                        <br />
                        Hệ thống tính: ({Number(originalRent || 0).toLocaleString("vi-VN")}đ / {new Date(billingMonth.split("-")[0], billingMonth.split("-")[1], 0).getDate()}) × {daysStayed} = <strong className="text-blue-600 font-semibold">{Math.round((Number(originalRent || 0) / new Date(billingMonth.split("-")[0], billingMonth.split("-")[1], 0).getDate()) * Number(daysStayed)).toLocaleString("vi-VN")}đ</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Điện / Nước */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện mới (kWh)</label>
              <input 
                name="electric_new" 
                type="number" 
                min="0" 
                value={form.electric_new} 
                onChange={handleChange} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>

            {isWaterMeter ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số nước mới (m³)</label>
                <input 
                  name="water_new" 
                  type="number" 
                  min="0" 
                  value={form.water_new} 
                  onChange={handleChange} 
                  placeholder="Nhập số khối" 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
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
          
          {/* 3. Các loại phí dịch vụ */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">Các loại phí dịch vụ</p>
            
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

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phí internet (đ)</label>
                <FormattedNumberInput name="internet_fee" value={form.internet_fee} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phí phát sinh (đ)</label>
                <FormattedNumberInput name="additional_fee" value={form.additional_fee} onChange={handleChange} placeholder="0" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lý do phát sinh</label>
              <input 
                name="additional_fee_reason" 
                value={form.additional_fee_reason} 
                onChange={handleChange} 
                placeholder="vd: Sửa ống nước" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          </div>

          {/* 4. Giảm trừ */}
          <div className="mt-5 pt-3 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">Giảm trừ</p>
            
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Giảm trừ tiền phòng (đ)</label>
              <FormattedNumberInput 
                name="discount_amount" 
                value={form.discount_amount} 
                onChange={handleChange} 
                placeholder="0" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nội dung giảm trừ</label>
              <input 
                name="discount_reason" 
                type="text" 
                value={form.discount_reason} 
                onChange={handleChange} 
                placeholder="vd: Hỗ trợ sinh viên, Khuyến mãi..." 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
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