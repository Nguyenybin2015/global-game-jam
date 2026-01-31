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

  // live level timer (ms)
  const [currentLevelTime, setCurrentLevelTime] = useState<number>(0);

  return (
    <div className='relative w-screen h-screen bg-neutral-900 flex justify-center items-center overflow-hidden'>
      <div className='relative shadow-2xl rounded-lg overflow-hidden border border-neutral-700 w-full h-full'>
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
