import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    password: "",
    role: "staff", // Mặc định tạo tài khoản nhân viên/quản lý
  });
  const [showPassword, setShowPassword] = useState(false); 
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Gọi API đăng ký
      await api.post("/auth/register", form);
      
      alert("Tạo tài khoản thành công! Vui lòng đăng nhập.");
      navigate("/login"); // Chuyển hướng về trang đăng nhập
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(`Lỗi: ${detail[0].msg}`);
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Tạo tài khoản mới</h1>
          <p className="text-gray-500 mt-1 text-sm">Thiết lập phân quyền cho hệ thống</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên *
            </label>
            <input
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Ví dụ: Nguyễn Văn A"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại *
            </label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="0912345678"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu *
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="Ít nhất 8 ký tự"
                required
                minLength={8}
                className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phân quyền (Role) *
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
            >
              <option value="owner">Chủ trọ (Toàn quyền)</option>
              <option value="staff">Quản lý / Nhân viên (Hạn chế quyền)</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl text-base transition cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Đã có tài khoản?{" "}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Đăng nhập ngay
          </Link>
        </div>
        
      </div>
    </div>
  );
}