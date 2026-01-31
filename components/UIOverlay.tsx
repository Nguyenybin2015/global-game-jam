import React, { useEffect, useState, useRef } from "react";
import {
  GameState,
  MaskType,
  TOTAL_MEMORIES,
  LevelTimeEntry,
  LevelTimeEntry as _LevelTimeEntryUnused,
  TIMES_STORAGE_KEY,
  CampaignRunEntry,
  CAMPAIGN_TIMES_KEY,
} from "../types";
import LiquidBar from "./LiquidBar";
import MaskButton from "./MaskButton";
import MaskOverlay from "./MaskOverlay";
import ThoughtBubble from "./ThoughtBubble";

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
  currentLevelTime: number;
}

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
  currentLevelTime,
}) => {
  const isPlaying = gameState === GameState.PLAYING;
  const isPaused = gameState === GameState.PAUSED;
  const isLowHealth = health < 40;
  const glitchIntensity = isLowHealth ? Math.min(1, (40 - health) / 30) : 0;

  // Procedural-level toggle (kept locally in the HUD and emitted to canvas)
  const [procMode, setProcMode] = useState(false);

  // Campaign modal + completed-levels (used by the 20-level campaign view)
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<Set<number>>(
    new Set(),
  );

  // Endless-run HUD (shows how many levels cleared in the current run)
  const [endlessRunCount, setEndlessRunCount] = useState(0);
  const [endlessActive, setEndlessActive] = useState(false);
  // Speech bubble state for the endless-mode intro (shown above player)
  const [showEndlessSpeech, setShowEndlessSpeech] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);

  useEffect(() => {
    const onProc = (ev: Event) => setProcMode(!!(ev as CustomEvent).detail);
    window.addEventListener("proc-levels", onProc as EventListener);

    // reflect completed levels by reading per-level times
    const loadCompleted = () => {
      try {
        const raw = localStorage.getItem(TIMES_STORAGE_KEY);
        const arr: LevelTimeEntry[] = raw ? JSON.parse(raw) : [];
        const s = new Set<number>();
        for (const e of arr) {
          if (typeof e.levelId === "number") s.add(e.levelId);
        }
        setCompletedLevels(s);
      } catch (err) {
        setCompletedLevels(new Set());
      }
    };

    loadCompleted();

    const onLevelSaved = (ev: Event) => loadCompleted();
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === TIMES_STORAGE_KEY) loadCompleted();
    };

    // endless-mode events (dispatched by canvas)
    const onEndlessChanged = (ev: Event) => {
      const d: any = (ev as CustomEvent).detail || {};
      setEndlessRunCount(d.levelsCompleted || 0);
      setEndlessActive(!!d.enabled);
      if (!d.enabled) {
        // hide modal if it was open
        setShowCampaignModal(false);
      }
    };
    const onEndlessLevel = (ev: Event) => {
      const d: any = (ev as CustomEvent).detail || {};
      setEndlessRunCount(d.levelsCompleted || 0);
      setEndlessActive(true);
    };

    window.addEventListener("level-time-saved", onLevelSaved as EventListener);
    window.addEventListener("storage", onStorage as EventListener);
    window.addEventListener(
      "endless-mode-changed",
      onEndlessChanged as EventListener,
    );
    window.addEventListener(
      "endless-level-complete",
      onEndlessLevel as EventListener,
    );

    // listen for player head position updates from the canvas
    const onHeadPos = (ev: Event) => {
      const d: any = (ev as CustomEvent).detail || {};
      if (typeof d.x === "number" && typeof d.y === "number") {
        setBubblePos({ x: d.x, y: d.y });
      }
    };
    window.addEventListener("player-head-pos", onHeadPos as EventListener);

    return () => {
      window.removeEventListener("proc-levels", onProc as EventListener);
      window.removeEventListener(
        "level-time-saved",
        onLevelSaved as EventListener,
      );
      window.removeEventListener("storage", onStorage as EventListener);
      window.removeEventListener(
        "endless-mode-changed",
        onEndlessChanged as EventListener,
      );
      window.removeEventListener(
        "endless-level-complete",
        onEndlessLevel as EventListener,
      );
      window.removeEventListener("player-head-pos", onHeadPos as EventListener);
    };
  }, []);

  // Dismiss the endless intro speech when the player presses movement keys.
  useEffect(() => {
    if (!showEndlessSpeech) return;
    const onKey = (e: KeyboardEvent) => {
      const codes = [
        "ArrowLeft",
        "ArrowRight",
        "KeyA",
        "KeyD",
        "Space",
        "KeyW",
      ];
      if (codes.includes(e.code)) {
        try {
          window.speechSynthesis.cancel();
        } catch (err) {
          /* ignore */
        }
        setShowEndlessSpeech(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEndlessSpeech]);

  // measure bubble height so we can position it precisely above the head
  useEffect(() => {
    const measure = () => {
      try {
        const h = bubbleRef.current ? bubbleRef.current.offsetHeight : 0;
        setBubbleHeight(h);
      } catch (err) {
        setBubbleHeight(0);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [showEndlessSpeech, bubblePos]);

  // --- Leaderboard / live-level-time (reads from localStorage and updates on save) ---
  const [topTimes, setTopTimes] = useState<LevelTimeEntry[]>([]);
  const formatTime = (ms: number) => {
    const total = Math.max(0, Math.floor(ms));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const centi = Math.floor((total % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
  };

  // load per-level leaderboard + campaign leaderboard; listen for saves/storage
  const [campaignTop, setCampaignTop] = useState<CampaignRunEntry[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"level" | "campaign">(
    "level",
  );
  const [lastCampaignRun, setLastCampaignRun] =
    useState<CampaignRunEntry | null>(null);

  const loadTop = () => {
    try {
      const raw = localStorage.getItem(TIMES_STORAGE_KEY);
      const arr: LevelTimeEntry[] = raw ? JSON.parse(raw) : [];
      setTopTimes(arr.slice(0, 5));
    } catch (err) {
      setTopTimes([]);
    }
  };

  const loadCampaignTop = () => {
    try {
      const raw = localStorage.getItem(CAMPAIGN_TIMES_KEY);
      const arr: CampaignRunEntry[] = raw ? JSON.parse(raw) : [];
      setCampaignTop(arr.slice(0, 5));
    } catch (err) {
      setCampaignTop([]);
    }
  };

  useEffect(() => {
    loadTop();
    loadCampaignTop();

    const onLevelSaved = (ev: Event) => loadTop();
    const onCampaignSaved = (ev: Event) => {
      const d: any = (ev as CustomEvent).detail;
      if (d && d.entry) setLastCampaignRun(d.entry as CampaignRunEntry);
      loadCampaignTop();
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === TIMES_STORAGE_KEY) loadTop();
      if (ev.key === CAMPAIGN_TIMES_KEY) loadCampaignTop();
    };

    window.addEventListener("level-time-saved", onLevelSaved as EventListener);
    window.addEventListener(
      "campaign-time-saved",
      onCampaignSaved as EventListener,
    );
    window.addEventListener("storage", onStorage as EventListener);

    return () => {
      window.removeEventListener(
        "level-time-saved",
        onLevelSaved as EventListener,
      );
      window.removeEventListener(
        "campaign-time-saved",
        onCampaignSaved as EventListener,
      );
      window.removeEventListener("storage", onStorage as EventListener);
    };
  }, []);

  const clearLeaderboard = () => {
    try {
      localStorage.removeItem(TIMES_STORAGE_KEY);
      setTopTimes([]);
    } catch (err) {
      /* ignore */
    }
  };

  const clearCampaignLeaderboard = () => {
    try {
      localStorage.removeItem(CAMPAIGN_TIMES_KEY);
      setCampaignTop([]);
    } catch (err) {
      /* ignore */
    }
  };

  const rankFor = (ms: number) => {
    try {
      const raw = localStorage.getItem(TIMES_STORAGE_KEY);
      const arr: LevelTimeEntry[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((a) => a.timeMs === ms);
      return idx >= 0 ? idx + 1 : -1;
    } catch (err) {
      return -1;
    }
  };

  const rankForCampaign = (ms: number) => {
    try {
      const raw = localStorage.getItem(CAMPAIGN_TIMES_KEY);
      const arr: CampaignRunEntry[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((a) => a.totalTimeMs === ms);
      return idx >= 0 ? idx + 1 : -1;
    } catch (err) {
      return -1;
    }
  };

  // Tutorial: close with Escape for quick keyboard access
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // close tutorial with Escape (existing behavior)
      if (e.key === "Escape" && gameState === GameState.TUTORIAL) {
        setGameState(GameState.START);
        return;
      }

      // toggle pause with 'P' — resume with Escape when paused
      if (e.code === "KeyP") {
        if (gameState === GameState.PLAYING) setGameState(GameState.PAUSED);
        else if (gameState === GameState.PAUSED)
          setGameState(GameState.PLAYING);
      }
      if (e.key === "Escape" && gameState === GameState.PAUSED) {
        setGameState(GameState.PLAYING);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameState, setGameState]);

  // Saved-campaign presence (reads localStorage and keeps UI in sync)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null as HTMLDivElement | null);

  // close settings on Escape / outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    const onDown = (ev: MouseEvent | TouchEvent) => {
      if (!settingsRef.current) return;
      const target = ev.target as Node | null;
      if (target && !settingsRef.current.contains(target))
        setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);
  const [hasSave, setHasSave] = useState(false);
  useEffect(() => {
    const key = "htvn_campaign_save";
    const check = () => setHasSave(!!localStorage.getItem(key));
    check();
    const onStorage = () => check();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // small HUD-only expression helpers (keeps SVG crisp and readable)
  const svgBrowTilt = (() => {
    if (mask === MaskType.WORKER) return -6;
    if (mask === MaskType.CHILD) return -4;
    if (mask === MaskType.STUDENT) return 4;
    return 0;
  })();

  // Render helpers
  // (moved to a small component to avoid parser edge-cases)
  // See: components/MaskOverlay.tsx

  const svgMouthPath = (() => {
    if (mask === MaskType.STUDENT) return "M15 15 Q20 18 25 15";
    if (mask === MaskType.WORKER) return "M17 15 H23";
    // true-self: subtle smile when integrity high
    const smile = Math.max(-3, Math.min(4, (integrity - 50) / 8));
    return `M16 16 Q20 ${15 + smile} 24 16`;
  })();
  const hudPupilNudge =
    Math.sin(Date.now() * 0.003) * (isLowHealth ? 0.6 : 0.28);

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
      <div className="absolute inset-0 bg-black/92 flex items-center justify-center p-6 z-50 crt-overlay">
        <div className="w-[820px] grid grid-cols-2 gap-6 p-6 bg-black/75 border-2 border-yellow-600/20 rounded-lg backdrop-blur-md shadow-[0_0_60px_rgba(34,197,94,0.06)] pointer-events-auto">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-44 h-44 bg-gradient-to-br from-neutral-800 to-neutral-700 rounded-xl flex items-center justify-center shadow-lg border border-white/6">
              <div className="w-32 h-32 rounded-full bg-yellow-300 flex items-center justify-center text-4xl shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                🙂
              </div>
            </div>
            <div className="text-left text-sm text-gray-300 max-w-xs">
              <h2 className="text-xl font-bold text-yellow-400">
                HÀNH TRÌNH VỀ NHÀ
              </h2>
              {/* <p className='mt-2'>
                [SYSTEM DETECTED: NEW SUBJECT] — Khởi tạo môi trường mô phỏng
                cảm xúc.
              </p> */}
              <p className="mt-2 text-xs text-gray-400">
                Dùng phím <span className="font-mono">1/2/3/4/0</span> để thay
                đổi mặt nạ. Nhấn <span className="font-mono">Space</span> để
                nhảy.
              </p>

              {/* Pre-generated campaign toggle (20 levels) */}
              {/* <div className='mt-3 flex items-center gap-3'>
                <label className='flex items-center gap-2 text-sm text-gray-300'>
                  <input
                    type='checkbox'
                    checked={procMode}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setProcMode(v);
                      window.dispatchEvent(
                        new CustomEvent("proc-levels", { detail: v }),
                      );
                    }}
                    aria-label='Bật chiến dịch 20 màn'
                    className='w-4 h-4 bg-black/20 rounded'
                  />
                  <span className='font-semibold'>Chiến dịch — 20 màn</span>
                </label>
                <div className='text-xs text-gray-400'>
                  Tải trước 20 bản đồ, không sinh vô hạn
                </div>
              </div> */}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  // start endless/procedural run and show speech bubble
                  window.dispatchEvent(
                    new CustomEvent("endless-mode", { detail: true }),
                  );
                  setGameState(GameState.PLAYING);
                  // show speech bubble and speak intro
                  setShowEndlessSpeech(true);
                  // speak after a tiny delay so game canvas is ready
                  setTimeout(() => {
                    try {
                      const text = `Nhân vật chính bị lạc khỏi Nhà — nơi tượng trưng cho bản ngã nguyên vẹn. Trên hành trình lớn lên, đi học, đi làm, hòa nhập xã hội, anh ta buộc phải đeo nhiều mặt nạ. Mỗi mặt nạ giúp vượt qua hoàn cảnh, nhưng làm mòn Identity Integrity. Chỉ khi biết khi nào nên đeo, khi nào nên tháo, nhân vật mới có thể trở về Nhà.`;
                      const u = new SpeechSynthesisUtterance(text);
                      u.lang = "vi-VN";
                      u.rate = 0.95;
                      u.pitch = 1.0;
                      u.onend = () => setShowEndlessSpeech(false);
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(u);
                    } catch (err) {
                      // ignore if SpeechSynthesis unavailable
                      setShowEndlessSpeech(false);
                    }
                  }, 150);
                }}
                className="px-6 py-3 bg-emerald-500 text-black font-bold rounded hover:scale-105 transition transform shadow-md"
                title="Chơi vô tận — đếm số màn"
              >
                BẮT ĐẦU — VÔ TẬN
              </button>

              <button
                onClick={() => setShowCampaignModal(true)}
                className="px-4 py-3 border border-yellow-600 text-yellow-200 rounded text-sm"
                aria-haspopup="dialog"
                aria-expanded={showCampaignModal}
              >
                CHIẾN DỊCH — 20 MÀN
              </button>
            </div>

            {/* (Intro bubble moved to in-game overlay so it can follow the player) */}
          </div>

          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-yellow-900/20 p-3 border border-yellow-700 rounded text-sm text-gray-400">
                <div className="font-bold text-yellow-300">VUI VẺ</div>
                Tăng tốc, nảy bật.
              </div>
              <div className="bg-blue-900/20 p-3 border border-blue-700 rounded text-sm text-gray-400">
                <div className="font-bold text-blue-300">U SẦU</div>
                Lơ lửng, chậm.
              </div>
              <div className="bg-red-900/20 p-3 border border-red-700 rounded text-sm text-gray-400">
                <div className="font-bold text-red-300">GIẬN DỮ</div>
                Phá vỡ chướng ngại.
              </div>
            </div>
            <div className="bg-black/60 border border-white/6 p-3 rounded mb-3 text-sm text-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-2">
                NHIỆM VỤ
              </div>
              <div>- Thu thập mảnh ký ức để mở ngõ về nhà.</div>
              <div className="mt-2 text-xs text-gray-400">
                Lưu ý: Mặt nạ thay đổi vật lý và hành vi nhân vật.
              </div>
            </div>

            {/* Leaderboards: per-level (default) and 20-level campaign */}
            <div className="bg-[rgba(255,255,255,0.02)] border border-white/6 p-3 rounded mb-3 text-sm text-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2 items-center">
                  <div className="text-xs font-mono text-gray-400">
                    BẢNG XẾP HẠNG
                  </div>
                  {/* <div className='text-[11px] text-gray-400'>
                    (Chọn: màn thường / chiến dịch 20 màn)
                  </div> */}
                </div>

                {/* <div className='flex gap-2'>
                  <div className='flex items-center gap-2 bg-[rgba(255,255,255,0.02)] p-1 rounded'>
                    <button
                      onClick={() => setLeaderboardTab("level")}
                      className={`px-3 py-1 text-[12px] rounded-md ${leaderboardTab === "level" ? "bg-white/6 text-white" : "text-gray-300"}`}
                      aria-pressed={leaderboardTab === "level"}
                    >
                      Màn thường
                    </button>
                    <button
                      onClick={() => setLeaderboardTab("campaign")}
                      className={`px-3 py-1 text-[12px] rounded-md ${leaderboardTab === "campaign" ? "bg-white/6 text-white" : "text-gray-300"}`}
                      aria-pressed={leaderboardTab === "campaign"}
                    >
                      Chiến dịch — 20 màn
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (leaderboardTab === "level") clearLeaderboard();
                      else clearCampaignLeaderboard();
                    }}
                    className='text-[11px] px-2 py-1 border rounded text-gray-300 border-white/6'
                  >
                    XÓA
                  </button>
                </div> */}
              </div>

              {leaderboardTab === "level" ? (
                topTimes.length === 0 ? (
                  <div className="text-xs text-gray-500">
                    Chưa có thành tích
                  </div>
                ) : (
                  <ol className="text-sm text-gray-300 list-decimal ml-4 space-y-1">
                    {topTimes.map((t) => (
                      <li
                        key={t.timestamp}
                        className="flex items-center justify-between"
                      >
                        <div className="truncate max-w-[11rem]">
                          {t.levelName}
                        </div>
                        <div className="ml-2 font-mono text-amber-200">
                          {formatTime(t.timeMs)}
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              ) : campaignTop.length === 0 ? (
                <div className="text-xs text-gray-500">
                  Chưa có kết quả chiến dịch
                </div>
              ) : (
                <ol className="text-sm text-gray-300 list-decimal ml-4 space-y-1">
                  {campaignTop.map((c) => (
                    <li
                      key={c.timestamp}
                      className="flex items-center justify-between"
                    >
                      <div className="truncate max-w-[11rem]">
                        Chiến dịch — {c.levels} màn
                      </div>
                      <div className="ml-2 font-mono text-amber-200">
                        {formatTime(c.totalTimeMs)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setGameState(GameState.TUTORIAL)}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 shadow-md"
                aria-label="Hướng dẫn (mở)"
              >
                HƯỚNG DẪN
              </button>
            </div>
          </div>
        </div>

        {/* Campaign modal: list 20 fixed levels, show which were played (3★ when completed) */}
        {showCampaignModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chiến dịch — 20 màn"
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
          >
            <div className="w-[760px] max-w-full bg-black/85 border border-white/6 rounded-lg p-5 text-sm text-gray-200 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-bold">Chiến dịch — 20 màn</div>
                  <div className="text-xs text-gray-400">
                    Danh sách bản đồ cố định. Màn đã chơi sẽ được đánh dấu 3★.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // ensure campaign is pre-generated and start at 0
                      window.dispatchEvent(
                        new CustomEvent("proc-levels", { detail: true }),
                      );
                      window.dispatchEvent(
                        new CustomEvent("start-pregen-level", {
                          detail: { index: 0 },
                        }),
                      );
                      setShowCampaignModal(false);
                      setGameState(GameState.PLAYING);
                    }}
                    className="px-3 py-2 bg-yellow-500 text-black rounded font-semibold"
                  >
                    Bắt đầu chiến dịch
                  </button>
                  <button
                    onClick={() => setShowCampaignModal(false)}
                    className="px-3 py-2 border rounded text-gray-300"
                  >
                    Đóng
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 max-h-[56vh] overflow-auto pr-2">
                {Array.from({ length: 20 }).map((_, i) => {
                  const played = completedLevels.has(i);
                  const name =
                    i === 0
                      ? "Tuổi Thơ"
                      : i === 1
                        ? "Trường Học"
                        : i === 2
                          ? "Sự Nghiệp"
                          : i === 3
                            ? "Xã Hội"
                            : i === 4
                              ? "Về Nhà"
                              : `TỰ TẠO #${i}`;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("proc-levels", { detail: true }),
                        );
                        window.dispatchEvent(
                          new CustomEvent("start-pregen-level", {
                            detail: { index: i },
                          }),
                        );
                        setShowCampaignModal(false);
                        setGameState(GameState.PLAYING);
                      }}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.03)] ${played ? "ring-1 ring-yellow-500/30" : ""}`}
                      aria-pressed={played}
                    >
                      <div className="text-sm truncate max-w-[10rem]">
                        <div className="font-semibold">
                          {i + 1}. {name}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1">
                          Độ dài: ~—
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* show 3 stars filled when played */}
                        {Array.from({ length: 3 }).map((_, s) => (
                          <svg
                            key={s}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={played ? "#F5D76E" : "none"}
                            stroke={
                              played ? "#B97718" : "rgba(255,255,255,0.12)"
                            }
                            strokeWidth="1"
                            className="opacity-95"
                          >
                            <path d="M12 .587l3.668 7.431L23.4 9.75l-5.7 5.56L18.834 24 12 20.02 5.166 24l1.134-8.69L.6 9.75l7.732-1.732z" />
                          </svg>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === GameState.TUTORIAL) {
    return (
      <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-8 z-50">
        <div className="w-[900px] max-w-full bg-white/6 border border-white/8 rounded-lg p-6 text-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-4">
                <h2 className="text-3xl font-bold">HƯỚNG DẪN</h2>
                <div className="text-sm text-gray-300 mt-2">
                  Nhấn <span className="font-mono">Escape</span> để quay lại
                  menu
                </div>
              </div>

              {/* Controls visual guide */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[rgba(0,0,0,0.25)] rounded-lg">
                  <div className="text-sm text-gray-300 mb-2">Di chuyển</div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-14 h-14 bg-white/6 rounded">
                      <div className="text-2xl">← →</div>
                    </div>
                    <div className="text-sm text-gray-200">Hoặc</div>
                    <div className="flex items-center gap-1">
                      <div className="px-2 py-1 bg-black/30 rounded font-mono">
                        A
                      </div>
                      <div className="px-2 py-1 bg-black/30 rounded font-mono">
                        D
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[rgba(0,0,0,0.25)] rounded-lg">
                  <div className="text-sm text-gray-300 mb-2">Nhảy</div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-24 h-12 bg-white/6 rounded font-mono text-sm">
                      Space
                    </div>
                    <div className="text-sm text-gray-200">hoặc</div>
                    <div className="px-3 py-1 bg-black/30 rounded font-mono">
                      W
                    </div>
                  </div>
                </div>

                <div className="col-span-2 p-3 bg-[rgba(0,0,0,0.12)] rounded-lg">
                  <div className="text-sm text-gray-300 mb-2">
                    Mặt nạ (chọn bằng phím)
                  </div>
                  <div className="flex gap-3 items-center">
                    {MASKS.map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-xl">
                          {m.icon}
                        </div>
                        <div className="text-xs text-gray-300 font-semibold">
                          {m.key}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {m.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[rgba(0,0,0,0.25)] rounded-lg">
                  <div className="text-sm text-gray-300 mb-2">Mục tiêu</div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-black">
                      ✨
                    </div>
                    <div className="text-sm">
                      Thu thập mảnh ký ức và về tới cửa nhà
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[rgba(0,0,0,0.25)] rounded-lg">
                  <div className="text-sm text-gray-300 mb-2">Chế độ chơi</div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-white/6 flex items-center justify-center">
                        1
                      </div>
                      <div className="text-sm">
                        Chiến dịch — 20 màn (bấm để mở danh sách)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-white/6 flex items-center justify-center">
                        ▶
                      </div>
                      <div className="text-sm">
                        Vô tận — nhấn BẮT ĐẦU để chơi
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-64">
              <div className="bg-black/40 p-4 rounded-lg mb-4">
                <div className="text-xs text-gray-400 mb-2">MỤC TIÊU</div>
                <div className="text-sm text-white flex items-start gap-2">
                  <div className="mt-1 w-8 h-8 rounded-full bg-[rgba(241,196,15,0.16)] flex items-center justify-center">
                    🏠
                  </div>
                  <div>Thu thập mảnh ký ức và về tới cửa nhà.</div>
                </div>
              </div>

              <div className="bg-black/40 p-4 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">MẸP NHANH</div>
                <ul className="text-sm text-gray-300 list-none ml-0 space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-white/6 flex items-center justify-center">
                      🔐
                    </div>
                    Chuyển mặt nạ phù hợp để vượt tường
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-white/6 flex items-center justify-center">
                      💖
                    </div>
                    Dùng CHÂN THẬT để hồi Integrity
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-white/6 flex items-center justify-center">
                      🏁
                    </div>
                    Vô tận: cố gắng vượt nhiều màn nhất có thể
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setGameState(GameState.START)}
              className="px-4 py-2 bg-emerald-500 text-black rounded font-bold"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className="absolute inset-0 bg-red-950/90 flex items-center justify-center p-8 z-50 crt-overlay">
        <div className="pointer-events-auto text-center">
          <h1 className="text-6xl font-bold text-red-500 mb-4 font-mono tracking-widest glitch-text">
            THẤT BẠI
          </h1>
          <p className="text-red-200 text-xl mb-8 font-mono border-t border-b border-red-800 py-4">
            {deathReason}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setGameState(GameState.START)}
              className="px-8 py-3 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-bold font-mono rounded transition-colors"
            >
              TÁI KHỞI ĐỘNG
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PAUSED overlay (lightweight) ---
  if (gameState === GameState.PAUSED) {
    return (
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6 z-50 pointer-events-auto">
        <div className="w-[520px] neumorph-card p-6 text-center pointer-events-auto">
          <h2 className="text-4xl font-bold mb-2">TẠM DỪNG</h2>
          <p className="text-sm text-gray-400 mb-4">
            Trò chơi đã tạm dừng. Nhấn <span className="font-mono">P</span> hoặc{" "}
            <span className="font-mono">Escape</span> để tiếp tục.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setGameState(GameState.PLAYING)}
              className="px-6 py-3 bg-green-500 text-black font-bold rounded hover:bg-green-400"
            >
              TIẾP TỤC
            </button>
            <button
              onClick={() => setGameState(GameState.START)}
              className="px-4 py-3 border border-white/6 rounded text-sm text-gray-300"
            >
              THOÁT
            </button>
          </div>
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
        <div className="pointer-events-auto">
          <h1 className="text-5xl font-bold text-white mb-4">
            {isTrueEnding ? "THOÁT KHỎI MA TRẬN" : "VỀ ĐẾN NHÀ"}
          </h1>
          <p className="text-white text-xl italic mb-4">
            {isTrueEnding
              ? "S.E.R.A không thể tính toán được cảm xúc chân thật của bạn. Bạn đã tự do."
              : "Bạn đã về nhà, nhưng S.E.R.A vẫn đang quan sát..."}
          </p>

          {currentLevelTime > 0 && (
            <div className="mb-4 text-sm text-gray-100">
              <div>
                Thời gian hoàn thành:{" "}
                <span className="font-mono text-amber-200">
                  {formatTime(currentLevelTime)}
                </span>
              </div>
              {rankFor(currentLevelTime) > 0 ? (
                <div className="text-xs text-amber-100">
                  Xếp hạng: #{rankFor(currentLevelTime)}
                </div>
              ) : (
                <div className="text-xs text-gray-300">Không vào top 5</div>
              )}
            </div>
          )}

          {/* show campaign completion info (if available) */}
          {procMode && lastCampaignRun && (
            <div className="mb-3 text-sm text-amber-100">
              <div>
                Chiến dịch 20 màn — thời gian:{" "}
                <span className="font-mono">
                  {formatTime(lastCampaignRun.totalTimeMs)}
                </span>
              </div>
              <div className="text-xs mt-1">
                Xếp hạng:{" "}
                {rankForCampaign(lastCampaignRun.totalTimeMs) > 0
                  ? `#${rankForCampaign(lastCampaignRun.totalTimeMs)}`
                  : "Không vào top 5"}
              </div>
            </div>
          )}

          {procMode && !lastCampaignRun && (
            <div className="text-sm text-amber-200 mb-4">
              Chiến dịch 20 màn: <span className="font-semibold">BẬT</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setGameState(GameState.START)}
              className="px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors"
            >
              Chơi lại
            </button>

            {hasSave && (
              <>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("replay-campaign"));
                    setGameState(GameState.PLAYING);
                  }}
                  className="px-4 py-2 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400"
                >
                  CHƠI LẠI CHIẾN DỊCH
                </button>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("clear-save"))
                  }
                  className="px-3 py-2 border border-white/20 text-sm rounded text-gray-200"
                >
                  XÓA LƯU
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-visible">
        {/* Thought bubble rendered at player head when position is available */}
        {showEndlessSpeech && bubblePos && (
          <div
            ref={(el) => (bubbleRef.current = el)}
            className="pointer-events-none z-40"
            style={{
              position: "absolute",
              left: bubblePos.x + 270,
              top: bubblePos.y - bubbleHeight - 150,
              transform: "translateX(-50%)",
              transition: "top 120ms ease-out, opacity 120ms",
            }}
          >
            <ThoughtBubble
              text={`Nhân vật chính bị lạc khỏi “Nhà” – nơi tượng trưng cho bản ngã nguyên vẹn.\nTrên hành trình lớn lên, đi học, đi làm, hòa nhập xã hội, anh ta buộc phải đeo nhiều “mặt nạ”.\nMỗi mặt nạ giúp vượt qua hoàn cảnh, nhưng làm mòn Identity Integrity.\nChỉ khi biết khi nào nên đeo – khi nào nên tháo, nhân vật mới có thể trở về Nhà.`}
            />
          </div>
        )}
        <div className="absolute inset-0 z-40 pointer-events-none crt-line opacity-20"></div>

        {isPlaying && isLowHealth && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <div
              className="absolute inset-0 glitch-scanlines w-full h-full"
              style={{ opacity: 0.3 + glitchIntensity * 0.4 }}
            ></div>
            <div
              className="absolute inset-0 w-full h-full bg-red-500/20"
              style={{
                mixBlendMode: "color",
                animation: `glitch-flash ${0.6 - glitchIntensity * 0.4}s infinite steps(2, jump-none)`,
                opacity: 0,
              }}
            ></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600/80 font-mono font-bold text-9xl uppercase opacity-10 blur-[2px] animate-pulse">
              SYSTEM FAILURE
            </div>
          </div>
        )}

        <div
          className={`absolute top-4 right-4 max-w-xs w-[22rem] border p-3 rounded-2xl sera-console z-30 flex gap-3 items-start transition-colors duration-500`}
          role="status"
          aria-live="polite"
          style={{
            background: "linear-gradient(180deg, #CFEFF6 0%, #F7FBFD 100%)",
            backdropFilter: "blur(10px)",
            opacity: 0.78,
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
          }}
        >
          <div className="relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-neutral-800/60 to-neutral-700/40 flex items-center justify-center shadow-[0_8px_30px_rgba(2,6,23,0.45)] ring-1 ring-white/3">
            {/* small SVG avatar that mirrors canvas persona (mask + low-health).
              A tiny live-canvas (`#mini-avatar`) overlays the SVG and mirrors the
              main game canvas for perfect fidelity on HUD. */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${isLowHealth ? "animate-pulse" : ""}`}
              aria-hidden
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="player avatar"
              >
                <defs>
                  <radialGradient id="headG" cx="50%" cy="30%" r="70%">
                    <stop
                      offset="0%"
                      stopColor={
                        mask === MaskType.CHILD
                          ? "#FFF6D2"
                          : mask === MaskType.STUDENT
                            ? "#EAF7FF"
                            : mask === MaskType.WORKER
                              ? "#FFF1F0"
                              : "#FFF7D6"
                      }
                      stopOpacity="1"
                    />
                    <stop
                      offset="65%"
                      stopColor={mask === MaskType.NONE ? "#F1C40F" : "#FFFFFF"}
                      stopOpacity="0.95"
                    />
                  </radialGradient>
                  <radialGradient id="spec" cx="30%" cy="25%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                    <stop offset="60%" stopColor="rgba(255,255,255,0.0)" />
                  </radialGradient>
                  <filter
                    id="soft"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="1.2" result="b" />
                    <feBlend in="SourceGraphic" in2="b" mode="normal" />
                  </filter>
                </defs>

                {/* shadow */}
                <ellipse
                  cx="20"
                  cy="33"
                  rx="12"
                  ry="4"
                  fill="rgba(0,0,0,0.18)"
                />

                {/* body (simplified) */}
                <rect
                  x="12"
                  y="22"
                  width="16"
                  height="10"
                  rx="3"
                  fill={mask === MaskType.WORKER ? "#c0392b" : "#ecf0f1"}
                />

                {/* head with inner shading */}
                <circle
                  cx="20"
                  cy="12"
                  r="9"
                  fill="url(#headG)"
                  stroke={
                    isLowHealth ? "rgba(220,38,38,0.9)" : "rgba(0,0,0,0.08)"
                  }
                  strokeWidth="1.2"
                />
                <circle
                  cx="18"
                  cy="9"
                  r="3.8"
                  fill="url(#spec)"
                  opacity={health < 36 ? 0.95 : 0.6}
                />

                {/* eyebrows (sharper) + small nose */}
                {mask === MaskType.CHILD ? (
                  <>
                    <path
                      d="M11.5 9.5 Q14 7.5 16.5 9.5"
                      stroke="#111"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.95"
                      transform={`rotate(${svgBrowTilt * 0.6} 14 8)`}
                    />
                    <path
                      d="M23.5 9.5 Q26 7.5 28.5 9.5"
                      stroke="#111"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.95"
                      transform={`rotate(${svgBrowTilt * 0.6} 26 8)`}
                    />
                  </>
                ) : mask === MaskType.STUDENT ? (
                  <>
                    <path
                      d="M11 8.8 Q14 7.8 17 9.2"
                      stroke="#222"
                      strokeWidth="1"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.9"
                      transform={`rotate(${svgBrowTilt * 0.5} 14 8)`}
                    />
                    <path
                      d="M24 9.2 Q27 7.8 29 8.8"
                      stroke="#222"
                      strokeWidth="1"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.9"
                      transform={`rotate(${svgBrowTilt * 0.5} 26 8)`}
                    />
                  </>
                ) : mask === MaskType.WORKER ? (
                  <>
                    <path
                      d="M11 8.5 L16 10"
                      stroke="#111"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      transform={`rotate(${svgBrowTilt} 14 9)`}
                    />
                    <path
                      d="M24 10 L29 8.5"
                      stroke="#111"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      transform={`rotate(${-svgBrowTilt} 26 9)`}
                    />
                  </>
                ) : (
                  <>
                    <path
                      d="M12 9 Q15 8.4 18 9.2"
                      stroke="#111"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.9"
                      transform={`translate(${hudPupilNudge * 0.4},0)`}
                    />
                    <path
                      d="M22 9.2 Q25 8.4 28 9"
                      stroke="#111"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.9"
                      transform={`translate(${hudPupilNudge * 0.4},0)`}
                    />
                  </>
                )}

                {/* tiny nose */}
                <path
                  d="M19 11 L20 13 L21 11"
                  stroke="rgba(0,0,0,0.12)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* collar seam on body */}
                <path
                  d="M14 26 C18 22 22 22 26 26"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.9"
                />

                {/* eyes / blink (crisper) */}
                {health < 20 ? (
                  <>
                    <path
                      d="M13 10 L15 12 M15 10 L13 12"
                      stroke="#111"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M25 10 L27 12 M27 10 L25 12"
                      stroke="#111"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </>
                ) : mask === MaskType.SOCIAL ? (
                  <>
                    <circle cx="14.5" cy="11.5" r="2.2" fill="#111" />
                    <circle cx="25.5" cy="11.5" r="2.2" fill="#111" />
                  </>
                ) : mask === MaskType.CHILD ? (
                  <>
                    <path
                      d="M12 11 Q14 9 16 11"
                      stroke="#111"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M24 11 Q26 9 28 11"
                      stroke="#111"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </>
                ) : (
                  <>
                    <circle
                      cx="14.5"
                      cy="11.5"
                      r="1.6"
                      fill={mask === MaskType.NONE ? "#fff" : "#000"}
                    />
                    <circle
                      cx="25.5"
                      cy="11.5"
                      r="1.6"
                      fill={mask === MaskType.NONE ? "#fff" : "#000"}
                      stroke="rgba(0,0,0,0.12)"
                      strokeWidth="0.6"
                      shapeRendering="geometricPrecision"
                    />
                    <circle
                      cx="24.5"
                      cy="11.5"
                      r="1.6"
                      fill={mask === MaskType.NONE ? "#fff" : "#000"}
                      stroke="rgba(0,0,0,0.12)"
                      strokeWidth="0.6"
                      shapeRendering="geometricPrecision"
                    />
                    <circle
                      cx="13.5"
                      cy="10.5"
                      r="0.7"
                      fill="#fff"
                      opacity="0.98"
                    />
                    <circle
                      cx="24.5"
                      cy="10.5"
                      r="0.7"
                      fill="#fff"
                      opacity="0.98"
                    />
                  </>
                )}

                {/* mouth (driven by integrity + subtle motion) */}
                <path
                  d={svgMouthPath}
                  stroke="#111"
                  strokeWidth="1.05"
                  strokeLinecap="round"
                  fill="none"
                  opacity={mask === MaskType.WORKER ? 1 : 0.95}
                  transform={`translate(${hudPupilNudge * 0.4}, ${Math.sin(Date.now() * 0.002) * 0.2})`}
                />

                {/* accessory hints */}
                {mask === MaskType.WORKER && (
                  <rect
                    x="12.5"
                    y="4.5"
                    width="15"
                    height="4"
                    rx="2"
                    fill="#c0392b"
                  />
                )}
                {mask === MaskType.STUDENT && (
                  <rect
                    x="11"
                    y="4"
                    width="18"
                    height="3"
                    rx="1.2"
                    fill="#2c3e50"
                    transform="rotate(-6 20 5)"
                  />
                )}
                {mask === MaskType.CHILD && (
                  <circle cx="27" cy="6" r="2.2" fill="#f39c12" />
                )}

                {/* tiny 'true self' particle */}
                {mask === MaskType.NONE && (
                  <circle
                    cx={20 + Math.sin(Date.now() * 0.003) * 1.2}
                    cy={6 + Math.cos(Date.now() * 0.004) * 0.6}
                    r="1.6"
                    fill="rgba(241,196,15,0.28)"
                    filter="url(#soft)"
                  />
                )}

                {/* subtle ring when masked */}
                {mask !== MaskType.NONE && (
                  <circle
                    cx="20"
                    cy="12"
                    r="11.5"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                )}
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-white/6 mb-1 pb-1">
              <div className={`flex items-center gap-3`}>
                <div className="relative flex items-center" ref={settingsRef}>
                  {/* Settings button moved to the LEFT of the S.E.R.A header — high-contrast amber so it doesn't blend with the console BG */}
                  <button
                    onClick={() => setSettingsOpen((s) => !s)}
                    aria-expanded={settingsOpen}
                    aria-haspopup="menu"
                    aria-label="Cài đặt"
                    title="Cài đặt"
                    className="pointer-events-auto px-2 py-1 rounded-md text-[12px] font-mono border bg-amber-400 text-black shadow-sm ring-amber-300/30 hover:scale-105 transition"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 114.28 17.9l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82L4.21 4.9A2 2 0 116.9 2.21l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V2a2 2 0 114 0v.09c.12.66.56 1.23 1.2 1.51h.01c.66.29 1.38.18 1.82-.33l.06-.06A2 2 0 1119.4 6.1l-.06.06a1.65 1.65 0 00-.33 1.82V9c.42.35.76.8 1 1.32z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.9"
                      />
                    </svg>
                  </button>

                  {/* Dropdown anchored to the left header — same menu items, color adjusted to remain readable */}
                  {settingsOpen && (
                    <div
                      role="menu"
                      aria-label="Menu cài đặt"
                      className="pointer-events-auto absolute left-0 mt-12 w-44 bg-[rgba(7,9,14,0.9)] ring-1 ring-amber-300/20 border border-white/6 rounded-xl shadow-lg p-2 text-sm z-40"
                      style={{ backdropFilter: "blur(6px)" }}
                    >
                      <button
                        role="menuitem"
                        onClick={() => {
                          if (isPlaying) setGameState(GameState.PAUSED);
                          else if (isPaused) setGameState(GameState.PLAYING);
                          setSettingsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-white/6"
                      >
                        {isPlaying ? "Tạm dừng" : "Tiếp tục"}
                      </button>

                      <button
                        role="menuitem"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("save-game", {
                              detail: { createdBy: "settings" },
                            }),
                          );
                          setSettingsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-white/6"
                      >
                        Lưu
                      </button>

                      <button
                        role="menuitem"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("save-game", {
                              detail: { createdBy: "settings" },
                            }),
                          );
                          setSettingsOpen(false);
                          setGameState(GameState.START);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-white/6 font-semibold"
                      >
                        Lưu & Thoát
                      </button>

                      <div className="h-px my-1 bg-white/6" />

                      <button
                        role="menuitem"
                        onClick={() => {
                          setSettingsOpen(false);
                          setGameState(GameState.START);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-white/6 text-amber-200"
                      >
                        Thoát (không lưu)
                      </button>

                      <div className="mt-2 text-xs text-gray-400 px-3">
                        <div className="font-mono">Phím tắt:</div>
                        <div className="mt-1">P — Tạm dừng / tiếp tục</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="font-mono text-xs font-semibold tracking-wide text-gray-400">
                  S.E.R.A v9.0
                </div>
                <div className="text-[10px] font-mono text-gray-400">AI</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="animate-pulse text-xs text-gray-400 mr-2">
                  ● LIVE
                </div>

                {/* Pause / Resume button (keyboard: P) */}
                <button
                  onClick={() => {
                    if (isPlaying) setGameState(GameState.PAUSED);
                    else if (isPaused) setGameState(GameState.PLAYING);
                  }}
                  aria-pressed={isPaused}
                  aria-label={isPaused ? "Resume (P)" : "Pause (P)"}
                  className={`pointer-events-auto px-2 py-1 rounded-md text-[12px] font-mono border ${isPaused ? "bg-white/10 border-white/20 text-white" : "bg-[rgba(255,255,255,0.03)] border-white/6 text-gray-200"} hover:scale-105 transition`}
                  title={isPaused ? "Resume (P)" : "Pause (P)"}
                >
                  {isPaused ? "▶" : "⏸"}
                </button>
              </div>
            </div>
          </div>
          <div
            className={`font-mono text-sm h-14 overflow-y-auto leading-tight text-gray-400 custom-scrollbar pr-1 motion-reduce:overflow-auto`}
          >
            <p className="text-sm">{aiMessage}</p>
          </div>
        </div>
      </div>

      {/* Mask overlay (extracted) */}
      <MaskOverlay mask={mask} />

      <div className="absolute top-4 left-4 flex flex-col gap-3 z-30 pointer-events-none w-72">
        <div className="neumorph-card px-3 py-3 w-full">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div className="text-[10px] font-mono text-gray-400">VITALS</div>
            <div className="text-sm font-mono font-semibold" aria-hidden>
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
            ariaLabel="Health"
          />
        </div>

        <div className="neumorph-card px-3 py-3 w-full">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div className="text-[10px] font-mono text-gray-400">
              IDENTITY INTEGRITY
            </div>
            <div className="text-sm font-mono font-semibold text-cyan-300">
              {Math.round(integrity)}%
            </div>
          </div>
          <LiquidBar
            value={integrity}
            color="#78A9FF"
            ariaLabel="Identity integrity"
          />
        </div>

        <div
          className="neumorph-card px-3 py-2 flex items-center justify-between gap-3"
          aria-hidden
        >
          <div className="flex items-center gap-3">
            {/* <div className='w-9 h-9 rounded-full bg-gradient-to-br justify-center'>
              <span className='text-sm'>✨</span>
            </div> */}
            <div className="text-sm font-mono text-yellow-500">
              DATA FRAGMENTS
            </div>
          </div>
          <div className="text-sm font-bold text-gray-400">
            {memories} / {TOTAL_MEMORIES}
          </div>
        </div>

        <div
          className="neumorph-card px-3 py-2 w-full flex items-center justify-between gap-3"
          aria-hidden
        >
          <div className="text-[10px] font-mono text-gray-400">LEVEL TIME</div>
          <div className="text-sm font-mono font-semibold text-amber-300">
            {currentLevelTime ? formatTime(currentLevelTime) : "00:00.00"}
          </div>
        </div>

        {endlessActive && (
          <div className="neumorph-card px-3 py-2 w-full flex items-center justify-between gap-3">
            <div className="text-[10px] font-mono text-gray-400">
              ENDLESS RUN
            </div>
            <div className="text-sm font-mono font-semibold text-amber-300">
              {endlessRunCount} màn
            </div>
          </div>
        )}

        {/* Graphics quality (high-detail) — toggle for visual polish */}
        {/* <div className='neumorph-card px-3 py-2 w-full flex items-center justify-between gap-3'>
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
        </div> */}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30 pointer-events-auto">
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
              role="button"
              aria-label={`${m.label} (key ${m.key})`}
            >
              <span className="text-xl filter drop-shadow-md">{m.icon}</span>
              <span className="absolute top-1 right-1 text-[8px] font-mono text-gray-500">
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
                <div className="text-[11px] text-gray-400 uppercase tracking-tighter mt-1">
                  {m.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default UIOverlay;
