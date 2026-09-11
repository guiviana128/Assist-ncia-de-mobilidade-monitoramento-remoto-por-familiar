import React, { useState } from 'react';
import { Shield, Users, Pill, Plus, Save, Clock, MapPin, CheckCircle2, PhoneCall, Trash2 } from 'lucide-react';
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

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) return;

    const newMed = {
      id: Date.now(),
      name: medicineName.trim(),
      time: medicineTime
    };

    setMedicineList([...medicineList, newMed]);
    await api.scheduleMedicineReminder(deviceId, `${medicineName} (${medicineTime})`);
    
    setReminderMsg(`⏰ Lembrete de "${medicineName}" enviado para a bengala!`);
    setMedicineName('');
    setTimeout(() => setReminderMsg(null), 3500);
  };

  const handleRemoveMedicine = (id: number) => {
    setMedicineList(medicineList.filter(m => m.id !== id));
  };

  return (
    <div style={{ margin: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {reminderMsg && (
        <div style={{
          padding: '12px 18px',
          background: 'var(--accent-primary)',
          color: '#ffffff',
          borderRadius: '10px',
          fontSize: '0.88rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s'
        }}>
          <CheckCircle2 size={18} />
          <span>{reminderMsg}</span>
        </div>
      )}

      {/* Grid Principal de Configurações */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Lembrete de Medicamentos na Bengala */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'var(--accent-cyan)', padding: '8px', borderRadius: '10px', color: '#ffffff' }}>
              <Pill size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Lembrete de Remédios na Bengala
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                A bengala emite bip suave e vibra no horário do medicamento
              </p>
            </div>
          </div>

          {/* Formulário de Adicionar Remédio */}
          <form onSubmit={handleAddMedicine} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Nome do remédio (ex: Insulina)"
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
            <input
              type="time"
              value={medicineTime}
              onChange={(e) => setMedicineTime(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              <Plus size={15} /> Adicionar
            </button>
          </form>

          {/* Lista de Remédios Agendados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {medicineList.map((med) => (
              <div
                key={med.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--bg-app)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={15} color="var(--accent-cyan)" />
                  <div>
                    <strong style={{ fontSize: '0.84rem' }}>{med.name}</strong>
                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      às {med.time}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMedicine(med.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Múltiplas Áreas Seguras (Multi-Geofencing) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'var(--accent-primary)', padding: '8px', borderRadius: '10px', color: '#ffffff' }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Áreas Seguras Cadastradas (Multi-Cerca)
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Detecção automática de chegada e saída em pontos familiares
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {safeZones.map((zone) => (
              <div
                key={zone.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--bg-app)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPin size={16} color="var(--accent-primary)" />
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>{zone.name}</strong>
                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      Raio de proteção: {zone.radius}m
                    </p>
                  </div>
                </div>
                <span className="badge badge-online" style={{ fontSize: '0.65rem' }}>Ativo</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Contatos de Emergência */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'var(--accent-yellow)', padding: '8px', borderRadius: '10px', color: '#ffffff' }}>
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Contatos de Resgate & Emergência
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Acionamento prioritário em caso de SOS ou Queda
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '0.84rem' }}>Maria Silva (Filha)</strong>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>+55 11 98765-4321 • Push FCM Ativo</p>
              </div>
              <a href="tel:5511987654321" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                <PhoneCall size={13} /> Ligar
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--accent-red-bg)', borderRadius: '8px', border: '1px solid var(--accent-red-border)' }}>
              <div>
                <strong style={{ fontSize: '0.84rem', color: 'var(--accent-red-text)' }}>SAMU Ambulância</strong>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Emergências Médicas: 192</p>
              </div>
              <a href="tel:192" className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem', textDecoration: 'none' }}>
                <PhoneCall size={13} /> 192
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
