import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  HeartPulse,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { ApiError, API_BASE_URL, auth } from "../services/auth";
import { FALLBACK_LAYOUT, planPath } from "../robot/houseLayout";
import { PlantaCasa } from "./planta/PlantaCasa";
import { ATE_TABLET, useMediaQuery } from "../hooks/useMediaQuery";
import { gsap, movimentoReduzido, useGSAP } from "../motion/gsap";
import { DESLOCA, DUR, EASE_MOTION, saida } from "../motion/tokens";

interface LoginScreenProps {
  onLoggedIn: () => void;
  onContinueDemo: () => void;
  /** "Criar conta da família" (false) ou "Recebi um convite de outro familiar" (true). */
  onCadastro: (convite: boolean) => void;
}

// Mesmo limite do LoginRateLimiter do backend: 5 tentativas erradas a cada 5 minutos.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 5 * 60 * 1000;
const CHAVE_FALHAS = "amparo_login_falhas";

const lerFalhas = (): number[] => {
  try {
    const lista = JSON.parse(sessionStorage.getItem(CHAVE_FALHAS) ?? "[]") as number[];
    return lista.filter((t) => Date.now() - t < JANELA_MS);
  } catch {
    return [];
  }
};
const gravarFalhas = (lista: number[]) => {
  try {
    sessionStorage.setItem(CHAVE_FALHAS, JSON.stringify(lista));
  } catch {
    /* armazenamento indisponível */
  }
};

// Ilustração do lado esquerdo: a casa com o José na Sala e o robô fazendo a ronda.
const ROBO_ILUSTRACAO = { x: 5.5, y: -1 };
const DESTINO_ILUSTRACAO = { x: 4.2, y: 3 };
const ESTADOS_ILUSTRACAO = {
  sala: { titulo: "José está aqui · há 40 min", tom: "pessoa" as const },
  cozinha: { titulo: "Robô fazendo a ronda" },
  quarto: { titulo: "Vazio desde 08:50" },
  banheiro: { titulo: "Vazio" },
  escritorio: { titulo: "Vazio" },
};

/** Treme uma vez (x 0 → −4 → 4 → 0, 240 ms) quando `chave` muda. Sem movimento reduzido. */
function useTremor(chave: number) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!chave || !ref.current || movimentoReduzido()) return;
      gsap.to(ref.current, {
        keyframes: { x: [0, -4, 4, 0] },
        duration: 0.24,
        ease: "none",
        clearProps: "transform",
      });
    },
    { dependencies: [chave] },
  );
  return ref;
}

const MensagemErro: React.FC<{ id: string; texto: string }> = ({ id, texto }) => (
  <AnimatePresence initial={false}>
    {texto && (
      <motion.p
        key="erro"
        id={id}
        className="campo-erro"
        role="alert"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: saida(DUR.curta) } }}
        transition={{ duration: DUR.curta, ease: EASE_MOTION }}
      >
        {texto}
      </motion.p>
    )}
  </AnimatePresence>
);

