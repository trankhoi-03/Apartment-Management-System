import { useEffect, useState } from "react";
import api from "../../api/axios";
import ContractFormModal from "./ContractFormModal";
import EditContractModal from "./EditContractModal";
import EndContractModal from "./EndContractModal";
import GenerateBillModal from "./GenerateBillModal";
import ReportIncidentModal from "./ReportIncidentModal";

const STATUS_LABEL = {
  vacant:   "Trống",
  occupied: "Đang thuê",
  inactive: "Ngừng thuê",
};

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function RoomDrawer({ room, onClose, onEdit, onDuplicate, onDeleted, onContractChanged }) {
  const userRole = localStorage.getItem("user_role") || "staff";
  const isOwner = userRole === "owner";
  const [contract, setContract]           = useState(null);
  const [loadingContract, setLoadingContract] = useState(true);
  const [showContractForm, setShowContractForm]   = useState(false);
  const [showEditContract, setShowEditContract]   = useState(false);
  const [showEndContract, setShowEndContract]     = useState(false);
  const [showGenerateBill, setShowGenerateBill]   = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [houseName, setHouseName] = useState("");

  const [isMinimized, setIsMinimized] = useState(false);
  const hasOpenModal = showContractForm || showEditContract || showEndContract || showGenerateBill || showIncidentForm;
  const [isExporting, setIsExporting] = useState(false);
  const [showCoTenants, setShowCoTenants]  = useState(false);
  const [showFurnitures, setShowFurnitures] = useState(false);

  useEffect(() => {
    if (!hasOpenModal && isMinimized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMinimized(false);
    }
  }, [hasOpenModal, isMinimized]);

  const handleCloseDrawer = () => {
    if (hasOpenModal) {
      setIsMinimized(true); // Thu nhỏ nếu có form đang mở
    } else {
      onClose(); // Đóng hẳn nếu không có form nào
    }
  };

  function formatDateVN(dateString) {
    if (!dateString) return "—";
    
    if (dateString.includes("-")) {
      const [year, month, day] = dateString.split("-");
      const cleanDay = day.split("T")[0]; 
      return `${cleanDay}/${month}/${year}`;
    }
    
    return dateString;
  }

  async function handleExportContract() {
    if (!contract) return;
    setIsExporting(true);
    try {
      // Trích xuất thông tin điện nước từ dữ liệu đang hiển thị trong Drawer
      const exportParams = {
        electric_price: contract.current_rate?.electric_price || 0,
        water_price: room.is_water_meter ? (contract.current_rate?.water_price || 0) : (contract.current_rate?.default_water_amount || 0),
        electric_reading: contract.initial_utility?.electric_old || 0,
        water_reading: room.is_water_meter ? (contract.initial_utility?.water_old || 0) : 0
      };

      const fileRes = await api.get(`/contracts/${contract.id}/export-word`, { 
        params: exportParams, 
        responseType: "blob" 
      });

      // Thay đổi vào tối hôm qua
      const url = window.URL.createObjectURL(new Blob([fileRes.data], { 
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `HopDong_Phong_${room.room_number}.docx`);
      document.body.appendChild(link); 
      link.click(); 
      link.parentNode.removeChild(link);
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      alert("Không thể tải file hợp đồng. Vui lòng kiểm tra lại file mẫu.");
    } finally {
      setIsExporting(false);
    }
  }

  async function loadHouseInfo() {
    if (!room) return;
    
    if (room.house?.name) {
      setHouseName(room.house.name);
      return;
    }
    if (room.house_name) {
      setHouseName(room.house_name);
      return;
    }

    if (room.house_id) {
      try {
        const res = await api.get("/houses");
        const matchedHouse = res.data.find((h) => h.id === room.house_id);
        if (matchedHouse) {
          setHouseName(matchedHouse.name);
        }
      } catch (err) {
        console.error("Không thể tải thông tin nhà trọ", err);
      }
    }
  }

  async function loadContract() {
    if (!room) return;
    setLoadingContract(true);
    setContract(null);
    try {
      const res = await api.get("/contracts");
      const active = res.data.find(
        (c) => c.room_id === room.id && c.status === "active"
      );
      
      if (active && active.tenant_id) {
        try {
          const tenantRes = await api.get(`/tenants/${active.tenant_id}`);
          active.tenant = tenantRes.data;
        } catch (err) {
          console.error("Không thể tải thông tin khách thuê", err);
        }

        try {
          const ratesRes = await api.get(`/utility-rates?room_id=${room.id}`);
          if (ratesRes.data && ratesRes.data.length > 0) {
            // Lấy bảng giá mới nhất
            const sortedRates = ratesRes.data.sort((a,b) => new Date(b.effective_from) - new Date(a.effective_from));
            active.current_rate = sortedRates[0];
          }
        } catch (err) {
          console.error("Không thể tải bảng giá", err);
        }

        try {
          const startMonth = active.start_date.substring(0, 7);
          const utilRes = await api.get(`/utility?room_id=${room.id}`);
          if (utilRes.data && utilRes.data.length > 0) {
            active.initial_utility = utilRes.data.find(u => u.billing_month === startMonth);
          }
        } catch (err) {
          console.error("Không thể tải số điện/nước", err);
        }
      }

      setContract(active ?? null);
    } finally {
      setLoadingContract(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      if (room?.id) {
        loadContract();
        loadHouseInfo();
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  async function handleDeleteRoom() {
    if (!confirm(`Xoá phòng ${room.room_number}? Hành động này không thể hoàn tác.`)) return;
    try {
      await api.delete(`/rooms/${room.id}`);
      onDeleted();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Không thể xoá phòng này.");
    }
  }

  if (!room) return null;
    

  const rawFurnitures = room?.feature_and_furniture || room?.furnitures;
  const furnituresList = Array.isArray(rawFurnitures) 
    ? rawFurnitures 
    : (rawFurnitures ? rawFurnitures.split(",") : []);
  const validFurnitures = furnituresList.map(f => f.trim()).filter(Boolean);

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/30 z-50 transition-opacity duration-300 ${isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"}`} 
        onClick={handleCloseDrawer} 
      />

      <div className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-[60] flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out ${isMinimized ? "translate-x-full" : "translate-x-0"}`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800 truncate pr-2">
            Phòng {room.room_number}{houseName ? ` - ${houseName}` : ""}
          </h2>
          <button onClick={handleCloseDrawer} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" title="Đóng / Thu gọn">
            ×
          </button>
        </div>

        <div className="p-5 pb-24 md:pb-5 space-y-6 flex-1">

          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Thông tin phòng
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Trạng thái" value={STATUS_LABEL[room.status] ?? room.status} />
              <Row label="Giá cost"   value={`${room.cost_price?.toLocaleString("vi-VN")}đ/tháng`} />
              {room.area_sqm && <Row label="Diện tích" value={`${room.area_sqm} m²`} />}
              <Row label="Đồng hồ nước" value={room.is_water_meter ? "✅ Có" : "❌ Không"} />
              
              <div className="flex flex-col text-sm pt-1">
                <div className="flex justify-between items-start">
                  <span className="text-gray-500">Đặc điểm & Nội thất</span>
                  
                  {validFurnitures.length > 0 ? (
                    <div className="flex flex-col items-end gap-1.5 max-w-[65%]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{validFurnitures.length} mục</span>
                        <button 
                          onClick={() => setShowFurnitures(!showFurnitures)} 
                          className="text-gray-500 hover:text-blue-600 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none transition-colors"
                        >
                          {showFurnitures ? "▲ Ẩn" : "▼ Xem"}
                        </button>
                      </div>
                      
                      {!showFurnitures && (
                        <div className="flex flex-wrap gap-1.5 justify-end mt-0.5">
                          {validFurnitures.slice(0, 2).map((f, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[11px] rounded-md border border-gray-200">
                              {f}
                            </span>
                          ))}
                          {validFurnitures.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[11px] rounded-md border border-gray-200 border-dashed">
                              +{validFurnitures.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">Không có</span>
                  )}
                </div>

                {showFurnitures && validFurnitures.length > 0 && (
                  <div className="mt-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap gap-1.5 animate-fade-in">
                    {validFurnitures.map((f, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-white text-gray-700 text-xs rounded-lg border border-gray-200 shadow-sm">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {isOwner && (
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => {
                    setIsMinimized(true); // Thu nhỏ Drawer ngay lập tức
                    onEdit(room);         // Mở form Sửa ở component cha
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  ✏️ Sửa
                </button>
                <button 
                  onClick={() => {
                    if (onDuplicate) {
                      setIsMinimized(true); // Thu nhỏ Drawer ngay lập tức
                      onDuplicate(room);    // Mở form Sao chép ở component cha
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition">
                  📋 Sao chép
                </button>
                <button 
                  onClick={handleDeleteRoom}
                  className="px-3 py-2 border border-red-200 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition">
                  🗑️ Xoá
                </button>
              </div>
            )}
            <button onClick={() => setShowIncidentForm(true)}
              className="w-full mt-2 px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium hover:bg-red-100 transition flex justify-center items-center gap-2">
              ⚠️ Báo cáo sự cố
            </button>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Hợp đồng hiện tại
            </h3>

            {loadingContract ? (
              <p className="text-sm text-gray-400">Đang tải...</p>
            ) : contract ? (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
                <Row label="Người thuê"  value={contract.tenant?.full_name ?? "—"} />
                <Row label="SĐT"         value={contract.tenant?.phone ?? "—"} />
                <Row label="Email"       value={contract.tenant?.email ?? "Chưa có"} />
                <Row label="Tiền thuê"
                  value={`${Number(contract.monthly_rent).toLocaleString("vi-VN")}đ`} />
                <Row label="Đặt cọc"
                  value={`${Number(contract.deposit).toLocaleString("vi-VN")}đ`} />
                <div className="flex flex-col">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Số người</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-right max-w-[60%]">{contract.num_tenants ?? "—"}</span>
                      {contract.num_tenants > 1 && contract.co_tenants?.length > 0 && (
                        <button 
                          onClick={() => setShowCoTenants(!showCoTenants)} 
                          className="text-gray-500 hover:text-blue-600 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none transition-colors"
                        >
                          {showCoTenants ? "▲ Ẩn" : "▼ Xem"}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {showCoTenants && contract.num_tenants > 1 && contract.co_tenants?.length > 0 && (
                    <div className="mt-2 p-2.5 bg-white rounded-lg border border-blue-100 shadow-sm text-xs space-y-1.5 animate-fade-in">
                      <div className="text-gray-700 flex gap-2">
                        <span className="font-semibold text-blue-600">1.</span> 
                        <span>{contract.tenant?.full_name} <span className="text-gray-400 italic">(Đại diện)</span></span>
                      </div>
                      {contract.co_tenants.map((ct, idx) => (
                        <div key={idx} className="text-gray-700 flex gap-2">
                          <span className="font-semibold text-blue-600">{idx + 2}.</span> 
                          <span>{ct.full_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Row label="Số xe"       value={contract.num_vehicles ?? "—"} />
                <Row label="Tạm trú"     value={contract.temp_residence_reg ? "✅ Có" : "❌ Không"} />
                <Row label="Lưu trú"     value={contract.temp_residence_dec ? "✅ Có" : "❌ Không"} />
                <Row label="Bắt đầu"     value={formatDateVN(contract.start_date)} />
                {contract.end_date &&
                  <Row label="Kết thúc"  value={formatDateVN(contract.end_date)} />}


                {contract.current_rate && (
                  <>
                    <div className="border-t border-blue-100/60 my-2 pt-2"></div>
                    <Row label="Giá điện" value={`${Number(contract.current_rate.electric_price).toLocaleString("vi-VN")}đ/kWh`} />
                    {room.is_water_meter ? (
                      <Row label="Giá nước" value={`${Number(contract.current_rate.water_price).toLocaleString("vi-VN")}đ/m³`} />
                    ) : (
                      <Row label="Nước cố định" value={`${Number(contract.current_rate.default_water_amount).toLocaleString("vi-VN")}đ/tháng`} />
                    )}
                  </>
                )}

                {contract.initial_utility && (
                  <>
                    <div className="border-t border-blue-100/60 my-2 pt-2"></div>
                    <Row label="Số điện ban đầu" value={`${contract.initial_utility.electric_old} kWh`} />
                    {room.is_water_meter && (
                      <Row label="Số nước ban đầu" value={`${contract.initial_utility.water_old} m³`} />
                    )}
                  </>
                )}
                  
                {contract.notes && (
                  <div className="pt-2 mt-2 border-t border-blue-100/60">
                    <span className="text-gray-500 block mb-1">Ghi chú / Nội thất:</span>
                    <span className="font-medium text-gray-800 whitespace-pre-wrap block">
                      {contract.notes}
                    </span>
                  </div>
                )}

                {isOwner && (
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowEditContract(true)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-white transition">
                      ✏️ Sửa HĐ
                    </button>
                    <button onClick={() => setShowEndContract(true)}
                      className="flex-1 px-3 py-2 border border-orange-300 rounded-xl text-sm font-medium text-orange-600 hover:bg-orange-50 transition">
                      🔚 Kết thúc
                    </button>
                  </div>
                )}
                <button 
                  onClick={handleExportContract}
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 rounded-xl text-sm font-medium transition mt-3 flex items-center justify-center gap-2"
                >
                  {isExporting ? "⏳ Đang tải..." : "📄 Xuất hợp đồng"}
                </button>
                <button onClick={() => setShowGenerateBill(true)}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition mt-1">
                  🧾 Xuất hoá đơn tháng này
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <p className="mb-3 text-sm">Phòng chưa có hợp đồng active</p>
                <button onClick={() => setShowContractForm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition">
                  + Thêm hợp đồng
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] bg-white border border-gray-200 border-r-0 rounded-l-2xl shadow-[-5px_0_20px_rgba(0,0,0,0.15)] px-2.5 py-6 flex flex-col items-center gap-3 text-blue-600 hover:bg-blue-50 transition-colors group cursor-pointer"
          title="Mở lại thông tin phòng"
        >
          {/* Icon Mũi tên */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {/* Text dọc */}
          <span style={{ writingMode: 'vertical-rl' }} className="rotate-180 font-bold tracking-widest text-sm whitespace-nowrap">
            PHÒNG {room.room_number}
          </span>
        </button>
      )}

      {showContractForm && (
        <ContractFormModal
          room={room}
          onClose={() => setShowContractForm(false)}
          onSaved={() => {
            setShowContractForm(false);
            onContractChanged();
            loadContract();
          }}
        />
      )}

      {showEditContract && contract && (
        <EditContractModal
          room={room}
          contract={contract}
          onClose={() => setShowEditContract(false)}
          onSaved={() => {
            setShowEditContract(false);
            onContractChanged();
            loadContract();
          }}
        />
      )}

      {showEndContract && contract && (
        <EndContractModal
          contract={contract}
          roomNumber={room.room_number}
          onClose={() => setShowEndContract(false)}
          onEnded={() => {
            setShowEndContract(false);
            setContract(null);
            onContractChanged();
          }}
        />
      )}

      {showGenerateBill && contract && (
        <GenerateBillModal
          room={room}
          contract={contract}
          onClose={() => setShowGenerateBill(false)}
          onGenerated={() => {
            setShowGenerateBill(false);
            onContractChanged();
          }}
        />
      )}
      
      {showIncidentForm && (
        <ReportIncidentModal
          room={room}
          onClose={() => setShowIncidentForm(false)}
          onReported={() => {
            setShowIncidentForm(false);
            alert("Đã báo cáo sự cố thành công!");
          }}
        />
      )}
    </>
  );
}