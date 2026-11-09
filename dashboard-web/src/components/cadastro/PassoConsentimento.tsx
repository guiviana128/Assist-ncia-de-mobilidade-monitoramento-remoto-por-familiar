import React, { useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, MapPin, Users, Video } from "lucide-react";
import { useCuidado } from "../../lib/cuidado";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import { CadastroCtx } from "./Cadastro";
import { useProgresso } from "./progresso";
import { primeiroNome, TERMO_VERSAO, validarConsentimento } from "./regras";
import {
  CaixaSelecao,
  Campo,
  ErroSalvar,
  FORM_PASSO,
  Opcao,
  TituloPasso,
  useRodape,
  useSalvarPasso,
  useValidacao,
} from "./ui";

const ABRE = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: { duration: DUR.media, ease: EASE_MOTION } },
  exit: { opacity: 0, height: 0, transition: { duration: saida(DUR.media), ease: EASE_MOTION } },
};

/** Itens da lista "o que é acompanhado": entram um a um (60 ms entre eles). */
const ITEM = {
  initial: { opacity: 0, y: 8 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DUR.curta, ease: EASE_MOTION, delay: 0.08 + i * 0.06 },
  }),
};

/** Passo 3 · Consentimento (Figma 43:3817 / 43:3977). Também é aberto pelo painel quando falta o aceite. */
export const PassoConsentimento: React.FC = () => {
  const p = useProgresso();
  const prefs = useCuidado();
  const { concluir } = useContext(CadastroCtx);
  const atual = prefs.consent?.termsVersion === TERMO_VERSAO ? prefs.consent : null;
  const [quem, setQuem] = useState<"SELF" | "GUARDIAN" | null>(atual?.acceptedBy ?? "SELF");
  const [responsavel, setResponsavel] = useState(atual?.guardianName ?? "");
  const [concorda, setConcorda] = useState(!!atual);
  const [termo, setTermo] = useState(false);
  const s = useSalvarPasso();
  const v = useValidacao(() => validarConsentimento({ quem, responsavel, concorda }));
  const nome = primeiroNome(prefs.personName ?? "", "A pessoa acompanhada");
  const proprio = prefs.personName ? `O próprio ${nome}` : "A própria pessoa";

  useRodape({
    rotulo: s.ocupado ? "Salvando…" : "Aceitar e continuar",
    ocupado: s.ocupado,
    desabilitado: !concorda,
    dica: concorda ? undefined : "Marque o aceite para seguir",
  });

  const itens = [
    { Icone: MapPin, titulo: "Localização da bengala", texto: "Para mostrar onde ele está e avisar se sair das áreas seguras." },
    { Icone: Activity, titulo: "Sensores da bengala", texto: "Quedas, obstáculos, tremores e passos." },
    { Icone: Video, titulo: "Câmera só onde vocês escolherem", texto: "A imagem é analisada no aparelho e não é gravada sem pedido." },
    { Icone: Users, titulo: "Quem vê", texto: "Só as contas desta família. Nada é vendido ou compartilhado." },
  ];

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.tentar()) return;
    await s.salvar(
      {
        consent: {
          acceptedBy: quem!,
          ...(quem === "GUARDIAN" ? { guardianName: responsavel.trim() } : {}),
          termsVersion: TERMO_VERSAO,
        },
      },
      p.soConsentimento ? concluir : undefined,
    );
  };

  return (
    <form id={FORM_PASSO} ref={v.form} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo={`${nome} precisa concordar`}
        apoio="Leia com ele, ou para ele, o que o Amparo acompanha. Sem esse aceite o monitoramento não começa."
      />
      <ul className="cad-lista" aria-label="O que o Amparo acompanha">
        {itens.map(({ Icone, titulo, texto }, i) => (
          <motion.li key={titulo} className="cad-item" custom={i} initial="initial" animate="animate" variants={ITEM}>
            <span className="cad-item-icone" aria-hidden="true">
              <Icone size={20} />
            </span>
            <span className="cad-item-textos">
              <strong>{titulo}</strong>
              <span>{texto}</span>
            </span>
          </motion.li>
        ))}
      </ul>

      <fieldset className="cad-opcoes" disabled={s.ocupado}>
        <legend className="campo-rotulo">Quem está aceitando?</legend>
        <Opcao
          nome="quem-aceita"
          valor="SELF"
          escolhido={quem}
          onEscolher={(x) => {
            setQuem(x);
            v.editar("quem");
          }}
          titulo={proprio}
          descricao="Ele entendeu e concorda."
        />
        <Opcao
          nome="quem-aceita"
          valor="GUARDIAN"
          escolhido={quem}
          onEscolher={(x) => {
            setQuem(x);
            v.editar("quem");
          }}
          titulo="Um responsável legal"
          descricao="Quando ele não consegue decidir sozinho. Pediremos o nome do responsável."
        >
          <Campo rotulo="Nome do responsável legal" erro={v.erros.responsavel} tremor={v.tremor}>
            {(a) => (
              <input
                {...a}
                className="campo-entrada"
                value={responsavel}
                onChange={(e) => {
                  setResponsavel(e.target.value);
                  v.editar("responsavel");
                }}
                onBlur={v.sair("responsavel")}
                autoComplete="off"
                maxLength={100}
              />
            )}
          </Campo>
        </Opcao>
      </fieldset>

      <CaixaSelecao
        marcada={concorda}
        onMudar={(x) => {
          setConcorda(x);
          v.editar("concorda");
        }}
        titulo={
          quem === "GUARDIAN"
            ? "Como responsável legal, li e concordo com o monitoramento"
            : `${prefs.personName ? nome : "Ele"} leu, ou ouviu, e concorda com o monitoramento`
        }
        detalhe="Ele pode pedir para pausar ou apagar os dados a qualquer momento."
        erro={v.erros.concorda}
        tremor={v.tremor}
      />

      <button
        type="button"
        className="btn-link cad-ler-termo"
        aria-expanded={termo}
        aria-controls="cad-termo"
        onClick={() => setTermo((t) => !t)}
      >
        {termo ? "Fechar o termo" : "Ler o termo completo"}
      </button>
      <AnimatePresence initial={false}>
        {termo && (
          <motion.section key="termo" id="cad-termo" className="cad-colapso" aria-label="Termo de consentimento" {...ABRE}>
            <div className="cad-termo">
              <h2>Termo de consentimento · versão {TERMO_VERSAO}</h2>
              <p>
                O Amparo ajuda a família a acompanhar {nome} em casa e na rua. Com este aceite, a
                bengala envia localização, quedas, obstáculos, tremores e passos; o robô assistente
                informa o cômodo em que está; e a câmera, só nos cômodos que vocês liberarem,
                procura o gesto de pedido de ajuda.
              </p>
              <p>
                A imagem da câmera é analisada no próprio aparelho. Nada é gravado sem um pedido
                de vocês, e o banheiro nunca é filmado.
              </p>
              <p>
                Os dados ficam guardados para esta família e só as contas dela os veem. Nada é
                vendido ou compartilhado. Em uma emergência, os contatos cadastrados e o SAMU
                podem receber o endereço da casa.
              </p>
              <p>
                {nome} ou o responsável legal pode pedir a qualquer momento para pausar o
                monitoramento, corrigir ou apagar os dados, em Configurações. O aceite fica
                registrado com a data e a conta de quem o registrou.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <ErroSalvar erro={s.erro} />
    </form>
  );
};
