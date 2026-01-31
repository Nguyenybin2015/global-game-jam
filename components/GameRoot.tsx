import React, { useState } from "react";
import GameCanvas from "./GameCanvas";
import UIOverlay from "./UIOverlay";
import { GameState, MaskType } from "../types";

const GameRoot: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [currentHealth, setCurrentHealth] = useState(100);
  const [currentIntegrity, setCurrentIntegrity] = useState(100);
  const [currentMask, setCurrentMask] = useState<MaskType>(MaskType.NONE);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [deathReason, setDeathReason] = useState("");
  const [collectedMemories, setCollectedMemories] = useState(0);
  const [aiMessage, setAiMessage] = useState<string>(
    "S.E.R.A: System Initialized. Monitoring subject.",
  );

  // Fullscreen handling
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateFullscreenState = () => {
    try {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    } catch (err) {
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const onChange = () => updateFullscreenState();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement !== el) await el.requestFullscreen();
    } catch (err) {
      // ignore; may be blocked by browser without user gesture
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (err) {
      // ignore
    }
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === rootRef.current) await exitFullscreen();
    else await enterFullscreen();
  };

  // live level timer (ms)
  const [currentLevelTime, setCurrentLevelTime] = useState<number>(0);

  // Attempt to enter fullscreen when gameplay starts (usually triggered by a user gesture)
  React.useEffect(() => {
    if (gameState === GameState.PLAYING) {
      // best-effort enter fullscreen; will fail silently if browser blocks it
      enterFullscreen();
    }
    // only when gameState changes to PLAYING we try; no cleanup needed
  }, [gameState]);

  return (
    <div
      ref={rootRef}
      className="relative w-screen h-screen bg-neutral-900 flex justify-center items-center overflow-hidden"
    >
      <div
        onDoubleClick={toggleFullscreen}
        className="relative shadow-2xl rounded-lg overflow-hidden border border-neutral-700 w-full h-full"
      >
        {/* Fullscreen toggle (top-right) */}
        <div className="absolute top-3 right-3 z-50 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="px-3 py-2 bg-black/60 text-white rounded-md text-sm backdrop-blur-sm hover:brightness-110 transition"
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {isFullscreen ? "⤫" : "⤢"}
          </button>
        </div>
        <GameCanvas
          gameState={gameState}
          setGameState={setGameState}
          setCurrentHealth={setCurrentHealth}
          setCurrentIntegrity={setCurrentIntegrity}
          setCurrentMask={setCurrentMask}
          setCurrentLevel={setCurrentLevel}
          setDeathReason={setDeathReason}
          setCollectedMemories={setCollectedMemories}
          setAiMessage={setAiMessage}
          setCurrentLevelTime={setCurrentLevelTime}
        />

        <UIOverlay
          gameState={gameState}
          setGameState={setGameState}
          health={currentHealth}
          integrity={currentIntegrity}
          mask={currentMask}
          levelIndex={currentLevel}
          deathReason={deathReason}
          memories={collectedMemories}
          aiMessage={aiMessage}
          currentLevelTime={currentLevelTime}
        />
      </div>
    </div>
  );
};

export default GameRoot;
