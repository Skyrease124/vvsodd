// SkyData Editor cutouts: finds the person in a photo, on the device, with Google MediaPipe's multiclass selfie
// segmentation model (public/editor-engine/cutout, Apache-2.0; see NOTICE.md there). It runs on the page because
// MediaPipe needs WebGL, which iPhone Safari offers on the page more reliably than in a worker. The result is a
// small mask that travels with the edit step, so the engine worker can apply it at any size without running the
// model again (undo, full-size download, reopening from My Files).
export type CutoutRegion = 'background' | 'person' | 'hair' | 'face' | 'skin' | 'clothes';
// `coverage`: share of the picture the model is confident is this region (probability above 0.8).
export type CutoutMask = { width: number; height: number; data: Uint8Array; coverage: number };
export const CUTOUT_REGIONS: CutoutRegion[] = ['background', 'person', 'hair', 'face', 'skin', 'clothes'];

const BASE = '/editor-engine/cutout';
// Model classes: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 others (accessories).
const CLASSES: Record<CutoutRegion, number[]> = { background: [0], person: [1, 2, 3, 4, 5], hair: [1], face: [3], skin: [2, 3], clothes: [4] };
const MAX_SIDE = 1024;

type Mask = { width: number; height: number; getAsFloat32Array(): Float32Array };
type Segmenter = { segment(image: ImageBitmap | HTMLCanvasElement): { confidenceMasks?: Mask[]; close?: () => void }; close(): void };
let segmenter: Promise<Segmenter> | null = null;

function load(): Promise<Segmenter> {
  segmenter ??= (async () => {
    const vision = await import(/* @vite-ignore */ `${BASE}/vision_bundle.js`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    return vision.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${BASE}/selfie_multiclass_256x256.tflite`, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }) as Promise<Segmenter>;
  })().catch((e) => {
    segmenter = null;
    throw new Error('The cutout tool could not start in this browser (' + ((e as Error).message || 'unknown error') + ').');
  });
  return segmenter;
}

/** Frees the model's memory (call when the Editor closes). */
export async function closeCutout() {
  const s = segmenter;
  segmenter = null;
  if (s) (await s.catch(() => null))?.close();
}

const smooth = (p: number) => {
  // Firms up the model's soft edge without losing hair detail.
  const t = Math.min(1, Math.max(0, (p - 0.3) / 0.4));
  return t * t * (3 - 2 * t);
};

/** The mask for one region of `image` (a photo blob), at most 1024 px on its longer side. */
export async function cutoutMask(image: Blob, region: CutoutRegion): Promise<CutoutMask> {
  const seg = await load();
  const bitmap = await createImageBitmap(image);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const g = canvas.getContext('2d')!;
  // A see-through photo (after a background removal) is judged on white.
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const result = seg.segment(canvas);
  try {
    const masks = result.confidenceMasks ?? [];
    if (masks.length < 6) throw new Error('The cutout tool returned no result.');
    const { width, height } = masks[0];
    const probs = CLASSES[region].map((c) => masks[c].getAsFloat32Array());
    const data = new Uint8Array(width * height);
    let sure = 0;
    for (let i = 0; i < data.length; i++) {
      let p = 0;
      for (const q of probs) p += q[i];
      data[i] = Math.round(smooth(Math.min(1, p)) * 255);
      if (p > 0.8) sure++;
    }
    return { width, height, data, coverage: sure / data.length };
  } finally {
    result.close?.();
    canvas.width = canvas.height = 0;
  }
}
