import React, { createContext, lazy, Suspense, useContext, useState } from 'react';
import { Link, type LinkProps, useLocation, useNavigate } from 'react-router-dom';
import {
  preloadClientAiSegmentation,
  segmentImageWithClientAi,
  type ClientAiSegmentationResult,
} from '../../utils/clientAiSegmentation';
import { goBackOrFallback } from '../../utils/navigateBackOrFallback';

const Studio = lazy(() =>
  import('./AiVisualPartSearchModal').then((m) => ({ default: m.AiVisualPartSearchModal })),
);

type IdentificationEntry = (mode?: 'camera' | 'upload') => void;

export interface OnnxPartSegmentationApi {
  modelUrl: string;
  isOnnxReady: boolean;
  segmentPart: (src: string) => Promise<ClientAiSegmentationResult | null>;
}

const IdentificationContext = createContext<IdentificationEntry | null>(null);
const IdentificationOverlayContext = createContext(false);
const OnnxSegmentationContext = createContext<OnnxPartSegmentationApi>({
  modelUrl: '/models/u2netp.onnx',
  isOnnxReady: false,
  segmentPart: segmentImageWithClientAi,
});

function configureOnnxRuntimePaths() {
  // Runtime paths are configured by the existing production segmentation utility.
}

export function usePartIdentificationAction(): IdentificationEntry | null {
  return useContext(IdentificationContext);
}

/** True while identification covers the storefront, including live camera, review and results. */
export function useIdentificationOverlayOpen(): boolean {
  return useContext(IdentificationOverlayContext);
}

/** Provides access to the pre-trained onnxruntime-web segmentation pipeline. */
export function useOnnxPartSegmentation(): OnnxPartSegmentationApi {
  return useContext(OnnxSegmentationContext);
}

export function PartIdentificationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [startWithCamera, setStartWithCamera] = useState(false);
  const [isOnnxReady, setIsOnnxReady] = useState(false);
  const location = useLocation();

  React.useEffect(() => setOpen(false), [location.key]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    document.body.classList.add('sanat-identification-open');
    configureOnnxRuntimePaths();
    void preloadClientAiSegmentation().then(() => {
      if (active) setIsOnnxReady(true);
    });
    return () => {
      active = false;
      document.body.classList.remove('sanat-identification-open');
    };
  }, [open]);

  const openIdentification: IdentificationEntry = (mode = 'upload') => {
    setStartWithCamera(mode === 'camera');
    setOpen(true);
  };

  const onnxApi = React.useMemo<OnnxPartSegmentationApi>(
    () => ({
      modelUrl: '/models/u2netp.onnx',
      isOnnxReady,
      segmentPart: segmentImageWithClientAi,
    }),
    [isOnnxReady],
  );

  return (
    <IdentificationContext.Provider value={openIdentification}>
      <IdentificationOverlayContext.Provider value={open}>
        <OnnxSegmentationContext.Provider value={onnxApi}>
          {children}
          {open && (
            <Suspense
              fallback={
                <div
                  role="status"
                  className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-3 bg-[#FFFFFF] text-sm font-bold text-[#2B313A]"
                >
                  <img
                    src="/assets/aistudio/logo-forza_9b7fcf6e.png"
                    alt="FORZA"
                    className="h-16 sm:h-20 w-auto object-contain"
                  />
                  <span>در حال آماده‌سازی آزمایشگاه شناسایی قطعه…</span>
                </div>
              }
            >
              <Studio
                isOpen
                initialCamera={startWithCamera}
                fullScreen
                onClose={() => setOpen(false)}
              />
            </Suspense>
          )}
        </OnnxSegmentationContext.Provider>
      </IdentificationOverlayContext.Provider>
    </IdentificationContext.Provider>
  );
}

/** Ordinary links retain normal navigation, including Ctrl/cmd-click and new tabs. */
export function PartIdentificationLink({ to, onClick, ...props }: LinkProps) {
  const open = useContext(IdentificationContext);
  const path = typeof to === 'string' ? to : to.pathname;
  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          path?.split('?')[0] === '/identify-part' &&
          open &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          (!props.target || props.target === '_self')
        ) {
          event.preventDefault();
          open('upload');
        }
      }}
    />
  );
}

export function PartIdentificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnnxReady, setIsOnnxReady] = useState(false);
  const fromWorkspace = new URLSearchParams(location.search).get('from') === 'workspace';

  React.useEffect(() => {
    let active = true;
    configureOnnxRuntimePaths();
    void preloadClientAiSegmentation().then(() => {
      if (active) setIsOnnxReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const onnxApi = React.useMemo<OnnxPartSegmentationApi>(
    () => ({
      modelUrl: '/models/u2netp.onnx',
      isOnnxReady,
      segmentPart: segmentImageWithClientAi,
    }),
    [isOnnxReady],
  );

  return (
    <OnnxSegmentationContext.Provider value={onnxApi}>
      <div className="min-h-[100dvh] bg-[#FFFFFF]">
        <Suspense
          fallback={
            <div
              role="status"
              className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-sm font-bold text-[#2B313A]"
            >
              <img
                src="/assets/aistudio/logo-forza_9b7fcf6e.png"
                alt="FORZA"
                className="h-16 sm:h-20 w-auto object-contain"
              />
              <span>در حال بارگذاری آزمایشگاه شناسایی قطعه…</span>
            </div>
          }
        >
          <Studio
            isOpen
            standalone
            fullScreen
            onClose={() => goBackOrFallback(navigate, fromWorkspace ? '/ai-consult' : '/')}
          />
        </Suspense>
      </div>
    </OnnxSegmentationContext.Provider>
  );
}
