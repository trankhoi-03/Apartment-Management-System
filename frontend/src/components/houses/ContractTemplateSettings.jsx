import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";

const AVAILABLE_VARIABLES = [
  { key: "[NGAY_TAO]",       label: "Ngày ký HĐ (Hôm nay)" },
  { key: "[TEN_NHA]",        label: "Tên nhà trọ" },
  { key: "[DIA_CHI_NHA]",    label: "Địa chỉ nhà trọ" },
  { key: "[SO_PHONG]",       label: "Số phòng" },
  { key: "[TEN_CHU_NHA]",    label: "Tên Chủ nhà" },
  { key: "[TEN_KHACH]",      label: "Tên Người thuê" },
  { key: "[SDT_KHACH]",      label: "SĐT Người thuê" },
  { key: "[CCCD_KHACH]",     label: "CCCD Người thuê" },
  { key: "[SO_NGUOI]",       label: "Số người ở" },
  { key: "[SO_XE]",          label: "Số xe" },
  { key: "[NOI_THAT]",       label: "Danh sách nội thất" },
  { key: "[GIA_THUE]",       label: "Giá thuê/Tháng" },
  { key: "[TIEN_COC]",       label: "Tiền cọc" },
  { key: "[GIA_DIEN]",       label: "Đơn giá Điện" },
  { key: "[GIA_NUOC]",       label: "Đơn giá Nước" },
  { key: "[CHI_SO_DIEN]",    label: "Chỉ số Điện ban đầu" },
  { key: "[CHI_SO_NUOC]",    label: "Chỉ số Nước ban đầu" },
  { key: "[NGAY_BAT_DAU]",   label: "Ngày bắt đầu thuê" },
  { key: "[NGAY_KET_THUC]",  label: "Ngày kết thúc thuê" },
];

export default function ContractTemplateSettings({ houseId, onClose }) {
  const [base64File, setBase64File] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadTemplate() {
      try {
        const res = await api.get(`/houses/${houseId}`);
        const templateData = res.data.contract_template;
        if (templateData && templateData.startsWith("UEs")) {
          setFileName("Mau_Hop_Dong_Hien_Tai.docx");
          setBase64File(templateData);
        }
      } catch (err) {
        setError("Không thể tải thông tin nhà trọ.");
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [houseId]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      setError("Chỉ hỗ trợ file Word định dạng .docx");
      return;
    }

    setFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      // Tách bỏ phần "data:application/vnd.openxmlformats...;base64,"
      const base64String = event.target.result.split(',')[1];
      setBase64File(base64String);
    };
    reader.readAsDataURL(file);
  };

  async function handleSave() {
    if (!base64File) {
      setError("Vui lòng tải lên một file mẫu hợp đồng (.docx)");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/houses/${houseId}`, { contract_template: base64File });
      alert("Đã lưu mẫu hợp đồng gốc thành công!");
      onClose();
    } catch (err) {
      setError("Lỗi khi lưu mẫu hợp đồng.");
    } finally {
      setSaving(false);
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col h-[85vh]">
        
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Cài đặt Mẫu Hợp Đồng</h2>
            <p className="text-sm text-gray-500 mt-1">Upload file Word (.docx) gốc của bạn lên hệ thống.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center text-gray-400">Đang tải...</div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* CỘT TRÁI: KHU VỰC UPLOAD FILE */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center border-r border-gray-100 h-full bg-white relative">
              
              <div 
                className={`w-full max-w-sm p-8 border-2 border-dashed rounded-2xl text-center transition-colors
                  ${fileName ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer'}`}
                onClick={() => !fileName && fileInputRef.current.click()}
              >
                <div className="text-5xl mb-4">{fileName ? "📄" : "📤"}</div>
                {fileName ? (
                  <div>
                    <p className="font-bold text-blue-700 truncate mb-2">{fileName}</p>
                    <button 
                      onClick={() => { setFileName(""); setBase64File(null); }}
                      className="text-xs font-semibold text-red-500 hover:underline"
                    >
                      Xóa và tải lên file khác
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-gray-700 mb-1">Bấm vào đây để chọn file</p>
                    <p className="text-xs text-gray-500">Chỉ hỗ trợ file Word (.docx)</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept=".docx" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </div>

              <div className="mt-8 bg-amber-50 p-4 rounded-xl text-amber-800 text-sm w-full max-w-sm border border-amber-100">
                <p className="font-bold mb-1 flex items-center gap-2">💡 Hướng dẫn:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
                  <li>Soạn thảo hợp đồng chuẩn của bạn bằng MS Word.</li>
                  <li>Copy các biến ở cột bên phải dán vào vị trí cần điền trong file Word.</li>
                  <li>Lưu file Word đó lại và Upload lên đây.</li>
                </ul>
              </div>
            </div>

            {/* CỘT PHẢI: DANH SÁCH BIẾN */}
            <div className="w-full md:w-80 bg-gray-50 p-5 overflow-y-auto h-full border-t md:border-t-0 border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                🧩 Biến tự động
              </h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Bấm vào biến để Copy, sau đó dán vào file Word của bạn.
              </p>
              
              <div className="space-y-2">
                {AVAILABLE_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    onClick={() => copyToClipboard(v.key)}
                    className="w-full text-left px-3 py-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg text-sm transition group flex justify-between items-center relative"
                  >
                    <div>
                      <span className="font-mono text-blue-600 font-semibold block text-xs mb-0.5">{v.key}</span>
                      <span className="text-gray-600 text-xs">{v.label}</span>
                    </div>
                    {copiedKey === v.key && (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Đã Copy</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-2xl">
          {error ? <span className="text-red-500 text-sm font-medium">{error}</span> : <div></div>}
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition">
              Huỷ
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || !base64File} 
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu mẫu hợp đồng"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}