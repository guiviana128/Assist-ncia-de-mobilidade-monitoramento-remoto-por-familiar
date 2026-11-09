// Central de cuidado da família (Configurações): conexões, alertas, gestos, análise local e
// configuração do equipamento, cada um num painel no padrão das outras seções. "Contato da pessoa
// acompanhada" e "Convidar familiar" são seções próprias, com entrada no índice lateral.
import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cuidado, useCuidado } from "../lib/cuidado";
import { apiJson } from "../services/auth";
import { formatarTelefone, telefoneValido } from "./cadastro/regras";

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
type Contagem = { alerts: number; vision: number; pageSize: number };

const NOME_EQUIPAMENTO: Record<string, string> = {
  cane: "Bengala",
  camera: "Câmera",
  vision: "Reconhecimento de gestos",
  robot: "Robô",
};
const DECISAO: Record<string, string> = {
  CONFIRMED: "Pedido confirmado",
  FALSE_POSITIVE: "Foi engano",
  CANCELED: "Proposta cancelada",
};
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Painel no padrão das Configurações: título Outfit 20, descrição e conteúdo. */
const Bloco: React.FC<{
  id: string;
  titulo: string;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, titulo, descricao, acao, children }) => (
  <section id={`cfg-${id}`} className="painel config-secao central-bloco" aria-labelledby={`t-${id}`}>
    <div className="config-cabecalho">
      <div>
        <h2 id={`t-${id}`} className="titulo-painel">
          {titulo}
        </h2>
        {descricao && <p className="config-descricao">{descricao}</p>}
      </div>
      {acao}
    </div>
    {children}
  </section>
);

