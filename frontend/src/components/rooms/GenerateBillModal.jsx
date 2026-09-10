import { useState, useEffect } from "react";
import api from "../../api/axios";

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500`;

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
    m = 1; year += 1;
  }
  return `${year}-${String(m).padStart(2, "0")}`;
}

function calculateDueDate(monthStr, paymentDay, startDateStr) {
  if (!monthStr) return { formattedVN: "", isoDate: "" };
  let [year, month] = monthStr.split("-").map(Number);
  
  let lastDayOfMonth = new Date(year, month, 0).getDate();
  let actualDay = paymentDay > lastDayOfMonth ? lastDayOfMonth : paymentDay;
  
  let dueDate = new Date(year, month - 1, actualDay);

  // Xử lý thông minh: Nếu ngày hạn thanh toán nằm TRƯỚC ngày bắt đầu hợp đồng
  // (Trường hợp xuất bill tháng đầu nhưng payment_day nhỏ hơn ngày dọn vào)
  if (startDateStr) {
    const startDate = new Date(startDateStr);
    // Xoá thời gian để so sánh thuần tuý theo ngày
    dueDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    if (dueDate < startDate) {
      // Đẩy hạn thanh toán sang tháng tiếp theo
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      lastDayOfMonth = new Date(year, month, 0).getDate();
      actualDay = paymentDay > lastDayOfMonth ? lastDayOfMonth : paymentDay;
    }
  }

  const dayStr = String(actualDay).padStart(2, "0");
  const monthStrFormatted = String(month).padStart(2, "0");
  
  return {
    formattedVN: `${dayStr}/${monthStrFormatted}/${year}`,
    isoDate: `${year}-${monthStrFormatted}-${dayStr}`
  };
}

export default function GenerateBillModal({ room, contract, onClose, onGenerated }) {
  const [billingMonth, setBillingMonth] = useState(""); 
  const [isFirstBill, setIsFirstBill]   = useState(false);
  const [serviceFee, setServiceFee]     = useState("");
  const [cleaningFee, setCleaningFee]   = useState("");
  const [internetFee, setInternetFee]   = useState("");
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
  const [error, setError]               = useState("");

  const paymentDay = contract?.payment_day || 5;
  const currentMonthStr = billingMonth || new Date().toISOString().slice(0, 7);
  const estimatedDueDate = calculateDueDate(currentMonthStr, paymentDay, contract?.start_date);

  useEffect(() => {
    if (!contract?.id) return;
    const contractStartMonth = contract.start_date.slice(0, 7);
    
    api.get(`/bills?contract_id=${contract.id}`)
      .then((res) => {
        if (res.data.length === 0) {
          setBillingMonth(contractStartMonth);
          setIsFirstBill(true); 
        } else {
          setIsFirstBill(false); 
          const latest = res.data.sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];
          if (latest.status === "pending") {
            setBillingMonth(latest.billing_month);
            setPreview(latest); 
          } else {
            setBillingMonth(getNextMonth(latest.billing_month));
          }
        }
      })
      .catch(() => { setBillingMonth(contractStartMonth); setIsFirstBill(true); }); 
  }, [contract]);

  useEffect(() => {
    let isMounted = true;
    const fetchPreviousUtility = () => {
      if (!billingMonth || !room?.id) return;
      setLoadingPrev(true);
      setElectricOld(""); setWaterOld(""); setExistingUtilityId(null);

      api.get(`/utility?room_id=${room.id}`)
        .then((res) => {
          if (!isMounted) return;
          const exactMatch = res.data.find((r) => r.billing_month === billingMonth);

          if (exactMatch) {
            setExistingUtilityId(exactMatch.id);
            setElectricOld(String(exactMatch.electric_old));
            if (room?.is_water_meter) setWaterOld(String(exactMatch.water_old));
          } else {
            const prev = res.data.filter((r) => r.billing_month < billingMonth)
              .sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];
            if (prev) {
              setElectricOld(String(prev.electric_new));
              if (room?.is_water_meter) setWaterOld(String(prev.water_new));
            }
          }
        })
        .catch(() => {})
        .finally(() => { if (isMounted) setLoadingPrev(false); });
    };

    fetchPreviousUtility();
    return () => { isMounted = false; };
  }, [billingMonth, room?.id, room?.is_water_meter]);

  useEffect(() => {
    if (contract) {
      if (contract.service_fee) setServiceFee(contract.service_fee);
      if (contract.cleaning_fee) setCleaningFee(contract.cleaning_fee);
      if (contract.internet_fee) setInternetFee(contract.internet_fee);
    }
  }, [contract]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Number(electricNew) < Number(electricOld)) { setError("Lỗi: Số điện mới không được nhỏ hơn số điện cũ."); return; }
    if (room?.is_water_meter && Number(waterNew) < Number(waterOld)) { setError("Lỗi: Số nước mới không được nhỏ hơn số nước cũ."); return; }

    const confirmMessage = `XÁC NHẬN SỐ LIỆU THÁNG ${billingMonth}:\n\n`
                       + `- Số điện mới: ${electricNew}\n`
                       + (room?.is_water_meter ? `- Số nước mới: ${waterNew}\n` : "")
                       + `- Phí dịch vụ: ${serviceFee ? serviceFee : "0"} đ\n`
                       + `- Phí vệ sinh: ${cleaningFee ? cleaningFee : "0"} đ\n`
                       + `- Phí internet: ${internetFee ? internetFee : "0"} đ\n`
                       + `- Phí phát sinh: ${additionalFee ? additionalFee : "0"} đ\n`
                       + (additionalFeeReason ? `- Lý do phát sinh: ${additionalFeeReason}\n` : "")
                       + `- Hạn thanh toán: ${estimatedDueDate.formattedVN} (Ngày ${paymentDay} hàng tháng)\n\n`
                       + `Vui lòng kiểm tra kỹ. Bấm "OK" để tính tiền.`;
                         
    if (!window.confirm(confirmMessage)) return; 

    setLoading(true);
    try {
      const utilityPayload = {
        room_id:       room.id,
        billing_month: billingMonth,
        electric_old:  Number(electricOld),
        electric_new:  Number(electricNew),
        water_old:     room.is_water_meter ? Number(waterOld) : 0,
        water_new:     room.is_water_meter ? Number(waterNew) : 0,
      };

      if (existingUtilityId) await api.put(`/utility/${existingUtilityId}`, utilityPayload); 
      else await api.post("/utility", utilityPayload);

      const res = await api.post("/bills/generate", {
        contract_id:   contract.id,
        billing_month: billingMonth,
        service_fee:   serviceFee ? Number(serviceFee) : 0,
        cleaning_fee:  cleaningFee ? Number(cleaningFee) : 0,
        internet_fee:  internetFee ? Number(internetFee) : 0,
        additional_fee: additionalFee ? Number(additionalFee) : 0, 
        additional_fee_reason: additionalFeeReason,
        due_date: estimatedDueDate.isoDate
      });
      setPreview(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Có lỗi xảy ra. Vui lòng kiểm tra lại.");
    } finally { setLoading(false); }
  }

  const displayDueDate = preview?.due_date 
    ? new Date(preview.due_date).toLocaleDateString("vi-VN") 
    : calculateDueDate(preview?.billing_month || currentMonthStr, paymentDay).formattedVN;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">

        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Xuất hoá đơn</h2>
          <p className="text-sm text-gray-500 mt-0.5">Phòng {room?.room_number} — {contract?.tenant?.full_name}</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {!preview ? (
            <form id="bill-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                <span>⏰</span>
                <span>Hạn thanh toán: <strong>Ngày {paymentDay} hàng tháng</strong> (hạn chót kỳ này là <strong>{estimatedDueDate.formattedVN}</strong>).</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tháng xuất bill</label>
                <input type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} required disabled={!isFirstBill} className={`${INPUT} ${!isFirstBill ? "bg-gray-100 cursor-not-allowed text-gray-600 font-medium" : "bg-white hover:border-blue-400"}`} />
                <p className={`text-xs mt-1 ${isFirstBill ? "text-blue-500 font-medium" : "text-gray-400"}`}>{isFirstBill ? " Đây là hoá đơn đầu tiên, bạn có thể tuỳ chỉnh tháng." : "Tháng đã được tính toán tự động."}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">⚡ Điện (kWh)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Số cũ {loadingPrev && <span className="text-blue-400">(đang tải...)</span>}</label>
                    <FormattedNumberInput name="electric_old" value={electricOld} onChange={(e) => setElectricOld(e.target.value)} placeholder="vd: 100" className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Số mới</label>
                    <FormattedNumberInput name="electric_new" value={electricNew} onChange={(e) => setElectricNew(e.target.value)} placeholder="vd: 150" className={INPUT} />
                  </div>
                </div>
              </div>

              {room?.is_water_meter && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">💧 Nước (m³)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Số cũ</label>
                      <FormattedNumberInput name="water_old" value={waterOld} onChange={(e) => setWaterOld(e.target.value)} placeholder="vd: 20" className={INPUT} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Số mới</label>
                      <FormattedNumberInput name="water_new" value={waterNew} onChange={(e) => setWaterNew(e.target.value)} placeholder="vd: 25" className={INPUT} />
                    </div>
                  </div>
                </div>
              )}

              {/* KHU VỰC CÁC LOẠI PHÍ (SẮP XẾP LẠI GRID GỌN GÀNG) */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Các khoản phí</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phí dịch vụ</label>
                    <FormattedNumberInput name="service_fee" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phí vệ sinh</label>
                    <FormattedNumberInput name="cleaning_fee" value={cleaningFee} onChange={(e) => setCleaningFee(e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phí internet</label>
                    <FormattedNumberInput name="internet_fee" value={internetFee} onChange={(e) => setInternetFee(e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phí phát sinh</label>
                    <FormattedNumberInput name="additional_fee" value={additionalFee} onChange={(e) => setAdditionalFee(e.target.value)} placeholder="0" className={INPUT} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lý do phát sinh</label>
                  <input type="text" value={additionalFeeReason} onChange={(e) => setAdditionalFeeReason(e.target.value)} placeholder="vd: Sửa ống nước" className={INPUT} />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <p className="font-semibold">Hạn thanh toán: {displayDueDate}</p>
                  <p className="text-amber-700 mt-0.5">Khách thuê cần thanh toán trước <strong>ngày {paymentDay} hàng tháng</strong>.</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <Row label="Tháng" value={preview.billing_month} />
                <Row label="Hạn thanh toán" value={<span className="text-red-600 font-semibold">{displayDueDate}</span>} />
                <Row label="Tiền thuê" value={`${Number(preview.rent_amount).toLocaleString("vi-VN")}đ`} />
                <Row label={`Điện (${preview.electric_consumed} kWh)`} value={`${Number(preview.electric_amount).toLocaleString("vi-VN")}đ`} />
                <Row label={preview.water_consumed > 0 ? `Nước (${preview.water_consumed} m³)` : "Nước (cố định)"} value={`${Number(preview.water_amount).toLocaleString("vi-VN")}đ`} />
                {Number(preview.service_fee) > 0 && <Row label="Phí dịch vụ" value={`${Number(preview.service_fee).toLocaleString("vi-VN")}đ`} />}
                {Number(preview.cleaning_fee) > 0 && <Row label="Phí vệ sinh" value={`${Number(preview.cleaning_fee).toLocaleString("vi-VN")}đ`} />}
                {Number(preview.internet_fee) > 0 && <Row label="Phí internet" value={`${Number(preview.internet_fee).toLocaleString("vi-VN")}đ`} />}
                {Number(preview.additional_fee) > 0 && <Row label={`Phát sinh ${preview.additional_fee_reason ? `(${preview.additional_fee_reason})` : ""}`} value={`${Number(preview.additional_fee).toLocaleString("vi-VN")}đ`} />}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                  <span>Tổng cộng</span><span className="text-blue-600">{Number(preview.total_amount).toLocaleString("vi-VN")}đ</span>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
              <button onClick={onGenerated} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Đóng (gửi email sau)</button>
            </div>
          )}
        </div>

        {!preview && (
          <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">Huỷ</button>
            <button disabled={loading} onClick={() => document.getElementById("bill-form").requestSubmit()} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition">{loading ? "Đang xử lý..." : "🧾 Tính tiền"}</button>
          </div>
        )}
      </div>
    </div>
  );
}