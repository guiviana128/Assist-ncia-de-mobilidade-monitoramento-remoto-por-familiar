import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DeviceStatus, TelemetryPoint } from '../types';

// Ícone customizado para a bengala com pin pulsante
const stickIcon = L.divIcon({
  className: 'custom-stick-pin',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #3b82f6;
    border: 3px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 0 15px #3b82f6;
    animation: pulse-blue 1.5s infinite;
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Componente auxiliar para centralizar o mapa na posição atual
const RecenterAutomatically = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

interface MapTrackerProps {
  device?: DeviceStatus;
  routeHistory: TelemetryPoint[];
}

export const MapTracker: React.FC<MapTrackerProps> = ({ device, routeHistory }) => {
  const lat = device?.currentLatitude ?? -23.550520;
  const lng = device?.currentLongitude ?? -46.633308;

  // Extrai coordenadas da rota
  const routePositions = routeHistory.map(pt => [pt.latitude, pt.longitude] as [number, number]);

  return (
    <div className="glass-panel" style={{ padding: '16px', height: '100%', minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            Rastreamento GPS em Tempo Real
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Módulo NEO-6M • Círculo azul indica Perímetro Seguro (500m)
          </p>
        </div>
        <span className="badge badge-online">
          Lat: {lat.toFixed(4)}, Lng: {lng.toFixed(4)}
        </span>
      </div>

      <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', minHeight: '380px' }}
        >
          {/* Tiles do OpenStreetMap estilo Dark/Moderno via CartoDB */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Cerca Virtual de Segurança (Raio de 500m) */}
          <Circle
            center={[lat, lng]}
            radius={500}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 1.5,
              dashArray: '6 6'
            }}
          />

          {/* Trajeto percorrido */}
          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }}
            />
          )}

          {/* Marcador da Posição Atual */}
          <Marker position={[lat, lng]} icon={stickIcon}>
            <Popup>
              <div style={{ color: '#111827', padding: '4px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{device?.name || 'Bengala Inteligente'}</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>
                  Bateria: {device?.batteryPercent?.toFixed(0)}% <br />
                  Distância Obstáculo: {device?.lastDistanceCm?.toFixed(0) || '--'} cm
                </p>
              </div>
            </Popup>
          </Marker>

          <RecenterAutomatically lat={lat} lng={lng} />
        </MapContainer>
      </div>
    </div>
  );
};
