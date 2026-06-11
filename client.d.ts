declare module 'virtual:inertia-modules' {
  export const modules: string[];

  export function resolvePage<T = any>(name: string): Promise<T>;
}