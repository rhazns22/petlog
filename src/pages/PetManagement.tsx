import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Plus, Settings, Trash2, ShieldAlert, X, Check, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getPetDefaultImage } from '../lib/petUtils';
import PetAvatar from '../components/PetAvatar';
import { motion, AnimatePresence } from 'framer-motion';

interface Pet {
  id: string;
  name: string;
  type: 'DOG' | 'CAT' | 'OTHER';
  breed: string;
  birthDate?: string;
  weight?: number;
  gender?: 'MALE' | 'FEMALE';
  isNeutered?: boolean;
  memo?: string;
  photoURL?: string;
}

interface EditForm {
  name: string;
  type: 'DOG' | 'CAT' | 'OTHER';
  breed: string;
  birthDate: string;
  weight: string;
  gender: 'MALE' | 'FEMALE';
  isNeutered: boolean;
  memo: string;
  photoURL: string;
}

const getPetIcon = (type: string) => {
  switch (type) {
    case 'DOG': return '🐶';
    case 'CAT': return '🐱';
    default: return '🐾';
  }
};

export default function PetManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editPet, setEditPet] = useState<Pet | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', type: 'DOG', breed: '', birthDate: '', weight: '', gender: 'MALE', isNeutered: false, memo: '', photoURL: ''
  });
  const [saving, setSaving] = useState(false);

  function openEdit(pet: Pet) {
    setEditPet(pet);
    setEditForm({
      name: pet.name || '',
      type: pet.type || 'DOG',
      breed: pet.breed || '',
      birthDate: pet.birthDate || '',
      weight: pet.weight?.toString() || '',
      gender: pet.gender || 'MALE',
      isNeutered: pet.isNeutered ?? false,
      memo: pet.memo || '',
      photoURL: pet.photoURL || '',
    });
  }

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setEditForm({ ...editForm, photoURL: dataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = async () => {
    if (!user || !editPet) return;
    if (!editForm.name.trim()) {
      showToast('이름을 입력해주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'pets', editPet.id), {
        ...editForm,
        weight: parseFloat(editForm.weight) || 0,
        updatedAt: serverTimestamp(),
      });
      showToast('성공적으로 수정되었습니다.', 'success');
      setEditPet(null);
    } catch (error) {
      console.error('Error updating pet:', error);
      showToast('수정 중 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'pets', id));
      showToast('삭제되었습니다.', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting pet:', error);
      showToast('반려동물 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'pets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPets: Pet[] = [];
      snapshot.forEach((doc) => {
        fetchedPets.push({ id: doc.id, ...doc.data() } as Pet);
      });
      setPets(fetchedPets);
      setLoading(false);

      // 홈에서 넘어온 특정 반려동물 수정 ID가 있다면 모달 자동 오픈
      const state = location.state as { editPetId?: string };
      if (state?.editPetId) {
        const petToEdit = fetchedPets.find(p => p.id === state.editPetId);
        if (petToEdit) {
          // 0ms 지연을 주어 컴포넌트 초기화가 완전히 끝난 후 실행되도록 보장
          setTimeout(() => {
            openEdit(petToEdit);
          }, 0);
          // 1회성 실행을 위해 state 초기화
          window.history.replaceState({}, document.title);
        }
      }
    });
    return () => unsubscribe();
  }, [user, location.state]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-20 transition-colors">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-gray-100">
        <button onClick={() => navigate('/home')} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">반려동물 관리</span>
        <button onClick={() => navigate('/pet-registration')} className="p-2">
          <Plus className="w-6 h-6 text-[#12B886]" />
        </button>
      </div>

      <div className="px-6 py-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#191F28]">우리 아이들</h2>
          <p className="text-sm text-[#8B95A1] mt-1">등록된 반려동물을 관리할 수 있어요.</p>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[98px] bg-white rounded-[10px] shadow-sm border border-gray-50" />
            ))}
          </div>
        ) : pets.length === 0 ? (
          <div className="bg-white rounded-[10px] p-10 flex flex-col items-center justify-center border border-dashed border-gray-200">
            <span className="text-4xl mb-4">🐾</span>
            <p className="text-[#8B95A1] font-medium mb-6">등록된 반려동물이 없어요</p>
            <button
              onClick={() => navigate('/pet-registration')}
              className="px-6 py-3 bg-[#12B886] text-white font-bold rounded-[10px] shadow-lg active:scale-95 transition-transform"
            >
              지금 등록하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {pets.map((pet) => (
              <motion.div
                layout
                key={pet.id}
                className="bg-white rounded-[10px] p-4 flex items-center gap-4 shadow-sm border border-gray-50"
              >
                <PetAvatar pet={pet} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#191F28]">{pet.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8FAF9] text-[#12B886] font-bold">
                      {pet.breed || '미입력'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8B95A1] mt-1 flex items-center gap-2">
                    <span>{pet.type === 'DOG' ? '강아지' : pet.type === 'CAT' ? '고양이' : '기타'}</span>
                    {pet.gender && <span>· {pet.gender === 'MALE' ? '남아' : '여아'}</span>}
                    {pet.weight ? <span>· {pet.weight}kg</span> : null}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(pet)}
                    className="p-2 text-[#8B95A1] hover:text-[#12B886] active:scale-90 transition-all"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(pet.id)}
                    className="p-2 text-[#8B95A1] hover:text-[#FF4747] active:scale-90 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── 편집 모달 (하단 슬라이드업) ── */}
      <AnimatePresence>
        {editPet && (
          <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditPet(null)}
              className="absolute inset-0 bg-[#0B2F2A]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative w-full max-w-[480px] bg-white rounded-t-[20px] px-6 pt-4 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-[#F8FAF9] rounded-full mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[#191F28]">반려동물 정보 수정</h3>
                <button onClick={() => setEditPet(null)} className="p-1 text-[#8B95A1]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* 사진 수정 */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    <label className="block cursor-pointer active:scale-95 transition-transform">
                      <PetAvatar 
                        pet={{ ...editPet, ...editForm }} 
                        size="xl" 
                        className="border-4 border-white shadow-md"
                      />
                      <input type="file" accept="image/*" className="hidden" onChange={handleEditImageChange} />
                      <div className="absolute bottom-1 right-1 w-7 h-7 bg-[#12B886] rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </label>
                  </div>
                  <p className="text-[10px] text-[#8B95A1] mt-2 font-medium">사진을 눌러 변경</p>
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#191F28]">종류 *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-12 border border-[#F2F4F6] bg-white rounded-[10px] px-4 focus:outline-none focus:border-[#12B886] text-sm text-[#191F28]"
                  />
                </div>

                {/* 종류 */}
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#191F28]">종류</label>
                  <div className="flex gap-2">
                    {([['DOG', '🐶', '강아지'], ['CAT', '🐱', '고양이'], ['OTHER', '🐾', '기타']] as const).map(([val, icon, label]) => (
                      <button
                        key={val}
                        onClick={() => setEditForm({ ...editForm, type: val })}
                        className={`flex-1 h-16 rounded-[10px] flex flex-col items-center justify-center gap-1 border-2 transition-all text-sm font-bold
                          ${editForm.type === val ? 'bg-[#F8FAF9] border-[#12B886] text-[#12B886]' : 'bg-gray-50 border-transparent text-[#8B95A1]'}`}
                      >
                        <span className="text-xl">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 품종 */}
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#191F28]">품종</label>
                  <input
                    type="text"
                    value={editForm.breed}
                    onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })}
                    placeholder="포메라니안"
                    className="w-full h-12 border border-[#F2F4F6] bg-white rounded-[10px] px-4 focus:outline-none focus:border-[#12B886] text-sm text-[#191F28]"
                  />
                </div>

                <div className="flex gap-3">
                  {/* 생년월일 */}
                  <div className="flex-1">
                    <label className="block text-sm font-bold mb-2 text-[#191F28]">생년월일</label>
                    <input
                      type="text"
                      value={editForm.birthDate}
                      onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                      placeholder="2021.03.15"
                      className="w-full h-12 border border-[#F2F4F6] bg-white rounded-[10px] px-4 focus:outline-none focus:border-[#12B886] text-sm text-[#191F28]"
                    />
                  </div>
                  {/* 몸무게 */}
                  <div className="flex-1">
                    <label className="block text-sm font-bold mb-2 text-[#191F28]">몸무게</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editForm.weight}
                        onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                        placeholder="3.2"
                        step="0.1"
                        className="w-full h-12 border border-[#F2F4F6] bg-white rounded-[10px] px-4 pr-10 focus:outline-none focus:border-[#12B886] text-sm text-[#191F28]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B95A1] text-sm">kg</span>
                    </div>
                  </div>
                </div>

                {/* 성별 */}
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#191F28]">성별</label>
                  <div className="flex gap-3">
                    {(['MALE', 'FEMALE'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setEditForm({ ...editForm, gender: g })}
                        className={`flex-1 h-11 rounded-full text-sm font-medium border transition-all
                          ${editForm.gender === g ? 'bg-[#F8FAF9] border-[#12B886] text-[#12B886]' : 'bg-white border-transparent text-[#8B95A1]'}`}
                      >
                        {g === 'MALE' ? '남아' : '여아'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 중성화 */}
                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-[#191F28]">중성화 여부</p>
                    <p className="text-xs text-[#8B95A1]">{editForm.isNeutered ? '중성화 완료' : '미완료'}</p>
                  </div>
                  <button
                    onClick={() => setEditForm({ ...editForm, isNeutered: !editForm.isNeutered })}
                    className={`w-12 h-6 rounded-full relative transition-colors ${editForm.isNeutered ? 'bg-[#12B886]' : 'bg-[#F8FAF9]'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${editForm.isNeutered ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#191F28]">메모</label>
                  <textarea
                    value={editForm.memo}
                    onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                    placeholder="알러지, 특이사항 등"
                    rows={3}
                    className="w-full border border-[#F2F4F6] bg-white rounded-[10px] p-4 focus:outline-none focus:border-[#12B886] text-sm resize-none text-[#191F28]"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="w-full h-14 bg-[#12B886] text-white font-bold rounded-[10px] shadow-lg mt-6 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[#12B886]/10"
              >
                <Check className="w-5 h-5" />
                {saving ? '저장 중...' : '수정 완료'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 flex items-end justify-center px-4 pb-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[10px] p-6 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-red-50 rounded-[10px] flex items-center justify-center mb-4">
                  <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-[#191F28]">정말 삭제할까요?</h3>
                <p className="text-sm text-[#8B95A1] mb-6 font-medium leading-relaxed">
                  삭제된 반려동물 정보와 지출 내역은<br />다시 복구할 수 없어요.
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 h-14 bg-gray-100 text-[#8B95A1] font-bold rounded-[10px] active:scale-95 transition-transform"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 h-14 bg-red-500 text-white font-bold rounded-[10px] active:scale-95 transition-transform shadow-lg shadow-red-200"
                  >
                    삭제하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Floating Add Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => navigate('/pet-registration')}
          className="w-14 h-14 bg-[#12B886] text-white rounded-[10px] shadow-xl shadow-[#12B886]/20 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
