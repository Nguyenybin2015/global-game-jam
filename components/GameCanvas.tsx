import React, { useRef, useEffect, memo } from "react";
import {
  GameState,
  MaskType,
  LevelConfig,
  Entity,
  Particle,
  BackgroundElement,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  TOTAL_MEMORIES,
  LevelTimeEntry,
  TIMES_STORAGE_KEY,
  CampaignRunEntry,
  CAMPAIGN_TIMES_KEY,
  // endless-run types
  EndlessRunEntry,
  ENDLESS_RUNS_KEY,
} from "../types";

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
  setCurrentLevelTime: (ms: number) => void;
}

const LEVELS: LevelConfig[] = [
  {
    id: 0,
    name: "Tuổi Thơ",
    bgGradient: ["#87CEEB", "#E0F7FA"],
    groundColor: "#8B4513",
    reqMask: MaskType.CHILD,
    message:
      "Giai đoạn 1. S.E.R.A: 'Đối tượng cần duy trì trạng thái Vui Vẻ để tối ưu hóa sự phát triển.'",
    obstacleType: "toy_block",
    length: 2000,
  },
  {
    id: 1,
    name: "Trường Học",
    bgGradient: ["#555555", "#9E9E9E"],
    groundColor: "#424242",
    reqMask: MaskType.STUDENT,
    message:
      "Giai đoạn 2. S.E.R.A: 'Sự trầm tĩnh (Buồn) được yêu cầu để tập trung dữ liệu.'",
    obstacleType: "book_stack",
    length: 2500,
  },
  {
    id: 2,
    name: "Sự Nghiệp",
    bgGradient: ["#1a252f", "#34495e"],
    groundColor: "#7f8c8d",
    reqMask: MaskType.WORKER,
    message:
      "Giai đoạn 3. S.E.R.A: 'Kích hoạt trạng thái Cạnh Tranh (Giận dữ) để loại bỏ chướng ngại vật.'",
    obstacleType: "briefcase",
    length: 3000,
  },
  {
    id: 3,
    name: "Xã Hội",
    bgGradient: ["#2c003e", "#8e44ad"],
    groundColor: "#000000",
    reqMask: MaskType.SOCIAL,
    message:
      "Giai đoạn 4. S.E.R.A: 'Yêu cầu sự Tuân Thủ tuyệt đối (Mặt nạ Xã hội).'",
    obstacleType: "mask_spike",
    length: 3000,
  },
  {
    id: 4,
    name: "Về Nhà",
    bgGradient: ["#F2994A", "#F2C94C"],
    groundColor: "#27ae60",
    reqMask: MaskType.NONE,
    message: "Hệ thống lỗi... Không thể phân tích dữ liệu 'Chân Thật'...",
    obstacleType: "none",
    length: 1500,
  },
];

// Display titles for maps 1..10 (index 0..9)
const MAP_TITLES: string[] = [
  "Map 1 – Tuổi thơ",
  "Map 2 – Không ai chờ",
  "Map 3 – Trường học",
  "Map 4 – So sánh bạn bè",
  "Map 5 – Mơ ước",
  "Map 6 – Phỏng vấn",
  "Map 7 – Deadline & Công việc",
  "Map 8 – Kiệt sức",
  "Map 9 – Đối diện bản thân",
  "Map 10 – Trở về Nhà",
];

const PREGENERATED_LEVEL_COUNT = 10; // total campaign levels (includes handcrafted LEVELS)

// Dialogs per level keyed by mask — kept separate so each map can provide
// its own set of inner-thoughts. Only level 0 (map 1) is populated here.
const LEVEL_DIALOGS: Record<number, Partial<Record<MaskType, string>>> = {
  0: {
    [MaskType.CHILD]:
      "Mọi thứ trông thật to...\nvà cũng thật thú vị.\nMình muốn chạy, muốn nhảy,\nmình muốn chạm vào tất cả.",
    [MaskType.STUDENT]:
      "Sao mình lại chậm thế này?\nỞ đây... có gì đâu mà vui?",
    [MaskType.WORKER]:
      "Mấy thứ này thật vướng víu.\nMình chỉ muốn phá cho xong.",
    [MaskType.SOCIAL]:
      "Mình nên đi thẳng, không lệch.\nNhưng... có ai đang nhìn mình không?",
    [MaskType.NONE]: "Mình chỉ đang chơi thôi.\nKhông cần nghĩ nhiều.",
  },
};

// --- HELPER FUNCTIONS ---

const resolveCollision = (p: any, obs: Entity) => {
  // Minkowski Sum / Simple AABB resolution return collision side
  const dx = p.x + p.width / 2 - (obs.x + obs.width / 2);
  const dy = p.y + p.height / 2 - (obs.y + obs.height / 2);
  const w = (p.width + obs.width) / 2;
  const h = (p.height + obs.height) / 2;

  if (Math.abs(dx) <= w && Math.abs(dy) <= h) {
    const wy = w * dy;
    const hx = h * dx;
    if (wy > hx) {
      if (wy > -hx) return "top";
      else return "right"; // Hit right side of player (left side of block)
    } else {
      if (wy > -hx)
        return "left"; // Hit left side of player
      else return "bottom";
    }
  }
  return null;
};

