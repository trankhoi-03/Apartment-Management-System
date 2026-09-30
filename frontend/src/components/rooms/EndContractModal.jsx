import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";

const INPUT = `w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-orange-400`;

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
        className={`${className} flex items-center justify-between gap-3 min-w-[200px] hover:border-orange-400 transition-colors`}
      >
        <span>📅 Tháng {String(currentMonth).padStart(2, "0")} năm {currentYear}</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-[280px] p-4 bg-white border border-gray-200 rounded-2xl shadow-xl right-0 sm:left-0 origin-top animate-fade-in">
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
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-200 ring-2 ring-orange-500 ring-offset-1' 
                      : 'bg-white text-gray-700 hover:bg-orange-50 hover:text-orange-600 border border-gray-100 hover:border-orange-200'
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

function calculateDueDate(monthStr, paymentDay, startDateStr, isFirstBill) {
  if (!monthStr) return { formattedVN: "", isoDate: "" };
  let [year, month] = monthStr.split("-").map(Number);
  let targetMonth = month;
  let targetYear = year;

  if (isFirstBill && startDateStr) {
    const startDate = new Date(startDateStr);
    const startDay = startDate.getDate();
    const startMonth = startDate.getMonth() + 1;
    const startYear = startDate.getFullYear();
    
    if (targetMonth === startMonth && targetYear === startYear) {
       if (startDay > paymentDay) {
           targetMonth += 1;
           if (targetMonth > 12) {
               targetMonth = 1;
               targetYear += 1;
           }
       }
    }
  }

  let lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
  let actualDay = paymentDay > lastDayOfMonth ? lastDayOfMonth : paymentDay;
  let dueDate = new Date(targetYear, targetMonth - 1, actualDay);

  if (startDateStr) {
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    if (dueDate < startDate) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
      actualDay = paymentDay > lastDayOfMonth ? lastDayOfMonth : paymentDay;
    }
  }

  const dayStr = String(actualDay).padStart(2, "0");
  const monthStrFormatted = String(targetMonth).padStart(2, "0");
  
  return {
    formattedVN: `${dayStr}/${monthStrFormatted}/${targetYear}`,
    isoDate: `${targetYear}-${monthStrFormatted}-${dayStr}`
  };
}

