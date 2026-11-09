import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, Phone, Video, VideoOff } from "lucide-react";
import {
  BOMBEIROS,
  CONTATOS_PUBLICOS,
  plantaDaFamilia,
  SAMU,
  useCuidado,
  type Contato,
} from "../../lib/cuidado";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import {
  CAMERA_PADRAO,
  discagem,
  ehBanheiro,
  formatarTelefone,
  ID_PRIMEIRO_CONTATO,
  primeiroNome,
  validarContato,
} from "./regras";
import {
  Campo,
  ErroSalvar,
  useIdForm,
  Interruptor,
  TituloPasso,
  useRodape,
  useSalvarPasso,
  useValidacao,
} from "./ui";

type Comodo = { id: string; nome: string };

/** Banheiros por último, como no Figma: são os que nunca são filmados. */
const ordenar = (lista: Comodo[]) =>
  [...lista].sort((a, b) => Number(ehBanheiro(a.id)) - Number(ehBanheiro(b.id)));

/** Ícone do cômodo: câmera ⇄ câmera desligada com crossfade (150 ms) e o fundo mudando de cor. */
const IconeCamera: React.FC<{ ligada: boolean }> = ({ ligada }) => (
  <span className={`cad-item-icone${ligada ? " is-acento" : ""}`} aria-hidden="true">
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={ligada ? "on" : "off"}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: DUR.rapida, ease: EASE_MOTION } }}
        exit={{ opacity: 0, scale: 0.8, transition: { duration: saida(DUR.rapida) } }}
        style={{ display: "grid" }}
      >
        {ligada ? <Video size={20} /> : <VideoOff size={20} />}
      </motion.span>
    </AnimatePresence>
  </span>
);

