import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { ArrowLeft, HeartPulse, ShieldCheck } from "lucide-react";
import { cuidado, useCuidado } from "../../lib/cuidado";
import { ATE_TABLET, useMediaQuery } from "../../hooks/useMediaQuery";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import { PassosMissao, type Passo } from "../ui/PassoMissao";
import { progresso, useProgresso } from "./progresso";
import { PASSOS, TOTAL_PASSOS, passoPulado } from "./regras";
import { FORM_PASSO, RodapeCtx, type Rodape } from "./ui";
import { PassoConta } from "./PassoConta";
import { PassoPessoa } from "./PassoPessoa";
import { PassoConsentimento } from "./PassoConsentimento";
import { PassoEndereco } from "./PassoEndereco";
import { PassoPlanta } from "./PassoPlanta";
import { PassoAvisos } from "./PassoAvisos";
import { PassoAcesso } from "./PassoAcesso";
import { PassoComecar } from "./PassoComecar";

export const CadastroCtx = React.createContext<{ concluir: () => void }>({
  concluir: () => undefined,
});

/**
 * Troca de passo: ao avançar, o novo entra da direita (x 24 → 0, 300 ms) e o antigo sai para a
 * esquerda (200 ms); ao voltar, o sentido inverte. Com movimento reduzido o MotionConfig do app
 * deixa só a opacidade.
 */
const TROCA: Variants = {
  entra: (d: number) => ({ x: 24 * d, opacity: 0 }),
  centro: {
    x: 0,
    opacity: 1,
    transition: { duration: DUR.media, ease: EASE_MOTION },
  },
  sai: (d: number) => ({
    x: -24 * d,
    opacity: 0,
    transition: { duration: saida(DUR.media), ease: EASE_MOTION },
  }),
};

/** Barra do celular: o segmento novo se preenche da esquerda para a direita (300 ms). */
const BarraProgresso: React.FC<{ passo: number }> = ({ passo }) => (
  <div
    className="cad-barra"
    role="progressbar"
    aria-label="Progresso do cadastro"
    aria-valuemin={1}
    aria-valuemax={TOTAL_PASSOS}
    aria-valuenow={passo}
    aria-valuetext={`Passo ${passo} de ${TOTAL_PASSOS}`}
  >
    {PASSOS.map((_, i) => (
      <span key={i} className="cad-barra-segmento">
        <motion.span
          className="cad-barra-cheio"
          initial={false}
          animate={{ scaleX: i < passo ? 1 : 0 }}
          transition={{ duration: DUR.media, ease: EASE_MOTION }}
        />
      </span>
    ))}
  </div>
);

const Marca: React.FC = () => (
  <div className="cad-marca">
    <span className="marca-simbolo cad-marca-simbolo">
      <HeartPulse size={20} aria-hidden="true" />
    </span>
    <span className="marca-nome cad-marca-nome">
      Amparo<small>Cadastro da família</small>
    </span>
  </div>
);

interface CadastroProps {
  /** Volta para a tela de entrada. */
  onEntrar: () => void;
  /** "Sair" no topo: encerra a sessão e volta para Entrar na hora. */
  onSair: () => void;
  /** Terminou (passo 8, ou o consentimento pedido pelo painel). */
  onConcluir: () => void;
}

