declare module "@babel/core" {
  export function transformAsync(
    code: string,
    opts?: Record<string, unknown>,
  ): Promise<{ code?: string | null; map?: unknown } | null>;
  export type PluginObj = { visitor?: Record<string, unknown> };
}

declare module "@locator/babel-jsx/dist/index.js" {
  const locatorModule: unknown;
  export default locatorModule;
}
