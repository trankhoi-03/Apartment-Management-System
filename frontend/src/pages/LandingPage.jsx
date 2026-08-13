import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* ─── NAvigation Bar (Header) ─── */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          {/* Logo / Tên thương hiệu */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">
              QuảnLý<span className="text-blue-600">PhòngTrọ</span>
            </span>
          </div>

          {/* Cụm nút Đăng nhập / Đăng ký ở góc phải */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              to="/login" 
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition"
            >
              Đăng nhập
            </Link>
            <Link 
              to="/register" 
              className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition hover:shadow flex items-center gap-2"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section (Phần giới thiệu chính) ─── */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
            Giải pháp quản lý nhà trọ <br className="hidden md:block" />
            <span className="text-blue-600 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              toàn diện & tự động hoá
            </span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Tối ưu hoá quy trình tính tiền, xuất hoá đơn, quản lý hợp đồng và theo dõi sự cố. Giúp chủ trọ tiết kiệm 80% thời gian quản lý mỗi tháng.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/register" 
              className="px-8 py-4 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              Bắt đầu dùng thử miễn phí
            </Link>
            <a 
              href="#features" 
              className="px-8 py-4 text-base font-bold bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-2xl shadow-sm transition-all"
            >
              Khám phá tính năng
            </a>
          </div>
        </section>

        {/* ─── Features Section (Các tính năng nổi bật) ─── */}
        <section id="features" className="bg-white py-20 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900">Mọi thứ bạn cần để quản lý hiệu quả</h2>
              <p className="mt-4 text-gray-500">Được thiết kế tối ưu dành riêng cho chủ nhà trọ và người quản lý.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-blue-100 hover:bg-blue-50/50 transition">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl mb-6">
                  🧾
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Tự động hoá đơn</h3>
                <p className="text-gray-600 leading-relaxed">
                  Tính toán chính xác tiền điện, nước, dịch vụ. Gửi email thông báo hoá đơn hàng loạt cho khách thuê chỉ với 1 lượt click.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-green-100 hover:bg-green-50/50 transition">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl mb-6">
                  📥
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Import/Export Excel</h3>
                <p className="text-gray-600 leading-relaxed">
                  Thao tác dữ liệu cực nhanh. Cung cấp sẵn file mẫu chuẩn, hỗ trợ nhập xuất hàng trăm phòng và hợp đồng ngay lập tức.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/50 transition">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl mb-6">
                  ⚠️
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Cảnh báo sự cố</h3>
                <p className="text-gray-600 leading-relaxed">
                  Tiếp nhận và quản lý trạng thái hư hỏng. Tự động highlight cảnh báo đỏ nếu sự cố chưa được xử lý quá 3 ngày.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Call to Action Cuối trang ─── */}
        <section className="bg-blue-600 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Sẵn sàng số hoá quy trình quản lý của bạn?</h2>
            <Link 
              to="/register" 
              className="inline-block px-8 py-4 text-base font-bold bg-white text-blue-600 hover:bg-gray-50 rounded-2xl shadow-lg transition-transform transform hover:-translate-y-1"
            >
              Tạo tài khoản miễn phí ngay
            </Link>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="bg-white border-t border-gray-200 py-8 text-center">
        <p className="text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Quản Lý Phòng Trọ. All rights reserved.
        </p>
      </footer>
    </div>
  );
}