import fixtureUrl from '../../src/assets/images/hero_timing_belt_studio_1794523125679.jpg?url';
import { segmentImageWithClientAi } from '../../src/utils/clientAiSegmentation';

type VisionSmokeResult = {
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  foregroundPixels?: number;
  region?: { x: number; y: number; width: number; height: number } | null;
};

declare global {
  interface Window {
    __visionSmokeResult?: VisionSmokeResult;
  }
}

void (async () => {
  const status = document.getElementById('status');
  try {
    const result = await segmentImageWithClientAi(fixtureUrl);
    const region = result?.regions[0] || null;
    const foregroundPixels = result?.foregroundPixels || 0;
    const ok = Boolean(
      result &&
      region &&
      foregroundPixels > result.width * result.height * 0.004 &&
      region.width > 0.025 &&
      region.height > 0.025 &&
      region.width * region.height < 0.96
    );
    window.__visionSmokeResult = {
      ok,
      width: result?.width,
      height: result?.height,
      foregroundPixels,
      region,
      ...(ok ? {} : { error: 'U2NETP did not return a conservative foreground region for the local industrial photo' }),
    };
    if (status) status.textContent = ok ? 'Local segmentation ready' : 'Local segmentation failed';
  } catch (error) {
    window.__visionSmokeResult = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    if (status) status.textContent = 'Local segmentation failed';
  }
})();
