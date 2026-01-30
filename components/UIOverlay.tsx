import React, { useEffect } from "react";
import { GameState, MaskType, TOTAL_MEMORIES } from "../types";

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

// Lightweight Tailwind-only liquid bar (prefers-reduced-motion aware)
const LiquidBar: React.FC<{
  value: number;
  color?: string;
  ariaLabel?: string;
}> = ({ value, color = "#6BD07A", ariaLabel }) => {
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

const MASKS = [
  {
    id: MaskType.CHILD,
    key: 1,
    label: "VUI VẺ",
    desc: "Nhanh, nảy bật",
    icon: "🙂",
  },
  {
    id: MaskType.STUDENT,
    key: 2,
    label: "U SẦU",
    desc: "Lơ lửng, chậm",
    icon: "😢",
  },
  {
    id: MaskType.WORKER,
    key: 3,
    label: "GIẬN DỮ",
    desc: "Phá chướng ngại",
    icon: "😡",
  },
  {
    id: MaskType.SOCIAL,
    key: 4,
    label: "XÃ HỘI",
    desc: "Tuân thủ tuyệt đối",
    icon: "😐",
  },
  {
    id: MaskType.NONE,
    key: 0,
    label: "CHÂN THẬT",
    desc: "Không mặt nạ",
    icon: "👤",
  },
];

const UIOverlay: React.FC<UIProps> = ({
  gameState,
  setGameState,
  health,
  integrity,
  mask,
  levelIndex,
  deathReason,
  memories,
  aiMessage,
}) => {
  const isPlaying = gameState === GameState.PLAYING;
  const isLowHealth = health < 40;
  const glitchIntensity = isLowHealth ? Math.min(1, (40 - health) / 30) : 0;

  // small HUD-only expression helpers (keeps SVG crisp and readable)
  const svgBrowTilt = (() => {
    if (mask === MaskType.WORKER) return -6;
    if (mask === MaskType.CHILD) return -4;
    if (mask === MaskType.STUDENT) return 4;
    return 0;
  })();
  const svgMouthPath = (() => {
    if (mask === MaskType.STUDENT) return "M15 15 Q20 18 25 15";
    if (mask === MaskType.WORKER) return "M17 15 H23";
    // true-self: subtle smile when integrity high
    const smile = Math.max(-3, Math.min(4, (integrity - 50) / 8));
    return `M16 16 Q20 ${15 + smile} 24 16`;
  })();
  const hudPupilNudge =
    Math.sin(Date.now() * 0.003) * (isLowHealth ? 0.6 : 0.28);

  // Live mini-avatar: copy a cropped, scaled region from the main canvas into a small HUD canvas.
  // Throttled and respects prefers-reduced-motion to avoid extra work on low-power devices.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mini = document.getElementById(
      "mini-avatar",
    ) as HTMLCanvasElement | null;
    const main = document.querySelector("canvas") as HTMLCanvasElement | null; // game canvas
    if (!mini || !main) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = 36; // CSS px
    const h = 36;
    mini.width = Math.round(w * dpr);
    mini.height = Math.round(h * dpr);
    mini.style.width = `${w}px`;
    mini.style.height = `${h}px`;
    const ctx = mini.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = 0;

    const drawOnce = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.clip();
      try {
        // copy a central vertical slice (player is generally in the left-third of the view)
        const sx = Math.max(0, Math.floor(main.width * 0.22));
        const sWidth = Math.floor(main.width * 0.56);
        ctx.drawImage(main, sx, 0, sWidth, main.height, 0, 0, w, h);
      } catch (err) {
        /* defensive */
      }
      ctx.restore();
      // subtle outer ring
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    if (reduce) {
      drawOnce();
      return;
    }

    const loop = (t: number) => {
      if (t - last > 80) {
        last = t;
        drawOnce();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mask, health, integrity, isPlaying]);

  // Inject project-specific UI tokens (palette, glass, shadows) once per mount
  useEffect(() => {
    if (document.getElementById("ui-neumo-tokens")) return;
    const css = `
      :root{
        --bg-grad-start: #CFEFF6; /* softer blue */
        --bg-grad-end: #F7FBFD;   /* near-white */
        --primary-dark: #24303A;  /* slightly warmer charcoal */
        --accent-vitals: #6BD07A; /* pastel/softer green */
        --accent-identity: #78A9FF; /* pastel blue */
        --warn: #F5D76E;         /* muted yellow */
        --glass-alpha: 0.78;
        --glass-blur: 10px;
        --drop-shadow: 0 4px 15px rgba(0,0,0,0.12);
        --radius-lg: 16px;
      }

      .neumorph-card{
        border-radius: var(--radius-lg);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.51), rgba(245, 249, 251, 0));
        box-shadow: var(--drop-shadow);
        backdrop-filter: blur(var(--glass-blur));
        border: 1px solid rgba(255,255,255,0.06);
      }

      .neumorph-btn{ border-radius: 14px; box-shadow: 0 8px 20px rgba(12,18,28,0.12), inset -6px -6px 12px rgba(255,255,255,0.03); transition: transform .28s cubic-bezier(.2,.9,.2,1); }

      .sera-console{ border-radius: 18px; box-shadow: var(--drop-shadow), inset -6px -6px 18px rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }

      @media (prefers-reduced-motion: reduce){
        .neumorph-btn, .neumorph-card { transition: none !important; animation: none !important; }
      }
    `;
    const el = document.createElement("style");
    el.id = "ui-neumo-tokens";
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  const aiColor = isLowHealth
    ? "text-red-500"
    : mask === MaskType.NONE && levelIndex < 4
      ? "text-orange-400"
      : "text-green-500";
  const aiBorder = isLowHealth ? "border-red-500/50" : "border-green-500/50";
  const aiBg = isLowHealth ? "bg-red-500" : "bg-green-500";

  if (gameState === GameState.START) {
    return (
      <div className='absolute inset-0 bg-black/92 flex items-center justify-center p-6 z-50 crt-overlay'>
        <div className='w-[820px] grid grid-cols-2 gap-6 p-6 bg-black/75 border-2 border-yellow-600/20 rounded-lg backdrop-blur-md shadow-[0_0_60px_rgba(34,197,94,0.06)] pointer-events-auto'>
          <div className='flex flex-col items-center justify-center gap-4'>
            <div className='w-44 h-44 bg-gradient-to-br from-neutral-800 to-neutral-700 rounded-xl flex items-center justify-center shadow-lg border border-white/6'>
              <div className='w-32 h-32 rounded-full bg-yellow-300 flex items-center justify-center text-4xl shadow-[0_10px_30px_rgba(0,0,0,0.6)]'>
                🙂
              </div>
            </div>
            <div className='text-left text-sm text-gray-300 max-w-xs'>
              <h2 className='text-xl font-bold text-yellow-400'>
                HÀNH TRÌNH VỀ NHÀ
              </h2>
              <p className='mt-2'>
                [SYSTEM DETECTED: NEW SUBJECT] — Khởi tạo môi trường mô phỏng
                cảm xúc.
              </p>
              <p className='mt-2 text-xs text-gray-400'>
                Dùng phím <span className='font-mono'>1/2/3/4/0</span> để thay
                đổi mặt nạ. Nhấn <span className='font-mono'>Space</span> để
                nhảy.
              </p>
            </div>
            <div className='flex gap-3 mt-4'>
              <button
                onClick={() => setGameState(GameState.PLAYING)}
                className='px-6 py-3 bg-yellow-500 text-black font-bold rounded hover:scale-105 transition transform shadow-md'
              >
                BẮT ĐẦU
              </button>
              <button
                onClick={() => setGameState(GameState.START)}
                className='px-4 py-3 border border-yellow-600 text-yellow-200 rounded text-sm'
              >
                TÙY CHỌN
              </button>
            </div>
          </div>

          <div>
            <div className='grid grid-cols-3 gap-3 mb-4'>
              <div className='bg-yellow-900/20 p-3 border border-yellow-700 rounded text-sm text-gray-400'>
                <div className='font-bold text-yellow-300'>VUI VẺ</div>
                Tăng tốc, nảy bật.
              </div>
              <div className='bg-blue-900/20 p-3 border border-blue-700 rounded text-sm text-gray-400'>
                <div className='font-bold text-blue-300'>U SẦU</div>
                Lơ lửng, chậm.
              </div>
              <div className='bg-red-900/20 p-3 border border-red-700 rounded text-sm text-gray-400'>
                <div className='font-bold text-red-300'>GIẬN DỮ</div>
                Phá vỡ chướng ngại.
              </div>
            </div>
            <div className='bg-black/60 border border-white/6 p-3 rounded mb-3 text-sm text-gray-200'>
              <div className='font-mono text-xs text-gray-400 mb-2'>
                NHIỆM VỤ
              </div>
              <div>- Thu thập mảnh ký ức để mở ngõ về nhà.</div>
              <div className='mt-2 text-xs text-gray-400'>
                Lưu ý: Mặt nạ thay đổi vật lý và hành vi nhân vật.
              </div>
            </div>
            <div className='flex gap-2'>
              <button
                onClick={() => setGameState(GameState.PLAYING)}
                className='flex-1 px-4 py-3 bg-green-500 text-black font-bold rounded hover:bg-green-400'
              >
                CHƠI NGAY
              </button>
              <button className='px-4 py-3 bg-gray-800 border border-white/6 rounded text-sm text-gray-400'>
                HƯỚNG DẪN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className='absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-center p-8 z-50 crt-overlay'>
        <div className='pointer-events-auto'>
          <h1 className='text-6xl font-bold text-red-500 mb-4 font-mono tracking-widest glitch-text'>
            THẤT BẠI
          </h1>
          <p className='text-red-200 text-xl mb-8 font-mono border-t border-b border-red-800 py-4'>
            {deathReason}
          </p>
          <button
            onClick={() => setGameState(GameState.START)}
            className='px-8 py-3 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-bold font-mono rounded transition-colors'
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
      <div
        className={`absolute inset-0 ${isTrueEnding ? "bg-yellow-900/90" : "bg-green-900/90"} flex flex-col items-center justify-center text-center p-8 z-50 crt-overlay`}
      >
        <div className='pointer-events-auto'>
          <h1 className='text-5xl font-bold text-white mb-4'>
            {isTrueEnding ? "THOÁT KHỎI MA TRẬN" : "VỀ ĐẾN NHÀ"}
          </h1>
          <p className='text-white text-xl italic mb-4'>
            {isTrueEnding
              ? "S.E.R.A không thể tính toán được cảm xúc chân thật của bạn. Bạn đã tự do."
              : "Bạn đã về nhà, nhưng S.E.R.A vẫn đang quan sát..."}
          </p>
          <button
            onClick={() => setGameState(GameState.START)}
            className='px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors'
          >
            Chơi lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='absolute inset-0 pointer-events-none overflow-hidden'>
      <div className='absolute inset-0 z-40 pointer-events-none crt-line opacity-20'></div>

      {isPlaying && isLowHealth && (
        <div className='absolute inset-0 pointer-events-none z-0'>
          <div
            className='absolute inset-0 glitch-scanlines w-full h-full'
            style={{ opacity: 0.3 + glitchIntensity * 0.4 }}
          ></div>
          <div
            className='absolute inset-0 w-full h-full bg-red-500/20'
            style={{
              mixBlendMode: "color",
              animation: `glitch-flash ${0.6 - glitchIntensity * 0.4}s infinite steps(2, jump-none)`,
              opacity: 0,
            }}
          ></div>
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600/80 font-mono font-bold text-9xl uppercase opacity-10 blur-[2px] animate-pulse'>
            SYSTEM FAILURE
          </div>
        </div>
      )}

      <div
        className={`absolute top-4 right-4 max-w-xs w-[22rem] border p-3 rounded-2xl sera-console z-30 flex gap-3 items-start transition-colors duration-500`}
        role='status'
        aria-live='polite'
        style={{
          background: "linear-gradient(180deg, #CFEFF6 0%, #F7FBFD 100%)",
          backdropFilter: "blur(10px)",
          opacity: 0.78,
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
        }}
      >
        <div className='relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-neutral-800/60 to-neutral-700/40 flex items-center justify-center shadow-[0_8px_30px_rgba(2,6,23,0.45)] ring-1 ring-white/3'>
          {/* small SVG avatar that mirrors canvas persona (mask + low-health).
              A tiny live-canvas (`#mini-avatar`) overlays the SVG and mirrors the
              main game canvas for perfect fidelity on HUD. */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${isLowHealth ? "animate-pulse" : ""}`}
            aria-hidden
          >
            {/* live-mini-canvas (draws a cropped/downsized region of the main canvas) */}
            <canvas
              id='mini-avatar'
              className='absolute right-0 bottom-0 w-9 h-9 rounded-full ring-1 ring-white/6 bg-transparent block'
              aria-hidden
            />

            <svg
              width='40'
              height='40'
              viewBox='0 0 40 40'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              role='img'
              aria-label='player avatar'
            >
              <defs>
                <radialGradient id='headG' cx='50% 30%' r='70%'>
                  <stop
                    offset='0%'
                    stopColor={
                      mask === MaskType.CHILD
                        ? "#FFF6D2"
                        : mask === MaskType.STUDENT
                          ? "#EAF7FF"
                          : mask === MaskType.WORKER
                            ? "#FFF1F0"
                            : "#FFF7D6"
                    }
                    stopOpacity='1'
                  />
                  <stop
                    offset='65%'
                    stopColor={mask === MaskType.NONE ? "#F1C40F" : "#FFFFFF"}
                    stopOpacity='0.95'
                  />
                </radialGradient>
                <radialGradient id='spec' cx='30%' cy='25%'>
                  <stop offset='0%' stopColor='rgba(255,255,255,0.95)' />
                  <stop offset='60%' stopColor='rgba(255,255,255,0.0)' />
                </radialGradient>
                <filter id='soft' x='-20%' y='-20%' width='140%' height='140%'>
                  <feGaussianBlur stdDeviation='1.2' result='b' />
                  <feBlend in='SourceGraphic' in2='b' mode='normal' />
                </filter>
              </defs>

              {/* shadow */}
              <ellipse cx='20' cy='33' rx='12' ry='4' fill='rgba(0,0,0,0.18)' />

              {/* body (simplified) */}
              <rect
                x='12'
                y='22'
                width='16'
                height='10'
                rx='3'
                fill={mask === MaskType.WORKER ? "#c0392b" : "#ecf0f1"}
              />

              {/* head with inner shading */}
              <circle
                cx='20'
                cy='12'
                r='9'
                fill='url(#headG)'
                stroke={
                  isLowHealth ? "rgba(220,38,38,0.9)" : "rgba(0,0,0,0.08)"
                }
                strokeWidth='1.2'
              />
              <circle
                cx='18'
                cy='9'
                r='3.8'
                fill='url(#spec)'
                opacity={health < 36 ? 0.95 : 0.6}
              />

              {/* eyebrows (sharper) + small nose */}
              {mask === MaskType.CHILD ? (
                <>
                  <path
                    d='M11.5 9.5 Q14 7.5 16.5 9.5'
                    stroke='#111'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                    fill='none'
                    opacity='0.95'
                    transform={`rotate(${svgBrowTilt * 0.6} 14 8)`}
                  />
                  <path
                    d='M23.5 9.5 Q26 7.5 28.5 9.5'
                    stroke='#111'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                    fill='none'
                    opacity='0.95'
                    transform={`rotate(${svgBrowTilt * 0.6} 26 8)`}
                  />
                </>
              ) : mask === MaskType.STUDENT ? (
                <>
                  <path
                    d='M11 8.8 Q14 7.8 17 9.2'
                    stroke='#222'
                    strokeWidth='1'
                    strokeLinecap='round'
                    fill='none'
                    opacity='0.9'
                    transform={`rotate(${svgBrowTilt * 0.5} 14 8)`}
                  />
                  <path
                    d='M24 9.2 Q27 7.8 29 8.8'
                    stroke='#222'
                    strokeWidth='1'
                    strokeLinecap='round'
                    fill='none'
                    opacity='0.9'
                    transform={`rotate(${svgBrowTilt * 0.5} 26 8)`}
                  />
                </>
              ) : mask === MaskType.WORKER ? (
                <>
                  <path
                    d='M11 8.5 L16 10'
                    stroke='#111'
                    strokeWidth='1.6'
                    strokeLinecap='round'
                    transform={`rotate(${svgBrowTilt} 14 9)`}
                  />
                  <path
                    d='M24 10 L29 8.5'
                    stroke='#111'
                    strokeWidth='1.6'
                    strokeLinecap='round'
                    transform={`rotate(${-svgBrowTilt} 26 9)`}
                  />
                </>
              ) : (
                <>
                  <path
                    d='M12 9 Q15 8.4 18 9.2'
                    stroke='#111'
                    strokeWidth='0.9'
                    strokeLinecap='round'
                    fill='none'
                    opacity='0.9'
                    transform={`translate(${hudPupilNudge * 0.4},0)`}
                  />
                  <path
                    d='M22 9.2 Q25 8.4 28 9'
                    stroke='#111'
                    strokeWidth='0.9'
                    strokeLinecap='round'
                    fill='none'
                    opacity='0.9'
                    transform={`translate(${hudPupilNudge * 0.4},0)`}
                  />
                </>
              )}

              {/* tiny nose */}
              <path
                d='M19 11 L20 13 L21 11'
                stroke='rgba(0,0,0,0.12)'
                strokeWidth='0.9'
                strokeLinecap='round'
                strokeLinejoin='round'
              />

              {/* collar seam on body */}
              <path
                d='M14 26 C18 22 22 22 26 26'
                stroke='rgba(0,0,0,0.06)'
                strokeWidth='0.9'
                strokeLinecap='round'
                fill='none'
                opacity='0.9'
              />

              {/* eyes / blink (crisper) */}
              {health < 20 ? (
                <>
                  <path
                    d='M13 10 L15 12 M15 10 L13 12'
                    stroke='#111'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                  />
                  <path
                    d='M25 10 L27 12 M27 10 L25 12'
                    stroke='#111'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                  />
                </>
              ) : mask === MaskType.SOCIAL ? (
                <>
                  <circle cx='14.5' cy='11.5' r='2.2' fill='#111' />
                  <circle cx='25.5' cy='11.5' r='2.2' fill='#111' />
                </>
              ) : mask === MaskType.CHILD ? (
                <>
                  <path
                    d='M12 11 Q14 9 16 11'
                    stroke='#111'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                    fill='none'
                  />
                  <path
                    d='M24 11 Q26 9 28 11'
                    stroke='#111'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                    fill='none'
                  />
                </>
              ) : (
                <>
                  <circle
                    cx='14.5'
                    cy='11.5'
                    r='1.6'
                    fill={mask === MaskType.NONE ? "#fff" : "#000"}
                  />
                  <circle
                    cx='25.5'
                    cy='11.5'
                    r='1.6'
                    fill={mask === MaskType.NONE ? "#fff" : "#000"}
                    stroke='rgba(0,0,0,0.12)'
                    strokeWidth='0.6'
                    shapeRendering='geometricPrecision'
                  />
                  <circle
                    cx='24.5'
                    cy='11.5'
                    r='1.6'
                    fill={mask === MaskType.NONE ? "#fff" : "#000"}
                    stroke='rgba(0,0,0,0.12)'
                    strokeWidth='0.6'
                    shapeRendering='geometricPrecision'
                  />
                  <circle
                    cx='13.5'
                    cy='10.5'
                    r='0.7'
                    fill='#fff'
                    opacity='0.98'
                  />
                  <circle
                    cx='24.5'
                    cy='10.5'
                    r='0.7'
                    fill='#fff'
                    opacity='0.98'
                  />
                </>
              )}

              {/* mouth (driven by integrity + subtle motion) */}
              <path
                d={svgMouthPath}
                stroke='#111'
                strokeWidth='1.05'
                strokeLinecap='round'
                fill='none'
                opacity={mask === MaskType.WORKER ? 1 : 0.95}
                transform={`translate(${hudPupilNudge * 0.4}, ${Math.sin(Date.now() * 0.002) * 0.2})`}
              />

              {/* accessory hints */}
              {mask === MaskType.WORKER && (
                <rect
                  x='12.5'
                  y='4.5'
                  width='15'
                  height='4'
                  rx='2'
                  fill='#c0392b'
                />
              )}
              {mask === MaskType.STUDENT && (
                <rect
                  x='11'
                  y='4'
                  width='18'
                  height='3'
                  rx='1.2'
                  fill='#2c3e50'
                  transform='rotate(-6 20 5)'
                />
              )}
              {mask === MaskType.CHILD && (
                <circle cx='27' cy='6' r='2.2' fill='#f39c12' />
              )}

              {/* tiny 'true self' particle */}
              {mask === MaskType.NONE && (
                <circle
                  cx={20 + Math.sin(Date.now() * 0.003) * 1.2}
                  cy={6 + Math.cos(Date.now() * 0.004) * 0.6}
                  r='1.6'
                  fill='rgba(241,196,15,0.28)'
                  filter='url(#soft)'
                />
              )}

              {/* subtle ring when masked */}
              {mask !== MaskType.NONE && (
                <circle
                  cx='20'
                  cy='12'
                  r='11.5'
                  stroke='rgba(255,255,255,0.06)'
                  strokeWidth='1'
                />
              )}
            </svg>
          </div>
        </div>

        <div className='flex-1 overflow-hidden'>
          <div className='flex items-center justify-between gap-3 border-b border-white/6 mb-1 pb-1'>
            <div className={`flex items-center gap-3`}>
              <div className='font-mono text-xs font-semibold tracking-wide text-gray-400'>
                S.E.R.A v9.0
              </div>
              <div className='text-[10px] font-mono text-gray-400'>AI</div>
            </div>
            <div className='animate-pulse text-xs text-gray-400'>● LIVE</div>
          </div>
          <div
            className={`font-mono text-sm h-14 overflow-y-auto leading-tight text-gray-400 custom-scrollbar pr-1 motion-reduce:overflow-auto`}
          >
            <p className='text-sm'>{aiMessage}</p>
          </div>
        </div>
      </div>

      {mask !== MaskType.NONE && (
        <div
          className='absolute inset-0 pointer-events-none z-0 transition-opacity duration-1000'
          style={{
            background:
              "radial-gradient(circle, transparent 50%, rgba(0,0,0,0.6) 100%)",
            opacity: 1,
          }}
        ></div>
      )}

      <div className='absolute top-4 left-4 flex flex-col gap-3 z-30 pointer-events-none w-72'>
        <div className='neumorph-card px-3 py-3 w-full'>
          <div className='flex items-baseline justify-between gap-3 mb-2'>
            <div className='text-[10px] font-mono text-gray-400'>VITALS</div>
            <div className='text-sm font-mono font-semibold' aria-hidden>
              <span
                className={
                  health < 30 ? "text-red-400 animate-pulse" : "text-green-300"
                }
              >
                {Math.round(health)}%
              </span>
            </div>
          </div>
          <LiquidBar
            value={health}
            color={health < 30 ? "#FF9B8A" : "#6BD07A"}
            ariaLabel='Health'
          />
        </div>

        <div className='neumorph-card px-3 py-3 w-full'>
          <div className='flex items-baseline justify-between gap-3 mb-2'>
            <div className='text-[10px] font-mono text-gray-400'>
              IDENTITY INTEGRITY
            </div>
            <div className='text-sm font-mono font-semibold text-cyan-300'>
              {Math.round(integrity)}%
            </div>
          </div>
          <LiquidBar
            value={integrity}
            color='#78A9FF'
            ariaLabel='Identity integrity'
          />
        </div>

        <div
          className='neumorph-card px-3 py-2 flex items-center justify-between gap-3'
          aria-hidden
        >
          <div className='flex items-center gap-3'>
            {/* <div className='w-9 h-9 rounded-full bg-gradient-to-br justify-center'>
              <span className='text-sm'>✨</span>
            </div> */}
            <div className='text-sm font-mono text-yellow-500'>
              DATA FRAGMENTS
            </div>
          </div>
          <div className='text-sm font-bold text-gray-400'>
            {memories} / {TOTAL_MEMORIES}
          </div>
        </div>

        {/* Graphics quality (high-detail) — toggle for visual polish */}
        <div className='neumorph-card px-3 py-2 w-full flex items-center justify-between gap-3'>
          <div className='text-[10px] font-mono text-gray-400'>GRAPHICS</div>
          <div className='flex gap-2'>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("high-detail", { detail: true }),
                )
              }
              className='px-3 py-1 text-[12px] rounded-md bg-white/6 text-white/90 border border-white/6 hover:bg-white/10'
              aria-label='High detail on'
            >
              Detail On
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("high-detail", { detail: false }),
                )
              }
              className='px-3 py-1 text-[12px] rounded-md bg-[rgba(255,255,255,0.03)] text-white/60 border border-white/6 hover:bg-white/6'
              aria-label='High detail off'
            >
              Detail Off
            </button>
          </div>
        </div>
      </div>

      <div className='absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30 pointer-events-auto'>
        {MASKS.map((m) => {
          const isActive = mask === m.id;
          return (
            <div
              key={m.id}
              className={`group relative flex flex-col items-center justify-center min-w-[56px] min-h-[56px] rounded-2xl bg-[rgba(255,255,255,0.02)] ring-1 ring-white/3 transition-transform duration-300 cursor-pointer overflow-visible shadow-[8px_10px_20px_rgba(2,6,23,0.28),inset_-6px_-6px_12px_rgba(255,255,255,0.02)] ${isActive ? "translate-y-[-6px] border-2 border-yellow-300 shadow-[0_18px_40px_rgba(250,204,21,0.18)]" : "border-gray-700/30 hover:translate-y-[-3px] hover:shadow-[0_12px_30px_rgba(2,6,23,0.18)]"}`}
              onClick={() => {
                const event = new KeyboardEvent("keydown", {
                  code: `Digit${m.key}`,
                });
                window.dispatchEvent(event);
              }}
              role='button'
              aria-label={`${m.label} (key ${m.key})`}
            >
              <span className='text-xl filter drop-shadow-md'>{m.icon}</span>
              <span className='absolute top-1 right-1 text-[8px] font-mono text-gray-500'>
                {m.key}
              </span>

              <div
                className={`absolute bottom-16 left-1/2 -translate-x-1/2 w-40 bg-[rgba(7,9,14,0.7)] ring-1 ring-white/4 p-3 text-center rounded-xl shadow-[inset_-6px_-6px_12px_rgba(255,255,255,0.02)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 ${isActive ? "opacity-100 scale-100 border border-yellow-300" : "scale-95"}`}
              >
                <div
                  className={`font-bold text-sm ${isActive ? "text-yellow-300" : "text-white"}`}
                >
                  {m.label}
                </div>
                <div className='text-[11px] text-gray-400 uppercase tracking-tighter mt-1'>
                  {m.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UIOverlay;
