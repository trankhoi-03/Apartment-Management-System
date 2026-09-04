import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import StaffFormModal from "../components/staffs/StaffFormModal"; 

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

export default function StaffPage() {
  const [staffs, setStaffs] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHouse, setSelectedHouse] = useState("all");
  
  const [showAddModal, setShowAddModal] = useState(false);
  // const [phoneInput, setPhoneInput] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [houseSelect, setHouseSelect] = useState("");
  // const [submitError, setSubmitError] = useState("");

  const [grantingStaff, setGrantingStaff] = useState(null);
  const [grantHouseId, setGrantHouseId] = useState("");
  const [grantingLoading, setGrantingLoading] = useState(false);

  const [editingFeeHouse, setEditingFeeHouse] = useState(null);
  const [feeInput, setFeeInput] = useState("");
  const [feeLoading, setFeeLoading] = useState(false);

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

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, []);

  async function handleUpdate(e) {
    e.preventDefault();
    setFeeLoading(true);
    try {
      await api.patch(`/houses/${editingFeeHouse.id}`, { 
        employee_fee: feeInput ? Number(feeInput) : 0 
      });
      alert("Cập nhật phí quản lý thành công!");
      setEditingFeeHouse(null);
      loadData(); 
    } catch (err) {
      alert(err.response?.data?.detail || "Có lỗi xảy ra khi cập nhật phí.");
    } finally {
      setFeeLoading(false);
    }
  }

  function handleSaved() {
    setShowAddModal(false);
    loadData(); 
  }

  async function handleRemoveAccess(staffId, houseId, houseName) {
    if (!confirm(`Thu hồi quyền quản lý nhà "${houseName}" của nhân viên này?`)) return;
    try {
      await api.delete(`/staffs/${staffId}/houses/${houseId}`);
      loadData();
    } catch {
      alert("Không thể thu hồi quyền.");
    }
  }

  async function handleGrantAdditionalAccess() {
    if (!grantHouseId) return alert("Vui lòng chọn nhà trọ để cấp quyền.");
    setGrantingLoading(true);
    try {
      await api.post("/staffs", {
        phone: grantingStaff.phone,
        house_id: Number(grantHouseId)
      });
      
      alert("Đã cấp quyền thêm thành công!");
      setGrantingStaff(null);
      setGrantHouseId("");
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Có lỗi xảy ra khi cấp quyền.");
    } finally {
      setGrantingLoading(false);
    }
  }

  async function handleDeleteStaff(staffId, staffName) {
    if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn cho thôi việc và xóa tài khoản của nhân viên "${staffName}"? Hành động này sẽ xóa vĩnh viễn quyền truy cập của nhân viên này khỏi hệ thống.`)) return;
    try {
      await api.delete(`/staffs/${staffId}`);
      alert("Đã xóa nhân viên thành công.");
      loadData(); // Tải lại danh sách sau khi xóa
    } catch (err) {
      alert(err.response?.data?.detail || "Không thể xóa nhân viên.");
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
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                    {staff.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{staff.full_name}</h3>
                    <p className="text-sm text-gray-500">{staff.phone}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleDeleteStaff(staff.id, staff.full_name)}
                  className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition ml-2"
                  title="Cho thôi việc (Xóa tài khoản)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Nhà đang quản lý</p>
                  <button 
                    onClick={() => {
                      setGrantingStaff(staff);
                      setGrantHouseId(""); 
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium text-xs whitespace-nowrap transition"
                  >
                    + Cấp quyền thêm
                  </button>
                </div>

                {staff.managed_houses?.map(h => (
                  <div key={h.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg text-sm">
                    <div className="flex flex-col truncate mr-2">
                        <span className="font-medium text-gray-700 truncate">🏢 {h.name}</span>
                        {h.employee_fee ? (
                           <span className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                             <span>Phí QL: <strong className="text-gray-800">{Number(h.employee_fee).toLocaleString("vi-VN")}đ</strong></span>
                             <button 
                               onClick={() => { setEditingFeeHouse(h); setFeeInput(h.employee_fee); }}
                               className="text-blue-500 hover:text-blue-700 hover:underline"
                             >
                               Sửa
                             </button>
                           </span>
                        ) : (
                           <span className="text-xs text-gray-400 mt-0.5 italic flex items-center gap-2">
                             Chưa thiết lập phí QL
                             <button 
                               onClick={() => { setEditingFeeHouse(h); setFeeInput(""); }}
                               className="text-blue-500 hover:text-blue-700 hover:underline not-italic font-medium"
                             >
                               Thêm
                             </button>
                           </span>
                        )}
                    </div>
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

      {showAddModal && (
        <StaffFormModal
            houses={houses}
            selectedHouseId={selectedHouse !== "all" ? selectedHouse : null}
            onClose={() => setShowAddModal(false)}
            onSaved={handleSaved}
        />
      )}

      {grantingStaff && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Cấp quyền thêm</h3>
            <p className="text-sm text-gray-500 mb-5">
              Nhân viên: <span className="font-medium text-gray-800">{grantingStaff.full_name}</span> ({grantingStaff.phone})
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Chọn nhà trọ muốn cấp quyền</label>
              <select
                value={grantHouseId}
                onChange={(e) => setGrantHouseId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn nhà trọ --</option>
                {houses
                  .filter(h => !grantingStaff.managed_houses?.some(mh => mh.id === h.id))
                  .map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              
              {houses.filter(h => !grantingStaff.managed_houses?.some(mh => mh.id === h.id)).length === 0 && (
                <p className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded-lg">
                  Nhân viên này đã được cấp quyền quản lý tất cả các nhà trọ hiện có.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setGrantingStaff(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleGrantAdditionalAccess}
                disabled={grantingLoading || !grantHouseId}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition"
              >
                {grantingLoading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA PHÍ QUẢN LÝ */}
      {editingFeeHouse && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Cập nhật phí quản lý</h3>
            <p className="text-sm text-gray-500 mb-5">
              Nhà trọ: <span className="font-medium text-gray-800">{editingFeeHouse.name}</span>
            </p>
            
            <form onSubmit={handleUpdate}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Phí quản lý nhân viên (đ/tháng)</label>
                {/* <input
                  type="number"
                  min="0"
                  required
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  placeholder="Ví dụ: 3000000"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                /> */}
                <FormattedNumberInput 
                  name="employee_fee"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  placeholder="Ví dụ: 3,000,000"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFeeHouse(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={feeLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition"
                >
                  {feeLoading ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}