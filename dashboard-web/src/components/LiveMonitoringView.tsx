import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  Bot,
  Camera,
  Download,
  Lock,
  MapPin,
  Maximize2,
  Moon,
  Phone,
  RotateCcw,
  Video,
} from "lucide-react";
import { apiJson } from "../services/auth";
import { api } from "../services/api";
import { visionApi } from "../services/visionApi";
import { robotApi } from "../services/robotApi";
import type { VisionMetadata } from "../services/visionApi";
import type { Alert, DeviceStatus } from "../types";
import type { HouseLayout } from "../types/robot";
import { MaoAberta, MaoFechada, MaoPolegar } from "./ui/MaoIcones";
import { ItemLinhaDoTempo } from "./ui/LinhaDoTempo";
import { OlhosDoRobo } from "./camera/OlhosDoRobo";
import { contatosDaFamilia, useCuidado } from "../lib/cuidado";
import { iniciais } from "./cadastro/regras";
import {
  artigo,
  comodoCurto,
  deComodo,
  naNo,
  nomePessoa,
} from "../lib/resumoDoEstado";
import {
  horaCurta,
  ehHoje,
  limparTexto,
  tituloAviso,
  tomAviso,
} from "../lib/avisos";
import { CELULAR, useMediaQuery } from "../hooks/useMediaQuery";
import { gsap, movimentoReduzido, useGSAP } from "../motion/gsap";
import { DESLOCA, DUR, EASE_MOTION, QUEDA } from "../motion/tokens";

interface LiveMonitoringViewProps {
  device?: DeviceStatus;
  alerts: Alert[];
  layout: HouseLayout;
  demo: boolean;
  onTriggerAlert?: (type: string, message: string) => void;
  onResolver: (alertId: number) => void;
}

interface RecordedClip {
  id: string;
  url: string;
  blob: Blob;
  name: string;
  durationSec: number;
  timestamp: string;
  thumb?: string;
  fonte: string;
}

type Sensibilidade = "ultra" | "balanced" | "low";
type Fonte = "robo" | "notebook";

const SENSIBILIDADE: Record<
  Sensibilidade,
  { rotulo: string; texto: string; intervalo: number }
> = {
  ultra: {
    rotulo: "Rápido",
    texto:
      "Envia um quadro a cada 450 ms. A precisão depende da câmera e do gesto.",
    intervalo: 450,
  },
  balanced: {
    rotulo: "Equilibrado",
    texto:
      "Envia um quadro a cada 650 ms, equilibrando frequência e processamento.",
    intervalo: 650,
  },
  low: {
    rotulo: "Econômico",
    texto:
      "Envia um quadro a cada 900 ms. Menor frequência não significa maior precisão.",
    intervalo: 900,
  },
};

const PASSOS = [
  {
    titulo: "Mão aberta",
    detalhe: "Palma virada para a câmera",
    Icone: MaoAberta,
  },
  {
    titulo: "Polegar dobrado",
    detalhe: "O polegar encosta na palma",
    Icone: MaoPolegar,
  },
  {
    titulo: "Dedos fecham",
    detalhe: "Os dedos prendem o polegar",
    Icone: MaoFechada,
  },
];

/** Quais passos do Signal for Help o detector já viu, a partir da fase devolvida pelo OpenCV. */
function passosVistos(m: VisionMetadata | null): [boolean, boolean, boolean] {
  if (!m) return [false, false, false];
  const fase = m.gesture.phase;
  const p3 = m.gesture.confirmed || fase === "THUMB_TRAPPED";
  const p2 = p3 || fase === "OPEN_PALM_THUMB_TUCKED";
  const p1 = p2 || m.handDetected;
  return [p1, p2, p3];
}

const segundosRelogio = (t: number) => new Date(t).toLocaleTimeString("pt-BR");

