import { useEffect, useState } from 'react';

/** Pontos de quebra do Figma (frame "Regras de responsividade"). */
export const CELULAR = '(max-width: 767px)';
export const ATE_TABLET = '(max-width: 1023px)';

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
