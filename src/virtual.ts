import type {ComposerModule} from './discovery';

export interface VirtualModuleOptions {
  modules: ComposerModule[];
  appPagesPath: string;
  extensions: string[];
}

export function generateVirtualModule(options: VirtualModuleOptions): string {
  const {modules, appPagesPath, extensions} = options;

  const extGlob = extensions.length === 1 ? extensions[0] : `{${extensions.join(',')}}`;

  const entries = modules
    .map(
      (m) => `    '${m.name}': {
      base: '${m.webPath}/${m.pagesPath}',
      pages: import.meta.glob('${m.webPath}/${m.pagesPath}/**/*.${extGlob}'),
    }`,
    )
    .join(',\n');

  return `
import {createResolver} from 'vite-plugin-inertia-modules/runtime';

export const modules = ${JSON.stringify(modules.map((m) => m.name))};

export const resolvePage = createResolver({
  extensions: ${JSON.stringify(extensions)},
  appBase: '${appPagesPath}',
  appPages: import.meta.glob('${appPagesPath}/**/*.${extGlob}'),
  moduleMap: {${entries}},
});
`;
}
