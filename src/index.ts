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

export function inertiaModules(options: InertiaModulesOptions = {}): Plugin {
  const manifestKey = options.manifestKey ?? 'inertia-modules';
  const appPages = options.appPages ?? '/resources/js/pages';
  const pages = options.pages ?? 'resources/js/pages';
  const extensions = options.extensions ?? ['tsx', 'jsx'];
  const virtualId = options.virtualId ?? 'virtual:inertia-modules';
  const resolvedId = '\0' + virtualId;

  let root = process.cwd();
  let modules: ComposerModule[] = [];

  const discover = () => discoverModules({root, manifestKey, defaultPagesPath: pages});

  return {
    name: 'inertia-modules',

    configResolved(config) {
      root = config.root;
      modules = discover();
    },

    config() {
      const discovered = discoverModules({root: process.cwd(), manifestKey, defaultPagesPath: pages});

      return {
        server: {
          fs: {
            allow: [process.cwd(), ...discovered.map((m) => m.realPath)],
          },
        },
      };
    },

    async resolveId(id, importer, options) {
      if (id === virtualId) {
        return resolvedId;
      }

      if (id === RUNTIME_ID) {
        return runtimeFile();
      }

      if (importer && !id.startsWith('.') && !id.startsWith('\0') && !path.isAbsolute(id)) {
        const fromLinkedModule = modules.some((m) => !m.realPath.startsWith(root) && importer.startsWith(m.realPath));

        if (fromLinkedModule) {
          const resolved = await this.resolve(id, path.join(root, 'index.html'), {
            ...options,
            skipSelf: true,
          });

          if (resolved) {
            return resolved;
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

        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);

        server.ws.send({type: 'full-reload'});
      });
    },
  };
}

export default inertiaModules;