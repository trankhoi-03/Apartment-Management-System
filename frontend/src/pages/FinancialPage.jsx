import { useState, useEffect, useCallback } from 'react';
import api from "../api/axios";
import TabSection  from '../components/finance/TabSection';


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


export default function FinancialPage() {
  const [houses, setHouses] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState("");
  
  // Mặc định lấy tháng hiện tại (YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [utilInputs, setUtilInputs] = useState({
    total_electric_kwh: 0,
    total_electric_bill: 0,
    total_water_cube: 0,
    total_water_bill: 0
  });
  const [savingUtil, setSavingUtil] = useState(false);

  const [otherCostInputs, setOtherCostInputs] = useState({ amount: 0, reason: "" });
  const [savingOtherCost, setSavingOtherCost] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadHouses = useCallback(async () => {
    try {
      const res = await api.get("/houses");
      setHouses(res.data);
      if (res.data.length > 0) {
        setSelectedHouse(res.data[0].id); // Mặc định chọn nhà đầu tiên
      }
    } catch (error) {
      console.error("Lỗi tải danh sách nhà:", error);
    }
  }, []);

  // Fetch dữ liệu báo cáo tài chính dựa vào nhà & tháng
  const loadReport = useCallback(async () => {
    if (!selectedHouse) return;
    setLoading(true);
    try {
      const res = await api.get(`/reports/financial/${selectedHouse}?month=${selectedMonth}`);
      setReportData(res.data);
      if (res.data.utility_bill_input) {
        setUtilInputs(res.data.utility_bill_input);
      }
      if (res.data.other_cost_input) {
        setOtherCostInputs({
          amount: res.data.other_cost_input.other_house_cost || 0,
          reason: res.data.other_cost_input.other_house_cost_reason || ""
        });
      }
    } catch (error) {
      console.error("Lỗi tải báo cáo:", error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedHouse, selectedMonth]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadHouses(); }, [loadHouses]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReport(); }, [loadReport]);

  const handleSaveOtherCost = async () => {
    setSavingOtherCost(true);
    try {
      await api.post(`/reports/financial/${selectedHouse}/other-cost?month=${selectedMonth}`, {
        other_house_cost: Number(otherCostInputs.amount) || 0,
        other_house_cost_reason: otherCostInputs.reason
      });
      await loadReport();
      alert("Đã lưu chi phí khác!");
    } catch {
      alert("Có lỗi xảy ra khi lưu chi phí khác.");
    } finally {
      setSavingOtherCost(false);
    }
  };

  const handleSaveUtilityBills = async () => {
    setSavingUtil(true);
    try {
      await api.post(`/reports/financial/${selectedHouse}/monthly-cost?month=${selectedMonth}`, {
        total_electric_kwh: Number(utilInputs.total_electric_kwh) || 0,
        total_electric_bill: Number(utilInputs.total_electric_bill) || 0,
        total_water_cube: Number(utilInputs.total_water_cube) || 0,
        total_water_bill: Number(utilInputs.total_water_bill) || 0,
      });
      // Load lại report để thấy con số phân bổ mới nhất
      await loadReport(); 
      alert("Đã cập nhật bill nhà mạng và tính toán lại chi phí!");
    } catch {
      alert("Có lỗi xảy ra khi lưu chi phí.");
    } finally {
      setSavingUtil(false);
    }
  };

  const handleUtilInputChange = (e) => {
    const { name, value } = e.target;
    setUtilInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      
      const endpoint = `/data/export-finance?month=${selectedMonth}&house_id=${selectedHouse}`;
      const res = await api.get(endpoint, { responseType: "blob" });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      
      const houseName = selectedHouse === "all" 
        ? "Tất cả nhà trọ" 
        : houses.find((h) => h.id.toString() === selectedHouse)?.name || "Nha_Tro";
        
      link.setAttribute("download", `Báo Cáo Tài Chính ${houseName} ${selectedMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch {
      alert("Có lỗi xảy ra khi xuất file Excel từ hệ thống. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };
  

  const inputStyle = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-sans">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <h1 className="text-2xl font-bold text-gray-800">Báo cáo tài chính</h1>
          
          {houses.length > 0 && (
            <select
              value={selectedHouse}
              onChange={(e) => setSelectedHouse(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700"
            >
              <option value="all">🏢 Tất cả nhà trọ</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  🏠 {h.name} {h.address ? `- ${h.address}` : ""}
                </option>
              ))}
            </select>
          )}

          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700"
          />

          {reportData && (
            <button 
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-sm font-semibold transition shadow-sm flex items-center justify-center gap-2"
            >
              {isExporting ? "⏳ Đang xuất..." : "📊 Xuất Excel"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-gray-400 text-lg">Đang tổng hợp dữ liệu...</p>
        </div>
      ) : !reportData ? (
        <div className="text-center py-20 text-gray-400">
          <p>Không có dữ liệu báo cáo cho tháng này.</p>
        </div>
      ) : (
        <>
          {/* TỔNG LỢI NHUẬN */}
          <div className="mb-6 px-2">
            <p className="text-gray-500 text-sm font-medium mb-1">Lợi nhuận ròng tháng {selectedMonth}</p>
            <h2 className={`text-4xl font-extrabold ${reportData.net_profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {reportData.net_profit.toLocaleString('vi-VN')} VNĐ
            </h2>
          </div>

          <div className="space-y-2">
            {/* 1. Tiền thuê nhà (Doanh thu) */}
            <TabSection icon="💵" title="Tiền thuê nhà (Thu)" colorTheme="green" summaryAmount={reportData.rent_tab.total}>
              <table className="w-full text-left">
                <thead><tr className="border-b border-green-200"><th className="pb-2">Phòng</th><th className="pb-2 text-right">Số tiền</th></tr></thead>
                <tbody>
                  {reportData.rent_tab.details.map((d, i) => (
                    <tr key={i} className="border-b border-dashed border-green-200/50">
                      <td className="py-2">{d.room_name}</td>
                      <td className="py-2 text-right font-medium">{d.revenue.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabSection>

            <TabSection icon="💎" title="Phí dịch vụ & Phát sinh (Thu)" colorTheme="green" summaryAmount={reportData.other_revenue_tab.total}>
              {reportData.other_revenue_tab.details.length === 0 ? <p className="text-gray-500 italic">Không có khoản thu thêm.</p> : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-green-200">
                      <th className="pb-2">Phòng</th>
                      <th className="pb-2">Hạng mục thu</th>
                      <th className="pb-2 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.other_revenue_tab.details.map((d, i) => (
                      <tr key={i} className="border-b border-dashed border-green-200/50 hover:bg-green-50/50 transition-colors">
                        <td className="py-2">{d.room_name}</td>
                        <td className="py-2 font-medium text-gray-700">{d.item}</td>
                        <td className="py-2 text-right font-bold text-gray-800">{d.amount.toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabSection>

            {/* 2. Điện & Nước (Chi phí) */}
            <TabSection icon="⚡" title="Điện & Nước (Phân bổ chi phí)" colorTheme="blue" summaryAmount={-reportData.utilities_tab.total}>
              {selectedHouse !== 'all' && (
                <div className="bg-blue-100/50 p-4 rounded-xl mb-4 border border-blue-200/50">
                  <h4 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-wide">Nhập hoá đơn tổng từ công ty Điện/Nước</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tổng Số Điện (kWh)</label>
                      <input type="number" name="total_electric_kwh" value={utilInputs.total_electric_kwh} onChange={handleUtilInputChange} className={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tổng Tiền Điện (đ)</label>
                      <FormattedNumberInput 
                        name="total_electric_bill" 
                        value={utilInputs.total_electric_bill} 
                        onChange={handleUtilInputChange} 
                        className={inputStyle} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tổng Số Nước (m³)</label>
                      <input type="number" name="total_water_cube" value={utilInputs.total_water_cube} onChange={handleUtilInputChange} className={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tổng Tiền Nước (đ)</label>
                      <FormattedNumberInput 
                        name="total_water_bill" 
                        value={utilInputs.total_water_bill} 
                        onChange={handleUtilInputChange} 
                        className={inputStyle} 
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={handleSaveUtilityBills} disabled={savingUtil}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:bg-blue-300 shadow-sm"
                    >
                      {savingUtil ? "Đang xử lý..." : "Lưu & Tính toán chi phí"}
                    </button>
                  </div>
                </div>
              )}
              
              <table className="w-full text-left">
                <thead><tr className="border-b border-blue-200"><th className="pb-2">Phòng</th><th className="pb-2 text-right">Tiền điện</th><th className="pb-2 text-right">Tiền nước</th></tr></thead>
                <tbody>
                  {reportData.utilities_tab.details.map((d, i) => (
                    <tr key={i} className="border-b border-dashed border-blue-200/50">
                      <td className="py-2">{d.room_name}</td>
                      <td className="py-2 text-right">{d.electric_cost.toLocaleString('vi-VN')} đ</td>
                      <td className="py-2 text-right">{d.water_cost.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabSection>

            {/* 3. Sửa chữa & Bảo trì */}
            <TabSection icon="🔧" title="Sửa chữa & Bảo trì" colorTheme="orange" summaryAmount={-reportData.maintenance_tab.total}>
              {reportData.maintenance_tab.details.length === 0 ? <p className="text-gray-500 italic">Không có chi phí phát sinh.</p> : (
                <table className="w-full text-left">
                  <thead><tr className="border-b border-orange-200"><th className="pb-2">Phòng</th><th className="pb-2">Nội dung</th><th className="pb-2">Bên xử lý</th><th className="pb-2 text-right">Chi phí</th></tr></thead>
                  <tbody>
                    {reportData.maintenance_tab.details.map((d, i) => (
                      <tr key={i} className="border-b border-dashed border-orange-200/50">
                        <td className="py-2">{d.room_name}</td>
                        <td className="py-2">{d.description}</td>
                        <td className="py-2">
                          {d.handler_info ? (
                            <span className="text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-md text-xs border border-blue-100">
                              👷 {d.handler_info}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-sm">
                              — Chưa có thông tin
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right font-medium">{d.amount.toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabSection>

            {/* 4. Quản lý */}
            <TabSection icon="🧑‍💼" title="Nhân viên quản lý" colorTheme="purple" summaryAmount={-reportData.management_tab.total}>
              <table className="w-full text-left">
                <tbody>
                  {reportData.management_tab.details.map((d, i) => (
                    <tr key={i} className="border-b border-dashed border-purple-200/50">
                      <td className="py-2">{d.item}</td>
                      <td className="py-2 text-right font-medium">{d.amount.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabSection>

            {/* 5. Cost phòng */}
            <TabSection icon="🏢" title="Giá Cost (Vốn phòng)" colorTheme="gray" summaryAmount={-reportData.base_cost_tab.total}>
              <table className="w-full text-left">
                <thead><tr className="border-b border-gray-200"><th className="pb-2">Phòng</th><th className="pb-2 text-right">Cost Price</th></tr></thead>
                <tbody>
                  {reportData.base_cost_tab.details.map((d, i) => (
                    <tr key={i} className="border-b border-dashed border-gray-200/50">
                      <td className="py-2">{d.room_name}</td>
                      <td className="py-2 text-right font-medium">{d.amount.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabSection>

            {/* 6. Chi phí khác */}
            <TabSection icon="📝" title="Chi phí khác" colorTheme="teal" summaryAmount={-reportData.other_costs_tab.total}>
              {selectedHouse !== 'all' && (
                <div className="bg-teal-100/50 p-4 rounded-xl mb-4 border border-teal-200/50">
                  <h4 className="text-sm font-bold text-teal-800 mb-3 uppercase tracking-wide">Ghi nhận chi phí khác của nhà</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Lý do chi (Nội dung)</label>
                      <input 
                        type="text" 
                        value={otherCostInputs.reason} 
                        onChange={(e) => setOtherCostInputs({...otherCostInputs, reason: e.target.value})} 
                        placeholder="VD: Tiền rác công cộng, Sửa cổng nhà..." 
                        className={inputStyle} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Số tiền (đ)</label>
                      <FormattedNumberInput 
                        name="amount" 
                        value={otherCostInputs.amount} 
                        onChange={(e) => setOtherCostInputs({...otherCostInputs, amount: e.target.value})} 
                        placeholder="VD: 150000" 
                        className={inputStyle} 
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={handleSaveOtherCost} disabled={savingOtherCost}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition disabled:bg-teal-300 shadow-sm"
                    >
                      {savingOtherCost ? "Đang lưu..." : "Lưu chi phí"}
                    </button>
                  </div>
                </div>
              )}
              

              {/* BẢNG HIỂN THỊ */}
              {reportData.other_costs_tab.details.length === 0 ? <p className="text-gray-500 italic">Không có chi phí khác.</p> : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-teal-200">
                      <th className="pb-2">Nội dung chi</th>
                      <th className="pb-2 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.other_costs_tab.details.map((d, i) => (
                      <tr key={i} className="border-b border-dashed border-teal-200/50">
                        <td className="py-2 text-gray-800">{d.item}</td>
                        <td className="py-2 text-right font-medium text-gray-800">{d.amount.toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabSection>
          </div>
        </>
      )}
    </div>
  );
}