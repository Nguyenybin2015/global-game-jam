import React from "react";
import { MaskType } from "../types";

type MaskEntry = {
  id: MaskType;
  key: number;
  label: string;
  desc: string;
  icon: string;
};

const MaskButton: React.FC<{ m: MaskEntry; isActive: boolean }> = ({ m, isActive }) => {
  const onClick = () => {
    const event = new KeyboardEvent("keydown", { code: `Digit${m.key}` });
    window.dispatchEvent(event);
  };

  return (
    <div
      className={`group relative flex flex-col items-center justify-center min-w-[56px] min-h-[56px] rounded-2xl bg-[rgba(255,255,255,0.02)] ring-1 ring-white/3 transition-transform duration-300 cursor-pointer overflow-visible shadow-[8px_10px_20px_rgba(2,6,23,0.28),inset_-6px_-6px_12px_rgba(255,255,255,0.02)] ${isActive ? "translate-y-[-6px] border-2 border-yellow-300 shadow-[0_18px_40px_rgba(250,204,21,0.18)]" : "border-gray-700/30 hover:translate-y-[-3px] hover:shadow-[0_12px_30px_rgba(2,6,23,0.18)]"}`}
      onClick={onClick}
      role="button"
      aria-label={`${m.label} (key ${m.key})`}
    >
      <span className="text-xl filter drop-shadow-md">{m.icon}</span>
      <span className="absolute top-1 right-1 text-[8px] font-mono text-gray-500">
        {m.key}
      </span>

      <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 w-40 bg-[rgba(7,9,14,0.7)] ring-1 ring-white/4 p-3 text-center rounded-xl shadow-[inset_-6px_-6px_12px_rgba(255,255,255,0.02)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 ${isActive ? "opacity-100 scale-100 border border-yellow-300" : "scale-95"}`}>
        <div className={`font-bold text-sm ${isActive ? "text-yellow-300" : "text-white"}`}>
          {m.label}
        </div>
        <div className="text-[11px] text-gray-400 uppercase tracking-tighter mt-1">
          {m.desc}
        </div>
      </div>
    </div>
  );
};

export default MaskButton;
