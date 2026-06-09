import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TERMS = [
  { id: 'service', text: '(필수) 서비스이용약관 동의', required: true },
  { id: 'privacy', text: '(필수) 개인정보 처리방침 동의', required: true },
  { id: 'marketing', text: '(선택) 마케팅 정보 수신 동의', required: false },
];

import { getAuthErrorMessage } from '../lib/authErrorMessages';

export default function Register() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { registerWithEmail } = useAuth();

  // Step 1 - Terms
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
  const allChecked = checked.every(Boolean);
  const requiredChecked = checked.slice(0, 2).every(Boolean);

  const toggleAll = () => {
    const next = !allChecked;
    setChecked([next, next, next]);
  };

  const toggleOne = (i: number) => {
    const next = [...checked];
    next[i] = !next[i];
    setChecked(next);
  };

  // Step 2 - Name
  const [name, setName] = useState('');

  // Step 3 - Email
  const [email, setEmail] = useState('');

  // Step 4 - Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 5 - Phone (Optional)
  const [phone, setPhone] = useState('');

  // Submit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordMatch = password === confirmPassword;
  const passwordValid = password.length >= 6;

  const canProceed = () => {
    if (step === 1) return requiredChecked;
    if (step === 2) return name.trim().length > 0;
    if (step === 3) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (step === 4) return passwordValid && passwordMatch;
    return true;
  };

  const nextStep = async () => {
    if (!canProceed()) return;
    setError('');

    if (step === 4) {
      setStep(5);
      return;
    }

    if (step === 5) {
      setLoading(true);
      try {
        await registerWithEmail(email, password, name);
        navigate('/home');
      } catch (err: any) {
        setError(getAuthErrorMessage(err.code));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    if (step > 1) setStep(step - 1);
    else navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#F2F4F6] bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <button onClick={prevStep}><ChevronLeft className="w-6 h-6 text-[#191F28]" /></button>
        <span className="text-sm font-bold text-[#191F28]">회원가입</span>
        <div className="w-6" />
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center py-4">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-[#12B886]' : s < step ? 'w-3 bg-[#12B886]/30' : 'w-3 bg-[#12B886]/10'}`} />
        ))}
      </div>

      <div className="flex-1 px-6 pt-2 pb-12 flex flex-col">

        {/* ── Step 1: 약관 동의 ── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="flex flex-col items-center mb-10 text-center mt-8">
              <img src="/logo.png?v=2" alt="petlog Logo" className="w-16 h-16 mb-4 rounded-[15px] overflow-hidden" />
              <p className="text-[#8B95A1] text-xs font-bold leading-relaxed">반려동물 지출을 자동으로 기록하고<br/>줄여주는 앱 PetLog</p>
            </div>
            <div className="bg-white rounded-[28px] shadow-sm p-8 border border-[#F2F4F6] mt-auto">
              <h3 className="font-black text-[20px] text-[#191F28] mb-2">약관에 동의해주세요.</h3>
              <p className="text-[#8B95A1] text-[13px] font-medium mb-8 leading-relaxed">회원님의 개인정보는 걱정하지마세요.<br />안전하게 지켜드릴게요.</p>
              <div className="space-y-4">
                <button onClick={toggleAll} className="w-full flex items-center gap-3 p-4 bg-[#F8FAF9] rounded-2xl cursor-pointer active:scale-[0.98] transition-all">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${allChecked ? 'bg-[#12B886]' : 'bg-white border border-[#12B886]/20'}`}>
                    <Check className={`w-4 h-4 ${allChecked ? 'text-white' : 'text-[#12B886]/20'}`} />
                  </div>
                  <span className="font-black text-[15px] text-[#191F28]">약관 전체 동의</span>
                </button>
                <div className="space-y-1">
                  {TERMS.map((term, i) => (
                    <div key={term.id} className="flex items-center justify-between px-2 py-2">
                      <button onClick={() => toggleOne(i)} className="flex items-center gap-3 flex-1 text-left active:opacity-70 transition-opacity">
                        <div className={`w-5 h-5 border-2 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${checked[i] ? 'bg-[#12B886] border-[#12B886]' : 'border-[#12B886]/20 bg-white'}`}>
                          {checked[i] && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-[14px] font-bold text-[#4E5968]">{term.text}</span>
                      </button>
                      <button onClick={() => navigate(`/terms/${term.id}`)} className="text-[11px] text-[#8B95A1] font-bold px-2 py-1 flex items-center gap-0.5">
                        보기 <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: 이름 ── */}
        {step === 2 && (
          <div className="flex-1 mt-10">
            <h2 className="text-[#12B886] text-3xl font-black tracking-tighter mb-12">PetLog</h2>
            <div className="space-y-2 mb-12">
              <p className="text-[22px] font-black text-[#191F28]">반가워요!</p>
              <p className="text-[22px] font-black text-[#191F28]">이름이 어떻게 되시나요?</p>
            </div>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="홍길동"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && nextStep()}
                className="w-full border-b-2 border-[#12B886]/20 bg-transparent py-4 text-2xl font-black text-[#191F28] placeholder-[#12B886]/20 focus:border-[#12B886] outline-none transition-colors"
              />
              {name && <button onClick={() => setName('')} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8B95A1] text-2xl w-8 h-8 flex items-center justify-center">×</button>}
            </div>
          </div>
        )}

        {/* ── Step 3: 이메일 ── */}
        {step === 3 && (
          <div className="flex-1 mt-10">
            <h2 className="text-[#12B886] text-3xl font-black tracking-tighter mb-12">PetLog</h2>
            <div className="space-y-1 mb-12">
              <p className="text-[22px] font-black text-[#191F28]">로그인에 사용할</p>
              <p className="text-[22px] font-black text-[#191F28]">이메일을 입력해주세요.</p>
            </div>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="example@email.com"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && nextStep()}
                className="w-full border-b-2 border-[#12B886]/20 bg-transparent py-4 text-2xl font-black text-[#191F28] placeholder-[#12B886]/20 focus:border-[#12B886] outline-none transition-colors"
              />
              {email && <button onClick={() => setEmail('')} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8B95A1] text-2xl w-8 h-8 flex items-center justify-center">×</button>}
            </div>
          </div>
        )}

        {/* ── Step 4: 비밀번호 ── */}
        {step === 4 && (
          <div className="flex-1 mt-10">
            <h2 className="text-[#12B886] text-3xl font-black tracking-tighter mb-12">PetLog</h2>
            <div className="space-y-1 mb-10">
              <p className="text-[22px] font-black text-[#191F28]">사용할 비밀번호를</p>
              <p className="text-[22px] font-black text-[#191F28]">입력해주세요.</p>
            </div>
            <div className="space-y-6">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="비밀번호 (6자 이상)"
                  autoFocus
                  className={`w-full border-b-2 bg-transparent py-4 text-2xl font-black outline-none pr-10 transition-colors
                    ${password.length > 0 && !passwordValid ? 'border-[#F04452] text-[#F04452]' : password.length >= 6 ? 'border-[#12B886] text-[#191F28]' : 'border-[#12B886]/20 text-[#191F28] focus:border-[#12B886] placeholder-[#12B886]/20'}`}
                />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8B95A1] p-1">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {password.length > 0 && !passwordValid && <p className="text-xs text-[#F04452] mt-2 font-bold">6자 이상 입력해주세요.</p>}
              </div>

              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="비밀번호 확인"
                  className={`w-full border-b-2 bg-transparent py-4 text-2xl font-black outline-none pr-10 transition-colors
                    ${confirmPassword.length > 0 && !passwordMatch ? 'border-[#F04452] text-[#F04452]' : confirmPassword.length > 0 && passwordMatch ? 'border-[#12B886] text-[#191F28]' : 'border-[#12B886]/20 text-[#191F28] focus:border-[#12B886] placeholder-[#12B886]/20'}`}
                />
                <button onClick={() => setShowConfirm(!showConfirm)} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8B95A1] p-1">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {confirmPassword.length > 0 && !passwordMatch && <p className="text-xs text-[#F04452] mt-2 font-bold">비밀번호가 일치하지 않습니다.</p>}
                {confirmPassword.length > 0 && passwordMatch && passwordValid && <p className="text-xs text-[#12B886] mt-2 font-bold">✓ 비밀번호가 일치합니다.</p>}
              </div>

              {error && <p className="text-sm text-[#F04452] font-bold">{error}</p>}
            </div>
          </div>
        )}

        {/* ── Step 5: 연락처 (선택) ── */}
        {step === 5 && (
          <div className="flex-1 mt-10">
            <h2 className="text-[#12B886] text-3xl font-black tracking-tighter mb-12">PetLog</h2>
            <div className="space-y-2 mb-10">
              <p className="text-[22px] font-black text-[#191F28]">베타 혜택 안내를 위해</p>
              <p className="text-[22px] font-black text-[#191F28]">연락처를 남겨주시겠어요? (선택)</p>
            </div>
            <div className="space-y-8">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                autoFocus
                className="w-full border-b-2 border-[#12B886]/20 bg-transparent py-4 text-2xl font-black text-[#191F28] placeholder-[#12B886]/20 focus:border-[#12B886] outline-none transition-colors"
              />
              <div className="bg-white rounded-[28px] p-6 border border-[#F2F4F6] shadow-sm space-y-4">
                <p className="text-[13px] text-[#4E5968] font-bold leading-relaxed">
                  • 입력하신 연락처로 베타 안내, 피드백 확인, 추가 안내 및 프리미엄 혜택이 발송될 수 있습니다.<br />
                  • 원하지 않으시면 비워두셔도 가입이 가능합니다.
                </p>
                <p className="text-[10px] text-[#20C997] font-medium">
                  ※ 카카오톡 비즈니스 채널 또는 문자 메시지로 발송됩니다.
                </p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={nextStep}
          disabled={!canProceed() || loading}
          className="w-full h-16 bg-[#12B886] text-white text-[17px] font-black rounded-2xl shadow-[0_8px_20px_rgba(18,184,134,0.25)] mt-auto disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          {loading ? '가입 중...' :
           step === 1 ? '동의하고 시작하기' :
           step === 2 ? '다음' :
           step === 3 ? '다음' :
           step === 4 ? '다음' :
           step === 5 ? '가입 완료' : '다음'}
        </button>
      </div>
    </div>
  );
}
