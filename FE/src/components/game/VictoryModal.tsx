// VictoryModal.tsx
import React, { useState } from 'react';   // ← nếu cần useState thì import

interface VictoryModalProps {
  winnerName?: string;
  totalAssets?: string;
  turns?: number;
  onPlayAgain?: () => void;
  onShowLeaderboard?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const VictoryModal: React.FC<VictoryModalProps> = ({
  winnerName = "BẢO HOÀNG",
  totalAssets = "1.250.000.000$",
  turns = 42,
  onPlayAgain,
  onShowLeaderboard,
  isOpen = true,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-black/80">
      {/* Fireworks Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="firework-particle" style={{ left: '20%', top: '30%', animationDelay: '0.2s' }} />
        <div className="firework-particle" style={{ left: '80%', top: '20%', animationDelay: '0.5s' }} />
        <div className="firework-particle" style={{ left: '50%', top: '40%', animationDelay: '0.8s' }} />
      </div>

      {/* Modal Card */}
      <section className="art-deco-border bg-surface-container-lowest/95 backdrop-blur-xl w-full max-w-4xl p-8 md:p-12 text-center flex flex-col items-center relative shadow-[0_0_100px_rgba(246,190,57,0.2)]">
        <div className="corner-accent-tr" />
        <div className="corner-accent-bl" />

        {/* Trophy */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full transform scale-150" />
          <div className="relative bg-surface-container-highest p-6 border-2 border-primary-container">
            <span
              className="material-symbols-outlined text-[80px] text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              military_tech
            </span>
          </div>
        </div>

        <h2 className="font-headline text-xl md:text-2xl tracking-[0.3em] text-tertiary mb-2 uppercase gold-glow">
          CHÚC MỪNG TÂN TỶ PHÚ!
        </h2>

        <h1 className="font-playfair text-6xl md:text-8xl font-black text-primary mb-8 leading-tight tracking-tight drop-shadow-2xl">
          {winnerName}
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-primary-container bg-surface-container-lowest w-full mb-10 overflow-hidden">
          <div className="p-6 border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-primary-container flex flex-col items-center justify-center space-y-1">
            <span className="font-label text-xs text-tertiary/60 tracking-widest">TỔNG TÀI SẢN</span>
            <span className="font-headline text-2xl text-primary font-bold">{totalAssets}</span>
          </div>
          <div className="p-6 border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-primary-container flex flex-col items-center justify-center space-y-1 bg-surface-container-high">
            <span className="font-label text-xs text-primary tracking-widest">TRẠNG THÁI</span>
            <span className="font-headline text-2xl text-on-surface font-bold uppercase">ĐỘC QUYỀN</span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center space-y-1">
            <span className="font-label text-xs text-tertiary/60 tracking-widest">SỐ LƯỢT ĐI</span>
            <span className="font-headline text-2xl text-primary font-bold">{turns}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col md:flex-row gap-4 w-full max-w-lg">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-linear-to-br from-primary to-primary-container py-4 px-8 flex items-center justify-center gap-3 active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-black font-bold">celebration</span>
            <span className="font-label text-lg font-extrabold text-black uppercase tracking-tighter">Chơi Lại</span>
          </button>

          <button
            onClick={onShowLeaderboard}
            className="flex-1 border-2 border-primary-container py-4 px-8 flex items-center justify-center gap-3 hover:bg-primary-container/10 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-primary">leaderboard</span>
            <span className="font-label text-lg font-bold text-primary uppercase tracking-tighter">Bảng Xếp Hạng</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default VictoryModal;