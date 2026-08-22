import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import StaffFormModal from "../components/staffs/StaffFormModal"; 

export default function StaffPage() {
  const [staffs, setStaffs] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHouse, setSelectedHouse] = useState("all");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [houseSelect, setHouseSelect] = useState("");
  const [submitError, setSubmitError] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [housesRes, staffsRes] = await Promise.all([
        api.get("/houses").catch(() => ({ data: [] })),
        api.get("/staffs").catch(() => ({ data: [] })),
      ]);
      setHouses(housesRes.data);
      setStaffs(staffsRes.data);
      if (housesRes.data.length > 0) {
        setHouseSelect(housesRes.data[0].id.toString());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function handleSaved() {
    setShowAddModal(false);
    loadData(); 
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    setSubmitError("");
    try {
      await api.post(`/houses/${houseSelect}/add-staff?staff_phone=${phoneInput}`);
      alert("Đã cấp quyền thành công! Bạn có thể gửi tài khoản cho nhân viên qua Zalo.");
      setShowAddModal(false);
      setPhoneInput("");
      loadData();
    } catch (err) {
      if (err.response?.status === 404) {
        setSubmitError("Số điện thoại chưa được đăng ký. Vui lòng sang trang Đăng ký để tạo tài khoản trước.");
      } else {
        setSubmitError(err.response?.data?.detail || "Có lỗi xảy ra.");
      }
    }
  }

  async function handleRemoveAccess(staffId, houseId, houseName) {
    if (!confirm(`Thu hồi quyền quản lý nhà "${houseName}" của nhân viên này?`)) return;
    try {
      await api.delete(`/staffs/${staffId}/houses/${houseId}`);
      loadData();
    } catch (err) {
      alert("Không thể thu hồi quyền.");
    }
  }

  const filteredStaffs = staffs.filter((staff) => {
    if (selectedHouse !== "all") {
      const managesHouse = staff.managed_houses?.some(h => h.id.toString() === selectedHouse);
      if (!managesHouse) return false;
    }
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return staff.full_name?.toLowerCase().includes(query) || staff.phone?.includes(query);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Nhân viên</h1>
            <p className="text-sm text-gray-500 mt-0.5">{filteredStaffs.length} nhân viên trong danh sách này</p>
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
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Tìm tên, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap shadow-sm"
          >
            + Thêm nhân viên
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-gray-400">Đang tải...</div>
      ) : filteredStaffs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">👨‍💼</p>
          <p className="mb-4">Hãy đăng ký tài khoản cho nhân viên ở trang Đăng ký trước.</p>
          <Link to="/register" className="px-5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold transition">
            Đi đến trang Đăng ký
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaffs.map((staff) => (
            <div key={staff.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                  {staff.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{staff.full_name}</h3>
                  <p className="text-sm text-gray-500">{staff.phone}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Nhà đang quản lý</p>
                {staff.managed_houses?.map(h => (
                  <div key={h.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg text-sm">
                    <span className="font-medium text-gray-700 truncate mr-2">🏢 {h.name}</span>
                    <button 
                      onClick={() => handleRemoveAccess(staff.id, h.id, h.name)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs whitespace-nowrap"
                    >
                      Xóa quyền
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL THÊM NHÂN VIÊN */}
      {showAddModal && (
        <StaffFormModal
            houses={houses}
            selectedHouseId={selectedHouse !== "all" ? selectedHouse : null}
            onClose={() => setShowAddModal(false)}
            onSaved={handleSaved}
        />
      )}
    </div>
  );
}