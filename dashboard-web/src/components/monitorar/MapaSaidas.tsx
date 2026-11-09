import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Home, LocateFixed, Minus, Plus } from "lucide-react";
import type { TelemetryPoint } from "../../types";
import { gsap, movimentoReduzido, useGSAP } from "../../motion/gsap";

interface MapaSaidasProps {
  casa: { lat: number; lng: number; raio: number };
  pessoa: { lat: number; lng: number };
  rota: TelemetryPoint[];
  satelite: boolean;
  /** Celular: mapa simples, sem legenda e sem botões de zoom. */
  compacto?: boolean;
}

// Ruas: OpenStreetMap clareado por CSS (.mapa-saidas.is-ruas), sem chave de API. Satélite: Esri.
const TILES = {
  ruas: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
};

const iconeCasa = L.divIcon({
  className: "mapa-icone",
  html: `<span class="mapa-casa">${renderToStaticMarkup(<Home size={20} color="#fff" strokeWidth={2} />)}</span>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
const iconePessoa = L.divIcon({
  className: "mapa-icone",
  html: '<span class="mapa-pessoa">J</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const Controles: React.FC<{ map: L.Map; alvo: [number, number] }> = ({
  map,
  alvo,
}) => {
  return (
    <div className="mapa-controles">
      <button
        className="mapa-botao"
        onClick={() => map.zoomIn()}
        aria-label="Aproximar"
        title="Aproximar"
      >
        <Plus size={18} />
      </button>
      <button
        className="mapa-botao"
        onClick={() => map.zoomOut()}
        aria-label="Afastar"
        title="Afastar"
      >
        <Minus size={18} />
      </button>
      <button
        className="mapa-botao"
        onClick={() => map.setView(alvo, 16)}
        aria-label="Centralizar mapa"
        title="Centralizar mapa"
      >
        <LocateFixed size={18} />
      </button>
    </div>
  );
};

/** Recentraliza quando a casa muda (ex.: área editada nas Configurações). */
const Enquadrar: React.FC<{ centro: [number, number] }> = ({ centro }) => {
  const map = useMap();
  const [lat, lng] = centro;
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

/** Saídas e trajeto: Leaflet com o perímetro tracejado da casa e o trajeto de hoje (Figma 25:1223). */
export const MapaSaidas: React.FC<MapaSaidasProps> = ({
  casa,
  pessoa,
  rota,
  satelite,
  compacto,
}) => {
  const [mapa, setMapa] = useState<L.Map | null>(null);
  const pontos = useMemo(
    () =>
      rota
        .filter(
          (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
        )
        .map((p) => [p.latitude, p.longitude] as [number, number]),
    [rota],
  );
  const trajeto = useRef<L.Polyline>(null);
  const desenhou = useRef(false);

  // O trajeto se desenha da casa até o último ponto (stroke-dashoffset no path.leaflet-interactive), uma vez ao abrir
  const temTrajeto = pontos.length > 1;
  useGSAP(
    () => {
      const path = trajeto.current?.getElement() as SVGPathElement | undefined;
      if (!mapa || !path || desenhou.current) return;
      desenhou.current = true;
      if (movimentoReduzido()) return;
      gsap.fromTo(
        path,
        { drawSVG: "0%" },
        {
          drawSVG: "100%",
          duration: 1.2,
          ease: "power1.inOut",
          delay: 0.2,
          clearProps: "strokeDasharray,strokeDashoffset",
        },
      );
    },
    { dependencies: [mapa, temTrajeto] },
  );
  const tiles = satelite ? TILES.satelite : TILES.ruas;
  const centro: [number, number] = [casa.lat, casa.lng];

  const temPessoa = Number.isFinite(pessoa.lat) && Number.isFinite(pessoa.lng);
  if (
    !Number.isFinite(casa.lat) ||
    !Number.isFinite(casa.lng) ||
    (casa.lat === 0 && casa.lng === 0)
  )
    return (
      <p className="nota">Configure o ponto da casa para mostrar o mapa.</p>
    );

  return (
    <div
      className={`mapa-saidas${compacto ? " is-compacto" : ""}${satelite ? "" : " is-ruas"}`}
    >
      <MapContainer
        center={centro}
        zoom={compacto ? 15 : 16}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl
        className="mapa-leaflet"
        ref={setMapa}
      >
        <TileLayer
          key={satelite ? "s" : "r"}
          url={tiles.url}
          attribution={tiles.attribution}
        />
        <Enquadrar centro={centro} />
        <Circle
          center={centro}
          radius={casa.raio}
          pathOptions={{
            color: "#2563EB",
            weight: 1.5,
            dashArray: "5 6",
            fillColor: "#2563EB",
            fillOpacity: 0.06,
          }}
        />
        {temTrajeto && (
          <Polyline
            ref={trajeto}
            positions={pontos}
            pathOptions={{
              color: "#2563EB",
              weight: 4,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}
        <Marker position={centro} icon={iconeCasa} keyboard={false} />
        {temPessoa && (
          <Marker
            position={[pessoa.lat, pessoa.lng]}
            icon={iconePessoa}
            keyboard={false}
          />
        )}
      </MapContainer>
      {!compacto && mapa && (
        <Controles
          map={mapa}
          alvo={temPessoa ? [pessoa.lat, pessoa.lng] : centro}
        />
      )}
      {!compacto && (
        <ul className="mapa-legenda" aria-label="Legenda do mapa">
          <li>
            <span className="mapa-legenda-casa" aria-hidden="true" />
            Casa
          </li>
          <li>
            <span className="mapa-legenda-trajeto" aria-hidden="true" />
            Trajeto de hoje
          </li>
          <li>
            <span className="mapa-legenda-perimetro" aria-hidden="true" />
            Perímetro seguro
          </li>
        </ul>
      )}
    </div>
  );
};