/** Cadastro da família em 8 passos (Figma 43:3393 … 44:5130). */
export const Cadastro: React.FC<CadastroProps> = ({ onEntrar, onSair, onConcluir }) => {
  const p = useProgresso();
  const prefs = useCuidado();
  const compacto = useMediaQuery(ATE_TABLET);
  const [rodape, setRodape] = useState<Rodape>({ rotulo: "Continuar" });
  const definirRodape = useCallback((r: Rodape) => setRodape(r), []);
  const area = useRef<HTMLDivElement>(null);
  const primeiro = useRef(true);
  const registrado = !!p.email;
  const precisaPrefs = registrado && p.passo >= 2 && p.passo !== 7;
  const prefsProntas = cuidado.pronto();

  // Conta nova: o passo vai para o servidor já no início, para outra aba retomar o cadastro.
  const marcou = useRef(false);
  useEffect(() => {
    if (
      !registrado ||
      p.convite ||
      p.soConsentimento ||
      !prefsProntas ||
      marcou.current ||
      typeof prefs.onboardingStep === "number"
    )
      return;
    marcou.current = true;
    void cuidado.salvarCadastro({ onboardingStep: p.passo });
  }, [registrado, p.convite, p.soConsentimento, p.passo, prefsProntas, prefs.onboardingStep]);

  // Depois da troca, o título do passo novo recebe o foco (leitores de tela anunciam o passo).
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const titulos = area.current?.querySelectorAll<HTMLElement>("[data-titulo-passo]");
    titulos?.[titulos.length - 1]?.focus({ preventScroll: true });
  }, [p.passo]);

  const concluir = useCallback(() => {
    progresso.concluir();
    onConcluir();
  }, [onConcluir]);
  const ctx = useMemo(() => ({ concluir }), [concluir]);

  const voltar = () => {
    if (p.soConsentimento) concluir();
    else if (p.passo === 1 && !registrado) {
      progresso.cancelar();
      onEntrar();
    } else progresso.voltar();
  };
  const sair = () => onSair();

  const podeVoltar = !rodape.semVoltar || (p.passo === 1 && !registrado);
  const passos: Passo[] = PASSOS.map((m, i) => ({
    titulo: m.titulo,
    detalhe: passoPulado(i + 1, p.convite) ? "Já feito pela família" : m.detalhe,
    estado: i + 1 < p.passo ? "feito" : i + 1 === p.passo ? "atual" : "pendente",
  }));

  let conteudo: React.ReactNode;
  if (precisaPrefs && !prefsProntas) {
    conteudo = cuidado.carregando() ? (
      <p className="cad-carregando" role="status">
        <span className="carregando" aria-hidden="true" /> Carregando o cadastro…
      </p>
    ) : (
      <div className="cad-form" role="alert">
        <h1 className="cad-titulo" tabIndex={-1} data-titulo-passo="">
          Não foi possível carregar o cadastro
        </h1>
        <p className="cad-apoio">Confira a conexão. O que já foi salvo continua guardado.</p>
        <button type="button" className="btn btn-secundario" onClick={() => void cuidado.recarregar()}>
          Tentar de novo
        </button>
      </div>
    );
  } else {
    conteudo = [
      <PassoConta key={1} />,
      <PassoPessoa key={2} />,
      <PassoConsentimento key={3} />,
      <PassoEndereco key={4} />,
      <PassoPlanta key={5} />,
      <PassoAvisos key={6} />,
      <PassoAcesso key={7} />,
      <PassoComecar key={8} />,
    ][p.passo - 1];
  }

  const botaoPrincipal = (
    <button
      type="submit"
      form={FORM_PASSO}
      className="btn btn-primario cad-continuar"
      disabled={rodape.desabilitado || rodape.ocupado}
      aria-describedby={rodape.desabilitado && rodape.dica ? "cad-dica" : undefined}
    >
      {rodape.ocupado && <span className="carregando is-claro" aria-hidden="true" />}
      {rodape.rotulo}
    </button>
  );

  return (
    <CadastroCtx.Provider value={ctx}>
      <RodapeCtx.Provider value={definirRodape}>
        <main className="cadastro">
          {!compacto && (
            <aside className="cad-trilha" aria-label="Etapas do cadastro">
              <Marca />
              <PassosMissao passos={passos} rotulo="Etapas do cadastro" pulsoUnico />
              <div className="cad-trilha-espaco" />
              <div className="cad-nota is-neutra">
                <ShieldCheck size={18} aria-hidden="true" />
                <p>Leva uns 5 minutos. Tudo pode ser mudado depois em Configurações.</p>
              </div>
            </aside>
          )}

          <section className="cad-cartao">
            {compacto ? (
              <header className="cad-topo-celular">
                <div className="cad-topo-barra">
                  {podeVoltar ? (
                    <button
                      type="button"
                      className="btn-icone is-redondo cad-voltar-celular"
                      onClick={voltar}
                      aria-label={p.passo === 1 && !registrado ? "Voltar para a entrada" : "Voltar ao passo anterior"}
                    >
                      <ArrowLeft size={20} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="cad-voltar-vazio" />
                  )}
                  <p className="cad-topo-nome">{PASSOS[p.passo - 1]!.titulo}</p>
                  <p className="cad-topo-contagem">
                    {p.passo} de {TOTAL_PASSOS}
                  </p>
                </div>
                <BarraProgresso passo={p.passo} />
              </header>
            ) : (
              <div className="cad-topo">
                {registrado ? (
                  <>
                    <span>Termina depois?</span>
                    <button type="button" className="btn-link" onClick={sair}>
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <span>Já tem conta?</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        progresso.cancelar();
                        onEntrar();
                      }}
                    >
                      Entrar
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="cad-coluna" ref={area}>
              <div className="cad-palco">
                <AnimatePresence mode="popLayout" initial={false} custom={p.direcao}>
                  <motion.div
                    key={`${p.passo}:${precisaPrefs && !prefsProntas}`}
                    className="cad-passo"
                    custom={p.direcao}
                    variants={TROCA}
                    initial="entra"
                    animate="centro"
                    exit="sai"
                  >
                    {conteudo}
                  </motion.div>
                </AnimatePresence>
              </div>

              {!compacto && (
                <div className="cad-acoes">
                  {podeVoltar && p.passo > 1 && (
                    <button type="button" className="btn btn-secundario cad-voltar" onClick={voltar}>
                      <ArrowLeft size={18} aria-hidden="true" />
                      Voltar
                    </button>
                  )}
                  <span className="cad-acoes-espaco" />
                  {rodape.desabilitado && rodape.dica && (
                    <span id="cad-dica" className="texto-pequeno">
                      {rodape.dica}
                    </span>
                  )}
                  {botaoPrincipal}
                </div>
              )}
            </div>

            {compacto && (
              <footer className="cad-rodape-celular">
                {rodape.desabilitado && rodape.dica && (
                  <span id="cad-dica" className="texto-pequeno">
                    {rodape.dica}
                  </span>
                )}
                {botaoPrincipal}
              </footer>
            )}
          </section>
        </main>
      </RodapeCtx.Provider>
    </CadastroCtx.Provider>
  );
};
