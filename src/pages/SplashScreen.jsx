import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SPLASH_KEY = 'primecafe_splash_shown';

export default function SplashScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    const intendedPath = sessionStorage.getItem('primecafe_intended_path');

    if (alreadyShown) {
      const target =
        intendedPath && intendedPath !== '/'
          ? intendedPath
          : location.state?.from || '/admin/login';
      sessionStorage.removeItem('primecafe_intended_path');
      navigate(target, { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      sessionStorage.setItem(SPLASH_KEY, 'true');
      setVisible(false);

      const target =
        intendedPath && intendedPath !== '/'
          ? intendedPath
          : location.state?.from || '/admin/login';
      sessionStorage.removeItem('primecafe_intended_path');
      navigate(target, { replace: true });
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate, location]);

  if (!visible && sessionStorage.getItem(SPLASH_KEY)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600">
      <div className="animate-pulse-ring flex flex-col items-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <span className="text-5xl">☕</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg md:text-5xl">
          PrimeCafe
        </h1>
        <p className="mt-3 text-lg text-amber-100">Order. Enjoy. Repeat.</p>
      </div>

      <div className="absolute bottom-16 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-white/80"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
