import type { Application } from 'pixi.js';

export interface PixiRuntime {
  app: Application;
  destroy(): void;
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
    resolution: Math.min(window.devicePixelRatio, 2),
  });
  app.canvas.className = 'kingdom-canvas';
  container.appendChild(app.canvas);

  return {
    app,
    destroy: () => app.destroy(true, { children: true }),
  };
}
