import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function VNDateInput({ name, value, onChange, required, className }) {
  const hiddenDateInputRef = useRef(null);

  const toDisplay = (val) => {
    if (!val) return "";
    if (val.includes("-")) {
      const parts = val.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  };

  const toStandard = (val) => {
    if (!val) return "";
    const parts = val.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return val;
  };

  const handleTextChange = (e) => {
    let raw = e.target.value.replace(/\D/g, ""); 
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = raw;
    if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    } else if (raw.length > 2) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }

    const standardValue = formatted.length === 10 ? toStandard(formatted) : formatted;
    onChange({ target: { name, value: standardValue } });
  };

  const handleCalendarPick = (e) => {
    const selectedDate = e.target.value; 
    if (selectedDate) {
      onChange({ target: { name, value: selectedDate } });
    }
  };

  const openCalendar = () => {
    if (hiddenDateInputRef.current) {
      if (typeof hiddenDateInputRef.current.showPicker === "function") {
        hiddenDateInputRef.current.showPicker();
      } else {
        hiddenDateInputRef.current.focus();
      }
    }
  };

  return (
    <div className="relative flex items-center">
      <input type="text" name={name} value={toDisplay(value)} onChange={handleTextChange} placeholder="dd/mm/yyyy" maxLength={10} required={required} className={`${INPUT} pr-10`} />
      <button type="button" onClick={openCalendar} className="absolute right-2.5 text-gray-400 hover:text-blue-600 focus:outline-none p-1" tabIndex={-1} title="Chọn ngày">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      <input ref={hiddenDateInputRef} type="date" value={value && value.includes("-") ? value : ""} onChange={handleCalendarPick} tabIndex={-1} className="absolute opacity-0 pointer-events-none w-0 h-0 bottom-0 right-0" />
    </div>
  );
}

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

function NumericInput({ name, value, onChange, min, placeholder, required, className }) {
  const handleInputChange = (e) => {
    let cleanValue = e.target.value.replace(/\D/g, "");
    if (min !== undefined && cleanValue !== "" && Number(cleanValue) < min) cleanValue = String(min);
    onChange({ target: { name, value: cleanValue, type: "text" } });
  };

  return (
    <input type="text" name={name} value={value ?? ""} onChange={handleInputChange} placeholder={placeholder} required={required} className={className} inputMode="numeric" autoComplete="off" />
  );
}

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

const INIT = (room) => ({
  full_name: "", phone: "", email: "", id_card_number: "",
  start_date: "", end_date: "",
  monthly_rent: "", service_fee: "", cleaning_fee: "", internet_fee: "", deposit: "",
  payment_day: 5, num_tenants: 1, num_vehicles: 0, temp_residence_reg: false,
  electric_price: "", water_price: "", default_water_amount: "",
  electric_reading: "", water_reading: "",
  notes: "",
});

