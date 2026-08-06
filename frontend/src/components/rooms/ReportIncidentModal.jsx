import { useState } from "react";
import api from "../../api/axios";

export default function ReportIncidentModal({ room, onClose, onReported }) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Vui lòng nhập mô tả sự cố.");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      await api.post("/incidents", {
        room_id: room.id,
        description: description,
        status: "received" 
      });
      onReported();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Lỗi khi báo cáo sự cố.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Báo cáo sự cố</h2>
        <p className="text-sm text-gray-500 mb-5">Phòng {room?.room_number}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả sự cố / Hư hỏng *
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: Vỡ ống nước nhà vệ sinh, hỏng bóng đèn..."
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-sm font-medium transition">
              {loading ? "Đang gửi..." : "Báo cáo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}