/** "Foi engano": tudo volta em 250 ms. */
const VOLTA = 0.25;
/** Painéis que trocam com o gesto (contatos ⇄ "O que fazer agora"): entram com fade. */
const PAINEL: Variants = {
  fora: { opacity: 0 },
  dentro: {
    opacity: 1,
    transition: {
      duration: DUR.curta,
      ease: EASE_MOTION,
      when: "beforeChildren",
      staggerChildren: QUEDA.stagger,
    },
  },
};
const PAINEL_VOLTA: Variants = {
  fora: { opacity: 0 },
  dentro: { opacity: 1, transition: { duration: VOLTA, ease: EASE_MOTION } },
};
/** Os 4 botões de "O que fazer agora" entram em stagger de 60 ms. */
const BOTAO: Variants = {
  fora: { opacity: 0, y: -DESLOCA },
  dentro: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.curta, ease: EASE_MOTION },
  },
};
/** Botão desativado (simulação): termina na mesma opacidade do CSS de .btn[aria-disabled]. */
const BOTAO_DESATIVADO: Variants = {
  ...BOTAO,
  dentro: {
    opacity: 0.55,
    y: 0,
    transition: { duration: DUR.curta, ease: EASE_MOTION },
  },
};
const MOLDURA = "rgba(220, 38, 38, 0.24)";

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  device,
  alerts,
  layout,
  demo,
  onTriggerAlert,
  onResolver,
}) => {
  const celular = useMediaQuery(CELULAR);
  const { contatos, telefonePessoa, endereco } = useCuidado();
  const pessoa = nomePessoa(device);

  // Câmera real do notebook / celular
  const [fonte, setFonte] = useState<Fonte>("notebook");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Gravação local
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedClips, setRecordedClips] = useState<RecordedClip[]>([]);

  // Reconhecimento do Signal for Help
  const [isHandGestureEnabled, setIsHandGestureEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState<Sensibilidade>("balanced");
  const [nightVisionEnhance, setNightVisionEnhance] = useState(false);
  const [feedback, setFeedback] = useState<{
    texto: string;
    erro?: boolean;
  } | null>(null);
  const [visionMetadata, setVisionMetadata] = useState<VisionMetadata | null>(
    null,
  );
  const [visionOnline, setVisionOnline] = useState<boolean | null>(null);
  const [confirmadoLocal, setConfirmadoLocal] = useState<{
    quando: number;
    acaoId?: number;
  } | null>(null);
  const [vistos, setVistos] = useState<(number | null)[]>([null, null, null]);
  const [roboEnviado, setRoboEnviado] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const molduraRef = useRef<HTMLDivElement | null>(null);
  const passosGestoRef = useRef<HTMLOListElement | null>(null);
  const vistosAntes = useRef<string>("");
  const gestoAntes = useRef<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordingTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const emergencyTriggeredRef = useRef(false);
  const visionBusyRef = useRef(false);
  const cameraRequestRef = useRef(0);
  const visionSessionIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `vision-${Date.now()}`,
  );

  const avisar = (texto: string, erro = false) => {
    setFeedback({ texto, erro });
    window.setTimeout(() => setFeedback(null), 4000);
  };

  // Pedido de ajuda pela câmera: alerta pendente (inclusive o do Simulador) ou confirmação local
  const alertaGesto = alerts.find(
    (a) => a.alertType === "HAND_GESTURE_SOS" && a.status === "PENDING",
  );
  const gestoAtivo = !!alertaGesto || !!confirmadoLocal;
  const quandoGesto = alertaGesto
    ? new Date(alertaGesto.createdAt).getTime()
    : (confirmadoLocal?.quando ?? Date.now());
  const comodoGesto = comodoCurto(layout, alertaGesto?.indoorRoom);

  // ---------------------------------------------------------------- câmera
  const startRealCamera = async (
    facing: "user" | "environment" = cameraFacing,
  ) => {
    const request = ++cameraRequestRef.current;
    try {
      setCameraError(null);
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
      setCameraActive(true);
      setCameraFacing(facing);
    } catch (err) {
      console.error("Erro câmera:", err);
      setCameraActive(false);
      setCameraError("O navegador não liberou a câmera.");
    }
  };

  const toggleCameraFacing = () => {
    void startRealCamera(cameraFacing === "user" ? "environment" : "user");
  };

  // ---------------------------------------------------------------- gravação
  const startRecording = () => {
    try {
      recordedChunksRef.current = [];
      let streamToRecord: MediaStream | null = streamRef.current;
      if (!streamToRecord && canvasRef.current)
        streamToRecord = canvasRef.current.captureStream(30);
      if (!streamToRecord) return;

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";
      const recorder = new MediaRecorder(streamToRecord, { mimeType });
      const thumb = canvasRef.current?.toDataURL("image/jpeg", 0.6);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const agora = new Date();
        setRecordedClips((prev) => [
          {
            id: Date.now().toString(),
            url: URL.createObjectURL(blob),
            blob,
            name: `Amparo_clipe_${agora.toLocaleTimeString("pt-BR").replace(/:/g, "-")}.webm`,
            durationSec: recordingTimeRef.current || 1,
            timestamp: horaCurta(agora),
            thumb,
            fonte: cameraFacing === "user" ? "Notebook" : "Câmera traseira",
          },
          ...prev,
        ]);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      recordingTimeRef.current = 0;
      setRecordingTime(0);
      setIsRecording(true);
      if (!recordTimerRef.current) {
        recordTimerRef.current = window.setInterval(() => {
          recordingTimeRef.current += 1;
          setRecordingTime(recordingTimeRef.current);
        }, 1000);
      }
    } catch (e) {
      console.error("Erro gravação:", e);
      avisar("Não foi possível gravar neste navegador.", true);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    )
      mediaRecorderRef.current.stop();
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  };

  // ---------------------------------------------------------------- confirmação supervisionada
  const triggerHandGestureEmergency = useCallback(
    async (metadata: VisionMetadata) => {
      if (emergencyTriggeredRef.current) return;
      emergencyTriggeredRef.current = true;
      setConfirmadoLocal({ quando: Date.now() });

      if (isRecording && mediaRecorderRef.current)
        mediaRecorderRef.current.requestData();

      try {
        const result = await api.registerVisionEvent(
          device?.deviceId ?? metadata.deviceId ?? "ESP32-MOB-001",
          metadata,
        );
        onTriggerAlert?.(
          "HAND_GESTURE_SOS",
          "Signal for Help confirmado; revisão humana pendente.",
        );
        const actionId = result.supervisedAction?.id;
        setConfirmadoLocal((c) => (c ? { ...c, acaoId: actionId } : c));
      } catch {
        avisar(
          "O gesto foi reconhecido, mas não foi possível registrar o aviso no servidor.",
          true,
        );
      } finally {
        window.setTimeout(() => {
          emergencyTriggeredRef.current = false;
        }, 8000);
      }
    },
    [device?.deviceId, isRecording, onTriggerAlert],
  );

  const takeSnapshot = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `Amparo_foto_${Date.now()}.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 0.95);
    link.click();
    avisar("Foto salva neste aparelho.");
  };

  const telaCheia = () => {
    const el = molduraRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  // Liga a câmera ao abrir a tela (pede a permissão do navegador)
  useEffect(() => {
    // A captura começa apenas pelo botão Ligar a câmera.
    return () => {
      cameraRequestRef.current++;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current?.state === "recording")
        mediaRecorderRef.current.stop();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desenho local da câmera e da caixa devolvida pelo OpenCV (sem animação decorativa)
  useEffect(() => {
    let frame = 0;
    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const { width, height } = canvas;
        if (video && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, width, height);
        } else {
          ctx.fillStyle = "#EDF1F6";
          ctx.fillRect(0, 0, width, height);
        }
        if (visionMetadata?.boundingBox) {
          const box = visionMetadata.boundingBox;
          ctx.strokeStyle = visionMetadata.gesture.confirmed
            ? "#DC2626"
            : "#10B981";
          ctx.lineWidth = 3;
          ctx.strokeRect(
            box.x * width,
            box.y * height,
            box.width * width,
            box.height * height,
          );
        }
        if (nightVisionEnhance) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
          ctx.fillRect(0, 0, width, height);
        }
      }
      frame = requestAnimationFrame(renderLoop);
    };
    frame = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(frame);
  }, [nightVisionEnhance, visionMetadata]);

  // Envia quadros reduzidos somente ao serviço local de visão
  useEffect(() => {
    if (!cameraActive || !isHandGestureEnabled) return;
    let active = true;
    const analyze = async () => {
      const canvas = canvasRef.current;
      if (!canvas || visionBusyRef.current) return;
      visionBusyRef.current = true;
      try {
        const raw = document.createElement("canvas");
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth) return;
        raw.width = 640;
        raw.height = Math.round((video.videoHeight * 640) / video.videoWidth);
        raw.getContext("2d")!.drawImage(video, 0, 0, raw.width, raw.height);
        const metadata = await visionApi.analyzeFrame(
          raw,
          visionSessionIdRef.current,
          device?.deviceId ?? "ESP32-MOB-001",
        );
        if (!active) return;
        setVisionOnline(true);
        setVisionMetadata(metadata);
        if (metadata.gesture.confirmed)
          await triggerHandGestureEmergency(metadata);
      } catch {
        // A câmera continua funcionando mesmo se o serviço local estiver indisponível.
        if (active) setVisionOnline(false);
      } finally {
        visionBusyRef.current = false;
      }
    };
    void analyze();
    const intervalId = window.setInterval(
      () => void analyze(),
      SENSIBILIDADE[sensitivity].intervalo,
    );
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    cameraActive,
    device?.deviceId,
    fonte,
    isHandGestureEnabled,
    sensitivity,
    triggerHandGestureEmergency,
  ]);

  useEffect(() => {
    if (!device?.deviceId || demo || !cameraActive) return;
    const beat = () => {
      void apiJson(`/care/${device.deviceId}/heartbeat/camera?state=ACTIVE`, {
        method: "POST",
      }).catch(() => undefined);
      void apiJson(
        `/care/${device.deviceId}/heartbeat/vision?state=${visionOnline === true ? "ACTIVE" : "ERROR"}`,
        { method: "POST" },
      ).catch(() => undefined);
    };
    beat();
    const t = setInterval(beat, 5000);
    return () => {
      clearInterval(t);
    };
  }, [device?.deviceId, demo, cameraActive, visionOnline]);

  // Hora em que cada passo do gesto foi visto pela primeira vez
  const [p1, p2, p3] = passosVistos(visionMetadata);
  useEffect(() => {
    if (!p1 && !gestoAtivo) {
      setVistos([null, null, null]);
      return;
    }
    setVistos((v) => [
      v[0] ?? (p1 ? Date.now() : null),
      v[1] ?? (p2 ? Date.now() : null),
      v[2] ?? (p3 ? Date.now() : null),
    ]);
  }, [p1, p2, p3, gestoAtivo]);
  useEffect(() => {
    if (!alertaGesto && !emergencyTriggeredRef.current)
      setConfirmadoLocal(null);
  }, [alertaGesto]);
  useEffect(() => {
    if (!gestoAtivo) setRoboEnviado(false);
  }, [gestoAtivo]);

  // ---------------------------------------------------------------- ações do pedido de ajuda
  const destinoRobo = alertaGesto?.indoorRoom ?? robotRoomFallback(layout);
  const mandarRobo = async () => {
    try {
      const enviar = demo ? robotApi.requestMission : robotApi.requestPhysicalMission;
      const m = await enviar({
        type: "GO_TO_ROOM",
        targetRoom: destinoRobo,
        reason: "Gesto de socorro na câmera",
      });
      if (m.status === "CANCELLED")
        avisar(m.resultMessage ?? "O robô já está atendendo um socorro.");
      else {
        setRoboEnviado(true);
        avisar(
          `Pedido ao robô registrado ${deComodo(comodoCurto(layout, destinoRobo) ?? "Sala")}.`,
        );
      }
    } catch {
      avisar("Não foi possível mandar o robô agora.", true);
    }
  };
  const encerrar = () => {
    if (alertaGesto) onResolver(alertaGesto.id);
    setConfirmadoLocal(null);
    setVistos([null, null, null]);
    avisar("Aviso encerrado. O detector continua atento.");
  };

  // ---------------------------------------------------------------- textos
  const pedidosRecentes = useMemo(
    () =>
      alerts
        .filter(
          (a) =>
            a.alertType === "HAND_GESTURE_SOS" ||
            a.alertType === "FALL_DETECTED" ||
            a.alertType === "SOS_BUTTON",
        )
        .slice(0, 3),
    [alerts],
  );
  const pedidosHoje = alerts.filter(
    (a) => a.alertType === "HAND_GESTURE_SOS" && ehHoje(a.createdAt),
  );
  const fonteRotulo =
    fonte === "robo" ? "Câmera do robô" : "Câmera do notebook";
  const semCamera = fonte === "notebook" && !cameraActive;
  const ondeGesto = comodoGesto ? `, ${naNo(comodoGesto)}` : "";

  const frase = gestoAtivo
    ? {
        forte: celular
          ? `${pessoa} pediu ajuda.`
          : `${pessoa} pediu ajuda pela câmera.`,
        apoio: celular
          ? " Confira a imagem e escolha."
          : " Confira a imagem e escolha o que fazer.",
        tom: "perigo",
      }
    : semCamera
      ? {
          forte: "Câmera desligada.",
          apoio: ` O botão e a queda continuam protegendo o ${pessoa}.`,
          tom: "neutro",
        }
      : pedidosHoje.length
        ? {
            forte: "Tudo calmo agora.",
            apoio: ` ${pedidosHoje.length === 1 ? "Um pedido hoje, já encerrado" : `${pedidosHoje.length} pedidos hoje, já encerrados`}.`,
            tom: "sucesso",
          }
        : {
            forte: "Tudo calmo.",
            apoio: " Nenhum pedido de ajuda hoje.",
            tom: "sucesso",
          };
  const detalhe = gestoAtivo
    ? `Gesto de socorro reconhecido às ${horaCurta(quandoGesto)}${comodoGesto ? ` ${naNo(comodoGesto)}` : ""} · o Amparo não liga sozinho, a decisão é sua`
    : celular
      ? `${fonteRotulo} · a imagem não é guardada`
      : `${fonteRotulo} · o gesto é analisado no serviço local e a imagem não é guardada`;

  const detector = !isHandGestureEnabled
    ? { t: "Detector desligado", c: "is-neutro" }
    : gestoAtivo
      ? { t: "Gesto confirmado", c: "is-perigo" }
      : fonte === "robo"
        ? {
            t: celular ? "Gesto: notebook" : "Gesto pela câmera do notebook",
            c: "is-neutro",
          }
        : visionOnline === false
          ? {
              t: celular ? "Detector fora" : "Detector sem conexão",
              c: "is-aviso",
            }
          : { t: "Detector atento", c: "is-sucesso" };

  const estadoPasso = (i: number) => {
    const visto = gestoAtivo ? (vistos[i] ?? quandoGesto) : vistos[i];
    if (semCamera && !gestoAtivo)
      return { texto: "Câmera desligada", classe: "" };
    if (visto)
      return {
        texto: `Visto às ${segundosRelogio(visto)}`,
        curto: segundosRelogio(visto).slice(3),
        classe: "is-visto",
      };
    return { texto: "Aguardando", classe: "" };
  };
  const duracaoGesto =
    vistos[0] && vistos[2]
      ? Math.max(1, Math.round((vistos[2] - vistos[0]) / 1000))
      : 3;

  // Cada passo do gesto acende quando o detector confirma aquela parte: o fundo vai do cinza
  // para o vermelho-claro (CSS, 200 ms) e o ícone dá uma escala 0,9 → 1
  const vistosChave = PASSOS.map((_, i) =>
    estadoPasso(i).classe === "is-visto" ? "1" : "0",
  ).join("");
  useGSAP(
    () => {
      const antes = vistosAntes.current;
      vistosAntes.current = vistosChave;
      if (!antes || movimentoReduzido()) return;
      const icones = gsap.utils.toArray<HTMLElement>(".passo-gesto-icone");
      [...vistosChave].forEach((v, i) => {
        if (v === "1" && antes[i] !== "1" && icones[i])
          gsap.fromTo(
            icones[i]!,
            { scale: 0.9 },
            { scale: 1, duration: DUR.curta, clearProps: "transform" },
          );
      });
    },
    { scope: passosGestoRef, dependencies: [vistosChave] },
  );

  // Gesto reconhecido: a moldura vermelha entra com um único pulso (sombra 0 → 8 px → 4 px, 450 ms).
  // "Foi engano": a sombra some em 250 ms (transição CSS). Com movimento reduzido, sem pulso.
  useGSAP(
    () => {
      const antes = gestoAntes.current;
      gestoAntes.current = gestoAtivo;
      const moldura = molduraRef.current;
      if (
        !moldura ||
        antes === null ||
        !gestoAtivo ||
        antes ||
        movimentoReduzido()
      )
        return;
      gsap
        .timeline()
        .fromTo(
          moldura,
          { boxShadow: `0 0 0 0px ${MOLDURA}` },
          { boxShadow: `0 0 0 8px ${MOLDURA}`, duration: 0.2 },
        )
        .to(moldura, {
          boxShadow: `0 0 0 4px ${MOLDURA}`,
          duration: 0.25,
          clearProps: "boxShadow",
        });
    },
    { dependencies: [gestoAtivo] },
  );

  const contatosAjuda = [
    {
      id: "pessoa",
      nome: pessoa,
      papel: "Telefone da casa",
      discagem: telefonePessoa,
      iniciais: pessoa.charAt(0),
      tom: "pessoa",
    },
    // Contatos da família cadastrados (passo 6 do cadastro ou Configurações), na ordem de aviso.
    ...contatosDaFamilia(contatos).map((c) => ({
      id: c.id,
      nome: c.nome,
      papel: `${c.papel} · ${c.telefone}`,
      discagem: c.discagem,
      iniciais: iniciais(c.nome),
      tom: "acento",
    })),
  ];

  const controles = (
    <div className="camera-controles">
      {cameraActive && (
        <button
          className="btn btn-secundario"
          onClick={() => {
            cameraRequestRef.current++;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setCameraActive(false);
            setVisionMetadata(null);
            if (isRecording) stopRecording();
          }}
        >
          Desligar câmera do navegador
        </button>
      )}
      <button
        className="btn btn-secundario"
        onClick={toggleCameraFacing}
        disabled={semCamera || fonte === "robo"}
        aria-label="Trocar câmera"
        title="Trocar câmera"
      >
        <RotateCcw size={18} aria-hidden="true" />
        <span>Trocar câmera</span>
      </button>
      <button
        className="btn btn-secundario"
        onClick={() => setNightVisionEnhance((v) => !v)}
        disabled={semCamera || fonte === "robo"}
        aria-pressed={nightVisionEnhance}
        aria-label="Visão noturna"
        title="Visão noturna"
      >
        <Moon size={18} aria-hidden="true" />
        <span>Visão noturna</span>
      </button>
      <button
        className="btn btn-secundario"
        onClick={takeSnapshot}
        disabled={semCamera || fonte === "robo"}
        aria-label="Tirar foto"
        title="Tirar foto"
      >
        <Camera size={18} aria-hidden="true" />
        <span>Tirar foto</span>
      </button>
      <button
        className={`btn btn-secundario${isRecording ? " is-gravando" : ""}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={semCamera || fonte === "robo"}
        aria-pressed={isRecording}
        aria-label={
          isRecording
            ? `Parar gravação, ${recordingTime} segundos`
            : "Gravar clipe"
        }
        title={isRecording ? "Parar gravação" : "Gravar clipe"}
      >
        <span className="ponto-gravar" aria-hidden="true" />
        <span>
          {isRecording ? `Parar · ${recordingTime} s` : "Gravar clipe"}
        </span>
      </button>
      <button
        className="btn btn-secundario btn-so-icone"
        onClick={telaCheia}
        disabled={semCamera && fonte === "notebook"}
        aria-label="Tela cheia"
        title="Tela cheia"
      >
        <Maximize2 size={18} />
      </button>
    </div>
  );

  const comoPede = (
    <section
      className={`painel camera-passos${gestoAtivo ? " is-gesto" : ""}`}
      aria-labelledby="titulo-passos-gesto"
    >
      <h2 id="titulo-passos-gesto" className="titulo-painel">
        {gestoAtivo && celular
          ? `Gesto visto em ${duracaoGesto} s`
          : celular
            ? `Como ${pessoa} pede ajuda`
            : `Como ${pessoa} pede ajuda pela câmera`}
      </h2>
      {!celular && (
        <p className="texto-pequeno">
          Sinal internacional de socorro, feito com uma mão. O detector procura
          a sequência de polegar dobrado e dedos fechando. A família deve
          verificar cada pedido.
        </p>
      )}
      <ol ref={passosGestoRef} className="passos-gesto">
        {PASSOS.map((p, i) => {
          const e = estadoPasso(i);
          return (
            <li key={p.titulo} className={`passo-gesto ${e.classe}`}>
              <span className="passo-gesto-icone" aria-hidden="true">
                <p.Icone size={24} />
              </span>
              <span className="passo-gesto-textos">
                <strong>{p.titulo}</strong>
                <span>{p.detalhe}</span>
                {!celular && (
                  <span className="passo-gesto-estado">{e.texto}</span>
                )}
              </span>
              {celular && e.classe === "is-visto" && (
                <span className="passo-gesto-hora">{e.curto}</span>
              )}
              {!celular && i < PASSOS.length - 1 && (
                <span className="passo-gesto-ligacao" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <div className={`camera${gestoAtivo ? " is-gesto" : ""}`}>
      <section className={`frase-estado is-${frase.tom}`} aria-live="polite">
        <div className="frase-estado-texto">
          <h1 className="frase">
            {frase.forte}
            <span className="frase-apoio">{frase.apoio}</span>
          </h1>
          <p className="frase-detalhe">{detalhe}</p>
        </div>
        {!gestoAtivo && !celular && (
          <div className="frase-estado-acoes">
            <a
              className="btn btn-secundario"
              href={telefonePessoa ? `tel:${telefonePessoa}` : undefined}
              aria-disabled={!telefonePessoa}
            >
              <Phone size={20} aria-hidden="true" />
              Ligar para {pessoa}
            </a>
          </div>
        )}
      </section>

      <div className="camera-grade">
        <div className="camera-principal">
          <section
            className={`painel camera-painel${gestoAtivo ? " is-gesto" : ""}`}
            aria-label="Câmera"
          >
            {!celular && (
              <div className="camera-cabecalho">
                <h2 className="titulo-painel">Câmera</h2>
                <div
                  className="camera-fontes"
                  role="group"
                  aria-label="Fonte da imagem"
                >
                  {(
                    [
                      ["robo", "Robô", "Gêmeo digital"],
                      [
                        "notebook",
                        "Notebook",
                        cameraActive ? "Câmera ligada" : "Câmera desligada",
                      ],
                    ] as const
                  ).map(([id, nome, sub]) => (
                    <button
                      key={id}
                      className={`chip-comodo${fonte === id ? " is-selecionado" : ""}`}
                      aria-pressed={fonte === id}
                      onClick={() => setFonte(id)}
                    >
                      <span className="chip-comodo-nome">{nome}</span>
                      <span className="chip-comodo-status">{sub}</span>
                    </button>
                  ))}
                </div>
                <label
                  className={`toggle-camada${isHandGestureEnabled ? " is-ativo" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isHandGestureEnabled}
                    onChange={(e) => setIsHandGestureEnabled(e.target.checked)}
                  />
                  <span className="toggle-camada-caixa" aria-hidden="true" />
                  Reconhecer gesto de socorro
                </label>
              </div>
            )}
            {celular && (
              <div
                className="segmento camera-fontes-celular"
                role="group"
                aria-label="Fonte da imagem"
              >
                <button
                  aria-pressed={fonte === "robo"}
                  className={fonte === "robo" ? "is-ativo" : ""}
                  onClick={() => setFonte("robo")}
                >
                  Robô
                </button>
                <button
                  aria-pressed={fonte === "notebook"}
                  className={fonte === "notebook" ? "is-ativo" : ""}
                  onClick={() => setFonte("notebook")}
                >
                  Notebook
                </button>
              </div>
            )}

            <div
              className={`camera-video${gestoAtivo ? " is-gesto" : ""}`}
              ref={molduraRef}
            >
              <video
                ref={videoRef}
                className="camera-video-oculto"
                playsInline
                muted
                autoPlay
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={430}
                className="camera-canvas"
                hidden={fonte !== "notebook"}
                aria-label="Imagem da câmera do notebook"
              />
              {fonte === "robo" && (
                <OlhosDoRobo
                  layout={layout}
                  pessoa={pessoa}
                  emergencia={gestoAtivo}
                />
              )}

              {semCamera ? (
                <div className="camera-desligada">
                  <span className="camera-desligada-icone" aria-hidden="true">
                    <Video size={22} />
                  </span>
                  <h2>A câmera está desligada</h2>
                  <p>
                    Para ver a imagem e reconhecer o gesto de socorro, o
                    navegador precisa da sua permissão. A imagem fica só neste
                    aparelho.
                  </p>
                  <button
                    className="btn btn-escuro"
                    onClick={() => void startRealCamera()}
                  >
                    <Video size={18} aria-hidden="true" />
                    Ligar a câmera
                  </button>
                  {cameraError && (
                    <p className="texto-pequeno">
                      Se nada acontecer, toque no cadeado ao lado do endereço do
                      site e permita a câmera.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <span className="casa3d-tag is-escuro camera-tag-vivo">
                    <span className="ponto-vivo" aria-hidden="true" />
                    Ao vivo · {fonte === "robo" ? "robô" : "notebook"}
                    {celular ? "" : ` · ${horaCurta(Date.now())}`}
                  </span>
                  <span
                    className={`selo is-pequeno camera-tag-detector ${detector.c}`}
                  >
                    {detector.t}
                  </span>
                  {gestoAtivo && (
                    <div className="camera-alerta-gesto" role="alert">
                      <MaoFechada size={20} />
                      <span>
                        <strong>Sinal de socorro com a mão</strong>
                        <span>
                          Os 3 passos foram vistos em {duracaoGesto} segundos
                        </span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="camera-rodape">
              {!celular && (
                <p className="texto-pequeno camera-privacidade">
                  <Lock size={14} aria-hidden="true" />
                  Clipes ficam só neste aparelho e somem ao fechar a página
                </p>
              )}
              {controles}
            </div>
            {fonte === "robo" && (
              <p className="nota camera-nota-robo">
                <Bot size={16} aria-hidden="true" />
                Vista simulada do robô (gêmeo digital). O reconhecimento do
                gesto usa a câmera do notebook.
              </p>
            )}
            {visionOnline === false &&
              isHandGestureEnabled &&
              fonte === "notebook" &&
              cameraActive && (
                <p className="nota is-aviso">
                  O serviço de visão (OpenCV) não respondeu. A imagem continua
                  aparecendo, mas o gesto não está sendo analisado.
                </p>
              )}
            {feedback && (
              <p
                className={`nota ${feedback.erro ? "is-perigo" : "is-sucesso"}`}
                role="status"
              >
                {feedback.texto}
              </p>
            )}
          </section>

          {!celular && comoPede}
        </div>

        <aside className="camera-lateral">
          <AnimatePresence initial={false}>
            {gestoAtivo && (
              <motion.section
                key="fazer"
                className="painel camera-fazer"
                aria-labelledby="titulo-fazer"
                variants={PAINEL}
                initial="fora"
                animate="dentro"
              >
                <h2 id="titulo-fazer" className="titulo-painel">
                  O que fazer agora
                </h2>
                {!celular && (
                  <p className="texto-pequeno">
                    Comece falando com ele. Se não atender, mande o robô ou
                    chame o SAMU.
                  </p>
                )}
                <motion.a
                  variants={BOTAO}
                  className="btn btn-escuro btn-bloco btn-grande"
                  href={telefonePessoa ? `tel:${telefonePessoa}` : undefined}
                  aria-disabled={!telefonePessoa}
                >
                  <Phone size={20} aria-hidden="true" />
                  Ligar para {pessoa}
                </motion.a>
                <motion.button
                  variants={BOTAO}
                  className="btn btn-primario btn-bloco btn-grande"
                  onClick={() => void mandarRobo()}
                  disabled={roboEnviado}
                >
                  <Bot size={20} aria-hidden="true" />
                  {roboEnviado
                    ? "Pedido ao robô registrado"
                    : `Mandar o robô até ${artigo(comodoCurto(layout, destinoRobo) ?? "Sala")}`}
                </motion.button>
                {demo ? (
                  <motion.span
                    variants={BOTAO_DESATIVADO}
                    className="btn btn-perigo btn-bloco btn-grande"
                    aria-disabled="true"
                    title="Simulação: nenhuma ligação é feita no modo demonstração"
                  >
                    <Phone size={20} aria-hidden="true" />
                    Ligar 192 · SAMU
                  </motion.span>
                ) : (
                  <motion.a
                    variants={BOTAO}
                    className="btn btn-perigo btn-bloco btn-grande"
                    href="tel:192"
                  >
                    <Phone size={20} aria-hidden="true" />
                    Ligar 192 · SAMU
                  </motion.a>
                )}
                <motion.button
                  variants={BOTAO}
                  className="btn-link camera-engano"
                  onClick={encerrar}
                >
                  Foi engano, encerrar aviso
                </motion.button>
              </motion.section>
            )}
          </AnimatePresence>

          {gestoAtivo && !celular && (
            <section
              className="painel camera-ate-agora"
              aria-labelledby="titulo-ate-agora"
            >
              <h2 id="titulo-ate-agora" className="titulo-painel">
                Até agora
              </h2>
              <ol className="linha-tempo">
                <ItemLinhaDoTempo
                  item={{
                    hora: horaCurta(quandoGesto),
                    titulo: "Gesto de socorro reconhecido",
                    detalhe: `${alertaGesto ? "Câmera" : fonteRotulo}${ondeGesto}`,
                    tom: "perigo",
                  }}
                />
                <ItemLinhaDoTempo
                  item={{
                    hora: horaCurta(quandoGesto),
                    titulo: "Aviso registrado para revisão",
                    detalhe: confirmadoLocal?.acaoId
                      ? `Proposta supervisionada #${confirmadoLocal.acaoId}`
                      : "Família avisada no painel",
                    tom: "aviso",
                  }}
                />
                {roboEnviado && (
                  <ItemLinhaDoTempo
                    item={{
                      hora: "agora",
                      titulo: "Pedido ao robô registrado",
                      detalhe: `Destino solicitado: ${artigo(comodoCurto(layout, destinoRobo) ?? "Sala")}`,
                      tom: "neutro",
                    }}
                  />
                )}
                <ItemLinhaDoTempo
                  ultimo
                  item={{
                    hora: "agora",
                    titulo: "Esperando sua decisão",
                    detalhe: "Nenhuma ligação foi feita",
                    tom: "neutro",
                  }}
                />
              </ol>
            </section>
          )}

          {celular && comoPede}

          <AnimatePresence initial={false}>
            {!gestoAtivo && (
              <motion.section
                key="ajuda"
                className="painel camera-ajuda"
                aria-labelledby="titulo-ajuda"
                variants={PAINEL_VOLTA}
                initial="fora"
                animate="dentro"
              >
                <h2 id="titulo-ajuda" className="titulo-painel">
                  Se precisar de ajuda
                </h2>
                <ul className="contatos">
                  {contatosAjuda.map((c) => (
                    <li key={c.id} className="contato">
                      {!celular && (
                        <span
                          className={`contato-avatar is-${c.tom}`}
                          aria-hidden="true"
                        >
                          {c.iniciais}
                        </span>
                      )}
                      <span className="contato-textos">
                        <strong>{c.nome}</strong>
                        <span>{c.papel}</span>
                      </span>
                      <a
                        className="btn btn-secundario"
                        href={`tel:${c.discagem}`}
                        aria-label={`Ligar para ${c.nome}`}
                      >
                        <Phone size={18} aria-hidden="true" />
                        Ligar
                      </a>
                    </li>
                  ))}
                  <li className="contato is-samu">
                    {!celular && (
                      <span
                        className="contato-avatar is-perigo"
                        aria-hidden="true"
                      >
                        192
                      </span>
                    )}
                    <span className="contato-textos">
                      <strong>SAMU</strong>
                      <span>Urgência médica</span>
                    </span>
                    {demo ? (
                      <span
                        className="btn btn-perigo"
                        aria-disabled="true"
                        title="Simulação: nenhuma ligação é feita no modo demonstração"
                      >
                        <Phone size={18} aria-hidden="true" />
                        192
                      </span>
                    ) : (
                      <a
                        className="btn btn-perigo"
                        href="tel:192"
                        aria-label="Ligar para o SAMU, 192"
                      >
                        <Phone size={18} aria-hidden="true" />
                        192
                      </a>
                    )}
                  </li>
                </ul>
                {!celular && (
                  <p className="camera-endereco">
                    <MapPin size={16} aria-hidden="true" />
                    <span>
                      <span>Endereço para o socorro</span>
                      <strong>{endereco}</strong>
                    </span>
                  </p>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          {!gestoAtivo && !celular && (
            <>
              <section
                className="painel camera-sensibilidade"
                aria-labelledby="titulo-sensibilidade"
              >
                <h2 id="titulo-sensibilidade" className="titulo-painel">
                  Frequência de análise
                </h2>
                <div
                  className="segmento"
                  role="group"
                  aria-label="Sensibilidade"
                >
                  {(Object.keys(SENSIBILIDADE) as Sensibilidade[]).map((s) => (
                    <button
                      key={s}
                      aria-pressed={sensitivity === s}
                      className={sensitivity === s ? "is-ativo" : ""}
                      onClick={() => setSensitivity(s)}
                    >
                      {SENSIBILIDADE[s].rotulo}
                    </button>
                  ))}
                </div>
                <p className="texto-pequeno">
                  {SENSIBILIDADE[sensitivity].texto}
                </p>
              </section>

              <section
                className="painel camera-pedidos"
                aria-labelledby="titulo-pedidos"
              >
                <h2 id="titulo-pedidos" className="titulo-painel">
                  Pedidos recentes
                </h2>
                {pedidosRecentes.length === 0 ? (
                  <p className="texto-pequeno">
                    Nenhum pedido de ajuda registrado.
                  </p>
                ) : (
                  <ol className="linha-tempo">
                    {pedidosRecentes.map((a, i) => (
                      <ItemLinhaDoTempo
                        key={a.id}
                        ultimo={i === pedidosRecentes.length - 1}
                        item={{
                          hora: ehHoje(a.createdAt)
                            ? horaCurta(a.createdAt)
                            : new Date(a.createdAt).toLocaleDateString(
                                "pt-BR",
                                { day: "2-digit", month: "2-digit" },
                              ),
                          titulo: tituloAviso(a, layout),
                          detalhe:
                            a.status === "RESOLVED"
                              ? `Encerrado${a.resolvedAt ? ` às ${horaCurta(a.resolvedAt)}` : ""}`
                              : limparTexto(a.message),
                          tom:
                            a.status === "RESOLVED"
                              ? a.alertType === "HAND_GESTURE_SOS"
                                ? "neutro"
                                : "sucesso"
                              : tomAviso(a),
                        }}
                      />
                    ))}
                  </ol>
                )}
              </section>

              <section
                className="painel camera-clipes"
                aria-labelledby="titulo-clipes"
              >
                <div className="painel-cabecalho">
                  <h2 id="titulo-clipes" className="titulo-painel">
                    Clipes gravados
                  </h2>
                  <span className="texto-pequeno">
                    {recordedClips.length ? `${recordedClips.length} hoje` : ""}
                  </span>
                </div>
                {recordedClips.length === 0 ? (
                  <p className="texto-pequeno">
                    Use "Gravar clipe" para guardar um trecho neste aparelho.
                  </p>
                ) : (
                  <ul className="clipes">
                    {recordedClips.map((c) => (
                      <li key={c.id}>
                        <a
                          href={c.url}
                          download={c.name}
                          className="clipe"
                          aria-label={`Baixar clipe das ${c.timestamp}, ${c.durationSec} segundos`}
                        >
                          {c.thumb ? (
                            <img src={c.thumb} alt="" />
                          ) : (
                            <span className="clipe-vazio" />
                          )}
                          <span className="clipe-baixar" aria-hidden="true">
                            <Download size={16} />
                          </span>
                        </a>
                        <strong>{c.timestamp}</strong>
                        <span>
                          {c.durationSec} s · {c.fonte}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

/** Sem cômodo no alerta, manda o robô para a Sala. */
function robotRoomFallback(layout: HouseLayout) {
  return (
    layout.rooms.find((r) => r.id === "sala")?.id ??
    layout.rooms[0]?.id ??
    "sala"
  );
}
