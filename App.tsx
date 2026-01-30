import React, { useState, useEffect, useRef } from "react";
import GameCanvas from "./components/GameCanvas";
import UIOverlay from "./components/UIOverlay";
import { GameState, MaskType } from "./types";

const App: React.FC = () => {
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
        />
      </div>
    </div>
  );
};

export default App;
