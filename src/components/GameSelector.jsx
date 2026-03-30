import { Disc3, Layers, Circle, Bomb } from 'lucide-react';

const GAMES = [
  { id: 'slots', label: 'Slots', icon: Disc3 },
  { id: 'blackjack', label: 'Blackjack', icon: Layers },
  { id: 'roulette', label: 'Roulette', icon: Circle },
  { id: 'mines', label: 'Mines', icon: Bomb },
];

export default function GameSelector({ activeGame, onSelectGame }) {
  return (
    <div className="game-selector">
      {GAMES.map(g => {
        const Icon = g.icon;
        return (
          <button
            key={g.id}
            className={`game-selector-btn ${activeGame === g.id ? 'game-active' : ''}`}
            onClick={() => onSelectGame(g.id)}
            title={g.label}
          >
            <Icon size={14} />
            <span className="game-selector-label">{g.label}</span>
          </button>
        );
      })}
    </div>
  );
}
