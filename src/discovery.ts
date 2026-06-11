import fs from 'node:fs';
import path from 'node:path';

export interface ComposerModule {
  package: string;
  name: string;
  webPath: string;
  realPath: string;
  pagesPath: string;
}

export interface DiscoverOptions {
  root: string;
  manifestKey: string;
  defaultPagesPath: string;
}

export function discoverModules(options: DiscoverOptions): ComposerModule[] {
  const {root, manifestKey, defaultPagesPath} = options;
  const installedJson = path.join(root, 'vendor', 'composer', 'installed.json');

  if (!fs.existsSync(installedJson)) {
    return [];
  }

  let installed: { packages?: unknown[] };

  try {
    installed = JSON.parse(fs.readFileSync(installedJson, 'utf8'));
  } catch {
    return [];
  }

  const modules: ComposerModule[] = [];

  for (const pkg of (installed.packages ?? []) as Record<string, any>[]) {
    const meta = pkg.extra?.[manifestKey];
    const installPath = pkg['install-path'];

    if (!meta?.module || !installPath) {
      continue;
    }

    const absolute = path.resolve(root, 'vendor', 'composer', installPath);

    if (!fs.existsSync(absolute)) {
      continue;
    }

    modules.push({
      package: pkg.name,
      name: meta.module,
      webPath: '/' + path.relative(root, absolute).split(path.sep).join('/'),
      realPath: fs.realpathSync(absolute),
      pagesPath: meta.pages ?? defaultPagesPath,
    });
  }

  return modules;
}