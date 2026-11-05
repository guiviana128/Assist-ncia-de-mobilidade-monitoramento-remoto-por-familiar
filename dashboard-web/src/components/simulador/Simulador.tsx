import React, { useState } from 'react';
import { Battery, Bot, Camera, Check, Footprints, LocateFixed, Phone, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Alert } from '../../types';
import type { HouseLayout } from '../../types/robot';
import { api } from '../../services/api';
import { robotApi } from '../../services/robotApi';
import { useCuidado } from '../../lib/cuidado';

interface SimuladorProps {
  layout: HouseLayout;
  demo: boolean;
  onAtualizar: () => void;
  onSairDemo: () => void;
}

interface Evento {
  id: string;
  titulo: string;
  detalhe: string;
  Icone: LucideIcon;
  tom: 'perigo' | 'aviso' | 'sucesso' | 'neutro';
  disparar: (comodo: string) => Promise<void>;
}

type Posicao = 'casa' | 'praca' | 'fora';

/** Simulador da apresentação (Figma 30:1800 e 36:2990): painel lateral no computador, folha inferior no celular. */
export const Simulador: React.FC<SimuladorProps> = ({ layout, demo, onAtualizar, onSairDemo }) => {
  const { areas } = useCuidado();
  const [comodo, setComodo] = useState(layout.rooms.find(r => r.id === 'sala')?.id ?? layout.rooms[0]?.id ?? 'sala');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [posicao, setPosicao] = useState<Posicao | 'minha' | null>(null);
  const [roboFora, setRoboFora] = useState(() => demo && !robotApi.demo().isOnline());

  const avisar = (texto: string, erro = false) => {
    setFeedback({ texto, erro });
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const alerta = (tipo: Alert['alertType'], msg: string) => (room: string) => api.sendSimulatedAlert(tipo, `Teste: ${msg}`, room);

  const eventosBengala: Evento[] = [
    { id: 'queda', titulo: 'Queda', detalhe: 'Acelerômetro detecta impacto forte', Icone: TriangleAlert, tom: 'perigo', disparar: alerta('FALL_DETECTED', 'queda detectada pelo acelerômetro da bengala') },
    { id: 'sos', titulo: 'Botão SOS', detalhe: 'José aperta o botão de socorro', Icone: Phone, tom: 'perigo', disparar: alerta('SOS_BUTTON', 'botão de socorro apertado na bengala') },
    {
      id: 'obstaculo', titulo: 'Obstáculo a 40 cm', detalhe: 'A bengala vibra e apita', Icone: TriangleAlert, tom: 'aviso',
      disparar: async room => {
        await api.sendSimulatedTelemetry({ obstacleDistanceCm: 40, obstacleDetected: true, indoorRoom: room });
        await api.sendSimulatedAlert('OBSTACLE_COLLISION', 'Teste: obstáculo a 40 cm à frente da bengala', room);
      }
    },
    { id: 'degrau', titulo: 'Degrau na calçada', detalhe: 'Desnível de 35 cm à frente', Icone: Footprints, tom: 'aviso', disparar: alerta('POTHOLE_HOLE_DETECTED', 'desnível de 35 cm detectado pelo sensor do chão') },
    { id: 'checkin', titulo: 'Check-in seguro', detalhe: '"Cheguei bem na praça"', Icone: Check, tom: 'sucesso', disparar: alerta('CHECKIN_SAFE', 'check-in "Cheguei bem na praça"') },
    {
      id: 'bateria', titulo: 'Bateria fraca', detalhe: 'Cai para 15%', Icone: Battery, tom: 'neutro',
      disparar: async room => {
        await api.sendSimulatedTelemetry({ batteryPercent: 15, indoorRoom: room });
        await api.sendSimulatedAlert('LOW_BATTERY', 'Teste: bateria da bengala em 15%', room);
      }
    }
  ];

  const disparar = async (e: Evento) => {
    setOcupado(e.id);
    try {
      await e.disparar(comodo);
      avisar(`Evento de teste enviado: ${e.titulo.toLowerCase()}.`);
      onAtualizar();
    } catch {
      avisar('A API recusou o evento de teste.', true);
    } finally {
      setOcupado(null);
    }
  };

  const gesto = async () => {
    setOcupado('gesto');
    try {
      await api.sendSimulatedAlert('HAND_GESTURE_SOS', 'Teste: os 3 passos do sinal com a mão foram vistos', comodo);
      avisar('Gesto de socorro simulado. Veja na Câmera e SOS.');
      onAtualizar();
    } catch {
      avisar('A API recusou o evento de teste.', true);
    } finally {
      setOcupado(null);
    }
  };

  const alternarRobo = () => {
    const desligar = !roboFora;
    robotApi.demo().setOnline(!desligar);
    setRoboFora(desligar);
    avisar(desligar ? 'Robô fora do ar. Os comandos ficam na fila.' : 'Robô de volta. Ele cumpre o último comando da fila.');
  };

  // Posição de teste do GPS
  const casa = areas[0]!;
  const praca = areas.find(a => a.id === 'praca') ?? casa;
  const POSICOES: Record<Posicao, { rotulo: string; lat: number; lng: number; room?: string }> = {
    casa: { rotulo: 'Em casa', lat: casa.lat, lng: casa.lng, room: comodo },
    praca: { rotulo: 'Na praça', lat: praca.lat, lng: praca.lng },
    fora: { rotulo: 'Fora da área', lat: casa.lat + (casa.raio + 400) / 111_000, lng: casa.lng + 0.002 }
  };

  const moverPara = async (lat: number, lng: number, room?: string) => {
    await api.sendSimulatedTelemetry({ latitude: lat, longitude: lng, speedKmh: 3.2, indoorRoom: room });
    onAtualizar();
  };

  const escolherPosicao = async (p: Posicao) => {
    setPosicao(p);
    try {
      await moverPara(POSICOES[p].lat, POSICOES[p].lng, POSICOES[p].room);
      if (p === 'fora') await api.sendSimulatedAlert('GEOFENCE_EXIT', `Teste: José saiu do perímetro de ${casa.raio} m`);
      avisar(`Posição de teste: ${POSICOES[p].rotulo.toLowerCase()}.`);
    } catch {
      avisar('A API recusou a posição de teste.', true);
    }
  };

  const minhaLocalizacao = () => {
    if (!navigator.geolocation) { avisar('Este navegador não informa a localização.', true); return; }
    setOcupado('gps');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setPosicao('minha');
        try {
          await moverPara(pos.coords.latitude, pos.coords.longitude);
          avisar('A bengala de teste foi para a sua localização.');
        } catch { avisar('A API recusou a posição de teste.', true); }
        setOcupado(null);
      },
      () => { avisar('Permita a localização no navegador para usar esta opção.', true); setOcupado(null); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const linha = (e: { id: string; titulo: string; detalhe: string; Icone: LucideIcon; tom: string }, acao: React.ReactNode) => (
    <li key={e.id} className="sim-evento">
      <span className={`sim-icone is-${e.tom}`} aria-hidden="true"><e.Icone size={18} /></span>
      <span className="sim-textos"><strong>{e.titulo}</strong><span>{e.detalhe}</span></span>
      {acao}
    </li>
  );

  return (
    <div className="simulador">
      <p className="simulador-intro texto-secundario">Cria eventos de teste para mostrar o Amparo funcionando. Nada aqui chega ao celular da família.</p>

      {feedback && <p className={`nota ${feedback.erro ? 'is-perigo' : 'is-sucesso'} simulador-feedback`} role="status">{feedback.texto}</p>}

      <section className="sim-secao" aria-labelledby="sim-bengala">
        <h3 id="sim-bengala" className="sim-titulo">Bengala</h3>
        <div className="sim-comodo">
          <span className="texto-pequeno">José está em</span>
          <div className="fila-rolavel" role="group" aria-label="Cômodo do José">
            {layout.rooms.map(r => (
              <button key={r.id} className={`chip${comodo === r.id ? ' is-ativo' : ''}`} aria-pressed={comodo === r.id} onClick={() => setComodo(r.id)}>
                {r.id === 'sala' ? 'Sala' : r.name}
              </button>
            ))}
          </div>
        </div>
        <ul>
          {eventosBengala.map(e => linha(e, (
            <button className="btn btn-secundario sim-botao" onClick={() => void disparar(e)} disabled={!!ocupado}>
              {ocupado === e.id ? <span className="carregando" aria-hidden="true" /> : 'Simular'}
            </button>
          )))}
        </ul>
      </section>

      <section className="sim-secao" aria-labelledby="sim-camera">
        <h3 id="sim-camera" className="sim-titulo">Câmera e robô</h3>
        <ul>
          {linha({ id: 'gesto', titulo: 'Gesto de socorro', detalhe: 'Os 3 passos do sinal com a mão', Icone: Camera, tom: 'perigo' }, (
            <button className="btn btn-secundario sim-botao" onClick={() => void gesto()} disabled={!!ocupado}>
              {ocupado === 'gesto' ? <span className="carregando" aria-hidden="true" /> : 'Simular'}
            </button>
          ))}
          {linha({ id: 'robo', titulo: 'Robô fora do ar', detalhe: demo ? 'Mostra o painel sem conexão' : 'Só no modo demonstração', Icone: Bot, tom: 'acento' }, (
            <button className="btn btn-secundario sim-botao" onClick={alternarRobo} disabled={!demo} aria-pressed={roboFora}>
              {roboFora ? 'Religar' : 'Desligar'}
            </button>
          ))}
        </ul>
      </section>

      <section className="sim-secao" aria-labelledby="sim-gps">
        <h3 id="sim-gps" className="sim-titulo">Posição de teste (GPS)</h3>
        <div className="segmento sim-posicoes" role="group" aria-label="Posição de teste">
          {(Object.keys(POSICOES) as Posicao[]).map(p => (
            <button key={p} aria-pressed={posicao === p} className={posicao === p ? 'is-ativo' : ''} onClick={() => void escolherPosicao(p)}>{POSICOES[p].rotulo}</button>
          ))}
        </div>
        <button className="btn btn-secundario" onClick={minhaLocalizacao} disabled={ocupado === 'gps'} aria-pressed={posicao === 'minha'}>
          {ocupado === 'gps' ? <span className="carregando" aria-hidden="true" /> : <LocateFixed size={18} aria-hidden="true" />}Usar minha localização
        </button>
      </section>

      {demo && (
        <div className="simulador-rodape">
          <button className="btn btn-perigo-suave btn-bloco" onClick={onSairDemo}>Sair do modo demonstração</button>
          <p className="texto-pequeno">Os eventos simulados ficam marcados como "Teste" no histórico.</p>
        </div>
      )}
    </div>
  );
};
