import React, { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { Bot, Home, LayoutPanelLeft } from "lucide-react";
import { useCuidado, type ModeloPlanta, type OrigemPlanta } from "../../lib/cuidado";
import { EASE_MOTION } from "../../motion/tokens";
import { primeiroNome } from "./regras";
import {
  ErroSalvar,
  FORM_PASSO,
  Opcao,
  Segmento,
  TituloPasso,
  useRodape,
  useSalvarPasso,
} from "./ui";

/**
 * Prévia do mapeamento (Figma 44:3822): as paredes já vistas se desenham (1,2 s), o alcance do
 * LiDAR pulsa em volta do robô e o rótulo conta até 62%. Com movimento reduzido fica o quadro final.
 */
const PreviaMapeamento: React.FC = () => {
  const reduzido = useReducedMotion();
  const [pct, setPct] = useState(reduzido ? 62 : 0);
  useEffect(() => {
    if (reduzido) return;
    const c = animate(0, 62, { duration: 1.2, ease: EASE_MOTION, onUpdate: (x) => setPct(Math.round(x)) });
    return () => c.stop();
  }, [reduzido]);
  const desenha = (atraso: number) =>
    reduzido
      ? {}
      : {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 1.2, ease: EASE_MOTION, delay: atraso },
        };
  return (
    <div className="cad-previa" aria-hidden="true">
      <svg viewBox="0 0 520 170" preserveAspectRatio="xMidYMid meet" className="cad-previa-svg">
        {/* ainda não mapeado (tracejado) */}
        <path className="cad-previa-pendente" d="M20 140 H160 M20 10 H330 M100 60 V140 M240 10 V140" />
        {/* paredes mapeadas */}
        <motion.path className="cad-previa-parede" d="M20 140 V10 H190 M190 10 V60 M190 100 V140 H120" {...desenha(0)} />
        <motion.path className="cad-previa-parede" d="M190 10 H330 V60" {...desenha(0.3)} />
        <circle className="cad-previa-alcance" cx="290" cy="85" r="60" />
        {!reduzido && <circle className="cad-previa-onda" cx="290" cy="85" r="60" />}
        <rect className="cad-previa-robo" x="275" y="70" width="30" height="30" rx="9" />
        <Bot x="282" y="77" width="16" height="16" className="cad-previa-robo-icone" />
      </svg>
      <span className="cad-previa-rotulo">Mapeando · {pct}%</span>
    </div>
  );
};

/** Passo 5 · Planta da casa (Figma 44:3655 / 44:3888). */
export const PassoPlanta: React.FC = () => {
  const prefs = useCuidado();
  const [origem, setOrigem] = useState<OrigemPlanta | null>(prefs.floorPlanSource ?? "ROBOT");
  const [modelo, setModelo] = useState<ModeloPlanta>(
    prefs.floorPlanTemplate ?? { kind: "HOUSE", bedrooms: 2, bathrooms: 1 },
  );
  const s = useSalvarPasso();
  const nome = primeiroNome(prefs.personName ?? "", "a pessoa");

  useRodape({
    rotulo: s.ocupado ? "Salvando…" : "Continuar",
    ocupado: s.ocupado,
    desabilitado: !origem,
    dica: origem ? undefined : "Escolha uma opção",
  });

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origem) return;
    await s.salvar({
      floorPlanSource: origem,
      floorPlanTemplate: origem === "TEMPLATE" ? modelo : undefined,
    });
  };

  const escolher = (x: OrigemPlanta) => setOrigem(x);

  return (
    <form id={FORM_PASSO} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo="Como é a casa por dentro?"
        apoio={`A planta mostra em que cômodo ${nome} e o robô estão. Escolha como montá-la.`}
      />
      <fieldset className="cad-opcoes" disabled={s.ocupado}>
        <legend className="sr-only">Como montar a planta</legend>
        <Opcao
          nome="planta"
          valor="ROBOT"
          escolhido={origem}
          onEscolher={escolher}
          titulo="Mapear com o robô"
          selo="Recomendado"
          descricao="O robô percorre a casa e desenha a planta real com o LiDAR."
          icone={<Bot size={22} />}
        >
          <PreviaMapeamento />
          <p className="texto-pequeno">
            O mapeamento começa quando o robô for conectado, no último passo. Ele anda uns 5 minutos
            e depois você dá nome a cada cômodo.
          </p>
        </Opcao>
        <Opcao
          nome="planta"
          valor="TEMPLATE"
          escolhido={origem}
          onEscolher={escolher}
          titulo="Montar por um modelo"
          descricao="Casa térrea ou apartamento, quantos quartos e banheiros. Dá para ajustar depois."
          icone={<LayoutPanelLeft size={22} />}
        >
          <div className="cad-modelo">
            <div className="campo cad-campo">
              <span className="campo-rotulo">Tipo</span>
              <Segmento
                rotulo="Tipo de moradia"
                valor={modelo.kind}
                onMudar={(kind) => setModelo((m) => ({ ...m, kind }))}
                opcoes={[
                  { valor: "HOUSE", texto: "Casa térrea" },
                  { valor: "APARTMENT", texto: "Apartamento" },
                ]}
              />
            </div>
            <div className="cad-linha">
              <div className="campo cad-campo">
                <span className="campo-rotulo">Quartos</span>
                <Segmento
                  rotulo="Quartos"
                  valor={String(modelo.bedrooms) as "1" | "2" | "3" | "4"}
                  onMudar={(x) => setModelo((m) => ({ ...m, bedrooms: Number(x) }))}
                  opcoes={(["1", "2", "3", "4"] as const).map((n) => ({ valor: n, texto: n }))}
                />
              </div>
              <div className="campo cad-campo">
                <span className="campo-rotulo">Banheiros</span>
                <Segmento
                  rotulo="Banheiros"
                  valor={String(modelo.bathrooms) as "1" | "2" | "3"}
                  onMudar={(x) => setModelo((m) => ({ ...m, bathrooms: Number(x) }))}
                  opcoes={(["1", "2", "3"] as const).map((n) => ({ valor: n, texto: n }))}
                />
              </div>
            </div>
          </div>
        </Opcao>
        <Opcao
          nome="planta"
          valor="EXAMPLE"
          escolhido={origem}
          onEscolher={escolher}
          titulo="Usar o exemplo por enquanto"
          descricao="Uma casa de 5 cômodos. Troque quando quiser em Configurações."
          icone={<Home size={22} />}
        />
      </fieldset>
      <ErroSalvar erro={s.erro} />
    </form>
  );
};
