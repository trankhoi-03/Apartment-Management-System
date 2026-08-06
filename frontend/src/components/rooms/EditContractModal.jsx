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

export default function EditContractModal({ contract, room, onClose, onSaved }) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [submitStep, setSubmitStep] = useState("");
  const isWaterMeter = room?.is_water_meter ?? contract?.room?.is_water_meter;

  // Tenant fields 
  const [tenant, setTenant] = useState({
    full_name: "", phone: "", email: "", id_card_number: "",
  });

  // Contract fields
  const [contractForm, setContractForm] = useState({
    monthly_rent: "", deposit: "", end_date: "",
    num_tenants: 1, num_vehicles: 0, temp_residence_reg: false,
  });

  // Đơn giá điện/nước (optional — chỉ tạo record mới nếu chủ trọ nhập) 
  const [rateForm, setRateForm] = useState({
    electric_price: "", water_price: "", default_water_amount: "",
    effective_from: new Date().toISOString().slice(0, 10), 
    updateRate: false,  
  });

  useEffect(() => {
    if (!contract) return;
    setTenant({
      full_name:      contract.tenant?.full_name      ?? "",
      phone:          contract.tenant?.phone          ?? "",
      email:          contract.tenant?.email          ?? "",
      id_card_number: contract.tenant?.id_card_number ?? "",
    });
    setContractForm({
      monthly_rent:       contract.monthly_rent       ?? "",
      deposit:            contract.deposit            ?? "",
      end_date:           contract.end_date           ?? "",
      num_tenants:        contract.num_tenants        ?? 1,
      num_vehicles:       contract.num_vehicles       ?? 0,
      temp_residence_reg: contract.temp_residence_reg ?? false,
    });
  }, [contract]);

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
      // Bước 1: Cập nhật người thuê 
      setSubmitStep("Đang cập nhật người thuê...");
      await api.patch(`/tenants/${contract.tenant_id}`, {
        full_name: tenant.full_name,
        phone:     tenant.phone,
        ...(tenant.email          && { email: tenant.email }),
        ...(tenant.id_card_number && { id_card_number: tenant.id_card_number }),
      });

      // Bước 2: Cập nhật hợp đồng 
      setSubmitStep("Đang cập nhật hợp đồng...");
      await api.patch(`/contracts/${contract.id}`, {
        monthly_rent:       Number(contractForm.monthly_rent),
        deposit:            Number(contractForm.deposit) || 0,
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
              <Field label="CCCD/CMND">
                <input name="id_card_number" value={tenant.id_card_number}
                  onChange={handleTenantChange} placeholder="—" className={INPUT} />
              </Field>
            </div>
            <Field label="Email">
              <input name="email" type="email" value={tenant.email}
                onChange={handleTenantChange} placeholder="—" className={INPUT} />
            </Field>
          </Section>

          {/* 2. Thông tin hợp đồng */}
          <Section title="Thông tin hợp đồng">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiền thuê (đ/tháng)">
                <input name="monthly_rent" type="number" min="0"
                  value={contractForm.monthly_rent}
                  onChange={handleContractChange} className={INPUT} />
              </Field>
              <Field label="Tiền đặt cọc (đ)">
                <input name="deposit" type="number" min="0"
                  value={contractForm.deposit}
                  onChange={handleContractChange} className={INPUT} />
              </Field>
            </div>
            <Field label="Ngày kết thúc">
              <input name="end_date" type="date" value={contractForm.end_date}
                onChange={handleContractChange} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số người thuê">
                <input name="num_tenants" type="number" min="1"
                  value={contractForm.num_tenants}
                  onChange={handleContractChange} className={INPUT} />
              </Field>
              <Field label="Số lượng xe">
                <input name="num_vehicles" type="number" min="0"
                  value={contractForm.num_vehicles}
                  onChange={handleContractChange} className={INPUT} />
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

          {/* 3. Đơn giá điện/nước (tuỳ chọn) */}
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
                  <input name="effective_from" type="date"
                    value={rateForm.effective_from} onChange={handleRateChange}
                    className={INPUT} />
                </Field>

                <Field label="Giá điện (đ/kWh)">
                  <input name="electric_price" type="number" min="0"
                    value={rateForm.electric_price} onChange={handleRateChange}
                    placeholder="vd: 3500" className={INPUT} />
                </Field>

                {isWaterMeter ? (
                  <Field label="Giá nước (đ/m³)">
                    <input name="water_price" type="number" min="0"
                      value={rateForm.water_price} onChange={handleRateChange}
                      placeholder="vd: 15000" className={INPUT} />
                  </Field>
                ) : (
                  <Field label="Tiền nước cố định/tháng (đ)">
                    <input name="default_water_amount" type="number" min="0"
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