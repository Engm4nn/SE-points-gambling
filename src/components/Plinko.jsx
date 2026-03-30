import { useState, useCallback, useRef, useEffect } from 'react';
import Matter from 'matter-js';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { getMultiplier, RISK_LEVELS, ROWS } from '../utils/plinkoLogic';
import { MIN_BET } from '../utils/constants';
import { audio } from '../utils/audio';

const RISK_OPTIONS = ['low', 'medium', 'high'];
const BET_PRESETS = [10, 100, 1000, 5000];

const CANVAS_W = 400;
const CANVAS_H = 420;
const PIN_RADIUS = 4;
const BALL_RADIUS = 7;
const BIN_COUNT = ROWS + 1;

const VOID = '#0B0B1A';
const PIN_COLOR = '#3D4466';
const BALL_COLOR = '#FBBF24';
const WALL_COLOR = '#18183A';

function getBinColor(index) {
  const dist = Math.abs(index - Math.floor(BIN_COUNT / 2));
  const maxDist = Math.floor(BIN_COUNT / 2);
  const t = dist / maxDist;
  if (t < 0.3) return '#34D399';
  if (t < 0.6) return '#FBBF24';
  return '#F43F5E';
}

export default function Plinko({ balance, setBalance, username, showToast, addHistory }) {
  const [risk, setRisk] = useState('medium');
  const [bet, setBet] = useState(10);
  const [customBet, setCustomBet] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [activeBalls, setActiveBalls] = useState(0);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const riskRef = useRef(risk);
  riskRef.current = risk;

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
      }
    }

    const wallThickness = 20;
    const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, CANVAS_H / 2, wallThickness, CANVAS_H, {
      isStatic: true, render: { fillStyle: WALL_COLOR },
    });
    const rightWall = Matter.Bodies.rectangle(CANVAS_W + wallThickness / 2, CANVAS_H / 2, wallThickness, CANVAS_H, {
      isStatic: true, render: { fillStyle: WALL_COLOR },
    });

    Matter.Composite.add(engine.world, [...pins, leftWall, rightWall]);

    // Draw bin labels
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const binWidth = CANVAS_W / BIN_COUNT;
      const binY = CANVAS_H - 30;
      const mults = RISK_LEVELS[riskRef.current] || RISK_LEVELS.medium;

      for (let i = 0; i < BIN_COUNT; i++) {
        const x = i * binWidth + binWidth / 2;
        const color = getBinColor(i);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(i * binWidth + 2, binY, binWidth - 4, 28);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(i * binWidth + 2, binY, binWidth - 4, 28);

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
  }, []); // Only init once — risk changes read from ref

  const determineBin = useCallback((ballX) => {
    const binWidth = CANVAS_W / BIN_COUNT;
    return Math.max(0, Math.min(BIN_COUNT - 1, Math.floor(ballX / binWidth)));
  }, []);

  const handleDrop = useCallback(async () => {
    if (balance < bet) return;
    await audio.ensure();

    // Deduct immediately
    const dropBet = bet;
    const dropRisk = risk;
    setBalance(prev => prev - dropBet);

    // API deduct (fire and forget with refund on error)
    deductPoints(username, dropBet).catch(() => {
      setBalance(prev => prev + dropBet);
      showToast('API error — bet refunded', 'error');
    });

    const engine = engineRef.current;
    if (!engine) return;

    // Spawn ball
    const offsetX = (Math.random() - 0.5) * 20;
    const ball = Matter.Bodies.circle(CANVAS_W / 2 + offsetX, 10, BALL_RADIUS, {
      restitution: 0.5,
      friction: 0.1,
      frictionAir: 0.02,
      density: 0.002,
      render: { fillStyle: BALL_COLOR },
      collisionFilter: {
        category: 0x0002,
        mask: 0x0001,
      },
    });

    setActiveBalls(prev => prev + 1);
    Matter.Composite.add(engine.world, ball);

    // Peg hit sounds
    const collisionHandler = (event) => {
      for (const pair of event.pairs) {
        if (pair.bodyA === ball || pair.bodyB === ball) {
          audio.plinkoHit();
        }
      }
    };
    Matter.Events.on(engine, 'collisionStart', collisionHandler);

    // Track this ball independently
    const checkInterval = setInterval(() => {
      if (ball.position.y > CANVAS_H - 40) {
        clearInterval(checkInterval);
        Matter.Events.off(engine, 'collisionStart', collisionHandler);

        const binIndex = determineBin(ball.position.x);
        const multiplier = getMultiplier(binIndex, dropRisk);
        const payout = Math.floor(dropBet * multiplier);

        setTimeout(() => {
          Matter.Composite.remove(engine.world, ball);
          setActiveBalls(prev => prev - 1);
        }, 300);

        if (payout > 0) {
          setBalance(prev => prev + payout);
          addPoints(username, payout).catch(() => {});
        }

        const net = payout - dropBet;
        setLastResult({ multiplier, payout, net, binIndex });
        reportSpin(username, dropBet, payout);
        addHistory(
          [{ emoji: `${multiplier}x` }],
          net,
          net >= 0 ? 'win' : 'loss',
          'plinko'
        );

        if (net > 0) {
          audio.plinkoWin();
        }
      }
    }, 50);
  }, [balance, bet, risk, username, setBalance, showToast, addHistory, determineBin]);

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
      <div className="pk-controls">
        <div className="pk-risk-row">
          {RISK_OPTIONS.map(r => (
            <button
              key={r}
              className={`pk-risk-btn ${risk === r ? 'pk-risk-active' : ''}`}
              onClick={() => setRisk(r)}
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
              disabled={amount > balance}
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
          />
          <div className="balance-display">
            <span className="balance-label">Bal</span>
            <span className="balance-amount">{balance.toLocaleString()}</span>
            <span className="balance-pts">pts</span>
          </div>
        </div>
      </div>

      <div className="pk-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="pk-canvas"
        />
      </div>

      {lastResult && (
        <div className={`pk-result ${lastResult.net >= 0 ? 'pk-result-win' : 'pk-result-loss'}`}>
          {lastResult.multiplier}x — {lastResult.net >= 0 ? '+' : ''}{lastResult.net.toLocaleString()} pts
        </div>
      )}

      <button
        className="spin-btn"
        onClick={handleDrop}
        disabled={balance < bet || bet < MIN_BET}
      >
        DROP {bet.toLocaleString()} {activeBalls > 0 ? `(${activeBalls} active)` : ''}
      </button>
    </div>
  );
}
