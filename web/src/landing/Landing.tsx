import { Hero } from './sections/Hero.js';
import { WhatIsWebMcp } from './sections/WhatIsWebMcp.js';
import { Modules } from './sections/Modules.js';
import { HowItWorks } from './sections/HowItWorks.js';
import { GetStarted } from './sections/GetStarted.js';
import { Footer } from './sections/Footer.js';

/** The KitKat marketing landing page. */
export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="theme-dark min-h-full">
      <Hero onLaunch={onLaunch} />
      <WhatIsWebMcp />
      <Modules onLaunch={onLaunch} />
      <HowItWorks />
      <GetStarted onLaunch={onLaunch} />
      <Footer />
    </div>
  );
}
