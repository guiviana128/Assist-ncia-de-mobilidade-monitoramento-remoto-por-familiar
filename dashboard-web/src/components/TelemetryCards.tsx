import React from 'react';
import { Battery, Navigation, Eye, Bell } from 'lucide-react';
import { DeviceStatus } from '../types';
export const TelemetryCards: React.FC<{ device?: DeviceStatus }> = ({ device }) => {
  const battery = device?.batteryPercent;
  const distance = device?.lastDistanceCm;
  const coordinates = device && Number.isFinite(device.currentLatitude) && Number.isFinite(device.currentLongitude);
  return <section className="metrics-grid" aria-label="Resumo da bengala">
    <article className="glass-panel metric-card"><div className="metric-label">Bateria <Battery size={21} /></div><strong className="metric-value">{battery == null ? '—' : battery.toFixed(0) + '%'}</strong><p className="muted">{battery == null ? 'Sem leitura disponível' : battery <= 20 ? 'Conecte o carregador assim que possível' : 'Última carga informada pelo dispositivo'}</p><progress max={100} value={battery ?? 0} aria-label="Carga da bateria" /></article>
    <article className="glass-panel metric-card"><div className="metric-label">Obstáculo mais próximo <Eye size={21} /></div><strong className="metric-value">{distance == null ? '—' : distance.toFixed(0) + ' cm'}</strong><p className="muted">{distance == null ? 'Sem leitura disponível' : device?.obstacleAlert ? 'Obstáculo detectado pelo dispositivo' : 'Última distância informada'}</p></article>
    <article className="glass-panel metric-card"><div className="metric-label">Comunicação <Bell size={21} /></div><strong className="metric-value">{device ? device.isOnline ? 'Online' : 'Offline' : '—'}</strong><p className="muted">Status informado na última consulta</p></article>
    <article className="glass-panel metric-card"><div className="metric-label">Localização recebida <Navigation size={21} /></div><strong className="metric-value coordinate-value">{coordinates ? device!.currentLatitude.toFixed(4) + ', ' + device!.currentLongitude.toFixed(4) : '—'}</strong><p className="muted">Coordenadas da última telemetria</p></article>
  </section>;
};

