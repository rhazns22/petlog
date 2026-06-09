import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { trackEvent } from '../lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';

export default function Inquiry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('SERVICE');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 3) {
      showToast('사진은 최대 3장까지 첨부 가능합니다.', 'error');
      return;
    }

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);

    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (!user || !title || !content) return;
    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      
      await addDoc(collection(db, 'users', user.uid, 'inquiries'), {
        userId: user.uid,
        userName: user.displayName || '익명 사용자',
        userEmail: user.email,
        type,
        title,
        content,
        imageUrls,
        status: 'PENDING',
        createdAt: serverTimestamp(),
      });

      await trackEvent(user.uid, {
        type: 'inquiry_submitted',
        page: '/inquiry',
        metadata: { inquiryType: type, hasImages: imageUrls.length > 0 },
      });

      showToast('문의가 접수되었습니다. 영업일 기준 1~2일 내 답변해 드립니다.', 'success');
      navigate(-1);
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      showToast('문의 접수 중 오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold">1:1 문의하기</span>
        <button 
          onClick={() => navigate('/inquiry-history')}
          className="text-xs font-bold text-[#12B886] bg-[#E9FBF5] px-3 py-1.5 rounded-full active:scale-95 transition-all"
        >
          문의내역
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label className="block text-xs font-bold text-[#ADB5BD] mb-2 px-1">문의 유형</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'SERVICE', label: '서비스 이용' },
              { id: 'ACCOUNT', label: '계정/로그인' },
              { id: 'PAYMENT', label: '결제/통계' },
              { id: 'OTHER', label: '기타' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setType(item.id)}
                className={`h-12 rounded-[10px] text-xs font-bold transition-all border-2 ${
                  type === item.id
                    ? 'border-[#12B886] bg-[#E9FBF5] text-[#12B886]'
                    : 'border-transparent bg-white text-[#ADB5BD]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#ADB5BD] mb-2 px-1">문의 제목</label>
          <input
            type="text"
            placeholder="제목을 입력해 주세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-14 bg-white border border-gray-100 rounded-[10px] px-5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E9FBF5]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#ADB5BD] mb-2 px-1">문의 내용</label>
          <textarea
            placeholder="문의 내용을 상세히 적어 주시면 더 빠른 답변이 가능합니다."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full bg-white border border-gray-100 rounded-[10px] p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E9FBF5] resize-none leading-relaxed"
          />
        </div>

        {/* 사진 첨부 비활성화 (Beta) */}
        <div className="opacity-50 pointer-events-none">
          <label className="block text-xs font-bold text-[#ADB5BD] mb-2 px-1">사진 첨부 (베타 기간 미지원)</label>
          <div className="flex gap-3">
            <button 
              disabled
              className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[10px] flex flex-col items-center justify-center text-gray-300"
            >
              <ImageIcon className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold">0 / 3</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!title || !content || submitting}
          className="w-full h-15 bg-[#12B886] text-white font-bold rounded-[10px] shadow-lg shadow-[#E9FBF5] mt-8 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {submitting ? '접수 중...' : '문의 접수하기'}
        </button>
      </div>
    </div>
  );
}
