import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Footprints, Info, Layers, MapPin, Route } from "lucide-react";
import type { Alert, DeviceStatus, TelemetryPoint } from "../../types";
import { GraficoPassos, GraficoTremor } from "./Graficos";
import { MapaSaidas } from "./MapaSaidas";
import { Fato } from "../ui/LinhaDoTempo";
import {
  formatarKm,
  formatarNumero,
  km,
  media,
  META_PASSOS,
  passosHoje,
  passosPorDia,
  tremor,
  type Periodo,
} from "../../lib/historico";
import { haQuanto, nomePessoa } from "../../lib/resumoDoEstado";
import { horaCurta } from "../../lib/avisos";
import { useCuidado } from "../../lib/cuidado";
import { CELULAR, useMediaQuery } from "../../hooks/useMediaQuery";
import { Contador } from "../../motion/Contador";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";

/** Barras e nota de mobilidade só animam a entrada na primeira vez que a tela aparece na sessão. */
const sessao = { primeiraVisita: true };

interface MonitorarViewProps {
  device: DeviceStatus;
  alerts: Alert[];
  routeHistory: TelemetryPoint[];
  routeDemo: boolean;
  demo: boolean;
}

type EstadoSensor = "ok" | "atencao" | "sem-leitura";
interface Sensor {
  nome: string;
  detalhe: string;
  status: string;
  estado: EstadoSensor;
}

const dataCurta = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
const dataMuitoCurta = (d: Date) =>
  d
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
    .replace(".", "");
const metros = (cm: number) => `${(cm / 100).toFixed(2).replace(".", ",")} m`;

/** Distância percorrida pela rota (haversine), em km. */
function distanciaRota(rota: TelemetryPoint[]) {
  let total = 0;
  for (let i = 1; i < rota.length; i++) {
    const a = rota[i - 1]!,
      b = rota[i]!;
    const r = 6371,
      dLat = ((b.latitude - a.latitude) * Math.PI) / 180,
      dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += 2 * r * Math.asin(Math.sqrt(h));
  }
  return total;
}

const SAIDAS_EXEMPLO = {
  "7": [
    {
      quando: "Hoje",
      titulo: "Padaria e praça",
      detalhe: "16:20 a 17:00 · 1,2 km · no ritmo de sempre",
      destaque: true,
    },
    { quando: "Ter", titulo: "Farmácia", detalhe: "09:10 a 09:45 · 0,8 km" },
    {
      quando: "Sáb",
      titulo: "Feira de sábado",
      detalhe: "08:30 a 09:40 · 1,5 km",
    },
  ],
  "30": [
    {
      quando: "9×",
      titulo: "Padaria",
      detalhe: "quase todo dia, no fim da tarde",
    },
    {
      quando: "6×",
      titulo: "Praça do bairro",
      detalhe: "caminhada de 10 a 20 min",
    },
    {
      quando: "4×",
      titulo: "Feira de sábado",
      detalhe: "manhã, ida e volta em 1 h",
    },
    { quando: "3×", titulo: "Farmácia", detalhe: "a 600 m · a mais longe" },
  ],
};

