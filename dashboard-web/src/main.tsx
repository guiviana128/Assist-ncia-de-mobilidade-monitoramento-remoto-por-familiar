import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { DUR, EASE_MOTION } from './motion/tokens';
import './motion/gsap';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* reducedMotion="user": com prefers-reduced-motion, o Motion não anima transform (só opacidade e cor) */}
    <MotionConfig reducedMotion="user" transition={{ duration: DUR.curta, ease: EASE_MOTION }}>
      <App />
    </MotionConfig>
  </React.StrictMode>
);
