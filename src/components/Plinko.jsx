import { useState, useCallback, useRef, useEffect } from 'react';
import Matter from 'matter-js';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { getMultiplier, RISK_LEVELS, ROWS } from '../utils/plinkoLogic';
import { MIN_BET } from '../utils/constants';
import { audio } from '../utils/audio';

const RISK_OPTIONS = ['low', 'medium', 'high'];
const BET_PRESETS = [10, 100, 1000, 5000];

// Board dimensions
const CANVAS_W = 400;
const CANVAS_H = 420;
const PIN_RADIUS = 4;
const BALL_RADIUS = 7;
const BIN_COUNT = ROWS + 1; // 9 bins for 8 rows

// Colors
const VOID = '#0B0B1A';
const PIN_COLOR = '#3D4466';
const BALL_COLOR = '#FBBF24';
const WALL_COLOR = '#18183A';

// Bin colors: red edges, yellow center
function getBinColor(index) {
  const dist = Math.abs(index - Math.floor(BIN_COUNT / 2));
  const maxDist = Math.floor(BIN_COUNT / 2);
  const t = dist / maxDist;
  // Interpolate from green (center) to red (edges)
  if (t < 0.3) return '#34D399';
  if (t < 0.6) return '#FBBF24';
  return '#F43F5E';
}

