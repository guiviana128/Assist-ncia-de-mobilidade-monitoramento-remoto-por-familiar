import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Copy, Download, KeyRound } from "lucide-react";
import { apiJson } from "../../services/auth";
import { cuidado, useCuidado } from "../../lib/cuidado";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import { progresso, useProgresso, type Acesso } from "./progresso";
import { encurtar } from "./regras";
import { CaixaSelecao, FORM_PASSO, TituloPasso, useRodape } from "./ui";

/** "Copiar" vira "Copiado" com um check desenhado por 2 s. */
const BotaoCopiar: React.FC<{ valor: string; rotulo: string }> = ({ valor, rotulo }) => {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setFalhou(false);
      setCopiado(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setFalhou(true);
    }
  };
  return (
    <button
      type="button"
      className="btn btn-secundario cad-copiar"
      onClick={() => void copiar()}
      aria-label={copiado ? `${rotulo} copiado` : `Copiar ${rotulo}`}
      title={falhou ? "O navegador não deixou copiar. Selecione o texto." : undefined}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copiado ? (
          <motion.span
            key="ok"
            className="cad-copiar-conteudo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.rapida } }}
            exit={{ opacity: 0, transition: { duration: saida(DUR.rapida) } }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="check-desenhado">
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: DUR.curta, ease: EASE_MOTION }}
              />
            </svg>
            Copiado
          </motion.span>
        ) : (
          <motion.span
            key="copiar"
            className="cad-copiar-conteudo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.rapida } }}
            exit={{ opacity: 0, transition: { duration: saida(DUR.rapida) } }}
          >
            <Copy size={18} aria-hidden="true" />
            Copiar
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

const Codigo: React.FC<{
  titulo: string;
  valor: string;
  ajuda: string;
  longo?: boolean;
}> = ({ titulo, valor, ajuda, longo }) => (
  <div className="cad-codigo">
    <p className="campo-rotulo">{titulo}</p>
    <div className="cad-codigo-caixa">
      <code className="cad-codigo-valor" title={longo ? valor : undefined}>
        {longo ? encurtar(valor) : valor}
      </code>
      <BotaoCopiar valor={valor} rotulo={titulo.toLowerCase()} />
    </div>
    <p className="texto-pequeno">{ajuda}</p>
  </div>
);

/** Folha própria para imprimir ou salvar em PDF (o resto da página some na impressão). */
const FolhaImpressao: React.FC<{ acesso: Acesso; email: string | null; pessoa?: string }> = ({
  acesso,
  email,
  pessoa,
}) =>
  createPortal(
    <section className="folha-impressao" aria-hidden="true">
      <h1>Amparo · acesso da família</h1>
      <p>
        {pessoa ? `Acompanhamento de ${pessoa}. ` : ""}
        Guarde esta folha em um lugar seguro. Não fotografe nem envie por mensagem.
      </p>
      <dl>
        {email && (
          <>
            <dt>Conta</dt>
            <dd>{email}</dd>
          </>
        )}
        <dt>Código de recuperação da conta</dt>
        <dd>
          <code>{acesso.recoveryCode}</code>
        </dd>
        {acesso.deviceKey && (
          <>
            <dt>Chave dos equipamentos</dt>
            <dd>
              <code>{acesso.deviceKey}</code>
            </dd>
          </>
        )}
        <dt>Bengala</dt>
        <dd>{acesso.deviceId}</dd>
        <dt>Robô</dt>
        <dd>{acesso.robotId}</dd>
      </dl>
      <p>Gerado em {new Date().toLocaleString("pt-BR")}.</p>
    </section>,
    document.body,
  );

/** Passo 7 · Guardar o acesso (Figma 44:4493 / 44:4729). */
export const PassoAcesso: React.FC = () => {
  const p = useProgresso();
  const prefs = useCuidado();
  const [acesso, setAcesso] = useState<Acesso | null>(() => progresso.acesso());
  const [guardei, setGuardei] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useRodape({
    rotulo: ocupado ? "Salvando…" : "Continuar",
    ocupado,
    desabilitado: !guardei || !acesso,
    dica: guardei ? undefined : "Marque a confirmação para seguir",
    semVoltar: p.convite,
  });

  // Os códigos só aparecem no registro. Em outra aba, gera outros (os antigos deixam de valer).
  const gerarNovos = async () => {
    setOcupado(true);
    setErro("");
    try {
      const [{ recoveryCode }, aparelhos] = await Promise.all([
        apiJson<{ recoveryCode: string }>("/care/recovery-code", { method: "POST" }),
        apiJson<{ deviceId: string; robotId: string }[]>("/care/devices"),
      ]);
      const aparelho = aparelhos[0];
      if (!aparelho) throw Error("sem aparelho");
      // Quem entrou por convite não troca a chave: os equipamentos da família já usam a atual.
      const deviceKey = p.convite
        ? ""
        : (
            await apiJson<{ deviceKey: string }>(
              `/care/devices/${encodeURIComponent(aparelho.deviceId)}/key`,
              { method: "POST" },
            )
          ).deviceKey;
      const novo = { recoveryCode, deviceKey, ...aparelho };
      progresso.guardarAcesso(novo);
      setAcesso(novo);
    } catch {
      setErro("Não foi possível gerar os códigos. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardei || !acesso || ocupado) return;
    setOcupado(true);
    setErro("");
    // Por convite a família já terminou o cadastro: não mexe no passo salvo dela.
    const ok = p.convite || (await cuidado.salvarCadastro({ onboardingStep: 8 }));
    setOcupado(false);
    if (!ok) {
      setErro(cuidado.erro() || "Não foi possível salvar. Tente de novo.");
      return;
    }
    progresso.esquecerAcesso();
    progresso.avancar();
  };

  return (
    <form id={FORM_PASSO} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo="Guarde o acesso da família"
        apoio="Estes códigos aparecem só agora. Sem o código de recuperação não dá para voltar à conta se a senha for esquecida."
      />
      <div className="cad-nota is-aviso">
        <AlertTriangle size={18} aria-hidden="true" />
        <p>Anote em papel ou salve no gerenciador de senhas. Não mande por mensagem.</p>
      </div>

      {acesso ? (
        <>
          <Codigo
            titulo="Código de recuperação da conta"
            valor={acesso.recoveryCode}
            ajuda="Use em “Esqueci a senha” na tela de entrada."
            longo={acesso.recoveryCode.length > 24}
          />
          {acesso.deviceKey ? (
            <Codigo
              titulo="Chave dos equipamentos"
              valor={acesso.deviceKey}
              ajuda="Vai na bengala, na câmera e no robô. Dá para gerar outra em Configurações."
              longo
            />
          ) : (
            <p className="texto-pequeno">
              A chave dos equipamentos fica com quem cadastrou a família. Peça a
              ela se for configurar um aparelho.
            </p>
          )}
          <div className="cad-identificadores">
            <div>
              <span>Bengala</span>
              <strong>{acesso.deviceId}</strong>
            </div>
            <div>
              <span>Robô</span>
              <strong>{acesso.robotId}</strong>
            </div>
          </div>
          <button type="button" className="btn btn-secundario cad-baixar" onClick={() => window.print()}>
            <Download size={18} aria-hidden="true" />
            Baixar em PDF para imprimir
          </button>
          <CaixaSelecao
            marcada={guardei}
            onMudar={setGuardei}
            titulo="Guardei os códigos em um lugar seguro"
          />
          <FolhaImpressao acesso={acesso} email={p.email} pessoa={prefs.personName} />
        </>
      ) : (
        <div className="cad-gerar">
          <KeyRound size={20} aria-hidden="true" />
          <div>
            <p>
              Os códigos aparecem uma vez só e não estão mais nesta aba. Gere
              outros: os anteriores deixam de valer.
            </p>
            <button
              type="button"
              className="btn btn-secundario"
              disabled={ocupado}
              onClick={() => void gerarNovos()}
            >
              {ocupado ? "Gerando…" : "Gerar novos códigos"}
            </button>
          </div>
        </div>
      )}
      {erro && (
        <p className="campo-erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
};
