import React, { useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, Bot, Home, RotateCcw, ShieldCheck, Video } from "lucide-react";
import { apiJson } from "../../services/auth";
import { presentation } from "../../services/presentation";
import { plantaDaFamilia, useCuidado } from "../../lib/cuidado";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import { CadastroCtx } from "./Cadastro";
import { useProgresso } from "./progresso";
import { CADASTRO_CONCLUIDO, primeiroNome } from "./regras";
import {
  ErroSalvar,
  Nota,
  Opcao,
  TituloPasso,
  useIdForm,
  useRodape,
  useSalvarPasso,
} from "./ui";

type Estado = "aguardando" | "conectado" | "sem-sinal";
interface Conexoes {
  cane?: { online: boolean };
  camera?: { online: boolean };
  robot?: { online: boolean };
}

const TEXTO: Record<Estado, string> = {
  aguardando: "Aguardando",
  conectado: "Conectado",
  "sem-sinal": "Sem sinal",
};

/** Selo do equipamento: troca de texto e cor com crossfade (150 ms). */
const Selo: React.FC<{ estado: Estado }> = ({ estado }) => (
  <AnimatePresence initial={false} mode="wait">
    <motion.span
      key={estado}
      className={`cad-estado is-${estado}`}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: DUR.rapida, ease: EASE_MOTION } }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: saida(DUR.rapida) } }}
    >
      {TEXTO[estado]}
    </motion.span>
  </AnimatePresence>
);

const ABRE = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: { duration: DUR.media, ease: EASE_MOTION } },
  exit: { opacity: 0, height: 0, transition: { duration: saida(DUR.media), ease: EASE_MOTION } },
};

