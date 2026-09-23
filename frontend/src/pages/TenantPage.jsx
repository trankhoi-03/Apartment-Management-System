import { useEffect, useState } from "react";
import api from "../api/axios";
import TenantFormModal from "../components/tenants/TenantFormModal";
import TenantDrawer from "../components/tenants/TenantDrawer";

const STATUS_TAGS = [
  { id: "status_active", label: "Đang thuê" },
  { id: "status_inactive", label: "Không HĐ" },
];

const ATTRIBUTE_TAGS = [
  { id: "attr_tam_tru", label: "Tạm trú" },
  { id: "attr_luu_tru", label: "Lưu trú" },
  { id: "attr_o_ghep", label: "Ở ghép" },
];

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [houses, setHouses] = useState([]); 
  const [rooms, setRooms] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState("all"); 
  
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [cccdSearchResult, setCccdSearchResult] = useState(null);

  const [selectedTags, setSelectedTags] = useState([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

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
    const query = searchQuery.trim();
    if (/^\d{12}$/.test(query)) {
      api.post(`/tenants/search/by-cccd`, { cccd: query })
        .then(res => setCccdSearchResult([res.data]))
        .catch(() => setCccdSearchResult([]));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCccdSearchResult(null); 
    }
  }, [searchQuery]);

  useEffect(() => {
    Promise.resolve().then(() => loadData());
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

  const toggleTag = (tagId) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const filteredTenants = tenants.filter((tenant) => {
    // 1. Kiểm tra Nhà trọ
    if (selectedHouse !== "all") {
      const hasContractInHouse = contracts.some((c) => {
        const matchedRoom = rooms.find(r => r.id === c.room_id);
        return c.tenant_id === tenant.id && matchedRoom?.house_id === Number(selectedHouse);
      });
      if (!hasContractInHouse) return false; 
    }

    // 2. Kiểm tra CCCD
    if (cccdSearchResult !== null) {
      if (!cccdSearchResult.some(result => result.id === tenant.id)) return false;
    }

    // 3. Kiểm tra Search Query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const isMatch = tenant.full_name?.toLowerCase().includes(query) ||
                      tenant.phone?.toLowerCase().includes(query) ||
                      tenant.identity_card?.toLowerCase().includes(query) ||
                      tenant.email?.toLowerCase().includes(query);
      if (!isMatch) return false;
    }

    // 4. KIỂM TRA TAGS
    if (selectedTags.length === 0) return true;

    const selectedStatusIds = selectedTags.filter(tag => tag.startsWith('status_'));
    const selectedAttrIds = selectedTags.filter(tag => tag.startsWith('attr_'));
    const activeContract = getActiveContract(tenant.id);

    // Lọc theo Trạng thái (OR logic)
    let isStatusMatch = true;
    if (selectedStatusIds.length > 0) {
      const currentStatusId = activeContract ? "status_active" : "status_inactive";
      isStatusMatch = selectedStatusIds.includes(currentStatusId);
    }

    // Lọc theo Đặc điểm (AND logic - phải thỏa mãn tất cả tag đặc điểm đang chọn)
    let isAttrMatch = true;
    if (selectedAttrIds.length > 0) {
      const tenantAttrs = [];
      if (activeContract) {
        if (activeContract.temp_residence_reg) tenantAttrs.push("attr_tam_tru");
        if (activeContract.temp_residence_dec) tenantAttrs.push("attr_luu_tru");
        if (activeContract.num_tenants > 1 || (activeContract.co_tenants && activeContract.co_tenants.length > 0)) {
          tenantAttrs.push("attr_o_ghep");
        }
      }
      isAttrMatch = selectedAttrIds.every(attr => tenantAttrs.includes(attr));
    }

    return isStatusMatch && isAttrMatch;
  });

  const getTagCount = (tagId) => {
    return tenants.filter(tenant => {
      const activeContract = getActiveContract(tenant.id);
      if (tagId.startsWith('status_')) {
        return tagId === (activeContract ? "status_active" : "status_inactive");
      }
      if (!activeContract) return false;
      if (tagId === "attr_tam_tru") return activeContract.temp_residence_reg;
      if (tagId === "attr_luu_tru") return activeContract.temp_residence_dec;
      if (tagId === "attr_o_ghep") return activeContract.num_tenants > 1 || (activeContract.co_tenants && activeContract.co_tenants.length > 0);
      return false;
    }).length;
  };

  const allAvailableTags = [...STATUS_TAGS, ...ATTRIBUTE_TAGS];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0 pr-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Người thuê</h1>
            <p className="text-sm text-gray-500 mt-0.5 whitespace-nowrap">{filteredTenants.length} người trong danh sách</p>
          </div>
          
          {houses.length > 0 && (
            <div className="w-full sm:flex-1 min-w-0 max-w-[300px]">
              <select
                value={selectedHouse}
                onChange={(e) => setSelectedHouse(e.target.value)}
                className="w-full block px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium text-gray-700 truncate"
              >
                <option value="all">🏢 Tất cả nhà trọ</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    🏠 {h.name} {h.address ? `- ${h.address}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 w-full lg:w-auto">
          <div className="relative w-full lg:w-72">
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col relative z-30">
        
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedTags([])}
            className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              selectedTags.length === 0
                ? "border-blue-600 text-blue-700 bg-blue-50/40"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            Tất cả
          </button>

          {allAvailableTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            const count = getTagCount(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "border-blue-600 text-blue-700 bg-blue-50/40"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {tag.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-blue-200/70 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-3 rounded-b-xl">
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Bộ lọc
              <span className="text-gray-400 ml-1">+</span>
            </button>

            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100 bg-gray-50">
                    <input 
                      type="text" 
                      placeholder="Tìm bộ lọc..." 
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                    {allAvailableTags
                      .filter(t => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
                      .map(tag => (
                        <label key={tag.id} className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group">
                          <input 
                            type="checkbox" 
                            checked={selectedTags.includes(tag.id)}
                            onChange={() => toggleTag(tag.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-blue-700">{tag.label}</span>
                        </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-gray-300 sm:pl-3">
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider hidden sm:block">Lọc theo:</span>
              {selectedTags.map(tagId => {
                const label = allAvailableTags.find(t => t.id === tagId)?.label;
                return (
                  <span key={tagId} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-200">
                    {label}
                    <button onClick={() => toggleTag(tagId)} className="text-blue-400 hover:text-red-500 font-bold leading-none mb-0.5">×</button>
                  </span>
                );
              })}
              <button onClick={() => setSelectedTags([])} className="text-xs font-medium text-gray-500 hover:text-red-600 hover:underline ml-1">
                Xóa lọc
              </button>
            </div>
          )}
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
            const contractHouse = contractRoom ? houses.find(h => h.id === contractRoom.house_id) : null;

            return (
              <div
                key={tenant.id}
                onClick={() => handleCardClick(tenant)}
                className={`bg-white rounded-2xl border shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-blue-200 transition
                            ${isSelected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"}`}
              >
                <div className={`flex justify-between items-start ${isActive ? 'mb-1' : 'mb-3'}`}>
                  <h3 className="text-lg font-bold text-gray-800">{tenant.full_name}</h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap
                    ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {isActive ? "Đang thuê" : "Không HĐ"}
                  </span>
                </div>
                {isActive && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-sm text-gray-500">🏢</span>
                    <span className="text-sm font-medium text-blue-600">
                      {contractHouse ? contractHouse.name : "Không xác định"}
                    </span>
                  </div>
                )}
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

                  {contract && (contract.temp_residence_reg || contract.temp_residence_dec || contract.num_tenants > 1 || (contract.co_tenants && contract.co_tenants.length > 0)) && (
                    <div className="flex gap-2 pt-1.5 pb-1">
                      {contract.temp_residence_reg && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                          Tạm trú
                        </span>
                      )}
                      {contract.temp_residence_dec && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                          Lưu trú
                        </span>
                      )}
                      {(contract.num_tenants > 1 || (contract.co_tenants && contract.co_tenants.length > 0)) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          Ở ghép
                        </span>
                      )}
                    </div>
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