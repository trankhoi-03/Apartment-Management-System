import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from "../api/axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie } from 'recharts';

const formatYAxis = (tickItem) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(tickItem);

const CATEGORY_COLORS = {
  // CHI PHÍ (COST)
  'Tiền điện (Chi)':    '#1e3a8a',  
  'Tiền nước (Chi)':    '#0284c7',  
  'Sửa chữa':           '#ef4444',  
  'Vốn phòng':          '#f59e0b',  
  'Quản lý':            '#64748b',  
  'Chi phí khác':       '#8b5cf6', 
  'Chi phí Internet':   '#d946ef',  

  // DOANH THU (REVENUE)
  'Tiền thuê':          '#10b981',  
  'Tiền điện (Thu)':    '#0ea5e9',  
  'Tiền nước (Thu)':    '#2dd4bf',  
  'Phí dịch vụ':        '#84cc16', 
  'Phí phát sinh':      '#f43f5e',  
  'Phí vệ sinh':        '#06b6d4',  
  'Phí internet':       '#a855f7', 
};

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
        className={`${className} flex items-center justify-between gap-3 min-w-[200px] hover:border-blue-400 transition-colors`}
      >
        <span>📅 Tháng {String(currentMonth).padStart(2, "0")} năm {currentYear}</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-[280px] p-4 bg-white border border-gray-200 rounded-2xl shadow-xl right-0 sm:left-0 origin-top animate-fade-in">
          
          <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-xl p-1 border border-gray-100">
            <button
              type="button"
              onClick={() => setViewYear(viewYear - 1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-bold text-gray-800 text-sm tracking-wide">NĂM {viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear(viewYear + 1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition"
            >
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

function AccordionCard({ icon, title, colorTheme, summaryAmount, isOpen, onToggle }) {
  const themes = {
    green:  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', amount: 'text-emerald-700', hover: 'hover:border-emerald-400', active: 'ring-2 ring-emerald-400 border-emerald-400' },
    blue:   { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    amount: 'text-blue-700',    hover: 'hover:border-blue-400',   active: 'ring-2 ring-blue-400 border-blue-400' },
    orange: { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  amount: 'text-orange-700',  hover: 'hover:border-orange-400', active: 'ring-2 ring-orange-400 border-orange-400' },
    purple: { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200',  amount: 'text-purple-700',  hover: 'hover:border-purple-400', active: 'ring-2 ring-purple-400 border-purple-400' },
    gray:   { bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-200',    amount: 'text-gray-700',    hover: 'hover:border-gray-400',   active: 'ring-2 ring-gray-400 border-gray-400' },
    teal:   { bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-200',    amount: 'text-teal-700',    hover: 'hover:border-teal-400',   active: 'ring-2 ring-teal-400 border-teal-400' },
    lime:   { bg: 'bg-lime-100',    text: 'text-lime-700',    border: 'border-lime-200',    amount: 'text-lime-700',    hover: 'hover:border-lime-400',   active: 'ring-2 ring-lime-400 border-lime-400' },
    rose:   { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    amount: 'text-rose-700',    hover: 'hover:border-rose-400',   active: 'ring-2 ring-rose-400 border-rose-400' },
  };
  const currentTheme = themes[colorTheme] || themes.gray;
  const isPositive = summaryAmount > 0;
  const formattedAmount = Math.abs(summaryAmount).toLocaleString('vi-VN');
  const sign = isPositive ? "+" : (summaryAmount < 0 ? "-" : "");

  return (
    <button onClick={onToggle} className={`w-full bg-white rounded-2xl border shadow-sm overflow-hidden flex justify-between items-center p-4 sm:p-5 text-left transition-all duration-200 ${currentTheme.border} ${currentTheme.hover} ${isOpen ? currentTheme.active : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${currentTheme.bg}`}>{icon}</div>
        <h3 className={`font-bold text-[15px] sm:text-base ${currentTheme.text}`}>{title}</h3>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <span className={`font-extrabold text-[15px] sm:text-lg whitespace-nowrap ${currentTheme.amount}`}>{sign}{formattedAmount} đ</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-100 shadow-sm transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}>
          <svg className={`w-4 h-4 ${currentTheme.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </button>
  );
}

function DetailPanel({ title, colorTheme, children }) {
  const themes = {
    green:  { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-800' },
    blue:   { bg: 'bg-blue-50/50',    border: 'border-blue-200',    text: 'text-blue-800' },
    orange: { bg: 'bg-orange-50/50',  border: 'border-orange-200',  text: 'text-orange-800' },
    purple: { bg: 'bg-purple-50/50',  border: 'border-purple-200',  text: 'text-purple-800' },
    gray:   { bg: 'bg-gray-50',       border: 'border-gray-200',    text: 'text-gray-800' },
    teal:   { bg: 'bg-teal-50/50',    border: 'border-teal-200',    text: 'text-teal-800' },
    lime:   { bg: 'bg-lime-50/50',    border: 'border-lime-200',    text: 'text-lime-800' },
    rose:   { bg: 'bg-rose-50/50',    border: 'border-rose-200',    text: 'text-rose-800' },
  };
  const theme = themes[colorTheme] || themes.gray;
  return (
    <div className={`rounded-2xl border ${theme.border} ${theme.bg} p-4 sm:p-5 shadow-sm animate-fade-in w-full`}>
       <h4 className={`text-sm font-bold mb-4 uppercase tracking-wide border-b pb-2 ${theme.border} ${theme.text}`}>{title}</h4>
       <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export default function FinancialPage() {
  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [bills, setBills] = useState([]);

  const [selectedHouse, setSelectedHouse] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('overview');

  const [openTabs, setOpenTabs] = useState({
    rent: true, electric_rev: false, water_rev: false, service_rev: false, additional_rev: false, cleaning_rev: false, internet_rev: false,
    electric_cost: true, water_cost: true, maintenance: false, base_cost: false, management: false, other_costs: false
  });
  const toggleTab = (tab) => setOpenTabs(prev => ({ ...prev, [tab]: !prev[tab] }));

  const [utilInputs, setUtilInputs] = useState({ total_electric_kwh: 0, total_electric_bill: 0, total_water_cube: 0, total_water_bill: 0 });
  const [savingUtil, setSavingUtil] = useState(false);

  const [otherCostInputs, setOtherCostInputs] = useState({ amount: 0, reason: "" });
  const [savingOtherCost, setSavingOtherCost] = useState(false);
  const [internetInputs, setInternetInputs] = useState({ amount: 0 });
  const [savingInternet, setSavingInternet] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      const [housesRes, roomsRes, contractsRes, billsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/contracts").catch(() => ({ data: [] })),
        api.get("/bills").catch(() => ({ data: [] }))
      ]);
      setHouses(housesRes.data); setRooms(roomsRes.data); setContracts(contractsRes.data); setBills(billsRes.data);
      if (housesRes.data.length > 0) setSelectedHouse(housesRes.data[0].id.toString()); 
    } catch (error) { console.error("Lỗi tải dữ liệu cơ sở:", error); }
  }, []);

  const loadReport = useCallback(async () => {
    if (!selectedHouse) return;
    setLoading(true);
    try {
      const res = await api.get(`/reports/financial/${selectedHouse}?month=${selectedMonth}`);
      setReportData(res.data);
      if (res.data.utility_bill_input) setUtilInputs(res.data.utility_bill_input);
      if (res.data.other_cost_input) setOtherCostInputs({ amount: res.data.other_cost_input.other_house_cost || 0, reason: res.data.other_cost_input.other_house_cost_reason || "" });
      if (res.data.internet_cost_input) setInternetInputs({ amount: res.data.internet_cost_input.total_internet_cost || 0 });
    // eslint-disable-next-line no-unused-vars
    } catch (error) { setReportData(null); } finally { setLoading(false); }
  }, [selectedHouse, selectedMonth]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReport(); }, [loadReport]);

  const displayData = useMemo(() => {
    if (!reportData) return null;

    let rentDetails = reportData.rent_tab.details;
    
    let electricCostDetails = reportData.utilities_tab.details.filter(d => d.electric_cost > 0).map(d => ({ room_name: d.room_name, amount: d.electric_cost }));
    let waterCostDetails    = reportData.utilities_tab.details.filter(d => d.water_cost > 0).map(d => ({ room_name: d.room_name, amount: d.water_cost }));

    let serviceRevDetails    = reportData.other_revenue_tab.details.filter(d => d.item === 'Phí dịch vụ');
    let additionalRevDetails = reportData.other_revenue_tab.details.filter(d => d.item !== 'Phí dịch vụ');

    let maintDetails = reportData.maintenance_tab.details;
    let baseCostDetails = reportData.base_cost_tab.details;
    let mgmtDetails = reportData.management_tab.details;
    let otherCostDetails = reportData.other_costs_tab.details;

    if (selectedHouse !== "all" && selectedRoom !== "all") {
      const room = rooms.find(r => r.id.toString() === selectedRoom);
      if (room) {
        const exact1 = `Phòng ${room.room_number}`;
        const prefix1 = `Phòng ${room.room_number} -`;
        const prefix2 = `P.${room.room_number} -`;
        
        const filterByRoomName = (list) => list.filter(d => {
          const name = d.room_name || "";
          return name === exact1 || name.startsWith(prefix1) || name.startsWith(prefix2);
        });

        const filterByItemName = (list) => list.filter(d => {
          const name = d.item || "";
          return name === exact1 || name.startsWith(`${exact1} `) || name.startsWith(`${exact1}-`);
        });

        rentDetails = filterByRoomName(rentDetails); 
        electricCostDetails = filterByRoomName(electricCostDetails);
        waterCostDetails = filterByRoomName(waterCostDetails);
        serviceRevDetails = filterByRoomName(serviceRevDetails);
        additionalRevDetails = filterByRoomName(additionalRevDetails);
        maintDetails = filterByRoomName(maintDetails); 
        baseCostDetails = filterByRoomName(baseCostDetails);
        
        mgmtDetails = filterByItemName(mgmtDetails); 
        otherCostDetails = filterByItemName(otherCostDetails); 
      }
    }

    const currentMonthBills = bills.filter(b => b.billing_month === selectedMonth);
    const filteredBills = currentMonthBills.filter(bill => {
      const contract = contracts.find(c => c.id === bill.contract_id);
      const room = rooms.find(r => r.id === contract?.room_id);
      if (!room) return false;
      if (selectedHouse !== "all" && room.house_id.toString() !== selectedHouse.toString()) return false;
      if (selectedRoom !== "all" && room.id.toString() !== selectedRoom.toString()) return false;
      return true;
    });

    const electricRevDetails = filteredBills.filter(b => Number(b.electric_amount) > 0).map(bill => {
      const contract = contracts.find(c => c.id === bill.contract_id);
      const room = rooms.find(r => r.id === contract?.room_id);
      return { room_name: `Phòng ${room?.room_number}`, amount: Number(bill.electric_amount) };
    });

    const waterRevDetails = filteredBills.filter(b => Number(b.water_amount) > 0).map(bill => {
      const contract = contracts.find(c => c.id === bill.contract_id);
      const room = rooms.find(r => r.id === contract?.room_id);
      return { room_name: `Phòng ${room?.room_number}`, amount: Number(bill.water_amount) };
    });

    const cleaningRevDetails = filteredBills.filter(bill => Number(bill.cleaning_fee) > 0).map(bill => {
        const contract = contracts.find(c => c.id === bill.contract_id);
        const room = rooms.find(r => r.id === contract?.room_id);
        return { room_name: `Phòng ${room?.room_number}`, amount: Number(bill.cleaning_fee) };
    });

    const internetRevDetails = filteredBills.filter(bill => Number(bill.internet_fee) > 0).map(bill => {
        const contract = contracts.find(c => c.id === bill.contract_id);
        const room = rooms.find(r => r.id === contract?.room_id);
        return { room_name: `Phòng ${room?.room_number}`, amount: Number(bill.internet_fee) };
    });

    let paidRent = 0;
    let unpaidRent = 0;
    filteredBills.forEach(bill => {
      const r_amount = Number(bill.rent_amount) || 0;
      if (bill.status === 'paid') paidRent += r_amount;
      else unpaidRent += r_amount;
    });

    const sum = (arr, key) => arr.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);

    // Tính tổng cho từng danh mục
    const rentTotal = sum(rentDetails, "revenue");
    const electricRevTotal = sum(electricRevDetails, "amount");
    const waterRevTotal = sum(waterRevDetails, "amount");
    const serviceRevTotal = sum(serviceRevDetails, "amount");
    const additionalRevTotal = sum(additionalRevDetails, "amount");
    const cleaningRevTotal = sum(cleaningRevDetails, "amount");
    const internetRevTotal = sum(internetRevDetails, "amount");

    const electricCostTotal = sum(electricCostDetails, "amount");
    const waterCostTotal = sum(waterCostDetails, "amount");
    const maintTotal = sum(maintDetails, "amount");
    const baseCostTotal = sum(baseCostDetails, "amount");
    const mgmtTotal = sum(mgmtDetails, "amount");
    const otherCostTotal = sum(otherCostDetails, "amount");

    const totalRev = rentTotal + electricRevTotal + waterRevTotal + serviceRevTotal + additionalRevTotal + cleaningRevTotal + internetRevTotal;
    const totalCost = electricCostTotal + waterCostTotal + maintTotal + baseCostTotal + mgmtTotal + otherCostTotal;

    const barThuChiData = [{ name: `Tháng ${selectedMonth.split('-')[1]}`, "Thu nhập": totalRev, "Chi tiêu": totalCost }];

    // Dữ liệu cho Biểu đồ Tròn
    const costArray = [
      { name: 'Tiền điện (Chi)', value: electricCostTotal },
      { name: 'Tiền nước (Chi)', value: waterCostTotal },
      { name: 'Sửa chữa', value: maintTotal },
      { name: 'Vốn phòng', value: baseCostTotal }
    ];
    if (mgmtTotal > 0) costArray.push({ name: 'Quản lý', value: mgmtTotal });
    if (otherCostTotal > 0) costArray.push({ name: 'Chi phí khác', value: otherCostTotal });
    const internetCostTotal = reportData.internet_cost_tab?.total || 0;
    if (internetCostTotal > 0) costArray.push({ name: 'Chi phí Internet', value: internetCostTotal });

    const pieCostData = costArray.filter(d => d.value > 0).map(item => ({
      ...item, fill: CATEGORY_COLORS[item.name] || '#9ca3af' // Sử dụng bộ màu Cố Định
    }));

    const pieRevData = [
      { name: 'Tiền thuê', value: rentTotal },
      { name: 'Tiền điện (Thu)', value: electricRevTotal },
      { name: 'Tiền nước (Thu)', value: waterRevTotal },
      { name: 'Phí dịch vụ', value: serviceRevTotal },
      { name: 'Phí phát sinh', value: additionalRevTotal },
      { name: 'Phí vệ sinh', value: cleaningRevTotal },
      { name: 'Phí internet', value: internetRevTotal }
    ].filter(d => d.value > 0).map(item => ({
      ...item, fill: CATEGORY_COLORS[item.name] || '#9ca3af' // Sử dụng bộ màu Cố Định
    }));

    return {
      ...reportData,
      total_revenue: totalRev, total_cost: totalCost, net_profit: totalRev - totalCost,
      
      rent_tab: { total: rentTotal, details: rentDetails, paid: paidRent, unpaid: unpaidRent },
      electric_rev_tab: { total: electricRevTotal, details: electricRevDetails },
      water_rev_tab: { total: waterRevTotal, details: waterRevDetails },
      service_rev_tab: { total: serviceRevTotal, details: serviceRevDetails },
      additional_rev_tab: { total: additionalRevTotal, details: additionalRevDetails },
      cleaning_rev_tab: { total: cleaningRevTotal, details: cleaningRevDetails },
      internet_rev_tab: { total: internetRevTotal, details: internetRevDetails },
      
      electric_cost_tab: { total: electricCostTotal, details: electricCostDetails },
      water_cost_tab: { total: waterCostTotal, details: waterCostDetails },
      maintenance_tab: { total: maintTotal, details: maintDetails },
      base_cost_tab: { total: baseCostTotal, details: baseCostDetails },
      management_tab: { total: mgmtTotal, details: mgmtDetails },
      other_costs_tab: { total: otherCostTotal, details: otherCostDetails },
      charts: { barThuChiData, pieCostData, pieRevData }
    };
  }, [reportData, selectedRoom, rooms, selectedHouse, bills, contracts, selectedMonth]);

  const handleSaveOtherCost = async () => {
    setSavingOtherCost(true);
    try {
      await api.post(`/reports/financial/${selectedHouse}/other-cost?month=${selectedMonth}`, {
        other_house_cost: Number(otherCostInputs.amount) || 0,
        other_house_cost_reason: otherCostInputs.reason
      });
      await loadReport();
      alert("Đã lưu chi phí khác!");
    } catch { alert("Có lỗi xảy ra khi lưu chi phí khác."); } finally { setSavingOtherCost(false); }
  };

  const handleSaveInternetCost = async () => {
    setSavingInternet(true);
    try {
      await api.post(`/reports/financial/${selectedHouse}/internet-cost?month=${selectedMonth}`, {
        total_internet_cost: Number(internetInputs.amount) || 0
      });
      await loadReport();
      alert("Đã lưu chi phí internet!");
    } catch { 
      alert("Có lỗi xảy ra khi lưu chi phí internet."); 
    } finally { 
      setSavingInternet(false); 
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
      await loadReport(); 
      alert("Đã cập nhật bill nhà mạng và tính toán lại chi phí!");
    } catch { alert("Có lỗi xảy ra khi lưu chi phí."); } finally { setSavingUtil(false); }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const endpoint = `/data/export-finance?month=${selectedMonth}&house_id=${selectedHouse}`;
      const res = await api.get(endpoint, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const houseName = selectedHouse === "all" ? "Tất cả nhà trọ" : houses.find((h) => h.id.toString() === selectedHouse.toString())?.name || "Nha_Tro";
      link.setAttribute("download", `Báo Cáo Tài Chính ${houseName} ${selectedMonth}.xlsx`);
      document.body.appendChild(link); link.click(); link.parentNode.removeChild(link);
    } catch { alert("Lỗi xuất Excel"); } finally { setIsExporting(false); }
  };
  
  const inputStyle = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const tableHeaderStyle = "text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 border-b border-gray-200";
  const tableRowStyle = "py-3 text-sm text-gray-700 border-b border-dashed border-gray-200/50";



  const renderRentContent = () => {
    const chartData = [{ name: `Tháng ${selectedMonth.split('-')[1]}`, "Đã thu": displayData.rent_tab.paid || 0, "Cần thu": displayData.rent_tab.unpaid || 0 }];
    return (
      <DetailPanel title="Chi tiết Tiền thuê nhà" colorTheme="green">
        <div className="mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-sm">
          <h5 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider text-center">Thống kê thu tiền thuê nhà</h5>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barSize={50} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 13, fontWeight: 500}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={formatYAxis} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => [`${value.toLocaleString('vi-VN')} đ`, '']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '15px' }} />
                <Bar dataKey="Đã thu" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Cần thu" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.rent_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.revenue.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      </DetailPanel>
    );
  };

  const renderElectricRevContent = () => (
    <DetailPanel title="Chi tiết Tiền điện (Thu từ người thuê)" colorTheme="blue">
      {displayData.electric_rev_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.electric_rev_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderWaterRevContent = () => (
    <DetailPanel title="Chi tiết Tiền nước (Thu từ người thuê)" colorTheme="blue">
      {displayData.water_rev_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.water_rev_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderServiceRevContent = () => (
    <DetailPanel title="Chi tiết Phí dịch vụ" colorTheme="lime">
      {displayData.service_rev_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.service_rev_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderAdditionalRevContent = () => (
    <DetailPanel title="Chi tiết Phí phát sinh" colorTheme="rose">
      {displayData.additional_rev_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[400px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={tableHeaderStyle}>Lý do</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.additional_rev_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={tableRowStyle}>{d.item}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderCleaningRevContent = () => (
    <DetailPanel title="Chi tiết Phí vệ sinh" colorTheme="teal">
      {displayData.cleaning_rev_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.cleaning_rev_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderInternetRevContent = () => (
    <DetailPanel title="Chi tiết Phí internet" colorTheme="purple">
      {displayData.internet_rev_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.internet_rev_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );


  const renderElectricCostContent = () => (
    <DetailPanel title="Chi tiết Tiền điện (Thanh toán nhà mạng)" colorTheme="blue">
      {displayData.electric_cost_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.electric_cost_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderWaterCostContent = () => (
    <DetailPanel title="Chi tiết Tiền nước (Thanh toán nhà mạng)" colorTheme="blue">
      {displayData.water_cost_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Chưa có dữ liệu.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.water_cost_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderMaintContent = () => (
    <DetailPanel title="Chi tiết Sửa chữa & Bảo trì" colorTheme="orange">
      {displayData.maintenance_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Không có chi phí phát sinh.</p> : (
        <table className="w-full text-left min-w-[500px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={tableHeaderStyle}>Nội dung</th><th className={tableHeaderStyle}>Bên xử lý</th><th className={`${tableHeaderStyle} text-right`}>Chi phí</th></tr></thead>
          <tbody>{displayData.maintenance_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={tableRowStyle}>{d.description}</td><td className={tableRowStyle}>{d.handler_info ? <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded text-xs font-medium">{d.handler_info}</span> : '—'}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderBaseCostContent = () => (
    <DetailPanel title="Chi tiết Giá Cost (Vốn phòng)" colorTheme="orange">
      <table className="w-full text-left min-w-[300px]">
        <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Cost Price</th></tr></thead>
        <tbody>{displayData.base_cost_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.room_name}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
      </table>
    </DetailPanel>
  );

  const renderMgmtContent = () => (
    <DetailPanel title="Chi tiết Nhân viên quản lý" colorTheme="gray">
      <table className="w-full text-left min-w-[300px]">
        <thead><tr><th className={tableHeaderStyle}>Hạng mục</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
        <tbody>{displayData.management_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.item}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
      </table>
    </DetailPanel>
  );

  const renderOtherCostContent = () => (
    <DetailPanel title="Chi tiết Chi phí khác" colorTheme="purple">
      {selectedHouse !== 'all' && (
        <div className="bg-white p-4 sm:p-5 rounded-xl mb-5 border border-purple-100 shadow-sm">
          <h4 className="text-sm font-bold text-purple-800 mb-4 uppercase tracking-wide">Ghi nhận chi phí chung của nhà</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-gray-600 mb-1.5">Lý do chi (Nội dung)</label><input type="text" value={otherCostInputs.reason} onChange={(e) => setOtherCostInputs({...otherCostInputs, reason: e.target.value})} placeholder="VD: Rác, Vệ sinh..." className={inputStyle} /></div>
            <div><label className="block text-xs font-bold text-gray-600 mb-1.5">Số tiền (đ)</label><FormattedNumberInput name="amount" value={otherCostInputs.amount} onChange={(e) => setOtherCostInputs({...otherCostInputs, amount: e.target.value})} placeholder="VD: 150000" className={inputStyle} /></div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveOtherCost} disabled={savingOtherCost} className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">{savingOtherCost ? "Đang lưu..." : "Lưu chi phí"}</button>
          </div>
        </div>
      )}
      {displayData.other_costs_tab.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Không có chi phí khác.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Nội dung chi</th><th className={`${tableHeaderStyle} text-right`}>Số tiền</th></tr></thead>
          <tbody>{displayData.other_costs_tab.details.map((d, i) => <tr key={i}><td className={tableRowStyle}>{d.item}</td><td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td></tr>)}</tbody>
        </table>
      )}
    </DetailPanel>
  );

  const renderInternetCostContent = () => (
    <DetailPanel title="Chi tiết Phí internet (Chi)" colorTheme="purple">
      {selectedHouse !== 'all' && (
        <div className="bg-white p-4 sm:p-5 rounded-xl mb-5 border border-purple-100 shadow-sm">
          <h4 className="text-sm font-bold text-purple-800 mb-4 uppercase tracking-wide">Ghi nhận tổng hóa đơn Internet của nhà</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Tổng số tiền bill (đ)</label>
              <FormattedNumberInput 
                name="amount" 
                value={internetInputs.amount} 
                onChange={(e) => setInternetInputs({amount: e.target.value})} 
                placeholder="VD: 300000" 
                className={inputStyle} 
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveInternetCost} disabled={savingInternet} className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {savingInternet ? "Đang lưu..." : "Lưu chi phí"}
            </button>
          </div>
        </div>
      )}
      
      {displayData.internet_cost_tab?.details.length === 0 ? <p className="text-gray-500 italic text-sm py-2">Không có chi phí internet.</p> : (
        <table className="w-full text-left min-w-[300px]">
          <thead><tr><th className={tableHeaderStyle}>Phòng</th><th className={`${tableHeaderStyle} text-right`}>Chi phí phân bổ</th></tr></thead>
          <tbody>
            {displayData.internet_cost_tab?.details.map((d, i) => (
              <tr key={i}>
                <td className={tableRowStyle}>{d.item}</td>
                <td className={`${tableRowStyle} text-right font-bold text-gray-900`}>{d.amount.toLocaleString('vi-VN')} đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DetailPanel>
  );


  const renderDetailView = () => (
    <div className="space-y-10 animate-fade-in">
      <div className="flex justify-between items-center mb-2">
        <button onClick={() => setViewMode('overview')} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold transition-colors">
          <span>←</span> Quay lại Tổng quan
        </button>
      </div>

      {viewMode === 'revenue' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 border-b-2 border-emerald-500 pb-3">
            <h2 className="text-2xl font-extrabold text-emerald-700 uppercase flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">↓</span> Tổng Doanh Thu
            </h2>
            <div className="text-3xl font-black text-emerald-600 mt-2 sm:mt-0">+{displayData.total_revenue.toLocaleString('vi-VN')} đ</div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="💵" title="Tiền thuê nhà" colorTheme="green" summaryAmount={displayData.rent_tab.total} isOpen={openTabs.rent} onToggle={() => toggleTab('rent')} />
              {openTabs.rent && <div className="mt-2 lg:mt-0">{renderRentContent()}</div>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="⚡" title="Tiền điện (Thu từ người thuê)" colorTheme="blue" summaryAmount={displayData.electric_rev_tab.total} isOpen={openTabs.electric_rev} onToggle={() => toggleTab('electric_rev')} />
              {openTabs.electric_rev && <div className="mt-2 lg:mt-0">{renderElectricRevContent()}</div>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="💧" title="Tiền nước (Thu từ người thuê)" colorTheme="blue" summaryAmount={displayData.water_rev_tab.total} isOpen={openTabs.water_rev} onToggle={() => toggleTab('water_rev')} />
              {openTabs.water_rev && <div className="mt-2 lg:mt-0">{renderWaterRevContent()}</div>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="💎" title="Phí dịch vụ" colorTheme="lime" summaryAmount={displayData.service_rev_tab.total} isOpen={openTabs.service_rev} onToggle={() => toggleTab('service_rev')} />
              {openTabs.service_rev && <div className="mt-2 lg:mt-0">{renderServiceRevContent()}</div>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="⚠️" title="Phí phát sinh" colorTheme="rose" summaryAmount={displayData.additional_rev_tab.total} isOpen={openTabs.additional_rev} onToggle={() => toggleTab('additional_rev')} />
              {openTabs.additional_rev && <div className="mt-2 lg:mt-0">{renderAdditionalRevContent()}</div>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="🧹" title="Phí vệ sinh" colorTheme="teal" summaryAmount={displayData.cleaning_rev_tab.total} isOpen={openTabs.cleaning_rev} onToggle={() => toggleTab('cleaning_rev')} />
              {openTabs.cleaning_rev && <div className="mt-2 lg:mt-0">{renderCleaningRevContent()}</div>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="🌐" title="Phí internet" colorTheme="purple" summaryAmount={displayData.internet_rev_tab.total} isOpen={openTabs.internet_rev} onToggle={() => toggleTab('internet_rev')} />
              {openTabs.internet_rev && <div className="mt-2 lg:mt-0">{renderInternetRevContent()}</div>}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'cost' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 border-b-2 border-rose-500 pb-3">
            <h2 className="text-2xl font-extrabold text-rose-700 uppercase flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-lg">↑</span> Tổng Chi Phí
            </h2>
            <div className="text-3xl font-black text-rose-600 mt-2 sm:mt-0">-{displayData.total_cost.toLocaleString('vi-VN')} đ</div>
          </div>

          <div className="flex flex-col gap-4">
            
            {selectedHouse !== 'all' && selectedRoom === 'all' && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl mb-2 border border-blue-100 shadow-sm animate-fade-in">
                <h4 className="text-sm font-bold text-blue-800 mb-4 uppercase tracking-wide">Nhập hoá đơn từ công ty Điện/Nước</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1.5">Tổng Số Điện (kWh)</label><input type="number" name="total_electric_kwh" value={utilInputs.total_electric_kwh} onChange={(e) => setUtilInputs(p => ({...p, total_electric_kwh: e.target.value}))} className={inputStyle} /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1.5">Tổng Tiền Điện (đ)</label><FormattedNumberInput name="total_electric_bill" value={utilInputs.total_electric_bill} onChange={(e) => setUtilInputs(p => ({...p, total_electric_bill: e.target.value}))} className={inputStyle} /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1.5">Tổng Số Nước (m³)</label><input type="number" name="total_water_cube" value={utilInputs.total_water_cube} onChange={(e) => setUtilInputs(p => ({...p, total_water_cube: e.target.value}))} className={inputStyle} /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1.5">Tổng Tiền Nước (đ)</label><FormattedNumberInput name="total_water_bill" value={utilInputs.total_water_bill} onChange={(e) => setUtilInputs(p => ({...p, total_water_bill: e.target.value}))} className={inputStyle} /></div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={handleSaveUtilityBills} disabled={savingUtil} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">{savingUtil ? "Đang xử lý..." : "Lưu & Tính toán"}</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="⚡" title="Tiền điện (Chủ trọ trả)" colorTheme="blue" summaryAmount={-displayData.electric_cost_tab.total} isOpen={openTabs.electric_cost} onToggle={() => toggleTab('electric_cost')} />
              {openTabs.electric_cost && <div className="mt-2 lg:mt-0">{renderElectricCostContent()}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="💧" title="Tiền nước (Chủ trọ trả)" colorTheme="blue" summaryAmount={-displayData.water_cost_tab.total} isOpen={openTabs.water_cost} onToggle={() => toggleTab('water_cost')} />
              {openTabs.water_cost && <div className="mt-2 lg:mt-0">{renderWaterCostContent()}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="🔧" title="Sửa chữa & Bảo trì" colorTheme="orange" summaryAmount={-displayData.maintenance_tab.total} isOpen={openTabs.maintenance} onToggle={() => toggleTab('maintenance')} />
              {openTabs.maintenance && <div className="mt-2 lg:mt-0">{renderMaintContent()}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="🏢" title="Giá Cost (Vốn phòng)" colorTheme="orange" summaryAmount={-displayData.base_cost_tab.total} isOpen={openTabs.base_cost} onToggle={() => toggleTab('base_cost')} />
              {openTabs.base_cost && <div className="mt-2 lg:mt-0">{renderBaseCostContent()}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="🧑‍💼" title="Nhân viên quản lý" colorTheme="gray" summaryAmount={-displayData.management_tab.total} isOpen={openTabs.management} onToggle={() => toggleTab('management')} />
              {openTabs.management && <div className="mt-2 lg:mt-0">{renderMgmtContent()}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="📝" title="Chi phí khác" colorTheme="purple" summaryAmount={-displayData.other_costs_tab.total} isOpen={openTabs.other_costs} onToggle={() => toggleTab('other_costs')} />
              {openTabs.other_costs && <div className="mt-2 lg:mt-0">{renderOtherCostContent()}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
              <AccordionCard icon="🌐" title="Chi phí Internet" colorTheme="blue" summaryAmount={-displayData.internet_cost_tab.total} isOpen={openTabs.internet_cost} onToggle={() => toggleTab('internet_cost')} />
              {openTabs.internet_cost && <div className="mt-2 lg:mt-0">{renderInternetCostContent()}</div>}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-blue-500 text-white rounded-2xl p-5 shadow-md flex items-center justify-between">
          <div><p className="text-blue-100 font-medium mb-1">Doanh thu tháng</p><h3 className="text-2xl lg:text-3xl font-bold">{displayData.total_revenue.toLocaleString('vi-VN')} đ</h3></div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">💵</div>
        </div>
        <div className="bg-yellow-400 text-white rounded-2xl p-5 shadow-md flex items-center justify-between">
          <div><p className="text-amber-700 font-medium mb-1">Chi phí tháng</p><h3 className="text-2xl lg:text-3xl font-bold">{displayData.total_cost.toLocaleString('vi-VN')} đ</h3></div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">🛒</div>
        </div>
        {(() => {
          const isLoss = displayData.net_profit < 0;
          const isBreakEven = displayData.net_profit === 0;

          // Lựa chọn icon theo đúng trạng thái lợi nhuận
          const profitIcon = isLoss ? '📉' : isBreakEven ? '⚖️' : '📈';

          return (
            <div className={`${isLoss ? 'bg-rose-500' : 'bg-emerald-500'} text-white rounded-2xl p-5 shadow-md flex items-center justify-between transition-colors`}>
              <div>
                <p className={`${isLoss ? 'text-rose-100' : 'text-emerald-100'} font-medium mb-1`}>
                  {isLoss ? 'Lỗ' : 'Lợi nhuận'}
                </p>
                <h3 className="text-2xl lg:text-3xl font-bold">
                  {displayData.net_profit.toLocaleString('vi-VN')} đ
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                {profitIcon}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        
        <div onClick={() => setViewMode('revenue')} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all">
          <h4 className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wider">Doanh thu theo danh mục</h4>
          <p className="text-xs text-gray-400 mb-4 font-medium">Bấm để xem chi tiết khoản thu</p>
          <div className="h-56 w-full">
             {displayData.charts.pieRevData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 italic">Chưa có thu nhập</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={displayData.charts.pieRevData} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value" />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`${value.toLocaleString('vi-VN')} đ`, '']} />
                  <Legend iconType="circle" layout="vertical" position="right" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div onClick={() => setViewMode('cost')} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-rose-200 transition-all">
          <h4 className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wider">Chi phí theo danh mục</h4>
          <p className="text-xs text-gray-400 mb-4 font-medium">Bấm để xem chi tiết khoản chi</p>
          <div className="h-56 w-full">
            {displayData.charts.pieCostData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 italic">Chưa có chi tiêu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={displayData.charts.pieCostData} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value" />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`${value.toLocaleString('vi-VN')} đ`, '']} />
                  <Legend iconType="circle" layout="vertical" position="right" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>


        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-gray-600 mb-6 uppercase tracking-wider">Thu - Chi theo tháng</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData.charts.barThuChiData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 13}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={formatYAxis} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [`${value.toLocaleString('vi-VN')} đ`, '']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                <Bar dataKey="Thu nhập" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey="Chi tiêu" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mt-2">
        <h4 className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-wider flex items-center gap-2">
          <span>📊</span> Phân tích Lời / Lỗ dịch vụ (Điện, Nước, Internet)
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {/* Phân tích Tiền Điện */}
          {(() => {
            const thu = displayData.electric_rev_tab?.total || 0;
            const chi = displayData.electric_cost_tab?.total || 0;
            const loi = thu - chi;
            return (
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg">⚡</div>
                    <h5 className="font-bold text-blue-800">Tiền Điện</h5>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Tổng thu:</span> <span className="font-medium text-gray-800">+{thu.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tổng chi:</span> <span className="font-medium text-gray-800">-{chi.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="pt-3 mt-1 border-t border-blue-100/60 flex justify-between items-center">
                    <span className="font-bold text-gray-700">Lời / Lỗ:</span>
                    <span className={`text-base font-black ${loi > 0 ? 'text-emerald-600' : loi < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                      {loi > 0 ? '+' : ''}{loi.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Phân tích Tiền Nước */}
          {(() => {
            const thu = displayData.water_rev_tab?.total || 0;
            const chi = displayData.water_cost_tab?.total || 0;
            const loi = thu - chi;
            return (
              <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-lg">💧</div>
                    <h5 className="font-bold text-cyan-800">Tiền Nước</h5>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Tổng thu:</span> <span className="font-medium text-gray-800">+{thu.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tổng chi:</span> <span className="font-medium text-gray-800">-{chi.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="pt-3 mt-1 border-t border-cyan-100/60 flex justify-between items-center">
                    <span className="font-bold text-gray-700">Lời / Lỗ:</span>
                    <span className={`text-base font-black ${loi > 0 ? 'text-emerald-600' : loi < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                      {loi > 0 ? '+' : ''}{loi.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Phân tích Tiền Internet */}
          {(() => {
            const thu = displayData.internet_rev_tab?.total || 0;
            const chi = displayData.internet_cost_tab?.total || 0;
            const loi = thu - chi;
            return (
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-lg">🌐</div>
                    <h5 className="font-bold text-purple-800">Tiền Internet</h5>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Tổng thu:</span> <span className="font-medium text-gray-800">+{thu.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tổng chi:</span> <span className="font-medium text-gray-800">-{chi.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="pt-3 mt-1 border-t border-purple-100/60 flex justify-between items-center">
                    <span className="font-bold text-gray-700">Lời / Lỗ:</span>
                    <span className={`text-base font-black ${loi > 0 ? 'text-emerald-600' : loi < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                      {loi > 0 ? '+' : ''}{loi.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 font-sans">
      <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
          <h1 className="text-2xl font-bold text-gray-800 mr-2 shrink-0">Báo cáo tài chính</h1>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
            {houses.length > 0 && (
              <select value={selectedHouse} onChange={(e) => { setSelectedHouse(e.target.value); setSelectedRoom("all"); }} className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700">
                <option value="all">🏢 Tất cả nhà trọ</option>
                {houses.map((h) => <option key={h.id} value={h.id}>🏠 {h.name} {h.address ? `- ${h.address}` : ""}</option>)}
              </select>
            )}

            {selectedHouse !== "all" && (
              <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700">
                <option value="all">🚪 Tất cả phòng</option>
                {rooms
                  .filter(r => r.house_id.toString() === selectedHouse.toString())
                  .sort((a, b) => a.room_number.toString().localeCompare(b.room_number.toString(), undefined, { numeric: true, sensitivity: 'base' }))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Phòng {r.room_number}
                    </option>
                  ))
                }
              </select>
            )}

            <VietnameseMonthPicker 
              value={selectedMonth} 
              onChange={setSelectedMonth} 
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700" 
            />

            {displayData && (
              <button onClick={handleExportExcel} disabled={isExporting} className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition shadow-sm flex items-center justify-center gap-2">
                {isExporting ? "⏳ Đang xuất..." : "📊 Xuất Excel"}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]"><p className="text-gray-400 text-lg">Đang tổng hợp dữ liệu...</p></div>
      ) : !displayData ? (
        <div className="text-center py-20 text-gray-400"><p>Không có dữ liệu báo cáo cho tháng này.</p></div>
      ) : (
        viewMode === 'overview' ? renderOverview() : renderDetailView()
      )}
    </div>
  );
}