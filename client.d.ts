declare module 'virtual:inertia-modules' {
  export const modules: string[];

  export function resolvePage(name: string): Promise<{ default: unknown }>;
}