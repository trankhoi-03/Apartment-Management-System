import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { phone, password });
      localStorage.setItem("access_token", res.data.access_token);
      const role = res.data.role || res.data.user?.role || "staff";
      localStorage.setItem("user_role", role);
      const fullName = res.data.full_name || res.data.user?.full_name || (role === "owner" ? "Chủ trọ" : "Nhân viên");
      localStorage.setItem("full_name", fullName);
      // Redirect về dashboard sau khi login thành công
      window.location.href = "/";
    } catch (err) {
      const msg = err.response?.data?.detail;
      setError(msg || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý phòng trọ</h1>
          <p className="text-gray-500 mt-1 text-sm">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition"
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

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                            px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white font-semibold py-3 rounded-xl text-base
                       transition cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <div className="mt-6 text-center text-sm text-gray-500">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">
              Đăng ký ngay
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}