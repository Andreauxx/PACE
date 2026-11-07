// ============================================================
// AgriSweep — Droppings Detector
// Turns a camera snapshot into bounding boxes.
//
// - simulated: no model needed; for demos and testing the trigger
//   rules before a model is trained.
// - roboflow: Roboflow Hosted Inference (object detection). Train
//   a model on photos of the cage floor, then paste its model ID
//   and API key in Settings. Any server that speaks the same
//   request/response format (e.g. a local Python inference
//   server) works by changing the endpoint.
// ============================================================

import { DetectorConfig, Detection } from '../types';

export interface DetectionResult {
  detections: Detection[];
  latencyMs: number;
}

const REQUEST_TIMEOUT_MS = 15000;

export const defaultDetectorConfig: DetectorConfig = {
  provider: 'simulated',
  endpoint: 'https://detect.roboflow.com',
  modelId: '',
  apiKey: '',
  targetClass: 'poop',
};

export function detectorReady(config: DetectorConfig): string | null {
  if (config.provider === 'simulated') return null;
  if (!config.endpoint.trim()) return 'Add the detector endpoint in Settings.';
  if (!/^[\w.-]+\/\d+$/.test(config.modelId.trim())) return 'Model ID must look like project-name/1.';
  if (!config.apiKey.trim()) return 'Add the Roboflow API key in Settings.';
  return null;
}

// ---- Simulated detector ----

let simulatedDirty = false;

/** Lets the station's "simulate droppings" switch drive the fake model. */
export function setSimulatedDroppings(dirty: boolean): void {
  simulatedDirty = dirty;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function simulate(targetClass: string): Detection[] {
  const label = targetClass.trim() || 'poop';
  const count = simulatedDirty ? Math.floor(rand(3, 7)) : Math.random() < 0.3 ? 1 : 0;
  return Array.from({ length: count }, () => {
    const width = rand(0.04, 0.1);
    const height = width * rand(0.7, 1.2);
    return {
      x: rand(0.05, 0.95 - width),
      y: rand(0.1, 0.9 - height),
      width,
      height,
      confidence: simulatedDirty ? rand(0.55, 0.96) : rand(0.2, 0.5),
      label,
    };
  });
}

// ---- Roboflow hosted inference ----

interface RoboflowPrediction {
  x: number; // box centre, pixels
  y: number;
  width: number;
  height: number;
  confidence: number; // 0–1
  class: string;
}

interface RoboflowResponse {
  predictions?: RoboflowPrediction[];
  image?: { width: number; height: number };
  message?: string;
  error?: string;
}

async function roboflow(base64: string, config: DetectorConfig): Promise<Detection[]> {
  const image = base64.replace(/^data:image\/\w+;base64,/, '');
  const url =
    `${config.endpoint.trim().replace(/\/+$/, '')}/${config.modelId.trim()}` +
    `?api_key=${encodeURIComponent(config.apiKey.trim())}&confidence=10&overlap=30&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: image,
      signal: controller.signal,
    });
  } catch {
    throw new Error(controller.signal.aborted ? 'Detector timed out.' : 'Cannot reach the detector. Check the internet connection.');
  } finally {
    clearTimeout(timer);
  }

  let json: RoboflowResponse;
  try {
    json = (await response.json()) as RoboflowResponse;
  } catch {
    throw new Error(`Detector returned HTTP ${response.status} with no JSON.`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Detector rejected the API key.');
    if (response.status === 404) throw new Error('Model not found. Check the model ID and version.');
    throw new Error(json.message ?? json.error ?? `Detector error (HTTP ${response.status}).`);
  }

  const imgW = json.image?.width ?? 0;
  const imgH = json.image?.height ?? 0;
  if (!imgW || !imgH) return [];
  return (json.predictions ?? []).map((p) => ({
    x: (p.x - p.width / 2) / imgW,
    y: (p.y - p.height / 2) / imgH,
    width: p.width / imgW,
    height: p.height / imgH,
    confidence: p.confidence,
    label: p.class,
  }));
}

/** `base64` is only required for real models; the simulated detector ignores it. */
export async function detect(base64: string | null, config: DetectorConfig): Promise<DetectionResult> {
  const started = Date.now();
  if (config.provider === 'simulated') {
    return { detections: simulate(config.targetClass), latencyMs: Date.now() - started };
  }
  if (!base64) throw new Error('Camera did not return an image.');
  const detections = await roboflow(base64, config);
  return { detections, latencyMs: Date.now() - started };
}
