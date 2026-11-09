import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { Lock, Mail, Ticket, Users, WifiOff } from "lucide-react";
import { ApiError, auth } from "../../services/auth";
import { DUR, EASE_MOTION } from "../../motion/tokens";
import { progresso, useProgresso } from "./progresso";
import { forcaSenha, validarConta } from "./regras";
import {
  CaixaSelecao,
  Campo,
  useIdForm,
  Nota,
  TituloPasso,
  useRodape,
  useValidacao,
} from "./ui";

const COR_FORCA = ["", "is-fraca", "is-media", "is-boa", "is-boa"];

/** Barra de força em 4 segmentos: ao subir de nível, os segmentos acendem um a um (150 ms cada). */
const BarraForca: React.FC<{ senha: string }> = ({ senha }) => {
  const { nivel, rotulo } = forcaSenha(senha);
  const anterior = useRef(nivel);
  const subiu = nivel > anterior.current ? anterior.current : nivel;
  anterior.current = nivel;
  return (
    <>
      <div className={`cad-forca ${COR_FORCA[nivel]}`} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="cad-forca-segmento">
            <motion.span
              className="cad-forca-cheio"
              initial={false}
              animate={{ scaleX: i < nivel ? 1 : 0, opacity: i < nivel ? 1 : 0 }}
              transition={{
                duration: DUR.rapida,
                ease: EASE_MOTION,
                delay: i < nivel && i >= subiu ? (i - subiu) * DUR.rapida : 0,
              }}
            />
          </span>
        ))}
      </div>
      <p className="texto-pequeno" aria-live="polite">
        {senha
          ? `${rotulo} · ${senha.length} ${senha.length === 1 ? "caractere" : "caracteres"}. Use pelo menos 12.`
          : "Use pelo menos 12 caracteres."}
      </p>
    </>
  );
};

/** Passo 1 · Sua conta (Figma 43:3393 / 43:3526). A conta é criada aqui. */
export const PassoConta: React.FC = () => {
  const idForm = useIdForm();
  const p = useProgresso();
  const [convite, setConvite] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [geral, setGeral] = useState("");
  const v = useValidacao(() =>
    validarConta({ nome, email, senha, convite, porConvite: p.convite }),
  );

  useRodape({
    rotulo: ocupado ? "Criando a conta…" : "Continuar",
    ocupado,
    semVoltar: true,
  });

  // Já criou a conta e voltou até aqui: nada para editar.
  if (p.email) {
    return (
      <form
        id={idForm}
        className="cad-form"
        onSubmit={(e) => {
          e.preventDefault();
          progresso.avancar();
        }}
      >
        <TituloPasso
          titulo="Conta criada"
          apoio={`Você entrou como ${p.email}. Nome, e-mail e senha podem ser trocados depois em Configurações.`}
        />
      </form>
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeral("");
    if (ocupado || !v.tentar()) return;
    setOcupado(true);
    try {
      const r = await auth.register(
        nome.trim(),
        email.trim(),
        senha,
        "",
        p.convite ? convite.trim() : "",
        lembrar,
      );
      progresso.registrar(r.username ?? email.trim().toLowerCase(), {
        recoveryCode: r.recoveryCode,
        deviceKey: r.deviceKey,
        deviceId: r.deviceId,
        robotId: r.robotId,
      });
    } catch (erro) {
      if (!(erro instanceof ApiError) || erro.offline) {
        setGeral("O servidor do Amparo não respondeu. Confira a conexão e tente de novo.");
      } else if (erro.status === 409) {
        v.falhar({ email: "Já existe uma conta com este e-mail. Volte e use “Entrar”." });
      } else if (erro.status === 429) {
        setGeral("Muitas tentativas a partir desta rede. Aguarde 5 minutos.");
      } else if (p.convite && /convite/i.test(erro.message)) {
        v.falhar({ convite: "Convite inválido ou expirado. Peça um novo ao familiar." });
      } else {
        setGeral(erro.message || "Não foi possível criar a conta.");
      }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form id={idForm} ref={v.form} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo={p.convite ? "Entre na família" : "Crie a conta da família"}
        apoio={
          p.convite
            ? "Use o código que o familiar enviou. Você vai ver a mesma casa e os mesmos avisos."
            : "Você vai acompanhar alguém pelo Amparo. Comece pelo seu acesso."
        }
      />
      <fieldset className="cad-fieldset" disabled={ocupado}>
        {p.convite && (
          <Campo
            rotulo="Código do convite"
            erro={v.erros.convite}
            tremor={v.tremor}
            icone={<Ticket size={18} aria-hidden="true" />}
            ajuda="Vale por 24 horas e só uma vez."
          >
            {(a) => (
              <input
                {...a}
                className="campo-entrada"
                value={convite}
                onChange={(e) => {
                  setConvite(e.target.value);
                  v.editar("convite");
                }}
                onBlur={v.sair("convite")}
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
              />
            )}
          </Campo>
        )}
        <Campo rotulo="Seu nome" erro={v.erros.nome} tremor={v.tremor}>
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
              autoComplete="name"
              maxLength={100}
            />
          )}
        </Campo>
        <Campo
          rotulo="E-mail"
          erro={v.erros.email}
          tremor={v.tremor}
          icone={<Mail size={18} aria-hidden="true" />}
        >
          {(a) => (
            <input
              {...a}
              type="email"
              className="campo-entrada"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                v.editar("email");
              }}
              onBlur={v.sair("email")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={120}
            />
          )}
        </Campo>
        <Campo
          rotulo="Senha"
          erro={v.erros.senha}
          tremor={v.tremor}
          icone={<Lock size={18} aria-hidden="true" />}
          acao={
            <button
              type="button"
              className="campo-acao"
              aria-pressed={mostrar}
              onClick={() => setMostrar((m) => !m)}
            >
              {mostrar ? "Ocultar" : "Mostrar"}
            </button>
          }
          depois={<BarraForca senha={senha} />}
        >
          {(a) => (
            <input
              {...a}
              type={mostrar ? "text" : "password"}
              className="campo-entrada"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                v.editar("senha");
              }}
              onBlur={v.sair("senha")}
              autoComplete="new-password"
              maxLength={120}
            />
          )}
        </Campo>
        <CaixaSelecao
          marcada={lembrar}
          onMudar={setLembrar}
          titulo="Manter conectado neste aparelho"
        />
      </fieldset>
      {geral && (
        <div className="cad-nota is-perigo" role="alert">
          <WifiOff size={18} aria-hidden="true" />
          <p>{geral}</p>
        </div>
      )}
      {!p.convite && (
        <Nota icone={<Users size={18} />} tom="acento">
          Recebeu um convite de outro familiar? Volte e use “Recebi um convite”
          para entrar na mesma família, sem criar outra.
        </Nota>
      )}
    </form>
  );
};
