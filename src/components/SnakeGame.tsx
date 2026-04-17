import React, { useState, useEffect, useRef, useCallback } from 'react';

// 定義方向
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Point {
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const CANVAS_SIZE = 300;

const initialSnake: Point[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

export default function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(initialSnake);
  const [direction, setDirection] = useState<Direction>('UP');
  const directionQueue = useRef<Direction[]>([]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(
    parseInt(localStorage.getItem('snake_score') || '0', 10)
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  const moveSnake = useCallback(() => {
    if (gameOver || isPaused) return;

    setSnake((prev) => {
      let currentDir = direction;
      if (directionQueue.current.length > 0) {
        currentDir = directionQueue.current.shift()!;
        setDirection(currentDir);
      }

      const head = { ...prev[0] };

      switch (currentDir) {
        case 'UP':
          head.y -= 1;
          break;
        case 'DOWN':
          head.y += 1;
          break;
        case 'LEFT':
          head.x -= 1;
          break;
        case 'RIGHT':
          head.x += 1;
          break;
      }

      // 撞牆判定
      if (
        head.x < 0 ||
        head.x >= CANVAS_SIZE / GRID_SIZE ||
        head.y < 0 ||
        head.y >= CANVAS_SIZE / GRID_SIZE
      ) {
        setGameOver(true);
        setIsPaused(true);
        return prev;
      }

      // 撞自己判定
      if (prev.some((segment) => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setIsPaused(true);
        return prev;
      }

      const newSnake = [head, ...prev];

      // 吃到食物判定
      if (head.x === food.x && head.y === food.y) {
        setScore((s) => {
          const newScore = s + 10;
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('snake_score', newScore.toString());
          }
          return newScore;
        });
        setFood({
          x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
          y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
        });
      } else {
        newSnake.pop(); // 沒吃到食物就把尾巴切掉
      }

      return newSnake;
    });
  }, [direction, food, gameOver, isPaused, highScore]);

  // 控制遊戲 FPS
  useEffect(() => {
    const handle = setInterval(moveSnake, 150);
    return () => clearInterval(handle);
  }, [moveSnake]);

  // 按鍵監聽 (只在焦點位於遊戲區時生效，避免干擾打字)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (gameOver || isPaused) return;
    
    // 阻止遊戲鍵位捲動整個畫面
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }

    // 使用鍵盤輸入佇列，解決快速連按造成的致命反向或撞牆 BUG
    const lastDir = directionQueue.current.length > 0 
      ? directionQueue.current[directionQueue.current.length - 1] 
      : direction;

    switch (e.key) {
      case 'ArrowUp':
        if (lastDir !== 'DOWN' && lastDir !== 'UP') directionQueue.current.push('UP');
        break;
      case 'ArrowDown':
        if (lastDir !== 'UP' && lastDir !== 'DOWN') directionQueue.current.push('DOWN');
        break;
      case 'ArrowLeft':
        if (lastDir !== 'RIGHT' && lastDir !== 'LEFT') directionQueue.current.push('LEFT');
        break;
      case 'ArrowRight':
        if (lastDir !== 'LEFT' && lastDir !== 'RIGHT') directionQueue.current.push('RIGHT');
        break;
    }
  };

  const resetGame = () => {
    setSnake(initialSnake);
    setDirection('UP');
    directionQueue.current = [];
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setFood({
      x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
      y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
    });
    // 強制聚焦讓鍵盤立刻生效
    if (gameAreaRef.current) {
      gameAreaRef.current.focus();
    }
  };

  // 渲染畫布 (加入 Retina 螢幕防模糊的 DPI 放大技術)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    
    // 設定高解析度畫布真實大小
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;

    // 歸一化座標系
    ctx.scale(dpr, dpr);

    // 清空背景 (毛玻璃透明系)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 畫食物 (Accent 金色)
    ctx.fillStyle = '#ffb86c';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffb86c';
    ctx.beginPath();
    ctx.arc(
      food.x * GRID_SIZE + GRID_SIZE / 2,
      food.y * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // 畫蛇 (Primary / Secondary 漸層色感覺)
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#ff79c6' : '#bd93f9'; // 蛇頭顏色略不同
      ctx.shadowBlur = index === 0 ? 15 : 5;
      ctx.shadowColor = '#bd93f9';
      ctx.fillRect(
        segment.x * GRID_SIZE + 1,
        segment.y * GRID_SIZE + 1,
        GRID_SIZE - 2,
        GRID_SIZE - 2
      );
    });
    
    // 重設 shadow 以免干擾其他繪圖
    ctx.shadowBlur = 0;
  }, [snake, food]);

  return (
    <div 
      className="card w-80 h-[88vh] glass-panel shadow-2xl flex-col overflow-hidden animate-scale-up rounded-[2.5rem] focus:outline-none focus:ring-2 focus:ring-secondary/50 group"
      tabIndex={0}
      ref={gameAreaRef}
      onKeyDown={handleKeyDown}
      onClick={() => { if (!gameOver && isPaused && score === 0) resetGame(); }}
    >
      <div className="glass-header text-neutral p-4 font-bold text-lg text-center flex justify-between items-center">
        <span>🐍</span>
        <span className="text-secondary tracking-widest">SNAKE OS</span>
        <span>🍏</span>
      </div>

      <div className="flex flex-col items-center justify-center p-4 h-full relative">
        <div className="w-full flex justify-between px-2 mb-2 font-mono text-sm opacity-70">
          <span>SCORE: <strong className="text-secondary">{score}</strong></span>
          <span>BEST: <strong className="text-primary">{highScore}</strong></span>
        </div>

        <div className="relative rounded-2xl overflow-hidden border-2 border-white/30 shadow-inner bg-white/10 group-focus:border-secondary/60 transition-colors">
          <canvas
            ref={canvasRef}
            className="block"
          />

          {isPaused && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 transition-opacity">
              {gameOver ? (
                <>
                  <h2 className="text-3xl font-black text-error mb-2 drop-shadow-md">GAME OVER</h2>
                  <p className="text-sm opacity-80 mb-6 text-white font-mono">Final Score: {score}</p>
                </>
              ) : (
                <h2 className="text-xl font-bold text-white mb-6 drop-shadow-md tracking-wider">READY TO PLAY?</h2>
              )}
              
              <button 
                className="btn btn-secondary rounded-xl px-8 shadow-lg font-bold border-none hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  resetGame();
                }}
              >
                {gameOver ? 'TRY AGAIN 🔄' : 'START 🚀'}
              </button>
            </div>
          )}
        </div>
        
        <p className="mt-4 text-[10px] text-center opacity-40 leading-relaxed font-mono">
          Click the game area to focus.<br/>
          Use <strong className="text-secondary">Arrow Keys</strong> to move.<br/>
          Focus input box to chat.
        </p>
      </div>
    </div>
  );
}
