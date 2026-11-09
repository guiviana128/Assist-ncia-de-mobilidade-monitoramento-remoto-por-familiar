import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { DUR, EASE_MOTION } from './motion/tokens';
import './motion/gsap';
import './index.css';

// Preferência de uma versão antiga que tinha seletor de tema: o app agora é sempre claro.
try {
  localStorage.removeItem('assistmob_theme');
} catch {
  /* sem armazenamento: nada a apagar */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* reducedMotion="user": com prefers-reduced-motion, o Motion não anima transform (só opacidade e cor) */}
    <MotionConfig reducedMotion="user" transition={{ duration: DUR.curta, ease: EASE_MOTION }}>
      <App />
    </MotionConfig>
  </React.StrictMode>
);
