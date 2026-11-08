import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, HeartPulse, Lock, User, WifiOff } from "lucide-react";
import { ApiError, auth } from "../services/auth";
import { FALLBACK_LAYOUT, planPath } from "../robot/houseLayout";
import { PlantaCasa, PlantaSimplificada } from "./planta/PlantaCasa";
import { CELULAR, useMediaQuery } from "../hooks/useMediaQuery";
import { gsap, movimentoReduzido, useGSAP } from "../motion/gsap";
import { DESLOCA, DUR, EASE_MOTION } from "../motion/tokens";

interface LoginScreenProps {
  onLoggedIn: () => void;
  onContinueDemo: () => void;
}

// Mesmo limite do LoginRateLimiter do backend: 5 tentativas erradas a cada 5 minutos.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 5 * 60 * 1000;
const CHAVE_FALHAS = "amparo_login_falhas";

const lerFalhas = (): number[] => {
  try {
    const lista = JSON.parse(
      sessionStorage.getItem(CHAVE_FALHAS) ?? "[]",
    ) as number[];
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
const ESTADOS_ILUSTRACAO_CELULAR = {
  sala: { titulo: "José está aqui", tom: "pessoa" as const },
  cozinha: { titulo: "Robô na ronda" },
  quarto: { titulo: "Vazio" },
  banheiro: { titulo: "Vazio" },
  escritorio: { titulo: "Vazio" },
};

/** Login do familiar (Figma 31:2210, 31:2298, 34:2229, 38:3513). */
export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoggedIn,
  onContinueDemo,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cadastro, setCadastro] = useState(false);
  const [nome, setNome] = useState("");
  const [invite, setInvite] = useState("");
  const [recuperar, setRecuperar] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [setup, setSetup] = useState<{
    deviceId: string;
    robotId: string;
    deviceKey: string;
    recoveryCode: string;
  } | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState("");
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const celular = useMediaQuery(CELULAR);
  const erroId = useId();
  const caixaSenha = useRef<HTMLDivElement>(null);
  const [tentativa, setTentativa] = useState(0);

  // Erro: o campo treme de leve uma vez (x: 0 → −4 → 4 → 0, 240 ms). Com movimento reduzido, não treme.
  useGSAP(
    () => {
      if (!tentativa || !caixaSenha.current || movimentoReduzido()) return;
      gsap.to(caixaSenha.current, {
        keyframes: { x: [0, -4, 4, 0] },
        duration: 0.24,
        ease: "none",
        clearProps: "transform",
      });
    },
    { dependencies: [tentativa] },
  );

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

  const esperaRestante = bloqueadoAte
    ? Math.max(0, Math.ceil((bloqueadoAte - agora) / 1000))
    : 0;
  const esperaTexto =
    esperaRestante >= 60
      ? `${Math.ceil(esperaRestante / 60)} min`
      : `${esperaRestante} s`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bloqueadoAte) return;
    setBusy(true);
    setErro("");
    setOffline(false);
    try {
      if (recuperar) {
        const res = await fetch("/api/v1/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: username,
            recoveryCode: codigo,
            password,
          }),
        });
        const body = await res.json();
        if (!res.ok)
          throw new ApiError(
            res.status,
            body.message ?? "Não foi possível recuperar",
          );
        setCodigo(body.recoveryCode);
        setErro(
          "Senha alterada. Guarde o novo código de recuperação: " +
            body.recoveryCode,
        );
        setRecuperar(false);
        return;
      }
      if (cadastro) {
        setSetup(
          await auth.register(
            nome,
            username.trim(),
            password,
            pessoa,
            invite,
            lembrar,
          ),
        );
        return;
      }
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
            ? `Usuário ou senha não conferem. Restam ${restam} tentativas.`
            : restam === 1
              ? "Usuário ou senha não conferem. Resta 1 tentativa."
              : "Usuário ou senha não conferem. O acesso vai esperar alguns minutos.",
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
          {celular ? (
            <PlantaSimplificada
              layout={FALLBACK_LAYOUT}
              comodoPessoa="sala"
              comodoRobo="cozinha"
              estados={ESTADOS_ILUSTRACAO_CELULAR}
              decorativa
            />
          ) : (
            <PlantaCasa
              layout={FALLBACK_LAYOUT}
              comodoPessoa="sala"
              robo={ROBO_ILUSTRACAO}
              rota={rota}
              estados={ESTADOS_ILUSTRACAO}
              decorativa
            />
          )}
        </div>
      </section>

      <section className="login-formulario">
        {/* Primeira carga: o formulário entra com fade + 8 px */}
        <motion.form
          className="login-caixa"
          onSubmit={(e) => void submit(e)}
          initial={{ opacity: 0, y: DESLOCA }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.media, ease: EASE_MOTION }}
        >
          <h1 className="sr-only">Amparo · Entrar</h1>
          <div className="login-titulos">
            <h2 className="login-titulo">
              {cadastro
                ? "Criar conta da família"
                : recuperar
                  ? "Alterar senha"
                  : "Entrar"}
            </h2>
            <p className="texto-secundario">
              Entre com seu e-mail ou crie o acesso da sua família.
              {cadastro &&
                " Qualquer pessoa pode criar sua conta; convite só é necessário para compartilhar uma família existente."}
            </p>
          </div>

          {auth.persistenceWarning && (
            <p className="nota is-aviso" role="status">
              {auth.persistenceWarning}
            </p>
          )}
          {setup ? (
            <div className="nota is-sucesso" role="status">
              <div>
                <strong>
                  Conta criada. Guarde as credenciais do equipamento.
                </strong>
                <p>Dispositivo: {setup.deviceId}</p>
                <p>Robô: {setup.robotId}</p>
                <p style={{ overflowWrap: "anywhere" }}>
                  Código de recuperação da conta:{" "}
                  <code>{setup.recoveryCode}</code>
                </p>
                <p>
                  Chave:{" "}
                  <code style={{ overflowWrap: "anywhere" }}>
                    {setup.deviceKey}
                  </code>
                </p>
                <p>
                  A chave aparece só agora. Nas configurações você pode gerar
                  outra, invalidando esta.
                </p>
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={onLoggedIn}
                >
                  Guardei, abrir painel
                </button>
              </div>
            </div>
          ) : (
            <>
              {recuperar && (
                <div className="campo">
                  <label htmlFor="recuperacao">Código de recuperação</label>
                  <input
                    id="recuperacao"
                    className="campo-entrada"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>
              )}
              {cadastro && (
                <>
                  <div className="campo">
                    <label htmlFor="convite">
                      Convite de outro familiar (opcional)
                    </label>
                    <input
                      id="convite"
                      className="campo-entrada"
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="cadastro-nome">Seu nome</label>
                    <input
                      className="campo-entrada"
                      id="cadastro-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="cadastro-pessoa">
                      Quem será acompanhado?
                    </label>
                    <input
                      className="campo-entrada"
                      id="cadastro-pessoa"
                      value={pessoa}
                      onChange={(e) => setPessoa(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                </>
              )}
              <div className="campo">
                <label className="campo-rotulo" htmlFor="login-usuario">
                  E-mail
                </label>
                <div className="campo-caixa">
                  <User size={18} aria-hidden="true" />
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
                <div
                  ref={caixaSenha}
                  className={`campo-caixa${temErro ? " is-erro" : ""}`}
                >
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="login-senha"
                    className="campo-entrada"
                    type={mostrar ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      cadastro ? "new-password" : "current-password"
                    }
                    required
                    minLength={cadastro || recuperar ? 12 : undefined}
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
                <AnimatePresence initial={false}>
                  {temErro && (
                    <motion.p
                      key="erro"
                      id={erroId}
                      className="campo-erro"
                      role="alert"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.14 } }}
                      transition={{ duration: DUR.curta, ease: EASE_MOTION }}
                    >
                      {erro}
                      {bloqueadoAte && esperaRestante > 0
                        ? ` Tente de novo em ${esperaTexto}.`
                        : ""}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <label className="caixa-selecao">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                />
                <span className="caixa-selecao-marca" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
                Manter conectado neste aparelho
              </label>

              <button
                className="btn btn-primario btn-bloco btn-grande"
                type="submit"
                disabled={busy || !!bloqueadoAte}
              >
                {busy ? (
                  <>
                    <span className="carregando is-claro" aria-hidden="true" />
                    Entrando…
                  </>
                ) : recuperar ? (
                  "Alterar senha"
                ) : cadastro ? (
                  "Criar conta"
                ) : (
                  "Entrar"
                )}
              </button>

              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setCadastro(!cadastro);
                  setRecuperar(false);
                  setBloqueadoAte(null);
                  setErro("");
                  setOffline(false);
                }}
              >
                {cadastro ? "Já tenho conta" : "Criar conta da família"}
              </button>
              {cadastro && (
                <p className="texto-pequeno">
                  Use uma senha com pelo menos 12 caracteres.
                </p>
              )}
            </>
          )}
          {offline && (
            <div className="nota is-aviso" role="alert">
              <WifiOff size={16} aria-hidden="true" />
              <div>
                <p>
                  O servidor do Amparo não respondeu. Você pode ver o painel com
                  dados de exemplo.
                </p>
                <button
                  type="button"
                  className="btn-link"
                  onClick={onContinueDemo}
                >
                  Continuar em modo demonstração
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setRecuperar(!recuperar);
              setCadastro(false);
              setErro("");
            }}
          >
            {recuperar ? "Voltar ao login" : "Recuperar com meu código"}
          </button>
          <p className="nota login-seguranca">
            <Lock size={16} aria-hidden="true" />
            <span className="login-seguranca-longa">
              Após 5 tentativas erradas, o acesso espera 5 minutos. Use HTTPS ao
              acessar pela rede.
            </span>
            <span className="login-seguranca-curta">
              Após 5 tentativas erradas, o acesso espera 5 minutos.
            </span>
          </p>
        </motion.form>
      </section>
    </main>
  );
};
