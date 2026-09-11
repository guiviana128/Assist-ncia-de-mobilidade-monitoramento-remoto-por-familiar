import React, { useState } from 'react';
import { Shield, Users, Pill, Plus, Save, Clock, MapPin, CheckCircle2, PhoneCall, Trash2, BellRing, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface SettingsViewProps {
  geofenceRadius: number;
  onUpdateGeofenceRadius: (radius: number) => void;
  deviceId?: string;
}

interface GeofenceZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  geofenceRadius,
  onUpdateGeofenceRadius,
  deviceId = 'ESP32-MOB-001'
}) => {
  const [radius, setRadius] = useState(geofenceRadius);
  const [savedRadius, setSavedRadius] = useState(false);

  // Lembrete de Medicamentos
  const [medicineName, setMedicineName] = useState('');
  const [medicineTime, setMedicineTime] = useState('14:00');
  const [medicineList, setMedicineList] = useState([
    { id: 1, name: 'Losartana 50mg (Pressão)', time: '08:00' },
    { id: 2, name: 'Complexo Vitamínico', time: '12:30' },
    { id: 3, name: 'Metformina 500mg', time: '19:00' }
  ]);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  // Múltiplas Áreas Seguras
  const [safeZones, setSafeZones] = useState<GeofenceZone[]>([
    { id: '1', name: '🏠 Residência Principal', lat: -23.550520, lng: -46.633308, radius: 250 },
    { id: '2', name: '🌳 Praça do Bairro / Caminhada', lat: -23.552200, lng: -46.635100, radius: 150 },
    { id: '3', name: '💊 Farmácia São Paulo', lat: -23.548900, lng: -46.631000, radius: 100 },
    { id: '4', name: '🏥 Posto de Saúde Central', lat: -23.553500, lng: -46.637000, radius: 200 }
  ]);

  const handleSaveRadius = () => {
    onUpdateGeofenceRadius(radius);
    setSavedRadius(true);
    setTimeout(() => setSavedRadius(false), 2500);
  };

  // Função Robusta de Adição de Medicamento
  const handleAddMedicine = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Se o usuário clicar sem digitar, usa um exemplo prático
    const finalName = medicineName.trim() || 'Insulina 10 UI (Dose Diária)';
    const finalTime = medicineTime || '14:00';

    const newMed = {
      id: Date.now(),
      name: finalName,
      time: finalTime
    };

    // Atualização imediata de estado no React
    setMedicineList(prev => [newMed, ...prev]);
    setReminderMsg(`✅ Lembrete de "${finalName}" adicionado para às ${finalTime}!`);
    setMedicineName('');

    // Dispara notificação no backend / mock
    api.scheduleMedicineReminder(deviceId, `${finalName} (${finalTime})`).catch(console.error);

    setTimeout(() => {
      setReminderMsg(null);
    }, 3500);
  };

  const handleRemoveMedicine = (id: number) => {
    setMedicineList(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div style={{ margin: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Notificação de Sucesso */}
      {reminderMsg && (
        <div style={{
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          fontSize: '0.9rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <CheckCircle2 size={20} />
          <span>{reminderMsg}</span>
        </div>
      )}

      {/* Grid Principal Perfeitamente Balanceado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Lembrete de Medicamentos na Bengala */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}>
              <Pill size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Lembrete de Remédios na Bengala
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                A bengala emite bip suave e vibra no horário do medicamento
              </p>
            </div>
          </div>

          {/* Formulário com Suporte a Enter e Clique Direto */}
          <form
            onSubmit={handleAddMedicine}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '18px',
              flexWrap: 'nowrap'
            }}
          >
            <input
              type="text"
              placeholder="Digite o nome do remédio (ex: Insulina)"
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMedicine();
                }
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                height: '42px',
                padding: '0 14px',
                borderRadius: '10px',
                background: 'var(--bg-app)',
                border: '1.5px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.86rem',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
              }}
            />
            <input
              type="time"
              value={medicineTime}
              onChange={(e) => setMedicineTime(e.target.value)}
              style={{
                width: '110px',
                height: '42px',
                padding: '0 10px',
                borderRadius: '10px',
                background: 'var(--bg-app)',
                border: '1.5px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.86rem',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
              }}
            />
            <button
              type="button"
              onClick={() => handleAddMedicine()}
              className="btn btn-primary"
              style={{
                height: '42px',
                padding: '0 18px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer'
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Adicionar</span>
            </button>
          </form>

          {/* Lista de Remédios Agendados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, maxHeight: '220px', overflowY: 'auto' }}>
            {medicineList.map((med) => (
              <div
                key={med.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'var(--bg-app)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={16} color="var(--accent-cyan)" />
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{med.name}</strong>
                    <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      às {med.time}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMedicine(med.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Remover lembrete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Contatos de Resgate & Emergência */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}>
              <Users size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Contatos de Resgate & Emergência
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Acionamento prioritário em caso de SOS ou Queda
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {/* Contato 1: Familiar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--bg-app)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>Maria Silva (Filha)</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  +55 11 98765-4321 • Push FCM Ativo
                </p>
              </div>
              <a
                href="tel:5511987654321"
                className="btn btn-secondary"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PhoneCall size={14} color="var(--accent-primary)" />
                <span>Ligar</span>
              </a>
            </div>

            {/* Contato 2: SAMU */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--accent-red-bg)',
              borderRadius: '12px',
              border: '1px solid var(--accent-red-border)'
            }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--accent-red-text)' }}>SAMU Ambulância</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Emergências Médicas: 192
                </p>
              </div>
              <a
                href="tel:192"
                className="btn btn-danger"
                style={{
                  height: '36px',
                  padding: '0 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PhoneCall size={14} />
                <span>192</span>
              </a>
            </div>

            {/* Contato 3: Bombeiros 193 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--bg-app)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>Corpo de Bombeiros</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Resgate & Traumas: 193
                </p>
              </div>
              <a
                href="tel:193"
                className="btn btn-secondary"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PhoneCall size={14} />
                <span>193</span>
              </a>
            </div>
          </div>
        </div>

        {/* Card 3: Áreas Seguras Cadastradas (Multi-Cerca) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <Shield size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Áreas Seguras (Multi-Cerca)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Perímetros configurados no GPS
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {safeZones.map((zone) => (
              <div
                key={zone.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'var(--bg-app)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPin size={16} color="var(--accent-primary)" />
                  <div>
                    <strong style={{ fontSize: '0.86rem' }}>{zone.name}</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Raio: {zone.radius}m
                    </p>
                  </div>
                </div>
                <span className="badge badge-online" style={{ fontSize: '0.68rem', padding: '3px 8px' }}>Ativo</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
