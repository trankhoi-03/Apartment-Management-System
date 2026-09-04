import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import EditBillModal from "../components/rooms/EditBillModal";

const STATUS_CONFIG = {
  pending: { label: "Chưa gửi",       color: "bg-orange-100 text-orange-700" },
  sent:    { label: "Đã gửi",         color: "bg-blue-100 text-blue-700"    },
  paid:    { label: "Đã thanh toán",  color: "bg-green-100 text-green-700"  },
};

const FILTERS = [
  { key: "all",     label: "Tất cả"           },
  { key: "unpaid",  label: "Chưa thanh toán"  },
  { key: "paid",    label: "Đã thanh toán"    },
];

function matches(bill, filter) {
  if (filter === "paid")   return bill.status === "paid";
  if (filter === "unpaid") return bill.status !== "paid";
  return true;
}

function formatBillingMonth(monthStr) {
  if (!monthStr) return "";
  // Nếu dữ liệu trả về dạng "YYYY-MM" (VD: "2026-09")
  if (monthStr.includes("-")) {
    const parts = monthStr.split("-");
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`; // Chuyển thành "09/2026"
    }
  }
  return monthStr;
}

function BillCard({ bill, onMarkPaid, onSendEmail, sendingId, onEdit, userRole }) {
  const cfg = STATUS_CONFIG[bill.status] ?? STATUS_CONFIG.pending;

  const roomNumber = bill.computed_room?.room_number;
  const tenantName = bill.computed_tenant?.full_name;
  const houseName = bill.computed_house?.name;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">
            Tháng {formatBillingMonth(bill.billing_month)}
          </p>
          <h3 className="font-bold text-gray-800">
            {roomNumber ? `Phòng ${roomNumber}` : `HĐ #${bill.contract_id}`}
          </h3>

          {houseName && (
            <p className="text-xs font-medium text-blue-600 mt-0.5 mb-1">
              🏢 {houseName}
            </p>
          )}

          <p className="text-sm text-gray-500">
            {tenantName ?? "—"}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-1 text-sm text-gray-600 flex-1">
        <div className="flex justify-between">
          <span>Tiền thuê</span>
          <span>{Number(bill.rent_amount).toLocaleString("vi-VN")}đ</span>
        </div>
        <div className="flex justify-between">
          <span>Điện ({bill.electric_consumed} kWh)</span>
          <span>{Number(bill.electric_amount).toLocaleString("vi-VN")}đ</span>
        </div>
        <div className="flex justify-between">
          <span>
            Nước {bill.water_consumed > 0 ? `(${bill.water_consumed} m³)` : "(cố định)"}
          </span>
          <span>{Number(bill.water_amount).toLocaleString("vi-VN")}đ</span>
        </div>
        {Number(bill.service_fee) > 0 && (
          <div className="flex justify-between">
            <span>Phí dịch vụ</span>
            <span>{Number(bill.service_fee).toLocaleString("vi-VN")}đ</span>
          </div>
        )}
        {Number(bill.additional_fee) > 0 && (
          <div className="flex justify-between items-start text-red-600">
            <span className="pr-4">
              Phát sinh {bill.additional_fee_reason ? `(${bill.additional_fee_reason})` : ""}
            </span>
            <span className="whitespace-nowrap font-medium">
              {Number(bill.additional_fee).toLocaleString("vi-VN")}đ
            </span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-800 border-t border-gray-100 pt-2 mt-1">
          <span>Tổng cộng</span>
          <span className="text-blue-600">
            {Number(bill.total_amount).toLocaleString("vi-VN")}đ
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        {bill.status === "pending" && (
          <div className="flex gap-2">
            {userRole === "owner" && 
              <button
                onClick={() => onEdit(bill)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition"
              >
                ✏️ Sửa
              </button>
            }
            
            <button
              onClick={() => onSendEmail(bill)}
              disabled={sendingId === bill.id}
              className={`${userRole === "owner" ? "flex-[2]" : "w-full"} px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2`}
            >
              {sendingId === bill.id ? "Đang gửi..." : "📧 Gửi Email"}
            </button>
          </div>
        )}
        {bill.status === "sent" && (
          <button
            onClick={() => onMarkPaid(bill)}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
          >
            Đánh dấu đã thanh toán
          </button>
        )}
        {bill.status === "paid" && (
          <div className="w-full px-4 py-2 bg-gray-50 text-gray-500 rounded-xl text-sm font-medium text-center">
            Hóa đơn đã hoàn tất
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillsPage() {
  const [bills, setBills]         = useState([]);
  const [houses, setHouses]       = useState([]); 
  const [rooms, setRooms]         = useState([]); 
  const [contracts, setContracts] = useState([]); 
  const [tenants, setTenants]     = useState([]); 
  
  const [selectedHouse, setSelectedHouse] = useState("all"); 
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");
  const [sendingId, setSendingId] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  const [isSendingBulk, setIsSendingBulk] = useState(false);

  const userRole = localStorage.getItem("user_role");
  
  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const [housesRes, billsRes, roomsRes, contractsRes, tenantsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/bills").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/contracts").catch(() => ({ data: [] })),
        api.get("/tenants").catch(() => ({ data: [] }))
      ]);
      setHouses(housesRes.data);
      setBills(billsRes.data);
      setRooms(roomsRes.data);
      setContracts(contractsRes.data);
      setTenants(tenantsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadBills();
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enrichedBills = bills.map(bill => {
    const contract = contracts.find(c => c.id === bill.contract_id) || bill.contract;
    const room = rooms.find(r => r.id === contract?.room_id) || contract?.room;
    const tenant = tenants.find(t => t.id === contract?.tenant_id) || contract?.tenant;
    const house = houses.find(h => h.id === room?.house_id);

    return {
      ...bill,
      computed_contract: contract,
      computed_room: room,
      computed_tenant: tenant,
      computed_house: house
    };
  });

  async function handleSendEmail(bill) {
    if (!confirm(`Bạn muốn gửi bill tháng ${formatBillingMonth(bill.billing_month)} qua email cho phòng ${bill.computed_room?.room_number ?? bill.contract_id}?`)) return;
    setSendingId(bill.id);
    try {
      await api.post(`/bills/${bill.id}/send`);
      setBills((prev) => prev.map((b) => b.id === bill.id ? { ...b, status: "sent" } : b));
      alert("Đã gửi email thành công!");
    } catch (err) {
      alert(err.response?.data?.detail || "Gửi email thất bại.");
    } finally {
      setSendingId(null);
    }
  }

  
  async function handleSendBulkEmail(pendingBillsList) {
    if (!confirm(`Bạn có chắc chắn muốn gửi email cho ${pendingBillsList.length} hoá đơn chưa gửi?`)) return;
    
    setIsSendingBulk(true);
    let successCount = 0;
    let failCount = 0;

    
    for (const bill of pendingBillsList) {
      try {
        await api.post(`/bills/${bill.id}/send`);
        setBills((prev) => prev.map((b) => b.id === bill.id ? { ...b, status: "sent" } : b));
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Gửi email cho phòng ${bill.computed_room?.room_number} thất bại:`, err);
      }
    }

    setIsSendingBulk(false);
    
    if (failCount === 0) {
      alert(`Đã gửi thành công toàn bộ ${successCount} hoá đơn!`);
    } else {
      alert(`Hoàn tất: Đã gửi ${successCount} hoá đơn. Thất bại ${failCount} hoá đơn.`);
    }
  }

  async function handleMarkPaid(bill) {
    if (!confirm(`Xác nhận đã nhận tiền cho phòng ${bill.computed_room?.room_number ?? bill.contract_id} tháng ${formatBillingMonth(bill.billing_month)}?`)) return;
    try {
      await api.patch(`/bills/${bill.id}`, { status: "paid" });
      setBills((prev) => prev.map((b) => b.id === bill.id ? { ...b, status: "paid" } : b));
    } catch (err) {
      alert(err.response?.data?.detail || "Có lỗi xảy ra.");
    }
  }

  const houseFilteredBills = selectedHouse === "all" 
    ? enrichedBills 
    : enrichedBills.filter((b) => b.computed_room?.house_id === Number(selectedHouse));

  const finalDisplayedBills = houseFilteredBills.filter((b) => matches(b, filter));

  const totalUnpaid = finalDisplayedBills
    .filter((b) => b.status !== "paid")
    .reduce((sum, b) => sum + Number(b.total_amount), 0);

  const pendingBills = houseFilteredBills.filter((b) => b.status === "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <h1 className="text-2xl font-bold text-gray-800">Hoá đơn</h1>
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
        </div>
      </div>

      {totalUnpaid > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4 mb-6 mt-4">
          <p className="text-sm text-yellow-700">
            💰 Tổng tiền chưa thu: <span className="font-bold text-lg">{totalUnpaid.toLocaleString("vi-VN")}đ</span>
            {" "}({finalDisplayedBills.filter((b) => b.status !== "paid").length} bill)
          </p>
        </div>
      )}

    
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = houseFilteredBills.filter((b) => matches(b, f.key)).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition
                  ${filter === f.key ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"}`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${filter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {pendingBills.length > 0 && (
          <button
            onClick={() => handleSendBulkEmail(pendingBills)}
            disabled={isSendingBulk || sendingId !== null}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            {isSendingBulk ? "⏳ Đang gửi hàng loạt..." : `🚀 Gửi tất cả (${pendingBills.length} email)`}
          </button>
        )}
      </div>

    
      {finalDisplayedBills.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🧾</p>
          <p>Không có hoá đơn nào{filter !== "all" ? " trong mục này" : ""}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {finalDisplayedBills.map((bill) => (
            <BillCard 
              key={bill.id} 
              bill={bill} 
              onMarkPaid={handleMarkPaid} 
              onSendEmail={handleSendEmail} 
              sendingId={sendingId} 
              onEdit={setEditingBill} 
              userRole={userRole}
            />
          ))}
        </div>
      )}
      
      {editingBill && (
        <EditBillModal
          bill={editingBill}
          onClose={() => setEditingBill(null)}
          onSaved={() => {
            setEditingBill(null);
            loadBills(); 
          }}
        />
      )}
    </div>
  );
}