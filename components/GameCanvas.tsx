import React, { useRef, useEffect, memo } from 'react';
import { GameState, MaskType, LevelConfig, Entity, Particle, BackgroundElement, CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_HEIGHT, TOTAL_MEMORIES } from '../types';

// Default Physics Constants
const BASE_GRAVITY = 0.6;
const BASE_SPEED = 5;
const BASE_JUMP = -12;

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setCurrentHealth: (health: number) => void;
  setCurrentIntegrity: (int: number) => void;
  setCurrentMask: (mask: MaskType) => void;
  setCurrentLevel: (level: number) => void;
  setDeathReason: (reason: string) => void;
  setCollectedMemories: (count: number) => void;
  setAiMessage: (msg: string) => void;
}

const LEVELS: LevelConfig[] = [
  {
    id: 0,
    name: "Tuổi Thơ",
    bgGradient: ["#87CEEB", "#E0F7FA"],
    groundColor: "#8B4513",
    reqMask: MaskType.CHILD,
    message: "Giai đoạn 1. S.E.R.A: 'Đối tượng cần duy trì trạng thái Vui Vẻ để tối ưu hóa sự phát triển.'",
    obstacleType: "toy_block",
    length: 2000
  },
  {
    id: 1,
    name: "Trường Học",
    bgGradient: ["#555555", "#9E9E9E"],
    groundColor: "#424242",
    reqMask: MaskType.STUDENT,
    message: "Giai đoạn 2. S.E.R.A: 'Sự trầm tĩnh (Buồn) được yêu cầu để tập trung dữ liệu.'",
    obstacleType: "book_stack",
    length: 2500
  },
  {
    id: 2,
    name: "Sự Nghiệp",
    bgGradient: ["#1a252f", "#34495e"],
    groundColor: "#7f8c8d",
    reqMask: MaskType.WORKER,
    message: "Giai đoạn 3. S.E.R.A: 'Kích hoạt trạng thái Cạnh Tranh (Giận dữ) để loại bỏ chướng ngại vật.'",
    obstacleType: "briefcase",
    length: 3000
  },
  {
    id: 3,
    name: "Xã Hội",
    bgGradient: ["#2c003e", "#8e44ad"],
    groundColor: "#000000",
    reqMask: MaskType.SOCIAL,
    message: "Giai đoạn 4. S.E.R.A: 'Yêu cầu sự Tuân Thủ tuyệt đối (Mặt nạ Xã hội).'",
    obstacleType: "mask_spike",
    length: 3000
  },
  {
    id: 4,
    name: "Về Nhà",
    bgGradient: ["#F2994A", "#F2C94C"],
    groundColor: "#27ae60",
    reqMask: MaskType.NONE,
    message: "Hệ thống lỗi... Không thể phân tích dữ liệu 'Chân Thật'...",
    obstacleType: "none",
    length: 1500
  }
];

// --- HELPER FUNCTIONS ---

const resolveCollision = (p: any, obs: Entity) => {
    // Minkowski Sum / Simple AABB resolution return collision side
    const dx = (p.x + p.width/2) - (obs.x + obs.width/2);
    const dy = (p.y + p.height/2) - (obs.y + obs.height/2);
    const w = (p.width + obs.width) / 2;
    const h = (p.height + obs.height) / 2;

    if (Math.abs(dx) <= w && Math.abs(dy) <= h) {
        const wy = w * dy;
        const hx = h * dx;
        if (wy > hx) {
            if (wy > -hx) return 'top';
            else return 'right'; // Hit right side of player (left side of block)
        } else {
            if (wy > -hx) return 'left'; // Hit left side of player
            else return 'bottom';
        }
    }
    return null;
};

