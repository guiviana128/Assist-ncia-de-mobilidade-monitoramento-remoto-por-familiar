import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Video, Circle, Download, Camera, Square, RefreshCw, Zap, CheckCircle2, 
  MapPin, Hand, PhoneCall, X, Phone
} from 'lucide-react';
import { api } from '../services/api';
import { visionApi, VisionMetadata } from '../services/visionApi';
import { DeviceStatus } from '../types';

interface LiveMonitoringViewProps {
  device?: DeviceStatus;
  userAddress?: string;
  onTriggerAlert?: (type: string, message: string) => void;
}

interface RecordedClip {
  id: string;
  url: string;
  blob: Blob;
  name: string;
  durationSec: number;
  timestamp: string;
  threatLevel: string;
  triggerReason: string;
}

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  device,
  userAddress = 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  onTriggerAlert
}) => {
  // Câmera Real do Notebook / Celular
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [, setCameraError] = useState<string | null>(null);
  
  // Gravação ao Vivo Contínua
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedClips, setRecordedClips] = useState<RecordedClip[]>([]);
  
  // Reconhecimento de Sinal com a Mão (SOS)
  const [isHandGestureEnabled, setIsHandGestureEnabled] = useState(true);
  const [handConfidence, setHandConfidence] = useState(0); // 0% a 100%
  const [handHoldProgress, setHandHoldProgress] = useState(0); // 0 a 100
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [sensitivity, setSensitivity] = useState<'ultra' | 'balanced' | 'low'>('ultra');
  const [showEmergencyCallModal, setShowEmergencyCallModal] = useState(false);

  // Ajustes de Vigilância
  const [nightVisionEnhance, setNightVisionEnhance] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [visionMetadata, setVisionMetadata] = useState<VisionMetadata | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const emergencyTriggeredRef = useRef(false);
  const visionBusyRef = useRef(false);
  const visionSessionIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `vision-${Date.now()}`
  );

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Inicializar Câmera Real do Notebook ou Celular
  const startRealCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }

      setCameraActive(true);
      setCameraFacing(facing);
      showToast('📷 Câmera conectada. Faça a sequência completa do Signal for Help para solicitar uma verificação segura.');

    } catch (err: any) {
      console.error('Erro câmera:', err);
      setCameraActive(false);
      setCameraError('Permita o acesso à câmera para ver a imagem real.');
      showToast('⚠️ Clique no botão "Ativar Minha Câmera" e permita o acesso no navegador.');
    }
  };

  // Alternar Câmera Frontal / Traseira
  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    startRealCamera(nextFacing);
  };

  // Iniciar Gravação de Vídeo Real da Câmera
  const startRecording = () => {
    try {
      recordedChunksRef.current = [];
      let streamToRecord: MediaStream | null = streamRef.current;

      if (!streamToRecord && canvasRef.current) {
        streamToRecord = canvasRef.current.captureStream(30);
      }

      if (!streamToRecord) return;

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4');

      const recorder = new MediaRecorder(streamToRecord, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        const clip: RecordedClip = {
          id: Date.now().toString(),
          url: videoUrl,
          blob,
          name: `Evidencia_Gesto_Mao_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`,
          durationSec: recordingTime || 5,
          timestamp: new Date().toLocaleTimeString(),
          threatLevel: 'EMERGENCY',
          triggerReason: '✋ Sinal com a Mão (SOS) Reconhecido'
        };

        setRecordedClips(prev => [clip, ...prev]);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      if (!recordTimerRef.current) {
        recordTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    } catch (e) {
      console.error('Erro gravação:', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  };

  // Confirmação supervisionada do Signal for Help
  const triggerHandGestureEmergency = useCallback(async (metadata: VisionMetadata) => {
    if (emergencyTriggeredRef.current) return;
    emergencyTriggeredRef.current = true;
    setIsHandDetected(true);

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.requestData();
    }

    try {
      const result = await api.registerVisionEvent(
        device?.deviceId ?? metadata.deviceId ?? 'ESP32-MOB-001',
        metadata
      );
      onTriggerAlert?.('HAND_GESTURE_SOS', 'Signal for Help confirmado; revisão humana pendente.');
      setShowEmergencyCallModal(true);
      const actionId = result.supervisedAction?.id;
      showToast(
        actionId
          ? `🛡️ Sinal confirmado. Proposta supervisionada #${actionId} aguarda revisão.`
          : '🛡️ Sinal confirmado. Aguardando revisão humana.'
      );
    } catch {
      showToast('⚠️ O gesto foi reconhecido, mas não foi possível registrar a proposta supervisionada.');
    } finally {
      window.setTimeout(() => {
        emergencyTriggeredRef.current = false;
      }, 8000);
    }
  }, [device?.deviceId, isRecording, onTriggerAlert]);

  // Capturar Foto Snapshot da Câmera Real
  const takeSnapshot = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const imageUri = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = `Foto_Evidencia_Mao_${Date.now()}.jpg`;
    link.href = imageUri;
    link.click();
    showToast('📸 Foto capturada e salva com sucesso!');
  };

  // Tenta ativar a câmera real automaticamente ao carregar
  useEffect(() => {
    startRealCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  // Renderização local da câmera e dos metadados retornados pelo OpenCV
  useEffect(() => {
    let animationFrameId = 0;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = canvas;

      if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Aguardando câmera do notebook ou celular…', width / 2, height / 2);
        ctx.textAlign = 'start';
      }

      if (visionMetadata?.boundingBox) {
        const box = visionMetadata.boundingBox;
        const color = visionMetadata.gesture.confirmed ? '#ef4444' : '#10b981';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x * width, box.y * height, box.width * width, box.height * height);
        ctx.fillStyle = color;
        ctx.fillRect(box.x * width, Math.max(38, box.y * height - 24), 270, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(
          `Signal for Help: ${visionMetadata.gesture.phase} · ${Math.round(visionMetadata.gesture.confidence * 100)}%`,
          box.x * width + 5,
          Math.max(53, box.y * height - 9)
        );
      }

      if (nightVisionEnhance) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
      ctx.fillRect(0, 0, width, 36);
      ctx.fillStyle = isRecording ? '#ef4444' : '#10b981';
      ctx.beginPath();
      ctx.arc(18, 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(
        isRecording ? '● REC LOCAL · OPENCV ATIVO' : 'OPENCV LOCAL · METADADOS SEM ARMAZENAR IMAGEM',
        32,
        22
      );

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRecording, nightVisionEnhance, visionMetadata]);

  // Envia quadros reduzidos somente ao serviço local de visão
  useEffect(() => {
    if (!cameraActive || !isHandGestureEnabled) return;

    let active = true;
    const analyze = async () => {
      const canvas = canvasRef.current;
      if (!canvas || visionBusyRef.current) return;
      visionBusyRef.current = true;

      try {
        const metadata = await visionApi.analyzeFrame(
          canvas,
          visionSessionIdRef.current,
          device?.deviceId ?? 'ESP32-MOB-001'
        );
        if (!active) return;

        setVisionMetadata(metadata);
        setHandConfidence(Math.round(metadata.gesture.confidence * 100));
        setHandHoldProgress(Math.round(metadata.gesture.sequenceProgress * 100));
        setIsHandDetected(metadata.gesture.confirmed);

        if (metadata.gesture.confirmed) {
          await triggerHandGestureEmergency(metadata);
        }
      } catch {
        // A câmera continua funcionando mesmo se o serviço local estiver indisponível.
      } finally {
        visionBusyRef.current = false;
      }
    };

    void analyze();
    const intervalMs = sensitivity === 'ultra' ? 450 : sensitivity === 'balanced' ? 650 : 900;
    const intervalId = window.setInterval(() => void analyze(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [cameraActive, device?.deviceId, isHandGestureEnabled, sensitivity, triggerHandGestureEmergency]);

  return () => cancelAnimationFrame(animationFrameId);
  }, [cameraActive, isRecording, recordingTime, isHandGestureEnabled, sensitivity, nightVisionEnhance, userAddress, triggerHandGestureEmergency]);

  return (
    <div style={{ margin: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Toast Feedback */}
      {feedbackToast && (
        <div style={{
          padding: '12px 18px',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          borderRadius: '10px',
          fontSize: '0.86rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={18} />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Barra de Progresso do Reconhecimento de Gesto da Mão */}
      {isHandGestureEnabled && (
        <div className="glass-panel" style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: isHandDetected ? 'var(--accent-red-bg)' : 'var(--bg-card)',
          border: isHandDetected ? '1.5px solid #ef4444' : '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: isHandDetected ? '#ef4444' : (handConfidence > 40 ? 'var(--accent-green-text)' : 'var(--accent-primary)'),
              padding: '8px',
              borderRadius: '10px',
              color: '#ffffff',
              transition: 'all 0.2s ease'
            }}>
              <Hand size={20} className={handConfidence > 40 ? 'animate-bounce' : ''} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Detector local do Signal for Help
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                {handConfidence > 30 
                  ? `✋ Etapa visual identificada! Progresso: ${handHoldProgress}%` 
                  : 'Faça: palma aberta, polegar recolhido e dedos fechando sobre o polegar'}
              </p>
            </div>
          </div>

          {/* Barra de Confiança em Tempo Real */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px' }}>
            <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${handHoldProgress || handConfidence}%`,
                background: isHandDetected ? '#ef4444' : (handHoldProgress > 50 ? '#f59e0b' : '#10b981'),
                transition: 'width 0.15s ease'
              }}></div>
            </div>
            <strong style={{ fontSize: '0.85rem', color: isHandDetected ? '#ef4444' : '#10b981' }}>
              {handHoldProgress || handConfidence}%
            </strong>
          </div>
        </div>
      )}

      {/* Grid Principal: Vídeo Real da Câmera + Controles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '18px' }}>
        
        {/* Coluna 1: Tela de Vídeo Real da Câmera com Gravação Contínua */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Header da Câmera */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: isRecording ? 'var(--accent-red-bg)' : 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
                padding: '8px',
                borderRadius: '10px',
                color: '#ffffff'
              }}>
                <Video size={20} className={isRecording ? 'animate-pulse' : ''} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                  Câmera do Notebook / Celular (Ao Vivo)
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Vídeo real transmitido diretamente com reconhecimento óptico de socorro
                </p>
              </div>
            </div>

            {/* Badges de Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRecording && (
                <span className="badge badge-alert" style={{ animation: 'pulse-red-glow 1.5s infinite' }}>
                  <Circle size={8} fill="#ef4444" color="#ef4444" />
                  GRAVANDO VÍDEO
                </span>
              )}
              <span className={`badge ${cameraActive ? 'badge-online' : 'badge-alert'}`}>
                <Camera size={12} />
                {cameraActive ? 'Câmera Real Ativa' : 'Câmera Desconectada'}
              </span>
            </div>
          </div>

          {/* Player de Vídeo Real e Canvas */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '430px',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#000000',
            border: isRecording ? '2.5px solid #ef4444' : '1px solid var(--border-color)',
            boxShadow: isRecording ? '0 0 25px rgba(239, 68, 68, 0.4)' : '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <video
              ref={videoRef}
              style={{ display: 'none' }}
              playsInline
              muted
              autoPlay
            />

            <canvas
              ref={canvasRef}
              width={640}
              height={430}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Mensagem se a câmera não estiver ativa */}
            {!cameraActive && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(9, 13, 22, 0.94)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ background: 'var(--accent-primary)', padding: '14px', borderRadius: '50%', color: '#fff' }}>
                  <Camera size={32} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Câmera do Notebook / Celular Desconectada
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
                  Clique no botão abaixo para permitir o acesso à webcam ou câmera do celular e iniciar o reconhecimento de sinal com a mão.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => startRealCamera()}
                  style={{ padding: '12px 24px', fontSize: '0.9rem', fontWeight: 800, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Camera size={18} />
                  <span>Ativar Minha Câmera Agora</span>
                </button>
              </div>
            )}

            {/* Banner Flutuante quando Sinal com a Mão é Detectado */}
            {isHandDetected && (
              <div style={{
                position: 'absolute',
                top: '46px',
                left: '14px',
                right: '14px',
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 25px rgba(239, 68, 68, 0.5)',
                animation: 'pulse-red-glow 1s infinite'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Hand size={24} />
                  <div>
                    <span>✋ SINAL COM A MÃO RECONHECIDO NA CÂMERA!</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', fontWeight: 500 }}>
                      Chamada de emergência em andamento e vídeo gravado como evidência.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmergencyCallModal(true)}
                  className="btn btn-primary"
                  style={{ background: '#ffffff', color: '#dc2626', fontWeight: 800, padding: '6px 14px', borderRadius: '8px' }}
                >
                  Abrir Ligação
                </button>
              </div>
            )}
          </div>

          {/* Barra de Controles da Câmera Real e Gravação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              
              {/* Botão de Disparo Manual de Teste do Sinal de Mão */}
              <button
                className="btn btn-danger"
                onClick={triggerHandGestureEmergency}
                style={{
                  padding: '10px 18px',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
                }}
              >
                <Hand size={18} />
                <span>✋ Fazer Sinal com a Mão (Ligar)</span>
              </button>

              {/* Botão Alternar Câmera Frontal / Traseira */}
              <button
                className="btn btn-secondary"
                onClick={toggleCameraFacing}
                style={{ padding: '10px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Alternar entre câmera frontal e traseira"
              >
                <RefreshCw size={15} />
                <span>{cameraFacing === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}</span>
              </button>

              {/* Botão Gravação Manual */}
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                    showToast('💾 Gravação salva!');
                  } else {
                    startRecording();
                    showToast('🔴 Gravação reiniciada!');
                  }
                }}
                style={{ padding: '10px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isRecording ? <Square size={14} fill="#ef4444" color="#ef4444" /> : <Circle size={14} fill="#10b981" color="#10b981" />}
                <span>{isRecording ? 'Pausar Gravação' : 'Retomar Gravação'}</span>
              </button>

              {/* Botão Snapshot */}
              <button
                className="btn btn-secondary"
                onClick={takeSnapshot}
                style={{ padding: '10px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Camera size={15} />
                <span>Foto Snapshot</span>
              </button>
            </div>

            {/* Alternador de Visão Noturna */}
            <button
              className="btn btn-secondary"
              onClick={() => setNightVisionEnhance(!nightVisionEnhance)}
              style={{
                padding: '10px 14px',
                fontSize: '0.82rem',
                background: nightVisionEnhance ? 'var(--accent-green-bg)' : 'var(--bg-app)',
                color: nightVisionEnhance ? 'var(--accent-green-text)' : 'var(--text-secondary)',
                borderColor: nightVisionEnhance ? 'var(--accent-green-border)' : 'var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} />
              <span>Visão Noturna {nightVisionEnhance ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Galeria de Gravações de Vídeo da Câmera Real */}
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={16} color="var(--accent-primary)" />
              <span>Vídeos Reais Gravados com JavaCV ({recordedClips.length})</span>
            </h4>
            
            {recordedClips.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                A gravação ao vivo da câmera real está ativa. Os vídeos gravados com o sinal de socorro aparecerão aqui.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                {recordedClips.map((clip) => (
                  <div
                    key={clip.id}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-app)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{clip.name}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {clip.timestamp} • {clip.durationSec}s • {clip.triggerReason}
                      </p>
                    </div>
                    <a
                      href={clip.url}
                      download={clip.name}
                      className="btn btn-primary"
                      style={{ padding: '6px 10px', borderRadius: '8px', textDecoration: 'none' }}
                      title="Baixar vídeo real gravado"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Coluna 2: Ajustes de Sensibilidade & Discagem Rápida */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Card 1: Sensibilidade do Reconhecimento de Gesto */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                padding: '8px',
                borderRadius: '10px',
                color: '#ffffff'
              }}>
                <Hand size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>
                  Sensibilidade do Gesto com a Mão
                </h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Ajuste a facilidade para reconhecer a mão erguida
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setSensitivity('ultra');
                  showToast('⚡ Modo Ultra-Sensível ativado: Reconhecimento imediato!');
                }}
                className={`btn ${sensitivity === 'ultra' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.76rem', padding: '8px 4px' }}
              >
                ⚡ Ultra-Rápido
              </button>
              <button
                type="button"
                onClick={() => {
                  setSensitivity('balanced');
                  showToast('⚖️ Modo Equilibrado ativado');
                }}
                className={`btn ${sensitivity === 'balanced' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.76rem', padding: '8px 4px' }}
              >
                ⚖️ Equilibrado
              </button>
              <button
                type="button"
                onClick={() => {
                  setSensitivity('low');
                  showToast('🛡️ Modo Anti-Falso-Positivo ativado');
                }}
                className={`btn ${sensitivity === 'low' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.76rem', padding: '8px 4px' }}
              >
                🛡️ Preciso
              </button>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Reconhecimento Automático Ativo
                </span>
                <input
                  type="checkbox"
                  checked={isHandGestureEnabled}
                  onChange={(e) => setIsHandGestureEnabled(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                />
              </label>

              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                🛡️ Revisão humana obrigatória · nenhuma ligação automática
              </div>
            </div>
          </div>

          {/* Card 2: Contatos de Emergência Imediatos */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                padding: '8px',
                borderRadius: '10px',
                color: '#ffffff'
              }}>
                <PhoneCall size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>
                  Linhas Diretas de Emergência
                </h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Contatos disponíveis somente para decisão humana
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Contato Familiar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>Maria Silva (Filha)</strong>
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>+55 11 98765-4321</p>
                </div>
                <a
                  href="tel:5511987654321"
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Phone size={13} />
                  <span>Ligar</span>
                </a>
              </div>

              {/* SAMU 192 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--accent-red-bg)', borderRadius: '8px', border: '1px solid var(--accent-red-border)' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: 'var(--accent-red-text)' }}>SAMU Ambulância 192</strong>
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Emergência Médica</p>
                </div>
                <a
                  href="tel:192"
                  className="btn btn-danger"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Phone size={13} />
                  <span>192</span>
                </a>
              </div>
            </div>
          </div>

          {/* Card 3: Endereço Residencial Cadastrado */}
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color="var(--accent-primary)" />
              <strong style={{ fontSize: '0.85rem' }}>Endereço de Monitoração:</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {userAddress}
            </p>
          </div>

        </div>

      </div>

      {/* Revisão humana após confirmação do Signal for Help */}
      {showEmergencyCallModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            background: 'var(--bg-card)',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            border: '2px solid #ef4444',
            boxShadow: '0 0 50px rgba(239, 68, 68, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'pulse-red-glow 2s infinite'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#ef4444', padding: '10px', borderRadius: '12px', color: '#fff' }}>
                  <Hand size={26} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Sinal visual de socorro detectado!
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Metadados confirmados pelo OpenCV · revisão humana pendente
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEmergencyCallModal(false);
                  setIsHandDetected(false);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', borderRadius: '8px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              padding: '16px',
              background: 'var(--accent-red-bg)',
              borderRadius: '12px',
              border: '1px solid var(--accent-red-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--accent-red-text)' }}>
                Confirme o contexto com segurança. Se houver perigo imediato, escolha manualmente um contato:
              </span>

              {/* Ligar para SAMU 192 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '10px' }}>
                <div>
                  <strong style={{ fontSize: '0.96rem', color: '#ffffff' }}>SAMU Ambulância 192</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Atendimento Médico de Urgência
                  </p>
                </div>
                <a
                  href="tel:192"
                  className="btn btn-danger"
                  style={{ padding: '10px 20px', fontSize: '0.9rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626' }}
                >
                  <Phone size={16} />
                  <span>Discar 192</span>
                </a>
              </div>

              {/* Ligar para o Familiar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '10px' }}>
                <div>
                  <strong style={{ fontSize: '0.96rem', color: '#ffffff' }}>Maria Silva (Filha)</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    +55 11 98765-4321 • Familiar Cuidador
                  </p>
                </div>
                <a
                  href="tel:5511987654321"
                  className="btn btn-primary"
                  style={{ padding: '10px 18px', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Phone size={16} />
                  <span>Ligar p/ Filha</span>
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                A imagem e os landmarks não foram armazenados pelo serviço de visão.
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowEmergencyCallModal(false);
                  setIsHandDetected(false);
                }}
              >
                Fechar Modal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