export default function EndContractModal({ room, contract, roomNumber, onClose, onEnded }) {
  const [endMode, setEndMode] = useState("normal"); // "normal" hoặc "checkout"
  const [reason, setReason] = useState("");
  
  const [billingMonth, setBillingMonth] = useState(""); 
  const [isFirstBill, setIsFirstBill]   = useState(false);
  const [rentAmount, setRentAmount]     = useState("");
  const [isAdjustingRent, setIsAdjustingRent]   = useState(false);
  const [daysStayed, setDaysStayed]             = useState("");
  const [fixedWaterAmount, setFixedWaterAmount] = useState("");
  const [serviceFee, setServiceFee]     = useState("");
  const [cleaningFee, setCleaningFee]   = useState("");
  const [internetFee, setInternetFee]   = useState("");
  const [additionalFee, setAdditionalFee]             = useState("");
  const [additionalFeeReason, setAdditionalFeeReason] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [electricOld, setElectricOld]   = useState("");
  const [electricNew, setElectricNew]   = useState("");
  const [waterOld, setWaterOld]         = useState("");
  const [waterNew, setWaterNew]         = useState("");
  const [existingUtilityId, setExistingUtilityId] = useState(null);
  const [loadingPrev, setLoadingPrev]   = useState(false);
  const [preview, setPreview]           = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const currentRoomId = room?.id ?? contract?.room_id;
  const isWaterMeter = room?.is_water_meter ?? contract?.room?.is_water_meter;

  const paymentDay = contract?.payment_day || 5;
  const currentMonthStr = billingMonth || new Date().toISOString().slice(0, 7);
  const estimatedDueDate = calculateDueDate(currentMonthStr, paymentDay, contract?.start_date, isFirstBill);

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
      if (!billingMonth || !currentRoomId) return;
      setLoadingPrev(true);
      setElectricOld(""); setWaterOld(""); setExistingUtilityId(null);

      api.get(`/utility?room_id=${currentRoomId}`)
        .then((res) => {
          if (!isMounted) return;
          const exactMatch = res.data.find((r) => r.billing_month === billingMonth);

          if (exactMatch) {
            setExistingUtilityId(exactMatch.id);
            setElectricOld(String(exactMatch.electric_old));
            if (isWaterMeter) setWaterOld(String(exactMatch.water_old));
          } else {
            const prev = res.data.filter((r) => r.billing_month < billingMonth)
              .sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];
            if (prev) {
              setElectricOld(String(prev.electric_new));
              if (isWaterMeter) setWaterOld(String(prev.water_new));
            }
          }
        })
        .catch(() => {})
        .finally(() => { if (isMounted) setLoadingPrev(false); });
    };

    fetchPreviousUtility();
    return () => { isMounted = false; };
  }, [billingMonth, currentRoomId, isWaterMeter]);

  useEffect(() => {
    if (contract) {
      if (contract.monthly_rent !== undefined && contract.monthly_rent !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRentAmount(String(contract.monthly_rent));
        setIsAdjustingRent(false);
        setDaysStayed("");
      }
      if (contract.service_fee) setServiceFee(contract.service_fee);
      if (contract.cleaning_fee) setCleaningFee(contract.cleaning_fee);
      if (contract.internet_fee) setInternetFee(contract.internet_fee);

      if (!isWaterMeter && currentRoomId) {
        if (contract.current_rate?.default_water_amount !== undefined) {
          setFixedWaterAmount(String(contract.current_rate.default_water_amount));
        } else {
          api.get(`/utility-rates?room_id=${currentRoomId}`)
            .then((res) => {
              if (res.data && res.data.length > 0) {
                const sortedRates = res.data.sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from));
                const current = sortedRates[0];
                if (current?.default_water_amount !== undefined) {
                  setFixedWaterAmount(String(current.default_water_amount));
                }
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [contract, currentRoomId, isWaterMeter]);

  useEffect(() => {
    if (!contract?.monthly_rent || !billingMonth) return;
    
    if (isAdjustingRent) {
      const [year, month] = billingMonth.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const days = Number(daysStayed);
      
      if (daysStayed !== "" && days >= 0 && days <= daysInMonth) {
        const adjusted = Math.round((Number(contract.monthly_rent) / daysInMonth) * days);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRentAmount(String(adjusted));
      }
    } else {
      if (contract.monthly_rent) {
        setRentAmount(String(contract.monthly_rent));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdjustingRent, daysStayed, billingMonth]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    
    if (endMode === "normal") {
      const confirmMsg = `XÁC NHẬN KẾT THÚC HỢP ĐỒNG:\n\n⚠️ Hành động này sẽ kết thúc hợp đồng và chuyển phòng về trạng thái Trống.\n(Chỉ dùng khi khách đã thanh toán đủ tiền kỳ cuối và không phát sinh hóa đơn chốt)\n\nBấm "OK" để hoàn tất.`;
      if (!window.confirm(confirmMsg)) return;

      setLoading(true);
      try {
        await api.patch(`/contracts/${contract.id}`, {
          status: "ended",
          ...(reason.trim() && { end_reason: reason.trim() }),
        });
        setPreview({ mode: "normal" });
      } catch (err) {
        setError(err.response?.data?.detail || "Có lỗi xảy ra.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Logic cho Xuất hóa đơn chốt
    if (Number(electricNew) < Number(electricOld)) { setError("Lỗi: Số điện mới không được nhỏ hơn số điện cũ."); return; }
    if (isWaterMeter && Number(waterNew) < Number(waterOld)) { setError("Lỗi: Số nước mới không được nhỏ hơn số nước cũ."); return; }

    const confirmMessage = `XÁC NHẬN KẾT THÚC HỢP ĐỒNG & CHỐT SỐ LIỆU THÁNG ${billingMonth}:\n\n`
                       + `- Tiền thuê: ${rentAmount ? Number(rentAmount).toLocaleString("vi-VN") : "0"} đ\n`
                       + `- Số điện mới: ${electricNew}\n`
                       + (isWaterMeter 
                           ? `- Số nước mới: ${waterNew}\n` 
                           : `- Tiền nước (cố định): ${fixedWaterAmount ? Number(fixedWaterAmount).toLocaleString("vi-VN") : "0"} đ\n`)
                       + `- Các phụ phí và giảm trừ đã được ghi nhận.\n\n`
                       + `⚠️ Hành động này sẽ kết thúc hợp đồng, chuyển phòng về trạng thái Trống và tạo một hóa đơn chốt.\n`
                       + `Vui lòng kiểm tra kỹ. Bấm "OK" để hoàn tất.`;
                         
    if (!window.confirm(confirmMessage)) return; 

    setLoading(true);
    try {
      const utilityPayload = {
        room_id:       currentRoomId,
        billing_month: billingMonth,
        electric_old:  Number(electricOld),
        electric_new:  Number(electricNew),
        water_old:     isWaterMeter ? Number(waterOld) : 0,
        water_new:     isWaterMeter ? Number(waterNew) : 0,
      };

      if (existingUtilityId) await api.put(`/utility/${existingUtilityId}`, utilityPayload); 
      else await api.post("/utility", utilityPayload);

      const res = await api.post("/bills/generate", {
        contract_id:        contract.id,
        billing_month:      billingMonth,
        rent_amount:        rentAmount ? Number(rentAmount) : 0,
        fixed_water_amount: !isWaterMeter ? (fixedWaterAmount ? Number(fixedWaterAmount) : 0) : undefined,
        service_fee:        serviceFee ? Number(serviceFee) : 0,
        cleaning_fee:       cleaningFee ? Number(cleaningFee) : 0,
        internet_fee:       internetFee ? Number(internetFee) : 0,
        additional_fee:     additionalFee ? Number(additionalFee) : 0, 
        additional_fee_reason: additionalFeeReason,
        discount_amount:    discountAmount ? Number(discountAmount) : 0,
        discount_reason:    discountReason,
        due_date:           estimatedDueDate.isoDate
      });
      
      await api.patch(`/contracts/${contract.id}`, {
        status: "ended",
        ...(reason.trim() && { end_reason: reason.trim() }),
      });
      
      setPreview({ ...res.data, mode: "checkout" });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Có lỗi xảy ra trong quá trình xử lý.");
    } finally { 
      setLoading(false); 
    }
  }

  const displayDueDate = preview?.due_date 
    ? new Date(preview.due_date).toLocaleDateString("vi-VN") 
    : estimatedDueDate.formattedVN;

  let daysInfo = "";
  if (preview && preview.mode === "checkout") {
    const contractRent = contract?.monthly_rent;
    const actualRent = Number(preview.rent_amount);
    
    if (contractRent && actualRent > 0 && actualRent < contractRent) {
      try {
        const [year, month] = preview.billing_month.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const rentPerDay = contractRent / daysInMonth;
        const inferredDays = Math.round(actualRent / rentPerDay);
        
        if (inferredDays > 0 && inferredDays < daysInMonth) {
          daysInfo = ` (Ở ${inferredDays} ngày)`;
        }
      } catch (e) {
        console.error("Lỗi khi tính toán số ngày ở", e);
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col my-auto max-h-[90vh]">

        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Kết thúc hợp đồng</h2>
          <p className="text-sm text-gray-500 mt-0.5">Phòng {roomNumber || room?.room_number} — {contract?.tenant?.full_name}</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {!preview ? (
            <form id="end-contract-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* Tab Tùy chọn */}
              <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl mb-2">
                <button
                  type="button"
                  onClick={() => setEndMode("normal")}
                  className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors ${endMode === "normal" ? "bg-white text-orange-600 shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Kết thúc thông thường
                </button>
                <button
                  type="button"
                  onClick={() => setEndMode("checkout")}
                  className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors ${endMode === "checkout" ? "bg-white text-orange-600 shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Xuất hóa đơn chốt
                </button>
              </div>

              {/* Lý do kết thúc */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Lý do kết thúc <span className="text-gray-400 font-normal ml-1">(không bắt buộc)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="vd: Hết hạn hợp đồng, chuyển đi..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                />
              </div>

              {endMode === "normal" && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 animate-fade-in">
                  <p className="text-sm text-orange-700 leading-relaxed">
                    👉 Tùy chọn này sử dụng khi khách <strong>đã thanh toán đủ</strong> tiền kỳ cuối, đã chốt xong công nợ ngoài hệ thống và không phát sinh hóa đơn điện nước cuối kỳ.
                  </p>
                </div>
              )}

              {endMode === "checkout" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tháng xuất bill chốt</label>
                    <VietnameseMonthPicker 
                      value={billingMonth} 
                      onChange={setBillingMonth} 
                      className={`w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white hover:border-orange-400`}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Hóa đơn cuối cùng trước khi khách rời đi.</p>
                  </div>

                  {/* Field Tiền thuê nhà & Chức năng Điều chỉnh */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tiền thuê nhà chốt (đ) <span className="text-red-500">*</span>
                    </label>
                    <FormattedNumberInput
                      name="rent_amount"
                      value={rentAmount}
                      onChange={(e) => setRentAmount(e.target.value)}
                      placeholder="Nhập tiền thuê nhà..."
                      required
                      className={INPUT}
                    />
                    
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAdjustingRent}
                          onChange={(e) => setIsAdjustingRent(e.target.checked)}
                          className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-orange-800">Điều chỉnh tiền phòng theo ngày ở</span>
                      </label>
                      
                      {isAdjustingRent && (
                        <div className="mt-3 pt-3 border-t border-orange-200/60 animate-fade-in">
                          <label className="block text-xs font-medium text-orange-700 mb-1">Số ngày ở thực tế</label>
                          <input
                            type="number"
                            min="0"
                            max="31"
                            value={daysStayed}
                            onChange={(e) => setDaysStayed(e.target.value)}
                            placeholder="vd: 10"
                            className={INPUT}
                          />
                          {daysStayed !== "" && billingMonth && (
                            <div className="mt-2.5 bg-white p-2.5 border border-orange-100 rounded-lg shadow-sm">
                              <p className="text-[11px] text-gray-600 leading-relaxed">
                                Tháng {billingMonth.split("-")[1]} có <strong>{new Date(billingMonth.split("-")[0], billingMonth.split("-")[1], 0).getDate()}</strong> ngày.
                                <br />
                                Hệ thống tính: ({Number(contract?.monthly_rent || 0).toLocaleString("vi-VN")}đ / {new Date(billingMonth.split("-")[0], billingMonth.split("-")[1], 0).getDate()}) × {daysStayed} = <strong className="text-orange-600 font-semibold">{Math.round((Number(contract?.monthly_rent || 0) / new Date(billingMonth.split("-")[0], billingMonth.split("-")[1], 0).getDate()) * Number(daysStayed)).toLocaleString("vi-VN")}đ</strong>
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Điện */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">⚡ Điện (kWh)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Số cũ {loadingPrev && <span className="text-orange-400">(đang tải...)</span>}</label>
                        <FormattedNumberInput name="electric_old" value={electricOld} onChange={(e) => setElectricOld(e.target.value)} placeholder="vd: 100" className={INPUT} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Số chốt cuối</label>
                        <FormattedNumberInput name="electric_new" value={electricNew} onChange={(e) => setElectricNew(e.target.value)} placeholder="vd: 150" className={INPUT} />
                      </div>
                    </div>
                  </div>

                  {/* Nước */}
                  {isWaterMeter ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">💧 Nước (m³)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Số cũ</label>
                          <FormattedNumberInput name="water_old" value={waterOld} onChange={(e) => setWaterOld(e.target.value)} placeholder="vd: 20" className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Số chốt cuối</label>
                          <FormattedNumberInput name="water_new" value={waterNew} onChange={(e) => setWaterNew(e.target.value)} placeholder="vd: 25" className={INPUT} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">💧 Nước (Cố định)</p>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tiền nước cố định (đ/tháng)</label>
                        <FormattedNumberInput
                          name="fixed_water_amount"
                          value={fixedWaterAmount}
                          onChange={(e) => setFixedWaterAmount(e.target.value)}
                          placeholder="vd: 100,000"
                          className={INPUT}
                        />
                      </div>
                    </div>
                  )}

                  {/* Các loại phí dịch vụ */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Các loại phí dịch vụ</p>
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
                      <input type="text" value={additionalFeeReason} onChange={(e) => setAdditionalFeeReason(e.target.value)} placeholder="vd: Hư hỏng đồ đạc..." className={INPUT} />
                    </div>

                    {/* Giảm trừ */}
                    <div className="mt-5 pt-3 border-t border-gray-100">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Giảm trừ</p>
                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Giảm trừ / Hoàn cọc (đ)</label>
                        <FormattedNumberInput name="discount_amount" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="vd: 500,000" className={INPUT} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nội dung giảm trừ</label>
                        <input type="text" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="vd: Trừ tiền cọc, Thỏa thuận riêng..." className={INPUT} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-start gap-2 animate-fade-in">
                <span className="text-base leading-none">✅</span>
                <div>
                  <p className="font-semibold text-green-700">Đã kết thúc hợp đồng</p>
                  <p className="text-green-600 mt-0.5">Phòng đã được cập nhật về trạng thái <strong>Trống</strong>{preview.mode === "checkout" ? " và hóa đơn chốt đã được tạo thành công." : "."}</p>
                </div>
              </div>

              {preview.mode === "checkout" && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 animate-fade-in">
                  <Row label="Tháng chốt" value={preview.billing_month} />
                  <Row 
                    label={<span>Tiền thuê{daysInfo && <span className="text-gray-400 font-medium ml-1 text-xs">{daysInfo}</span>}</span>} 
                    value={`${Number(preview.rent_amount).toLocaleString("vi-VN")}đ`} 
                  />
                  <Row label={`Điện (${preview.electric_consumed} kWh)`} value={`${Number(preview.electric_amount).toLocaleString("vi-VN")}đ`} />
                  <Row label={preview.water_consumed > 0 ? `Nước (${preview.water_consumed} m³)` : "Nước (cố định)"} value={`${Number(preview.water_amount).toLocaleString("vi-VN")}đ`} />
                  {Number(preview.service_fee) > 0 && <Row label="Phí dịch vụ" value={`${Number(preview.service_fee).toLocaleString("vi-VN")}đ`} />}
                  {Number(preview.cleaning_fee) > 0 && <Row label="Phí vệ sinh" value={`${Number(preview.cleaning_fee).toLocaleString("vi-VN")}đ`} />}
                  {Number(preview.internet_fee) > 0 && <Row label="Phí internet" value={`${Number(preview.internet_fee).toLocaleString("vi-VN")}đ`} />}
                  {Number(preview.additional_fee) > 0 && <Row label={`Phát sinh ${preview.additional_fee_reason ? `(${preview.additional_fee_reason})` : ""}`} value={`${Number(preview.additional_fee).toLocaleString("vi-VN")}đ`} />}
                  {Number(preview.discount_amount) > 0 && (
                    <Row 
                      label={`Giảm trừ ${preview.discount_reason ? `(${preview.discount_reason})` : ""}`} 
                      value={<span className="text-green-600 font-medium">-{Number(preview.discount_amount).toLocaleString("vi-VN")}đ</span>} 
                    />
                  )}
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                    <span>Tổng thanh toán</span><span className="text-orange-600">{Number(preview.total_amount).toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>
              )}
              
              <button onClick={onEnded} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Đóng (Hoàn tất)</button>
            </div>
          )}
        </div>

        {!preview && (
          <div className="p-5 border-t border-gray-100 flex-shrink-0 flex gap-3 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">Huỷ</button>
            <button disabled={loading} onClick={() => document.getElementById("end-contract-form").requestSubmit()} className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-medium transition shadow-sm">
              {loading ? "Đang xử lý..." : (endMode === "checkout" ? "Kết thúc & Xuất HĐ" : "Xác nhận kết thúc")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}