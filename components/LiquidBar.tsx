import React from "react";

const LiquidBar: React.FC<{ value: number; color?: string; ariaLabel?: string }> = ({ value, color = "#6BD07A", ariaLabel }) => {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className='relative w-full h-4 rounded-xl overflow-hidden bg-[rgba(255,255,255,0.03)] shadow-[inset_ -6px_-6px_18px_rgba(255,255,255,0.03),14px_18px_30px_rgba(2,6,23,0.45)]'
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      aria-label={ariaLabel || "progress"}
    >
      <div
        className={`absolute left-0 top-0 h-full rounded-xl transition-[width,transform] duration-500 ease-[cubic-bezier(.2,.9,.2,1)] motion-reduce:transition-none`}
        style={{
          width: `${safe}%`,
          background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.12))`,
          boxShadow: `0 6px 18px rgba(2,6,23,0.35), inset -6px -6px 14px rgba(255,255,255,0.02)`,
          transform: `translateZ(0)`,
        }}
      />
      {/* subtle surface wave (CSS animation; respects prefers-reduced-motion) */}
      <div
        className='pointer-events-none absolute inset-0 opacity-30 mix-blend-screen motion-reduce:opacity-0'
        style={{
          background: `linear-gradient(120deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 40%, rgba(255,255,255,0.03) 100%)`,
          backgroundSize: "200% 100%",
          animation: "liquid-slide 3500ms linear infinite",
        }}
      />
      <style>{`@keyframes liquid-slide{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}@media (prefers-reduced-motion: reduce){.motion-reduce\\:opacity-0{opacity:0!important}}`}</style>
    </div>
  );
};

export default LiquidBar;
