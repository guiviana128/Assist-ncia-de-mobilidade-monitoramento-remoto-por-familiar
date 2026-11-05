import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Activity, Info, MapPin, Phone, Pill, Plus, X } from 'lucide-react';
import { api } from '../../services/api';
import { cuidado, useCuidado, type PreferenciasBengala } from '../../lib/cuidado';
import { CELULAR, useMediaQuery } from '../../hooks/useMediaQuery';
import { gsap, movimentoReduzido, useGSAP } from '../../motion/gsap';
import { DUR, EASE_MOTION, saida } from '../../motion/tokens';

/** Check que se desenha (DrawSVG, 300 ms) ao aparecer; com movimento reduzido aparece pronto. */
const CheckDesenhado: React.FC = () => {
  const ref = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    if (movimentoReduzido()) return;
    gsap.fromTo('path', { drawSVG: '0%' }, { drawSVG: '100%', duration: DUR.media, delay: 0.1, ease: 'power2.out' });
  }, { scope: ref });
  return <svg ref={ref} className="check-desenhado" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>;
};

interface ConfiguracoesViewProps {
  deviceId: string;
  pessoa: string;
}

const SECOES = [
  { id: 'remedios', rotulo: 'Remédios', Icone: Pill },
  { id: 'contatos', rotulo: 'Contatos de emergência', Icone: Phone },
  { id: 'areas', rotulo: 'Áreas seguras', Icone: MapPin },
  { id: 'bengala', rotulo: 'Bengala', Icone: Activity }
] as const;

const COR_AREA = ['#0F172A', '#10B981', '#2563EB', '#F59E0B'];

const pontoArea = (cor: string) => L.divIcon({
  className: 'mapa-icone', html: `<span class="area-ponto" style="background:${cor}"></span>`, iconSize: [10, 10], iconAnchor: [5, 5]
});

function minutosAte(hora: string, agora = new Date()) {
  const [h, m] = hora.split(':').map(Number);
  return (h! * 60 + m!) - (agora.getHours() * 60 + agora.getMinutes());
}
const daquiA = (min: number) => min < 60 ? `daqui a ${min} min` : `daqui a ${Math.round(min / 60)} h`;

const Interruptor: React.FC<{ ligado: boolean; onAlternar: () => void; rotulo: string }> = ({ ligado, onAlternar, rotulo }) => (
  <button className="interruptor" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={onAlternar} />
);