/** Passo 6 · Avisos e câmera (Figma 44:4032 / 44:4311). */
export const PassoAvisos: React.FC = () => {
  const idForm = useIdForm();
  const prefs = useCuidado();
  const familia = prefs.contatos.filter((c) => !CONTATOS_PUBLICOS.has(c.id));
  const primeiro = familia[0];
  const [nome, setNome] = useState(primeiro?.nome ?? "");
  const [parentesco, setParentesco] = useState(primeiro?.papel.split(" · ")[0] ?? "");
  const [telefone, setTelefone] = useState(primeiro ? formatarTelefone(primeiro.telefone) : "");
  const [avisos, setAvisos] = useState(primeiro?.avisos ?? true);
  // Cômodos da planta escolhida no passo 5 (modelo ou exemplo).
  const comodos = useMemo(
    () => ordenar(plantaDaFamilia(prefs).rooms.map((r) => ({ id: r.id, nome: r.name }))),
    [prefs],
  );
  const [camera, setCamera] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((prefs.cameraRooms ?? []).map((c) => [c.room, c.allowed])),
  );
  const s = useSalvarPasso();
  const v = useValidacao(() => validarContato({ nome, parentesco, telefone }));
  const pessoa = primeiroNome(prefs.personName ?? "", "ele");

  useRodape({ rotulo: s.ocupado ? "Salvando…" : "Continuar", ocupado: s.ocupado });

  const pode = (id: string) => !ehBanheiro(id) && (camera[id] ?? CAMERA_PADRAO.has(id));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.tentar()) return;
    const contato: Contato = {
      id: primeiro?.id ?? ID_PRIMEIRO_CONTATO,
      nome: nome.trim(),
      papel: parentesco.trim() || "Contato da família",
      telefone: telefone.trim(),
      discagem: discagem(telefone),
      avisos,
    };
    await s.salvar((atual) => ({
      contatos: [
        contato,
        ...atual.contatos.filter((c) => c.id !== contato.id && !CONTATOS_PUBLICOS.has(c.id)),
        SAMU,
        BOMBEIROS,
      ],
      cameraRooms: comodos.map((c) => ({ room: c.id, allowed: pode(c.id) })),
    }));
  };

  return (
    <form id={idForm} ref={v.form} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo="Quem avisar e onde a câmera pode ver"
        apoio="SAMU 192 e Bombeiros 193 já vêm incluídos. Falta alguém da família."
      />
      <fieldset className="cad-fieldset" disabled={s.ocupado}>
        <div className="cad-secao">
          <h2>Primeiro contato de emergência</h2>
          <p>É a primeira pessoa avisada numa queda ou pedido de ajuda.</p>
        </div>
        <Campo rotulo="Nome" erro={v.erros.contatoNome} tremor={v.tremor}>
          {(a) => (
            <input
              {...a}
              className="campo-entrada"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                v.editar("contatoNome");
              }}
              onBlur={v.sair("contatoNome")}
              autoComplete="off"
              maxLength={100}
            />
          )}
        </Campo>
        <div className="cad-linha is-larga">
          <Campo rotulo="Parentesco" erro={v.erros.contatoParentesco} tremor={v.tremor} opcional>
            {(a) => (
              <input
                {...a}
                className="campo-entrada"
                value={parentesco}
                placeholder="Ex.: filha"
                onChange={(e) => {
                  setParentesco(e.target.value);
                  v.editar("contatoParentesco");
                }}
                onBlur={v.sair("contatoParentesco")}
                autoComplete="off"
                maxLength={60}
              />
            )}
          </Campo>
          <Campo
            rotulo="Telefone"
            erro={v.erros.contatoTelefone}
            tremor={v.tremor}
            icone={<Phone size={18} aria-hidden="true" />}
          >
            {(a) => (
              <input
                {...a}
                type="tel"
                inputMode="tel"
                className="campo-entrada"
                value={telefone}
                placeholder="(11) 98765-4321"
                onChange={(e) => {
                  setTelefone(formatarTelefone(e.target.value));
                  v.editar("contatoTelefone");
                }}
                onBlur={v.sair("contatoTelefone")}
                autoComplete="off"
                maxLength={16}
              />
            )}
          </Campo>
        </div>
        <div className="cad-preferencia">
          <span className="cad-item-textos">
            <strong id="cad-avisos-rotulo">Receber avisos no celular</strong>
            <span>Mais contatos podem ser adicionados depois</span>
          </span>
          <Interruptor ligado={avisos} onMudar={setAvisos} rotulo="Receber avisos no celular" />
        </div>

        <hr className="cad-divisor" />

        <div className="cad-secao">
          <h2>Câmera e privacidade</h2>
          <p>
            Escolha onde a câmera pode reconhecer o gesto de socorro. Os outros cômodos nunca são
            filmados.
          </p>
        </div>
        <ul className="cad-lista" aria-label="Cômodos que a câmera pode filmar">
          {comodos.map((c) => {
            const banheiro = ehBanheiro(c.id);
            const ligada = pode(c.id);
            return (
              <li key={c.id} className="cad-item">
                <IconeCamera ligada={ligada} />
                <span className="cad-item-textos">
                  <strong>{c.nome}</strong>
                  <AnimatePresence initial={false} mode="wait">
                    <motion.span
                      key={banheiro ? "b" : String(ligada)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: DUR.rapida } }}
                      exit={{ opacity: 0, transition: { duration: saida(DUR.rapida) } }}
                    >
                      {banheiro ? "Nunca é filmado" : ligada ? "Pode filmar" : "Não filma"}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {banheiro ? (
                  <span className="cad-bloqueado">
                    <Lock size={16} aria-hidden="true" />
                    Bloqueado
                  </span>
                ) : (
                  <Interruptor
                    ligado={ligada}
                    onMudar={(x) => setCamera((m) => ({ ...m, [c.id]: x }))}
                    rotulo={`Câmera pode filmar: ${c.nome}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="texto-pequeno">
          A imagem é analisada no aparelho. {pessoa === "ele" ? "A pessoa" : pessoa} pode pedir para
          desligar a câmera a qualquer momento.
        </p>
      </fieldset>
      <ErroSalvar erro={s.erro} />
    </form>
  );
};
