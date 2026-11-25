export interface OcrProgressUpdate {
  status: string;
  progressPct: number;
}

interface TesseractWorkerLike {
  recognize: (image: File | Blob | string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
}

interface TesseractGlobal {
  createWorker: (
    langs: string,
    oem?: number,
    options?: {
      logger?: (msg: { status?: string; progress?: number }) => void;
    }
  ) => Promise<TesseractWorkerLike>;
}

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

const TESSERACT_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js',
];

let loadPromise: Promise<TesseractGlobal> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && window.Tesseract) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureTesseractLoaded(): Promise<TesseractGlobal> {
  if (window.Tesseract) {
    return window.Tesseract;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      let lastErr: Error | null = null;
      for (const url of TESSERACT_CDN_URLS) {
        try {
          await loadScript(url);
          if (window.Tesseract) {
            return window.Tesseract;
          }
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
        }
      }
      loadPromise = null;
      throw lastErr || new Error('No se pudo cargar Tesseract.js desde el CDN.');
    })();
  }
  return loadPromise;
}

function translateOcrStatus(rawStatus: string): string {
  const s = rawStatus.toLowerCase();
  if (s.includes('loading tesseract')) return 'Cargando motor OCR...';
  if (s.includes('initializing')) return 'Inicializando idioma español...';
  if (s.includes('loading language')) return 'Descargando diccionario español (spa)...';
  if (s.includes('recognizing text')) return 'Extrayendo direcciones de la imagen...';
  return 'Procesando imagen...';
}

/**
 * Extracts Spanish text from an image file or clipboard Blob using Tesseract.js via CDN.
 */
export async function extractTextFromImageOcr(
  imageFile: File | Blob,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<string> {
  onProgress?.({ status: 'Cargando motor OCR...', progressPct: 5 });
  const Tesseract = await ensureTesseractLoaded();

  const worker = await Tesseract.createWorker('spa', 1, {
    logger: (msg) => {
      const statusText = translateOcrStatus(msg.status || '');
      const pct =
        typeof msg.progress === 'number'
          ? Math.max(5, Math.min(99, Math.round(msg.progress * 100)))
          : 15;
      onProgress?.({ status: statusText, progressPct: pct });
    },
  });

  try {
    const result = await worker.recognize(imageFile);
    onProgress?.({ status: 'Lectura completada', progressPct: 100 });
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}
