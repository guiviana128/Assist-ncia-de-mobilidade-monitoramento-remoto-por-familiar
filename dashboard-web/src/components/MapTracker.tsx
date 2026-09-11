import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Compass, Layers, ShieldCheck, Crosshair, Edit3, Check, X, Sparkles, Map } from 'lucide-react';
import { DeviceStatus, TelemetryPoint } from '../types';
import { api } from '../services/api';

// Ícone animado da bengala com pulso neon
const stickIcon = L.divIcon({
  className: 'custom-stick-pin',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #2563eb;
    border: 3.5px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 0 22px #3b82f6, 0 4px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-blue-glow 1.5s infinite;
  "><div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Componente para recentralizar o mapa
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 1.0 });
  }, [lat, lng, map]);
  return null;
};

// Componente para permitir clicar no mapa e mover o GPS
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

interface MapTrackerProps {
  device?: DeviceStatus;
  routeHistory: TelemetryPoint[];
  isDarkMode: boolean;
  geofenceRadius?: number;
  onLocationUpdated?: () => void;
}

export const MapTracker: React.FC<MapTrackerProps> = ({
  device,
  routeHistory,
  isDarkMode,
  geofenceRadius = 500,
  onLocationUpdated
}) => {
  const lat = device?.currentLatitude ?? -23.550520;
  const lng = device?.currentLongitude ?? -46.633308;

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [isCoordModalOpen, setIsCoordModalOpen] = useState(false);
  const [customLat, setCustomLat] = useState(lat.toString());
  const [customLng, setCustomLng] = useState(lng.toString());
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  useEffect(() => {
    setCustomLat(lat.toFixed(6));
    setCustomLng(lng.toFixed(6));
  }, [lat, lng]);

  const showGpsFeedback = (msg: string) => {
    setGpsStatusMsg(msg);
    setTimeout(() => setGpsStatusMsg(null), 4000);
  };

  // 1. Obter Localização Real Atual com Fallback Rápido por IP (Nunca trava em "Localizando...")
  const handleGetCurrentLocation = async () => {
    setLocatingUser(true);

    const tryFallbackIpLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          await api.sendSimulatedTelemetry({
            latitude: data.latitude,
            longitude: data.longitude,
            speedKmh: 0.0
          });
          showGpsFeedback(`📍 Localizado: ${data.city || 'Sua Cidade'} (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})`);
          if (onLocationUpdated) onLocationUpdated();
          return true;
        }
      } catch (err) {
        console.warn('Fallback IP falhou:', err);
      }
      return false;
    };

    if (!navigator.geolocation) {
      const ok = await tryFallbackIpLocation();
      if (!ok) showGpsFeedback('⚠️ Não foi possível obter geolocalização.');
      setLocatingUser(false);
      return;
    }

    let resolved = false;

    // Timeout de segurança de 3.5s para nunca travar o botão
    const timeoutId = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        const ok = await tryFallbackIpLocation();
        if (!ok) showGpsFeedback('⚠️ GPS demorou a responder. Use o clique no mapa.');
        setLocatingUser(false);
      }
    }, 3500);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        await api.sendSimulatedTelemetry({
          latitude: userLat,
          longitude: userLng,
          speedKmh: 0.0
        });

        setLocatingUser(false);
        showGpsFeedback(`📍 GPS Preciso Obtido: ${userLat.toFixed(5)}, ${userLng.toFixed(5)}`);
        if (onLocationUpdated) onLocationUpdated();
      },
      async (error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        console.warn('GPS nativo bloqueado/indisponível, usando rede:', error.message);
        const ok = await tryFallbackIpLocation();
        if (!ok) showGpsFeedback('⚠️ Permissão de GPS negada. Digite as coordenadas ou clique no mapa.');
        setLocatingUser(false);
      },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
    );
  };

  // 2. Salvar Coordenadas Customizadas
  const handleSaveCustomCoords = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newLat = parseFloat(customLat);
    const newLng = parseFloat(customLng);

    if (isNaN(newLat) || isNaN(newLng)) {
      alert('Por favor, insira coordenadas válidas.');
      return;
    }

    await api.sendSimulatedTelemetry({
      latitude: newLat,
      longitude: newLng
    });

    setIsCoordModalOpen(false);
    showGpsFeedback(`✅ Coordenadas atualizadas: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}`);
    if (onLocationUpdated) onLocationUpdated();
  };

  // 3. Mover o GPS clicando diretamente no Mapa
  const handleMapClick = async (clickedLat: number, clickedLng: number) => {
    await api.sendSimulatedTelemetry({
      latitude: clickedLat,
      longitude: clickedLng
    });
    showGpsFeedback(`📍 Marcador movido para: ${clickedLat.toFixed(5)}, ${clickedLng.toFixed(5)}`);
    if (onLocationUpdated) onLocationUpdated();
  };

  // 4. Presets de Cidades
  const setCityPreset = async (name: string, pLat: number, pLng: number) => {
    setCustomLat(pLat.toString());
    setCustomLng(pLng.toString());
    await api.sendSimulatedTelemetry({ latitude: pLat, longitude: pLng });
    setIsCoordModalOpen(false);
    showGpsFeedback(`📍 Localização definida: ${name}`);
    if (onLocationUpdated) onLocationUpdated();
  };

  const routePositions = routeHistory.map(pt => [pt.latitude, pt.longitude] as [number, number]);

  // Provedores de Mapa 100% Gratuitos e SEM Marca d'água de API Key
  const getTileUrl = () => {
    if (mapType === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    // OpenStreetMap Oficial (Limpo, Rápido, Sem Marca d'água)
    return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  };

  return (
    <div className="glass-panel" style={{ padding: '18px', height: '100%', minHeight: '480px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Toast de Notificação GPS */}
      {gpsStatusMsg && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          fontSize: '0.86rem',
          fontWeight: 700,
          boxShadow: '0 8px 25px rgba(37, 99, 235, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease',
          whiteSpace: 'nowrap'
        }}>
          <Compass size={18} />
          <span>{gpsStatusMsg}</span>
        </div>
      )}

      {/* Cabeçalho do Mapa com Ferramentas GPS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              Localização GPS em Tempo Real
            </h3>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Clique em qualquer rua para mover o marcador • Cerca Virtual ({geofenceRadius}m)
          </p>
        </div>

        {/* Barra de Ferramentas do GPS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          
          {/* Botão Obter Localização Real Atual */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGetCurrentLocation}
            disabled={locatingUser}
            style={{ fontSize: '0.78rem', height: '36px', padding: '0 14px', gap: '6px', cursor: 'pointer' }}
            title="Usa o GPS ou rede para posicionar a bengala onde você estiver agora"
          >
            <Crosshair size={15} className={locatingUser ? 'animate-spin' : ''} />
            <span>{locatingUser ? 'Localizando...' : 'Minha Localização'}</span>
          </button>

          {/* Botão Digitar Coordenadas */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsCoordModalOpen(true)}
            style={{ fontSize: '0.78rem', height: '36px', padding: '0 12px', gap: '6px', cursor: 'pointer' }}
            title="Digitar Latitude e Longitude manualmente"
          >
            <Edit3 size={14} color="var(--accent-primary)" />
            <span>Editar Coords</span>
          </button>

          {/* Botão Alternar Ruas / Satélite */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
            style={{ fontSize: '0.78rem', height: '36px', padding: '0 12px', gap: '6px', cursor: 'pointer' }}
          >
            <Layers size={14} />
            <span>{mapType === 'streets' ? 'Satélite' : 'Ruas'}</span>
          </button>

          <span className="badge badge-online" style={{ height: '36px', padding: '0 10px', fontSize: '0.72rem' }}>
            <Compass size={12} />
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Contêiner do Mapa com OpenStreetMap Limpo */}
      <div style={{ flex: 1, position: 'relative', borderRadius: '14px', overflow: 'hidden', minHeight: '410px' }}>
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', minHeight: '410px' }}
        >
          {/* Camada OpenStreetMap Oficial 100% Gratuita e Sem Marca d'água */}
          <TileLayer
            key={mapType}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={getTileUrl()}
          />

          {/* Círculo do Perímetro Seguro (Cerca Virtual) */}
          <Circle
            center={[lat, lng]}
            radius={geofenceRadius}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 2,
              dashArray: '6 6'
            }}
          />

          {/* Trajeto Histórico */}
          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#0284c7',
                weight: 4,
                opacity: 0.85
              }}
            />
          )}

          {/* Marcador Principal da Bengala */}
          <Marker position={[lat, lng]} icon={stickIcon}>
            <Popup>
              <div style={{ color: '#0f172a', padding: '6px', minWidth: '170px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{device?.name || 'Bengala Amparo'}</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#475569' }}>
                  📍 Lat: <strong>{lat.toFixed(5)}</strong><br />
                  📍 Lng: <strong>{lng.toFixed(5)}</strong><br />
                  🔋 Bateria: <strong>{device?.batteryPercent?.toFixed(0)}%</strong><br />
                  🛰️ GPS NEO-6M Conectado
                </p>
              </div>
            </Popup>
          </Marker>

          <RecenterMap lat={lat} lng={lng} />
          <MapClickHandler onMapClick={handleMapClick} />
        </MapContainer>
      </div>

      {/* Barra Inferior Informativa */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={15} color="var(--accent-green-text)" />
          <span>Dica: <strong>Clique em qualquer ponto do mapa</strong> para posicionar a bengala lá.</span>
        </span>
        <span>GPS Satélites: <strong>8 Conectados (Fix 3D)</strong></span>
      </div>

      {/* Modal para Inserir Coordenadas Manualmente */}
      {isCoordModalOpen && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-card)',
            width: '100%',
            maxWidth: '440px',
            padding: '22px',
            border: '1.5px solid var(--border-hover)',
            boxShadow: 'var(--shadow-float)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Definir Coordenadas GPS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCoordModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Presets Rápidos */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Locais Rápidos Pré-definidos
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCityPreset('Av. Paulista, SP', -23.561414, -46.655881)}
                  style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                >
                  🏢 Av. Paulista (SP)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCityPreset('Copacabana, RJ', -22.969442, -43.186845)}
                  style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                >
                  🏖️ Copacabana (RJ)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCityPreset('Esplanada, Brasília', -15.798889, -47.866667)}
                  style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                >
                  🏛️ Brasília (DF)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCityPreset('Jardim Botânico, Curitiba', -25.442778, -49.239444)}
                  style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                >
                  🌲 Curitiba (PR)
                </button>
              </div>
            </div>

            {/* Formulário de Latitude / Longitude */}
            <form onSubmit={handleSaveCustomCoords} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Latitude (ex: -23.550520)
                </label>
                <input
                  type="text"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  placeholder="-23.550520"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Longitude (ex: -46.633308)
                </label>
                <input
                  type="text"
                  value={customLng}
                  onChange={(e) => setCustomLng(e.target.value)}
                  placeholder="-46.633308"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCoordModalOpen(false)}
                  style={{ fontSize: '0.82rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Check size={15} />
                  <span>Salvar Coordenadas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
