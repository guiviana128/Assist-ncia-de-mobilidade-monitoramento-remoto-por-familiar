export interface VisionMetadata {
  schemaVersion: string;
  eventId: string;
  sessionId: string;
  deviceId?: string;
  capturedAt: string;
  processor: string;
  landmarkModel: string;
  handDetected: boolean;
  handCount: number;
  handedness?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  gesture: {
    name: 'SIGNAL_FOR_HELP';
    phase: 'NONE' | 'OPEN_PALM_THUMB_TUCKED' | 'THUMB_TRAPPED';
    sequenceState: string;
    confidence: number;
    sequenceProgress: number;
    confirmed: boolean;
  };
  safety: {
    requiresHumanReview: boolean;
    recommendedAction: string;
    automaticEmergencyCall: boolean;
  };
  quality: {
    brightness: number;
    blurScore: number;
    usable: boolean;
  };
  privacy: {
    imageStored: boolean;
    landmarksStored: boolean;
    retentionSeconds: number;
  };
}

export interface VisionEventHistoryItem {
  eventId: string;
  deviceId: string;
  gestureName: string;
  phase: string;
  confidence: number;
  confirmed: boolean;
  capturedAt: string;
  receivedAt: string;
  reviewStatus: 'PENDING' | 'FALSE_POSITIVE' | 'CANCELED';
  reviewedAt?: string;
  reviewedBy?: string;
  agentActionId?: number;
}

const visionEnvironment = (import.meta as ImportMeta & {
  readonly env?: Record<string, string | undefined>;
}).env;

const VISION_API_URL =
  visionEnvironment?.VITE_VISION_API_URL ?? 'http://localhost:8001';

export const visionApi = {
  analyzeFrame(
    canvas: HTMLCanvasElement,
    sessionId: string,
    deviceId: string
  ): Promise<VisionMetadata> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar o quadro da câmera'));
          return;
        }

        const form = new FormData();
        form.append('file', blob, 'frame.jpg');
        form.append('session_id', sessionId);
        form.append('device_id', deviceId);

        try {
          const response = await fetch(`${VISION_API_URL}/api/v1/vision/analyze`, {
            method: 'POST',
            body: form
          });
          if (!response.ok) {
            throw new Error(`Vision API respondeu ${response.status}`);
          }
          resolve(await response.json());
        } catch (error) {
          reject(error);
        }
      }, 'image/jpeg', 0.72);
    });
  },
  async getEventHistory(deviceId: string): Promise<VisionEventHistoryItem[]> {
    const response = await fetch(
      `http://localhost:8080/api/v1/vision/events?deviceId=${encodeURIComponent(deviceId)}`
    );
    if (!response.ok) throw new Error(`Histórico respondeu ${response.status}`);
    return response.json();
  },

  async reviewEvent(
    eventId: string,
    decision: 'FALSE_POSITIVE' | 'CANCELED'
  ): Promise<VisionEventHistoryItem> {
    const query = new URLSearchParams({ decision, reviewedBy: 'Familiar' });
    const response = await fetch(
      `http://localhost:8080/api/v1/vision/events/${encodeURIComponent(eventId)}/review?${query}`,
      { method: 'PATCH' }
    );
    if (!response.ok) throw new Error(`Revisão respondeu ${response.status}`);
    return response.json();
  }
};
