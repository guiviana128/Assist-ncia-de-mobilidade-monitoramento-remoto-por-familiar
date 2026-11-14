import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Phone, Plus, ShieldCheck, X } from "lucide-react";
import { useCuidado } from "../../lib/cuidado";
import { DUR, EASE_MOTION, saida } from "../../motion/tokens";
import {
  discagem,
  formatarTelefone,
  MAX_MORADORES,
  primeiroNome,
  validarMorador,
  validarPessoa,
  type Erros,
  type Morador,
} from "./regras";
import {
  Campo,
  ErroSalvar,
  useIdForm,
  Nota,
  Segmento,
  TituloPasso,
  useRodape,
  useSalvarPasso,
  useValidacao,
} from "./ui";

/**
 * Morador novo entra abrindo espaço (altura + fade, 300 ms); ao remover, fecha em 210 ms.
 * Com movimento reduzido o MotionConfig do app deixa só a opacidade.
 */
const LINHA = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: "auto",
    transition: { duration: DUR.media, ease: EASE_MOTION },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: saida(DUR.media), ease: EASE_MOTION },
  },
};

/** Passo 2 · Quem você acompanha (Figma 43:3592 / 43:3739). */
export const PassoPessoa: React.FC = () => {
  const idForm = useIdForm();
  const prefs = useCuidado();
  const [genero, setGenero] = useState<"MALE" | "FEMALE">(prefs.personGender ?? "MALE");
  const [nome, setNome] = useState(prefs.personName ?? "");
  const [telefone, setTelefone] = useState(
    prefs.personPhone ? formatarTelefone(prefs.personPhone) : "",
  );
  const [moraSozinho, setMoraSozinho] = useState<boolean | null>(
    typeof prefs.livesAlone === "boolean" ? prefs.livesAlone : null,
  );
  const [moradores, setMoradores] = useState<(Morador & { chave: number })[]>(() =>
    (prefs.residents ?? []).map((m, i) => ({ ...m, chave: i })),
  );
  const [novo, setNovo] = useState<Morador>({ name: "", relation: "" });
  const [errosNovo, setErrosNovo] = useState<Erros>({});
  const [tremorNovo, setTremorNovo] = useState(0);
  const s = useSalvarPasso();
  const v = useValidacao(() => validarPessoa({ nome, telefone, moraSozinho, moradores }));
  const ele = primeiroNome(nome, "ele");

  useRodape({ rotulo: s.ocupado ? "Salvando…" : "Continuar", ocupado: s.ocupado });

  const adicionar = () => {
    const e = validarMorador(novo, moradores.length);
    setErrosNovo(e);
    if (Object.keys(e).length) {
      setTremorNovo((n) => n + 1);
      return;
    }
    setMoradores((m) => [
      ...m,
      { name: novo.name.trim(), relation: novo.relation.trim(), chave: Date.now() },
    ]);
    setNovo({ name: "", relation: "" });
    v.editar("moradorNome");
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    // Nome digitado mas não adicionado: entra na lista em vez de se perder.
    let lista = moradores;
    if (moraSozinho === false && novo.name.trim()) {
      const erroNovo = validarMorador(novo, moradores.length);
      if (!Object.keys(erroNovo).length) {
        lista = [...moradores, { ...novo, name: novo.name.trim(), relation: novo.relation.trim(), chave: Date.now() }];
        setMoradores(lista);
        setNovo({ name: "", relation: "" });
      }
    }
    if (Object.keys(validarPessoa({ nome, telefone, moraSozinho, moradores: lista })).length) {
      v.tentar();
      return;
    }
    await s.salvar({
      personName: nome.trim(),
      personGender: genero,
      personPhone: telefone.trim(),
      telefonePessoa: discagem(telefone),
      livesAlone: moraSozinho!,
      residents: moraSozinho ? [] : lista.map(({ name, relation }) => ({ name, relation })),
    });
  };

  const erroMorador = errosNovo.moradorNome ?? v.erros.moradorNome;

  return (
    <form id={idForm} ref={v.form} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo="Quem você vai acompanhar?"
        apoio="Esses dados aparecem nos botões de ligação e ajudam a decidir quem avisar primeiro."
      />
      <fieldset className="cad-fieldset" disabled={s.ocupado}>
        <Campo rotulo="Gênero da pessoa acompanhada">
          {(a) => <select {...a} className="campo-entrada" value={genero} onChange={e => setGenero(e.target.value as "MALE" | "FEMALE")}>
            <option value="MALE">Homem · idoso</option>
            <option value="FEMALE">Mulher · idosa</option>
          </select>}
        </Campo>
        <Campo rotulo="Nome" erro={v.erros.nome} tremor={v.tremor}>
          {(a) => (
            <input
              {...a}
              className="campo-entrada"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                v.editar("nome");
              }}
              onBlur={v.sair("nome")}
              autoComplete="off"
              maxLength={100}
            />
          )}
        </Campo>
        <Campo
          rotulo={`Telefone d${nome.trim() ? "e " + ele : "ele"}`}
          erro={v.erros.telefone}
          tremor={v.tremor}
          icone={<Phone size={18} aria-hidden="true" />}
          ajuda={`Usado no botão “Ligar para ${ele}”.`}
        >
          {(a) => (
            <input
              {...a}
              type="tel"
              inputMode="tel"
              className="campo-entrada"
              value={telefone}
              placeholder="(11) 98123-4567"
              onChange={(e) => {
                setTelefone(formatarTelefone(e.target.value));
                v.editar("telefone");
              }}
              onBlur={v.sair("telefone")}
              autoComplete="off"
              maxLength={16}
            />
          )}
        </Campo>
        <Campo rotulo={`${nome.trim() ? ele : "Ele"} mora sozinho?`} erro={v.erros.moraSozinho} tremor={v.tremor} livre>
          {(a) => (
            <Segmento
              rotulo={`${ele} mora sozinho?`}
              props={a}
              valor={moraSozinho === null ? null : moraSozinho ? "sim" : "nao"}
              onMudar={(x) => {
                setMoraSozinho(x === "sim");
                v.editar("moraSozinho");
                v.editar("moradorNome");
              }}
              opcoes={[
                { valor: "sim", texto: "Sim" },
                { valor: "nao", texto: "Não, mora com alguém" },
              ]}
            />
          )}
        </Campo>

        <AnimatePresence initial={false}>
          {moraSozinho === false && (
            <motion.div key="moradores" className="cad-colapso" {...LINHA}>
              <div className="cad-moradores">
                <p className="cad-moradores-titulo">Quem mora com {ele}</p>
                <ul className="cad-moradores-lista" aria-label="Moradores">
                  <AnimatePresence initial={false}>
                    {moradores.map((m) => (
                      <motion.li key={m.chave} className="cad-colapso" {...LINHA}>
                        <div className="cad-morador">
                          <span className="cad-morador-avatar" aria-hidden="true">
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="cad-item-textos">
                            <strong>{m.name}</strong>
                            {m.relation && <span>{m.relation}</span>}
                          </span>
                          <button
                            type="button"
                            className="btn-icone cad-remover"
                            aria-label={`Remover ${m.name}`}
                            onClick={() => setMoradores((l) => l.filter((x) => x.chave !== m.chave))}
                          >
                            <X size={18} aria-hidden="true" />
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                {moradores.length < MAX_MORADORES && (
                  <>
                    <div className="cad-linha is-larga-estreita">
                      <Campo rotulo="Nome" erro={erroMorador} tremor={tremorNovo || v.tremor}>
                        {(a) => (
                          <input
                            {...a}
                            className="campo-entrada"
                            value={novo.name}
                            placeholder="Ex.: Pedro"
                            onChange={(e) => {
                              setNovo((n) => ({ ...n, name: e.target.value }));
                              setErrosNovo({});
                              v.editar("moradorNome");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                adicionar();
                              }
                            }}
                            autoComplete="off"
                            maxLength={100}
                          />
                        )}
                      </Campo>
                      <Campo rotulo="Parentesco" erro={errosNovo.moradorRelacao} tremor={tremorNovo}>
                        {(a) => (
                          <input
                            {...a}
                            className="campo-entrada"
                            value={novo.relation}
                            placeholder="Ex.: neto"
                            onChange={(e) => {
                              setNovo((n) => ({ ...n, relation: e.target.value }));
                              setErrosNovo({});
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                adicionar();
                              }
                            }}
                            autoComplete="off"
                            maxLength={60}
                          />
                        )}
                      </Campo>
                    </div>
                    <button type="button" className="btn-link cad-adicionar" onClick={adicionar}>
                      <Plus size={18} aria-hidden="true" />
                      Adicionar morador
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </fieldset>
      <Nota icone={<ShieldCheck size={18} />}>
        Pedimos só nome e parentesco. Nenhum outro dado dos moradores é guardado.
      </Nota>
      <ErroSalvar erro={s.erro} />
    </form>
  );
};
