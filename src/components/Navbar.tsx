import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart3, Wallet, PenTool, User, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, LayoutGroup } from 'framer-motion';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active: boolean;
  onClick: (path: string) => void;
}

function NavItem({ icon, label, path, active, onClick }: NavItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => onClick(path)}
      className={cn(
        'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative',
        active ? 'text-[#12B886]' : 'text-[#8B95A1]'
      )}
    >
      <div className="relative w-8 h-8 flex items-center justify-center">
        {active && (
          <motion.div
            layoutId="navbar-active-bg"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute inset-0 bg-[#12B886]/10 rounded-xl"
          />
        )}
        <motion.div
          animate={{ scale: active ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn("transition-all duration-200", active ? "text-[#12B886] drop-shadow-sm" : "text-[#8B95A1]")}
        >
          {icon}
        </motion.div>
      </div>
      <span className={cn('text-[10px] font-black tracking-tighter transition-colors', active ? 'text-[#12B886]' : 'text-[#8B95A1]')}>
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="navbar-active-dot"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="absolute -top-1 w-1.5 h-1.5 bg-[#12B886] rounded-full shadow-[0_0_8px_rgba(18,184,134,0.8)]"
        />
      )}
    </motion.button>
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
        <LayoutGroup id="navbar">
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
        </LayoutGroup>
      </div>
    </div>
  );
}
