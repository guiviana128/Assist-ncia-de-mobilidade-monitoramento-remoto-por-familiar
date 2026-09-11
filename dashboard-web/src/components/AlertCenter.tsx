import React from 'react';
import { AlertTriangle, CheckCircle2, Flame, BatteryLow, ShieldAlert, Radio } from 'lucide-react';
import { Alert } from '../types';

interface AlertCenterProps {
  alerts: Alert[];
  onResolve: (id: number) => void;
}

export const AlertCenter: React.FC<AlertCenterProps> = ({ alerts, onResolve }) => {
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
        return <AlertTriangle size={18} color="#9ca3af" />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={20} color="#ef4444" />
          Central de Alertas & Emergência
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {alerts.length} eventos registrados
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', paddingRight: '4px' }}>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>Nenhum alerta recente pendente.</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>O usuário está seguro e dentro dos parâmetros normais.</p>
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
                    ? isCritical ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)' 
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isPending 
                    ? isCritical ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)' 
                    : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ marginTop: '2px' }}>{getAlertIcon(alert.alertType)}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.9rem', color: isPending ? '#ffffff' : 'var(--text-secondary)' }}>
                        {alert.alertType.replace('_', ' ')}
                      </strong>
                      <span className={`badge ${isPending ? isCritical ? 'badge-alert' : 'badge-warning' : 'badge-online'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                        {alert.status}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: isPending ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {alert.message}
                    </p>
                    <div style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(alert.createdAt).toLocaleTimeString('pt-BR')} • Lat: {alert.latitude.toFixed(4)}, Lng: {alert.longitude.toFixed(4)}
                    </div>
                  </div>
                </div>

                {isPending && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onResolve(alert.id)}
                    style={{ fontSize: '0.75rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  >
                    Confirmar Ciente
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
