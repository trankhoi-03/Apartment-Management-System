import { useState, useEffect } from "react";
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


function VNDateInput({ name, value, onChange, required }) {
  const [inputType, setInputType] = useState("text");

  const displayValue = value ? value.split("-").reverse().join("/") : "";

  return (
    <input
      name={name}
      type={inputType}
      value={inputType === "date" ? value : displayValue}
      onChange={onChange}
      onFocus={() => setInputType("date")}
      onBlur={() => setInputType("text")}
      placeholder="dd/mm/yyyy"
      required={required}
      className={INPUT}
    />
  );
}

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

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

// eslint-disable-next-line no-unused-vars
const INIT = (room) => ({
  // Thông tin người thuê (tạo mới) 
  full_name: "",
  phone: "",
  email: "",
  id_card_number: "",

  // Hợp đồng 
  start_date: "",
  end_date: "",
  monthly_rent: "",
  service_fee: "",
  deposit: "",
  payment_day: 5,
  num_tenants: 1,
  num_vehicles: 0,
  temp_residence_reg: false,

  // Đơn giá điện/nước 
  electric_price: "",
  water_price: "",
  default_water_amount: "",

  // Số điện/nước ban đầu
  electric_reading: "",
  water_reading: "",
  
  // Ghi chú / Nội thất 
  notes: "",
});

