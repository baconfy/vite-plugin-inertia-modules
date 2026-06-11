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

    if (!meta?.module || !pkg.name) {
      continue;
    }

    const vendorPath = path.join(root, 'vendor', pkg.name);

    if (!fs.existsSync(vendorPath)) {
      continue;
    }

    modules.push({
      package: pkg.name,
      name: meta.module,
      webPath: '/vendor/' + pkg.name,
      realPath: fs.realpathSync(vendorPath),
      pagesPath: meta.pages ?? defaultPagesPath,
    });
  }

  return modules;
}
