import React from "react";
import { progresso } from "./progresso";
import { PASSOS } from "./regras";
import { useIdForm, TituloPasso, useRodape } from "./ui";

/** Provisório (fase 2): substituído pelo passo completo. */
export const PassoComecar: React.FC = () => {
  const idForm = useIdForm();
  useRodape({ rotulo: "Continuar" });
  return (
    <form id={idForm} className="cad-form" onSubmit={(e) => { e.preventDefault(); progresso.avancar(); }}>
      <TituloPasso titulo={PASSOS[8 - 1]!.titulo} apoio="Em construção." />
    </form>
  );
};