/** Recuperação pelo código guardado no cadastro (POST /auth/reset, que já existia). */
const Recuperar: React.FC<{ emailInicial: string; onVoltar: () => void }> = ({
  emailInicial,
  onVoltar,
}) => {
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [novoCodigo, setNovoCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const caixa = useTremor(tentativa);
  const erroId = useId();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (senha.length < 12) {
      setErro("A nova senha precisa ter pelo menos 12 caracteres.");
      setTentativa((n) => n + 1);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), recoveryCode: codigo.trim(), password: senha }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new ApiError(
          res.status,
          res.status === 429
            ? "Muitas tentativas. Aguarde 5 minutos."
            : (body.message ?? "Não foi possível recuperar"),
        );
      setNovoCodigo(body.recoveryCode);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.status === 400
            ? "E-mail ou código de recuperação não conferem."
            : e.message
          : "O servidor do Amparo não respondeu.",
      );
      setTentativa((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  if (novoCodigo)
    return (
      <div className="login-caixa">
        <div className="login-titulos">
          <h1 className="login-titulo">Senha alterada</h1>
          <p className="texto-secundario">
            O código antigo deixou de valer. Guarde este novo código de recuperação antes de
            continuar.
          </p>
        </div>
        <div className="cad-codigo-caixa">
          <code className="cad-codigo-valor">{novoCodigo}</code>
        </div>
        <button type="button" className="btn btn-primario btn-bloco btn-grande" onClick={onVoltar}>
          Guardei, voltar para entrar
        </button>
      </div>
    );

  return (
    <form className="login-caixa" onSubmit={(e) => void enviar(e)}>
      <div className="login-titulos">
        <h1 className="login-titulo">Esqueci a senha</h1>
        <p className="texto-secundario">
          Use o código de recuperação que você guardou no cadastro e crie uma senha nova.
        </p>
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor="rec-email">
          E-mail
        </label>
        <div className="campo-caixa">
          <Mail size={18} aria-hidden="true" />
          <input
            id="rec-email"
            type="email"
            className="campo-entrada"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            maxLength={120}
          />
        </div>
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor="rec-codigo">
          Código de recuperação
        </label>
        <div className="campo-caixa">
          <KeyRound size={18} aria-hidden="true" />
          <input
            id="rec-codigo"
            className="campo-entrada"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
            maxLength={100}
          />
        </div>
      </div>
      <div className="campo">
        <label className="campo-rotulo" htmlFor="rec-senha">
          Nova senha
        </label>
        <div ref={caixa} className={`campo-caixa${erro ? " is-erro" : ""}`}>
          <Lock size={18} aria-hidden="true" />
          <input
            id="rec-senha"
            type={mostrar ? "text" : "password"}
            className="campo-entrada"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={120}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? erroId : undefined}
          />
          <button type="button" className="campo-acao" aria-pressed={mostrar} onClick={() => setMostrar((m) => !m)}>
            {mostrar ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <MensagemErro id={erroId} texto={erro} />
      </div>
      <button className="btn btn-primario btn-bloco btn-grande" type="submit" disabled={busy}>
        {busy && <span className="carregando is-claro" aria-hidden="true" />}
        Alterar senha
      </button>
      <button type="button" className="btn-link login-link-centro" onClick={onVoltar}>
        <ArrowLeft size={18} aria-hidden="true" />
        Voltar para entrar
      </button>
    </form>
  );
};

/** Entrar (Figma 45:4063 computador, 45:4203 celular). */
export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoggedIn,
  onContinueDemo,
  onCadastro,
}) => {
  const [modo, setModo] = useState<"entrar" | "recuperar">("entrar");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState("");
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const compacto = useMediaQuery(ATE_TABLET);
  const erroId = useId();
  const [tentativa, setTentativa] = useState(0);
  // No erro de login, o campo de senha treme uma vez.
  const caixaSenha = useTremor(tentativa);

  // Contagem regressiva enquanto o backend mantém o acesso em espera
  useEffect(() => {
    if (!bloqueadoAte) return;
    const t = window.setInterval(() => {
      setAgora(Date.now());
      if (Date.now() >= bloqueadoAte) {
        setBloqueadoAte(null);
        setErro("");
        gravarFalhas([]);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [bloqueadoAte]);

  const esperaRestante = bloqueadoAte ? Math.max(0, Math.ceil((bloqueadoAte - agora) / 1000)) : 0;
  const esperaTexto =
    esperaRestante >= 60 ? `${Math.ceil(esperaRestante / 60)} min` : `${esperaRestante} s`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bloqueadoAte) return;
    setBusy(true);
    setErro("");
    setOffline(false);
    try {
      await auth.login(username.trim(), password, lembrar);
      gravarFalhas([]);
      onLoggedIn();
    } catch (e) {
      if (!(e instanceof ApiError)) {
        setOffline(true);
        return;
      }
      if (e.status === 429) {
        // O backend recusa por 5 minutos a partir das primeiras falhas; mostramos a espera com folga.
        const falhas = lerFalhas();
        const fim = (falhas[0] ?? Date.now()) + JANELA_MS;
        setBloqueadoAte(fim > Date.now() ? fim : Date.now() + JANELA_MS);
        setAgora(Date.now());
        setErro(e.message || "Muitas tentativas. Aguarde alguns minutos.");
        setTentativa((n) => n + 1);
        return;
      }
      if (e.status === 401) {
        const falhas = [...lerFalhas(), Date.now()];
        gravarFalhas(falhas);
        const restam = MAX_TENTATIVAS - falhas.length;
        setErro(
          restam > 1
            ? `E-mail ou senha não conferem. Restam ${restam} tentativas.`
            : restam === 1
              ? "E-mail ou senha não conferem. Resta 1 tentativa."
              : "E-mail ou senha não conferem. O acesso vai esperar alguns minutos.",
        );
        setTentativa((n) => n + 1);
        return;
      }
      setErro(e.message);
      setTentativa((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const rota = planPath(FALLBACK_LAYOUT, ROBO_ILUSTRACAO, DESTINO_ILUSTRACAO);
  const temErro = !!erro;

  return (
    <main className="login">
      {!compacto && (
        <section className="login-casa" aria-hidden="true">
          <div className="login-marca">
            <span className="marca-simbolo">
              <HeartPulse size={22} />
            </span>
            <span className="marca-nome">
              Amparo<small>Telecuidado familiar</small>
            </span>
          </div>
          <p className="frase login-frase">
            Você vê como ele está.{" "}
            <span className="frase-apoio">O Amparo avisa quando precisar.</span>
          </p>
          <div className="login-planta">
            <PlantaCasa
              layout={FALLBACK_LAYOUT}
              comodoPessoa="sala"
              robo={ROBO_ILUSTRACAO}
              rota={rota}
              estados={ESTADOS_ILUSTRACAO}
              decorativa
            />
          </div>
        </section>
      )}

      {/* Primeira carga: o cartão entra com fade + 8 px */}
      <motion.section
        className="login-formulario"
        initial={{ opacity: 0, y: DESLOCA }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.media, ease: EASE_MOTION }}
      >
        {compacto && (
          <div className="login-marca login-marca-celular">
            <span className="marca-simbolo">
              <HeartPulse size={20} aria-hidden="true" />
            </span>
            <span className="marca-nome">Amparo</span>
          </div>
        )}
        {auth.persistenceWarning && (
          <p className="nota is-aviso login-largura" role="status">
            {auth.persistenceWarning}
          </p>
        )}
        {modo === "recuperar" ? (
          <Recuperar emailInicial={username} onVoltar={() => setModo("entrar")} />
        ) : (
          <form className="login-caixa" onSubmit={(e) => void submit(e)}>
            <div className="login-titulos">
              <h1 className="login-titulo">Entrar</h1>
              <p className="texto-secundario">Acompanhe quem você cuida, de onde estiver.</p>
            </div>

            <div className="campo">
              <label className="campo-rotulo" htmlFor="login-usuario">
                E-mail
              </label>
              <div className="campo-caixa">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-usuario"
                  type="email"
                  className="campo-entrada"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={120}
                />
              </div>
            </div>

            <div className="campo">
              <label className="campo-rotulo" htmlFor="login-senha">
                Senha
              </label>
              <div ref={caixaSenha} className={`campo-caixa${temErro ? " is-erro" : ""}`}>
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-senha"
                  className="campo-entrada"
                  type={mostrar ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  maxLength={120}
                  aria-invalid={temErro || undefined}
                  aria-describedby={temErro ? erroId : undefined}
                />
                <button
                  type="button"
                  className="campo-acao"
                  onClick={() => setMostrar((v) => !v)}
                  aria-pressed={mostrar}
                  aria-controls="login-senha"
                >
                  {mostrar ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <MensagemErro
                id={erroId}
                texto={
                  erro +
                  (bloqueadoAte && esperaRestante > 0 ? ` Tente de novo em ${esperaTexto}.` : "")
                }
              />
            </div>

            <div className="login-opcoes">
              <label className="caixa-selecao">
                <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
                <span className="caixa-selecao-marca" aria-hidden="true">
                  <Check size={15} strokeWidth={3} />
                </span>
                Manter conectado
              </label>
              <button type="button" className="btn-link" onClick={() => setModo("recuperar")}>
                Esqueci a senha
              </button>
            </div>

            <button className="btn btn-primario btn-bloco btn-grande" type="submit" disabled={busy || !!bloqueadoAte}>
              {busy ? (
                <>
                  <span className="carregando is-claro" aria-hidden="true" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>

            {offline && (
              <div className="nota is-aviso" role="alert">
                <WifiOff size={16} aria-hidden="true" />
                <div>
                  <p>O servidor do Amparo não respondeu. Você pode ver o painel com dados de exemplo.</p>
                  <button type="button" className="btn-link" onClick={onContinueDemo}>
                    Continuar em modo demonstração
                  </button>
                </div>
              </div>
            )}

            <div className="login-divisor" role="separator">
              <span>primeira vez aqui?</span>
            </div>
            <button type="button" className="btn btn-secundario btn-bloco btn-grande login-criar" onClick={() => onCadastro(false)}>
              Criar conta da família
            </button>
            <button type="button" className="btn-link login-link-centro" onClick={() => onCadastro(true)}>
              <Users size={18} aria-hidden="true" />
              Recebi um convite de outro familiar
            </button>

            <div className="nota login-seguranca">
              <ShieldCheck size={18} aria-hidden="true" />
              <p>
                Após 5 tentativas erradas, o acesso espera 5 minutos. Esqueceu a senha? Use o código
                de recuperação que você guardou no cadastro.
              </p>
            </div>
          </form>
        )}
      </motion.section>
    </main>
  );
};
