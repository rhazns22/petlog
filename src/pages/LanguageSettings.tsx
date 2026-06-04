import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageSettings() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { id: 'ko', label: '한국어', sub: 'Korean' },
  ];

  const handleSelect = (id: string) => {
    setLanguage(id as any);
    setTimeout(() => navigate(-1), 300);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">{t.language.title}</span>
        <div className="w-10" />
      </div>

      <div className="p-6">
        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm border border-gray-100">
          {languages.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className="w-full p-5 flex items-center justify-between border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col items-start">
                <span className={`text-sm font-bold ${language === item.id ? 'text-[#3B82F6]' : 'text-[#4E5968]'}`}>
                  {item.label}
                </span>
                <span className="text-[10px] text-[#ADB5BD] font-medium">{item.sub}</span>
              </div>
              {language === item.id && <Check className="w-5 h-5 text-[#3B82F6]" />}
            </button>
          ))}
        </div>

        <p className="mt-6 px-4 text-[10px] text-[#ADB5BD] leading-relaxed font-medium">
          {t.language.select}
        </p>
      </div>
    </div>
  );
}
