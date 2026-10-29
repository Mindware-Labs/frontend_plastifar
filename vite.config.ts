import path from 'node:path'
import { transformAsync, type PluginObj } from '@babel/core'
import locatorModule from '@locator/babel-jsx/dist/index.js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
/** La CSP del index.html es para produccion: en desarrollo bloquearia el preámbulo inline de React Refresh y el HMR. */
const stripCspInDev = {
  name: "plf-strip-csp-in-dev",
  apply: "serve" as const,
  transformIndexHtml(html: string) {
    return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>\s*/i, "");
  },
};

// Paquete CommonJS: al cargar la config, el import por defecto llega como el módulo entero.
type LocatorPlugin = (babel: unknown) => { visitor?: { Program?: unknown } };
const locatorJsx = ((locatorModule as unknown as { default?: LocatorPlugin }).default ??
  locatorModule) as LocatorPlugin;

type LocatorState = { filename: string; cwd: string };
type LocatorStep = (path: unknown, state: LocatorState) => void;

/**
 * El plugin de LocatorJS copia la ruta del archivo dentro de un string sin escaparla: en Windows
 * "src\components\ui" lleva "\u" y Babel no lo parsea. Se le entrega la ruta con "/".
 */
function locatorWithPosixPaths(babel: unknown): PluginObj {
  const { enter, exit } = (locatorJsx(babel).visitor ?? {}).Program as { enter: LocatorStep; exit: LocatorStep };
  const toPosix = (state: LocatorState) => {
    state.filename = state.filename.replace(/\\/g, "/");
    state.cwd = state.cwd.replace(/\\/g, "/");
  };
  return {
    visitor: {
      Program: {
        enter(path, state) {
          toPosix(state as unknown as LocatorState);
          enter(path, state as unknown as LocatorState);
        },
        exit(path, state) {
          toPosix(state as unknown as LocatorState);
          exit(path, state as unknown as LocatorState);
        },
      },
    },
  };
}

/** LocatorJS: marca cada JSX con su archivo y línea para saltar al código con Alt+clic. Solo en desarrollo. */
const locatorInDev = {
  name: "plf-locatorjs",
  apply: "serve" as const,
  enforce: "pre" as const,
  async transform(code: string, id: string) {
    const file = id.split("?")[0];
    if (!file.endsWith(".tsx") || file.includes("/node_modules/")) return null;
    const result = await transformAsync(code, {
      filename: file,
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ["jsx", "typescript"] },
      plugins: [[locatorWithPosixPaths, { env: "development" }]],
      sourceMaps: true,
    });
    return result?.code ? { code: result.code, map: result.map } : null;
  },
};

export default defineConfig({
  plugins: [locatorInDev, react(), tailwindcss(), stripCspInDev],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
})
