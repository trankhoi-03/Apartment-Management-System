import { useState, useEffect } from "react";
import api from "../../api/axios";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

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

import { useRef } from "react";

// eslint-disable-next-line no-unused-vars
function VNDateInput({ name, value, onChange, required, className }) {
  const hiddenDateInputRef = useRef(null);

  // Chuyển YYYY-MM-DD sang DD/MM/YYYY để hiển thị
  const toDisplay = (val) => {
    if (!val) return "";
    if (val.includes("-")) {
      const parts = val.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  };

  // Chuyển DD/MM/YYYY sang YYYY-MM-DD để lưu vào state form
  const toStandard = (val) => {
    if (!val) return "";
    const parts = val.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return val;
  };

  // Xử lý khi người dùng tự gõ bàn phím (tự thêm dấu /)
  const handleTextChange = (e) => {
    let raw = e.target.value.replace(/\D/g, ""); // Chỉ lấy số
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = raw;
    if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    } else if (raw.length > 2) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }

    // Nếu gõ đủ 10 ký tự (dd/mm/yyyy) thì trigger onChange lưu dạng yyyy-mm-dd
    const standardValue = formatted.length === 10 ? toStandard(formatted) : formatted;

    onChange({
      target: {
        name,
        value: standardValue,
      },
    });
  };

  // Xử lý khi người dùng chọn ngày từ popup lịch
  const handleCalendarPick = (e) => {
    const selectedDate = e.target.value; // YYYY-MM-DD
    if (selectedDate) {
      onChange({
        target: {
          name,
          value: selectedDate,
        },
      });
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
      {/* Input chính luôn hiển thị định dạng dd/mm/yyyy */}
      <input
        type="text"
        name={name}
        value={toDisplay(value)}
        onChange={handleTextChange}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        required={required}
        className={`${INPUT} pr-10`}
      />

      {/* Nút icon lịch để kích hoạt datepicker native */}
      <button
        type="button"
        onClick={openCalendar}
        className="absolute right-2.5 text-gray-400 hover:text-blue-600 focus:outline-none p-1"
        tabIndex={-1}
        title="Chọn ngày"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.7}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Input ẩn chỉ dùng để mở widget lịch của trình duyệt */}
      <input
        ref={hiddenDateInputRef}
        type="date"
        value={value && value.includes("-") ? value : ""}
        onChange={handleCalendarPick}
        tabIndex={-1}
        className="absolute opacity-0 pointer-events-none w-0 h-0 bottom-0 right-0"
      />
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
    onChange({
      target: { name, value: rawValue, type: "text" },
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
      inputMode="numeric"
    />
  );
}

function NumericInput({ name, value, onChange, min, placeholder, required, className }) {
  const handleInputChange = (e) => {
    let cleanValue = e.target.value.replace(/\D/g, "");

    if (min !== undefined && cleanValue !== "" && Number(cleanValue) < min) {
      cleanValue = String(min);
    }

    onChange({
      target: {
        name,
        value: cleanValue,
        type: "text",
      },
    });
  };

  return (
    <input
      type="text"
      name={name}
      value={value ?? ""}
      onChange={handleInputChange}
      placeholder={placeholder}
      required={required}
      className={className}
      inputMode="numeric" // Mở bàn phím số khi dùng trên smartphone
      autoComplete="off"
    />
  );
}

