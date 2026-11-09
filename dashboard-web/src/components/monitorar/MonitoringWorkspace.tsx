import { useState, useSyncExternalStore } from "react";
import { MapPin } from "lucide-react";
import type { DeviceStatus, Alert, TelemetryPoint } from "../../types";
import { useCuidado, cuidado } from "../../lib/cuidado";
import { presentation } from "../../services/presentation";
import { HouseSetup } from "../setup/HouseSetup";
import { MonitorarView } from "./MonitorarView";
import { RealMonitoring } from "./RealMonitoring";
const skipped = new Set<string>();
export function MonitoringWorkspace({
  username,
  device,
  alerts,
  route,
  onSettings,
  onResolve,
  onReady,
}: {
  username: string;
  device: DeviceStatus;
  alerts: Alert[];
  route: TelemetryPoint[];
  onSettings: () => void;
  onResolve: (id: number) => void;
  onReady: () => void;
}) {
  const prefs = useCuidado();
  const mode = useSyncExternalStore(presentation.subscribe, presentation.get);
  const [editing, setEditing] = useState(false),
    [skip, setSkip] = useState(() => skipped.has(username));
  const [warning, setWarning] = useState("");
  const choose = (value: "real" | "demo") => {
    setWarning(
      presentation.set(value)
        ? ""
        : "Sua escolha vale nesta sessão. O navegador não permitiu salvá-la.",
    );
  };
  const finish = () => {
    setEditing(false);
    setSkip(true);
    skipped.add(username);
    if (!prefs.home?.confirmed && !skip) {
      choose("demo");
      onReady();
    }
  };
  const emergency = alerts.some(
    (a) =>
      a.status !== "RESOLVED" &&
      ["FALL_DETECTED", "SOS_BUTTON", "HAND_GESTURE_SOS"].includes(a.alertType),
  );
  if (cuidado.carregando())
    return <p role="status">Carregando a configuração da família…</p>;
  if (!cuidado.pronto())
    return (
      <section className="painel workspace-card" role="alert">
        <h2>Não foi possível carregar sua configuração</h2>
        <p>
          Seus dados salvos serão preservados. Recarregue antes de configurar a
          casa.
        </p>
        <button
          className="btn btn-secundario"
          onClick={() => void cuidado.recarregar()}
        >
          Tentar novamente
        </button>
      </section>
    );
  const preview = {
    ...device,
    isOnline: true,
    batteryPercent: 88,
    stepsToday: 1840,
    activeMinutes: 42,
    mobilityScore: 86,
    lastDistanceCm: 145,
    isGripHolding: true,
    lastUpdate: new Date().toISOString(),
    currentLatitude: prefs.home?.lat ?? -23.55052,
    currentLongitude: prefs.home?.lng ?? -46.633308,
  };
  return (
    <div className="monitoring-shell">
      {warning && (
        <p className="nota is-aviso" role="status">
          {warning}
        </p>
      )}
      {mode === "demo" && emergency && (
        <div className="nota is-perigo" role="alert">
          <strong>
            Equipamento real: há um pedido de atenção para sua família.
          </strong>
          <p>Este aviso é real.</p>
          <button
            className="btn btn-primario"
            onClick={() => {
              setEditing(false);
              setSkip(true);
              skipped.add(username);
              choose("real");
            }}
          >
            Abrir atendimento real
          </button>
        </div>
      )}
      {editing || (!prefs.home?.confirmed && !skip) ? (
        <HouseSetup key={username} onDone={finish} onSkip={finish} />
      ) : (
        <>
          <div className="workspace-address-bar">
            <span>
              <MapPin size={17} />
              {prefs.home?.confirmed
                ? prefs.endereco
                : "Endereço da casa ainda não configurado"}
            </span>
            <button className="btn-link" onClick={() => setEditing(true)}>
              Configurar casa e mapa
            </button>
          </div>
          <div className="workspace-address-bar">
            <p className="texto-pequeno">
              {mode === "demo"
                ? "Demonstração · robô virtual online e leituras simuladas"
                : "Equipamento real · leituras da família"}
            </p>
            <div
              className="segmento"
              role="group"
              aria-label="Modo de acompanhamento"
            >
              <button
                aria-pressed={mode === "demo"}
                onClick={() => choose("demo")}
              >
                Demonstração
              </button>
              <button
                aria-pressed={mode === "real"}
                onClick={() => choose("real")}
              >
                Equipamento real
              </button>
            </div>
          </div>
          {mode === "demo" ? (
            <MonitorarView
              device={preview}
              alerts={[]}
              routeHistory={[]}
              routeDemo
              demo
            />
          ) : (
            <RealMonitoring
              device={device}
              alerts={alerts}
              route={route}
              onSettings={onSettings}
              onConfigureHome={() => setEditing(true)}
              onResolve={onResolve}
            />
          )}
        </>
      )}
    </div>
  );
}