export default function Plinko({ balance, setBalance, username, showToast, addHistory }) {
  const [risk, setRisk] = useState('medium');
  const [bet, setBet] = useState(10);
  const [customBet, setCustomBet] = useState('');
  const [dropping, setDropping] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const pinsLastRowX = useRef([]);
  const activeBalls = useRef(0);

  // Initialize Matter.js engine and renderer
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.2 },
    });
    engineRef.current = engine;

    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: CANVAS_W,
        height: CANVAS_H,
        wireframes: false,
        background: VOID,
        pixelRatio: window.devicePixelRatio || 1,
      },
    });
    renderRef.current = render;

    // Create pins
    const pins = [];
    const pinSpacingX = CANVAS_W / (ROWS + 2);
    const pinSpacingY = (CANVAS_H - 80) / (ROWS + 1);
    const startY = 40;

    for (let row = 0; row < ROWS; row++) {
      const pinCount = 3 + row;
      const rowWidth = (pinCount - 1) * pinSpacingX;
      const offsetX = (CANVAS_W - rowWidth) / 2;
      const y = startY + (row + 1) * pinSpacingY;

      for (let col = 0; col < pinCount; col++) {
        const x = offsetX + col * pinSpacingX;
        const pin = Matter.Bodies.circle(x, y, PIN_RADIUS, {
          isStatic: true,
          render: { fillStyle: PIN_COLOR },
          restitution: 0.5,
          friction: 0.1,
          collisionFilter: { category: 0x0001 },
        });
        pins.push(pin);

        // Track last row x positions for bin detection
        if (row === ROWS - 1) {
          pinsLastRowX.current.push(x);
        }
      }
    }

    // Walls (angled to guide balls)
    const wallThickness = 20;
    const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, CANVAS_H / 2, wallThickness, CANVAS_H, {
      isStatic: true,
      render: { fillStyle: WALL_COLOR },
    });
    const rightWall = Matter.Bodies.rectangle(CANVAS_W + wallThickness / 2, CANVAS_H / 2, wallThickness, CANVAS_H, {
      isStatic: true,
      render: { fillStyle: WALL_COLOR },
    });

    // Bottom sensor to detect ball landing
    const bottomSensor = Matter.Bodies.rectangle(CANVAS_W / 2, CANVAS_H + 10, CANVAS_W, 20, {
      isStatic: true,
      isSensor: true,
      render: { visible: false },
      label: 'bottomSensor',
    });

    Matter.Composite.add(engine.world, [...pins, leftWall, rightWall, bottomSensor]);

    // Draw bin labels on canvas after each render
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const binWidth = CANVAS_W / BIN_COUNT;
      const binY = CANVAS_H - 30;

      for (let i = 0; i < BIN_COUNT; i++) {
        const x = i * binWidth + binWidth / 2;
        const color = getBinColor(i);

        // Bin background
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(i * binWidth + 2, binY, binWidth - 4, 28);
        ctx.globalAlpha = 1;

        // Bin border
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(i * binWidth + 2, binY, binWidth - 4, 28);

        // Multiplier text
        const mults = RISK_LEVELS[risk] || RISK_LEVELS.medium;
        ctx.fillStyle = color;
        ctx.font = 'bold 10px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mults[i]}x`, x, binY + 14);
      }
    });

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
    };
  }, [risk]);

  const determineBin = useCallback((ballX) => {
    const binWidth = CANVAS_W / BIN_COUNT;
    let bin = Math.floor(ballX / binWidth);
    bin = Math.max(0, Math.min(BIN_COUNT - 1, bin));
    return bin;
  }, []);

  const handleDrop = useCallback(async () => {
    if (dropping || balance < bet) return;
    await audio.ensure();

    setDropping(true);
    setLastResult(null);
    setBalance(prev => prev - bet);

    try {
      await deductPoints(username, bet);
    } catch {
      setBalance(prev => prev + bet);
      setDropping(false);
      showToast('API error — bet refunded', 'error');
      return;
    }

    const engine = engineRef.current;
    if (!engine) { setDropping(false); return; }

    // Create ball with slight random offset
    const offsetX = (Math.random() - 0.5) * 20;
    const ball = Matter.Bodies.circle(CANVAS_W / 2 + offsetX, 10, BALL_RADIUS, {
      restitution: 0.5,
      friction: 0.1,
      frictionAir: 0.02,
      density: 0.002,
      render: { fillStyle: BALL_COLOR },
      collisionFilter: {
        category: 0x0002,
        mask: 0x0001, // Only collide with pins, not other balls
      },
    });

    activeBalls.current += 1;
    Matter.Composite.add(engine.world, ball);

    // Collision sound on pin hits
    const collisionHandler = (event) => {
      for (const pair of event.pairs) {
        if (pair.bodyA === ball || pair.bodyB === ball) {
          audio.plinkoHit();
        }
      }
    };
    Matter.Events.on(engine, 'collisionStart', collisionHandler);

    // Check when ball reaches bottom
    const checkInterval = setInterval(() => {
      if (ball.position.y > CANVAS_H - 40) {
        clearInterval(checkInterval);
        Matter.Events.off(engine, 'collisionStart', collisionHandler);

        const binIndex = determineBin(ball.position.x);
        const multiplier = getMultiplier(binIndex, risk);
        const payout = Math.floor(bet * multiplier);

        // Remove ball after short delay
        setTimeout(() => {
          Matter.Composite.remove(engine.world, ball);
          activeBalls.current -= 1;
        }, 500);

        // Process result
        if (payout > 0) {
          setBalance(prev => prev + payout);
          addPoints(username, payout).catch(() => {});
        }

        const net = payout - bet;
        setLastResult({ multiplier, payout, net, binIndex });
        reportSpin(username, bet, payout);
        addHistory(
          [{ emoji: `${multiplier}x` }],
          net,
          net >= 0 ? 'win' : 'loss',
          'plinko'
        );

        if (net > 0) {
          audio.plinkoWin();
          showToast(`${multiplier}x — +${net.toLocaleString()} pts`, 'win');
        } else if (net < 0) {
          showToast(`${multiplier}x — ${net.toLocaleString()} pts`, 'error');
        }

        setDropping(false);
      }
    }, 50);
  }, [dropping, balance, bet, username, risk, setBalance, showToast, addHistory, determineBin]);

  const handleCustomBet = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBet(val);
    const num = parseInt(val, 10);
    if (num >= MIN_BET) setBet(num);
  };

  const handlePreset = (amount) => {
    setBet(amount);
    setCustomBet('');
  };

  return (
    <div className="plinko-game">
      {/* Risk selector */}
      <div className="pk-controls">
        <div className="pk-risk-row">
          {RISK_OPTIONS.map(r => (
            <button
              key={r}
              className={`pk-risk-btn ${risk === r ? 'pk-risk-active' : ''}`}
              onClick={() => setRisk(r)}
              disabled={dropping}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <div className="pk-bet-row">
          {BET_PRESETS.map(amount => (
            <button
              key={amount}
              className={`bet-btn ${bet === amount && !customBet ? 'active' : ''}`}
              onClick={() => handlePreset(amount)}
              disabled={dropping || amount > balance}
            >
              {amount.toLocaleString()}
            </button>
          ))}
        </div>

        <div className="pk-bet-row">
          <input
            type="text"
            inputMode="numeric"
            className="bet-custom-input"
            placeholder={bet.toLocaleString()}
            value={customBet}
            onChange={handleCustomBet}
            disabled={dropping}
          />
          <div className="balance-display">
            <span className="balance-label">Bal</span>
            <span className="balance-amount">{balance.toLocaleString()}</span>
            <span className="balance-pts">pts</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="pk-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="pk-canvas"
        />
      </div>

      {/* Result */}
      {lastResult && (
        <div className={`pk-result ${lastResult.net >= 0 ? 'pk-result-win' : 'pk-result-loss'}`}>
          {lastResult.multiplier}x — {lastResult.net >= 0 ? '+' : ''}{lastResult.net.toLocaleString()} pts
        </div>
      )}

      {/* Drop button */}
      <button
        className="spin-btn"
        onClick={handleDrop}
        disabled={dropping || balance < bet || bet < MIN_BET}
      >
        {dropping ? <span className="spinner" /> : `DROP ${bet.toLocaleString()}`}
      </button>
    </div>
  );
}