/** "Mais recentes · Página 1 de N · Mais antigos". */
const Paginacao: React.FC<{
  pagina: number;
  total: number;
  ocupado: boolean;
  onMudar: (p: number) => void;
  rotulo: string;
}> = ({ pagina, total, ocupado, onMudar, rotulo }) =>
  total <= 1 ? null : (
    <nav className="central-paginacao" aria-label={rotulo}>
      <button
        type="button"
        className="btn btn-secundario"
        disabled={pagina === 0 || ocupado}
        onClick={() => onMudar(pagina - 1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
        Mais recentes
      </button>
      <span className="central-pagina" aria-live="polite">
        Página {pagina + 1} de {total}
      </span>
      <button
        type="button"
        className="btn btn-secundario"
        disabled={pagina >= total - 1 || ocupado}
        onClick={() => onMudar(pagina + 1)}
      >
        Mais antigos
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );

/** Blocos da central (dados do aparelho, atualizados a cada 10 s). */
export function FamilyCare({ deviceId }: { deviceId: string }) {
  const [alerts, setAlerts] = useState<CareAlert[]>([]),
    [vision, setVision] = useState<Vision[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [actions, setActions] = useState<Action[]>([]),
    [connections, setConnections] = useState<Connections>({}),
    [contagem, setContagem] = useState<Contagem>({ alerts: 0, vision: 0, pageSize: 50 });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [pageGestos, setPageGestos] = useState(0),
    [key, setKey] = useState("");
  const [notifications, setNotifications] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const path = `/care/${encodeURIComponent(deviceId)}`;
  const refresh = async () => {
    const [a, v, r, c, ac, n] = await Promise.all([
      apiJson<CareAlert[]>(`${path}/alerts?page=${page}`),
      apiJson<Vision[]>(`${path}/vision?page=${pageGestos}`),
      apiJson<Report[]>(`${path}/reports`),
      apiJson<Connections>(`${path}/connections`),
      apiJson<Action[]>(`/ai/agent/actions/device/${encodeURIComponent(deviceId)}`),
      apiJson<Contagem>(`${path}/history/count`).catch(() => null),
    ]);
    setAlerts(a);
    setVision(v);
    setReports(r);
    setConnections(c);
    setActions(ac);
    if (n) setContagem(n);
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
        if (active) setError(e instanceof Error ? e.message : "Não foi possível atualizar");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, page, pageGestos]);
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
  const paginas = (n: number) => Math.max(1, Math.ceil(n / (contagem.pageSize || 50)));
  // Alertas e gestos paginam separados (50 por página), cada um com o próprio total.
  const paginasAlertas = Math.max(paginas(contagem.alerts), page + 1);
  const paginasGestos = Math.max(paginas(contagem.vision), pageGestos + 1);
  const decidir = (id: number, approved: boolean) =>
    void run(() =>
      apiJson(`/ai/agent/actions/${id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reviewedBy: "sessao" }),
      }),
    );

  return (
    <>
      <header className="central-titulo" id="cfg-central">
        <h2 className="titulo-painel">Central de cuidado da família</h2>
        <p className="config-descricao">
          Histórico salvo, atendimento e análise local. As decisões continuam com você.
        </p>
        {error && (
          <p className="nota is-perigo" role="alert">
            {error}
          </p>
        )}
      </header>

      <Bloco
        id="central-conexoes"
        titulo="Conexões dos equipamentos"
        descricao="A câmera pode continuar com o navegador fechado pelo serviço de captura instalado no computador."
      >
        <ul className="config-lista">
          {Object.entries(connections).map(([c, s]) => (
            <li key={c}>
              <span className="config-textos">
                <strong>{NOME_EQUIPAMENTO[c] ?? c}</strong>
                <span>{s.lastSeen ? `Último sinal ${dataHora(s.lastSeen)}` : "Ainda sem sinal"}</span>
              </span>
              <span className={`selo ${s.online ? "is-sucesso" : s.lastSeen ? "is-aviso" : "is-neutro"}`}>
                {s.online ? "Conectado" : s.lastSeen ? "Sem atualização" : "Aguardando conexão"}
              </span>
            </li>
          ))}
          <li>
            <span className="config-textos">
              <strong>Notificações neste navegador</strong>
              <span>Exigem o painel aberto. O histórico fica salvo mesmo com o painel fechado.</span>
            </span>
            <button
              type="button"
              className="btn btn-secundario"
              disabled={notifications || typeof Notification === "undefined"}
              onClick={() =>
                void Notification.requestPermission().then((p) => setNotifications(p === "granted"))
              }
            >
              {notifications ? "Ativadas" : "Ativar"}
            </button>
          </li>
        </ul>
      </Bloco>

      <Bloco
        id="central-alertas"
        titulo="Alertas e atendimento"
        descricao="Quem está cuidando de cada alerta e o que foi avisado."
      >
        {alerts.length === 0 ? (
          <p className="central-vazio">Nenhum alerta nesta página.</p>
        ) : (
          <ul className="config-lista">
            {alerts.map((a) => (
              <li key={a.id} className="central-item">
                <span className="config-textos">
                  <strong>{a.message || a.alertType}</strong>
                  <span>
                    {dataHora(a.createdAt)} · {a.status === "RESOLVED" ? "Encerrado" : "Pendente"} ·{" "}
                    {a.acknowledgedBy ? `Atendimento: ${a.acknowledgedBy}` : "Aguardando familiar"}
                    {a.resolvedBy ? ` · Encerrado por ${a.resolvedBy}` : ""}
                  </span>
                  <span>
                    Notificação:{" "}
                    {a.notificationState === "PROVIDER_ACCEPTED"
                      ? "aceita pelo provedor"
                      : a.notificationState === "FAILED"
                        ? "falhou; disponível no painel"
                        : "disponível no painel"}
                  </span>
                </span>
                {a.status !== "RESOLVED" && (
                  <div className="central-acoes">
                    <button
                      type="button"
                      className="btn btn-secundario"
                      disabled={busy || !!a.acknowledgedBy}
                      onClick={() => void run(() => apiJson(`/alerts/${a.id}/acknowledge`, { method: "PATCH" }))}
                    >
                      Estou cuidando
                    </button>
                    <button
                      type="button"
                      className="btn btn-secundario"
                      disabled={busy}
                      onClick={() => void run(() => apiJson(`/alerts/${a.id}/resolve`, { method: "PATCH" }))}
                    >
                      Encerrar atendimento
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Paginacao pagina={page} total={paginasAlertas} ocupado={busy} onMudar={setPage} rotulo="Páginas dos alertas" />
      </Bloco>

      <Bloco
        id="central-gestos"
        titulo="Gestos registrados"
        descricao="Pedidos de ajuda reconhecidos pela câmera. Confirme ou marque como engano."
      >
        {vision.length === 0 ? (
          <p className="central-vazio">Nenhum gesto registrado nesta página.</p>
        ) : (
          <ul className="config-lista">
            {vision.map((v) => (
              <li key={v.eventId} className="central-item">
                <span className="config-textos">
                  <strong>
                    {v.reviewDecision ? DECISAO[v.reviewDecision] ?? v.reviewDecision : "Revisão pendente"}
                  </strong>
                  <span>
                    {dataHora(v.receivedAt)} · Confiança informada: {Math.round(v.confidence * 100)}%
                    {v.reviewedBy ? ` · Revisado por ${v.reviewedBy}` : ""}
                  </span>
                </span>
                {!v.reviewDecision && (
                  <div className="central-acoes">
                    {[
                      ["CONFIRMED", "Confirmei o pedido"],
                      ["FALSE_POSITIVE", "Foi engano"],
                      ["CANCELED", "Cancelar proposta"],
                    ].map(([d, label]) => (
                      <button
                        type="button"
                        key={d}
                        className="btn btn-secundario"
                        disabled={busy}
                        onClick={() =>
                          void run(() => apiJson(`${path}/vision/${v.eventId}/review?decision=${d}`, { method: "PATCH" }))
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Paginacao pagina={pageGestos} total={paginasGestos} ocupado={busy} onMudar={setPageGestos} rotulo="Páginas dos gestos" />
      </Bloco>

      <Bloco
        id="central-analise"
        titulo="Análise local (Ollama)"
        descricao="Analisa as leituras a cada cinco minutos enquanto o servidor estiver ligado. Dados insuficientes não permitem concluir uma mudança de rotina."
      >
        <div className="central-acoes">
          <button
            type="button"
            className="btn btn-primario"
            disabled={busy}
            onClick={() => void run(() => apiJson(`${path}/analyze`, { method: "POST" }))}
          >
            {busy ? "Aguarde…" : "Atualizar resumo"}
          </button>
          <button
            type="button"
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
        </div>
        {(reports.length > 0 || actions.length > 0) && (
          <ul className="config-lista">
            {reports.slice(0, 5).map((r) => (
              <li key={`r${r.id}`} className="central-item">
                <span className="config-textos">
                  <strong>{r.state === "AVAILABLE" ? `Resumo · ${r.model ?? "IA local"}` : "IA sem conexão"}</strong>
                  <span>{dataHora(r.createdAt)}</span>
                  <span className="central-resumo">{r.summary}</span>
                </span>
              </li>
            ))}
            {actions.map((a) => (
              <li key={`a${a.id}`} className="central-item">
                <span className="config-textos">
                  <strong>{a.summary}</strong>
                  <span>{a.justification}</span>
                  <span>
                    {a.status === "PENDING_APPROVAL" ? "Aguardando sua aprovação" : a.status} · {a.actionType}
                  </span>
                </span>
                {a.status === "PENDING_APPROVAL" && (
                  <div className="central-acoes">
                    <button type="button" className="btn btn-secundario" disabled={busy} onClick={() => decidir(a.id, true)}>
                      Aprovar sugestão
                    </button>
                    <button type="button" className="btn btn-secundario" disabled={busy} onClick={() => decidir(a.id, false)}>
                      Rejeitar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco
        id="central-equipamento"
        titulo="Configurar o equipamento"
        descricao="Código e chave usados pela bengala, pela câmera e pelo robô."
      >
        <ul className="config-lista">
          <li>
            <span className="config-textos">
              <strong>Dispositivo</strong>
              <span>
                <code>{deviceId}</code>
              </span>
            </span>
          </li>
          <li className="central-item">
            <span className="config-textos">
              <strong>Gerar nova chave do equipamento</strong>
              <span>
                A chave atual deixa de funcionar. Será preciso atualizar a bengala e o serviço de câmera.
              </span>
            </span>
            <div className="central-acoes">
              <button
                type="button"
                className="btn btn-secundario"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await apiJson<{ deviceKey: string }>(`/care/devices/${deviceId}/key`, { method: "POST" });
                    setKey(r.deviceKey);
                  })
                }
              >
                Substituir chave
              </button>
            </div>
          </li>
        </ul>
        {key && (
          <p className="central-codigo">
            Guarde agora: <code>{key}</code>
          </p>
        )}
      </Bloco>
    </>
  );
}

/** Seção "Contato da pessoa acompanhada" (índice lateral das Configurações). */
export function ContatoPessoa({ pessoa }: { pessoa: string }) {
  const prefs = useCuidado();
  const [telefone, setTelefone] = useState(""),
    [endereco, setEndereco] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [msg, setMsg] = useState<{ tom: "sucesso" | "perigo"; texto: string } | null>(null);
  useEffect(() => {
    setTelefone(formatarTelefone(prefs.personPhone || prefs.telefonePessoa || ""));
    setEndereco(prefs.endereco === "Não cadastrado" ? "" : prefs.endereco);
  }, [prefs.personPhone, prefs.telefonePessoa, prefs.endereco]);
  const telefoneOk = telefoneValido(telefone);
  const salvar = async () => {
    if (!telefoneOk) {
      setMsg({ tom: "perigo", texto: "Use DDD e número, ex.: (11) 98123-4567." });
      return;
    }
    setOcupado(true);
    setMsg(null);
    const ok = await cuidado.definirContato(telefone, endereco.trim() || "Não cadastrado");
    setOcupado(false);
    setMsg(ok ? { tom: "sucesso", texto: "Contato salvo." } : { tom: "perigo", texto: cuidado.erro() || "Não foi possível salvar." });
  };
  return (
    <Bloco
      id="contato-pessoa"
      titulo="Contato da pessoa acompanhada"
      descricao={`Usado no botão “Ligar para ${pessoa}” e no endereço passado ao socorro.`}
    >
      <div className="central-campos">
        <label className="campo">
          <span className="campo-rotulo">Telefone com DDD</span>
          <input
            className="campo-entrada"
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => {
              setTelefone(formatarTelefone(e.target.value));
              setMsg(null);
            }}
            placeholder="(11) 98123-4567"
            maxLength={16}
            aria-invalid={msg?.tom === "perigo" && !telefoneOk ? true : undefined}
          />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Endereço para atendimento</span>
          <input
            className="campo-entrada"
            value={endereco}
            onChange={(e) => {
              setEndereco(e.target.value);
              setMsg(null);
            }}
            maxLength={200}
          />
        </label>
      </div>
      <div className="central-rodape">
        {msg && (
          <p className={`texto-pequeno is-${msg.tom}`} role={msg.tom === "perigo" ? "alert" : "status"}>
            {msg.texto}
          </p>
        )}
        <button type="button" className="btn btn-secundario" disabled={ocupado} onClick={() => void salvar()}>
          {ocupado ? "Salvando…" : "Salvar contato"}
        </button>
      </div>
    </Bloco>
  );
}

/** Seção "Convidar familiar ou cuidador" (índice lateral das Configurações). */
export function ConvidarFamiliar() {
  const [convite, setConvite] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [erro, setErro] = useState("");
  const gerar = async () => {
    setOcupado(true);
    setErro("");
    try {
      const r = await apiJson<{ invite: string }>("/care/invite", { method: "POST" });
      setConvite(r.invite);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o convite.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Bloco
      id="convite"
      titulo="Convidar familiar ou cuidador"
      descricao="O convite dá acesso aos dados e ao atendimento desta família. É de uso único e vale por 24 horas."
      acao={
        <button type="button" className="btn btn-secundario" disabled={ocupado} onClick={() => void gerar()}>
          {ocupado ? "Gerando…" : "Gerar convite"}
        </button>
      }
    >
      {erro && (
        <p className="nota is-perigo" role="alert">
          {erro}
        </p>
      )}
      {convite && (
        <p className="central-codigo">
          Envie este código ao familiar: <code>{convite}</code>. Ele usa em “Recebi um convite”, ao criar a conta.
        </p>
      )}
    </Bloco>
  );
}