const drawFace = (
  ctx: CanvasRenderingContext2D,
  p: any,
  levelIdx: number,
  highDetail = false,
) => {
  const mask = p.mask;
  const isHurt = p.hurtTimer > 0;
  const vy = p.vy;
  const hd = !!highDetail;

  ctx.save();
  ctx.fillStyle = "#000";

  // Look direction + subtle eye offset when moving/jumping
  const lookX = p.facingRight ? 3 : -3;
  const lookY = vy < -2 ? -3 : vy > 2 ? 3 : 0;
  const eyeSep = 8;
  const eyeY = -42;

  // Blink (short-circuit to closed-eye drawing)
  const isBlinking = p.blinkTimer > 0;
  // normalized 0..1 blink progress used by eyelid easing
  const blinkProgress = Math.max(0, Math.min(1, (p.blinkTimer || 0) / 12));

  // Eye drawing helper (with pupil + highlight); higher-fidelity when hd
  const drawRoundEye = (cx: number, cy: number, r: number) => {
    // sclera / rim
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = mask === MaskType.NONE ? "#000" : "#fff";
    ctx.fill();

    if (hd) {
      // iris (subtle radial) + pupil with thin rim for extra crispness
      const ir = Math.max(1.2, r * 0.6);
      const grd = ctx.createRadialGradient(
        cx - ir * 0.25,
        cy - ir * 0.25,
        ir * 0.1,
        cx,
        cy,
        ir,
      );
      grd.addColorStop(0, mask === MaskType.NONE ? "#FFFFFF" : "#222");
      grd.addColorStop(0.5, mask === MaskType.NONE ? "#eeeeee" : "#111");
      grd.addColorStop(1, mask === MaskType.NONE ? "rgba(0,0,0,0.05)" : "#000");
      ctx.beginPath();
      ctx.arc(cx, cy, ir, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.globalCompositeOperation = "lighter";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // crisp pupil with faint rim
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.2, r * 0.42), 0, Math.PI * 2);
      ctx.fillStyle = mask === MaskType.NONE ? "#fff" : "#000";
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.stroke();

      // layered highlights
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 3, Math.max(0.8, r * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        cx + r * 0.18,
        cy + r * 0.06,
        Math.max(0.6, r * 0.08),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();

      // tiny eyelid shadow
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy - r * 0.28,
        r * 0.9,
        r * 0.35,
        0,
        Math.PI,
        2 * Math.PI,
      );
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fill();
    } else {
      // pupil (invert color for masked personas to feel 'mask-like')
      ctx.beginPath();
      const pupilR = Math.max(1.2, r * 0.45);
      ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
      ctx.fillStyle = mask === MaskType.NONE ? "#fff" : "#000";
      ctx.fill();

      // thin rim stroke for crispness + subtle colored rim to match mask
      ctx.lineWidth = 0.8;
      ctx.strokeStyle =
        mask === MaskType.NONE
          ? "rgba(0,0,0,0.14)"
          : mask === MaskType.CHILD
            ? "rgba(241,196,15,0.25)"
            : mask === MaskType.STUDENT
              ? "rgba(52,152,219,0.18)"
              : mask === MaskType.WORKER
                ? "rgba(231,76,60,0.18)"
                : "rgba(149,165,166,0.14)";
      ctx.stroke();

      // subtle inner vignette to give depth
      ctx.beginPath();
      const innerGrd = ctx.createRadialGradient(
        cx,
        cy - 1,
        pupilR * 0.15,
        cx,
        cy,
        pupilR * 1.1,
      );
      innerGrd.addColorStop(0, "rgba(0,0,0,0)");
      innerGrd.addColorStop(1, "rgba(0,0,0,0.06)");
      ctx.fillStyle = innerGrd;
      ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // layered reflections for more depth
      ctx.beginPath();
      ctx.arc(cx - 2.2, cy - 2.2, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + pupilR * 0.12, cy + pupilR * 0.04, 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fill();
    }
  };

  // Draw Eyes (respect blink) + expressive brows + gloss
  // eyebrow helper
  const drawBrow = (cx: number, cy: number, w: number, tilt = 0, thick = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = thick;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, -2, w / 2, 0);
    ctx.stroke();
    ctx.restore();
  };

  if (isBlinking) {
    // partial eyelid driven by blinkProgress (smooth closed -> open)
    const t = Math.pow(blinkProgress, 0.8); // ease
    const lidOffset = 6 * (0.2 + 0.8 * t);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(-eyeSep - 8, eyeY - lidOffset * 0.2);
    ctx.quadraticCurveTo(
      -eyeSep,
      eyeY + lidOffset,
      -eyeSep + 8,
      eyeY - lidOffset * 0.2,
    );
    ctx.lineTo(-eyeSep + 8, eyeY + 6);
    ctx.lineTo(-eyeSep - 8, eyeY + 6);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(eyeSep - 8, eyeY - lidOffset * 0.2);
    ctx.quadraticCurveTo(
      eyeSep,
      eyeY + lidOffset,
      eyeSep + 8,
      eyeY - lidOffset * 0.2,
    );
    ctx.lineTo(eyeSep + 8, eyeY + 6);
    ctx.lineTo(eyeSep - 8, eyeY + 6);
    ctx.closePath();
    ctx.fill();

    // slight crease when nearly closed
    if (t > 0.6) {
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-eyeSep - 6, eyeY + 4);
      ctx.lineTo(-eyeSep + 6, eyeY + 4);
      ctx.moveTo(eyeSep - 6, eyeY + 4);
      ctx.lineTo(eyeSep + 6, eyeY + 4);
      ctx.stroke();
    }
  } else {
    // eyebrows + eyes per persona (adds sharper expression)
    if (mask === MaskType.CHILD) {
      drawBrow(-eyeSep, eyeY - 12, 12, -0.12, 1.6);
      drawBrow(eyeSep, eyeY - 12, 12, 0.12, 1.6);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-eyeSep + lookX, eyeY + lookY, 4, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeSep + lookX, eyeY + lookY, 4, Math.PI, 0);
      ctx.stroke();
    } else if (mask === MaskType.STUDENT) {
      drawBrow(-eyeSep, eyeY - 12, 14, 0.08, 1.2);
      drawBrow(eyeSep, eyeY - 12, 14, -0.08, 1.2);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-eyeSep - 4, eyeY + 1);
      ctx.lineTo(-eyeSep + 4, eyeY + 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(eyeSep - 4, eyeY + 3);
      ctx.lineTo(eyeSep + 4, eyeY + 1);
      ctx.stroke();
    } else if (mask === MaskType.WORKER) {
      drawBrow(-eyeSep, eyeY - 14, 14, -0.25, 2.2);
      drawBrow(eyeSep, eyeY - 14, 14, 0.25, 2.2);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-eyeSep - 4, eyeY - 2);
      ctx.lineTo(-eyeSep + 4, eyeY + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(eyeSep - 4, eyeY + 2);
      ctx.lineTo(eyeSep + 4, eyeY - 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (mask === MaskType.SOCIAL) {
      drawBrow(-eyeSep, eyeY - 12, 16, 0, 1);
      drawBrow(eyeSep, eyeY - 12, 16, 0, 1);
      drawRoundEye(-eyeSep, eyeY, 5);
      drawRoundEye(eyeSep, eyeY, 5);
    } else {
      // true self — more detailed pupils + tiny highlights
      drawBrow(-eyeSep, eyeY - 12, 12, 0.02, 0.9);
      drawBrow(eyeSep, eyeY - 12, 12, -0.02, 0.9);
      const pupilScale = 1 + Math.max(0, Math.min(0.25, -vy * 0.03));
      // left / right pupils
      ctx.save();
      drawRoundEye(-eyeSep + lookX, eyeY + lookY, 3 * pupilScale);
      drawRoundEye(eyeSep + lookX, eyeY + lookY, 3 * pupilScale);
      ctx.restore();

      if (isHurt) {
        // cross eyes when hurt
        ctx.strokeStyle = "#000";
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 3, eyeY - 3);
        ctx.lineTo(-eyeSep + 3, eyeY + 3);
        ctx.moveTo(-eyeSep + 3, eyeY - 3);
        ctx.lineTo(-eyeSep - 3, eyeY + 3);
        ctx.moveTo(eyeSep - 3, eyeY - 3);
        ctx.lineTo(eyeSep + 3, eyeY + 3);
        ctx.moveTo(eyeSep + 3, eyeY - 3);
        ctx.lineTo(eyeSep - 3, eyeY + 3);
        ctx.stroke();
      }

      // subtle gloss / tear if health is low
      if (p.health < 36) {
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.beginPath();
        ctx.ellipse(
          eyeSep + lookX + 1.5,
          eyeY + lookY - 1,
          1.2,
          0.8,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(
          -eyeSep + lookX + 1.5,
          eyeY + lookY - 1,
          1.2,
          0.8,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // Nose + subtle nostrils (adds facial centroid)
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.moveTo(-2, -34);
  ctx.quadraticCurveTo(0, -32, 2, -34);
  ctx.fill();
  // tiny nostrils
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(-3, -33, 1, 0.8);
  ctx.fillRect(2, -33, 1, 0.8);

  // Mouth — expression driven by mask & integrity (more readable emotions)
  const mouthBaseY = -30;
  const tSmile = Math.max(0, Math.min(1, (p.integrity - 40) / 60));
  const expr = (() => {
    switch (mask) {
      case MaskType.CHILD:
        return { amp: 0.95, smile: 1 };
      case MaskType.STUDENT:
        return { amp: -0.6, smile: -0.5 };
      case MaskType.WORKER:
        return { amp: -0.2, smile: 0 };
      case MaskType.SOCIAL:
        return { amp: 0, smile: 0 };
      default:
        return { amp: 0.2 * (tSmile * 1.2 - 0.1), smile: tSmile * 0.9 };
    }
  })();

  const mouthY = mouthBaseY + Math.sin(Date.now() * 0.01) * 0.6 + expr.amp * 4;
  const smileW = 7 + Math.abs(expr.amp) * 4;
  const smileH = (expr.smile - expr.amp * 0.3) * 6;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  if (mask === MaskType.WORKER) {
    ctx.fillStyle = "#000";
    ctx.fillRect(-5 + lookX, mouthY, 10, 4);
  } else if (mask === MaskType.SOCIAL) {
    ctx.moveTo(-6 + lookX, mouthY);
    ctx.lineTo(6 + lookX, mouthY);
  } else {
    // parametric smile/frown curve
    ctx.moveTo(-smileW + lookX, mouthY);
    ctx.quadraticCurveTo(0 + lookX, mouthY + smileH, smileW + lookX, mouthY);
  }
  ctx.stroke();

  // add subtle inner lip / teeth highlight for true self smiles
  if (mask === MaskType.NONE && expr.smile > 0.4) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(-4 + lookX, mouthY + 1);
    ctx.quadraticCurveTo(0 + lookX, mouthY - 2, 4 + lookX, mouthY + 1);
    ctx.fill();
    // faint tooth separator for extra detail
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-smileW - 1 + lookX, mouthY - 1);
    ctx.quadraticCurveTo(
      -smileW + lookX,
      mouthY,
      -smileW + 2 + lookX,
      mouthY + 2,
    );
    ctx.moveTo(smileW + 1 + lookX, mouthY - 1);
    ctx.quadraticCurveTo(
      smileW + lookX,
      mouthY,
      smileW - 2 + lookX,
      mouthY + 2,
    );
    ctx.stroke();
  }

  // Blush / cheek tint for child/true-self (keep subtle)
  if (mask === MaskType.CHILD || mask === MaskType.NONE) {
    ctx.fillStyle = "rgba(241,196,15,0.12)";
    ctx.beginPath();
    ctx.ellipse(-18, -32, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, -32, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // subtle freckles for true self to add character
    if (mask === MaskType.NONE) {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.beginPath();
      ctx.arc(-12, -34, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-18, -30, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-22, -36, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(12, -34, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18, -30, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hair tuft for child + subtle hair for true self
  if (mask === MaskType.CHILD) {
    // richer hair tuft with gradient + small highlight
    const hg = ctx.createLinearGradient(12, -64, 28, -52);
    hg.addColorStop(0, "#f39c12");
    hg.addColorStop(1, "#d35400");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(20, -56, 9, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // strand highlight
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(16, -58, 2.2, 1.6, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (mask === MaskType.NONE) {
    // subtle loose hair layer for true self (soft shadow)
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.ellipse(0, -60, 18, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Ears (subtle, shaded)
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.ellipse(-26, -42, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(26, -42, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // inner ear highlight for true self
  if (mask === MaskType.NONE) {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.ellipse(-26, -42, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(26, -42, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Subtle rim-light on head to add depth
  ctx.beginPath();
  ctx.arc(0, -42, 24, -Math.PI * 0.25, Math.PI * 0.25);
  ctx.strokeStyle = "rgba(255,255,255,0.36)";
  ctx.lineWidth = 2.3;
  ctx.stroke();

  // Accessories with micro-animation
  const now = Date.now() * 0.0025;
  if (mask === MaskType.STUDENT) {
    // mortarboard + swinging tassel
    ctx.fillStyle = "#2c3e50";
    ctx.save();
    ctx.translate(0, -64);
    ctx.rotate(-0.15);
    ctx.fillRect(-18, -6, 36, 6);
    // tassel
    const tassX = Math.sin(now * 3) * 3 + 6;
    ctx.beginPath();
    ctx.moveTo(tassX, -2);
    ctx.lineTo(tassX + 6, 4);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, -58);
    ctx.lineTo(0, -52);
    ctx.strokeStyle = "#222";
    ctx.stroke();
  } else if (mask === MaskType.WORKER) {
    // hardhat with moving highlight
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.ellipse(0, -52, 18, 8, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    // sliding specular
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.2;
    const specX = Math.cos(now * 2) * 8;
    ctx.beginPath();
    ctx.ellipse(specX, -56, 6, 2.4, -0.6, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mask === MaskType.SOCIAL) {
    // visor with animated reflection
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(-16, -46);
    ctx.lineTo(16, -46);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8 + Math.sin(now) * 2, -48);
    ctx.lineTo(8 + Math.sin(now * 1.2) * 2, -48);
    ctx.stroke();
  } else if (mask === MaskType.CHILD) {
    ctx.fillStyle = "#f39c12";
    ctx.beginPath();
    ctx.ellipse(20, -56, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hurt overlay (quick red flash)
  if (isHurt) {
    ctx.fillStyle = "rgba(231,76,60,0.12)";
    ctx.beginPath();
    ctx.arc(0, -42, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

// Draw a small semantic pictogram for a wall (child/book/briefcase/mask/home).
// Uses simple canvas primitives (keeps bundle small) and tints based on passability.
const drawWallIcon = (
  ctx: CanvasRenderingContext2D,
  obs: Entity,
  canPass: boolean,
) => {
  const cx = obs.x + obs.width / 2;
  const cy = obs.y + obs.height / 2;
  const size = Math.min(36, Math.max(20, obs.width * 0.6));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);

  // background badge
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = canPass ? "rgba(46,204,113,0.06)" : "rgba(231,76,60,0.06)";
  ctx.fill();

  const strokeCol = canPass ? "#2ecc71" : "#e74c3c";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = strokeCol;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // support single `icon` or multiple `icons` (preferred: `icons[]`)
  const iconsArr: string[] = Array.isArray((obs as any).icons)
    ? (obs as any).icons
    : obs.icon
      ? [obs.icon]
      : ["block"];

  const drawSingleIcon = (
    cx: number,
    cy: number,
    cellSize: number,
    ico: string,
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    // tiny random-ish rotation for stacked feel
    ctx.rotate(((Math.sin(cx + cy) * 0.5) / 180) * Math.PI * 12);
    const s = Math.max(8, cellSize * 0.78);

    if (ico === "toy") {
      ctx.fillStyle = "#f1c40f";
      ctx.beginPath();
      ctx.ellipse(-2, -2, s * 0.28, s * 0.34, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2, s * 0.18);
      ctx.lineTo(-2, s * 0.46);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      const r = s * 0.12;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const x = Math.cos(a) * r + s * 0.34;
        const y = Math.sin(a) * r - s * 0.06;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.globalCompositeOperation = "lighter";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else if (ico === "book") {
      const w = s * 0.7;
      const h = s * 0.42;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w / 2 - 2, h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(2, -h / 2, w / 2 - 2, h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 + 6);
      ctx.lineTo(0, h / 2 - 6);
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (ico === "briefcase") {
      const bw = s * 0.7;
      const bh = s * 0.42;
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.moveTo(-bw * 0.18, -bh / 2);
      ctx.quadraticCurveTo(0, -bh, bw * 0.18, -bh / 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(-6, -6, 12, 6);
    } else if (ico === "mask") {
      ctx.fillStyle = "#95a5a6";
      ctx.beginPath();
      ctx.ellipse(0, -2, s * 0.36, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(-s * 0.22, -2, s * 0.07, s * 0.06, 0, 0, Math.PI * 2);
      ctx.ellipse(s * 0.22, -2, s * 0.07, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-s * 0.25, 6);
      ctx.quadraticCurveTo(0, s * 0.12, s * 0.25, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ecf0f1";
      ctx.beginPath();
      ctx.roundRect(-s * 0.28, -s * 0.18, s * 0.56, s * 0.4, 6);
      ctx.fill();
      ctx.fillStyle = "#f39c12";
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.18);
      ctx.lineTo(0, -s * 0.4);
      ctx.lineTo(s * 0.32, -s * 0.18);
      ctx.closePath();
      ctx.fill();
    }

    // subtle drop shadow per token for depth
    ctx.restore();
  };

  // layout icons in a compact grid that fits inside `size`
  const n = Math.min(9, iconsArr.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const padding = Math.max(4, size * 0.06);
  const cellW = (size - padding * (cols + 1)) / cols;
  const cellH = (size - padding * (rows + 1)) / rows;
  const cellSize = Math.min(cellW, cellH);
  const startX = -((cols * cellSize + padding * (cols - 1)) / 2);
  const startY = -((rows * cellSize + padding * (rows - 1)) / 2);

  for (let i = 0; i < n; i++) {
    const cx = startX + (i % cols) * (cellSize + padding);
    const cy = startY + Math.floor(i / cols) * (cellSize + padding);
    // slight overlap / elevation for stacked look
    const overlapOffset = Math.max(0, Math.min(6, (rows - 1) * 2));
    drawSingleIcon(
      cx,
      cy - Math.floor(i / cols) * overlapOffset,
      cellSize,
      iconsArr[i],
    );
  }

  ctx.restore();
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
  setAiMessage,
  setCurrentLevelTime,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastPlayerPosSent = useRef({ t: 0, x: 0, y: 0 });

  // Ensure canvas renders sharply on Hi-DPI displays (retina)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      // Make canvas fill its parent (cover) while keeping the game's logical
      // coordinate system at CANVAS_WIDTH x CANVAS_HEIGHT. We scale the
      // drawing transform so all game math can keep using the logical units.
      // This uses a "cover" strategy so the canvas always fills both
      // width and height of its container (may crop a bit on one axis).
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / CANVAS_WIDTH;
      const scaleY = rect.height / CANVAS_HEIGHT;
      const cover = Math.max(scaleX, scaleY);

      // Backing store sized for device pixel ratio + cover scale for crispness
      const backingW = Math.max(1, Math.round(CANVAS_WIDTH * cover * dpr));
      const backingH = Math.max(1, Math.round(CANVAS_HEIGHT * cover * dpr));
      canvas.width = backingW;
      canvas.height = backingH;

      // Compute translation to center the logical viewport inside the backing surface
      const offsetX = (rect.width - CANVAS_WIDTH * cover) / 2;
      const offsetY = (rect.height - CANVAS_HEIGHT * cover) / 2;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // scale by cover*dpr and translate by offset*dpr so game coords remain 0..CANVAS_*
        ctx.setTransform(
          cover * dpr,
          0,
          0,
          cover * dpr,
          Math.round(offsetX * dpr),
          Math.round(offsetY * dpr),
        );
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

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
    // visual helpers
    blinkTimer: 0,
    hurtTimer: 0,
    // pupil target (updated from mouse) — small values in px, clamped
    pupilX: 0,
    pupilY: 0,
    // smoothed pupil used by renderer for eased gaze (prevents jitter)
    pupilSmoothX: 0,
    pupilSmoothY: 0,
  });

  const aiState = useRef({ lastMessageTime: 0, lastAction: "none" });
  const lastReported = useRef({ health: 100, integrity: 100 });
  const levelState = useRef({
    index: 0,
    cameraX: 0,
    obstacles: [] as Entity[],
    particles: [] as Particle[],
    bgElements: [] as BackgroundElement[],
    shake: 0,
    // pre-generated campaign: when true the game will use a fixed set of
    // precomputed maps (PREGENERATED_LEVEL_COUNT). Stored in `preGenerated`.
    preGeneratedMode: false,
    preGenerated: null as LevelConfig[] | null,
    // endless-run mode: procedural, never ends until player dies
    endlessMode: false,
    endlessLevelsCompleted: 0,
    endlessRunStart: 0,
    // deterministic-ish seed derived from level index (kept for reproducibility)
    procSeed: 0,
    // the active LevelConfig for the current level (handcrafted or pre-generated)
    config: LEVELS[0] as LevelConfig,
    // timing helpers
    levelStartTime: 0,
    _lastTimerUpdate: 0,
    // campaign timing (used for PREGENERATED campaign runs)
    campaignStartTime: 0,
    // damage/health-dropping visual state
    healthDropping: false,
    healthDropTimer: 0,
  });

  // Preload map 1 background image (served from public/)
  const map1Image = useRef<HTMLImageElement | null>(null);
  const trapMap1Image = useRef<HTMLImageElement | null>(null);
  // map2 assets
  const map2Image = useRef<HTMLImageElement | null>(null);
  const ground2Image = useRef<HTMLImageElement | null>(null);
  // map3 assets
  const map3Image = useRef<HTMLImageElement | null>(null);
  const ground3Image = useRef<HTMLImageElement | null>(null);
  // map4 assets
  const map4Image = useRef<HTMLImageElement | null>(null);
  // map5 assets (level index 4)
  const map5Image = useRef<HTMLImageElement | null>(null);
  // map6 assets (level index 5)
  const map6Image = useRef<HTMLImageElement | null>(null);
  // map7 assets (level index 6)
  const map7Image = useRef<HTMLImageElement | null>(null);
  // map8 assets (level index 7)
  const map8Image = useRef<HTMLImageElement | null>(null);
  // map9 assets (level index 8)
  const map9Image = useRef<HTMLImageElement | null>(null);
  // map10 assets (level index 9)
  const map10Image = useRef<HTMLImageElement | null>(null);
  const groundImage = useRef<HTMLImageElement | null>(null);
  // per-map ground/tile images for moving ground effect
  const ground4Image = useRef<HTMLImageElement | null>(null);
  const ground5Image = useRef<HTMLImageElement | null>(null);
  const ground6Image = useRef<HTMLImageElement | null>(null);
  const ground7Image = useRef<HTMLImageElement | null>(null);
  const ground8Image = useRef<HTMLImageElement | null>(null);
  const ground9Image = useRef<HTMLImageElement | null>(null);
  const ground10Image = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    // preload map1 background (map index 0)
    try {
      const img = new Image();
      // Prefer a bundler-resolvable `new URL(...)` (works if asset is moved into `src/`).
      // Keep BASE_URL so the current `public/assets/...` layout continues to work
      // when deployed to a repo subpath (GitHub Pages).
      img.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_1/background_1.png`,
        import.meta.url,
      ).href;
      img.onload = () => {
        map1Image.current = img;
      };
      img.onerror = () => {
        // ignore load errors; fallback to gradient
      };
    } catch (err) {
      // ignore
    }

    // preload trap image used for map 1 walls
    try {
      const t = new Image();
      t.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_1/traps/trap_map1.png`,
        import.meta.url,
      ).href;
      t.onload = () => {
        trapMap1Image.current = t;
      };
      t.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map2 backgrounds (map index 1)
    try {
      const m2 = new Image();
      m2.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_2/background_map2.png`,
        import.meta.url,
      ).href;
      m2.onload = () => {
        map2Image.current = m2;
      };
      m2.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }

    // preload map3 backgrounds (map index 2)
    try {
      const m3 = new Image();
      m3.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_3/school.png`,
        import.meta.url,
      ).href;
      m3.onload = () => {
        map3Image.current = m3;
      };
      m3.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map4 background (map index 4)
    try {
      const m4 = new Image();
      m4.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_4/map_4.jpg`,
        import.meta.url,
      ).href;
      m4.onload = () => {
        map4Image.current = m4;
      };
      m4.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map5 background (map index 4)
    try {
      const m5 = new Image();
      m5.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_5/map_5.jpg`,
        import.meta.url,
      ).href;
      m5.onload = () => {
        map5Image.current = m5;
      };
      m5.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map6 background (map index 5)
    try {
      const m6 = new Image();
      m6.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_6/map_6.jpg`,
        import.meta.url,
      ).href;
      m6.onload = () => {
        map6Image.current = m6;
      };
      m6.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map7 background (map index 6)
    try {
      const m7 = new Image();
      m7.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_7/map_7.jpg`,
        import.meta.url,
      ).href;
      m7.onload = () => {
        map7Image.current = m7;
      };
      m7.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map8 background (map index 7)
    try {
      const m8 = new Image();
      m8.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_8/map_8.jpg`,
        import.meta.url,
      ).href;
      m8.onload = () => {
        map8Image.current = m8;
      };
      m8.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map9 background (map index 8)
    try {
      const m9 = new Image();
      m9.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_9/map_9.jpg`,
        import.meta.url,
      ).href;
      m9.onload = () => {
        map9Image.current = m9;
      };
      m9.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload map10 background (map index 9)
    try {
      const m10 = new Image();
      m10.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_10/map_10.jpg`,
        import.meta.url,
      ).href;
      m10.onload = () => {
        map10Image.current = m10;
      };
      m10.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }

    // preload a generic ground texture (public/assets/ground.png)
    try {
      const g = new Image();
      g.src = new URL(
        `${import.meta.env.BASE_URL}assets/ground.png`,
        import.meta.url,
      ).href;
      g.onload = () => {
        groundImage.current = g;
      };
      g.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload alternate ground for map2
    try {
      const g2 = new Image();
      g2.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_2/ground_2.png`,
        import.meta.url,
      ).href;
      g2.onload = () => {
        ground2Image.current = g2;
      };
      g2.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload alternate ground for map3
    try {
      const g3 = new Image();
      g3.src = new URL(
        `${import.meta.env.BASE_URL}assets/maps/map_3/ground_3.jpg`,
        import.meta.url,
      ).href;
      g3.onload = () => {
        ground3Image.current = g3;
      };
      g3.onerror = () => {
        // ignore
      };
    } catch (err) {
      // ignore
    }
    // preload alternate ground for map4..map10
    const preloadGround = (idx: number) => {
      try {
        const img = new Image();
        img.src = new URL(
          `${import.meta.env.BASE_URL}assets/maps/map_${idx}/ground_${idx}.jpg`,
          import.meta.url,
        ).href;
        img.onload = () => {
          if (idx === 4) ground4Image.current = img;
          if (idx === 5) ground5Image.current = img;
          if (idx === 6) ground6Image.current = img;
          if (idx === 7) ground7Image.current = img;
          if (idx === 8) ground8Image.current = img;
          if (idx === 9) ground9Image.current = img;
          if (idx === 10) ground10Image.current = img;
        };
        img.onerror = () => {
          // ignore
        };
      } catch (err) {
        // ignore
      }
    };
    [4, 5, 6, 7, 8, 9, 10].forEach(preloadGround);

    return () => {
      map1Image.current = null;
      trapMap1Image.current = null;
      map2Image.current = null;
      ground2Image.current = null;
      map3Image.current = null;
      ground3Image.current = null;
      map8Image.current = null;
      map9Image.current = null;
      map10Image.current = null;
      ground4Image.current = null;
      ground5Image.current = null;
      ground6Image.current = null;
      ground7Image.current = null;
      ground8Image.current = null;
      ground9Image.current = null;
      ground10Image.current = null;
      groundImage.current = null;
      map8Image.current = null;
      map9Image.current = null;
      map10Image.current = null;
      groundImage.current = null;
      // groundImage.current = null;
    };
  }, []);

  // --- timing & persistence helpers ---
  const formatMs = (ms: number) => {
    const total = Math.max(0, Math.floor(ms));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const centi = Math.floor((total % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
  };

  const saveLevelTime = (entry: LevelTimeEntry) => {
    try {
      const raw = localStorage.getItem(TIMES_STORAGE_KEY);
      const arr: LevelTimeEntry[] = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      // keep sorted ascending (fastest first) and cap to 100 entries
      arr.sort((a, b) => a.timeMs - b.timeMs);
      const trimmed = arr.slice(0, 100);
      localStorage.setItem(TIMES_STORAGE_KEY, JSON.stringify(trimmed));
      // notify UI overlay to refresh immediately
      window.dispatchEvent(
        new CustomEvent("level-time-saved", { detail: { entry } }),
      );
      return true;
    } catch (err) {
      return false;
    }
  };

  // Save a full pre-generated campaign run (total time for all levels)
  const saveCampaignRun = (entry: CampaignRunEntry) => {
    try {
      const raw = localStorage.getItem(CAMPAIGN_TIMES_KEY);
      const arr: CampaignRunEntry[] = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      arr.sort((a, b) => a.totalTimeMs - b.totalTimeMs);
      const trimmed = arr.slice(0, 100);
      localStorage.setItem(CAMPAIGN_TIMES_KEY, JSON.stringify(trimmed));
      window.dispatchEvent(
        new CustomEvent("campaign-time-saved", { detail: { entry } }),
      );
      return true;
    } catch (err) {
      return false;
    }
  };

  // Save an endless-run summary (number of levels cleared + total time)
  const saveEndlessRun = (entry: EndlessRunEntry) => {
    try {
      const raw = localStorage.getItem(ENDLESS_RUNS_KEY);
      const arr: EndlessRunEntry[] = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      // sort by most levels cleared desc, then by time asc
      arr.sort((a, b) => {
        if (b.levelsCompleted !== a.levelsCompleted)
          return b.levelsCompleted - a.levelsCompleted;
        return a.totalTimeMs - b.totalTimeMs;
      });
      const trimmed = arr.slice(0, 100);
      localStorage.setItem(ENDLESS_RUNS_KEY, JSON.stringify(trimmed));
      window.dispatchEvent(
        new CustomEvent("endless-run-saved", { detail: { entry } }),
      );
      return true;
    } catch (err) {
      return false;
    }
  };

  const keys = useRef({ right: false, left: false, up: false });

  const triggerAI = (
    type:
      | "jump"
      | "idle"
      | "wrong_mask"
      | "damage"
      | "destroy"
      | "bounce"
      | "memory_collect"
      | "long_fall",
    force = false,
  ) => {
    const now = Date.now();
    if (!force && now - aiState.current.lastMessageTime < 2500) return;

    const messages = {
      jump: [
        "S.E.R.A: Dao động trục Y không cần thiết.",
        "S.E.R.A: Tiêu hao năng lượng.",
        "S.E.R.A: Trọng lực là quy luật.",
      ],
      idle: [
        "S.E.R.A: Năng suất 0%.",
        "S.E.R.A: Di chuyển ngay.",
        "S.E.R.A: Phát hiện lười biếng.",
      ],
      wrong_mask: [
        "S.E.R.A: CẢNH BÁO: Cảm xúc sai lệch.",
        "S.E.R.A: Đeo mặt nạ đúng.",
        "S.E.R.A: Xã hội từ chối bạn.",
      ],
      damage: [
        "S.E.R.A: Tổn thất phần cứng.",
        "S.E.R.A: Đau đớn là tín hiệu tuân thủ.",
        "S.E.R.A: Sinh mạng giảm.",
      ],
      destroy: [
        "S.E.R.A: Bạo lực chấp nhận được.",
        "S.E.R.A: Chướng ngại đã xóa.",
        "S.E.R.A: Giận dữ hiệu quả.",
      ],
      bounce: ["S.E.R.A: Mất kiểm soát hành vi.", "S.E.R.A: Quỹ đạo hỗn loạn."],
      memory_collect: [
        "S.E.R.A: Dữ liệu rác (Ký ức) được phát hiện.",
        "S.E.R.A: Xóa bỏ quá khứ.",
        "S.E.R.A: Bộ nhớ đầy.",
      ],
      long_fall: ["S.E.R.A: Chuẩn bị va chạm.", "S.E.R.A: Mất điểm tựa."],
    } as Record<string, string[]>;

    const msgs = (messages as any)[type];
    if (msgs && msgs.length > 0) {
      setAiMessage(msgs[Math.floor(Math.random() * msgs.length)]);
      aiState.current.lastMessageTime = now;
    }
  };

  /**
   * Procedural level generator — lightweight, deterministic by level index.
   * Produces a LevelConfig compatible with the handcrafted `LEVELS` so the
   * rest of the game can treat procedural levels the same way.
   */
  const generateProceduralConfig = (levelIdx: number): LevelConfig => {
    const difficulty = Math.max(0, levelIdx - (LEVELS.length - 1));
    const length = 1800 + difficulty * 400 + Math.floor(Math.random() * 800);
    // cycle required masks to encourage varied playstyles
    const maskCycle = [
      MaskType.CHILD,
      MaskType.STUDENT,
      MaskType.WORKER,
      MaskType.SOCIAL,
      MaskType.NONE,
    ];
    const reqMask = maskCycle[levelIdx % maskCycle.length];
    const names = ["Lộ Trình A", "Lộ Trình B", "Lộ Trình C", "Lộ Trình D"];
    const bg =
      difficulty % 2 === 0 ? ["#0f1724", "#1f2937"] : ["#0b3a2e", "#164e63"];

    return {
      id: levelIdx,
      name: `TỰ TẠO #${levelIdx}`,
      bgGradient: bg as [string, string],
      groundColor: difficulty > 2 ? "#4b5563" : "#7f8c8d",
      reqMask,
      message: `Màn được tạo tự động — Độ khó ${difficulty}`,
      obstacleType: "procedural",
      length,
    };
  };

  const generateLevel = (levelIdx: number) => {
    // if procedural mode is active or the index goes beyond handcrafted LEVELS,
    // generate a compatible LevelConfig on-the-fly
    // Prefer a pre-generated campaign entry (if present). Otherwise use
    // the handcrafted LEVELS. Do NOT generate infinite levels — if the
    // requested index is past available content, end the run.
    if (
      levelState.current.preGenerated &&
      levelIdx < levelState.current.preGenerated.length
    ) {
      levelState.current.config = levelState.current.preGenerated[levelIdx];
    } else if (levelIdx < LEVELS.length) {
      levelState.current.config = LEVELS[levelIdx];
    } else if (levelState.current.endlessMode) {
      // endless mode: generate procedural levels on-the-fly
      levelState.current.config = generateProceduralConfig(levelIdx);
    } else {
      // index beyond available content -> victory (no infinite generation)
      setGameState(GameState.VICTORY);
      return;
    }
    const config = levelState.current.config;

    // persist active config so update()/draw() use the same values (and below)
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

    // reset/start per-level timer
    levelState.current.levelStartTime = Date.now();
    levelState.current._lastTimerUpdate = 0;
    setCurrentLevelTime(0);

    if (config.obstacleType !== "none") {
      const numObstacles = Math.floor(config.length / 400);
      for (let i = 1; i <= numObstacles; i++) {
        const xPos = i * 400 + Math.random() * 100;
        if (i % 2 === 0) {
          // semantic wall glyphs (kept `text` for accessibility/debug)
          // per-map semantic wall labels + optional override for which mask
          // allows passing / breaking the wall. Defaults to the level's
          // `config.reqMask` unless overridden below.
          let wallLabel = "TƯỜNG";
          let wallIcon = "block";
          let wallReqMask = config.reqMask;

          switch (levelIdx) {
            case 0:
              wallLabel = "Tò Mò";
              wallIcon = "toy";
              break;
            case 1:
              wallLabel = "Bị Bỏ Lại";
              wallIcon = "book";
              break;
            case 2:
              wallLabel = "Khuôn Mẫu";
              wallIcon = "briefcase";
              break;
            case 3:
              wallLabel = `Bất Công`;
              wallIcon = "mask";
              // override: only BREAKS / can be passed when in WORKER persona
              wallReqMask = MaskType.WORKER;
              break;
            case 4:
              wallLabel = "Dám Chọn";
              wallIcon = "block";
              break;
            case 5:
              wallLabel = "Vừa Lòng";
              wallIcon = "block";
              break;
            case 6:
              wallLabel = "Kiệt Sức";
              wallIcon = "briefcase";
              break;
            case 7:
              wallLabel = "Trống Rỗng";
              wallIcon = "mask";
              break;
            case 8:
              wallLabel = "Danh Tính";
              wallIcon = "mask";
              break;
            case 9:
              wallLabel = "Chân Thật";
              wallIcon = "mask";
              // final wall should be passable when true self (NONE)
              wallReqMask = MaskType.NONE;
              break;
            default:
              break;
          }

          // occasionally compose a stacked/grouped wall (2-4 icons) for visual variety
          const makeComposite = Math.random() > 0.72; // ~28% chance
          let iconsArr: string[] | undefined = undefined;
          if (makeComposite) {
            // choose 2..4 icons, prefer thematically relevant + variants
            const pool = [
              wallIcon,
              "block",
              "toy",
              "book",
              "briefcase",
              "mask",
            ];
            const count = 2 + Math.floor(Math.random() * 3);
            iconsArr = [];
            for (let k = 0; k < count; k++) {
              const pick = pool[Math.floor(Math.random() * pool.length)];
              iconsArr.push(pick);
            }
          }

          // size the wall; allow level-0 to use a shorter height so it sits lower
          let wallWidth = 60;
          let wallHeight = 200;
          if (levelIdx === 0) {
            // make the trap visually lower — approx 3x player width, ~0.9x player height
            wallWidth = Math.round(player.current.width * 1.5);
            wallHeight = Math.round(player.current.height * 3);
          }

          const wallEnt: any = {
            x: xPos,
            y: CANVAS_HEIGHT - GROUND_HEIGHT - wallHeight,
            width: wallWidth,
            height: wallHeight,
            type: "wall",
            text: wallLabel, // keep for a11y / debug
            icon: iconsArr && iconsArr.length === 1 ? iconsArr[0] : wallIcon,
            reqMask: wallReqMask,
          };
          if (iconsArr && iconsArr.length > 0) wallEnt.icons = iconsArr;
          obstacles.push(wallEnt as Entity);
        } else {
          const isSpike = Math.random() > 0.6;
          obstacles.push({
            x: xPos,
            y:
              CANVAS_HEIGHT -
              GROUND_HEIGHT -
              (isSpike ? 20 : Math.random() * 40 + 40),
            width: 40,
            height: isSpike ? 20 : 40,
            type: isSpike ? "spike" : "block",
          });
        }
      }
    }

    const memX = Math.random() * (config.length - 400) + 200;
    obstacles.push({
      x: memX,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - 150 - Math.random() * 50,
      width: 30,
      height: 30,
      type: "memory",
      collected: false,
    });
    obstacles.push({
      x: config.length,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - 200,
      width: 50,
      height: 200,
      type: "goal",
    });

    const bgElements: BackgroundElement[] = [];
    for (let i = 0; i < 30; i++) {
      let shape: "circle" | "rect" = "circle";
      let color = "rgba(255,255,255,0.1)";
      let size = Math.random() * 30 + 10;
      let y = Math.random() * CANVAS_HEIGHT * 0.8;
      let speed = Math.random() * 0.4 + 0.05;
      if (levelIdx === 0) {
        color = `rgba(255,255,255,0.3)`;
        size = Math.random() * 60 + 20;
      }
      if (levelIdx === 1) {
        shape = "rect";
        color = `rgba(200,200,200,0.1)`;
      }
      if (levelIdx === 2) {
        shape = "rect";
        color = `rgba(0,0,0,0.2)`;
        y = Math.random() * CANVAS_HEIGHT;
      }
      if (levelIdx === 4) {
        color = `rgba(255,215,0,0.5)`;
        size = Math.random() * 4 + 1;
        speed *= 0.2;
      }
      bgElements.push({
        x: Math.random() * CANVAS_WIDTH,
        y,
        size,
        speed,
        color,
        shape,
      });
    }

    levelState.current.obstacles = obstacles;
    levelState.current.bgElements = bgElements;
    levelState.current.index = levelIdx;
    setCurrentLevel(levelIdx);
  };

  // --- Save / Load (localStorage) for pre-generated campaign ---
  const SAVE_KEY = "htvn_campaign_save";

  const saveCampaignToStorage = (meta?: Record<string, any>) => {
    try {
      const payload = {
        preGenerated: levelState.current.preGenerated || null,
        preGeneratedMode: !!levelState.current.preGenerated,
        index: levelState.current.index,
        player: {
          health: Math.max(0, Math.floor(player.current.health)),
          integrity: Math.max(0, Math.floor(player.current.integrity)),
          memoriesCollected: player.current.memoriesCollected,
          mask: player.current.mask,
        },
        meta: meta || {},
        timestamp: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      return false;
    }
  };

  const loadCampaignFromStorage = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as any;
    } catch (err) {
      return null;
    }
  };

  const clearCampaignSave = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      switch (e.code) {
        case "ArrowRight":
        case "KeyD":
          keys.current.right = true;
          break;
        case "ArrowLeft":
        case "KeyA":
          keys.current.left = true;
          break;
        case "Space":
        case "ArrowUp":
        case "KeyW":
          keys.current.up = true;
          break;
        case "Digit1":
          switchMask(MaskType.CHILD);
          break;
        case "Digit2":
          switchMask(MaskType.STUDENT);
          break;
        case "Digit3":
          switchMask(MaskType.WORKER);
          break;
        case "Digit4":
          switchMask(MaskType.SOCIAL);
          break;
        case "Digit0":
          switchMask(MaskType.NONE);
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowRight":
        case "KeyD":
          keys.current.right = false;
          break;
        case "ArrowLeft":
        case "KeyA":
          keys.current.left = false;
          break;
        case "Space":
        case "ArrowUp":
        case "KeyW":
          keys.current.up = false;
          break;
      }
    };

    // pointer tracking for subtle gaze / pupil movement (mouse + touch)
    const handlePointer = (ev: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2 - 20; // bias slightly upward
      // small, clamped pixel offsets used by drawFace
      const px = Math.max(-8, Math.min(8, (ev.clientX - cx) * 0.06));
      const py = Math.max(-6, Math.min(6, (ev.clientY - cy) * 0.04));
      player.current.pupilX = px;
      player.current.pupilY = py;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("pointermove", handlePointer);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointermove", handlePointer);
    };
  }, [gameState]);

  // UI -> Canvas controls (preset / effects / high-detail)
  useEffect(() => {
    const onPreset = (ev: Event) => {
      const d: any = (ev as CustomEvent).detail;
      if (!d) return;
      levelState.current.bgPreset = d;
      generateLevel(levelState.current.index);
    };
    const onEffects = (ev: Event) => {
      const enabled = !!(ev as CustomEvent).detail;
      levelState.current.effectsEnabled = enabled;
    };
    const onHighDetail = (ev: Event) => {
      const enabled = !!(ev as CustomEvent).detail;
      levelState.current.highDetailEnabled = enabled;
    };

    // new: listen for the 'proc-levels' toggle from the UI. Previously
    // this created infinite procedural content; now it *pre-generates a
    // fixed campaign* of PREGENERATED_LEVEL_COUNT maps and stores them.
    const onProcLevels = (ev: Event) => {
      const enabled = !!(ev as CustomEvent).detail;
      levelState.current.preGeneratedMode = enabled;
      if (enabled) {
        const total = PREGENERATED_LEVEL_COUNT;
        const arr: LevelConfig[] = [];
        for (let i = 0; i < total; i++) {
          arr.push(i < LEVELS.length ? LEVELS[i] : generateProceduralConfig(i));
        }
        levelState.current.preGenerated = arr;
        levelState.current.procSeed = Date.now() % 100000;
        // start campaign timer when pre-generated campaign is enabled
        levelState.current.campaignStartTime = Date.now();
      } else {
        levelState.current.preGenerated = null;
        levelState.current.procSeed = 0;
        levelState.current.preGeneratedMode = false;
        levelState.current.campaignStartTime = 0;
      }
      // regenerate current level so UI reflects the change immediately
      generateLevel(levelState.current.index);
    };

    // Respect user's OS motion preference by default
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) {
        levelState.current.effectsEnabled = false;
        levelState.current.highDetailEnabled = false;
      }
    }

    // save / load handlers for campaign persistence
    const onSaveGame = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      // if no preGenerated campaign exists, generate one so we can save it
      if (!levelState.current.preGenerated) {
        const arr: LevelConfig[] = [];
        for (let i = 0; i < PREGENERATED_LEVEL_COUNT; i++) {
          arr.push(i < LEVELS.length ? LEVELS[i] : generateProceduralConfig(i));
        }
        levelState.current.preGenerated = arr;
        levelState.current.preGeneratedMode = true;
      }
      saveCampaignToStorage(detail);
      setAiMessage("S.E.R.A: Trạng thái chiến dịch đã được lưu.");
    };

    const onLoadSave = (ev: Event) => {
      const saved = loadCampaignFromStorage();
      if (!saved) return;
      levelState.current.preGenerated = saved.preGenerated || null;
      levelState.current.preGeneratedMode = !!saved.preGenerated;
      // restore the saved index / then patch player state after level generation
      const target = Math.max(
        0,
        Math.min((saved.index as number) || 0, PREGENERATED_LEVEL_COUNT - 1),
      );
      generateLevel(target);
      // apply player snapshot
      if (saved.player) {
        player.current.health = saved.player.health ?? player.current.health;
        player.current.integrity =
          saved.player.integrity ?? player.current.integrity;
        player.current.memoriesCollected =
          saved.player.memoriesCollected ?? player.current.memoriesCollected;
        player.current.mask = saved.player.mask ?? player.current.mask;
        setCurrentHealth(player.current.health);
        setCurrentIntegrity(player.current.integrity);
        setCollectedMemories(player.current.memoriesCollected);
        setCurrentMask(player.current.mask);
      }
      setGameState(GameState.PLAYING);
      setAiMessage("S.E.R.A: Tiếp tục chiến dịch đã lưu.");
    };

    const onClearSave = (ev: Event) => {
      clearCampaignSave();
      setAiMessage("S.E.R.A: Dữ liệu lưu đã bị xóa.");
    };

    const onReplayCampaign = (ev: Event) => {
      const saved = loadCampaignFromStorage();
      if (!saved || !saved.preGenerated) return;
      levelState.current.preGenerated = saved.preGenerated;
      levelState.current.preGeneratedMode = true;
      // reset campaign timer
      levelState.current.campaignStartTime = Date.now();
      generateLevel(0);
      player.current.health = 100;
      player.current.integrity = 100;
      player.current.memoriesCollected = 0;
      setCurrentHealth(100);
      setCurrentIntegrity(100);
      setCollectedMemories(0);
      setGameState(GameState.PLAYING);
      // keep the save but reset its index to 0
      saveCampaignToStorage({ restarted: true });
      setAiMessage("S.E.R.A: Bắt đầu lại chiến dịch.");
    };

    const onEndlessMode = (ev: Event) => {
      const enabled = !!(ev as CustomEvent).detail;
      levelState.current.endlessMode = enabled;
      levelState.current.preGeneratedMode = false;
      levelState.current.preGenerated = null;
      levelState.current.endlessLevelsCompleted = 0;
      levelState.current.endlessRunStart = enabled ? Date.now() : 0;
      // notify HUD
      window.dispatchEvent(
        new CustomEvent("endless-mode-changed", {
          detail: { enabled, levelsCompleted: 0 },
        }),
      );
      if (enabled) {
        // start at procedural level 0
        generateLevel(0);
      }
    };

    const onStartPreGenLevel = (ev: Event) => {
      const d: any = (ev as CustomEvent).detail || {};
      const target = Math.max(
        0,
        Math.min((d.index as number) || 0, PREGENERATED_LEVEL_COUNT - 1),
      );
      // ensure pre-generated campaign exists
      if (!levelState.current.preGenerated) {
        const arr: LevelConfig[] = [];
        for (let i = 0; i < PREGENERATED_LEVEL_COUNT; i++) {
          arr.push(i < LEVELS.length ? LEVELS[i] : generateProceduralConfig(i));
        }
        levelState.current.preGenerated = arr;
        levelState.current.preGeneratedMode = true;
        levelState.current.campaignStartTime = Date.now();
      }
      generateLevel(target);
    };

    window.addEventListener("bg-preset", onPreset as EventListener);
    window.addEventListener("bg-effects", onEffects as EventListener);
    window.addEventListener("high-detail", onHighDetail as EventListener);
    window.addEventListener("proc-levels", onProcLevels as EventListener);
    window.addEventListener("save-game", onSaveGame as EventListener);
    window.addEventListener("load-save", onLoadSave as EventListener);
    window.addEventListener("clear-save", onClearSave as EventListener);
    window.addEventListener(
      "replay-campaign",
      onReplayCampaign as EventListener,
    );
    window.addEventListener("endless-mode", onEndlessMode as EventListener);
    window.addEventListener(
      "start-pregen-level",
      onStartPreGenLevel as EventListener,
    );

    return () => {
      window.removeEventListener("bg-preset", onPreset as EventListener);
      window.removeEventListener("bg-effects", onEffects as EventListener);
      window.removeEventListener("high-detail", onHighDetail as EventListener);
      window.removeEventListener("proc-levels", onProcLevels as EventListener);
      window.removeEventListener("save-game", onSaveGame as EventListener);
      window.removeEventListener("load-save", onLoadSave as EventListener);
      window.removeEventListener("clear-save", onClearSave as EventListener);
      window.removeEventListener(
        "replay-campaign",
        onReplayCampaign as EventListener,
      );
      window.removeEventListener(
        "endless-mode",
        onEndlessMode as EventListener,
      );
      window.removeEventListener(
        "start-pregen-level",
        onStartPreGenLevel as EventListener,
      );
    };
  }, []);

  const switchMask = (mask: MaskType) => {
    player.current.mask = mask;
    setCurrentMask(mask);
    const cx = player.current.x + player.current.width / 2;
    const cy = player.current.y + player.current.height / 2;
    let color = "#fff";
    if (mask === MaskType.CHILD) color = "#f1c40f";
    if (mask === MaskType.STUDENT) color = "#3498db";
    if (mask === MaskType.WORKER) color = "#e74c3c";

    player.current.scaleX = 1.3;
    player.current.scaleY = 0.7;

    for (let i = 0; i < 8; i++) {
      levelState.current.particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 20,
        size: Math.random() * 5 + 2,
        color: color,
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

    // decay transient health-drop timer/effect
    if (l.healthDropTimer && l.healthDropTimer > 0) {
      l.healthDropTimer--;
      if (l.healthDropTimer <= 0) {
        l.healthDropping = false;
        l.healthDropTimer = 0;
      }
    }

    p.scaleX += (1 - p.scaleX) * 0.1;
    p.scaleY += (1 - p.scaleY) * 0.1;

    // --- Blink handling (was declared but unused) ---
    if (p.blinkTimer > 0) p.blinkTimer--;
    else if (p.grounded && Math.random() < 0.012) {
      // occasional natural blink
      p.blinkTimer = 6 + Math.floor(Math.random() * 6);
    }

    // Smooth pupil toward last pointer sample for organic gaze (eased)
    p.pupilSmoothX += (p.pupilX - p.pupilSmoothX) * 0.14;
    p.pupilSmoothY += (p.pupilY - p.pupilSmoothY) * 0.12;

    // Emit tiny dust particles when running on ground for more life
    const isMoving = Math.abs(p.vx) > 1 && p.grounded;
    if (isMoving && Math.random() < 0.18) {
      levelState.current.particles.push({
        x: p.x + p.width / 2 - (p.facingRight ? 6 : -6),
        y: p.y + p.height - 8,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 0.6,
        life: 18,
        size: Math.random() * 3 + 1,
        color: "rgba(20,20,20,0.25)",
      });
    }

    let gravity = BASE_GRAVITY;
    let speed = BASE_SPEED;
    let jumpForce = BASE_JUMP;
    let friction = 0.8;

    if (p.mask === MaskType.CHILD) {
      speed = 7;
      friction = 0.95;
    } else if (p.mask === MaskType.STUDENT) {
      gravity = 0.2;
      speed = 3;
      jumpForce = -8;
    } else if (p.mask === MaskType.WORKER) {
      gravity = 1.2;
      speed = 8;
      jumpForce = -15;
    }

    if (keys.current.right) {
      p.vx += (speed - p.vx) * 0.2;
      p.facingRight = true;
      p.idleTime = 0;
    } else if (keys.current.left) {
      p.vx += (-speed - p.vx) * 0.2;
      p.facingRight = false;
      p.idleTime = 0;
    } else {
      p.vx *= friction;
      p.idleTime++;
      if (p.idleTime > 240) triggerAI("idle");
    }

    if (keys.current.up && p.grounded) {
      p.vy = jumpForce;
      p.grounded = false;
      p.scaleX = 0.7;
      p.scaleY = 1.3;
      p.lastJumpTime = Date.now();
      if (Math.random() > 0.8) triggerAI("jump");
    }

    p.vy += gravity;
    p.x += p.vx;
    p.y += p.vy;

    if (!p.grounded) {
      p.airTime++;
      if (p.airTime > 120 && p.vy > 5) triggerAI("long_fall");
    } else {
      p.airTime = 0;
    }

    // Ground Check
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    if (p.y + p.height > groundY) {
      if (!p.grounded) {
        p.scaleX = 1.3;
        p.scaleY = 0.7;
      }
      p.y = groundY - p.height;
      if (p.mask === MaskType.CHILD && Math.abs(p.vy) > 2) {
        p.vy = -Math.abs(p.vy) * 0.7;
        triggerAI("bounce");
        p.grounded = false;
        p.scaleX = 1.2;
        p.scaleY = 0.8;
      } else {
        p.vy = 0;
        p.grounded = true;
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
      if (
        p.x < obs.x + obs.width &&
        p.x + p.width > obs.x &&
        p.y < obs.y + obs.height &&
        p.y + p.height > obs.y
      ) {
        // 1. Anger Destruction
        if (
          p.mask === MaskType.WORKER &&
          (obs.type === "spike" || obs.type === "block")
        ) {
          l.obstacles.splice(i, 1);
          triggerAI("destroy");
          l.shake = 5;
          p.hurtTimer = 5;
          for (let k = 0; k < 10; k++) {
            l.particles.push({
              x: obs.x + obs.width / 2,
              y: obs.y + obs.height / 2,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 20,
              size: Math.random() * 5 + 2,
              color: "#e74c3c",
            });
          }
          continue;
        }

        // 2. Interaction
        if (obs.type === "goal") {
          // record completion time
          const elapsed = levelState.current.levelStartTime
            ? Math.max(0, Date.now() - levelState.current.levelStartTime)
            : 0;
          setCurrentLevelTime(elapsed);

          const lvlName = (l.config || LEVELS[l.index]).name;
          const entry: LevelTimeEntry = {
            levelId: l.index,
            levelName: lvlName,
            timeMs: elapsed,
            timestamp: Date.now(),
          };
          saveLevelTime(entry);
          setAiMessage(
            `S.E.R.A: Màn \"${lvlName}\" hoàn thành — ${formatMs(elapsed)}`,
          );

          // --- Endless-run: continue generating procedural levels forever ---
          if (l.endlessMode) {
            l.endlessLevelsCompleted = (l.endlessLevelsCompleted || 0) + 1;
            // notify HUD of progress
            window.dispatchEvent(
              new CustomEvent("endless-level-complete", {
                detail: { levelsCompleted: l.endlessLevelsCompleted },
              }),
            );
            // advance to next procedural level (endless mode still allows infinite)
            generateLevel(l.index + 1);
            return;
          }

          // Determine how many maps the game should allow (cap at PREGENERATED_LEVEL_COUNT)
          const maxAllowedIndex = l.preGenerated
            ? Math.max(0, l.preGenerated.length - 1)
            : PREGENERATED_LEVEL_COUNT - 1;

          // If this was the last level of a pre-generated campaign, record the
          // full-run time to the campaign leaderboard before showing victory.
          if (
            l.preGeneratedMode &&
            l.preGenerated &&
            l.index === l.preGenerated.length - 1
          ) {
            const started = l.campaignStartTime || 0;
            if (started > 0) {
              const total = Math.max(0, Date.now() - started);
              const runEntry: CampaignRunEntry = {
                runId: String(Date.now()),
                totalTimeMs: total,
                levels: l.preGenerated.length,
                timestamp: Date.now(),
              };
              saveCampaignRun(runEntry);
              setAiMessage(`S.E.R.A: Chiến dịch hoàn tất — ${formatMs(total)}`);
            }
            setGameState(GameState.VICTORY);
            return;
          }

          // If there are more maps allowed (handcrafted, pre-generated, or up to the
          // fixed PREGENERATED_LEVEL_COUNT), advance; otherwise show victory.
          if (l.index < maxAllowedIndex) {
            generateLevel(l.index + 1);
          } else {
            setGameState(GameState.VICTORY);
          }
          return;
        } else if (obs.type === "spike") {
          takeHealthDamage(5);
          p.vy = -5;
          triggerAI("damage");
        } else if (obs.type === "memory") {
          obs.collected = true;
          p.memoriesCollected++;
          setCollectedMemories(p.memoriesCollected);
          triggerAI("memory_collect", true);
        } else if (obs.type === "wall" || obs.type === "block") {
          const isWall = obs.type === "wall";
          if (isWall && p.mask === obs.reqMask) continue; // Pass through

          const col = resolveCollision(p, obs);
          if (col) {
            // Show map-specific wall-dialogs when colliding with traps on level 0
            if (isWall && levelState.current.index === 0) {
              const dlg = LEVEL_DIALOGS[levelState.current.index] || {};
              const msg = dlg[p.mask as MaskType];
              if (msg) setAiMessage(msg);
            }
            if (col === "top") {
              p.y = obs.y + obs.height;
              p.vy = 0;
            } else if (col === "bottom") {
              p.y = obs.y - p.height;
              p.vy = 0;
              p.grounded = true;
            } else if (col === "left") {
              p.x = obs.x + obs.width;
              p.vx = 0;
            } else if (col === "right") {
              p.x = obs.x - p.width;
              p.vx = 0;
              if (isWall) {
                takeHealthDamage(1);
                triggerAI("wrong_mask");
              }
            }
          }
        }
      }
    }

    // Camera
    const config = levelState.current.config || LEVELS[l.index];
    let targetCamX = p.x - CANVAS_WIDTH / 3;
    if (targetCamX < 0) targetCamX = 0;
    if (targetCamX > config.length - CANVAS_WIDTH + 100)
      targetCamX = config.length - CANVAS_WIDTH + 100;
    l.cameraX += (targetCamX - l.cameraX) * 0.1;

    // --- live level timer (throttled to avoid excessive React updates) ---
    if (
      typeof levelState.current.levelStartTime === "number" &&
      levelState.current.levelStartTime > 0
    ) {
      const now = Date.now();
      const elapsed = Math.max(0, now - levelState.current.levelStartTime);
      if (now - (l._lastTimerUpdate || 0) > 150) {
        l._lastTimerUpdate = now;
        setCurrentLevelTime(Math.floor(elapsed));
      }
    }

    // Stat Degradation
    if (p.invulnerable > 0) p.invulnerable--;

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
    if (p.health <= 0) {
      // setDeathReason("S.E.R.A: Đối tượng đã ngưng hoạt động.");
      // if this was an endless run, persist the result (levels cleared)
      if (levelState.current.endlessMode) {
        const levels = levelState.current.endlessLevelsCompleted || 0;
        const total = Math.max(
          0,
          Date.now() - (levelState.current.endlessRunStart || Date.now()),
        );
        const entry: EndlessRunEntry = {
          runId: String(Date.now()),
          levelsCompleted: levels,
          totalTimeMs: total,
          timestamp: Date.now(),
        };
        saveEndlessRun(entry);
        window.dispatchEvent(
          new CustomEvent("endless-mode-changed", {
            detail: { enabled: false, levelsCompleted: levels },
          }),
        );
      }
      setGameState(GameState.GAME_OVER);
    }
    if (p.integrity <= 0) {
      // setDeathReason("S.E.R.A: Đồng hóa hoàn tất.");
      if (levelState.current.endlessMode) {
        const levels = levelState.current.endlessLevelsCompleted || 0;
        const total = Math.max(
          0,
          Date.now() - (levelState.current.endlessRunStart || Date.now()),
        );
        const entry: EndlessRunEntry = {
          runId: String(Date.now()),
          levelsCompleted: levels,
          totalTimeMs: total,
          timestamp: Date.now(),
        };
        saveEndlessRun(entry);
        window.dispatchEvent(
          new CustomEvent("endless-mode-changed", {
            detail: { enabled: false, levelsCompleted: levels },
          }),
        );
      }
      setGameState(GameState.GAME_OVER);
    }

    // Particles
    for (let i = l.particles.length - 1; i >= 0; i--) {
      const part = l.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life--;
      if (part.life <= 0) l.particles.splice(i, 1);
    }
    if (l.shake > 0) l.shake *= 0.9;
  };

  const takeHealthDamage = (amount: number) => {
    player.current.health -= amount;
    player.current.hurtTimer = 10;
    player.current.scaleX = 0.8;
    player.current.scaleY = 0.8;
    // trigger transient damage effect (clears automatically in update loop)
    levelState.current.healthDropping = true;
    levelState.current.healthDropTimer = 36; // frames (~600ms at 60fps)
    if (
      Math.abs(player.current.health - lastReported.current.health) > 1 ||
      player.current.health <= 0
    ) {
      const val = Math.max(0, Math.floor(player.current.health));
      lastReported.current.health = val;
      setCurrentHealth(val);
    }
    if (amount > 1) levelState.current.shake = 10;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const l = levelState.current;
    const p = player.current;
    const config = l.config || LEVELS[l.index];
    // whether to render extra high-fidelity details (controlled from HUD / reduced-motion aware)
    const highDetail = !!(l.effectsEnabled && l.highDetailEnabled);

    ctx.imageSmoothingEnabled = true;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw level background: use images for map 1 if available, otherwise gradient
    if (l.index === 0 && map1Image.current && map1Image.current.complete) {
      try {
        // base/background layer
        ctx.drawImage(map1Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // no secondary overlay for map1 — single image only
      } catch (err) {
        // If draw fails, fallback to gradient below
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 1 &&
      map2Image.current &&
      map2Image.current.complete
    ) {
      try {
        // base/background layer for map2
        ctx.drawImage(map2Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // no secondary overlay for map2 — single image only
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 2 &&
      map3Image.current &&
      map3Image.current.complete
    ) {
      try {
        // Only draw base background for map3 (no overlay)
        ctx.drawImage(map3Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 3 &&
      map4Image.current &&
      map4Image.current.complete
    ) {
      try {
        // base/background layer for map4
        ctx.drawImage(map4Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 4 &&
      map5Image.current &&
      map5Image.current.complete
    ) {
      try {
        // base/background layer for map5 (level index 4)
        ctx.drawImage(map5Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 5 &&
      map6Image.current &&
      map6Image.current.complete
    ) {
      try {
        // base/background layer for map6 (level index 5)
        ctx.drawImage(map6Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 6 &&
      map7Image.current &&
      map7Image.current.complete
    ) {
      try {
        // base/background layer for map7 (level index 6)
        ctx.drawImage(map7Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 7 &&
      map8Image.current &&
      map8Image.current.complete
    ) {
      try {
        // base/background layer for map8 (level index 7)
        ctx.drawImage(map8Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 8 &&
      map9Image.current &&
      map9Image.current.complete
    ) {
      try {
        // base/background layer for map9 (level index 8)
        ctx.drawImage(map9Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (
      l.index === 9 &&
      map10Image.current &&
      map10Image.current.complete
    ) {
      try {
        // base/background layer for map10 (level index 9)
        ctx.drawImage(map10Image.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (err) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, config.bgGradient[0]);
        gradient.addColorStop(1, config.bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, config.bgGradient[0]);
      gradient.addColorStop(1, config.bgGradient[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    const lowHealth = p.health < 40;
    let glitchOffsetX = 0;
    if (lowHealth && Math.random() > 0.8) {
      glitchOffsetX = (Math.random() - 0.5) * 20 * ((40 - p.health) / 10);
    }

    // transient damage overlay while health is actively dropping
    if (l.healthDropping && l.healthDropTimer && l.healthDropTimer > 0) {
      ctx.save();
      // alpha fades out as timer decreases
      const a = Math.min(0.18, (l.healthDropTimer / 36) * 0.18);
      ctx.fillStyle = `rgba(231,76,60,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // Map number (large subtle glyph at top) and title (centered)
    try {
      const idx = levelState.current.index || 0;
      const title = MAP_TITLES[idx] || (l.config && l.config.name) || "";

      // large faint map number at top-center (background accent)
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 88px Roboto, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const numX = CANVAS_WIDTH / 2 + glitchOffsetX * 0.2;
      ctx.fillText(String(idx + 1), numX, 8);
      ctx.restore();

      // Title band (centered slightly below the top)
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `600 22px Roboto, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      // small shadow for legibility
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 6;
      ctx.fillText(title, CANVAS_WIDTH / 2 + glitchOffsetX * 0.25, 18);
      ctx.shadowBlur = 0;
      ctx.restore();
    } catch (err) {
      // ignore any canvas text errors
    }

    ctx.save();
    const shakeX = (Math.random() - 0.5) * l.shake;
    const shakeY = (Math.random() - 0.5) * l.shake;

    // Background
    // For level 0 and 2 we rely on the photographic backgrounds — skip extra
    // decorative overlay elements which can wash out the images.
    if (l.index !== 0 && l.index !== 2) {
      ctx.save();
      ctx.translate(shakeX + glitchOffsetX, shakeY);
      const totalW = CANVAS_WIDTH + 200;
      l.bgElements.forEach((bg) => {
        let drawX = (bg.x - l.cameraX * bg.speed) % totalW;
        if (drawX < 0) drawX += totalW;
        drawX -= 100;
        ctx.fillStyle = bg.color;
        if (bg.shape === "circle") {
          ctx.beginPath();
          ctx.arc(drawX, bg.y, bg.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(drawX, bg.y, bg.size, bg.size);
        }
      });
      ctx.restore();
    }

    // Game World
    ctx.translate(-l.cameraX + shakeX + glitchOffsetX, shakeY);
    // choose ground image per-map (map2 uses ground2Image, map3 uses ground3Image)
    const groundImg =
      l.index === 1
        ? ground2Image.current
        : l.index === 2
          ? ground3Image.current
          : l.index === 3
            ? ground4Image.current
            : l.index === 4
              ? ground5Image.current
              : l.index === 5
                ? ground6Image.current
                : l.index === 6
                  ? ground7Image.current
                  : l.index === 7
                    ? ground8Image.current
                    : l.index === 8
                      ? ground9Image.current
                      : l.index === 9
                        ? ground10Image.current
                        : groundImage.current;
    if (groundImg && groundImg.complete) {
      try {
        const img = groundImg;
        const gw = img.width;
        const gh = img.height;
        // scale image to the ground height
        const scale = GROUND_HEIGHT / Math.max(1, gh);
        const drawW = Math.max(16, Math.round(gw * scale));
        const totalW = config.length + 800;
        for (let tx = 0; tx < totalW; tx += drawW) {
          ctx.drawImage(
            img,
            tx,
            CANVAS_HEIGHT - GROUND_HEIGHT,
            drawW,
            GROUND_HEIGHT,
          );
        }
      } catch (err) {
        ctx.fillStyle = config.groundColor;
        ctx.fillRect(
          0,
          CANVAS_HEIGHT - GROUND_HEIGHT,
          config.length + 800,
          GROUND_HEIGHT,
        );
      }
    } else {
      ctx.fillStyle = config.groundColor;
      ctx.fillRect(
        0,
        CANVAS_HEIGHT - GROUND_HEIGHT,
        config.length + 800,
        GROUND_HEIGHT,
      );
    }

    if (l.index === 4) {
      const hx = config.length + 50;
      const hy = CANVAS_HEIGHT - GROUND_HEIGHT;
      ctx.fillStyle = "#ecf0f1";
      ctx.fillRect(hx, hy - 120, 140, 120);
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.moveTo(hx - 20, hy - 120);
      ctx.lineTo(hx + 70, hy - 180);
      ctx.lineTo(hx + 160, hy - 120);
      ctx.fill();
    }

    const camX = l.cameraX;
    l.obstacles.forEach((obs) => {
      if (obs.x + obs.width < camX - 100 || obs.x > camX + CANVAS_WIDTH + 100)
        return;

      if (obs.type === "block") {
        const g = ctx.createLinearGradient(
          obs.x,
          obs.y,
          obs.x,
          obs.y + obs.height,
        );
        g.addColorStop(0, "#34495e");
        g.addColorStop(1, "#2c3e50");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // subtle inner bevel
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, 6);
      } else if (obs.type === "spike") {
        const g = ctx.createLinearGradient(
          obs.x,
          obs.y,
          obs.x,
          obs.y + obs.height,
        );
        g.addColorStop(0, "#ff7979");
        g.addColorStop(1, "#c0392b");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // small shadow
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(obs.x, obs.y + obs.height, obs.width, 4);
      } else if (obs.type === "memory" && !obs.collected) {
        ctx.fillStyle = "#f1c40f";
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        const spikes = 5;
        const outerRadius = 15;
        const innerRadius = 7;
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;
          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        // glow
        ctx.save();
        ctx.shadowColor = "#f1c40f";
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.restore();
      } else if (obs.type === "wall") {
        const canPass = p.mask === obs.reqMask;

        // draw trap image when available
        if (trapMap1Image.current && trapMap1Image.current.complete) {
          try {
            ctx.drawImage(
              trapMap1Image.current,
              obs.x,
              obs.y,
              obs.width,
              obs.height,
            );
          } catch (err) {
            // fallback to rect if draw fails
            ctx.fillStyle = canPass ? "#2ecc71" : "#c0392b";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          }

          // tint overlay: green when passable, red when blocked
          ctx.save();
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = canPass
            ? "rgba(46,204,113,0.18)"
            : "rgba(231,76,60,0.18)";
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.restore();

          // border
          ctx.strokeStyle = canPass ? "#2ecc71" : "#c0392b";
          ctx.lineWidth = 1.5;
          if (canPass) ctx.setLineDash([5, 5]);
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.setLineDash([]);

          // draw the label text on the wall (support multiline obs.text)
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = "bold 10px Roboto, Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const rawLabel = (obs.text as string) || "";
          const lines = rawLabel.split("\n");
          for (let li = 0; li < lines.length; li++) {
            ctx.fillText(lines[li], obs.x + obs.width / 2, obs.y + 8 + li * 12);
          }
          ctx.restore();
        } else {
          // fallback visual if image not loaded: colored rect with border
          ctx.fillStyle = canPass
            ? "rgba(46,204,113,0.12)"
            : "rgba(231,76,60,0.12)";
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.strokeStyle = canPass ? "#2ecc71" : "#c0392b";
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          ctx.save();
          ctx.fillStyle = canPass ? "#2ecc71" : "#c0392b";
          ctx.font = "bold 12px Roboto, Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const fallbackLabel = (obs.text as string) || "";
          const flines = fallbackLabel.split("\n");
          for (let li = 0; li < flines.length; li++) {
            ctx.fillText(
              flines[li],
              obs.x + obs.width / 2,
              obs.y + 8 + li * 14,
            );
          }
          ctx.restore();
        }
      }
    });

    // Player (with idle-breathing + layered shadow)
    const time = Date.now() * 0.015;
    const isMoving = Math.abs(p.vx) > 0.5;
    // breathing: faster while moving, slow deep-breath when idle
    const walkBob = Math.abs(Math.sin(time * 2)) * 3;
    const idleBreath =
      Math.sin(time * 0.65) * (p.grounded && !isMoving ? 1.6 : 0.6);
    const bob = isMoving ? walkBob : idleBreath;

    // subtle head breathing scale when idle (adds life)
    const idleScale =
      1 + (p.grounded && !isMoving ? Math.sin(time * 0.65) * 0.02 : 0);

    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height);
    ctx.scale(p.scaleX * idleScale, p.scaleY * (1 / idleScale));
    if (!p.facingRight) ctx.scale(-1, 1);

    let pantsColor = "#2c3e50";
    let shirtColor = "#ecf0f1";
    let skinColor = "#f1c40f";
    if (p.mask === MaskType.CHILD) {
      shirtColor = "#f1c40f";
      pantsColor = "#d35400";
    }
    if (p.mask === MaskType.STUDENT) {
      shirtColor = "#3498db";
      pantsColor = "#2c3e50";
    }
    if (p.mask === MaskType.WORKER) {
      shirtColor = "#c0392b";
      pantsColor = "#2c3e50";
    }

    // Layered ground shadow that scales with jump height (adds weight)
    ctx.save();
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    const above = Math.max(0, groundY - (p.y + p.height));
    const t = Math.min(1, above / 160); // 0..1 as player rises
    const innerW = 26 * (1 - 0.55 * t);
    const innerH = 10 * (1 - 0.6 * t);
    const outerW = 40 * (1 - 0.5 * t);
    const outerH = 14 * (1 - 0.5 * t);
    const alphaInner = 0.28 * (1 - Math.min(0.85, t * 1.2));
    const alphaOuter = 0.12 * (1 - t);

    ctx.translate(0, 6 + above * 0.02);
    ctx.fillStyle = `rgba(0,0,0,${alphaInner.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, innerW, innerH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(0,0,0,${alphaOuter.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 2, outerW, outerH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Spawn tiny floating particles when 'true self' (visual polish)
    if (
      !isMoving &&
      p.grounded &&
      p.mask === MaskType.NONE &&
      Math.random() < 0.04
    ) {
      levelState.current.particles.push({
        x: p.x + p.width / 2 + (Math.random() - 0.5) * 18,
        y: p.y - 40 + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.3 - 0.2,
        life: 50,
        size: Math.random() * 2 + 0.6,
        color: "rgba(241,196,15,0.16)",
      });
    }

    // Legs
    ctx.fillStyle = pantsColor;
    const legLX = isMoving ? Math.sin(time) * 12 : 0;
    const legRX = isMoving ? -Math.sin(time) * 12 : 0;
    ctx.beginPath();
    ctx.roundRect(-8 + legLX, -16, 10, 16, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(0 + legRX, -16, 10, 16, 4);
    ctx.fill();

    // Body
    ctx.translate(0, -16 - bob);
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(-15, -35, 30, 35, 6);
    ctx.fill();

    // simple collar shadow
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.moveTo(-6, -20);
    ctx.lineTo(0, -26);
    ctx.lineTo(6, -20);
    ctx.closePath();
    ctx.fill();

    // high-detail fabric seam + collar shading
    if (highDetail) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-8, -20);
      ctx.quadraticCurveTo(0, -26, 8, -20);
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(-14, -32, 28, 6);
      ctx.restore();
    }

    // Head (higher-fidelity shading + subtle ambient occlusion for depth)
    if (l.index === 4 && p.mask === MaskType.NONE) skinColor = "#f1c40f";
    else if (p.mask !== MaskType.NONE) skinColor = "#fff";

    const headGrad = ctx.createRadialGradient(0, -48, 6, 0, -42, 36);
    headGrad.addColorStop(0, `${skinColor}`);
    headGrad.addColorStop(0.45, `${skinColor}`);
    headGrad.addColorStop(0.75, "rgba(0,0,0,0.06)");
    headGrad.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -42, 24, 0, Math.PI * 2);
    ctx.fill();

    // high-detail rim / subsurface + cheek tint when enabled
    if (highDetail) {
      // thin rim-light using radial stroke + sharper silhouette + hair detail
      ctx.save();
      // rim highlight
      const rim = ctx.createRadialGradient(0, -54, 8, 0, -42, 28);
      rim.addColorStop(0, "rgba(255,255,255,0.20)");
      rim.addColorStop(0.5, "rgba(255,255,255,0.08)");
      rim.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.1;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.arc(0, -42, 24.25, 0, Math.PI * 2);
      ctx.stroke();

      // hair / scalp subtle overlay depending on mask / persona
      ctx.globalCompositeOperation = "source-over";
      if (p.mask === MaskType.CHILD) {
        // playful hair clumps
        ctx.fillStyle = "#f39c12";
        ctx.beginPath();
        ctx.moveTo(10, -62);
        ctx.bezierCurveTo(14, -70, 6, -74, 2, -62);
        ctx.bezierCurveTo(-4, -70, -14, -66, -8, -58);
        ctx.closePath();
        ctx.fill();
      } else if (p.mask === MaskType.WORKER) {
        // helmet shadow and bezel edge
        ctx.fillStyle = "#c0392b";
        ctx.beginPath();
        ctx.ellipse(0, -52, 18, 8, 0, Math.PI, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, -52, 18, 8, 0, Math.PI, 2 * Math.PI);
        ctx.stroke();
      } else if (p.mask === MaskType.STUDENT) {
        // mortarboard shading refinements
        ctx.fillStyle = "#22303b";
        ctx.beginPath();
        ctx.moveTo(-20, -64);
        ctx.lineTo(20, -64);
        ctx.lineTo(0, -70);
        ctx.closePath();
        ctx.fill();
      } else {
        // true-self / social slight hair strand shading
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.beginPath();
        ctx.moveTo(12, -60);
        ctx.quadraticCurveTo(6, -66, 0, -64);
        ctx.quadraticCurveTo(-6, -62, -12, -58);
        ctx.fill();
      }

      // subtle cheek SSS when appropriate
      if (p.mask === MaskType.CHILD || p.mask === MaskType.NONE) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(241,196,15,0.08)";
        ctx.beginPath();
        ctx.ellipse(-18, -32, 6.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(18, -32, 6.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      // tiny skin micro-shadow under chin (crisper)
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(0, -24, 18, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // sharper silhouette stroke to make head read at small sizes
      ctx.strokeStyle = "rgba(0,0,0,0.14)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(0, -42, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    } else {
      // subtle under-chin ambient occlusion (fallback)
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.beginPath();
      ctx.ellipse(0, -24, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // thin crisp rim/stroke to enhance silhouette on all displays
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.stroke();
    if (p.mask !== MaskType.NONE) {
      ctx.strokeStyle = "rgba(189,195,199,0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Mask overlay (subtle) to emphasize different personas
    if (p.mask !== MaskType.NONE) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      if (p.mask === MaskType.CHILD) ctx.fillStyle = "#f1c40f";
      else if (p.mask === MaskType.STUDENT) ctx.fillStyle = "#3498db";
      else if (p.mask === MaskType.WORKER) ctx.fillStyle = "#c0392b";
      else if (p.mask === MaskType.SOCIAL) ctx.fillStyle = "#95a5a6";
      ctx.beginPath();
      ctx.arc(0, -42, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawFace(ctx, p, l.index, !!(l.effectsEnabled && l.highDetailEnabled));

    ctx.restore();

    // Particles
    l.particles.forEach((part) => {
      ctx.globalAlpha = part.life / 30;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.restore();
  };

  const tick = () => {
    if (gameState === GameState.PLAYING) update();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx);
      // Dispatch player head position (DOM/client coordinates) throttled ~100ms
      try {
        const now = Date.now();
        if (now - lastPlayerPosSent.current.t > 90) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = rect.width / CANVAS_WIDTH;
          const scaleY = rect.height / CANVAS_HEIGHT;
          const cover = Math.max(scaleX, scaleY);
          const offsetX = (rect.width - CANVAS_WIDTH * cover) / 2;
          const offsetY = (rect.height - CANVAS_HEIGHT * cover) / 2;
          const p = player.current;
          const l = levelState.current;
          // logical head position: draw translates to (p.x + p.width/2, p.y + p.height)
          // head is at that origin minus ~42 (as in drawFace)
          const headLogicalX = p.x + p.width / 2;
          const headLogicalY = p.y + p.height - 42;
          const clientX = rect.left + offsetX + headLogicalX * cover;
          const clientY = rect.top + offsetY + headLogicalY * cover;
          const dx = Math.abs(clientX - lastPlayerPosSent.current.x);
          const dy = Math.abs(clientY - lastPlayerPosSent.current.y);
          if (dx > 2 || dy > 2 || now - lastPlayerPosSent.current.t > 300) {
            window.dispatchEvent(
              new CustomEvent("player-head-pos", {
                detail: { x: clientX, y: clientY },
              }),
            );
            lastPlayerPosSent.current = { t: now, x: clientX, y: clientY };
          }
        }
      } catch (err) {
        // ignore DOM errors in non-browser contexts
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className='block w-full h-full'
    />
  );
};

export default memo(GameCanvas);
