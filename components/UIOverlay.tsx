import React from 'react';
import { GameState, MaskType, TOTAL_MEMORIES } from '../types';

interface UIProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  health: number;
  integrity: number;
  mask: MaskType;
  levelIndex: number;
  deathReason: string;
  memories: number;
  aiMessage: string;
}

const MASKS = [
  { id: MaskType.NONE, icon: "😐", label: "Chân Thật", key: "0", desc: "Cân bằng" },
  { id: MaskType.CHILD, icon: "😆", label: "Vui Vẻ", key: "1", desc: "Tăng tốc / Nảy" },
  { id: MaskType.STUDENT, icon: "😔", label: "U Sầu", key: "2", desc: "Lơ lửng / Chậm" },
  { id: MaskType.WORKER, icon: "😡", label: "Giận Dữ", key: "3", desc: "Phá hủy / Nặng" },
  { id: MaskType.SOCIAL, icon: "🤖", label: "Tuân Thủ", key: "4", desc: "Tiêu chuẩn" },
];

const UIOverlay: React.FC<UIProps> = ({ gameState, setGameState, health, integrity, mask, levelIndex, deathReason, memories, aiMessage }) => {
  
  const isPlaying = gameState === GameState.PLAYING;
  const isLowHealth = health < 40;
  const glitchIntensity = isLowHealth ? Math.min(1, (40 - health) / 30) : 0;
  
  // AI Mood Styling
  const aiColor = isLowHealth ? "text-red-500" : (mask === MaskType.NONE && levelIndex < 4 ? "text-orange-400" : "text-green-500");
  const aiBorder = isLowHealth ? "border-red-500/50" : "border-green-500/50";
  const aiBg = isLowHealth ? "bg-red-500" : "bg-green-500";

  if (gameState === GameState.START) {
    return (
      <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-8 z-50 crt-overlay">
        <div className="border-4 border-yellow-500/50 p-10 bg-black/70 backdrop-blur-md rounded-lg shadow-[0_0_50px_rgba(234,179,8,0.2)] pointer-events-auto">
            <h1 className="text-6xl font-serif text-yellow-400 mb-6 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] tracking-wider">HÀNH TRÌNH VỀ NHÀ</h1>
            <p className="text-gray-300 max-w-lg mb-8 text-lg font-mono">
              [SYSTEM DETECTED: NEW SUBJECT]<br/>
              Chào mừng đến với hệ thống giả lập xã hội.
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm mb-8 text-left">
                <div className="bg-yellow-900/30 p-2 border border-yellow-700 rounded">
                    <span className="text-yellow-400 block font-bold">MẶT NẠ 1: VUI VẺ</span>
                    Di chuyển nhanh, nảy bật, khó kiểm soát.
                </div>
                <div className="bg-blue-900/30 p-2 border border-blue-700 rounded">
                    <span className="text-blue-400 block font-bold">MẶT NẠ 2: U SẦU</span>
                    Trọng lực thấp, lơ lửng, nhảy thấp.
                </div>
                <div className="bg-red-900/30 p-2 border border-red-700 rounded">
                    <span className="text-red-400 block font-bold">MẶT NẠ 3: GIẬN DỮ</span>
                    Nặng nề, phá hủy chướng ngại vật.
                </div>
            </div>
            <button 
              onClick={() => setGameState(GameState.PLAYING)}
              className="px-10 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold font-mono text-xl rounded shadow-[0_0_20px_rgba(250,204,21,0.6)] transition-all hover:scale-105 hover:tracking-widest"
            >
              KHỞI ĐỘNG HỆ THỐNG
            </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-center p-8 z-50 crt-overlay">
        <div className="pointer-events-auto">
            <h1 className="text-6xl font-bold text-red-500 mb-4 font-mono tracking-widest glitch-text">THẤT BẠI</h1>
            <p className="text-red-200 text-xl mb-8 font-mono border-t border-b border-red-800 py-4">{deathReason}</p>
            <button 
              onClick={() => setGameState(GameState.START)}
              className="px-8 py-3 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-bold font-mono rounded transition-colors"
            >
              TÁI KHỞI ĐỘNG
            </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.VICTORY) {
    const isTrueEnding = memories >= TOTAL_MEMORIES;
    return (
      <div className={`absolute inset-0 ${isTrueEnding ? 'bg-yellow-900/90' : 'bg-green-900/90'} flex flex-col items-center justify-center text-center p-8 z-50 crt-overlay`}>
        <div className="pointer-events-auto">
            <h1 className="text-5xl font-bold text-white mb-4">{isTrueEnding ? "THOÁT KHỎI MA TRẬN" : "VỀ ĐẾN NHÀ"}</h1>
            <p className="text-white text-xl italic mb-4">
                {isTrueEnding 
                    ? "S.E.R.A không thể tính toán được cảm xúc chân thật của bạn. Bạn đã tự do." 
                    : "Bạn đã về nhà, nhưng S.E.R.A vẫn đang quan sát..."}
            </p>
            <button 
              onClick={() => setGameState(GameState.START)}
              className="px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors"
            >
              Chơi lại
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      
      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 z-40 pointer-events-none crt-line opacity-20"></div>

      {/* GLITCH EFFECT (Low Health) */}
      {isPlaying && isLowHealth && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div 
            className="absolute inset-0 glitch-scanlines w-full h-full"
            style={{ opacity: 0.3 + glitchIntensity * 0.4 }}
          ></div>
          <div 
            className="absolute inset-0 w-full h-full bg-red-500/20"
            style={{
               mixBlendMode: 'color',
               animation: `glitch-flash ${0.6 - glitchIntensity * 0.4}s infinite steps(2, jump-none)`,
               opacity: 0
            }}
          ></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600/80 font-mono font-bold text-9xl uppercase opacity-10 blur-[2px] animate-pulse">
             SYSTEM FAILURE
          </div>
        </div>
      )}

      {/* S.E.R.A VISUAL TERMINAL */}
      <div className={`absolute top-4 right-4 w-96 bg-black/90 border ${aiBorder} p-3 rounded-br-2xl shadow-lg z-30 flex gap-3 items-start transition-colors duration-500`}>
        {/* The Eye Avatar */}
        <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center border border-white/10 bg-black rounded-full overflow-hidden">
            <div className={`w-full h-full absolute opacity-20 ${aiBg} animate-pulse`}></div>
            <div className={`w-4 h-4 rounded-full ${aiBg} shadow-[0_0_10px_currentColor]`} style={{ animation: isLowHealth ? 'glitch-anim-1 0.2s infinite' : 'pulse-eye 2s infinite' }}></div>
            <div className="absolute w-1 h-1 bg-white rounded-full"></div>
        </div>

        <div className="flex-1 overflow-hidden">
            <div className="flex justify-between border-b border-white/10 mb-1 pb-1">
                <span className={`font-mono text-xs font-bold ${aiColor}`}>S.E.R.A v9.0</span>
                <span className="animate-pulse text-xs text-white/50">● LIVE</span>
            </div>
            <div className={`font-mono text-sm h-14 overflow-y-auto leading-tight ${aiColor} custom-scrollbar pr-1`}>
                <p>{aiMessage}</p>
            </div>
        </div>
      </div>

      {/* VIGNETTE MASK */}
      {mask !== MaskType.NONE && (
        <div 
          className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-1000"
          style={{
             background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.6) 100%)',
             opacity: 1
          }}
        ></div>
      )}

      {/* TOP LEFT STATS */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 z-30 pointer-events-none w-72">
        {/* Health */}
        <div className="bg-black/60 backdrop-blur border-l-4 border-l-green-500 pl-3 py-2 pr-2 relative clip-path-slanted">
            <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
                <span>VITALS</span>
                <span className={health < 30 ? "text-red-500 animate-pulse" : "text-green-500"}>{Math.round(health)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800">
                <div className={`h-full ${health < 30 ? 'bg-red-500' : 'bg-green-500'} transition-all duration-300`} style={{ width: `${health}%` }}></div>
            </div>
        </div>

        {/* Integrity */}
        <div className="bg-black/60 backdrop-blur border-l-4 border-l-cyan-500 pl-3 py-2 pr-2 relative clip-path-slanted">
            <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
                <span>IDENTITY INTEGRITY</span>
                <span className="text-cyan-500">{Math.round(integrity)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800">
                <div className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_10px_cyan]" style={{ width: `${integrity}%` }}></div>
            </div>
        </div>

        {/* Memory */}
        <div className="bg-black/60 backdrop-blur border border-yellow-500/20 px-3 py-1 flex items-center justify-between text-yellow-500 font-mono text-sm clip-path-slanted">
            <span>DATA FRAGMENTS</span>
            <span className="font-bold">{memories} / {TOTAL_MEMORIES}</span>
        </div>
      </div>

      {/* BOTTOM BAR - MASKS */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30 pointer-events-auto">
        {MASKS.map((m) => {
          const isActive = mask === m.id;
          return (
            <div 
              key={m.id}
              className={`
                group relative flex flex-col items-center justify-center w-12 h-12 rounded bg-black/80 border 
                transition-all duration-200 cursor-pointer overflow-visible
                ${isActive 
                  ? 'border-yellow-400 -translate-y-2 shadow-[0_0_15px_rgba(250,204,21,0.4)]' 
                  : 'border-gray-700 opacity-60 hover:opacity-100 hover:-translate-y-1'}
              `}
              onClick={() => {
                  const event = new KeyboardEvent('keydown', { code: `Digit${m.key}` });
                  window.dispatchEvent(event);
              }}
            >
              <span className="text-xl filter drop-shadow-md">{m.icon}</span>
              <span className="absolute top-1 right-1 text-[8px] font-mono text-gray-500">{m.key}</span>
              
              {/* Tooltip */}
              <div className={`
                absolute bottom-14 left-1/2 -translate-x-1/2 w-32 bg-black/90 border border-gray-600 p-2 text-center rounded
                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50
                ${isActive ? 'opacity-100 border-yellow-500' : ''}
              `}>
                  <div className={`font-bold text-xs ${isActive ? 'text-yellow-400' : 'text-white'}`}>{m.label}</div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-tighter">{m.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UIOverlay;