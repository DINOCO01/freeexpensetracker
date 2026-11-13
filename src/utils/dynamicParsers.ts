/**
 * dynamicParsers.ts
 * Group 5: On-demand dynamic loader & cache for heavy parsing libraries:
 * - xlsx (SheetJS)
 * - pdfjs-dist
 * - tesseract.js
 * - heic2any
 *
 * Implements resilient caching with rejection eviction for safe retries.
 */

let xlsxPromise: Promise<any> | null = null;
export async function getXLSX(): Promise<any> {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx')
      .then((mod) => (mod && mod.read ? mod : (mod && mod.default ? mod.default : mod)))
      .catch((err) => {
        xlsxPromise = null; // Evict failed promise to allow retry
        throw err;
      });
  }
  return xlsxPromise;
}

let pdfJsPromise: Promise<any> | null = null;
export async function getPdfJs(): Promise<any> {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .catch(() => import('pdfjs-dist'))
      .then((pdfjsMod: any) => {
        const lib = pdfjsMod && pdfjsMod.getDocument ? pdfjsMod : (pdfjsMod && pdfjsMod.default ? pdfjsMod.default : pdfjsMod);
        if (typeof window !== 'undefined' && lib && lib.GlobalWorkerOptions) {
          try {
            lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          } catch {
            lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version || '6.3.289'}/build/pdf.worker.min.mjs`;
          }
        }
        return lib;
      })
      .catch((err) => {
        pdfJsPromise = null; // Evict failed promise to allow retry
        throw err;
      });
  }
  return pdfJsPromise;
}

let tesseractPromise: Promise<any> | null = null;
export async function getTesseract(): Promise<any> {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js')
      .then((mod) => (mod && mod.recognize ? mod : (mod && mod.default ? mod.default : mod)))
      .catch((err) => {
        tesseractPromise = null; // Evict failed promise to allow retry
        throw err;
      });
  }
  return tesseractPromise;
}

let heicPromise: Promise<any> | null = null;
export async function getHeicConverter(): Promise<any> {
  if (!heicPromise) {
    heicPromise = (async () => {
      if (typeof window !== 'undefined' && (window as any).heic2any) {
        return (window as any).heic2any;
      }
      try {
        const mod = await import(/* @vite-ignore */ 'heic2any');
        return mod.default || mod;
      } catch {
        if (typeof window === 'undefined') {
          throw new Error('HEIC conversion only supported in browser environments.');
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js';
          script.async = true;
          script.onload = () => {
            if ((window as any).heic2any) {
              resolve((window as any).heic2any);
            } else {
              reject(new Error('heic2any failed to initialize.'));
            }
          };
          script.onerror = () => reject(new Error('Failed to load heic2any converter script.'));
          document.head.appendChild(script);
        });
      }
    })().catch((err) => {
      heicPromise = null; // Evict failed promise to allow retry
      throw err;
    });
  }
  return heicPromise;
}

