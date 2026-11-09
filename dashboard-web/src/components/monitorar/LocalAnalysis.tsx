import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiJson } from "../../services/auth";
type Report = { id: number; state: string; summary: string; createdAt: string };
export function LocalAnalysis({ deviceId }: { deviceId: string }) {
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiJson<Report[]>(`/care/${deviceId}/reports`)
      .then((r) => {
        if (active) setReport(r[0] ?? null);
      })
      .catch(() => {
        if (active) setError("Não foi possível consultar a análise local.");
      });
    return () => {
      active = false;
    };
  }, [deviceId]);
  return (
    <section className="painel workspace-card">
      <div className="workspace-card-heading">
        <div>
          <span className="workspace-eyebrow">
            <Sparkles size={15} /> ANÁLISE LOCAL · OLLAMA
          </span>
          <h2>Resumo para a família</h2>
        </div>
        <button
          className="btn btn-secundario"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await apiJson<Report>(`/care/${deviceId}/analyze`, {
                method: "POST",
              });
              setReport(r);
            } catch {
              setError(
                "Não foi possível atualizar o resumo. As leituras e os alertas continuam independentes da IA.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Analisando…" : "Atualizar resumo"}
        </button>
      </div>
      {error && (
        <p className="nota is-aviso" role="status">
          {error}
        </p>
      )}
      {report ? (
        <>
          <span
            className={`selo ${report.state === "AVAILABLE" ? "is-sucesso" : "is-neutro"}`}
          >
            {report.state === "AVAILABLE"
              ? "Resumo disponível"
              : "IA indisponível"}
          </span>
          <p style={{ whiteSpace: "pre-wrap" }}>{report.summary}</p>
          <p className="texto-pequeno">
            Gerado em {new Date(report.createdAt).toLocaleString("pt-BR")}
          </p>
        </>
      ) : (
        <p>
          Quando houver leituras, a IA local poderá organizar os acontecimentos.
          Ainda não há resumo para esta família.
        </p>
      )}
      <p className="texto-pequeno">
        O resumo usa o histórico recebido. A confirmação e o atendimento
        continuam com a família.
      </p>
    </section>
  );
}
