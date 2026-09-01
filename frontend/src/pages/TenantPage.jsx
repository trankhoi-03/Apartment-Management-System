import { useEffect, useState } from "react";
import api from "../api/axios";
import TenantFormModal from "../components/tenants/TenantFormModal";
import TenantDrawer from "../components/tenants/TenantDrawer";

export default function TenantsPage() {
  const [tenants, setTenants]           = useState([]);
  const [contracts, setContracts]       = useState([]);
  const [houses, setHouses]             = useState([]); 
  const [rooms, setRooms]               = useState([]);
  const [selectedHouse, setSelectedHouse] = useState("all"); 
  
  const [loading, setLoading]           = useState(true);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editingTenant, setEditingTenant]   = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [searchQuery, setSearchQuery]   = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [housesRes, tenantsRes, contractsRes, roomsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/tenants"),
        api.get("/contracts"),
        api.get("/rooms").catch(() => ({ data: [] })), 
      ]);
      setHouses(housesRes.data);
      setTenants(tenantsRes.data);
      setContracts(contractsRes.data); 
      setRooms(roomsRes.data); 
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });

  }, []);

  function getActiveContract(tenantId) {
    return contracts.find((c) => c.tenant_id === tenantId && c.status === "active") ?? null;
  }

  function getLastEndedContract(tenantId) {
    const endedContracts = contracts.filter((c) => c.tenant_id === tenantId && c.status === "ended");
    if (endedContracts.length === 0) return null;
    return endedContracts.sort((a, b) => b.id - a.id)[0];
  }

  function handleCardClick(tenant) {
    setSelectedTenant((prev) => prev?.id === tenant.id ? null : tenant);
  }

  function handleEdit(tenant) {
    setEditingTenant(tenant);
    setShowForm(true);
  }

  function handleSaved() {
    setShowForm(false);
    setEditingTenant(null);
    loadData();
    if (editingTenant) {
      api.get(`/tenants/${editingTenant.id}`).then((res) => setSelectedTenant(res.data));
    }
  }

  function handleDeleted() {
    setSelectedTenant(null);
    loadData();
  }

  
  const filteredTenants = tenants.filter((tenant) => {
    // 1. Kiểm tra Nhà trọ
    if (selectedHouse !== "all") {
      const hasContractInHouse = contracts.some((c) => {
        // FIX 3: Dùng danh sách rooms để tìm house_id
        const matchedRoom = rooms.find(r => r.id === c.room_id);
        return c.tenant_id === tenant.id && matchedRoom?.house_id === Number(selectedHouse);
      });
      if (!hasContractInHouse) return false; 
    }

    // 2. Kiểm tra Search Query
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true; 
    
    return (
      tenant.full_name?.toLowerCase().includes(query) ||
      tenant.phone?.toLowerCase().includes(query) ||
      tenant.identity_card?.toLowerCase().includes(query) ||
      tenant.email?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Người thuê</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {filteredTenants.length} người trong danh sách này
            </p>
          </div>
          
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
        
        <div className="relative w-full md:w-80 mt-2 md:mt-0">
          <input
            type="text"
            placeholder="Tìm tên, CCCD, SĐT, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">👤</p>
          <p>Chưa có người thuê nào.</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>Không tìm thấy khách thuê nào khớp với bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const contract = getActiveContract(tenant.id);
            const isActive = !!contract;
            const isSelected = selectedTenant?.id === tenant.id;
            const lastEndedContract = !isActive ? getLastEndedContract(tenant.id) : null;

            const contractRoom = contract ? rooms.find(r => r.id === contract.room_id) : null;

            return (
              <div
                key={tenant.id}
                onClick={() => handleCardClick(tenant)}
                className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-blue-200 transition
                            ${isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-gray-800">{tenant.full_name}</h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap
                    ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {isActive ? "Đang thuê" : "Không HĐ"}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  {contract && (
                    <p>Phòng: <span className="font-medium text-blue-600">
                      {contractRoom?.room_number ? `Phòng ${contractRoom.room_number}` : `Room ID ${contract.room_id}`}
                    </span></p>
                  )}
                  <p>SĐT: <span className="font-medium text-gray-800">{tenant.phone}</span></p>
                  {tenant.email && (
                    <p className="truncate">Email: <span className="font-medium text-gray-800">{tenant.email}</span></p>
                  )}
                  {lastEndedContract?.end_reason && (
                    <div className="pt-2 mt-2 border-t border-gray-50">
                      <p className="text-orange-600 text-xs mt-1">
                        Lý do kết thúc: <span className="font-medium text-sm">{lastEndedContract.end_reason}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTenant && (
        <TenantDrawer
          tenant={selectedTenant}
          activeContract={getActiveContract(selectedTenant.id)}
          pastContracts={contracts
            .filter((c) => c.tenant_id === selectedTenant.id && c.status === "ended")
            .sort((a, b) => b.id - a.id)
          }
          houses={houses}
          rooms={rooms} 
          onClose={() => setSelectedTenant(null)}
          onEdit={handleEdit}
          onDeleted={handleDeleted}
        />
      )}

      {showForm && (
        <TenantFormModal
          tenant={editingTenant}
          onClose={() => { setShowForm(false); setEditingTenant(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}