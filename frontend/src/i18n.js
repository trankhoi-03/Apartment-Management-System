import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi) // Báo cho i18n biết phải đi tải file JSON
  .use(initReactI18next)
  .init({
    lng: localStorage.getItem('app_language') || 'vi', 
    fallbackLng: 'vi',
    
    backend: {
      // Đường dẫn chỉ tới thư mục public/locales của bạn
      loadPath: '/locales/{{lng}}/{{ns}}.json', 
    },
    
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;