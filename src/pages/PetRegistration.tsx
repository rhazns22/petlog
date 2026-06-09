import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Calendar, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getPetDefaultImage } from '../lib/petUtils';
import PetAvatar from '../components/PetAvatar';

const DOG_BREEDS = [
  '말티즈', '푸들', '포메라니안', '치와와', '시츄', '비숑 프리제', '진돗개', 
  '리트리버', '웰시코기', '닥스훈트', '요크셔테리어', '시바견', '스피츠', 
  '프렌치 불독', '골든 리트리버', '래브라도 리트리버', '사모예드', '허스키', '믹스견'
];

const CAT_BREEDS = [
  '코리안 쇼트헤어', '페르시안', '러시안 블루', '샴', '터키시 앙고라', 
  '스코티시 폴드', '먼치킨', '브리티시 쇼트헤어', '아비시니안', '랙돌', 
  '노르웨이 숲', '뱅갈', '메인쿤', '스핑크스', '믹스묘'
];

export default function PetRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    type: 'DOG',
    breed: '',
    birthDate: '',
    weight: '',
    gender: 'MALE',
    isNeutered: false,
    memo: '',
    photoURL: ''
  });
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPreviewImage(dataUrl);
          setFormData({ ...formData, photoURL: dataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBreedChange = (val: string) => {
    setFormData({ ...formData, breed: val });
    if (val.trim()) {
      const source = formData.type === 'DOG' ? DOG_BREEDS : formData.type === 'CAT' ? CAT_BREEDS : [];
      const filtered = source.filter(b => b.includes(val)).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectBreed = (breed: string) => {
    setFormData({ ...formData, breed });
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formData.name) {
      showToast('이름을 입력해주세요.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'pets'), {
        ownerId: user.uid,
        ...formData,
        weight: parseFloat(formData.weight) || 0,
        createdAt: serverTimestamp()
      });
      showToast('성공적으로 저장되었습니다.', 'success');
      navigate('/home');
    } catch (error) {
      console.error('Error saving pet:', error);
      showToast('반려동물 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-10 transition-colors">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1"><ChevronLeft className="w-6 h-6 text-[#191F28]" /></button>
          <span className="text-sm font-bold text-[#191F28]">홈</span>
        </div>
        <span className="text-base font-bold text-[#191F28]">반려동물 등록</span>
        <button onClick={() => navigate('/home')} className="text-sm text-[#8B95A1]">건너뛰기</button>
      </div>

      {/* Progress Bar */}
      <div className="flex h-1 px-4 gap-1 transform -translate-y-[1px]">
        <div className="flex-1 bg-[#12B886]"></div>
        <div className="flex-1 bg-[#12B886]"></div>
        <div className="flex-1 bg-[#F8FAF9]"></div>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] text-[#8B95A1] mb-6">2단계 / 3 — 반려동물 정보 입력</p>

        {/* Profile Image */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <label className="block cursor-pointer active:scale-95 transition-transform">
              <PetAvatar 
                pet={{ ...formData, photoURL: previewImage }} 
                size="xl" 
                className="border-4 border-white shadow-md"
              />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-[#12B886] rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </label>
          </div>
          <p className="text-[10px] text-[#8B95A1] mt-2 font-medium">사진을 눌러 변경</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2 text-[#191F28]">이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="초코"
              className="w-full h-14 bg-white border border-[#F2F4F6] rounded-[10px] px-5 focus:outline-none focus:border-[#12B886] text-[#191F28]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-[#191F28]">종류 *</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setFormData({ ...formData, type: 'DOG' })} 
                className={`flex-1 h-20 rounded-[10px] flex flex-col items-center justify-center gap-1 border-2 transition-all ${formData.type === 'DOG' ? 'bg-[#F8FAF9] border-[#12B886] text-[#191F28]' : 'bg-white border-transparent shadow-sm text-[#8B95A1]'}`}
              >
                <span className="text-2xl">🐶</span>
                <span className="text-xs font-bold">강아지</span>
              </button>
              <button 
                onClick={() => setFormData({ ...formData, type: 'CAT' })} 
                className={`flex-1 h-20 rounded-[10px] flex flex-col items-center justify-center gap-1 border-2 transition-all ${formData.type === 'CAT' ? 'bg-[#F8FAF9] border-[#12B886] text-[#191F28]' : 'bg-white border-transparent shadow-sm text-[#8B95A1]'}`}
              >
                <span className="text-2xl">🐱</span>
                <span className="text-xs font-bold">고양이</span>
              </button>
              <button 
                onClick={() => setFormData({ ...formData, type: 'OTHER' })} 
                className={`flex-1 h-20 rounded-[10px] flex flex-col items-center justify-center gap-1 border-2 transition-all ${formData.type === 'OTHER' ? 'bg-[#F8FAF9] border-[#12B886] text-[#191F28]' : 'bg-white border-transparent shadow-sm text-[#8B95A1]'}`}
              >
                <span className="text-2xl">🐾</span>
                <span className="text-xs font-bold">기타</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-[#191F28]">품종 *</label>
            <div className="relative">
              <input
                type="text"
                value={formData.breed}
                onChange={(e) => handleBreedChange(e.target.value)}
                onFocus={() => {
                  if (formData.breed) setShowSuggestions(suggestions.length > 0);
                  else {
                    const source = formData.type === 'DOG' ? DOG_BREEDS : formData.type === 'CAT' ? CAT_BREEDS : [];
                    setSuggestions(source.slice(0, 5));
                    setShowSuggestions(true);
                  }
                }}
                placeholder="포메라니안"
                className="w-full h-14 bg-white border border-[#F2F4F6] rounded-[10px] px-5 focus:outline-none focus:border-[#12B886] text-[#191F28]"
              />
              <button 
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#12B886] text-white text-[10px] px-2 py-1 rounded-[4px]"
              >
                자동완성
              </button>

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-[10px] shadow-lg z-20 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectBreed(s)}
                      className="w-full text-left px-5 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      {s}
                    </button>
                  ))}
                  {suggestions.length === 0 && (
                    <div className="px-5 py-3 text-xs text-[#ADB5BD]">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-[#8B95A1] mb-2">생년월일</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  placeholder="2021.03.15"
                  className="w-full h-12 bg-white border border-[#F2F4F6] rounded-full px-10 focus:outline-none focus:border-[#12B886] text-sm text-[#191F28]"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A1]" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[#8B95A1] mb-2">몸무게</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="3.2"
                  className="w-full h-12 bg-white border border-[#F2F4F6] rounded-full px-5 pr-10 focus:outline-none focus:border-[#12B886] text-sm text-right text-[#191F28]"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B95A1] text-sm">kg</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-[#191F28]">성별</label>
            <div className="flex gap-4">
              <button 
                onClick={() => setFormData({ ...formData, gender: 'MALE' })}
                className={`flex-1 h-12 rounded-full text-sm font-medium border transition-all ${formData.gender === 'MALE' ? 'bg-[#F8FAF9] border-[#12B886] text-[#12B886]' : 'bg-white border-transparent text-[#8B95A1]'}`}
              >
                남아
              </button>
              <button 
                onClick={() => setFormData({ ...formData, gender: 'FEMALE' })}
                className={`flex-1 h-12 rounded-full text-sm font-medium border transition-all ${formData.gender === 'FEMALE' ? 'bg-[#F8FAF9] border-[#12B886] text-[#12B886]' : 'bg-white border-transparent text-[#8B95A1]'}`}
              >
                여아
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-[#191F28]">중성화 여부</label>
              <div className="flex items-center gap-2 text-xs text-[#12B886]">
                <span className={formData.isNeutered ? 'text-[#12B886]' : 'text-[#8B95A1]'}>
                  {formData.isNeutered ? '중성화 완료' : '미완료'}
                </span>
                <button 
                  onClick={() => setFormData({ ...formData, isNeutered: !formData.isNeutered })}
                  className={`w-12 h-6 rounded-full relative transition-colors ${formData.isNeutered ? 'bg-[#12B886]' : 'bg-[#F8FAF9]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isNeutered ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-[#191F28]">메모 (선택)</label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="알러지, 특이사항, 보험 정보 등을 입력하세요."
              className="w-full h-24 bg-white border border-[#F2F4F6] rounded-[10px] p-4 focus:outline-none focus:border-[#12B886] text-sm resize-none text-[#191F28]"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full h-15 bg-[#12B886] text-white font-bold rounded-[10px] shadow-lg shadow-[#12B886]/10 mt-8 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {loading ? '저장 중...' : '등록 하기'}
        </button>
      </div>
    </div>
  );
}

