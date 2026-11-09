// Peças dos formulários do cadastro (Figma 43:3393…44:5130): campo com erro, caixa de seleção,
// opção em cartão, segmento, título do passo e a validação comum a todos os passos.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { Check } from "lucide-react";
import { gsap, movimentoReduzido, useGSAP } from "../../motion/gsap";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import { cuidado, type Estado } from "../../lib/cuidado";
import { progresso } from "./progresso";
import type { Erros } from "./regras";

export const FORM_PASSO = "cadastro-passo";

/**
 * id do formulário do passo. Na troca de passo o antigo fica na tela por 300 ms saindo: ele perde
 * o id, para o "Continuar" (fora da animação, form="cadastro-passo") nunca enviar o passo errado.
 */
export function useIdForm() {
  return useIsPresent() ? FORM_PASSO : undefined;
}

/* ------------------------------------------------------------------ rodapé */

export interface Rodape {
  rotulo: string;
  ocupado?: boolean;
  desabilitado?: boolean;
  /** Texto ao lado do botão quando ele está desabilitado. */
  dica?: string;
  /** Some com o "Voltar" (passo 1, convite no passo 7). */
  semVoltar?: boolean;
}
export const RodapeCtx = createContext<(r: Rodape) => void>(() => undefined);

/** Cada passo diz como o botão principal do rodapé (que fica fora da animação) deve aparecer. */
export function useRodape(r: Rodape) {
  const definir = useContext(RodapeCtx);
  // O passo que está saindo (animação de troca) não mexe mais no rodapé do passo novo.
  const presente = useIsPresent();
  const { rotulo, ocupado, desabilitado, dica, semVoltar } = r;
  useLayoutEffect(() => {
    if (!presente) return;
    definir({ rotulo, ocupado, desabilitado, dica, semVoltar });
  }, [definir, presente, rotulo, ocupado, desabilitado, dica, semVoltar]);
}

/* ------------------------------------------------------------------ validação */

/**
 * Erros aparecem ao sair do campo e em "Continuar". Em "Continuar" com erro, os campos inválidos
 * tremem uma vez e o foco vai para o primeiro deles.
 *
 * Enquanto a pessoa digita num campo, o erro dele sai de cena: some de vez quando o valor fica
 * válido e só volta (já com o texto atualizado) ao sair do campo ou em "Continuar".
 */
export function useValidacao(validar: () => Erros) {
  const [tocados, setTocados] = useState<Set<string>>(() => new Set());
  const [editando, setEditando] = useState<Set<string>>(() => new Set());
  const [enviado, setEnviado] = useState(false);
  const [tremor, setTremor] = useState(0);
  const [servidor, setServidor] = useState<Erros>({});
  const form = useRef<HTMLFormElement>(null);
  const todos = { ...validar(), ...servidor };
  const visiveis: Erros = {};
  for (const [campo, msg] of Object.entries(todos))
    if (campo in servidor || ((enviado || tocados.has(campo)) && !editando.has(campo)))
      visiveis[campo] = msg;

  useEffect(() => {
    if (!tremor) return;
    const alvo = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    alvo?.focus();
  }, [tremor]);

  const sair = useCallback(
    (campo: string) => () => {
      setTocados((t) => (t.has(campo) ? t : new Set(t).add(campo)));
      setEditando((t) => {
        if (!t.has(campo)) return t;
        const n = new Set(t);
        n.delete(campo);
        return n;
      });
    },
    [],
  );
  /** A pessoa mudou o campo: o erro dele (local ou do servidor) sai até ela terminar. */
  const editar = useCallback((campo: string) => {
    setEditando((t) => (t.has(campo) ? t : new Set(t).add(campo)));
    setServidor((s) => {
      if (!(campo in s)) return s;
      const { [campo]: _, ...resto } = s;
      return resto;
    });
  }, []);
  const tentar = () => {
    setEditando(new Set());
    setEnviado(true);
    if (Object.keys({ ...validar(), ...servidor }).length) {
      setTremor((n) => n + 1);
      return false;
    }
    return true;
  };
  const falhar = (erros: Erros) => {
    setServidor(erros);
    setEnviado(true);
    setTremor((n) => n + 1);
  };
  return { form, erros: visiveis, tremor, sair, editar, tentar, falhar };
}

/* ------------------------------------------------------------------ campo */

