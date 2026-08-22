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

  function formatDateVN(dateString) {
    if (!dateString) return "—";
    
    if (dateString.includes("-")) {
      const [year, month, day] = dateString.split("-");
      const cleanDay = day.split("T")[0]; 
      return `${cleanDay}/${month}/${year}`;
    }
    
    return dateString;
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
      }
      
      setContract(active ?? null);
    } finally {
      setLoadingContract(false);
    }
  }

  useEffect(() => { loadContract(); }, [room]);

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

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-40 flex flex-col overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Phòng {room.room_number}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 pb-24 md:pb-5 space-y-6 flex-1">

          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Thông tin phòng
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Trạng thái" value={STATUS_LABEL[room.status] ?? room.status} />
              <Row label="Giá thuê"   value={`${room.base_rent?.toLocaleString("vi-VN")}đ/tháng`} />
              {room.area_sqm && <Row label="Diện tích" value={`${room.area_sqm} m²`} />}
              <Row label="Đồng hồ nước" value={room.is_water_meter ? "✅ Có" : "❌ Không"} />
              
              <Row 
                label="Nội thất" 
                value={room.furnitures?.length > 0 ? room.furnitures.join(", ") : "Không có"} 
              />
            </div>
            
            {isOwner && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => onEdit(room)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  ✏️ Sửa
                </button>
                <button onClick={() => onDuplicate && onDuplicate(room)}
                  className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition">
                  📋 Sao chép
                </button>
                <button onClick={handleDeleteRoom}
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
                <Row label="Số người"    value={contract.num_tenants ?? "—"} />
                <Row label="Số xe"       value={contract.num_vehicles ?? "—"} />
                <Row label="Tạm trú"     value={contract.temp_residence_reg ? "✅ Có" : "❌ Không"} />
                <Row label="Bắt đầu"     value={formatDateVN(contract.start_date)} />
                {contract.end_date &&
                  <Row label="Kết thúc"  value={formatDateVN(contract.end_date)} />}
                  
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