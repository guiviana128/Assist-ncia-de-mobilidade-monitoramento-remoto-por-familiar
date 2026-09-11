import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Compass, Layers, ShieldCheck } from 'lucide-react';
import { DeviceStatus, TelemetryPoint } from '../types';

// Ícone animado da bengala com pulso
const stickIcon = L.divIcon({
  className: 'custom-stick-pin',
  html: `<div style="
    width: 26px;
    height: 26px;
    background: #2563eb;
    border: 3px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 0 20px #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-blue-glow 1.5s infinite;
  "><div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

// Componente para recentralizar o mapa
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
};

interface MapTrackerProps {
  device?: DeviceStatus;
  routeHistory: TelemetryPoint[];
  isDarkMode: boolean;
  geofenceRadius?: number;
}

export const MapTracker: React.FC<MapTrackerProps> = ({
  device,
  routeHistory,
  isDarkMode,
  geofenceRadius = 500
}) => {
  const lat = device?.currentLatitude ?? -23.550520;
  const lng = device?.currentLongitude ?? -46.633308;
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');

  const routePositions = routeHistory.map(pt => [pt.latitude, pt.longitude] as [number, number]);

  // Tile URL dependendo do tema escuro/claro
  const getTileUrl = () => {
    if (mapType === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    return isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  };

  return (
    <div className="glass-panel" style={{ padding: '18px', height: '100%', minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
      
      {/* Cabeçalho do Mapa */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Localização GPS em Tempo Real
            </h3>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            São Paulo, SP • Cerca Virtual Ativa ({geofenceRadius}m de raio)
          </p>
        </div>

        {/* Controles do Mapa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
          >
            <Layers size={14} />
            <span>{mapType === 'streets' ? 'Satélite' : 'Ruas'}</span>
          </button>

          <span className="badge badge-online">
            <Compass size={12} />
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Contêiner Leaflet */}
      <div style={{ flex: 1, position: 'relative', borderRadius: '14px', overflow: 'hidden', minHeight: '400px' }}>
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', minHeight: '400px' }}
        >
          <TileLayer
            key={isDarkMode ? 'dark' : 'light'}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url={getTileUrl()}
          />

          {/* Círculo do Perímetro Seguro (Cerca Virtual) */}
          <Circle
            center={[lat, lng]}
            radius={geofenceRadius}
            pathOptions={{
              color: isDarkMode ? '#60a5fa' : '#2563eb',
              fillColor: isDarkMode ? '#3b82f6' : '#2563eb',
              fillOpacity: isDarkMode ? 0.12 : 0.08,
              weight: 2,
              dashArray: '6 6'
            }}
          />

          {/* Traçado da Rota Histórica */}
          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: isDarkMode ? '#38bdf8' : '#0284c7',
                weight: 4,
                opacity: 0.85
              }}
            />
          )}

          {/* Marcador do Usuário */}
          <Marker position={[lat, lng]} icon={stickIcon}>
            <Popup>
              <div style={{ color: '#0f172a', padding: '6px', minWidth: '160px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{device?.name || 'Bengala AssistMob'}</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#475569' }}>
                  🔋 Bateria: <strong>{device?.batteryPercent?.toFixed(0)}%</strong><br />
                  🛰️ GPS NEO-6M Ativo<br />
                  🛡️ Dentro do perímetro seguro
                </p>
              </div>
            </Popup>
          </Marker>

          <RecenterMap lat={lat} lng={lng} />
        </MapContainer>
      </div>

      {/* Barra de Status Inferior do Mapa */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={15} color="var(--accent-green-text)" />
          Área de segurança monitorada
        </span>
        <span>Último pacote GPS: {device?.lastUpdate ? new Date(device.lastUpdate).toLocaleTimeString('pt-BR') : 'Agora'}</span>
      </div>
    </div>
  );
};
