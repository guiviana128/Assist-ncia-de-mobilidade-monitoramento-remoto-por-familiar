import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { Search } from "lucide-react";
import { comCasa, useCuidado } from "../../lib/cuidado";
import { lookupCep, searchAddress } from "../../services/address";
import { formatarCep, validarEndereco, type Endereco } from "./regras";
import {
  CaixaSelecao,
  Campo,
  ErroSalvar,
  useIdForm,
  TituloPasso,
  useRodape,
  useSalvarPasso,
  useValidacao,
} from "./ui";

const CENTRO_SP = { lat: -23.55052, lng: -46.633308 };
type Ponto = { lat: number; lng: number };

/**
 * Pino da casa (Figma 43:4199): círculo escuro com o ícone de casa e um halo de acento.
 * Cada vez que o ponto muda por busca, o pino "cai" no lugar (CSS .cad-pino.is-caindo, 450 ms).
 */
const pino = (caindo: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    html: `<span class="cad-pino${caindo ? " is-caindo" : ""}"><span class="cad-pino-halo"></span><span class="cad-pino-casa"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span></span>`,
  });

/** Leva o mapa até o ponto novo (voo de 600 ms; sem animação com movimento reduzido). */
const Seguir: React.FC<{ ponto: Ponto | null; versao: number }> = ({ ponto, versao }) => {
  const map = useMap();
  useEffect(() => {
    if (!ponto || !versao) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([ponto.lat, ponto.lng], 17, { animate: !reduzido, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, map]);
  return null;
};

const Toque: React.FC<{ onPonto: (p: Ponto) => void }> = ({ onPonto }) => {
  useMapEvents({ click: (e) => onPonto({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
};

/** Passo 4 · Endereço (Figma 43:4066 / 43:4220). Reaproveita a busca de CEP e o mapa da configuração da casa. */
export const PassoEndereco: React.FC = () => {
  const idForm = useIdForm();
  const prefs = useCuidado();
  const casa = prefs.home;
  const [end, setEnd] = useState<Endereco>({
    cep: casa?.address.cep ?? "",
    street: casa?.address.street ?? "",
    number: casa?.address.number ?? "",
    complement: casa?.address.complement ?? "",
    district: casa?.address.district ?? "",
    city: casa?.address.city ?? "",
  });
  const [ponto, setPonto] = useState<Ponto | null>(casa ? { lat: casa.lat, lng: casa.lng } : null);
  const [confirmado, setConfirmado] = useState(!!casa?.confirmed);
  const [busca, setBusca] = useState<"" | "buscando">("");
  const [aviso, setAviso] = useState("");
  const [voo, setVoo] = useState(0);
  const s = useSalvarPasso();
  const v = useValidacao(() => validarEndereco(end, ponto, confirmado));
  const icone = useMemo(() => pino(voo > 0), [voo]);

  useRodape({ rotulo: s.ocupado ? "Salvando…" : "Continuar", ocupado: s.ocupado });

  const mudar = (campo: keyof Endereco, valor: string) => {
    setEnd((a) => ({ ...a, [campo]: valor }));
    v.editar(campo);
    // Endereço mudou: o pino precisa ser conferido de novo.
    if (campo !== "complement") setConfirmado(false);
  };

  const moverPino = (p: Ponto) => {
    setPonto(p);
    setConfirmado(false);
    v.editar("mapa");
    v.editar("confirmado");
  };

  // Só consulta ViaCEP e OpenStreetMap quando a pessoa toca em "Buscar" (nada enquanto digita).
  const buscar = async () => {
    setAviso("");
    if (formatarCep(end.cep).length !== 9) {
      v.falhar({ cep: "O CEP tem 8 números, ex.: 01310-100." });
      return;
    }
    setBusca("buscando");
    try {
      const r = await lookupCep(end.cep);
      const novo = { ...end, cep: formatarCep(r.cep), street: r.street, district: r.district, city: r.city };
      setEnd(novo);
      setConfirmado(false);
      try {
        const achados = await searchAddress(
          [novo.street, novo.number, novo.district, novo.city, "São Paulo", "Brasil"].filter(Boolean).join(", "),
        );
        if (achados[0]) {
          setPonto({ lat: achados[0].lat, lng: achados[0].lng });
          setVoo((n) => n + 1);
          v.editar("mapa");
        } else setAviso("Não achamos o ponto exato. Toque no mapa onde fica a casa.");
      } catch {
        setAviso("O mapa não respondeu. Toque no mapa onde fica a casa.");
      }
    } catch (erro) {
      v.falhar({ cep: erro instanceof Error ? erro.message : "Não foi possível consultar o CEP." });
    } finally {
      setBusca("");
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.tentar() || !ponto) return;
    await s.salvar((atual) =>
      comCasa(atual, {
        version: 1,
        address: {
          cep: formatarCep(end.cep),
          street: end.street.trim(),
          number: end.number.trim(),
          complement: end.complement.trim(),
          district: end.district.trim(),
          city: end.city.trim(),
          state: "SP",
        },
        lat: ponto.lat,
        lng: ponto.lng,
        radius: atual.home?.radius ?? 500,
        confirmed: true,
      }),
    );
  };

  const campo = (
    nome: keyof Endereco,
    rotulo: string,
    extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {},
    opcional = false,
    acao?: React.ReactNode,
  ) => (
    <Campo rotulo={rotulo} erro={v.erros[nome]} tremor={v.tremor} opcional={opcional} acao={acao}>
      {(a) => (
        <input
          {...a}
          className="campo-entrada"
          value={end[nome]}
          onChange={(e) => mudar(nome, e.target.value)}
          onBlur={v.sair(nome)}
          {...extra}
        />
      )}
    </Campo>
  );

  return (
    <form id={idForm} ref={v.form} className="cad-form" noValidate onSubmit={(e) => void enviar(e)}>
      <TituloPasso
        titulo="Onde fica a casa?"
        apoio="O endereço aparece para o SAMU e marca a área segura principal."
      />
      <fieldset className="cad-fieldset" disabled={s.ocupado}>
        <div className="cad-cep">
          <Campo rotulo="CEP" erro={v.erros.cep} tremor={v.tremor}>
            {(a) => (
              <input
                {...a}
                className="campo-entrada"
                value={end.cep}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                maxLength={9}
                onChange={(e) => mudar("cep", formatarCep(e.target.value))}
                onBlur={v.sair("cep")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void buscar();
                  }
                }}
              />
            )}
          </Campo>
          <button
            type="button"
            className="btn btn-secundario cad-buscar"
            disabled={busca === "buscando"}
            onClick={() => void buscar()}
          >
            {busca === "buscando" ? (
              <span className="carregando" aria-hidden="true" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            {busca === "buscando" ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {campo("street", "Rua", { autoComplete: "address-line1", maxLength: 100 })}
        <div className="cad-linha">
          {campo("number", "Número", { maxLength: 15, inputMode: "text" })}
          {campo("complement", "Complemento", { autoComplete: "address-line2", maxLength: 60, placeholder: "Apto 42" }, true)}
        </div>
        <div className="cad-linha">
          {campo("district", "Bairro", { maxLength: 60 })}
          {campo("city", "Cidade e UF", { autoComplete: "address-level2", maxLength: 60 }, false, (
            <span className="cad-sufixo" aria-label="Estado de São Paulo">SP</span>
          ))}
        </div>

        <div>
          <div className={`cad-mapa${v.erros.mapa ? " is-erro" : ""}`}>
            <MapContainer
              center={[ponto?.lat ?? CENTRO_SP.lat, ponto?.lng ?? CENTRO_SP.lng]}
              zoom={ponto ? 17 : 11}
              scrollWheelZoom={false}
              zoomControl={false}
              className="cad-mapa-leaflet"
            >
              <ZoomControl position="bottomright" />
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Seguir ponto={ponto} versao={voo} />
              <Toque onPonto={moverPino} />
              {ponto && (
                <Marker
                  key={voo}
                  position={[ponto.lat, ponto.lng]}
                  icon={icone}
                  draggable
                  keyboard
                  title="Casa. Arraste para ajustar."
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = (e.target as L.Marker).getLatLng();
                      moverPino({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                />
              )}
            </MapContainer>
            <span className="cad-mapa-dica" aria-hidden="true">
              {ponto ? "Arraste o pino se precisar" : "Toque no mapa onde fica a casa"}
            </span>
          </div>
          {(v.erros.mapa || aviso) && (
            <p className={v.erros.mapa ? "campo-erro" : "texto-pequeno"} role={v.erros.mapa ? undefined : "status"}>
              {v.erros.mapa || aviso}
            </p>
          )}
        </div>

        <CaixaSelecao
          marcada={confirmado}
          onMudar={(x) => {
            setConfirmado(x);
            v.editar("confirmado");
          }}
          titulo="O pino está na casa certa"
          erro={ponto ? v.erros.confirmado : undefined}
          tremor={v.tremor}
        />
        <p className="texto-pequeno">
          “Buscar” consulta o CEP no ViaCEP e o ponto no OpenStreetMap. Nada é enviado enquanto você digita.
        </p>
      </fieldset>
      <ErroSalvar erro={s.erro} />
    </form>
  );
};
