import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageSelection() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { id: 'ko', label: '한국어', sub: 'Korean' },
    { id: 'en', label: 'English', sub: '영어' },
  ];

  const handleSelect = (id: string) => {
    setLanguage(id as any);
    setTimeout(() => navigate(-1), 300);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">{t.language.title}</span>
        <div className="w-10" />
      </div>

      <div className="p-6">
        <p className="text-sm font-bold text-[#ADB5BD] mb-6 px-1">
          {t.language.select}
        </p>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm border border-gray-100">
          {languages.map((lang, i) => (
            <button
              key={lang.id}
              onClick={() => handleSelect(lang.id)}
              className={`w-full flex items-center justify-between p-5 transition-colors ${
                i !== languages.length - 1 ? 'border-b border-gray-50' : ''
              } ${language === lang.id ? 'bg-[#E9FBF5]' : 'active:bg-gray-50'}`}
            >
              <div className="flex flex-col items-start">
                <span className={`text-sm font-bold ${language === lang.id ? 'text-[#12B886]' : 'text-[#4E5968]'}`}>
                  {lang.label}
                </span>
                <span className="text-[10px] text-[#ADB5BD] font-medium">{lang.sub}</span>
              </div>
              {language === lang.id && (
                <div className="w-6 h-6 bg-[#12B886] rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
