import { useEffect, useState } from "react";
import {
  Circle,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { MapPin, Search, Check, ArrowRight } from "lucide-react";
import { cuidado, useCuidado } from "../../lib/cuidado";
import {
  emptyAddress,
  formatAddress,
  homeValid,
  type HomeAddress,
} from "../../lib/monitoring";
import {
  lookupCep,
  searchAddress,
  type AddressCandidate,
} from "../../services/address";

function PointPicker({
  point,
  onPoint,
}: {
  point: { lat: number; lng: number };
  onPoint: (p: { lat: number; lng: number }) => void;
}) {
  const map = useMap();
  const safePoint =
    Number.isFinite(point.lat) &&
    Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lng) <= 180
      ? point
      : { lat: -23.55052, lng: -46.633308 };
  useEffect(() => {
    map.setView([safePoint.lat, safePoint.lng], map.getZoom());
  }, [safePoint.lat, safePoint.lng, map]);
  useMapEvents({ click: (e) => onPoint(e.latlng) });
  return (
    <Circle
      center={[safePoint.lat, safePoint.lng]}
      radius={18}
      pathOptions={{ color: "#2563eb", fillOpacity: 0.6 }}
    />
  );
}
export function HouseSetup({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}) {
  const prefs = useCuidado();
  const [address, setAddress] = useState<HomeAddress>(
    prefs.home?.address ?? { ...emptyAddress },
  );
  const [point, setPoint] = useState({
    lat: prefs.home?.lat ?? -23.55052,
    lng: prefs.home?.lng ?? -46.633308,
  });
  const [confirmed, setConfirmed] = useState(prefs.home?.confirmed ?? false);
  const [radius, setRadius] = useState(prefs.home?.radius ?? 500);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<AddressCandidate[]>([]);
  const change = (field: keyof HomeAddress, value: string) => {
    setAddress((a) => ({ ...a, [field]: value }));
    setConfirmed(false);
    setResults([]);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="setup-house painel" aria-labelledby="setup-title">
      <div className="workspace-eyebrow">
        <MapPin size={17} /> SUA CASA, SEU CUIDADO
      </div>
      <h1 id="setup-title">Vamos configurar sua casa</h1>
      <p className="workspace-description">
        Cadastre o endereço e confirme a casa no mapa. No primeiro acesso,
        abriremos o Início com o robô virtual online. Você poderá escolher
        equipamento real em Monitorar.
      </p>
      {prefs.endereco !== "Não cadastrado" && !prefs.home && (
        <p className="nota">
          Endereço já salvo: {prefs.endereco}. Ele será preservado até você
          salvar esta configuração.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!homeValid(address, point, confirmed))
              throw Error(
                "Preencha rua, número e cidade em SP e confirme o ponto da casa no mapa.",
              );
            if (
              !(await cuidado.definirCasa({
                version: 1,
                address,
                ...point,
                radius,
                confirmed: true,
              }))
            )
              throw Error(
                cuidado.erro() ||
                  "Aguarde o carregamento das preferências e tente novamente.",
              );
            onDone();
          });
        }}
      >
        <fieldset disabled={busy} className="workspace-fieldset">
          <div className="address-grid">
            <label>
              CEP
              <div className="workspace-inline">
                <input
                  value={address.cep}
                  maxLength={9}
                  inputMode="numeric"
                  onChange={(e) => change("cep", e.target.value)}
                  className="campo-entrada"
                  autoComplete="postal-code"
                />
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() =>
                    void run(async () => {
                      const data = await lookupCep(address.cep);
                      setAddress((a) => ({ ...a, ...data }));
                      setConfirmed(false);
                      setResults([]);
                    })
                  }
                >
                  <Search size={16} /> Buscar CEP
                </button>
              </div>
            </label>
            <label className="address-wide">
              Rua ou avenida
              <input
                required
                maxLength={100}
                value={address.street}
                onChange={(e) => change("street", e.target.value)}
                className="campo-entrada"
                autoComplete="address-line1"
              />
            </label>
            <label>
              Número
              <input
                required
                maxLength={15}
                value={address.number}
                onChange={(e) => change("number", e.target.value)}
                className="campo-entrada"
              />
            </label>
            <label>
              Complemento <span>(opcional)</span>
              <input
                maxLength={60}
                value={address.complement}
                onChange={(e) => change("complement", e.target.value)}
                className="campo-entrada"
                autoComplete="address-line2"
              />
            </label>
            <label>
              Bairro
              <input
                maxLength={60}
                value={address.district}
                onChange={(e) => change("district", e.target.value)}
                className="campo-entrada"
              />
            </label>
            <label>
              Cidade
              <input
                required
                maxLength={60}
                value={address.city}
                onChange={(e) => change("city", e.target.value)}
                className="campo-entrada"
                autoComplete="address-level2"
              />
            </label>
            <label>
              Estado
              <input
                value="São Paulo · SP"
                readOnly
                className="campo-entrada"
              />
            </label>
          </div>
          <p className="texto-pequeno">
            Atende capital e cidades do estado de São Paulo. A busca de CEP
            consulta o ViaCEP; você também pode preencher manualmente.
          </p>
          <div className="workspace-map-heading">
            <div>
              <h2>Onde fica a casa?</h2>
              <p>
                Marque o ponto no mapa ou busque pelo endereço. Este ponto
                representa a casa, não a posição da pessoa.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secundario"
              disabled={!address.street.trim() || !address.city.trim()}
              onClick={() =>
                void run(async () => {
                  setConfirmed(false);
                  const found = await searchAddress(
                    `${address.street}, ${address.number}, ${address.city}, São Paulo, Brasil`,
                  );
                  setResults(found);
                  if (!found.length)
                    throw Error(
                      "Endereço não encontrado. Marque a casa no mapa ou informe as coordenadas.",
                    );
                })
              }
            >
              <Search size={16} /> Buscar no mapa
            </button>
          </div>
          <p className="texto-pequeno">
            Ao buscar no mapa, rua, número e cidade são enviados ao
            OpenStreetMap/Nominatim. Nenhuma busca ocorre enquanto você digita.
          </p>
          {results.length > 0 && (
            <ul className="address-results" aria-label="Endereços encontrados">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setPoint({ lat: r.lat, lng: r.lng });
                      setConfirmed(false);
                      setResults([]);
                    }}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="home-picker">
            <MapContainer
              center={[point.lat, point.lng]}
              zoom={15}
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <PointPicker
                point={point}
                onPoint={(p) => {
                  if (!busy) {
                    setPoint(p);
                    setConfirmed(false);
                  }
                }}
              />
            </MapContainer>
          </div>
          <div className="address-grid coordinates">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                required
                value={point.lat}
                onChange={(e) => {
                  setPoint((p) => ({ ...p, lat: Number(e.target.value) }));
                  setConfirmed(false);
                }}
                className="campo-entrada"
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                required
                value={point.lng}
                onChange={(e) => {
                  setPoint((p) => ({ ...p, lng: Number(e.target.value) }));
                  setConfirmed(false);
                }}
                className="campo-entrada"
              />
            </label>
            <label>
              Perímetro seguro (metros)
              <input
                type="number"
                min={10}
                max={10000}
                required
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="campo-entrada"
              />
            </label>
          </div>
          <label className="workspace-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <Check size={18} /> Confirmo que este ponto corresponde à casa.
          </label>
          {address.street && (
            <p className="texto-pequeno">{formatAddress(address)}</p>
          )}
          {error && (
            <p className="nota is-perigo" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-actions">
            <button type="submit" className="btn btn-primario">
              {busy ? "Salvando…" : "Salvar casa e continuar"}
              <ArrowRight size={17} />
            </button>
            <button type="button" className="btn-link" onClick={onSkip}>
              Configurar depois
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
