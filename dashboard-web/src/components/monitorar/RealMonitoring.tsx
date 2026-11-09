import { useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  Bot,
  Camera,
  Battery,
  Clock,
  RefreshCw,
  MapPin,
  ArrowRight,
} from "lucide-react";
import type { DeviceStatus, Alert, TelemetryPoint } from "../../types";
import { apiJson, auth } from "../../services/auth";
import {
  activityText,
  connectionOnline,
  readingFresh,
  type Activity,
} from "../../lib/monitoring";
import { useCuidado } from "../../lib/cuidado";
import {
  haQuanto,
  nomePessoa,
  comodoCurto,
  naNo,
} from "../../lib/resumoDoEstado";
import { FALLBACK_LAYOUT } from "../../robot/houseLayout";
import { PlantaCasa } from "../planta/PlantaCasa";
import { MapaSaidas } from "./MapaSaidas";
import { LocalAnalysis } from "./LocalAnalysis";
type Connections = Record<
  string,
  { online: boolean; lastSeen?: string; state?: string }
>;
export function RealMonitoring({
  device,
  alerts,
  route,
  onSettings,
  onConfigureHome,
  onResolve,
}: {
  device: DeviceStatus;
  alerts: Alert[];
  route: TelemetryPoint[];
  onSettings: () => void;
  onConfigureHome: () => void;
  onResolve: (id: number) => void;
}) {
  const prefs = useCuidado();
  const [activity, setActivity] = useState<Activity>({
    personName: nomePessoa(device),
    state: "WAITING",
  });
  const [connections, setConnections] = useState<Connections>({});
  const [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true,
      working = false;
    const generation = auth.generation;
    const load = async () => {
      if (working) return;
      working = true;
      setBusy(true);
      try {
        const [a, c] = await Promise.all([
          apiJson<Activity>(`/care/${device.deviceId}/summary`),
          apiJson<Connections>(`/care/${device.deviceId}/connections`),
        ]);
        if (active && generation === auth.generation) {
          setActivity(a);
          setConnections(c);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Não foi possível verificar o servidor. As últimas observações podem estar desatualizadas.",
          );
      } finally {
        working = false;
        if (active) setBusy(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [device.deviceId, refresh]);
  const fresh = readingFresh(activity.observedAt);
  const current: Activity =
    activity.state === "EMERGENCY" || activity.state === "WAITING"
      ? activity
      : !fresh
        ? { ...activity, state: "STALE" }
        : activity;
  const room =
    current.room && fresh ? comodoCurto(FALLBACK_LAYOUT, current.room) : null;
  const positionFresh = readingFresh(device.lastUpdate);
  const pending = alerts.filter((a) => a.status !== "RESOLVED");
  return (
    <div className="monitoring-workspace">
      <section className="activity-hero">
        <div>
          <span className="workspace-eyebrow">
            <ActivityIcon size={18} /> AGORA · EQUIPAMENTO REAL
          </span>
          <h1>
            {activityText({ ...current, room: room ? naNo(room) : undefined })}
          </h1>
          <p>
            {current.source ?? "Aguardando equipamento"}
            {current.observedAt
              ? ` · ${haQuanto(current.observedAt)}`
              : " · configure o equipamento para começar"}
          </p>
        </div>
        <span className={`selo ${fresh ? "is-sucesso" : "is-neutro"}`}>
          {fresh
            ? "Leitura recente"
            : current.state === "WAITING"
              ? "Primeira configuração"
              : "Verificar atualização"}
        </span>
      </section>
      {error && (
        <p className="nota is-aviso" role="alert">
          {error}
        </p>
      )}
      <section className="painel workspace-card">
        <div className="workspace-card-heading">
          <div>
            <span className="workspace-eyebrow">SEUS EQUIPAMENTOS</span>
            <h2>Conexões independentes</h2>
          </div>
          <button
            className="btn btn-secundario"
            disabled={busy}
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw size={16} /> Verificar conexão
          </button>
        </div>
        <div className="connection-grid">
          {[
            ["cane", "Bengala", ActivityIcon],
            ["robot", "Robô", Bot],
            ["camera", "Câmera", Camera],
            ["vision", "Detector", ActivityIcon],
          ].map(([id, label, Icon]) => {
            const c = connections[id as string];
            const online = connectionOnline(id as string, c, !!error);
            const I = Icon as typeof Bot;
            return (
              <article key={id as string}>
                <I size={21} />
                <strong>{label as string}</strong>
                <span
                  className={
                    online ? "connection-online" : "connection-waiting"
                  }
                >
                  {error
                    ? "Não verificado"
                    : online
                      ? "Conectado"
                      : c?.lastSeen
                        ? "Sem atualização"
                        : "Aguardando configuração"}
                </span>
                <small>
                  {c?.lastSeen
                    ? `Última notícia ${haQuanto(c.lastSeen)}`
                    : "Ainda não recebemos a primeira leitura"}
                </small>
              </article>
            );
          })}
        </div>
        {!device.lastUpdate && (
          <div className="workspace-connect-guide">
            <h3>Comece conectando o equipamento</h3>
            <ol>
              <li>
                Abra Configurações e confira o identificador da bengala e a
                chave do equipamento.
              </li>
              <li>
                Configure a bengala, o robô e o serviço de câmera com os dados
                desta família.
              </li>
              <li>
                Ligue os serviços e clique em “Verificar conexão”. Cada
                equipamento confirma sua própria conexão.
              </li>
            </ol>
            <p className="texto-pequeno">
              Criar a conta prepara o vínculo da família. A conexão física
              começa quando o equipamento envia a primeira leitura.
            </p>
            <button className="btn btn-secundario" onClick={onSettings}>
              Configurar equipamentos <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
      <div className="workspace-stats">
        <article>
          <Battery />
          <span>Bateria da bengala</span>
          <strong>
            {device.batteryPercent == null
              ? "Aguardando leitura"
              : `${Math.round(device.batteryPercent)}%`}
          </strong>
        </article>
        <article>
          <ActivityIcon />
          <span>Alertas para verificar</span>
          <strong>{pending.length}</strong>
        </article>
        <article>
          <Clock />
          <span>Última leitura</span>
          <strong>
            {device.lastUpdate
              ? haQuanto(device.lastUpdate)
              : "Ainda não recebida"}
          </strong>
        </article>
      </div>
      <div className="workspace-columns">
        <section className="painel workspace-card">
          <div className="workspace-card-heading">
            <div>
              <span className="workspace-eyebrow">DENTRO DE CASA</span>
              <h2>Último cômodo informado</h2>
            </div>
            <span className="selo is-neutro">Planta de referência</span>
          </div>
          <PlantaCasa
            layout={FALLBACK_LAYOUT}
            comodoPessoa={room ? current.room : null}
            estados={
              room
                ? {
                    [current.room!]: {
                      titulo: `Última leitura de ${current.personName}`,
                      tom: "pessoa",
                    },
                  }
                : {}
            }
          />
          <p className="texto-pequeno">
            {room
              ? `Observação ${naNo(room)} · ${haQuanto(current.observedAt)}`
              : "Aguardando localização interna. O GPS não identifica cômodos."}{" "}
            A planta precisa corresponder à casa para representar os cômodos
            reais.
          </p>
        </section>
        <section className="painel workspace-card">
          <span className="workspace-eyebrow">ENDEREÇO E GPS</span>
          <h2>Casa e posição recebida</h2>
          {prefs.home?.confirmed ? (
            <>
              <p>{prefs.endereco}</p>
              <MapaSaidas
                casa={prefs.areas[0]}
                pessoa={{
                  lat: positionFresh ? device.currentLatitude : NaN,
                  lng: positionFresh ? device.currentLongitude : NaN,
                }}
                rota={route}
                satelite={false}
              />
              <p className="texto-pequeno">
                {positionFresh
                  ? "Marcador da pessoa: última posição enviada pela bengala."
                  : "Sem posição recente da pessoa. O mapa mostra a casa e, quando disponível, o trajeto anterior."}
              </p>
            </>
          ) : (
            <div className="workspace-empty">
              <MapPin size={28} />
              <p>
                Configure o endereço para mostrar sua casa no mapa, mesmo antes
                da primeira leitura de GPS.
              </p>
              <button className="btn btn-secundario" onClick={onConfigureHome}>
                Configurar endereço
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="painel workspace-card">
        <div className="workspace-card-heading">
          <div>
            <span className="workspace-eyebrow">HISTÓRICO DA FAMÍLIA</span>
            <h2>Últimos acontecimentos</h2>
          </div>
          <button className="btn-link" onClick={onSettings}>
            Histórico completo e atendimento
          </button>
        </div>
        {alerts.length ? (
          <ol className="workspace-timeline">
            {alerts.slice(0, 8).map((a) => (
              <li key={a.id}>
                <time>{new Date(a.createdAt).toLocaleString("pt-BR")}</time>
                <div>
                  <strong>{a.message || a.alertType}</strong>
                  <p>
                    {a.status === "RESOLVED"
                      ? "Atendimento encerrado"
                      : "Aguardando verificação do familiar"}
                  </p>
                  {a.status !== "RESOLVED" && (
                    <button
                      className="btn btn-secundario"
                      onClick={() => onResolve(a.id)}
                    >
                      Confirmar encerramento
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="workspace-empty">
            Nenhum acontecimento registrado. Novas leituras e alertas aparecerão
            aqui.
          </p>
        )}
      </section>
      <LocalAnalysis deviceId={device.deviceId} />
    </div>
  );
}
