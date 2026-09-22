import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SPLASH_KEY = 'primecafe_splash_shown';

export default function SplashGate({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const shown = sessionStorage.getItem(SPLASH_KEY);
    if (!shown && location.pathname !== '/') {
      sessionStorage.setItem('primecafe_intended_path', location.pathname + location.search);
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  if (!sessionStorage.getItem(SPLASH_KEY) && location.pathname !== '/') {
    return null;
  }

  return children;
}

export function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

export function useDocumentTitleBadge(count) {
  useEffect(() => {
    const base = 'PrimeCafe Admin';
    document.title = count > 0 ? `(${count}) ${base}` : base;
    return () => {
      document.title = 'PrimeCafe';
    };
  }, [count]);
}
