import React from "react";
import { progresso } from "./progresso";
import { PASSOS } from "./regras";
import { FORM_PASSO, TituloPasso, useRodape } from "./ui";

/** Provisório (fase 2): substituído pelo passo completo. */
export const PassoComecar: React.FC = () => {
  useRodape({ rotulo: "Continuar" });
  return (
    <form id={FORM_PASSO} className="cad-form" onSubmit={(e) => { e.preventDefault(); progresso.avancar(); }}>
      <TituloPasso titulo={PASSOS[8 - 1]!.titulo} apoio="Em construção." />
    </form>
  );
};
