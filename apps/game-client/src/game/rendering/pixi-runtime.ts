import type { Application } from 'pixi.js';

export interface PixiRuntime {
  app: Application;
  syncResolution(): boolean;
  destroy(): void;
}

export const MAX_RENDERER_RESOLUTION = 2;

export function currentRendererResolution(devicePixelRatio = window.devicePixelRatio): number {
  return Math.max(1, Math.min(devicePixelRatio || 1, MAX_RENDERER_RESOLUTION));
}

export async function createPixiRuntime(container: HTMLDivElement): Promise<PixiRuntime> {
  const { Application: PixiApplication } = await import('pixi.js');
  const app = new PixiApplication();

  await app.init({
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    resolution: currentRendererResolution(),
  });
  app.canvas.className = 'kingdom-canvas';
  container.appendChild(app.canvas);

  const syncResolution = (): boolean => {
    const resolution = currentRendererResolution();
    if (Math.abs(app.renderer.resolution - resolution) < .001) return false;
    app.renderer.resolution = resolution;
    app.renderer.resize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    return true;
  };
  const onWindowResize = (): void => { syncResolution(); };
  const resolutionMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const onResolutionChange = (): void => { syncResolution(); };
  window.addEventListener('resize', onWindowResize);
  resolutionMedia.addEventListener('change', onResolutionChange);

  return {
    app,
    syncResolution,
    destroy: () => {
      window.removeEventListener('resize', onWindowResize);
      resolutionMedia.removeEventListener('change', onResolutionChange);
      app.stop();
      app.destroy(true, { children: true });
    },
  };
}
