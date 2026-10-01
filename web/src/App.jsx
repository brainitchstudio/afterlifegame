// Afterlife web host: the Pixi world (port of WorldView) under the React HUD (port of GameHud),
// driven by the AfterlifeGame host around the original simulation, with routing to /survivorlab.
import { useEffect, useRef, useState } from 'react';
import { AfterlifeGame } from './host/afterlifeGame.js';
import { Hud } from './hud/Hud.jsx';
import { SurvivorLab } from './components/SurvivorLab.jsx';

// One game per page: React StrictMode mounts effects twice in development.
let instance = null;
let started = false;

export default function App() {
  const worldRef = useRef(null);
  const [route, setRoute] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (path.includes('survivorlab') || hash.includes('survivorlab')) ? 'lab' : 'game';
  });

  const [game] = useState(() => (instance ??= new AfterlifeGame()));

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      setRoute((path.includes('survivorlab') || hash.includes('survivorlab')) ? 'lab' : 'game');
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (target) => {
    if (target === 'lab') {
      window.history.pushState({}, '', '/survivorlab');
      setRoute('lab');
    } else {
      window.history.pushState({}, '', '/');
      setRoute('game');
    }
  };

  useEffect(() => {
    if (route === 'game' && !started && worldRef.current) {
      started = true;
      globalThis.afterlife = game; // Handy for debugging from the console.
      game.start(worldRef.current);
    }
  }, [route, game]);

  if (route === 'lab') {
    return <SurvivorLab onNavigateToGame={() => navigateTo('game')} />;
  }

  return (
    <div id="app-container">
      <div id="world" ref={worldRef} />
      {game && <Hud game={game} />}
      <button
        className="survivor-lab-hud-launcher"
        onClick={() => navigateTo('lab')}
        title="Open Procedural Survivor Lab"
      >
        🔬 SURVIVOR LAB
      </button>
    </div>
  );
}