export default function EditContractModal({ contract, room, onClose, onSaved }) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [submitStep, setSubmitStep] = useState("");
  const [utilityId, setUtilityId] = useState(null);
  const [utilityForm, setUtilityForm] = useState({
    electric_reading: "",
    water_reading: "",
  });
  const isWaterMeter = room?.is_water_meter ?? contract?.room?.is_water_meter;

  const [tenant, setTenant] = useState({
    full_name: "", phone: "", email: "", id_card_number: "",
  });

  const [contractForm, setContractForm] = useState({
    monthly_rent: "", service_fee: "", deposit: "", start_date: "", end_date: "", payment_day: "",
    num_tenants: 1, num_vehicles: 0, temp_residence_reg: false,
  });

  const [rateForm, setRateForm] = useState({
    electric_price: "", water_price: "", default_water_amount: "",
    effective_from: new Date().toISOString().slice(0, 10), 
    updateRate: false,  
  });

  useEffect(() => {
    // Lấy chỉ số điện/nước ban đầu
    const fetchInitialUtility = () => {
      if (!contract?.start_date || !contract?.room_id) return;
      const startMonth = contract.start_date.slice(0, 7);
      
      api.get(`/utility?room_id=${contract.room_id}`).then((res) => {
        const initialUtil = res.data.find(u => u.billing_month === startMonth);
        if (initialUtil) {
          setUtilityId(initialUtil.id);
          setUtilityForm({
            electric_reading: initialUtil.electric_old ?? "",
            water_reading: initialUtil.water_old ?? "",
          });
        }
      }).catch(err => console.error(err));
    };

    Promise.resolve().then(fetchInitialUtility);
  }, [contract?.id, contract?.start_date, contract?.room_id]);

  function handleUtilityChange(e) {
    const { name, value } = e.target;
    setUtilityForm((f) => ({ ...f, [name]: value }));
  }

  useEffect(() => {
    const syncContractData = () => {
      if (!contract) return;
      
      setTenant({
        full_name:      contract.tenant?.full_name      ?? "",
        phone:          contract.tenant?.phone          ?? "",
        email:          contract.tenant?.email          ?? "",
        id_card_number: contract.tenant?.id_card_number ?? "",
      });
      
      setContractForm({
        monthly_rent:       contract.monthly_rent       ?? "",
        service_fee:        contract.service_fee        ?? "",
        deposit:            contract.deposit            ?? "",
        start_date:         contract.start_date         ?? "",
        end_date:           contract.end_date           ?? "",
        payment_day:        contract.payment_day        ?? "",
        num_tenants:        contract.num_tenants        ?? 1,
        num_vehicles:       contract.num_vehicles       ?? 0,
        temp_residence_reg: contract.temp_residence_reg ?? false,
      });
    };

    Promise.resolve().then(syncContractData);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id]);

  function handleTenantChange(e) {
    const { name, value } = e.target;
    setTenant((f) => ({ ...f, [name]: value }));
  }

  function handleContractChange(e) {
    const { name, value, type, checked } = e.target;
    setContractForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  function handleRateChange(e) {
    const { name, value, type, checked } = e.target;
    setRateForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Bước 1: Chỉ cập nhật tenant nếu có thông tin nào thay đổi
      const tenantPayload = {};
      if (tenant.full_name !== contract.tenant?.full_name) {
        tenantPayload.full_name = tenant.full_name;
      }
      // Chỉ gửi phone khi người dùng thực sự sửa số điện thoại
      if (tenant.phone !== contract.tenant?.phone) {
        tenantPayload.phone = tenant.phone;
      }
      if (tenant.email !== (contract.tenant?.email || "")) {
        tenantPayload.email = tenant.email;
      }
      if (tenant.id_card_number !== (contract.tenant?.id_card_number || "")) {
        tenantPayload.id_card_number = tenant.id_card_number;
      }

      // Nếu có thay đổi ở thông tin tenant mới gọi API
      if (Object.keys(tenantPayload).length > 0) {
        setSubmitStep("Đang cập nhật người thuê...");
        await api.patch(`/tenants/${contract.tenant_id}`, tenantPayload);
      }

      // Bước 2: Cập nhật hợp đồng 
      setSubmitStep("Đang cập nhật hợp đồng...");
      await api.patch(`/contracts/${contract.id}`, {
        start_date:         contractForm.start_date,
        monthly_rent:       Number(contractForm.monthly_rent),
        service_fee:        Number(contractForm.service_fee) || 0,
        deposit:            Number(contractForm.deposit) || 0,
        payment_day:        Number(contractForm.payment_day),
        num_tenants:        Number(contractForm.num_tenants),
        num_vehicles:       Number(contractForm.num_vehicles),
        temp_residence_reg: contractForm.temp_residence_reg,
        ...(contractForm.end_date && { end_date: contractForm.end_date }),
      });

      // Bước 3 (tuỳ chọn): Tạo bảng giá mới nếu chủ trọ chọn 
      if (rateForm.updateRate) {
        setSubmitStep("Đang lưu đơn giá mới...");
        await api.post("/utility-rates", {
          room_id:        contract.room_id,
          electric_price: Number(rateForm.electric_price),
          water_price:    isWaterMeter ? Number(rateForm.water_price) : 0,
          effective_from: rateForm.effective_from,
          ...(!isWaterMeter && rateForm.default_water_amount
            ? { default_water_amount: Number(rateForm.default_water_amount) }
            : {}),
        });
      }

      // Bước 4 (tuỳ chọn): Cập nhật chỉ số điện/nước ban đầu
      if (utilityId && (utilityForm.electric_reading !== "" || utilityForm.water_reading !== "")) {
        setSubmitStep("Đang cập nhật số điện/nước ban đầu...");
        await api.patch(`/utility/${utilityId}`, {
          electric_old: Number(utilityForm.electric_reading),
          electric_new: Number(utilityForm.electric_reading), // Cập nhật cả số mới vì đây là mốc ban đầu
          ...(isWaterMeter ? {
            water_old: Number(utilityForm.water_reading),
            water_new: Number(utilityForm.water_reading)
          } : {})
        });
      }

      onSaved();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Có lỗi xảy ra. Vui lòng kiểm tra lại.");
    } finally {
      setLoading(false);
      setSubmitStep("");
    }
  }

  if (!contract) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Sửa hợp đồng</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Phòng {contract.room?.room_number} — {contract.tenant?.full_name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* 1. Thông tin người thuê */}
          <Section title="Thông tin người thuê">
            <Field label="Họ tên">
              <input name="full_name" value={tenant.full_name}
                onChange={handleTenantChange} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số điện thoại">
                <input name="phone" value={tenant.phone}
                  onChange={handleTenantChange} className={INPUT} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" value={tenant.email}
                  onChange={handleTenantChange} placeholder="—" className={INPUT} />
              </Field>
            </div>
          </Section>

          {/* 2. Thông tin hợp đồng */}
          <Section title="Thông tin hợp đồng">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày bắt đầu" required>
                <VNDateInput 
                  name="start_date"
                  value={contractForm.start_date}
                  onChange={handleContractChange}
                />
              </Field>
              <Field label="Ngày kết thúc">
                <VNDateInput 
                  name="end_date"
                  value={contractForm.end_date}
                  onChange={handleContractChange}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiền thuê (đ/tháng)">
                <FormattedNumberInput name="monthly_rent"
                  value={contractForm.monthly_rent}
                  onChange={handleContractChange} className={INPUT} />
              </Field>
              <Field label="Phí dịch vụ (đ/tháng)">
                <FormattedNumberInput name="service_fee"
                  value={contractForm.service_fee}
                  onChange={handleContractChange} placeholder="0" className={INPUT} />
              </Field>
              <Field label="Tiền đặt cọc (đ)">
                <FormattedNumberInput name="deposit"
                  value={contractForm.deposit}
                  onChange={handleContractChange} className={INPUT} />
              </Field>
              <Field label="Hạn thanh toán (Ngày)" hint="Nhập ngày khách thuê phải đóng tiền hàng tháng (VD: 1 là ngày đầu tiên kể từ ngày xuất bill)">
                <NumericInput 
                  name="payment_day"
                  min={1}
                  max={31}
                  value={contractForm.payment_day}
                  onChange={handleContractChange}
                  className={INPUT}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số người thuê">
                <NumericInput 
                  name="num_tenants"
                  min={1}
                  value={contractForm.num_tenants}
                  onChange={handleContractChange}
                  className={INPUT}
                />
              </Field>
              <Field label="Số lượng xe">
                <NumericInput 
                  name="num_vehicles"
                  min={0}
                  value={contractForm.num_vehicles}
                  onChange={handleContractChange}
                  className={INPUT}
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input name="temp_residence_reg" type="checkbox"
                checked={contractForm.temp_residence_reg}
                onChange={handleContractChange}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">Đăng ký tạm trú</span>
            </label>
          </Section>

          {/* 3. Chỉ số điện/nước ban đầu (tuỳ chọn) */}
          {utilityId && (
            <Section title="Số điện / nước ban đầu">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số điện ban đầu (kWh)">
                  <NumericInput 
                    name="electric_reading"
                    min={0}
                    value={utilityForm.electric_reading}
                    onChange={handleUtilityChange}
                    className={INPUT}
                  />
                </Field>
                {isWaterMeter && (
                  <Field label="Số nước ban đầu (m³)">
                    <NumericInput 
                      name="water_reading"
                      min={0}
                      value={utilityForm.water_reading}
                      onChange={handleUtilityChange}
                      className={INPUT}
                    />
                  </Field>
                )}
              </div>
              <p className="text-xs text-gray-400">Chỉ số này ghi nhận mốc bắt đầu của hợp đồng. Cần sửa nếu số điện/nước ban đầu bị nhập sai.</p>
            </Section>
          )}

          {/* 4. Đơn giá điện/nước (tuỳ chọn) */}
          <Section title="Đơn giá điện / nước">
            <label className="flex items-center gap-3 cursor-pointer">
              <input name="updateRate" type="checkbox"
                checked={rateForm.updateRate} onChange={handleRateChange}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700 font-medium">
                Cập nhật đơn giá mới
              </span>
            </label>

            {rateForm.updateRate && (
              <div className="space-y-3 pl-1">
                <p className="text-xs text-gray-400">
                  Giá cũ vẫn được giữ lại để đối chiếu lịch sử. Giá mới sẽ áp dụng
                  từ ngày hiệu lực trở đi.
                </p>

                <Field label="Ngày hiệu lực" hint="Ngày bắt đầu áp dụng đơn giá mới">
                  <VNDateInput 
                    name="effective_from"
                    value={rateForm.effective_from}
                    onChange={handleRateChange}
                    className={INPUT}
                  />
                </Field>

                <Field label="Giá điện (đ/kWh)">
                  <FormattedNumberInput name="electric_price"
                    value={rateForm.electric_price} onChange={handleRateChange}
                    placeholder="vd: 3,500" className={INPUT} />
                </Field>

                {isWaterMeter ? (
                  <Field label="Giá nước (đ/m³)">
                    <FormattedNumberInput name="water_price"
                      value={rateForm.water_price} onChange={handleRateChange}
                      placeholder="vd: 15000" className={INPUT} />
                  </Field>
                ) : (
                  <Field label="Tiền nước cố định/tháng (đ)">
                    <FormattedNumberInput name="default_water_amount"
                      value={rateForm.default_water_amount} onChange={handleRateChange}
                      placeholder="vd: 20000" className={INPUT} />
                  </Field>
                )}
              </div>
            )}
          </Section>

          

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}
        </form>

        <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                       font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
            Huỷ
          </button>
          <button disabled={loading}
            onClick={(e) => {
              e.currentTarget.closest(".fixed").querySelector("form").requestSubmit();
            }}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                       disabled:bg-blue-300 text-white rounded-xl text-sm
                       font-medium transition">
            {loading ? (submitStep || "Đang lưu...") : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}