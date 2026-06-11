import type { ComposerModule } from './discovery';

export interface VirtualModuleOptions {
  modules: ComposerModule[];
  appPagesPath: string;
  extensions: string[];
}

export function generateVirtualModule(options: VirtualModuleOptions): string {
  const { modules, appPagesPath, extensions } = options;

  const extGlob = extensions.length === 1 ? extensions[0] : `{${extensions.join(',')}}`;

  const moduleEntries = modules
    .map(
      (m) => `    '${m.name}': {
        base: '${m.webPath}/${m.pagesPath}',
        pages: import.meta.glob('${m.webPath}/${m.pagesPath}/**/*.${extGlob}'),
    }`,
    )
    .join(',\n');

  return `
const extensions = ${JSON.stringify(extensions)};

const appPages = import.meta.glob('${appPagesPath}/**/*.${extGlob}');

const moduleMap = {
${moduleEntries}
};

export const modules = ${JSON.stringify(modules.map((m) => m.name))};

function load(pages, base, page, label) {
    for (const ext of extensions) {
        const loader = pages[base + '/' + page + '.' + ext];
        if (loader) return loader();
    }
    throw new Error(
        '[inertia-modules] Page not found: "' + label + '" ' +
        '(looked in ' + base + '/' + page + '.{' + extensions.join(',') + '})'
    );
}

export function resolvePage(name) {
    if (name.includes('::')) {
        const [moduleName, page] = name.split('::');
        const mod = moduleMap[moduleName];

        if (!mod) {
            throw new Error(
                '[inertia-modules] Unknown module: "' + moduleName + '". ' +
                'Installed: ' + (modules.join(', ') || 'none')
            );
        }

        return load(mod.pages, mod.base, page, name);
    }

    return load(appPages, '${appPagesPath}', name, name);
}
`;
}