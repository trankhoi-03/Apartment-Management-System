import { useState, useEffect } from "react";
import api from "../../api/axios";


const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500`;

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function getNextMonth(monthStr) {
  let [year, m] = monthStr.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    year += 1;
  }
  return `${year}-${String(m).padStart(2, "0")}`;
}

export default function GenerateBillModal({ room, contract, onClose, onGenerated }) {
  const [billingMonth, setBillingMonth] = useState(""); 
  const [serviceFee, setServiceFee]     = useState("");
  const [additionalFee, setAdditionalFee]             = useState("");
  const [additionalFeeReason, setAdditionalFeeReason] = useState("");
  const [electricOld, setElectricOld]   = useState("");
  const [electricNew, setElectricNew]   = useState("");
  const [waterOld, setWaterOld]         = useState("");
  const [waterNew, setWaterNew]         = useState("");
  const [existingUtilityId, setExistingUtilityId] = useState(null);
  const [loadingPrev, setLoadingPrev]   = useState(false);
  const [preview, setPreview]           = useState(null);
  const [loading, setLoading]           = useState(false);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    if (!contract?.id) return;
    
    const contractStartMonth = contract.start_date.slice(0, 7);
    
    api.get(`/bills?contract_id=${contract.id}`)
      .then((res) => {
        if (res.data.length === 0) {
          setBillingMonth(contractStartMonth);
        } else {
          const latest = res.data.sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];
          
          if (latest.status === "pending") {
            setBillingMonth(latest.billing_month);
            setPreview(latest); 
          } else {
            setBillingMonth(getNextMonth(latest.billing_month));
          }
        }
      })
      .catch(() => setBillingMonth(contractStartMonth)); 
  }, [contract]);

  useEffect(() => {
    if (!billingMonth || !room?.id) return;
    setLoadingPrev(true);
    setElectricOld("");
    setWaterOld("");
    setExistingUtilityId(null);

    api.get(`/utility?room_id=${room.id}`)
      .then((res) => {
        const exactMatch = res.data.find((r) => r.billing_month === billingMonth);

        if (exactMatch) {
          // Trường hợp 1: Đã có bản ghi (ví dụ: tạo tự động lúc ký HĐ dọn vào)
          setExistingUtilityId(exactMatch.id);
          setElectricOld(String(exactMatch.electric_old));
          if (room.is_water_meter) setWaterOld(String(exactMatch.water_old));
        } else {
          // Trường hợp 2: Chưa có, tìm tháng liền trước để lấy số mới tháng đó làm số cũ tháng này
          const prev = res.data
            .filter((r) => r.billing_month < billingMonth)
            .sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];

          if (prev) {
            setElectricOld(String(prev.electric_new));
            if (room.is_water_meter) setWaterOld(String(prev.water_new));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrev(false));
  }, [billingMonth, room]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Number(electricNew) < Number(electricOld)) {
      setError("Lỗi: Số điện mới không được nhỏ hơn số điện cũ.");
      return;
    }
    if (room?.is_water_meter && Number(waterNew) < Number(waterOld)) {
      setError("Lỗi: Số nước mới không được nhỏ hơn số nước cũ.");
      return;
    }

    const confirmMessage = `XÁC NHẬN SỐ LIỆU THÁNG ${billingMonth}:\n\n`
                         + `- Số điện mới: ${electricNew}\n`
                         + (room?.is_water_meter ? `- Số nước mới: ${waterNew}\n` : "")
                         + `- Phí dịch vụ: ${serviceFee ? serviceFee : "0"} đ\n\n`
                         + `Vui lòng kiểm tra kỹ. Bấm "OK" để tính tiền.`;
                         
    if (!window.confirm(confirmMessage)) {
      return; 
    }

    setLoading(true);

    try {
      // Bước 1: Ghi số điện/nước tháng này 
      const utilityPayload = {
        room_id:       room.id,
        billing_month: billingMonth,
        electric_old:  Number(electricOld),
        electric_new:  Number(electricNew),
        water_old:     room.is_water_meter ? Number(waterOld) : 0,
        water_new:     room.is_water_meter ? Number(waterNew) : 0,
      };

      if (existingUtilityId) {
        // Nếu đã có bản ghi gốc (như tháng đầu tiên), dùng phương thức PUT để cập nhật
        await api.put(`/utility/${existingUtilityId}`, utilityPayload); 
      } else {
        // Nếu là tháng bình thường chưa có dữ liệu, dùng phương thức POST để tạo mới
        await api.post("/utility", utilityPayload);
      }

      // Bước 2: Generate bill
      const res = await api.post("/bills/generate", {
        contract_id:   contract.id,
        billing_month: billingMonth,
        service_fee:   serviceFee ? Number(serviceFee) : 0,
        additional_fee: additionalFee ? Number(additionalFee) : 0, 
        additional_fee_reason: additionalFeeReason
      });
      setPreview(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Có lỗi xảy ra. Vui lòng kiểm tra lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    setSending(true);
    setError("");
    try {
      await api.post(`/bills/${preview.id}/send`);
      onGenerated();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Gửi email thất bại.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Xuất hoá đơn</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Phòng {room?.room_number} — {contract?.tenant?.full_name}
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {!preview ? (
            <form id="bill-form" onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tháng xuất bill
                </label>
                <input type="month" value={billingMonth} required
                  className={`${INPUT} bg-gray-100 cursor-not-allowed text-gray-600 font-medium`} 
                  disabled />
                <p className="text-xs text-gray-400 mt-1">Tháng đã được tính toán tự động.</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  ⚡ Điện (kWh)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Số cũ {loadingPrev && <span className="text-blue-400">(đang tải...)</span>}
                    </label>
                    <input type="number" min="0" required
                      value={electricOld}
                      onChange={(e) => setElectricOld(e.target.value)}
                      placeholder="vd: 100"
                      className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Số mới</label>
                    <input type="number" min="0" required
                      value={electricNew}
                      onChange={(e) => setElectricNew(e.target.value)}
                      placeholder="vd: 150"
                      className={INPUT} />
                  </div>
                </div>
              </div>

              {room?.is_water_meter && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    💧 Nước (m³)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Số cũ</label>
                      <input type="number" min="0" required
                        value={waterOld}
                        onChange={(e) => setWaterOld(e.target.value)}
                        placeholder="vd: 20"
                        className={INPUT} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Số mới</label>
                      <input type="number" min="0" required
                        value={waterNew}
                        onChange={(e) => setWaterNew(e.target.value)}
                        placeholder="vd: 25"
                        className={INPUT} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phí dịch vụ (đ)
                  <span className="text-gray-400 font-normal ml-1">(tuỳ chọn)</span>
                </label>
                <input type="number" min="0" value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                  placeholder="vd: 50000" className={INPUT} />
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phí phát sinh (đ)
                  </label>
                  <input type="number" min="0" value={additionalFee}
                    onChange={(e) => setAdditionalFee(e.target.value)}
                    placeholder="vd: 150000" className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lý do phát sinh
                  </label>
                  <input type="text" value={additionalFeeReason}
                    onChange={(e) => setAdditionalFeeReason(e.target.value)}
                    placeholder="vd: Sửa ống nước" className={INPUT} />
                </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <Row label="Tháng" value={preview.billing_month} />
                <Row label="Tiền thuê"
                  value={`${Number(preview.rent_amount).toLocaleString("vi-VN")}đ`} />
                <Row label={`Điện (${preview.electric_consumed} kWh)`}
                  value={`${Number(preview.electric_amount).toLocaleString("vi-VN")}đ`} />
                <Row
                  label={preview.water_consumed > 0
                    ? `Nước (${preview.water_consumed} m³)`
                    : "Nước (cố định)"}
                  value={`${Number(preview.water_amount).toLocaleString("vi-VN")}đ`}
                />
                {Number(preview.service_fee) > 0 && (
                  <Row label="Phí dịch vụ"
                    value={`${Number(preview.service_fee).toLocaleString("vi-VN")}đ`} />
                )}
                {Number(preview.additional_fee) > 0 && (
                  <Row 
                    label={`Phát sinh ${preview.additional_fee_reason ? `(${preview.additional_fee_reason})` : ""}`}
                    value={`${Number(preview.additional_fee).toLocaleString("vi-VN")}đ`} 
                  />
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between
                                font-bold text-base">
                  <span>Tổng cộng</span>
                  <span className="text-blue-600">
                    {Number(preview.total_amount).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                  {error}
                </p>
              )}

              <button onClick={onGenerated}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl
                           text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Đóng (gửi email sau)
              </button>
            </div>
          )}
        </div>

        {!preview && (
          <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50
                         transition">
              Huỷ
            </button>
            <button disabled={loading}
              onClick={() => document.getElementById("bill-form").requestSubmit()}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                         disabled:bg-blue-300 text-white rounded-xl text-sm
                         font-medium transition">
              {loading ? "Đang xử lý..." : "🧾 Tính tiền"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}