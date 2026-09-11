import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, BatteryLow, ShieldAlert, Radio, PhoneCall, Copy, Check } from 'lucide-react';
import { Alert } from '../types';

interface AlertCenterProps {
  alerts: Alert[];
  onResolve: (id: number) => void;
}

export const AlertCenter: React.FC<AlertCenterProps> = ({ alerts, onResolve }) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const getAlertIcon = (type: Alert['alertType']) => {
    switch (type) {
      case 'SOS_BUTTON':
        return <Flame size={18} color="#ef4444" />;
      case 'FALL_DETECTED':
        return <ShieldAlert size={18} color="#ef4444" />;
      case 'LOW_BATTERY':
        return <BatteryLow size={18} color="#f59e0b" />;
      case 'OBSTACLE_COLLISION':
        return <AlertTriangle size={18} color="#f59e0b" />;
      case 'GEOFENCE_EXIT':
        return <Radio size={18} color="#3b82f6" />;
      default:
        return <AlertTriangle size={18} color="#94a3b8" />;
    }
  };

  const handleCopyLocation = (alert: Alert) => {
    const coords = `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}`;
    navigator.clipboard.writeText(coords);
    setCopiedId(alert.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'var(--accent-red-bg)',
            padding: '6px',
            borderRadius: '8px',
            color: 'var(--accent-red-text)'
          }}>
            <ShieldAlert size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              Central de Ocorrências & Emergência
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Alertas Prioritários com Notificação Push FCM
            </p>
          </div>
        </div>

        <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
          {alerts.length} Eventos
        </span>
      </div>

      {/* Lista de Alertas */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '360px',
        paddingRight: '4px'
      }}>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={36} color="var(--accent-green-text)" style={{ margin: '0 auto 10px auto' }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Nenhum alerta pendente</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Dispositivo está seguro e dentro dos parâmetros normais.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isPending = alert.status === 'PENDING';
            const isCritical = alert.severity === 'CRITICAL';

            return (
              <div
                key={alert.id}
                style={{
                  background: isPending 
                    ? isCritical ? 'var(--accent-red-bg)' : 'var(--accent-yellow-bg)' 
                    : 'var(--bg-card-hover)',
                  border: isPending 
                    ? isCritical ? '1px solid var(--accent-red-border)' : '1px solid var(--accent-yellow-border)' 
                    : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: isPending && isCritical ? '0 4px 16px var(--accent-red-glow)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ marginTop: '2px' }}>{getAlertIcon(alert.alertType)}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.88rem', color: isPending ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {alert.alertType.replace('_', ' ')}
                        </strong>
                        <span className={`badge ${isPending ? isCritical ? 'badge-alert' : 'badge-warning' : 'badge-online'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                          {alert.status}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(alert.createdAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>

                {/* Ações Rápidas do Alerta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleCopyLocation(alert)}
                    style={{ fontSize: '0.72rem', padding: '4px 8px', gap: '4px' }}
                    title="Copiar Coordenadas GPS"
                  >
                    {copiedId === alert.id ? <Check size={13} color="var(--accent-green-text)" /> : <Copy size={13} />}
                    <span>{copiedId === alert.id ? 'Copiado!' : 'Copiar GPS'}</span>
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isCritical && (
                      <a
                        href="tel:192"
                        className="btn btn-danger"
                        style={{ fontSize: '0.72rem', padding: '4px 10px', gap: '4px', textDecoration: 'none' }}
                      >
                        <PhoneCall size={13} />
                        <span>SAMU 192</span>
                      </a>
                    )}

                    {isPending && (
                      <button
                        className="btn btn-primary"
                        onClick={() => onResolve(alert.id)}
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                      >
                        Confirmar Ciente
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
