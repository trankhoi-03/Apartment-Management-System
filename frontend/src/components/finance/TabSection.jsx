import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function TabSection({ icon, title, colorTheme, summaryAmount, children }) {
  const [isOpen, setIsOpen] = useState(false);

  // Áp dụng style giống box "Tổng tiền chưa thu" của BillsPage
  const themeStyles = {
    green:  "bg-green-50 border-green-200 text-green-700",
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    gray:   "bg-gray-50 border-gray-200 text-gray-700",
    teal:   "bg-teal-50 border-teal-200 text-teal-700",
  };

  const styleClass = themeStyles[colorTheme] || themeStyles.gray;

  return (
    <div className={`border rounded-2xl mb-4 transition-all duration-200 ${styleClass} ${isOpen ? 'shadow-sm' : ''}`}>
      <div 
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-[15px] font-bold">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-base">
            {summaryAmount > 0 ? '+' : ''}{summaryAmount.toLocaleString('vi-VN')} đ
          </span>
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-4 pt-1">
          {/* Vùng chứa table bên trong với nền trắng mờ để nổi bật trên nền màu nhạt */}
          <div className="bg-white/60 rounded-xl p-4 text-sm text-gray-800">
             {children}
          </div>
        </div>
      )}
    </div>
  );
};

