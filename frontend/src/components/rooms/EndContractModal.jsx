import { useState } from "react";
import api from "../../api/axios";

export default function EndContractModal({ contract, roomNumber, onClose, onEnded }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.patch(`/contracts/${contract.id}`, {
        status: "ended",
        ...(reason.trim() && { end_reason: reason.trim() }),
      });
      onEnded();
    } catch (err) {
      setError(err.response?.data?.detail || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Kết thúc hợp đồng</h2>
        <p className="text-sm text-gray-500 mb-5">
          Phòng {roomNumber} — {contract.tenant?.full_name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lý do kết thúc
              <span className="text-gray-400 font-normal ml-1">(không bắt buộc)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="vd: Hết hạn hợp đồng, người thuê chuyển đi, vi phạm nội quy..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <p className="text-sm text-orange-700">
              ⚠️ Hành động này sẽ kết thúc hợp đồng và chuyển phòng về trạng thái
              <strong> Trống</strong>. Không thể hoàn tác.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                         font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600
                         disabled:bg-orange-300 text-white rounded-xl text-sm
                         font-medium transition">
              {loading ? "Đang xử lý..." : "Xác nhận kết thúc"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}