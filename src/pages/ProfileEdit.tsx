import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Check, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { updateProfile, User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.displayName) setDisplayName(data.displayName);
          if (data.photoURL) setPhotoURL(data.photoURL);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, [user]);

  const handleUpdate = async () => {
    if (!user || !displayName.trim()) {
      showToast('이름을 입력해주세요.', 'error');
      return;
    }
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        photoURL: photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if ('emailVerified' in user) {
        try {
          await updateProfile(user as FirebaseUser, {
            displayName: displayName.trim(),
          });
        } catch (authErr) {
          console.warn('Auth profile sync failed:', authErr);
        }
      }

      showToast('프로필이 업데이트되었습니다.', 'success');
      navigate('/profile');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast('업데이트 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setPhotoURL(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const isChanged = displayName !== (user?.displayName || '') || photoURL !== (user?.photoURL || '');

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Toss Style Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md h-14 flex items-center px-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-[#191F28]">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold text-[#191F28]">프로필 수정</span>
      </div>

      <div className="flex-1 px-6 pt-10 pb-32">
        {/* Profile Image Section - Cleaner */}
        <div className="flex flex-col items-center mb-16">
          <div className="relative group">
            <label className="block w-28 h-28 rounded-full overflow-hidden bg-gray-100 cursor-pointer active:scale-95 transition-all shadow-inner ring-4 ring-gray-50">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">👤</div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </label>
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#12B886] text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white pointer-events-none">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-4 text-[13px] font-bold text-[#ADB5BD]">사진 변경하기</p>
        </div>

        {/* Minimalist Form */}
        <div className="space-y-12">
          <div className="space-y-2">
            <label className={`text-[12px] font-black transition-colors duration-300 ${isFocused ? 'text-[#12B886]' : 'text-[#ADB5BD]'}`}>
              이름
            </label>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full py-4 text-[20px] font-bold text-[#191F28] bg-transparent border-b-2 border-gray-100 focus:outline-none focus:border-[#12B886] transition-all placeholder-gray-200"
                placeholder="이름을 입력해주세요"
              />
              <Pencil className={`absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isFocused ? 'text-[#12B886]' : 'text-gray-200'}`} />
            </div>
          </div>

          <div className="space-y-2 opacity-50">
            <label className="text-[12px] font-black text-[#ADB5BD]">
              이메일
            </label>
            <div className="py-4 text-[16px] font-bold text-[#8B95A1] border-b-2 border-gray-50">
              {user?.email || '이메일 정보 없음'}
            </div>
            <p className="text-[11px] text-gray-300 font-medium">이메일은 변경할 수 없습니다.</p>
          </div>
        </div>
      </div>

      {/* Floating Action Button - Toss Style */}
      <AnimatePresence>
        {(isChanged || loading) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none"
          >
            <div className="max-w-[480px] mx-auto pointer-events-auto">
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="w-full h-16 bg-[#12B886] text-white font-black text-lg rounded-2xl shadow-xl shadow-[#E9FBF5] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:shadow-none"
              >
                {loading ? (
                   <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>변경사항 저장하기</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
