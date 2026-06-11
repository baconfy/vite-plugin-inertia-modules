import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Plugin} from 'vite';
import {type ComposerModule, discoverModules} from './discovery';
import {generateVirtualModule} from './virtual';

export type {ComposerModule} from './discovery';

export interface InertiaModulesOptions {
  manifestKey?: string;
  appPages?: string;
  pages?: string;
  extensions?: string[];
  virtualId?: string;
}

const RUNTIME_ID = 'vite-plugin-inertia-modules/runtime';

function runtimeFile(): string {
  return fileURLToPath(new URL('./runtime.js', import.meta.url));
}

interface PathMapper {
  isInsideVendor: (file: string) => boolean;
  toVendor: (file: string) => string | null;
}

function createPathMapper(root: string, modules: ComposerModule[]): PathMapper {
  const linked = modules
    .map((m) => ({vendor: path.join(root, m.webPath), real: m.realPath}))
    .filter((m) => m.vendor !== m.real);

  const clean = (file: string) => file.split('?')[0];

  return {
    isInsideVendor: (file) => {
      const f = clean(file);
      return linked.some((m) => f === m.vendor || f.startsWith(m.vendor + path.sep));
    },

    toVendor: (file) => {
      const f = clean(file);

      for (const m of linked) {
        if (f === m.real || f.startsWith(m.real + path.sep)) {
          return m.vendor + f.slice(m.real.length);
        }
      }

      return null;
    },
  };
}

export function inertiaModules(options: InertiaModulesOptions = {}): Plugin {
  const manifestKey = options.manifestKey ?? 'inertia-modules';
  const appPages = options.appPages ?? '/resources/js/pages';
  const pages = options.pages ?? 'resources/js/pages';
  const extensions = options.extensions ?? ['tsx', 'jsx'];
  const virtualId = options.virtualId ?? 'virtual:inertia-modules';
  const resolvedId = '\0' + virtualId;

  let root = process.cwd();
  let modules: ComposerModule[] = [];
  let mapper = createPathMapper(root, modules);

  const discover = () => discoverModules({root, manifestKey, defaultPagesPath: pages});

  return {
    name: 'inertia-modules',

    configResolved(config) {
      root = config.root;
      modules = discover();
      mapper = createPathMapper(root, modules);
    },

    config() {
      const cwd = process.cwd();
      const discovered = discoverModules({root: cwd, manifestKey, defaultPagesPath: pages});
      const hasLinked = discovered.some((m) => path.join(cwd, m.webPath) !== m.realPath);

      return {
        ...(hasLinked ? {resolve: {preserveSymlinks: true}} : {}),

        server: {
          fs: {
            allow: [cwd, ...discovered.map((m) => m.realPath)],
          },
        },
      };
    },

    async resolveId(id, importer, resolveOptions) {
      if (id === virtualId) {
        return resolvedId;
      }

      if (id === RUNTIME_ID) {
        return runtimeFile();
      }

      for (const m of modules) {
        if (id === m.webPath || id.startsWith(m.webPath + '/')) {
          return path.join(root, id);
        }
      }

      if (importer) {
        const vendorImporter = mapper.toVendor(importer) ?? (mapper.isInsideVendor(importer) ? importer : null);

        if (vendorImporter) {
          const resolved = await this.resolve(id, vendorImporter, {
            ...resolveOptions,
            skipSelf: true,
          });

          if (resolved) {
            const remapped = !resolved.external ? mapper.toVendor(resolved.id) : null;

            return remapped ? {...resolved, id: remapped} : resolved;
          }
        }
      }
    },

    load(id) {
      if (id === resolvedId) {
        return generateVirtualModule({modules, appPagesPath: appPages, extensions});
      }
    },

    configureServer(server) {
      const installedJson = path.join(root, 'vendor', 'composer', 'installed.json');

      server.watcher.add(installedJson);

      server.watcher.on('all', (_event, file) => {
        if (path.resolve(file) !== installedJson) return;

        modules = discover();
        mapper = createPathMapper(root, modules);

        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);

        server.ws.send({type: 'full-reload'});
      });
    },
  };
}

export default inertiaModules;