interface PropsEntrada {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface CampoProps {
  rotulo: React.ReactNode;
  erro?: string;
  ajuda?: React.ReactNode;
  opcional?: boolean;
  icone?: React.ReactNode;
  /** Botão dentro da caixa (ex.: "Mostrar"). */
  acao?: React.ReactNode;
  /** Muda a cada "Continuar" com erro: o campo inválido treme uma vez. */
  tremor?: number;
  /** Sem caixa (o filho já é um controle completo: segmento, lista…). */
  livre?: boolean;
  className?: string;
  children: (p: PropsEntrada) => React.ReactNode;
  depois?: React.ReactNode;
}

/** Erro de validação: a caixa treme uma vez (x 0 → −4 → 4 → 0, 240 ms) e a mensagem entra com fade. */
export const Campo: React.FC<CampoProps> = ({
  rotulo,
  erro,
  ajuda,
  opcional,
  icone,
  acao,
  tremor = 0,
  livre,
  className,
  children,
  depois,
}) => {
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  useGSAP(
    () => {
      if (!tremor || !erro || !caixa.current || movimentoReduzido()) return;
      gsap.to(caixa.current, {
        keyframes: { x: [0, -4, 4, 0] },
        duration: 0.24,
        ease: "none",
        clearProps: "transform",
      });
    },
    { dependencies: [tremor] },
  );
  const descricao = [erro ? idErro : null, ajuda ? idAjuda : null]
    .filter(Boolean)
    .join(" ");
  const props: PropsEntrada = {
    id,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": descricao || undefined,
  };
  return (
    <div className={`campo cad-campo${className ? ` ${className}` : ""}`}>
      <label className="campo-rotulo" htmlFor={id}>
        {rotulo}
        {opcional && <span className="cad-opcional"> opcional</span>}
      </label>
      {livre ? (
        <div ref={caixa}>{children(props)}</div>
      ) : (
        <div ref={caixa} className={`campo-caixa${erro ? " is-erro" : ""}`}>
          {icone}
          {children(props)}
          {acao}
        </div>
      )}
      {depois}
      <AnimatePresence initial={false}>
        {erro && (
          <motion.p
            key="erro"
            id={idErro}
            className="campo-erro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.curta, ease: EASE_MOTION } }}
            exit={{ opacity: 0, transition: { duration: saida(DUR.curta) } }}
          >
            {erro}
          </motion.p>
        )}
      </AnimatePresence>
      {ajuda && !erro && (
        <p id={idAjuda} className="texto-pequeno">
          {ajuda}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ caixa de seleção */

export const CaixaSelecao: React.FC<{
  marcada: boolean;
  onMudar: (v: boolean) => void;
  titulo: React.ReactNode;
  detalhe?: React.ReactNode;
  erro?: string;
  tremor?: number;
}> = ({ marcada, onMudar, titulo, detalhe, erro, tremor = 0 }) => {
  const id = useId();
  const caixa = useRef<HTMLLabelElement>(null);
  useGSAP(
    () => {
      if (!tremor || !erro || !caixa.current || movimentoReduzido()) return;
      gsap.to(caixa.current, {
        keyframes: { x: [0, -4, 4, 0] },
        duration: 0.24,
        ease: "none",
        clearProps: "transform",
      });
    },
    { dependencies: [tremor] },
  );
  return (
    <div className="cad-confirmacao-bloco">
      <label ref={caixa} className={`cad-confirmacao${erro ? " is-erro" : ""}`}>
        <input
          type="checkbox"
          checked={marcada}
          onChange={(e) => onMudar(e.target.checked)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
        />
        <span className="caixa-selecao-marca" aria-hidden="true">
          <Check size={15} strokeWidth={3} />
        </span>
        <span className="cad-confirmacao-textos">
          <strong>{titulo}</strong>
          {detalhe && <span>{detalhe}</span>}
        </span>
      </label>
      <AnimatePresence initial={false}>
        {erro && (
          <motion.p
            key="erro"
            id={`${id}-erro`}
            className="campo-erro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: saida(DUR.curta) } }}
          >
            {erro}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ opção em cartão */

/**
 * Rádio em cartão (Figma "Opção · …"). A escolhida ganha fundo e borda de acento; o detalhe
 * dela se abre suavemente (layout do Motion).
 */
export function Opcao<T extends string>({
  nome,
  valor,
  escolhido,
  onEscolher,
  titulo,
  selo,
  descricao,
  icone,
  children,
}: {
  nome: string;
  valor: T;
  escolhido: T | null;
  onEscolher: (v: T) => void;
  titulo: string;
  selo?: string;
  descricao: string;
  icone?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const ativa = escolhido === valor;
  return (
    <motion.div
      layout
      transition={{ layout: { duration: DUR.media, ease: EASE_MOTION } }}
      className={`cad-opcao${ativa ? " is-escolhida" : ""}`}
    >
      <motion.label layout="position" className="cad-opcao-topo">
        <input
          type="radio"
          name={nome}
          value={valor}
          checked={ativa}
          onChange={() => onEscolher(valor)}
        />
        <span className="cad-radio" aria-hidden="true" />
        <span className="cad-opcao-textos">
          <span className="cad-opcao-titulo">
            {titulo}
            {selo && <span className="cad-selo">{selo}</span>}
          </span>
          <span className="cad-opcao-descricao">{descricao}</span>
        </span>
        {icone && (
          <span className="cad-opcao-icone" aria-hidden="true">
            {icone}
          </span>
        )}
      </motion.label>
      <AnimatePresence initial={false}>
        {ativa && children && (
          <motion.div
            key="detalhe"
            className="cad-opcao-detalhe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.media, delay: 0.05 } }}
            exit={{ opacity: 0, transition: { duration: saida(DUR.curta) } }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ segmento */

export function Segmento<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
  props,
}: {
  rotulo: string;
  opcoes: { valor: T; texto: string }[];
  valor: T | null;
  onMudar: (v: T) => void;
  props?: PropsEntrada;
}) {
  return (
    <div
      className="segmento cad-segmento"
      role="radiogroup"
      aria-label={rotulo}
      aria-invalid={props?.["aria-invalid"]}
      aria-describedby={props?.["aria-describedby"]}
    >
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          id={i === 0 ? props?.id : undefined}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className={valor === o.valor ? "is-ativo" : undefined}
          // Rádio acessível: só a opção marcada (ou a primeira) entra no Tab; setas trocam.
          tabIndex={valor === o.valor || (valor === null && i === 0) ? 0 : -1}
          onClick={() => onMudar(o.valor)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
            e.preventDefault();
            const passo = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
            const prox = opcoes[(i + passo + opcoes.length) % opcoes.length]!;
            onMudar(prox.valor);
            const irmaos = (e.currentTarget.parentElement?.children ?? []) as HTMLCollectionOf<HTMLElement>;
            irmaos[(i + passo + opcoes.length) % opcoes.length]?.focus();
          }}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ título */

/** Título do passo. Recebe o foco depois da troca de passo (o Cadastro procura [data-titulo-passo]). */
export const TituloPasso: React.FC<{ titulo: string; apoio?: React.ReactNode }> = ({
  titulo,
  apoio,
}) => (
  <div className="cad-titulos">
    <h1 className="cad-titulo" tabIndex={-1} data-titulo-passo="">
      {titulo}
    </h1>
    {apoio && <p className="cad-apoio">{apoio}</p>}
  </div>
);

export const Nota: React.FC<{
  icone: React.ReactNode;
  tom?: "neutra" | "acento" | "aviso";
  children: React.ReactNode;
}> = ({ icone, tom = "neutra", children }) => (
  <div className={`cad-nota is-${tom}`}>
    <span aria-hidden="true">{icone}</span>
    <p>{children}</p>
  </div>
);

/* ------------------------------------------------------------------ salvar o passo */

/**
 * Grava o que o passo mudou junto com o passo seguinte (onboardingStep) e avança.
 * Outra aba ou aparelho retoma do passo salvo.
 */
export function useSalvarPasso() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const salvar = async (
    patch: Partial<Estado> | ((s: Estado) => Partial<Estado>),
    depois?: () => void,
  ) => {
    if (ocupado) return false;
    setOcupado(true);
    setErro("");
    const proximo = progresso.get().passo + 1;
    const passo = progresso.get().soConsentimento ? {} : { onboardingStep: proximo };
    const ok = await cuidado.salvarCadastro((s) => ({
      ...(typeof patch === "function" ? patch(s) : patch),
      ...passo,
    }));
    setOcupado(false);
    if (!ok) {
      setErro(cuidado.erro() || "Não foi possível salvar. Tente de novo.");
      return false;
    }
    (depois ?? progresso.avancar)();
    return true;
  };
  return { ocupado, erro, salvar };
}

export const ErroSalvar: React.FC<{ erro: string }> = ({ erro }) => (
  <AnimatePresence initial={false}>
    {erro && (
      <motion.div
        key="erro"
        className="cad-nota is-perigo"
        role="alert"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0, transition: { duration: DUR.curta, ease: EASE_MOTION } }}
        exit={{ opacity: 0, transition: { duration: saida(DUR.curta) } }}
      >
        <p>{erro}</p>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ------------------------------------------------------------------ interruptor */

export const Interruptor: React.FC<{
  ligado: boolean;
  onMudar: (v: boolean) => void;
  rotulo: string;
  id?: string;
}> = ({ ligado, onMudar, rotulo, id }) => (
  <button
    id={id}
    type="button"
    className="interruptor"
    role="switch"
    aria-checked={ligado}
    aria-label={rotulo}
    onClick={() => onMudar(!ligado)}
  />
);
