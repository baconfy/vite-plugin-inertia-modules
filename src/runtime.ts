export type PageLoader = () => Promise<any>;
export type PageGlob = Record<string, PageLoader>;

export interface ModuleEntry {
  base: string;
  pages: PageGlob;
}

export interface ResolverConfig {
  extensions: string[];
  appBase: string;
  appPages: PageGlob;
  moduleMap: Record<string, ModuleEntry>;
}

export function createResolver(config: ResolverConfig) {
  const {extensions, appBase, appPages, moduleMap} = config;

  const load = (pages: PageGlob, base: string, page: string, label: string) => {
    for (const ext of extensions) {
      const loader = pages[`${base}/${page}.${ext}`];

      if (loader) {
        return loader();
      }
    }

    throw new Error(
      `[inertia-modules] Page not found: "${label}" ` +
      `(looked in ${base}/${page}.{${extensions.join(',')}})`,
    );
  };

  return function resolvePage<T = any>(name: string): Promise<T> {
    if (name.includes('::')) {
      const [moduleName, page] = name.split('::');
      const mod = moduleMap[moduleName];

      if (!mod) {
        const installed = Object.keys(moduleMap).join(', ') || 'none';

        throw new Error(
          `[inertia-modules] Unknown module: "${moduleName}". Installed: ${installed}`,
        );
      }

      return load(mod.pages, mod.base, page, name) as Promise<T>;
    }

    return load(appPages, appBase, name, name) as Promise<T>;
  };
}