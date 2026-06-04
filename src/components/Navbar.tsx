import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart3, Wallet, PenTool, User, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active: boolean;
  onClick: (path: string) => void;
}

function NavItem({ icon, label, path, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={() => onClick(path)}
      className={cn(
        'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 active:scale-95 relative',
        active ? 'text-[#12B886]' : 'text-[#8B95A1]'
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
        active ? "bg-[#12B886]/10 icon-3d scale-110" : ""
      )}>
        <div className={cn(active ? "drop-shadow-sm" : "")}>
          {icon}
        </div>
      </div>
      <span className={cn('text-[10px] font-black tracking-tighter transition-colors', active ? 'text-[#12B886]' : 'text-[#8B95A1]')}>
        {label}
      </span>
      {active && (
        <div className="absolute -top-1 w-1 h-1 bg-[#12B886] rounded-full shadow-[0_0_8px_rgba(18,184,134,0.6)]" />
      )}
    </button>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <Home />, label: '홈', path: '/home' },
    { icon: <Calendar />, label: '일정', path: '/recurring-settings' },
    { icon: <BarChart3 />, label: '통계', path: '/statistics' },
    { icon: <PenTool />, label: '지출등록', path: '/input' },
    { icon: <User />, label: '마이페이지', path: '/profile' },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="fixed bottom-[10px] left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[456px] bg-white/90 backdrop-blur-md border border-gray-100 px-2 py-2 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-50 transition-all">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            active={location.pathname === item.path || (item.path === '/statistics' && location.pathname === '/report')}
            onClick={handleNavClick}
          />
        ))}
      </div>
    </div>
  );
}
