import React, { useCallback, useEffect, useState } from 'react';
import { Ban, CircleAlert, History, RefreshCw } from 'lucide-react';
import { visionApi } from '../services/visionApi';
import type { VisionEventHistoryItem } from '../services/visionApi';

interface VisionEventHistoryProps {
  deviceId: string;
}

const statusLabel: Record<VisionEventHistoryItem['reviewStatus'], string> = {
  PENDING: 'Aguardando revisão',
  FALSE_POSITIVE: 'Falso positivo',
  CANCELED: 'Cancelado'
};

export const VisionEventHistory: React.FC<VisionEventHistoryProps> = ({ deviceId }) => {
  const [events, setEvents] = useState<VisionEventHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyEvent, setBusyEvent] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await visionApi.getEventHistory(deviceId));
      setError('');
    } catch {
      setError('Não foi possível carregar o histórico de eventos.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const review = async (eventId: string, decision: 'FALSE_POSITIVE' | 'CANCELED') => {
    setBusyEvent(eventId);
    try {
      await visionApi.reviewEvent(eventId, decision);
      await refresh();
    } catch {
      setError('Não foi possível atualizar esta detecção. Tente novamente.');
    } finally {
      setBusyEvent(null);
    }
  };

  return (
    <section className="glass-panel" aria-labelledby="vision-event-history-title"
      style={{ marginTop: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={20} aria-hidden="true" />
          <div>
            <h3 id="vision-event-history-title" style={{ margin: 0 }}>Histórico do Signal for Help</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>Detecções e decisões do familiar; imagens não são guardadas.</p>
          </div>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {error && <p className="feedback-error" role="alert">{error}</p>}
      {loading ? <p className="muted" aria-busy="true">Carregando eventos…</p> :
        events.length === 0 ? <p className="muted">Nenhuma detecção registrada para este dispositivo.</p> :
          <div style={{ display: 'grid', gap: 10 }}>
            {events.map(event => (
              <article key={event.eventId} style={{
                padding: 14, borderRadius: 10, background: 'var(--bg-app)',
                border: '1px solid var(--border-color)', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap'
              }}>
                <div>
                  <strong>{statusLabel[event.reviewStatus]}</strong>
                  <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {new Date(event.capturedAt).toLocaleString('pt-BR')} · confiança {Math.round(event.confidence * 100)}%
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    Fase: {event.phase} · Ação supervisionada {event.agentActionId ? `#${event.agentActionId}` : 'não vinculada'}
                    {event.reviewedAt ? ` · revisado em ${new Date(event.reviewedAt).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
                {event.reviewStatus === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" type="button"
                      disabled={busyEvent === event.eventId}
                      onClick={() => void review(event.eventId, 'FALSE_POSITIVE')}>
                      <CircleAlert size={15} /> Marcar falso positivo
                    </button>
                    <button className="btn btn-secondary" type="button"
                      disabled={busyEvent === event.eventId}
                      onClick={() => void review(event.eventId, 'CANCELED')}>
                      <Ban size={15} /> Cancelar proposta
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>}
    </section>
  );
};
