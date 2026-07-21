import { useEffect, useState } from 'react';
import { Landing } from './landing/Landing.js';
import { WebApp } from './app/WebApp.js';

/**
 * Top-level router. `/` (or `/?home`) shows the marketing landing page; `/app`
 * (or `?app`) shows the tool. Simple hash-free routing — the landing CTA links
 * to `?app`, and the tool has a "back to site" link.
 */
export function App() {
  const [route, setRoute] = useState<'home' | 'app'>(() =>
    window.location.search.includes('app') ? 'app' : 'home',
  );

  useEffect(() => {
    const onPop = () => setRoute(window.location.search.includes('app') ? 'app' : 'home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (r: 'home' | 'app') => {
    const url = r === 'app' ? `${window.location.pathname}?app` : window.location.pathname;
    window.history.pushState({}, '', url);
    setRoute(r);
    window.scrollTo(0, 0);
  };

  return route === 'app' ? <WebApp /> : <Landing onLaunch={() => go('app')} />;
}