export default function ContractFormModal({ room, onClose, onSaved }) {
  const [form, setForm]         = useState(() => INIT(room));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [submitStep, setSubmitStep] = useState("");

  const [loadingUtility, setLoadingUtility] = useState(false);

  useEffect(() => {
    let isMounted = true; // Cờ kiểm soát trạng thái của component

    const fetchUtilityData = () => {
      setLoadingUtility(true);
      
      api.get(`/utility?room_id=${room.id}`)
        .then((res) => {
          if (!isMounted) return; // Chặn update state nếu component đã unmount

          if (res.data && res.data.length > 0) {
            const latestUtility = res.data.sort((a, b) =>
              b.billing_month.localeCompare(a.billing_month)
            )[0];
            
            setForm((prev) => ({
              ...prev,
              electric_reading: latestUtility.electric_new,
              water_reading: latestUtility.water_new,
            }));
          } else {
            setForm((prev) => ({
              ...prev,
              electric_reading: 0,
              water_reading: 0,
            }));
          }
        })
        .catch(() => {
          if (isMounted) console.error("Không thể tải lịch sử điện nước");
        })
        .finally(() => {
          if (isMounted) setLoadingUtility(false);
        });
    };

    if (room?.id) {
      fetchUtilityData();
    }

    return () => {
      isMounted = false;
    };
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
      // Bước 1: Tìm hoặc Tạo người thuê 
      setSubmitStep("Đang kiểm tra thông tin người thuê...");
      
      const existingTenantsRes = await api.get("/tenants");
      
      const existingTenant = existingTenantsRes.data.find(
        (t) => t.phone === form.phone || 
               (form.id_card_number && t.id_card_number === form.id_card_number)
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
      
      // Bước 2: Tạo hợp đồng 
      setSubmitStep("Đang tạo hợp đồng...");
      const contractRes = await api.post("/contracts", {
        room_id:            room.id,
        tenant_id:          tenantId,
        start_date:         form.start_date,
        monthly_rent:       Number(form.monthly_rent),
        service_fee:        form.service_fee ? Number(form.service_fee) : 0,
        deposit:            form.deposit ? Number(form.deposit) : 0,
        num_tenants:        Number(form.num_tenants),
        num_vehicles:       Number(form.num_vehicles),
        payment_day:        Number(form.payment_day),
        temp_residence_reg: form.temp_residence_reg,
        notes:              form.notes, // Gửi dữ liệu ghi chú xuống Backend
        ...(form.end_date && { end_date: form.end_date }),
      });

      const newContractId = contractRes.data.id; // Lưu lại ID hợp đồng vừa tạo

      // Bước 3: Khai báo đơn giá điện/nước 
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

      // Bước 4: Lưu số điện/nước ban đầu 
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

          const fileRes = await api.get(`/contracts/${newContractId}/export-word`, { 
            params: exportParams,
            responseType: "blob" 
          });
          
          const url = window.URL.createObjectURL(new Blob([fileRes.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `HopDong_Phong_${room.room_number}.docx`);
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
        } catch {
          alert("Không thể tải file hợp đồng. Bạn có thể xuất lại sau ở mục Quản lý phòng.");
        }
      }

      onSaved();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin."
      );
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
              <input name="full_name" value={form.full_name} onChange={handleChange}
                required placeholder="Nguyễn Văn A" className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số điện thoại" required>
                <input name="phone" value={form.phone} onChange={handleChange}
                  required placeholder="0912345678" className={INPUT} />
              </Field>
              <Field label="Email" hint="Dùng để nhận bill hàng tháng" required>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  required placeholder="example@gmail.com" className={INPUT} />
              </Field>
            </div>
          </Section>

          {/* 2. Thông tin hợp đồng */}
          <Section title="Thông tin hợp đồng">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày bắt đầu" required>
                <VNDateInput
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  required
                />
              </Field>
              <Field label="Ngày kết thúc">
                <VNDateInput
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiền thuê (đ/tháng)" required>
                <FormattedNumberInput 
                  name="monthly_rent" 
                  value={form.monthly_rent} 
                  onChange={handleChange}
                  required 
                  className={INPUT} 
                />
              </Field>
              <Field label="Phí dịch vụ (đ/tháng)">
                <FormattedNumberInput 
                  name="service_fee" 
                  value={form.service_fee} 
                  onChange={handleChange}
                  placeholder="0" 
                  className={INPUT} 
                />
              </Field>
              <Field label="Tiền đặt cọc (đ)">
                <FormattedNumberInput 
                  name="deposit" 
                  value={form.deposit} 
                  onChange={handleChange}
                  placeholder="0" 
                  className={INPUT} 
                />
              </Field>
              <Field 
                label="Hạn thanh toán (Ngày)" 
                required
                hint="Nhập ngày khách thuê phải đóng tiền hàng tháng (VD: 5 là ngày 5 hàng tháng)"
              >
                <input 
                  name="payment_deadline" 
                  type="number" 
                  min="1" 
                  max="31"
                  value={form.payment_deadline} 
                  onChange={handleChange}
                  required
                  className={INPUT} 
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số người thuê" required>
                <input name="num_tenants" type="number" min="1"
                  value={form.num_tenants} onChange={handleChange}
                  required className={INPUT} />
              </Field>
              <Field label="Số lượng xe">
                <input name="num_vehicles" type="number" min="0"
                  value={form.num_vehicles} onChange={handleChange}
                  className={INPUT} />
              </Field>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input name="temp_residence_reg" type="checkbox"
                checked={form.temp_residence_reg} onChange={handleChange}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm text-gray-700">Đăng ký tạm trú</span>
            </label>
          </Section>

          {/* 3. Đơn giá điện/nước */}
          <Section title="Đơn giá điện / nước">
            {room?.is_water_meter ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giá điện (đ/kWh)" required>
                  <FormattedNumberInput 
                    name="electric_price" 
                    value={form.electric_price} 
                    onChange={handleChange}
                    placeholder="vd: 3,500" 
                    required 
                    className={INPUT} 
                  />
                </Field>
                <Field label="Giá nước (đ/m³)" required>
                  <FormattedNumberInput 
                    name="water_price" 
                    value={form.water_price} 
                    onChange={handleChange}
                    placeholder="vd: 15,000" 
                    required 
                    className={INPUT} 
                  />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Giá điện (đ/kWh)" required>
                  <FormattedNumberInput 
                    name="electric_price" 
                    value={form.electric_price} 
                    onChange={handleChange}
                    placeholder="vd: 3,500" 
                    required 
                    className={INPUT} 
                  />
                </Field>
                <Field label="Tiền nước cố định/tháng (đ)" required
                  hint="Phòng không có đồng hồ nước — nhập số tiền cố định tính mỗi tháng">
                  <FormattedNumberInput 
                    name="default_water_amount" 
                    value={form.default_water_amount} 
                    onChange={handleChange}
                    placeholder="vd: 20,000" 
                    required 
                    className={INPUT} 
                  />
                </Field>
              </>
            )}
          </Section>

          {/* 4. Số điện/nước ban đầu */}
          <Section title="Số điện / nước ban đầu">
            <Field 
              label={
                <>
                  Số điện ban đầu (kWh)
                  {loadingUtility && <span className="ml-2 text-blue-500 font-normal">(Đang tải...)</span>}
                </>
              } 
              required
              hint="Số chốt cuối cùng đã được điền tự động, có thể chỉnh sửa nếu có sai lệch."
            >
              <input 
                name="electric_reading" 
                type="number" 
                min="0"
                value={form.electric_reading} 
                onChange={handleChange}
                className={INPUT} 
              />
            </Field>
            {room?.is_water_meter && (
              <Field 
                label={
                  <>
                    Số nước ban đầu (m³)
                    {loadingUtility && <span className="ml-2 text-blue-500 font-normal">(Đang tải...)</span>}
                  </>
                } 
                required
                hint="Số chốt cuối cùng đã được điền tự động, có thể chỉnh sửa nếu có sai lệch."
              >
                <input 
                  name="water_reading" 
                  type="number" 
                  min="0"
                  value={form.water_reading} 
                  onChange={handleChange}
                  className={INPUT} 
                />
              </Field>
            )}
          </Section>

          {/* 5. Ghi chú */}
          <Section title="Ghi chú">
            <Field label="Ghi chú hợp đồng / Nội thất" hint="Ghi chú lại tình trạng nội thất hoặc các thoả thuận riêng với khách thuê...">
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="VD: Khách không lấy nệm, đã chuyển nệm sang phòng số 2..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
              />
            </Field>
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
          <button
            disabled={loading}
            onClick={(e) => {
              e.currentTarget.closest(".fixed")
                .querySelector("form")
                .requestSubmit();
            }}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                       disabled:bg-blue-300 text-white rounded-xl text-sm
                       font-medium transition">
            {loading ? (submitStep || "Đang xử lý...") : "Tạo hợp đồng"}
          </button>
        </div>
      </div>
    </div>
  );
}