const drawFace = (ctx: CanvasRenderingContext2D, p: any, levelIdx: number) => {
    const mask = p.mask;
    const isHurt = p.hurtTimer > 0;
    const vy = p.vy;

    ctx.fillStyle = "#000";
    
    // Look Direction
    const lookX = p.facingRight ? 3 : -3;
    const lookY = vy < -2 ? -3 : (vy > 2 ? 3 : 0);
    const eyeSep = 8;
    const eyeY = -42;

    // Draw Eyes
    if (mask === MaskType.CHILD) {
        // Joy
        ctx.beginPath(); ctx.arc(-eyeSep + lookX, eyeY + lookY, 4, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(eyeSep + lookX, eyeY + lookY, 4, Math.PI, 0); ctx.stroke();
    } else if (mask === MaskType.STUDENT) {
        // Sad
        ctx.beginPath(); ctx.moveTo(-eyeSep-4, eyeY); ctx.lineTo(-eyeSep+4, eyeY+3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeSep-4, eyeY+3); ctx.lineTo(eyeSep+4, eyeY); ctx.stroke();
    } else if (mask === MaskType.WORKER) {
        // Anger
        ctx.beginPath(); ctx.moveTo(-eyeSep-4, eyeY-2); ctx.lineTo(-eyeSep+4, eyeY+2); ctx.lineWidth=3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeSep-4, eyeY+2); ctx.lineTo(eyeSep+4, eyeY-2); ctx.stroke(); ctx.lineWidth=1;
    } else if (mask === MaskType.SOCIAL) {
        // Robot
        ctx.beginPath(); ctx.arc(-eyeSep, eyeY, 5, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(eyeSep, eyeY, 5, 0, Math.PI*2); ctx.stroke();
        ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-eyeSep, eyeY, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeSep, eyeY, 2, 0, Math.PI*2); ctx.fill();
    } else {
        // Normal
        if (isHurt) {
            ctx.beginPath(); ctx.moveTo(-eyeSep-3, eyeY-3); ctx.lineTo(-eyeSep+3, eyeY+3); ctx.moveTo(-eyeSep+3, eyeY-3); ctx.lineTo(-eyeSep-3, eyeY+3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(eyeSep-3, eyeY-3); ctx.lineTo(eyeSep+3, eyeY+3); ctx.moveTo(eyeSep+3, eyeY-3); ctx.lineTo(eyeSep-3, eyeY+3); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(-eyeSep + lookX, eyeY + lookY, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeSep + lookX, eyeY + lookY, 3, 0, Math.PI*2); ctx.fill();
        }
    }

    // Draw Mouth
    ctx.beginPath();
    const mouthY = -30;
    if (mask === MaskType.CHILD) {
        ctx.arc(0 + lookX, mouthY, 6, 0, Math.PI);
    } else if (mask === MaskType.STUDENT) {
        ctx.arc(0 + lookX, mouthY + 5, 6, Math.PI, 0);
    } else if (mask === MaskType.WORKER) {
        ctx.rect(-5 + lookX, mouthY, 10, 4);
    } else if (mask === MaskType.SOCIAL) {
        ctx.moveTo(-5 + lookX, mouthY); ctx.lineTo(5 + lookX, mouthY);
    } else {
        if (isHurt) ctx.arc(0, mouthY+2, 4, 0, Math.PI*2);
        else if (levelIdx === 4 && mask === MaskType.NONE) ctx.arc(0, mouthY, 5, 0, Math.PI);
        else { ctx.moveTo(-3 + lookX, mouthY); ctx.lineTo(3 + lookX, mouthY); }
    }
    ctx.stroke();
};

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  setCurrentHealth, 
  setCurrentIntegrity,
  setCurrentMask, 
  setCurrentLevel,
  setDeathReason,
  setCollectedMemories,
  setAiMessage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Mutable Game State
  const player = useRef({
    x: 50,
    y: 300,
    vx: 0,
    vy: 0,
    width: 40,
    height: 60,
    grounded: false,
    health: 100,
    integrity: 100,
    mask: MaskType.NONE,
    invulnerable: 0,
    facingRight: true,
    memoriesCollected: 0,
    lastJumpTime: 0,
    idleTime: 0,
    airTime: 0,
    scaleX: 1,
    scaleY: 1,
    blinkTimer: 0,
    hurtTimer: 0
  });

  const aiState = useRef({ lastMessageTime: 0, lastAction: 'none' });
  const lastReported = useRef({ health: 100, integrity: 100 });
  const levelState = useRef({ index: 0, cameraX: 0, obstacles: [] as Entity[], particles: [] as Particle[], bgElements: [] as BackgroundElement[], shake: 0 });
  const keys = useRef({ right: false, left: false, up: false });

  const triggerAI = (type: 'jump' | 'idle' | 'wrong_mask' | 'damage' | 'destroy' | 'bounce' | 'memory_collect' | 'long_fall', force = false) => {
    const now = Date.now();
    if (!force && now - aiState.current.lastMessageTime < 2500) return;

    const messages = {
        jump: ["S.E.R.A: Dao động trục Y không cần thiết.", "S.E.R.A: Tiêu hao năng lượng.", "S.E.R.A: Trọng lực là quy luật."],
        idle: ["S.E.R.A: Năng suất 0%.", "S.E.R.A: Di chuyển ngay.", "S.E.R.A: Phát hiện lười biếng."],
        wrong_mask: ["S.E.R.A: CẢNH BÁO: Cảm xúc sai lệch.", "S.E.R.A: Đeo mặt nạ đúng.", "S.E.R.A: Xã hội từ chối bạn."],
        damage: ["S.E.R.A: Tổn thất phần cứng.", "S.E.R.A: Đau đớn là tín hiệu tuân thủ.", "S.E.R.A: Sinh mạng giảm."],
        destroy: ["S.E.R.A: Bạo lực chấp nhận được.", "S.E.R.A: Chướng ngại đã xóa.", "S.E.R.A: Giận dữ hiệu quả."],
        bounce: ["S.E.R.A: Mất kiểm soát hành vi.", "S.E.R.A: Quỹ đạo hỗn loạn."],
        memory_collect: ["S.E.R.A: Dữ liệu rác (Ký ức) được phát hiện.", "S.E.R.A: Xóa bỏ quá khứ.", "S.E.R.A: Bộ nhớ đầy."],
        long_fall: ["S.E.R.A: Chuẩn bị va chạm.", "S.E.R.A: Mất điểm tựa."]
    };

    const msgs = messages[type];
    if (msgs && msgs.length > 0) {
        setAiMessage(msgs[Math.floor(Math.random() * msgs.length)]);
        aiState.current.lastMessageTime = now;
    }
  };

  const generateLevel = (levelIdx: number) => {
    const config = LEVELS[levelIdx];
    const obstacles: Entity[] = [];
    
    player.current.x = 50;
    player.current.y = CANVAS_HEIGHT - GROUND_HEIGHT - 100;
    player.current.vx = 0;
    player.current.vy = 0;
    levelState.current.cameraX = 0;
    levelState.current.particles = [];
    levelState.current.shake = 0;
    
    setAiMessage(config.message); 
    aiState.current.lastMessageTime = Date.now() + 2000; 

    if (config.obstacleType !== "none") {
      const numObstacles = Math.floor(config.length / 400);
      for (let i = 1; i <= numObstacles; i++) {
        const xPos = i * 400 + Math.random() * 100;
        if (i % 2 === 0) {
            let wallText = "WALL";
            if (levelIdx === 0) wallText = "NGOAN";
            if (levelIdx === 1) wallText = "ĐIỂM SỐ";
            if (levelIdx === 2) wallText = "TIỀN";
            if (levelIdx === 3) wallText = "DƯ LUẬN";
            obstacles.push({ x: xPos, y: CANVAS_HEIGHT - GROUND_HEIGHT - 200, width: 60, height: 200, type: 'wall', text: wallText, reqMask: config.reqMask });
        } else {
            const isSpike = Math.random() > 0.6;
            obstacles.push({
                 x: xPos,
                 y: CANVAS_HEIGHT - GROUND_HEIGHT - (isSpike ? 20 : (Math.random() * 40 + 40)),
                 width: 40,
                 height: isSpike ? 20 : 40,
                 type: isSpike ? 'spike' : 'block'
            });
        }
      }
    }

    const memX = Math.random() * (config.length - 400) + 200;
    obstacles.push({ x: memX, y: CANVAS_HEIGHT - GROUND_HEIGHT - 150 - Math.random() * 50, width: 30, height: 30, type: 'memory', collected: false });
    obstacles.push({ x: config.length, y: CANVAS_HEIGHT - GROUND_HEIGHT - 200, width: 50, height: 200, type: 'goal' });

    const bgElements: BackgroundElement[] = [];
    for(let i=0; i<30; i++) {
       let shape: 'circle' | 'rect' = 'circle';
       let color = 'rgba(255,255,255,0.1)';
       let size = Math.random() * 30 + 10;
       let y = Math.random() * CANVAS_HEIGHT * 0.8;
       let speed = Math.random() * 0.4 + 0.05;
       if(levelIdx === 0) { color = `rgba(255,255,255,0.3)`; size = Math.random()*60+20; }
       if(levelIdx === 1) { shape='rect'; color=`rgba(200,200,200,0.1)`; }
       if(levelIdx === 2) { shape='rect'; color=`rgba(0,0,0,0.2)`; y = Math.random() * CANVAS_HEIGHT; }
       if(levelIdx === 4) { color=`rgba(255,215,0,0.5)`; size=Math.random()*4+1; speed*=0.2; }
       bgElements.push({ x: Math.random()*CANVAS_WIDTH, y, size, speed, color, shape });
    }

    levelState.current.obstacles = obstacles;
    levelState.current.bgElements = bgElements;
    levelState.current.index = levelIdx;
    setCurrentLevel(levelIdx);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      switch(e.code) {
        case 'ArrowRight': case 'KeyD': keys.current.right = true; break;
        case 'ArrowLeft': case 'KeyA': keys.current.left = true; break;
        case 'Space': case 'ArrowUp': case 'KeyW': keys.current.up = true; break;
        case 'Digit1': switchMask(MaskType.CHILD); break;
        case 'Digit2': switchMask(MaskType.STUDENT); break;
        case 'Digit3': switchMask(MaskType.WORKER); break;
        case 'Digit4': switchMask(MaskType.SOCIAL); break;
        case 'Digit0': switchMask(MaskType.NONE); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch(e.code) {
        case 'ArrowRight': case 'KeyD': keys.current.right = false; break;
        case 'ArrowLeft': case 'KeyA': keys.current.left = false; break;
        case 'Space': case 'ArrowUp': case 'KeyW': keys.current.up = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  const switchMask = (mask: MaskType) => {
    player.current.mask = mask;
    setCurrentMask(mask);
    const cx = player.current.x + player.current.width/2;
    const cy = player.current.y + player.current.height/2;
    let color = '#fff';
    if (mask === MaskType.CHILD) color = '#f1c40f';
    if (mask === MaskType.STUDENT) color = '#3498db';
    if (mask === MaskType.WORKER) color = '#e74c3c';
    
    player.current.scaleX = 1.3;
    player.current.scaleY = 0.7;

    for(let i=0; i<8; i++) {
      levelState.current.particles.push({
        x: cx, y: cy, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8,
        life: 20, size: Math.random()*5+2, color: color
      });
    }
  };

  useEffect(() => {
    if (gameState === GameState.START) {
      player.current.health = 100;
      player.current.integrity = 100;
      player.current.memoriesCollected = 0;
      lastReported.current = { health: 100, integrity: 100 };
      setCurrentHealth(100);
      setCurrentIntegrity(100);
      setCollectedMemories(0);
      switchMask(MaskType.NONE);
      generateLevel(0);
    }
  }, [gameState]);

  const update = () => {
    const p = player.current;
    const l = levelState.current;
    
    p.scaleX += (1 - p.scaleX) * 0.1;
    p.scaleY += (1 - p.scaleY) * 0.1;

    let gravity = BASE_GRAVITY;
    let speed = BASE_SPEED;
    let jumpForce = BASE_JUMP;
    let friction = 0.8;

    if (p.mask === MaskType.CHILD) { speed = 7; friction = 0.95; }
    else if (p.mask === MaskType.STUDENT) { gravity = 0.2; speed = 3; jumpForce = -8; }
    else if (p.mask === MaskType.WORKER) { gravity = 1.2; speed = 8; jumpForce = -15; }

    if (keys.current.right) { p.vx += (speed - p.vx) * 0.2; p.facingRight = true; p.idleTime = 0; }
    else if (keys.current.left) { p.vx += (-speed - p.vx) * 0.2; p.facingRight = false; p.idleTime = 0; }
    else { p.vx *= friction; p.idleTime++; if (p.idleTime > 240) triggerAI('idle'); }

    if (keys.current.up && p.grounded) {
        p.vy = jumpForce; p.grounded = false; p.scaleX = 0.7; p.scaleY = 1.3;
        p.lastJumpTime = Date.now();
        if (Math.random() > 0.8) triggerAI('jump');
    }

    p.vy += gravity; p.x += p.vx; p.y += p.vy;

    if (!p.grounded) {
        p.airTime++;
        if (p.airTime > 120 && p.vy > 5) triggerAI('long_fall');
    } else {
        p.airTime = 0;
    }

    // Ground Check
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    if (p.y + p.height > groundY) {
      if (!p.grounded) { p.scaleX = 1.3; p.scaleY = 0.7; }
      p.y = groundY - p.height;
      if (p.mask === MaskType.CHILD && Math.abs(p.vy) > 2) {
         p.vy = -Math.abs(p.vy) * 0.7; triggerAI('bounce'); p.grounded = false; p.scaleX = 1.2; p.scaleY = 0.8;
      } else {
         p.vy = 0; p.grounded = true;
      }
    } else {
      p.grounded = false;
    }

    // Obstacle Interaction
    const camX = l.cameraX;
    for (let i = l.obstacles.length - 1; i >= 0; i--) {
      const obs = l.obstacles[i];
      if (obs.collected) continue;
      if (Math.abs(obs.x - p.x) > 200) continue;

      // Simple broadphase
      if (p.x < obs.x + obs.width && p.x + p.width > obs.x && p.y < obs.y + obs.height && p.y + p.height > obs.y) {
         
        // 1. Anger Destruction
        if (p.mask === MaskType.WORKER && (obs.type === 'spike' || obs.type === 'block')) {
             l.obstacles.splice(i, 1);
             triggerAI('destroy');
             l.shake = 5;
             p.hurtTimer = 5;
             for(let k=0; k<10; k++) {
                l.particles.push({
                    x: obs.x + obs.width/2, y: obs.y + obs.height/2,
                    vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                    life: 20, size: Math.random()*5+2, color: '#e74c3c'
                });
             }
             continue;
        }

        // 2. Interaction
        if (obs.type === 'goal') {
           if (l.index < LEVELS.length - 1) generateLevel(l.index + 1);
           else setGameState(GameState.VICTORY);
           return;
        } 
        else if (obs.type === 'spike') {
           takeHealthDamage(5); p.vy = -5; triggerAI('damage');
        } 
        else if (obs.type === 'memory') {
            obs.collected = true; p.memoriesCollected++;
            setCollectedMemories(p.memoriesCollected); triggerAI('memory_collect', true);
        }
        else if (obs.type === 'wall' || obs.type === 'block') {
            const isWall = obs.type === 'wall';
            if (isWall && p.mask === obs.reqMask) continue; // Pass through

            const col = resolveCollision(p, obs);
            if (col) {
                if (col === 'top') { p.y = obs.y + obs.height; p.vy = 0; }
                else if (col === 'bottom') { p.y = obs.y - p.height; p.vy = 0; p.grounded = true; }
                else if (col === 'left') { p.x = obs.x + obs.width; p.vx = 0; }
                else if (col === 'right') { 
                    p.x = obs.x - p.width; p.vx = 0; 
                    if (isWall) { takeHealthDamage(1); triggerAI('wrong_mask'); }
                }
            }
        }
      }
    }

    // Camera
    const config = LEVELS[l.index];
    let targetCamX = p.x - CANVAS_WIDTH / 3;
    if (targetCamX < 0) targetCamX = 0;
    if (targetCamX > config.length - CANVAS_WIDTH + 100) targetCamX = config.length - CANVAS_WIDTH + 100;
    l.cameraX += (targetCamX - l.cameraX) * 0.1;

    // Stat Degradation
    if (p.invulnerable > 0) p.invulnerable--;
    if (p.hurtTimer > 0) p.hurtTimer--;

    if (l.index < 4) {
        if (p.mask !== MaskType.NONE) p.integrity -= 0.05; 
        else if (p.integrity < 100) p.integrity += 0.1;
    } else {
        if (p.mask !== MaskType.NONE) p.integrity -= 0.2;
        else if (p.integrity < 100) p.integrity += 0.3;
    }

    if (Math.abs(p.integrity - lastReported.current.integrity) > 1) {
        const val = Math.max(0, Math.floor(p.integrity));
        lastReported.current.integrity = val;
        setCurrentIntegrity(val);
    }
    if (p.health <= 0) { setDeathReason("S.E.R.A: Đối tượng đã ngưng hoạt động."); setGameState(GameState.GAME_OVER); }
    if (p.integrity <= 0) { setDeathReason("S.E.R.A: Đồng hóa hoàn tất."); setGameState(GameState.GAME_OVER); }

    // Particles
    for (let i = l.particles.length - 1; i >= 0; i--) {
      const part = l.particles[i]; part.x += part.vx; part.y += part.vy; part.life--;
      if (part.life <= 0) l.particles.splice(i, 1);
    }
    if (l.shake > 0) l.shake *= 0.9;
  };

  const takeHealthDamage = (amount: number) => {
    player.current.health -= amount;
    player.current.hurtTimer = 10;
    player.current.scaleX = 0.8; player.current.scaleY = 0.8;
    if (Math.abs(player.current.health - lastReported.current.health) > 1 || player.current.health <= 0) {
         const val = Math.max(0, Math.floor(player.current.health));
         lastReported.current.health = val;
         setCurrentHealth(val);
    }
    if (amount > 1) levelState.current.shake = 10;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const l = levelState.current;
    const p = player.current;
    const config = LEVELS[l.index];

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, config.bgGradient[0]);
    gradient.addColorStop(1, config.bgGradient[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const lowHealth = p.health < 40;
    let glitchOffsetX = 0;
    if (lowHealth && Math.random() > 0.8) {
        glitchOffsetX = (Math.random() - 0.5) * 20 * ((40 - p.health)/10);
    }

    ctx.save();
    const shakeX = (Math.random() - 0.5) * l.shake;
    const shakeY = (Math.random() - 0.5) * l.shake;
    
    // Background
    ctx.save();
    ctx.translate(shakeX + glitchOffsetX, shakeY);
    const totalW = CANVAS_WIDTH + 200;
    l.bgElements.forEach(bg => {
       let drawX = (bg.x - l.cameraX * bg.speed) % totalW;
       if (drawX < 0) drawX += totalW;
       drawX -= 100;
       ctx.fillStyle = bg.color;
       if (bg.shape === 'circle') { ctx.beginPath(); ctx.arc(drawX, bg.y, bg.size, 0, Math.PI*2); ctx.fill(); } 
       else { ctx.fillRect(drawX, bg.y, bg.size, bg.size); }
    });
    ctx.restore();

    // Game World
    ctx.translate(-l.cameraX + shakeX + glitchOffsetX, shakeY);
    ctx.fillStyle = config.groundColor;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, config.length + 800, GROUND_HEIGHT);

    if (l.index === 4) {
      const hx = config.length + 50;
      const hy = CANVAS_HEIGHT - GROUND_HEIGHT;
      ctx.fillStyle = "#ecf0f1"; ctx.fillRect(hx, hy - 120, 140, 120);
      ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.moveTo(hx - 20, hy - 120); ctx.lineTo(hx + 70, hy - 180); ctx.lineTo(hx + 160, hy - 120); ctx.fill();
    }

    const camX = l.cameraX;
    l.obstacles.forEach(obs => {
       if (obs.x + obs.width < camX - 100 || obs.x > camX + CANVAS_WIDTH + 100) return;

       if (obs.type === 'block') {
         ctx.fillStyle = "#2c3e50"; ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
         ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
       } 
       else if (obs.type === 'spike') {
         ctx.fillStyle = "#e74c3c";
         ctx.beginPath(); ctx.moveTo(obs.x, obs.y + obs.height); ctx.lineTo(obs.x + obs.width/2, obs.y); ctx.lineTo(obs.x + obs.width, obs.y + obs.height); ctx.fill();
       }
       else if (obs.type === 'memory' && !obs.collected) {
         ctx.fillStyle = "#f1c40f";
         const cx = obs.x + obs.width/2; const cy = obs.y + obs.height/2;
         const spikes = 5; const outerRadius = 15; const innerRadius = 7;
         let rot = Math.PI / 2 * 3; let x = cx; let y = cy; const step = Math.PI / spikes;
         ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
         for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step;
            x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step;
         }
         ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); ctx.fill();
         ctx.lineWidth = 1; ctx.strokeStyle = "#fff"; ctx.stroke();
       }
       else if (obs.type === 'wall') {
           const canPass = p.mask === obs.reqMask;
           ctx.fillStyle = canPass ? "rgba(255, 255, 255, 0.2)" : "rgba(44, 62, 80, 0.9)";
           if (!canPass) {
               ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
               ctx.strokeStyle = "#c0392b"; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
           } else {
               ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
               ctx.strokeStyle = "#2ecc71"; ctx.setLineDash([5, 5]); ctx.strokeRect(obs.x, obs.y, obs.width, obs.height); ctx.setLineDash([]);
           }
           
           ctx.save();
           ctx.translate(obs.x + obs.width/2, obs.y + obs.height/2);
           ctx.rotate(-Math.PI/2);
           ctx.fillStyle = canPass ? "#fff" : "#e74c3c";
           ctx.font = "bold 20px Roboto";
           ctx.textAlign = "center";
           ctx.fillText(obs.text || "WALL", 0, 0);
           ctx.restore();
       }
    });

    // Player
    const time = Date.now() * 0.015;
    const isMoving = Math.abs(p.vx) > 0.5;
    const bob = isMoving ? Math.abs(Math.sin(time * 2)) * 3 : Math.sin(time * 0.005) * 1;
    
    ctx.save();
    ctx.translate(p.x + p.width/2, p.y + p.height);
    ctx.scale(p.scaleX, p.scaleY);
    if (!p.facingRight) ctx.scale(-1, 1);
    
    let pantsColor = "#2c3e50";
    let shirtColor = "#ecf0f1";
    let skinColor = "#f1c40f"; 
    if (p.mask === MaskType.CHILD) { shirtColor = "#f1c40f"; pantsColor = "#d35400"; } 
    if (p.mask === MaskType.STUDENT) { shirtColor = "#3498db"; pantsColor = "#2c3e50"; }
    if (p.mask === MaskType.WORKER) { shirtColor = "#c0392b"; pantsColor = "#2c3e50"; }
    
    // Legs
    ctx.fillStyle = pantsColor;
    const legLX = isMoving ? Math.sin(time) * 12 : 0;
    const legRX = isMoving ? -Math.sin(time) * 12 : 0;
    ctx.beginPath(); ctx.roundRect(-8 + legLX, -16, 10, 16, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(0 + legRX, -16, 10, 16, 4); ctx.fill();
    
    // Body
    ctx.translate(0, -16 - bob);
    ctx.fillStyle = shirtColor; ctx.beginPath(); ctx.roundRect(-15, -35, 30, 35, 6); ctx.fill();
    
    // Head
    if (l.index === 4 && p.mask === MaskType.NONE) skinColor = "#f1c40f";
    else if (p.mask !== MaskType.NONE) skinColor = "#fff";

    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(0, -42, 24, 0, Math.PI * 2); ctx.fill();
    if (p.mask !== MaskType.NONE) { ctx.strokeStyle = "#bdc3c7"; ctx.lineWidth = 2; ctx.stroke(); }

    drawFace(ctx, p, l.index);

    ctx.restore();

    // Particles
    l.particles.forEach(part => {
        ctx.globalAlpha = part.life / 30; ctx.fillStyle = part.color;
        ctx.beginPath(); ctx.arc(part.x, part.y, part.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.restore();
  };

  const tick = () => {
    if (gameState === GameState.PLAYING) update();
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) draw(ctx); }
    requestRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block w-full h-full"/>;
};

export default memo(GameCanvas);