import api from "../../api/axios";

export default function TenantDrawer({ tenant, activeContract, pastContracts, houses = [], rooms = [], onClose, onEdit, onDeleted }) {
  async function handleDelete() {
    if (!confirm(`Xoá người thuê "${tenant.full_name}"?`)) return;
    try {
      await api.delete(`/tenants/${tenant.id}`);
      onDeleted();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Không thể xoá người thuê này.");
    }
  }

  const formatRoomDisplay = (contract) => {
    const matchedRoom = rooms.find(r => r.id === contract.room_id);
    const roomNumber = matchedRoom?.room_number ?? contract.room_id;
    const house = houses.find(h => h.id === matchedRoom?.house_id);
    
    return house ? `Phòng ${roomNumber} - ${house.name}` : `Phòng ${roomNumber}`;
  };

  if (!tenant) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl
                      z-40 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">{tenant.full_name}</h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-6">

          {/* Thông tin cá nhân */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Thông tin cá nhân
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="Số điện thoại" value={tenant.phone} />
              <Row label="Email" value={tenant.email ?? "Chưa có"} />
              {/* <Row label="CCCD/CMND" value={tenant.id_card_number ?? "Chưa có"} /> */}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => onEdit(tenant)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm
                           font-medium text-gray-700 hover:bg-gray-50 transition">
                ✏️ Sửa thông tin
              </button>
              <button onClick={handleDelete}
                className="px-3 py-2 border border-red-200 rounded-xl text-sm
                           font-medium text-red-500 hover:bg-red-50 transition">
                🗑️ Xoá
              </button>
            </div>
          </section>

          {/* Hợp đồng hiện tại / Lịch sử thuê */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Hợp đồng
            </h3>
            {activeContract ? (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
                <Row label="Phòng" value={formatRoomDisplay(activeContract)} />
                <Row label="Tiền thuê"
                  value={`${Number(activeContract.monthly_rent).toLocaleString("vi-VN")}đ/tháng`} />
                <Row label="Đặt cọc"
                  value={`${Number(activeContract.deposit).toLocaleString("vi-VN")}đ`} />
                <Row label="Bắt đầu" value={activeContract.start_date} />
                {activeContract.end_date &&
                  <Row label="Kết thúc" value={activeContract.end_date} />}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 italic">
                  Người thuê này hiện không có hợp đồng active.
                </p>
                
                {pastContracts && pastContracts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Lịch sử thuê phòng
                    </h4>
                    <div className="space-y-3">
                      {pastContracts.map((contract) => (
                        <div key={contract.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2 text-sm">
                          <Row label="Phòng" value={formatRoomDisplay(contract)} />
                          <Row label="Thời gian" value={`${contract.start_date} → ${contract.end_date || 'Nay'}`} />
                          <Row label="Lý do kết thúc" value={
                            <span className="text-orange-600 font-medium">
                              {contract.end_reason || "Không rõ lý do"}
                            </span>
                          } />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}