/** Tela Monitorar (Figma 21:1004, 21:1234, 35:2471): junta Telemetria e o mapa da antiga Visão geral. */
export const MonitorarView: React.FC<MonitorarViewProps> = ({
  device,
  alerts,
  routeHistory,
  routeDemo,
  demo,
}) => {
  const celular = useMediaQuery(CELULAR);
  const { areas } = useCuidado();
  const [periodo, setPeriodo] = useState<Periodo>("7");
  const [satelite, setSatelite] = useState(false);
  const [todosSensores, setTodosSensores] = useState(false);
  const [todasSaidas, setTodasSaidas] = useState(false);
  const pessoa = nomePessoa(device);
  const agora = new Date();
  const casa = areas[0]!;
  const passosHojeReal = device.stepsToday;
  const primeira = useRef(sessao.primeiraVisita);
  useEffect(() => {
    sessao.primeiraVisita = false;
  }, []);

  // ---- passos
  const dias = periodo === "30" ? 30 : 7;
  const historico = useMemo(
    () =>
      passosPorDia(periodo === "hoje" ? 7 : dias * 2, passosHojeReal, agora),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodo, passosHojeReal, agora.toDateString()],
  );
  const atual =
    periodo === "hoje" ? historico.slice(-1) : historico.slice(-dias);
  const anterior =
    periodo === "hoje"
      ? historico.slice(-2, -1)
      : historico.slice(-dias * 2, -dias);
  const hojeValor = atual[atual.length - 1]?.valor ?? 0;
  const mediaAtual = media(atual.map((b) => b.valor));
  const variacao = anterior.length
    ? (mediaAtual - media(anterior.map((b) => b.valor))) /
      media(anterior.map((b) => b.valor))
    : 0;
  const barras =
    periodo === "hoje"
      ? passosHoje(hojeValor, agora)
      : celular
        ? atual.slice(-7)
        : atual;
  const diasNaMeta = atual.filter((b) => b.valor >= META_PASSOS).length;

  const inicioPeriodo = new Date(agora);
  inicioPeriodo.setDate(agora.getDate() - (periodo === "hoje" ? 0 : dias - 1));
  inicioPeriodo.setHours(0, 0, 0, 0);
  const noPeriodo = (a: Alert) => new Date(a.createdAt) >= inicioPeriodo;

  // ---- frase
  const pct = Math.round(Math.abs(variacao) * 100);
  const frase =
    periodo === "hoje"
      ? hojeValor >= META_PASSOS
        ? {
            forte: `Hoje, ${formatarNumero(hojeValor)} passos.`,
            apoio: ` ${pessoa} já passou da meta de ${formatarNumero(META_PASSOS)}.`,
          }
        : {
            forte: `Hoje, ${formatarNumero(hojeValor)} passos.`,
            apoio: ` Faltam ${formatarNumero(META_PASSOS - hojeValor)} para a meta.`,
          }
      : periodo === "7"
        ? variacao >= 0.05
          ? {
              forte: "Semana boa.",
              apoio: ` ${pessoa} caminhou ${pct}% mais que na semana passada.`,
            }
          : variacao <= -0.05
            ? {
                forte: "Semana mais parada.",
                apoio: ` ${pessoa} caminhou ${pct}% menos que na semana passada.`,
              }
            : {
                forte: "Semana estável.",
                apoio: ` ${pessoa} manteve uns ${formatarNumero(mediaAtual)} passos por dia.`,
              }
        : variacao >= 0.05
          ? {
              forte: "Mês bom.",
              apoio: ` ${pessoa} caminhou ${pct}% mais que no mês anterior.`,
            }
          : variacao <= -0.05
            ? {
                forte: "Mês mais parado.",
                apoio: ` A média caiu para ${formatarNumero(mediaAtual)} passos por dia.`,
              }
            : {
                forte: "Mês estável.",
                apoio: ` ${pessoa} manteve a média de ${formatarNumero(mediaAtual)} passos por dia.`,
              };
  const intervalo =
    periodo === "hoje"
      ? dataCurta(agora)
      : `${celular ? dataMuitoCurta(inicioPeriodo) : dataCurta(inicioPeriodo)} a ${celular ? dataMuitoCurta(agora) : dataCurta(agora)}`;

  // ---- mobilidade
  const nota = device.mobilityScore;
  const mobilidade =
    nota == null
      ? null
      : nota >= 75
        ? { texto: "Boa", tom: "sucesso" }
        : nota >= 50
          ? { texto: "Regular", tom: "aviso" }
          : { texto: "Precisa de atenção", tom: "perigo" };

  // ---- números
  const numeros =
    periodo === "30"
      ? [
          {
            Icone: Footprints,
            rotulo: "Média por dia",
            valor: `${formatarNumero(mediaAtual)} passos · na meta em ${diasNaMeta} de 30 dias`,
          },
          {
            Icone: Route,
            rotulo: "Distância no mês",
            valor: `${formatarKm(km(atual.reduce((s, b) => s + b.valor, 0)))} km · ~${formatarKm(km(mediaAtual))} km por dia`,
          },
          {
            Icone: Clock,
            rotulo: "Tempo ativo hoje",
            valor:
              device.activeMinutes != null
                ? `${device.activeMinutes} min`
                : "Sem leitura",
          },
        ]
      : [
          {
            Icone: Footprints,
            rotulo: "Hoje",
            valor: `${formatarNumero(hojeValor)} passos · ${hojeValor >= META_PASSOS ? "acima da meta" : "abaixo da meta"}`,
          },
          periodo === "hoje"
            ? {
                Icone: Route,
                rotulo: "Distância hoje",
                valor: `${formatarKm(km(hojeValor))} km`,
              }
            : {
                Icone: Route,
                rotulo: "Distância na semana",
                valor: `${formatarKm(km(atual.reduce((s, b) => s + b.valor, 0)))} km · ${formatarKm(km(mediaAtual))} km por dia`,
              },
          {
            Icone: Clock,
            rotulo: "Tempo ativo hoje",
            valor:
              device.activeMinutes != null
                ? `${device.activeMinutes} min de caminhada`
                : "Sem leitura",
          },
        ];

  // ---- equilíbrio
  const tremores = tremor(
    periodo === "30" ? 60 : periodo === "7" ? 28 : 16,
    agora,
  );
  const alertaTremor = alerts.find(
    (a) => a.alertType === "TREMOR_DETECTED" && a.status === "PENDING",
  );
  const quedas = alerts.filter(
    (a) => a.alertType === "FALL_DETECTED" && noPeriodo(a),
  );
  const avisosTremor = alerts.filter(
    (a) => a.alertType === "TREMOR_DETECTED" && noPeriodo(a),
  );
  const nomePeriodo =
    periodo === "hoje" ? "hoje" : periodo === "7" ? "na semana" : "no mês";
  const ultimaQueda = quedas[0];

  // ---- saídas
  const saidasArea = alerts.filter(
    (a) => a.alertType === "GEOFENCE_EXIT" && noPeriodo(a),
  );
  const distanciaHoje = distanciaRota(routeHistory);
  const usarExemplo = demo || routeDemo;
  const saidasReais = [
    ...(routeHistory.length > 1
      ? [
          {
            quando: "Hoje",
            titulo: "Trajeto das últimas 12 h",
            detalhe: `${horaCurta(routeHistory[0]!.recordedAt ?? agora)} a ${horaCurta(routeHistory[routeHistory.length - 1]!.recordedAt ?? agora)} · ${formatarKm(distanciaHoje)} km`,
            destaque: true,
          },
        ]
      : []),
    ...saidasArea.map((a) => ({
      quando: horaCurta(a.createdAt),
      titulo: "Saiu da área segura",
      detalhe: new Date(a.createdAt).toLocaleDateString("pt-BR"),
      destaque: false,
    })),
  ];
  const saidas = usarExemplo
    ? SAIDAS_EXEMPLO[periodo === "30" ? "30" : "7"]
    : saidasReais;
  const tituloSaidas = usarExemplo
    ? periodo === "30"
      ? "14 saídas no mês"
      : "3 saídas na semana"
    : saidasReais.length
      ? `${saidasReais.length} ${saidasReais.length === 1 ? "registro" : "registros"} ${nomePeriodo}`
      : `Nenhuma saída registrada ${nomePeriodo}`;
  const pessoaPos = {
    lat: device.currentLatitude,
    lng: device.currentLongitude,
  };
  const dentroDeCasa =
    distanciaRota([
      { deviceId: "", latitude: casa.lat, longitude: casa.lng },
      { deviceId: "", latitude: pessoaPos.lat, longitude: pessoaPos.lng },
    ]) *
      1000 <=
    casa.raio;

  // ---- saúde da bengala
  const ultimoPonto = routeHistory[routeHistory.length - 1];
  const satelites = ultimoPonto?.satellites;
  const obstaculoPerto =
    device.obstacleAlert ||
    (device.lastDistanceCm != null && device.lastDistanceCm < 60);
  const quedaPendente = alerts.some(
    (a) => a.alertType === "FALL_DETECTED" && a.status === "PENDING",
  );
  const exemplo = (s: Sensor): Sensor =>
    demo ? s : { ...s, status: "Não informado", estado: "sem-leitura" };
  const sensores: Sensor[] = [
    device.lastDistanceCm != null
      ? {
          nome: "Sensor de obstáculo",
          detalhe: obstaculoPerto
            ? `Obstáculo perto · objeto a ${metros(device.lastDistanceCm)}`
            : `Caminho livre · objeto a ${metros(device.lastDistanceCm)}`,
          status: obstaculoPerto ? "Atenção" : "Funcionando",
          estado: obstaculoPerto ? "atencao" : "ok",
        }
      : {
          nome: "Sensor de obstáculo",
          detalhe: "Sem leitura recente",
          status: "Não informado",
          estado: "sem-leitura",
        },
    quedaPendente
      ? {
          nome: "Acelerômetro (quedas)",
          detalhe: "Detectou uma queda agora",
          status: "Atenção",
          estado: "atencao",
        }
      : exemplo({
          nome: "Acelerômetro (quedas)",
          detalhe: "MPU6050 · leitura a cada 20 ms",
          status: "Funcionando",
          estado: "ok",
        }),
    device.isGripHolding != null
      ? {
          nome: "Empunhadura",
          detalhe: device.isGripHolding
            ? `${pessoa} está segurando agora`
            : "Ninguém segurando agora",
          status: device.isGripHolding ? "Em uso" : "Livre",
          estado: "ok",
        }
      : {
          nome: "Empunhadura",
          detalhe: "Sem leitura recente",
          status: "Não informado",
          estado: "sem-leitura",
        },
    {
      nome: "Bateria",
      detalhe: `${Math.round(device.batteryPercent)}% · ${device.batteryPercent > 35 ? "carga boa para hoje" : "carregue hoje à noite"}`,
      status: device.batteryPercent > 20 ? "Boa" : "Fraca",
      estado: device.batteryPercent > 20 ? "ok" : "atencao",
    },
    exemplo({
      nome: "Vibração",
      detalhe: "2 motores · dedos e palma",
      status: "Pronto",
      estado: "ok",
    }),
    exemplo({
      nome: "Farol noturno",
      detalhe: "Liga sozinho no escuro",
      status: "Funcionando",
      estado: "ok",
    }),
    satelites != null
      ? {
          nome: "GPS",
          detalhe: `${satelites} satélites · ${satelites >= 6 ? "posição precisa" : "posição aproximada"}`,
          status: satelites >= 4 ? "Funcionando" : "Fraco",
          estado: satelites >= 4 ? "ok" : "atencao",
        }
      : exemplo({
          nome: "GPS",
          detalhe: "8 satélites · posição precisa",
          status: "Funcionando",
          estado: "ok",
        }),
    {
      nome: "Conexão",
      detalhe: device.isOnline
        ? `Última notícia ${haQuanto(device.lastUpdate ?? agora)}`
        : "Sem sinal agora",
      status: device.isOnline ? "Conectada" : "Sem sinal",
      estado: device.isOnline ? "ok" : "atencao",
    },
  ];
  const funcionando = sensores.filter((s) => s.estado === "ok").length;
  const sensoresVisiveis =
    celular && !todosSensores ? sensores.slice(0, 5) : sensores;

  if (!demo)
    return (
      <div className="monitorar">
        <section className="frase-estado">
          <h1 className="frase">Monitoramento de {pessoa}</h1>
          <p>
            Leituras recebidas do dispositivo ·{" "}
            {device.lastUpdate
              ? `última atualização ${haQuanto(device.lastUpdate)}`
              : "aguardando a primeira leitura"}
          </p>
        </section>
        <section className="painel" style={{ padding: 24 }}>
          <h2 className="titulo-painel">Leituras atuais</h2>
          <dl>
            <dt>Conexão da bengala</dt>
            <dd>{device.isOnline ? "Conectada" : "Sem atualização"}</dd>
            <dt>Bateria</dt>
            <dd>
              {device.batteryPercent == null
                ? "Sem leitura"
                : `${Math.round(device.batteryPercent)}%`}
            </dd>
            <dt>Distância do obstáculo</dt>
            <dd>
              {device.lastDistanceCm == null
                ? "Sem leitura"
                : `${device.lastDistanceCm} cm`}
            </dd>
            <dt>Passos hoje</dt>
            <dd>{device.stepsToday ?? "Não informado pelo dispositivo"}</dd>
            <dt>Alertas pendentes</dt>
            <dd>{alerts.filter((a) => a.status === "PENDING").length}</dd>
          </dl>
          <p className="nota">
            Tendências de passos, tremor e nota de mobilidade só serão mostradas
            quando houver histórico real suficiente.
          </p>
        </section>
        <section className="painel" style={{ padding: 24 }}>
          <h2 className="titulo-painel">Posição e trajeto recebidos</h2>
          <MapaSaidas
            casa={casa}
            pessoa={pessoaPos}
            rota={routeHistory}
            satelite={false}
          />
        </section>
      </div>
    );
  return (
    <div className="monitorar">
      <section className="monitorar-resumo">
        <div className="monitorar-resumo-texto">
          {/* Troca de período: a frase faz crossfade */}
          <h1 className="frase monitorar-frase monitorar-frase-troca">
            <AnimatePresence initial={false}>
              <motion.span
                key={`${frase.forte}|${frase.apoio}`}
                className="frase-texto"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: DUR.curta, ease: EASE_MOTION },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: saida(DUR.curta), ease: EASE_MOTION },
                }}
              >
                {frase.forte}
                <span className="frase-apoio">{frase.apoio}</span>
              </motion.span>
            </AnimatePresence>
          </h1>
          <p className="frase-detalhe">
            {intervalo}
            {celular ? "" : ` · bengala ${device.deviceId}`}
          </p>
        </div>
        <div className="segmento" role="group" aria-label="Período">
          {(
            [
              ["hoje", "Hoje"],
              ["7", "7 dias"],
              ["30", "30 dias"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              aria-pressed={periodo === id}
              className={periodo === id ? "is-ativo" : ""}
              onClick={() => setPeriodo(id)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </section>

      <div className="monitorar-linha">
        <section
          className="painel monitorar-passos"
          aria-labelledby="titulo-passos"
        >
          <div className="monitorar-cabecalho">
            <div>
              <h2 id="titulo-passos" className="titulo-painel">
                {periodo === "hoje"
                  ? "Passos ao longo do dia"
                  : "Passos por dia"}
              </h2>
              {!celular && (
                <p className="texto-pequeno">
                  {periodo === "hoje"
                    ? "Soma a cada 2 horas"
                    : "A linha tracejada é a meta combinada com o médico"}
                </p>
              )}
            </div>
            {nota != null && mobilidade && (
              <div className="mobilidade">
                {!celular && (
                  <div className="mobilidade-texto">
                    <span>Mobilidade</span>
                    <strong className={`is-${mobilidade.tom}`}>
                      {mobilidade.texto}
                    </strong>
                  </div>
                )}
                <span
                  className={`mobilidade-nota is-${mobilidade.tom}`}
                  role="img"
                  aria-label={`Nota de mobilidade ${nota} de 100`}
                >
                  <Contador
                    valor={nota}
                    doZero={primeira.current}
                    duracao={0.5}
                  />
                </span>
              </div>
            )}
          </div>
          <GraficoPassos
            barras={barras}
            meta={periodo === "hoje" ? null : META_PASSOS}
            altura={celular ? 150 : 260}
            curto={celular}
            animarEntrada={primeira.current}
            chave={`${periodo}-${celular ? "c" : "d"}`}
            titulo={
              periodo === "hoje"
                ? "Passos de hoje a cada 2 horas"
                : `Passos por dia, últimos ${barras.length} dias, meta de ${formatarNumero(META_PASSOS)}`
            }
          />
          <div className="monitorar-numeros">
            {celular && nota != null && mobilidade && (
              <Fato
                Icone={Footprints}
                rotulo="Mobilidade"
                valor={`${nota} · ${mobilidade.texto}`}
              />
            )}
            {numeros
              .filter((_, i) => !(celular && i === 0))
              .map((n) => (
                <Fato key={n.rotulo} {...n} />
              ))}
          </div>
        </section>

        <section
          className="painel monitorar-equilibrio"
          aria-labelledby="titulo-equilibrio"
        >
          <h2 id="titulo-equilibrio" className="titulo-painel">
            Equilíbrio e tremores
          </h2>
          <p
            className={`nota ${alertaTremor ? "is-aviso" : "is-sucesso"} com-ponto`}
          >
            {alertaTremor
              ? "Tremor acima do normal hoje · confira com ele"
              : celular
                ? "Estável · 1,2 Hz, fora da faixa de atenção (3 a 7 Hz)"
                : "Estável · tremor de 1,2 Hz, fora da faixa de atenção"}
          </p>
          {!celular && (
            <GraficoTremor
              valores={tremores}
              inicio={
                periodo === "30"
                  ? dataMuitoCurta(inicioPeriodo)
                  : periodo === "7"
                    ? inicioPeriodo
                        .toLocaleDateString("pt-BR", { weekday: "short" })
                        .replace(".", "")
                    : "6h"
              }
            />
          )}
          {!celular && <hr className="monitorar-divisor" />}
          {celular ? (
            <dl className="monitorar-lista-valores">
              <div>
                <dt>Quedas {nomePeriodo}</dt>
                <dd>{quedas.length ? quedas.length : "Nenhuma"}</dd>
              </div>
              <div>
                <dt>Avisos de tremor</dt>
                <dd>{avisosTremor.length ? avisosTremor.length : "Nenhum"}</dd>
              </div>
            </dl>
          ) : (
            <div className="monitorar-quedas">
              <p className="monitorar-quedas-titulo">
                {quedas.length === 0
                  ? `Nenhuma queda ${nomePeriodo}`
                  : `${quedas.length} ${quedas.length === 1 ? "queda" : "quedas"} ${nomePeriodo}`}
              </p>
              <p className="texto-pequeno">
                {ultimaQueda
                  ? `Última em ${new Date(ultimaQueda.createdAt).toLocaleDateString("pt-BR")}, ${horaCurta(ultimaQueda.createdAt)}${ultimaQueda.status === "RESOLVED" ? " · atendida" : " · aguardando resposta"}`
                  : avisosTremor.length
                    ? `${avisosTremor.length} ${avisosTremor.length === 1 ? "aviso" : "avisos"} de tremor ${nomePeriodo}`
                    : "Nenhum aviso de tremor registrado"}
              </p>
            </div>
          )}
        </section>
      </div>

      <section
        className="painel monitorar-saidas"
        aria-labelledby="titulo-saidas"
      >
        <div className="monitorar-cabecalho">
          <div>
            <h2 id="titulo-saidas" className="titulo-painel">
              Saídas e trajeto
            </h2>
            {!celular && (
              <p className="texto-pequeno">
                GPS da bengala ·{" "}
                {dentroDeCasa
                  ? `${pessoa} está em casa agora`
                  : `${pessoa} está fora de casa agora`}
              </p>
            )}
          </div>
          {celular ? (
            <button
              className="btn-icone is-borda"
              onClick={() => setSatelite((v) => !v)}
              aria-pressed={satelite}
              aria-label="Ver satélite"
              title="Ver satélite"
            >
              <MapPin size={20} />
            </button>
          ) : (
            <button
              className="btn btn-secundario btn-pequeno"
              onClick={() => setSatelite((v) => !v)}
              aria-pressed={satelite}
            >
              <Layers size={16} aria-hidden="true" />
              {satelite ? "Ver ruas" : "Ver satélite"}
            </button>
          )}
        </div>
        <div className="monitorar-saidas-corpo">
          <MapaSaidas
            casa={casa}
            pessoa={pessoaPos}
            rota={routeHistory}
            satelite={satelite}
            compacto={celular}
          />
          <div className="monitorar-saidas-lista">
            {!celular && (
              <p className="monitorar-saidas-titulo">{tituloSaidas}</p>
            )}
            {!celular && (
              <p
                className={`nota ${saidasArea.length ? "is-aviso" : "is-sucesso"} com-ponto`}
              >
                {saidasArea.length
                  ? `Saiu do perímetro de ${formatarNumero(casa.raio)} m ${saidasArea.length}× ${nomePeriodo}`
                  : `Sempre dentro do perímetro de ${formatarNumero(casa.raio)} m`}
              </p>
            )}
            {saidas.length === 0 ? (
              <p className="texto-pequeno">
                Quando ele sair de casa com a bengala, o trajeto aparece aqui.
              </p>
            ) : (
              <ul
                className={
                  celular ? "monitorar-lista-valores" : "monitorar-saidas-itens"
                }
              >
                {(todasSaidas ? saidas : saidas.slice(0, 4)).map((s, i) =>
                  celular ? (
                    <li key={i}>
                      <span>
                        {s.quando === "Ter"
                          ? "Terça"
                          : s.quando === "Sáb"
                            ? "Sábado"
                            : s.quando}
                      </span>
                      <strong>
                        {s.titulo} ·{" "}
                        {s.detalhe.split(" · ").find((p) => p.includes("km")) ??
                          s.detalhe}
                      </strong>
                    </li>
                  ) : (
                    <li key={i}>
                      <span
                        className={`monitorar-saida-quando${"destaque" in s && s.destaque ? " is-destaque" : ""}`}
                      >
                        {s.quando}
                      </span>
                      <span className="monitorar-saida-textos">
                        <strong>{s.titulo}</strong>
                        <span>{s.detalhe}</span>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
            {!celular && saidas.length > 4 && (
              <button
                className="btn-link monitorar-saidas-todas"
                onClick={() => setTodasSaidas((v) => !v)}
                aria-expanded={todasSaidas}
              >
                {todasSaidas ? "Ver menos" : "Ver todas as saídas"}
              </button>
            )}
          </div>
        </div>
      </section>

      <section
        className="painel monitorar-saude"
        aria-labelledby="titulo-saude"
      >
        <div className="monitorar-cabecalho">
          <div>
            <h2 id="titulo-saude" className="titulo-painel">
              Saúde da bengala
            </h2>
            {!celular && (
              <p className="texto-pequeno">
                {funcionando} de 8 itens funcionando · última checagem{" "}
                {haQuanto(device.lastUpdate ?? agora)}
              </p>
            )}
          </div>
          {celular ? (
            <span
              className={`monitorar-saude-total${funcionando === 8 ? " is-ok" : ""}`}
            >
              {funcionando} de 8 ok
            </span>
          ) : (
            <dl className="acelerometro" aria-label="Acelerômetro agora">
              <dt className="acelerometro-titulo">Acelerômetro agora</dt>
              {(demo
                ? [
                    ["X", "0,04 g"],
                    ["Y", "−0,02 g"],
                    ["Z", "0,98 g"],
                  ]
                : [
                    ["X", "—"],
                    ["Y", "—"],
                    ["Z", "—"],
                  ]
              ).map(([eixo, valor]) => (
                <div key={eixo}>
                  <dt>{eixo}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <ul className="sensores">
          {sensoresVisiveis.map((s) => (
            <li key={s.nome} className={`item-sensor is-${s.estado}`}>
              <span className="item-sensor-ponto" aria-hidden="true" />
              <span className="item-sensor-textos">
                <strong>{s.nome}</strong>
                <span>{s.detalhe}</span>
              </span>
              <span className="item-sensor-status">{s.status}</span>
            </li>
          ))}
        </ul>
        {celular && (
          <button
            className="btn-link monitorar-ver-todos"
            onClick={() => setTodosSensores((v) => !v)}
            aria-expanded={todosSensores}
          >
            {todosSensores ? "Ver menos" : "Ver os 8 itens"}
          </button>
        )}
      </section>

      <p className="monitorar-aviso texto-pequeno">
        <Info size={14} aria-hidden="true" />
        {demo
          ? "Modo demonstração: todos os números desta tela são de exemplo."
          : `Os dias anteriores, o tremor${usarExemplo ? " e as saídas" : ""} são exemplos: a bengala ainda não envia esse histórico. Hoje, bateria, obstáculo, empunhadura e GPS são leituras reais.`}
      </p>
    </div>
  );
};