/** Passo 8 · Começar (Figma 44:4860 / 44:5130). */
export const PassoComecar: React.FC = () => {
  const idForm = useIdForm();
  const p = useProgresso();
  const prefs = useCuidado();
  const { concluir } = useContext(CadastroCtx);
  const [escolha, setEscolha] = useState<"EQUIPAMENTOS" | "DEMO" | null>("DEMO");
  const [aparelho, setAparelho] = useState<{ deviceId: string; robotId: string } | null>(null);
  const [estado, setEstado] = useState<Record<"cane" | "camera" | "robot", Estado>>({
    cane: "aguardando",
    camera: "aguardando",
    robot: "aguardando",
  });
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ajuda, setAjuda] = useState(false);
  const s = useSalvarPasso();

  useRodape({
    rotulo: s.ocupado ? "Abrindo…" : "Abrir o painel",
    ocupado: s.ocupado,
    semVoltar: p.convite,
  });

  useEffect(() => {
    let vivo = true;
    apiJson<{ deviceId: string; robotId: string }[]>("/care/devices")
      .then((l) => {
        if (vivo && l[0]) setAparelho(l[0]);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const nomes = new Map(plantaDaFamilia(prefs).rooms.map((r) => [r.id, r.name]));
  const comodosCamera = (prefs.cameraRooms ?? []).filter((c) => c.allowed).map((c) => nomes.get(c.room) ?? c.room);
  const pessoa = prefs.personName?.trim() || "da família";

  const verificar = async () => {
    if (!aparelho || verificando) return;
    setVerificando(true);
    setAviso("");
    try {
      const c = await apiJson<Conexoes>(`/care/${encodeURIComponent(aparelho.deviceId)}/connections`);
      const de = (x?: { online: boolean }): Estado => (x?.online ? "conectado" : "sem-sinal");
      const novo = { cane: de(c.cane), camera: de(c.camera), robot: de(c.robot) };
      setEstado(novo);
      if (Object.values(novo).some((x) => x !== "conectado"))
        setAviso("Algum aparelho ainda não respondeu. Confira a chave e a rede dele e verifique de novo.");
    } catch {
      setAviso("Não foi possível verificar agora. Tente de novo em instantes.");
    } finally {
      setVerificando(false);
    }
  };

  const abrir = () => {
    presentation.set(escolha === "DEMO" ? "demo" : "real");
    concluir();
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    // Quem entrou por convite não mexe no cadastro da família, que já terminou.
    if (p.convite) abrir();
    else await s.salvar({ onboardingStep: CADASTRO_CONCLUIDO }, abrir);
  };

  const equipamentos = [
    { chave: "cane" as const, Icone: Activity, nome: "Bengala", detalhe: aparelho?.deviceId ?? "…" },
    {
      chave: "camera" as const,
      Icone: Video,
      nome: "Câmera",
      detalhe: comodosCamera.length ? comodosCamera.join(", ") : "Nenhum cômodo liberado",
    },
    {
      chave: "robot" as const,
      Icone: Bot,
      nome: "Robô",
      detalhe: `${aparelho?.robotId ?? "…"}${prefs.floorPlanSource === "ROBOT" ? " · depois mapeia a casa" : ""}`,
    },
  ];

  return (
    <form id={idForm} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo="Tudo pronto. Como quer começar?"
        apoio={`A conta de ${pessoa} está criada. Escolha o primeiro passo; o outro continua disponível.`}
      />
      <fieldset className="cad-opcoes" disabled={s.ocupado}>
        <legend className="sr-only">Como começar</legend>
        <Opcao
          nome="comecar"
          valor="EQUIPAMENTOS"
          escolhido={escolha}
          onEscolher={setEscolha}
          titulo="Conectar os equipamentos"
          descricao="Coloque a chave em cada aparelho e verifique a conexão."
          icone={<Activity size={22} />}
        >
          <ul className="cad-lista is-sem-borda" aria-label="Equipamentos">
            {equipamentos.map(({ chave, Icone, nome, detalhe }) => (
              <li key={chave} className="cad-item">
                <span className="cad-item-icone" aria-hidden="true">
                  <Icone size={20} />
                </span>
                <span className="cad-item-textos">
                  <strong>{nome}</strong>
                  <span>{detalhe}</span>
                </span>
                <Selo estado={estado[chave]} />
              </li>
            ))}
          </ul>
          <div className="cad-equip-acoes">
            <button
              type="button"
              className="btn btn-secundario cad-verificar"
              onClick={() => void verificar()}
              disabled={!aparelho || verificando}
              aria-busy={verificando}
            >
              <RotateCcw size={18} aria-hidden="true" className={verificando ? "cad-girando" : undefined} />
              {verificando ? "Verificando…" : "Verificar conexão"}
            </button>
            <button
              type="button"
              className="btn-link cad-como"
              aria-expanded={ajuda}
              aria-controls="cad-como-configurar"
              onClick={() => setAjuda((a) => !a)}
            >
              Como configurar
            </button>
          </div>
          <p className="texto-pequeno" role="status">
            {aviso}
          </p>
          <AnimatePresence initial={false}>
            {ajuda && (
              <motion.div key="ajuda" id="cad-como-configurar" className="cad-colapso" {...ABRE}>
                <ol className="cad-como-lista">
                  <li>Ligue o aparelho na tomada e conecte ao Wi-Fi da casa.</li>
                  <li>
                    No aplicativo do aparelho, informe o código dele ({aparelho?.deviceId ?? "veja em Configurações"})
                    e a chave dos equipamentos que você guardou no passo anterior.
                  </li>
                  <li>Volte aqui e toque em “Verificar conexão”. Cada aparelho fica “Conectado” em até 20 s.</li>
                  <li>Perdeu a chave? Gere outra em Configurações; a anterior deixa de valer.</li>
                </ol>
              </motion.div>
            )}
          </AnimatePresence>
        </Opcao>
        <Opcao
          nome="comecar"
          valor="DEMO"
          escolhido={escolha}
          onEscolher={setEscolha}
          titulo="Explorar a demonstração"
          descricao={`${primeiroNome(prefs.personName ?? "", "A pessoa")}, o robô e um pedido de ajuda simulados. Nada vai para o histórico real.`}
          icone={<Home size={22} />}
        />
      </fieldset>
      <Nota icone={<ShieldCheck size={18} />}>
        Enquanto os aparelhos não se conectam, o painel mostra “Aguardando configuração” e nenhum
        dado de exemplo aparece como real.
      </Nota>
      <ErroSalvar erro={s.erro} />
    </form>
  );
};
