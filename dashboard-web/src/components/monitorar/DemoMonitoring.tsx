import { useEffect, useMemo, useState } from "react";
import { Bot, Footprints, Pause, Play, Hand, MapPin } from "lucide-react";
import { DemoRobot } from "../../robot/demoRobot";
import { comodosDaPessoa } from "../../robot/houseLayout";
import { PlantaCasa } from "../planta/PlantaCasa";
import { plantaDaFamilia, useCuidado } from "../../lib/cuidado";
import { MapaSaidas } from "./MapaSaidas";

export function DemoMonitoring({ person }: { person: string }) {
  const prefs = useCuidado();
  // Planta da família (a do modelo do cadastro) ou a de exemplo; trocar a planta recria o robô.
  const planta = useMemo(
    () => plantaDaFamilia(prefs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.floorPlanSource, prefs.floorPlanLayout, prefs.floorPlanTemplate],
  );
  const robot = useMemo(() => new DemoRobot(planta, "DEMO-LOCAL"), [planta]);
  const [state, setState] = useState(() => robot.getState());
  const [paused, setPaused] = useState(false),
    [help, setHelp] = useState(false),
    [step, setStep] = useState(0);
  const [events, setEvents] = useState([
    { id: 0, text: `${person} está na sala`, at: new Date().toISOString() },
  ]);
  const rooms = useMemo(() => [...comodosDaPessoa(planta), "sala"], [planta]);
  useEffect(() => {
    if (paused) return;
    let ticks = 0;
    const t = setInterval(() => {
      robot.tick(0.5);
      ticks++;
      if (ticks % 16 === 0 && !help) setStep((s) => s + 1);
      setState(robot.getState());
    }, 500);
    return () => clearInterval(t);
  }, [robot, paused, help]);
  useEffect(() => {
    const room = rooms[step % rooms.length];
    robot.setPersonRoom(room);
    setState(robot.getState());
    if (step)
      setEvents((es) =>
        [
          {
            id: Date.now(),
            text: `${person} foi para ${planta.rooms.find((r) => r.id === room)?.name ?? room}`,
            at: new Date().toISOString(),
          },
          ...es,
        ].slice(0, 20),
      );
  }, [step, robot, person, rooms, planta]);
  const room = planta.rooms.find((r) => r.id === state.personRoom);
  return (
    <div className="monitoring-workspace">
      <section className="activity-hero is-demo">
        <div>
          <span className="workspace-eyebrow">
            <Footprints size={18} /> ACOMPANHAMENTO SIMULADO
          </span>
          <h1>
            {help
              ? `${person} fez um pedido de ajuda`
              : paused
                ? "Demonstração pausada"
                : `${person} está caminhando pela casa`}
          </h1>
          <p>
            {room?.name} ·{" "}
            {paused
              ? "movimentos pausados"
              : "cena de exemplo atualizada automaticamente"}
          </p>
        </div>
        <button
          className="btn btn-secundario"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}{" "}
          {paused ? "Retomar" : "Pausar"}
        </button>
      </section>
      <div className="workspace-stats">
        <article>
          <Bot />
          <span>Robô de demonstração</span>
          <strong>{paused ? "Pausado" : "Fazendo a ronda"}</strong>
        </article>
        <article>
          <Footprints />
          <span>Pessoa acompanhada</span>
          <strong>{room?.name}</strong>
        </article>
        <article>
          <MapPin />
          <span>Origem dos dados</span>
          <strong>Simulação neste navegador</strong>
        </article>
      </div>
      <div className="workspace-columns">
        <section className="painel workspace-card">
          <div className="workspace-card-heading">
            <div>
              <span className="workspace-eyebrow">CASA AGORA</span>
              <h2>Uma visita pela casa</h2>
            </div>
            <span className="selo is-aviso">Planta de exemplo</span>
          </div>
          <PlantaCasa
            layout={planta}
            comodoPessoa={state.personRoom}
            robo={{ x: state.x, y: state.y }}
            comodoRobo={state.currentRoom}
            emergencia={help}
            estados={Object.fromEntries(
              planta.rooms.map((r) => [
                r.id,
                {
                  titulo:
                    r.id === state.personRoom ? `${person} está aqui` : "",
                  tom: r.id === state.personRoom ? "pessoa" : "neutro",
                },
              ]),
            )}
          />
          <p className="texto-pequeno">
            A pessoa muda de cômodo e o robô percorre uma ronda. Nenhum
            equipamento físico recebe estes comandos.
          </p>
        </section>
        <aside className="painel workspace-card">
          <span className="workspace-eyebrow">EXPERIMENTE</span>
          <h2>Pedido de ajuda</h2>
          <p>
            Veja como um evento aparece para a família, sem gerar um alerta
            real.
          </p>
          <button
            className="btn btn-primario"
            disabled={help}
            onClick={() => {
              setHelp(true);
              robot.emergency(state.personRoom ?? "sala", "Pedido simulado");
              setEvents((es) =>
                [
                  {
                    id: Date.now(),
                    text: "Pedido de ajuda simulado · robô a caminho",
                    at: new Date().toISOString(),
                  },
                  ...es,
                ].slice(0, 20),
              );
            }}
          >
            <Hand size={18} /> Testar pedido de ajuda
          </button>
          {help && (
            <div className="nota is-aviso" role="status">
              <p>O robô simulado está indo verificar a pessoa.</p>
              <button
                className="btn btn-secundario"
                onClick={() => {
                  setHelp(false);
                  setEvents((es) =>
                    [
                      {
                        id: Date.now(),
                        text: "Família confirmou atendimento simulado",
                        at: new Date().toISOString(),
                      },
                      ...es,
                    ].slice(0, 20),
                  );
                }}
              >
                Confirmei o atendimento simulado
              </button>
            </div>
          )}
          <h3>Últimos acontecimentos</h3>
          <ol className="workspace-timeline">
            {events.map((e) => (
              <li key={e.id}>
                <time>
                  {new Date(e.at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      {prefs.home?.confirmed && (
        <section className="painel workspace-card">
          <h2>Endereço configurado da casa</h2>
          <p>{prefs.endereco}</p>
          <p className="texto-pequeno">
            O mapa abaixo marca somente a casa. Os movimentos desta demonstração
            acontecem na planta da casa ({planta.name}).
          </p>
          <MapaSaidas
            casa={prefs.areas[0]}
            pessoa={{ lat: NaN, lng: NaN }}
            rota={[]}
            satelite={false}
          />
        </section>
      )}
    </div>
  );
}
