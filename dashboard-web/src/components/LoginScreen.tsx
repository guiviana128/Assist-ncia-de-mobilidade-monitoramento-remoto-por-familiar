import React, { useEffect, useId, useState } from 'react';
import { Check, HeartPulse, Lock, User, WifiOff } from 'lucide-react';
import { ApiError, auth } from '../services/auth';
import { FALLBACK_LAYOUT, planPath } from '../robot/houseLayout';
import { PlantaCasa, PlantaSimplificada } from './planta/PlantaCasa';
import { CELULAR, useMediaQuery } from '../hooks/useMediaQuery';

interface LoginScreenProps {
  onLoggedIn: () => void;
  onContinueDemo: () => void;
}

// Mesmo limite do LoginRateLimiter do backend: 5 tentativas erradas a cada 5 minutos.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 5 * 60 * 1000;
const CHAVE_FALHAS = 'amparo_login_falhas';

const lerFalhas = (): number[] => {
  try {
    const lista = JSON.parse(sessionStorage.getItem(CHAVE_FALHAS) ?? '[]') as number[];
    return lista.filter(t => Date.now() - t < JANELA_MS);
  } catch { return []; }
};
const gravarFalhas = (lista: number[]) => {
  try { sessionStorage.setItem(CHAVE_FALHAS, JSON.stringify(lista)); } catch { /* armazenamento indisponível */ }
};

// Ilustração do lado esquerdo: a casa com o José na Sala e o robô fazendo a ronda.
const ROBO_ILUSTRACAO = { x: 5.5, y: -1 };
const DESTINO_ILUSTRACAO = { x: 4.2, y: 3 };
const ESTADOS_ILUSTRACAO = {
  sala: { titulo: 'José está aqui · há 40 min', tom: 'pessoa' as const },
  cozinha: { titulo: 'Robô fazendo a ronda' },
  quarto: { titulo: 'Vazio desde 08:50' },
  banheiro: { titulo: 'Vazio' },
  escritorio: { titulo: 'Vazio' }
};
const ESTADOS_ILUSTRACAO_CELULAR = {
  sala: { titulo: 'José está aqui', tom: 'pessoa' as const },
  cozinha: { titulo: 'Robô na ronda' },
  quarto: { titulo: 'Vazio' },
  banheiro: { titulo: 'Vazio' },
  escritorio: { titulo: 'Vazio' }
};

/** Login do familiar (Figma 31:2210, 31:2298, 34:2229, 38:3513). */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoggedIn, onContinueDemo }) => {
  const [username, setUsername] = useState('familia');
  const [password, setPassword] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState('');
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const celular = useMediaQuery(CELULAR);
  const erroId = useId();

  // Contagem regressiva enquanto o backend mantém o acesso em espera
  useEffect(() => {
    if (!bloqueadoAte) return;
    const t = window.setInterval(() => {
      setAgora(Date.now());
      if (Date.now() >= bloqueadoAte) { setBloqueadoAte(null); setErro(''); gravarFalhas([]); }
    }, 1000);
    return () => window.clearInterval(t);
  }, [bloqueadoAte]);

  const esperaRestante = bloqueadoAte ? Math.max(0, Math.ceil((bloqueadoAte - agora) / 1000)) : 0;
  const esperaTexto = esperaRestante >= 60 ? `${Math.ceil(esperaRestante / 60)} min` : `${esperaRestante} s`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bloqueadoAte) return;
    setBusy(true);
    setErro('');
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
        setErro(e.message || 'Muitas tentativas. Aguarde alguns minutos.');
        return;
      }
      if (e.status === 401) {
        const falhas = [...lerFalhas(), Date.now()];
        gravarFalhas(falhas);
        const restam = MAX_TENTATIVAS - falhas.length;
        setErro(restam > 1 ? `Usuário ou senha não conferem. Restam ${restam} tentativas.`
          : restam === 1 ? 'Usuário ou senha não conferem. Resta 1 tentativa.'
            : 'Usuário ou senha não conferem. O acesso vai esperar alguns minutos.');
        return;
      }
      setErro(e.message);
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
          <span className="marca-simbolo" ><HeartPulse size={22} /></span>
          <span className="marca-nome">Amparo<small>Telecuidado familiar</small></span>
        </div>
        <p className="frase login-frase">Você vê como ele está. <span className="frase-apoio">O Amparo avisa quando precisar.</span></p>
        <div className="login-planta">
          {celular
            ? <PlantaSimplificada layout={FALLBACK_LAYOUT} comodoPessoa="sala" comodoRobo="cozinha" estados={ESTADOS_ILUSTRACAO_CELULAR} decorativa />
            : <PlantaCasa layout={FALLBACK_LAYOUT} comodoPessoa="sala" robo={ROBO_ILUSTRACAO} rota={rota} estados={ESTADOS_ILUSTRACAO} decorativa />}
        </div>
      </section>

      <section className="login-formulario">
        <form className="login-caixa" onSubmit={e => void submit(e)} noValidate>
          <h1 className="sr-only">Amparo · Entrar</h1>
          <div className="login-titulos">
            <h2 className="login-titulo">Entrar</h2>
            <p className="texto-secundario">Use o acesso da família que cadastrou a bengala.</p>
          </div>

          <div className="campo">
            <label className="campo-rotulo" htmlFor="login-usuario">Usuário</label>
            <div className="campo-caixa">
              <User size={18} aria-hidden="true" />
              <input id="login-usuario" className="campo-entrada" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={60} />
            </div>
          </div>

          <div className="campo">
            <label className="campo-rotulo" htmlFor="login-senha">Senha</label>
            <div className={`campo-caixa${temErro ? ' is-erro' : ''}`}>
              <Lock size={18} aria-hidden="true" />
              <input id="login-senha" className="campo-entrada" type={mostrar ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" required maxLength={120}
                aria-invalid={temErro || undefined} aria-describedby={temErro ? erroId : undefined} />
              <button type="button" className="campo-acao" onClick={() => setMostrar(v => !v)}
                aria-pressed={mostrar} aria-controls="login-senha">
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {temErro && (
              <p id={erroId} className="campo-erro" role="alert">
                {erro}{bloqueadoAte && esperaRestante > 0 ? ` Tente de novo em ${esperaTexto}.` : ''}
              </p>
            )}
          </div>

          <label className="caixa-selecao">
            <input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} />
            <span className="caixa-selecao-marca" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
            Manter conectado neste aparelho
          </label>

          <button className="btn btn-primario btn-bloco btn-grande" type="submit" disabled={busy || !!bloqueadoAte}>
            {busy ? <><span className="carregando is-claro" aria-hidden="true" />Entrando…</> : 'Entrar'}
          </button>

          {offline && (
            <div className="nota is-aviso" role="alert">
              <WifiOff size={16} aria-hidden="true" />
              <div>
                <p>O servidor do Amparo não respondeu. Você pode ver o painel com dados de exemplo.</p>
                <button type="button" className="btn-link" onClick={onContinueDemo}>Continuar em modo demonstração</button>
              </div>
            </div>
          )}

          <p className="texto-pequeno login-esqueceu">Esqueceu a senha? Peça um novo acesso a quem instalou o Amparo.</p>
          <p className="nota login-seguranca">
            <Lock size={16} aria-hidden="true" />
            <span className="login-seguranca-longa">Conexão protegida. Após 5 tentativas erradas, o acesso espera 5 minutos.</span>
            <span className="login-seguranca-curta">Após 5 tentativas erradas, o acesso espera 5 minutos.</span>
          </p>
        </form>
      </section>
    </main>
  );
};
