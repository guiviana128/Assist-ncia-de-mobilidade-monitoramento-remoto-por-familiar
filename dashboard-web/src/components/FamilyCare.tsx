import { useEffect, useState } from "react";
import { cuidado, useCuidado } from "../lib/cuidado";
import { apiJson } from "../services/auth";
type CareAlert = {
  id: number;
  alertType: string;
  message: string;
  status: string;
  createdAt: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  notificationState?: string;
};
type Vision = {
  eventId: string;
  receivedAt: string;
  confidence: number;
  reviewDecision?: string;
  reviewedBy?: string;
};
type Report = {
  id: number;
  state: string;
  summary: string;
  createdAt: string;
  model?: string;
};
type Action = {
  id: number;
  summary: string;
  justification: string;
  status: string;
  actionType: string;
};
type Connections = Record<
  string,
  { online: boolean; lastSeen: string; state?: string }
>;
export function FamilyCare({ deviceId }: { deviceId: string }) {
  const [alerts, setAlerts] = useState<CareAlert[]>([]),
    [vision, setVision] = useState<Vision[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [actions, setActions] = useState<Action[]>([]),
    [connections, setConnections] = useState<Connections>({});
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [key, setKey] = useState(""),
    [invite, setInvite] = useState("");
  const [notifications, setNotifications] = useState(
    typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  );
  const prefs = useCuidado();
  const [telefone, setTelefone] = useState(""),
    [endereco, setEndereco] = useState("");
  const path = `/care/${encodeURIComponent(deviceId)}`;
  const refresh = async () => {
    const [a, v, r, c, ac] = await Promise.all([
      apiJson<CareAlert[]>(`${path}/alerts?page=${page}`),
      apiJson<Vision[]>(`${path}/vision?page=${page}`),
      apiJson<Report[]>(`${path}/reports`),
      apiJson<Connections>(`${path}/connections`),
      apiJson<Action[]>(
        `/ai/agent/actions/device/${encodeURIComponent(deviceId)}`,
      ),
    ]);
    setAlerts(a);
    setVision(v);
    setReports(r);
    setConnections(c);
    setActions(ac);
  };
  useEffect(() => {
    let active = true;
    let working = false;
    const update = async () => {
      if (working) return;
      working = true;
      try {
        if (active) await refresh();
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Não foi possível atualizar",
          );
      } finally {
        working = false;
      }
    };
    void update();
    const t = setInterval(() => void update(), 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [deviceId, page]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="painel"
      aria-label="Central de cuidado"
      style={{ marginTop: 20, padding: 24 }}
    >
      <h2 className="titulo-painel">Central de cuidado da família</h2>
      <p>
        Histórico salvo, atendimento e análise local. As decisões continuam com
        você.
      </p>
      {error && (
        <p className="nota is-perigo" role="alert">
          {error}
        </p>
      )}
      <h3>Conexões dos equipamentos</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Object.entries(connections).map(([c, s]) => (
          <span className="selo" key={c}>
            {
              (
                {
                  cane: "Bengala",
                  camera: "Câmera",
                  vision: "Visão",
                  robot: "Robô",
                } as Record<string, string>
              )[c]
            }
            :{" "}
            {s.online
              ? "conectado"
              : s.lastSeen
                ? "sem atualização"
                : "aguardando conexão"}
          </span>
        ))}
      </div>
      <p className="texto-pequeno">
        A câmera pode continuar com o navegador fechado pelo serviço de captura
        instalado no computador. A imagem do robô nesta interface é uma
        simulação.
      </p>
      <button
        className="btn btn-secundario"
        disabled={notifications || typeof Notification === "undefined"}
        onClick={() =>
          void Notification.requestPermission().then((p) =>
            setNotifications(p === "granted"),
          )
        }
      >
        {notifications
          ? "Notificações deste navegador ativadas"
          : "Ativar notificações neste navegador"}
      </button>
      <p className="texto-pequeno">
        Notificações do navegador exigem o painel aberto. O histórico fica salvo
        mesmo com o painel fechado. Push externo depende da configuração do
        Firebase.
      </p>
      <h3>Alertas e atendimento</h3>
      {alerts.length === 0 ? (
        <p>Nenhum alerta nesta página.</p>
      ) : (
        alerts.map((a) => (
          <article
            key={a.id}
            style={{ borderTop: "1px solid #ddd", padding: "14px 0" }}
          >
            <strong>{a.message || a.alertType}</strong>
            <p className="texto-pequeno">
              {new Date(a.createdAt).toLocaleString("pt-BR")} ·{" "}
              {a.status === "RESOLVED" ? "Encerrado" : "Pendente"} ·{" "}
              {a.acknowledgedBy
                ? `Atendimento: ${a.acknowledgedBy}`
                : "Aguardando familiar"}
              {a.resolvedBy ? ` · Encerrado por ${a.resolvedBy}` : ""}
            </p>
            <p className="texto-pequeno">
              Notificação:{" "}
              {a.notificationState === "PROVIDER_ACCEPTED"
                ? "aceita pelo provedor"
                : a.notificationState === "FAILED"
                  ? "falhou; disponível no painel"
                  : "disponível no painel"}
            </p>
            {a.status !== "RESOLVED" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secundario"
                  disabled={busy || !!a.acknowledgedBy}
                  onClick={() =>
                    void run(() =>
                      apiJson(`/alerts/${a.id}/acknowledge`, {
                        method: "PATCH",
                      }),
                    )
                  }
                >
                  Estou cuidando
                </button>
                <button
                  className="btn btn-secundario"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      apiJson(`/alerts/${a.id}/resolve`, { method: "PATCH" }),
                    )
                  }
                >
                  Encerrar atendimento
                </button>
              </div>
            )}
          </article>
        ))
      )}
      <h3>Gestos registrados</h3>
      {vision.length === 0 ? (
        <p>Nenhum gesto registrado nesta página.</p>
      ) : (
        vision.map((v) => (
          <article key={v.eventId}>
            <p>
              {new Date(v.receivedAt).toLocaleString("pt-BR")} · Confiança
              informada: {Math.round(v.confidence * 100)}% ·{" "}
              {v.reviewDecision ?? "Revisão pendente"} {v.reviewedBy}
            </p>
            {!v.reviewDecision && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["CONFIRMED", "Confirmei o pedido"],
                  ["FALSE_POSITIVE", "Foi engano"],
                  ["CANCELED", "Cancelar proposta"],
                ].map(([d, label]) => (
                  <button
                    key={d}
                    className="btn btn-secundario"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        apiJson(
                          `${path}/vision/${v.eventId}/review?decision=${d}`,
                          { method: "PATCH" },
                        ),
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))
      )}
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button
          className="btn btn-secundario"
          disabled={page === 0 || busy}
          onClick={() => setPage((p) => p - 1)}
        >
          Mais recentes
        </button>
        <span>Página {page + 1}</span>
        <button
          className="btn btn-secundario"
          disabled={busy || (alerts.length < 50 && vision.length < 50)}
          onClick={() => setPage((p) => p + 1)}
        >
          Mais antigos
        </button>
      </div>
      <h3>Análise local · Ollama</h3>
      <p>
        Analisa as leituras disponíveis a cada cinco minutos enquanto o servidor
        estiver ligado. Dados insuficientes não permitem concluir uma mudança de
        rotina.
      </p>
      <button
        className="btn btn-primario"
        disabled={busy}
        onClick={() =>
          void run(() => apiJson(`${path}/analyze`, { method: "POST" }))
        }
      >
        {busy ? "Aguarde…" : "Atualizar resumo"}
      </button>
      <button
        className="btn btn-secundario"
        disabled={busy}
        onClick={() =>
          void run(() =>
            apiJson("/ai/agent/run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceId }),
            }),
          )
        }
      >
        Pedir sugestão supervisionada
      </button>
      {reports.slice(0, 5).map((r) => (
        <article key={r.id}>
          <p className="texto-pequeno">
            {new Date(r.createdAt).toLocaleString("pt-BR")} ·{" "}
            {r.state === "AVAILABLE" ? r.model : "IA sem conexão"}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.summary}</p>
        </article>
      ))}
      {actions.map((a) => (
        <article key={a.id}>
          <strong>{a.summary}</strong>
          <p>{a.justification}</p>
          <p>
            {a.status} · {a.actionType}
          </p>
          {a.status === "PENDING_APPROVAL" && (
            <div>
              <button
                className="btn btn-secundario"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    apiJson(`/ai/agent/actions/${a.id}/decision`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        approved: true,
                        reviewedBy: "sessao",
                      }),
                    }),
                  )
                }
              >
                Aprovar sugestão
              </button>
              <button
                className="btn btn-secundario"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    apiJson(`/ai/agent/actions/${a.id}/decision`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        approved: false,
                        reviewedBy: "sessao",
                      }),
                    }),
                  )
                }
              >
                Rejeitar
              </button>
            </div>
          )}
        </article>
      ))}
      <h3>Contato da pessoa acompanhada</h3>
      <p>
        Atual: {prefs.telefonePessoa || "Telefone não cadastrado"} ·{" "}
        {prefs.endereco}
      </p>
      <label>
        Telefone com DDD
        <input
          className="campo-entrada"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          maxLength={30}
        />
      </label>
      <label>
        Endereço para atendimento
        <input
          className="campo-entrada"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          maxLength={200}
        />
      </label>
      <button
        className="btn btn-secundario"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (!(await cuidado.definirContato(telefone, endereco)))
              throw new Error(cuidado.erro());
          })
        }
      >
        Salvar contato
      </button>
      <h3>Convidar familiar ou cuidador</h3>
      <p>
        O convite dá acesso aos dados e ao atendimento desta família. É de uso
        único e vale por 24 horas.
      </p>
      <button
        className="btn btn-secundario"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const r = await apiJson<{ invite: string }>("/care/invite", {
              method: "POST",
            });
            setInvite(r.invite);
          })
        }
      >
        Gerar convite
      </button>
      {invite && (
        <p style={{ overflowWrap: "anywhere" }}>
          Envie este código ao familiar: <code>{invite}</code>. Ele deve usá-lo
          ao criar a conta.
        </p>
      )}
      <h3>Configurar o equipamento</h3>
      <p>
        Dispositivo: <code>{deviceId}</code>
      </p>
      <details>
        <summary>Gerar nova chave do equipamento</summary>
        <p>
          A chave atual deixará de funcionar. Será necessário atualizar a
          configuração da bengala e do serviço de câmera.
        </p>
        <button
          className="btn btn-secundario"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await apiJson<{ deviceKey: string }>(
                `/care/devices/${deviceId}/key`,
                { method: "POST" },
              );
              setKey(r.deviceKey);
            })
          }
        >
          Substituir chave
        </button>
        {key && (
          <p style={{ overflowWrap: "anywhere" }}>
            Guarde agora: <code>{key}</code>
          </p>
        )}
      </details>
    </section>
  );
}