/** Configurações do cuidado (Figma 29:1474 e 36:2655). Reaproveita o SettingsView antigo (lembretes via API). */
export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({ deviceId, pessoa }) => {
  const celular = useMediaQuery(CELULAR);
  const { remedios, contatos, areas, bengala } = useCuidado();
  const [secao, setSecao] = useState<string>('remedios');
  const [novo, setNovo] = useState<{ nome: string; hora: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Índice lateral: marca a seção visível
  useEffect(() => {
    const obs = new IntersectionObserver(entradas => {
      const visivel = entradas.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visivel) setSecao(visivel.target.id.replace('cfg-', ''));
    }, { rootMargin: '-120px 0px -55% 0px' });
    SECOES.forEach(s => { const el = document.getElementById(`cfg-${s.id}`); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const irPara = (id: string) => {
    setSecao(id);
    document.getElementById(`cfg-${id}`)?.scrollIntoView({ block: 'start' });
  };

  const salvarRemedio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novo) return;
    const nome = novo.nome.trim();
    if (!nome) { setMsg('Escreva o nome do remédio.'); return; }
    cuidado.adicionarRemedio({ nome, hora: novo.hora, detalhe: 'Todo dia' });
    // Mesmo comportamento do SettingsView antigo: agenda o lembrete na bengala (ou no modo demonstração)
    api.scheduleMedicineReminder(deviceId, `${nome} (${novo.hora})`).catch(console.error);
    setNovo(null);
    setMsg(`Lembrete de ${nome} às ${novo.hora} adicionado.`);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const bengalaPref = <K extends keyof PreferenciasBengala>(k: K, v: PreferenciasBengala[K]) => cuidado.definirBengala({ [k]: v } as Partial<PreferenciasBengala>);
  const proximoId = remedios.filter(r => r.ativo && minutosAte(r.hora) > 0).sort((a, b) => a.hora.localeCompare(b.hora))[0]?.id;
  const casa = areas[0]!;

  return (
    <div className="config">
      <section className="frase-estado">
        <div className="frase-estado-texto">
          <h1 className="frase">Configurações do cuidado.<span className="frase-apoio"> Tudo que vale para o {pessoa} e a bengala.</span></h1>
          <p className="frase-detalhe">{celular ? `Bengala ${deviceId}` : `As mudanças valem na hora para este painel · bengala ${deviceId}`}</p>
        </div>
      </section>

      <div className="config-grade">
        <nav className="config-indice" aria-label="Seções das configurações">
          <ul className={celular ? 'fila-rolavel' : ''}>
            {SECOES.map(({ id, rotulo, Icone }) => (
              <li key={id}>
                <button className={`${celular ? 'chip' : 'config-indice-item'}${secao === id ? ' is-ativo' : ''}`} aria-current={secao === id ? 'true' : undefined} onClick={() => irPara(id)}>
                  {!celular && <Icone size={18} aria-hidden="true" />}{celular && id === 'contatos' ? 'Contatos' : rotulo}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="config-secoes">
          {/* Remédios */}
          <section id="cfg-remedios" className="painel config-secao" aria-labelledby="t-remedios">
            <div className="config-cabecalho">
              <div>
                <h2 id="t-remedios" className="titulo-painel">Lembretes de remédio</h2>
                <p className="texto-pequeno">Na hora marcada a bengala vibra e você recebe um aviso. {pessoa} confirma apertando o botão.</p>
              </div>
              {!novo && <button className="btn btn-secundario btn-pequeno" onClick={() => setNovo({ nome: '', hora: '14:00' })}><Plus size={16} aria-hidden="true" />Adicionar lembrete</button>}
            </div>
            {novo && (
              <form className="config-novo" onSubmit={salvarRemedio}>
                <label className="campo"><span className="campo-rotulo">Remédio</span>
                  <input className="campo-entrada" value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Losartana 50 mg" autoFocus maxLength={60} />
                </label>
                <label className="campo config-novo-hora"><span className="campo-rotulo">Horário</span>
                  <input className="campo-entrada" type="time" value={novo.hora} onChange={e => setNovo({ ...novo, hora: e.target.value })} required />
                </label>
                <div className="config-novo-botoes">
                  <button type="button" className="btn btn-fantasma" onClick={() => setNovo(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primario">Salvar lembrete</button>
                </div>
              </form>
            )}
            <AnimatePresence>
              {msg && (
                <motion.p key={msg} className="nota is-sucesso" role="status"
                  initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: DUR.curta, ease: EASE_MOTION } }}
                  exit={{ opacity: 0, transition: { duration: saida(DUR.curta), ease: EASE_MOTION } }}>
                  <CheckDesenhado />{msg}
                </motion.p>
              )}
            </AnimatePresence>
            <ul className="config-lista">
              {remedios.map(r => {
                const falta = minutosAte(r.hora);
                const status = !r.ativo ? 'Desligado' : r.id === proximoId ? `Próximo · ${daquiA(falta)}` : falta <= 0 ? `Hoje às ${r.hora}` : `Hoje às ${r.hora}`;
                return (
                  <li key={r.id} className={`remedio${r.ativo ? '' : ' is-desligado'}`}>
                    <span className="remedio-hora">{r.hora}</span>
                    <span className="config-textos"><strong>{r.nome}</strong><span>{r.detalhe}</span></span>
                    <span className={`remedio-status${r.id === proximoId ? ' is-proximo' : ''}`}>{status}</span>
                    <Interruptor ligado={r.ativo} onAlternar={() => cuidado.alternarRemedio(r.id)} rotulo={`Lembrete de ${r.nome} às ${r.hora}`} />
                    <button className="btn-icone config-remover" onClick={() => cuidado.removerRemedio(r.id)} aria-label={`Remover lembrete de ${r.nome}`} title="Remover"><X size={18} /></button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Contatos */}
          <section id="cfg-contatos" className="painel config-secao" aria-labelledby="t-contatos">
            <div className="config-cabecalho">
              <div>
                <h2 id="t-contatos" className="titulo-painel">Contatos de emergência</h2>
                <p className="texto-pequeno">Nesta ordem, quando houver queda ou pedido de ajuda. Ninguém é chamado sem você confirmar.</p>
              </div>
            </div>
            <ol className="config-lista">
              {contatos.map((c, i) => (
                <li key={c.id} className="contato-cfg">
                  {!celular && <span className="contato-ordem">{i + 1}º</span>}
                  <span className={`contato-avatar ${c.id === 'maria' ? 'is-acento' : c.id === 'samu' ? 'is-perigo-suave' : 'is-aviso-suave'}`} aria-hidden="true">
                    {c.id === 'maria' ? 'MS' : c.telefone}
                  </span>
                  <span className="config-textos"><strong>{c.id === 'bombeiros' ? 'Corpo de Bombeiros' : c.nome}</strong><span>{c.id === 'maria' ? `Filha · ${c.telefone}` : c.papel}</span></span>
                  {!celular && <span className="contato-quando texto-pequeno">{c.id === 'maria' ? 'Recebe todos os avisos no celular' : c.id === 'samu' ? 'Para queda sem resposta ou mal-estar' : 'Para acidente fora de casa'}</span>}
                  <a className="btn-link" href={`tel:${c.discagem}`}>{c.id === 'maria' ? 'Ligar' : 'Testar ligação'}</a>
                </li>
              ))}
            </ol>
          </section>

          {/* Áreas seguras */}
          <section id="cfg-areas" className="painel config-secao" aria-labelledby="t-areas">
            <div className="config-cabecalho">
              <div>
                <h2 id="t-areas" className="titulo-painel">Áreas seguras</h2>
                <p className="texto-pequeno">Se {pessoa} sair de todas as áreas ligadas, você recebe um aviso com a posição dele.</p>
              </div>
            </div>
            <div className="config-areas">
              <div className="config-mapa mapa-saidas is-ruas">
                <MapContainer center={[casa.lat, casa.lng]} zoom={15} zoomControl={false} scrollWheelZoom={false} className="mapa-leaflet">
                  <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  {areas.map((a, i) => (
                    <React.Fragment key={a.id}>
                      <Circle center={[a.lat, a.lng]} radius={a.raio}
                        pathOptions={{ color: COR_AREA[i % 4], weight: 1.5, dashArray: a.ativa ? undefined : '5 6', fillColor: COR_AREA[i % 4], fillOpacity: a.ativa ? 0.12 : 0.04 }} />
                      <Marker position={[a.lat, a.lng]} icon={pontoArea(COR_AREA[i % 4]!)} keyboard={false}>
                        <Tooltip permanent direction="right" offset={[8, 0]} className="area-rotulo">{a.nome}</Tooltip>
                      </Marker>
                    </React.Fragment>
                  ))}
                </MapContainer>
              </div>
              <ul className="config-lista">
                {areas.map((a, i) => (
                  <li key={a.id} className={`area${a.ativa ? '' : ' is-desligada'}`}>
                    <span className="area-cor" style={{ background: COR_AREA[i % 4] }} aria-hidden="true" />
                    <span className="config-textos"><strong>{a.nome}</strong><span>{a.ativa ? a.detalhe : `Desligada · ${a.detalhe.toLowerCase()}`}</span></span>
                    <span className="area-raio">{a.raio} m</span>
                    <Interruptor ligado={a.ativa} onAlternar={() => cuidado.alternarArea(a.id)} rotulo={`Área ${a.nome}, ${a.raio} metros`} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Bengala */}
          <section id="cfg-bengala" className="painel config-secao" aria-labelledby="t-bengala">
            <div className="config-cabecalho">
              <div>
                <h2 id="t-bengala" className="titulo-painel">Bengala</h2>
                <p className="texto-pequeno">{deviceId}</p>
              </div>
            </div>
            <ul className="config-lista">
              <li className="pref">
                <span className="config-textos"><strong>Avisar obstáculo a</strong><span>A bengala vibra e apita quando algo chega a essa distância</span></span>
                <div className="segmento" role="group" aria-label="Distância do aviso de obstáculo">
                  {[50, 100, 150].map(cm => (
                    <button key={cm} aria-pressed={bengala.distanciaAvisoCm === cm} className={bengala.distanciaAvisoCm === cm ? 'is-ativo' : ''} onClick={() => bengalaPref('distanciaAvisoCm', cm)}>
                      {cm === 50 ? '0,5 m' : cm === 100 ? '1 m' : '1,5 m'}
                    </button>
                  ))}
                </div>
              </li>
              <li className="pref">
                <span className="config-textos"><strong>Força da vibração</strong><span>Dois motores, nos dedos e na palma</span></span>
                <div className="segmento" role="group" aria-label="Força da vibração">
                  {(['fraca', 'media', 'forte'] as const).map(f => (
                    <button key={f} aria-pressed={bengala.forcaVibracao === f} className={bengala.forcaVibracao === f ? 'is-ativo' : ''} onClick={() => bengalaPref('forcaVibracao', f)}>
                      {f === 'fraca' ? 'Fraca' : f === 'media' ? 'Média' : 'Forte'}
                    </button>
                  ))}
                </div>
              </li>
              <li className="pref">
                <span className="config-textos"><strong>Apito junto com a vibração</strong><span>Ajuda quando {pessoa} está de luvas</span></span>
                <Interruptor ligado={bengala.apito} onAlternar={() => bengalaPref('apito', !bengala.apito)} rotulo="Apito junto com a vibração" />
              </li>
              <li className="pref">
                <span className="config-textos"><strong>Farol noturno automático</strong><span>Liga sozinho quando escurece</span></span>
                <Interruptor ligado={bengala.farol} onAlternar={() => bengalaPref('farol', !bengala.farol)} rotulo="Farol noturno automático" />
              </li>
              <li className="pref">
                <span className="config-textos"><strong>Detectar quedas</strong><span>Sempre ligado. Só desligue para limpar ou guardar a bengala</span></span>
                <Interruptor ligado={bengala.detectarQuedas} onAlternar={() => bengalaPref('detectarQuedas', !bengala.detectarQuedas)} rotulo="Detectar quedas" />
              </li>
            </ul>
            {!bengala.detectarQuedas && <p className="nota is-aviso">A detecção de quedas está desligada. Ligue de novo assim que possível.</p>}
            <p className="config-salvo texto-pequeno"><Info size={14} aria-hidden="true" />Preferências desta sessão: ainda não são enviadas para a bengala nem guardadas no servidor.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
