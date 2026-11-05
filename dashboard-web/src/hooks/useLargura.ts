import { useEffect, useRef, useState } from 'react';

/** Largura atual de um elemento (para desenhar gráficos SVG em pixels reais). */
export function useLargura<T extends HTMLElement>(inicial = 600) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setLargura(Math.max(200, Math.floor(entrada!.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura] as const;
}