export default function ContractFormModal({ room, onClose, onSaved }) {
  const [form, setForm]         = useState(() => INIT(room));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [submitStep, setSubmitStep] = useState("");

  const [loadingUtility, setLoadingUtility] = useState(false);

  useEffect(() => {
    let isMounted = true; 
    const fetchUtilityData = () => {
      setLoadingUtility(true);
      api.get(`/utility?room_id=${room.id}`)
        .then((res) => {
          if (!isMounted) return;
          if (res.data && res.data.length > 0) {
            const latestUtility = res.data.sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];
            setForm((prev) => ({ ...prev, electric_reading: latestUtility.electric_new, water_reading: latestUtility.water_new }));
          } else {
            setForm((prev) => ({ ...prev, electric_reading: 0, water_reading: 0 }));
          }
        })
        .catch(() => { if (isMounted) console.error("Không thể tải lịch sử điện nước"); })
        .finally(() => { if (isMounted) setLoadingUtility(false); });
    };

    if (room?.id) fetchUtilityData();
    return () => { isMounted = false; };
  }, [room?.id]); 

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      setSubmitStep("Đang kiểm tra thông tin người thuê...");
      const existingTenantsRes = await api.get("/tenants");
      const existingTenant = existingTenantsRes.data.find(
        (t) => t.phone === form.phone || (form.id_card_number && t.id_card_number === form.id_card_number)
      );

      let tenantId;
      if (existingTenant) {
        tenantId = existingTenant.id;
        setSubmitStep("Đang cập nhật thông tin khách cũ...");
        await api.patch(`/tenants/${tenantId}`, {
          full_name: form.full_name,
          ...(form.email && { email: form.email }),
          ...(form.id_card_number && { id_card_number: form.id_card_number }),
        });
      } else {
        setSubmitStep("Đang tạo người thuê mới...");
        const newTenantRes = await api.post("/tenants", {
          full_name: form.full_name,
          phone: form.phone,
          ...(form.email && { email: form.email }),
          ...(form.id_card_number && { id_card_number: form.id_card_number }),
        });
        tenantId = newTenantRes.data.id;
      }
      
      setSubmitStep("Đang tạo hợp đồng...");
      const contractRes = await api.post("/contracts", {
        room_id:            room.id,
        tenant_id:          tenantId,
        start_date:         form.start_date,
        monthly_rent:       Number(form.monthly_rent),
        service_fee:        form.service_fee ? Number(form.service_fee) : 0,
        cleaning_fee:       form.cleaning_fee ? Number(form.cleaning_fee) : 0,
        internet_fee:       form.internet_fee ? Number(form.internet_fee) : 0,
        deposit:            form.deposit ? Number(form.deposit) : 0,
        num_tenants:        Number(form.num_tenants),
        num_vehicles:       Number(form.num_vehicles),
        payment_day:        Number(form.payment_day),
        temp_residence_reg: form.temp_residence_reg,
        notes:              form.notes, 
        ...(form.end_date && { end_date: form.end_date }),
      });

      const newContractId = contractRes.data.id;

      setSubmitStep("Đang lưu đơn giá điện/nước...");
      await api.post("/utility-rates", {
        room_id:        room.id,
        electric_price: Number(form.electric_price),
        effective_from: form.start_date,
        ...(room.is_water_meter
          ? { water_price: Number(form.water_price) }
          : { water_price: 0, default_water_amount: Number(form.default_water_amount) }
        ),
      });

      setSubmitStep("Đang lưu số điện/nước ban đầu...");
      const startMonth = form.start_date.slice(0, 7);
      await api.post("/utility", {
        room_id:       room.id,
        billing_month: startMonth,
        electric_old:  Number(form.electric_reading),
        electric_new:  Number(form.electric_reading),
        water_old:     room.is_water_meter ? Number(form.water_reading) : 0,
        water_new:     room.is_water_meter ? Number(form.water_reading) : 0,
      });

      if (confirm("Tạo hợp đồng thành công! Bạn có muốn tải bản Word về máy để in không?")) {
        setSubmitStep("Đang tải file hợp đồng Word...");
        try {
          const exportParams = {
            electric_price: form.electric_price || 0,
            water_price: room.is_water_meter ? form.water_price : (form.default_water_amount || 0),
            electric_reading: form.electric_reading || 0,
            water_reading: room.is_water_meter ? form.water_reading : 0
          };
          const fileRes = await api.get(`/contracts/${newContractId}/export-word`, { params: exportParams, responseType: "blob" });
          const url = window.URL.createObjectURL(new Blob([fileRes.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `HopDong_Phong_${room.room_number}.docx`);
          document.body.appendChild(link); link.click(); link.parentNode.removeChild(link);
        } catch {
          alert("Không thể tải file hợp đồng. Bạn có thể xuất lại sau ở mục Quản lý phòng.");
        }
      }

      onSaved();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setLoading(false);
      setSubmitStep("");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Thêm hợp đồng</h2>
          <p className="text-sm text-gray-500 mt-0.5">Phòng {room?.room_number}</p>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* 1. Thông tin người thuê */}
          <Section title="Thông tin người thuê">
            <Field label="Họ tên" required>
              <input name="full_name" value={form.full_name} onChange={handleChange} required placeholder="Nguyễn Văn A" className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số điện thoại" required>
                <input name="phone" value={form.phone} onChange={handleChange} required placeholder="0912345678" className={INPUT} />
              </Field>
              <Field label="Email" hint="Dùng để nhận bill hàng tháng" required>
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="example@gmail.com" className={INPUT} />
              </Field>
            </div>
          </Section>

          {/* 2. Thông tin hợp đồng */}
          <Section title="Thông tin hợp đồng">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày bắt đầu" required><VNDateInput name="start_date" value={form.start_date} onChange={handleChange} required /></Field>
              <Field label="Ngày kết thúc"><VNDateInput name="end_date" value={form.end_date} onChange={handleChange} /></Field>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiền thuê (đ/tháng)" required>
                <FormattedNumberInput name="monthly_rent" value={form.monthly_rent} onChange={handleChange} required className={INPUT} />
              </Field>
              <Field label="Tiền đặt cọc (đ)">
                <FormattedNumberInput name="deposit" value={form.deposit} onChange={handleChange} placeholder="0" className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phí dịch vụ (đ/tháng)">
                <FormattedNumberInput name="service_fee" value={form.service_fee} onChange={handleChange} placeholder="0" className={INPUT} />
              </Field>
              <Field label="Phí vệ sinh (đ/tháng)">
                <FormattedNumberInput name="cleaning_fee" value={form.cleaning_fee} onChange={handleChange} placeholder="0" className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phí internet (đ/tháng)">
                <FormattedNumberInput name="internet_fee" value={form.internet_fee} onChange={handleChange} placeholder="0" className={INPUT} />
              </Field>
              <Field label="Hạn thanh toán (Ngày)" required hint="Nhập ngày khách thuê phải đóng tiền hàng tháng (VD: 5 là ngày 5 hàng tháng)">
                <NumericInput name="payment_day" min={1} max={31} value={form.payment_day} onChange={handleChange} required className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Số người thuê" required><NumericInput name="num_tenants" min={1} value={form.num_tenants} onChange={handleChange} required className={INPUT} /></Field>
              <Field label="Số lượng xe"><NumericInput name="num_vehicles" min={0} value={form.num_vehicles} onChange={handleChange} className={INPUT} /></Field>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input name="temp_residence_reg" type="checkbox" checked={form.temp_residence_reg} onChange={handleChange} className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">Đăng ký tạm trú</span>
            </label>
          </Section>

          {/* 3. Đơn giá điện/nước */}
          <Section title="Đơn giá điện / nước">
            {room?.is_water_meter ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giá điện (đ/kWh)" required><FormattedNumberInput name="electric_price" value={form.electric_price} onChange={handleChange} placeholder="vd: 3,500" required className={INPUT} /></Field>
                <Field label="Giá nước (đ/m³)" required><FormattedNumberInput name="water_price" value={form.water_price} onChange={handleChange} placeholder="vd: 15,000" required className={INPUT} /></Field>
              </div>
            ) : (
              <>
                <Field label="Giá điện (đ/kWh)" required><FormattedNumberInput name="electric_price" value={form.electric_price} onChange={handleChange} placeholder="vd: 3,500" required className={INPUT} /></Field>
                <Field label="Tiền nước cố định (đ/tháng)" required hint="Phòng không đồng hồ nước - nhập tiền cố định"><FormattedNumberInput name="default_water_amount" value={form.default_water_amount} onChange={handleChange} placeholder="vd: 20,000" required className={INPUT} /></Field>
              </>
            )}
          </Section>

          {/* 4. Số điện/nước ban đầu */}
          <Section title="Số điện / nước ban đầu">
            <Field label={<>Số điện ban đầu {loadingUtility && <span className="ml-2 text-blue-500 font-normal">(Đang tải...)</span>}</>} required hint="Số chốt tự động điền, có thể chỉnh sửa">
              <NumericInput name="electric_reading" min={0} value={form.electric_reading} onChange={handleChange} required className={INPUT} />
            </Field>
            {room?.is_water_meter && (
              <Field label={<>Số nước ban đầu {loadingUtility && <span className="ml-2 text-blue-500 font-normal">(Đang tải...)</span>}</>} required hint="Số chốt tự động điền, có thể chỉnh sửa">
                <NumericInput name="water_reading" min={0} value={form.water_reading} onChange={handleChange} required className={INPUT} />
              </Field>
            )}
          </Section>

          {/* 5. Ghi chú */}
          <Section title="Ghi chú">
            <Field label="Ghi chú hợp đồng / Nội thất" hint="Ghi chú lại tình trạng nội thất hoặc các thoả thuận riêng...">
              <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="VD: Khách không lấy nệm..." rows={4} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y" />
            </Field>
          </Section>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
        </form>

        <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">Huỷ</button>
          <button disabled={loading} onClick={(e) => { e.currentTarget.closest(".fixed").querySelector("form").requestSubmit(); }} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition">{loading ? (submitStep || "Đang xử lý...") : "Tạo hợp đồng"}</button>
        </div>
      </div>
    </div>
  );
}