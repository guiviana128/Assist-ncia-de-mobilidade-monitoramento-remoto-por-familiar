import React, { useState } from 'react';
import { Shield, Phone, Users, Save, CheckCircle2, BellRing, MapPin } from 'lucide-react';

interface SettingsViewProps {
  geofenceRadius: number;
  onUpdateGeofenceRadius: (radius: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  geofenceRadius,
  onUpdateGeofenceRadius
}) => {
  const [radius, setRadius] = useState(geofenceRadius);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdateGeofenceRadius(radius);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ margin: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Grid de Configurações */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Cerca Virtual & Geofence */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--accent-primary)', padding: '8px', borderRadius: '10px', color: '#ffffff' }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Configuração de Cerca Virtual
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Dispara alerta quando o usuário sair do perímetro seguro
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Raio de Segurança</span>
                <strong style={{ color: 'var(--accent-primary)', fontSize: '1rem' }}>{radius} metros</strong>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>100m (Casa)</span>
                <span>500m (Bairro)</span>
                <span>2000m (Cidade)</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
              <MapPin size={16} color="var(--accent-cyan)" />
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Ponto Central Seguro</p>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  Residência: Av. Paulista, 1000 - Bela Vista, SP
                </p>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '6px' }}>
              <Save size={16} />
              <span>{saved ? 'Configuração Salva!' : 'Salvar Perímetro'}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Contatos de Emergência Cadastrados */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--accent-cyan)', padding: '8px', borderRadius: '10px', color: '#ffffff' }}>
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Contatos de Emergência
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Destinatários de chamadas e Notificações Push FCM
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Contato 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Maria Silva (Filha / Cuidadora)</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+55 (11) 98765-4321 • Push FCM Ativo</p>
              </div>
              <span className="badge badge-online">Principal</span>
            </div>

            {/* Contato 2 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Carlos Silva (Filho)</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+55 (11) 91234-5678 • SMS & Ligação</p>
              </div>
              <span className="badge badge-online">Secundário</span>
            </div>

            {/* Contato 3 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--accent-red-bg)', borderRadius: '10px', border: '1px solid var(--accent-red-border)' }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--accent-red-text)' }}>SAMU / Ambulância Emergência</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Central Telefônica: 192</p>
              </div>
              <span className="badge badge-alert">Emergência</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
