import React, { useEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { HouseScene } from '../house3d/HouseScene';
import { robotApi } from '../../services/robotApi';
import type { HouseLayout } from '../../types/robot';

/**
 * Fonte "Robô" da Câmera e SOS: a vista da câmera frontal do robô no gêmeo digital (HouseScene).
 * Ainda não existe stream de vídeo real do robô; o reconhecimento de gesto usa a câmera do notebook.
 */
export const OlhosDoRobo: React.FC<{ layout: HouseLayout; pessoa: string; emergencia: boolean }> = ({ layout, pessoa, emergencia }) => {
  const casa = useRef<HTMLDivElement>(null);
  const olhos = useRef<HTMLDivElement>(null);
  const cena = useRef<HouseScene | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!casa.current || !olhos.current) return;
    try {
      const scene = new HouseScene({ container: casa.current, eyesContainer: olhos.current, layout, dark: false, onFloorClick: () => undefined, onARChange: () => undefined });
      cena.current = scene;
      return () => { scene.dispose(); cena.current = null; };
    } catch {
      setErro(true);
      return undefined;
    }
  }, [layout]);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      try {
        const estado = await robotApi.getState();
        if (!ativo || !cena.current) return;
        cena.current.setRobot(estado);
        cena.current.setPerson({ roomId: estado.personRoom ?? null, emergency: emergencia, fallen: false, name: pessoa });
      } catch { /* tenta de novo no próximo ciclo */ }
    };
    void atualizar();
    const t = window.setInterval(() => void atualizar(), 1000);
    return () => { ativo = false; window.clearInterval(t); };
  }, [pessoa, emergencia]);

  return (
    <div className="olhos-robo">
      {/* a cena precisa de um contêiner principal; aqui ele fica escondido e só os olhos aparecem */}
      <div ref={casa} className="olhos-robo-casa" aria-hidden="true" />
      <div ref={olhos} className="olhos-robo-video" role="img" aria-label="Câmera frontal do robô (simulação)" />
      {erro && (
        <div className="camera-desligada">
          <span className="camera-desligada-icone" aria-hidden="true"><Bot size={22} /></span>
          <h2>A vista do robô não abriu neste aparelho</h2>
          <p>O navegador não liberou o WebGL. Use a câmera do notebook.</p>
        </div>
      )}
    </div>
  );
};
