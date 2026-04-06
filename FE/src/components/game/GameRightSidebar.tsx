import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerList from '../PlayerList';
import GameLog from '../GameLog';
import DicePanel from './DicePanel';
import { useGameStore } from '../../store/gameStore';
import type { GameStore } from '../../store/gameStore';

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#2a2a2a]">
      <span className="material-symbols-outlined text-[#f5c842] text-sm"
        style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <h3 className="font-['Orbitron'] text-[10px] font-bold text-[#f5c842] uppercase tracking-[2px]"
        style={{ textShadow: '0 0 10px rgba(245,200,66,0.3)' }}>
        {children}
      </h3>
    </div>
  );
}

export default function GameRightSidebar() {
  const navigate = useNavigate();
  const [confirmExit, setConfirmExit] = useState(false);

  return (
    <aside className="w-65 shrink-0 bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col h-full overflow-y-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a3a5c transparent' }}>

      {/* Player list */}
      <div className="px-3 pt-3 pb-2 border-b border-[#2a2a2a]">
        <SectionTitle icon="groups">DANH SÁCH NGƯỜI CHƠI</SectionTitle>
        <PlayerList />
      </div>

      {/* Dice + Actions */}
      <div className="px-3 border-b border-[#2a2a2a]">
        <DicePanel />
      </div>

      {/* Game Log */}
      <div className="px-3 pt-3 flex-1 min-h-0">
        <SectionTitle icon="menu_book">NHẬT KÝ VÁN CHƠI</SectionTitle>
        <GameLog />
      </div>

      {/* Exit */}
      <div className="px-3 py-3 border-t border-[#2a2a2a] flex flex-col gap-2">
        {!confirmExit ? (
          <button
            onClick={() => setConfirmExit(true)}
            className="w-full py-2 flex items-center justify-center gap-2 border border-[#2a2a2a] text-[#7a8fbb]
              font-['Orbitron'] font-bold text-[10px] uppercase tracking-[2px]
              hover:border-[#ff6b6b] hover:text-[#ff6b6b] hover:shadow-[0_0_12px_rgba(255,107,107,0.15)] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">exit_to_app</span>
            THOÁT VÁN ĐẤU
          </button>
        ) : (
          <div className="border border-[#ff6b6b]/30 p-2">
            <p className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-[2px] text-[#d3c5ae] text-center mb-2">
              Xác nhận thoát ván đấu?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmExit(false)}
                className="flex-1 py-1.5 border border-[#2a2a2a] text-[#7a8fbb]
                  font-['Orbitron'] font-bold text-[9px] uppercase tracking-[1px]
                  hover:border-[#7a8fbb] transition-all cursor-pointer"
                style={{ background: 'transparent' }}
              >
                HỦY
              </button>
              <button
                onClick={() => navigate('/home')}
                className="flex-1 py-1.5 text-white font-['Orbitron'] font-bold text-[9px] uppercase tracking-[1px]
                  hover:brightness-110 transition-all border-none cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #ff6b6b, #c0392b)' }}
              >
                THOÁT
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
