import { describe, expect, it } from 'vitest';
import { generateVirtualModule } from '../src/virtual';
import type { ComposerModule } from '../src';

const payments: ComposerModule = {
  package: 'baconfy/payments',
  name: 'payments',
  webPath: '/vendor/baconfy/payments',
  realPath: '/tmp/whatever',
  pagesPath: 'resources/js/pages',
};

type GlobMap = Record<string, Record<string, () => unknown>>;

function run(code: string, globs: GlobMap) {
  const executable = code
    .replace(/import\.meta\.glob\('([^']+)'\)/g, '__globs[`$1`] ?? {}')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ');

  const factory = new Function('__globs', `${executable}\nreturn { modules, resolvePage };`);

  return factory(globs) as {
    modules: string[];
    resolvePage: (name: string) => unknown;
  };
}

function generate(modules: ComposerModule[] = [payments], extensions = ['tsx', 'jsx']) {
  return generateVirtualModule({ modules, appPagesPath: '/resources/js/pages', extensions });
}

describe('generateVirtualModule', () => {
  it('uses brace expansion for multiple extensions and none for a single one', () => {
    expect(generate()).toContain('*.{tsx,jsx}');

    const single = generate([payments], ['vue']);

    expect(single).toContain('*.vue');
    expect(single).not.toContain('*.{');
  });

  it('exports the list of module names', () => {
    const { modules } = run(generate(), {});

    expect(modules).toEqual(['payments']);
  });

  it('resolves app pages without a namespace', () => {
    const loaded: string[] = [];
    const { resolvePage } = run(generate(), {
      '/resources/js/pages/**/*.{tsx,jsx}': {
        '/resources/js/pages/Dashboard.tsx': () => loaded.push('dashboard'),
      },
    });

    resolvePage('Dashboard');

    expect(loaded).toEqual(['dashboard']);
  });

  it('resolves module pages through the namespace', () => {
    const loaded: string[] = [];
    const { resolvePage } = run(generate(), {
      '/vendor/baconfy/payments/resources/js/pages/**/*.{tsx,jsx}': {
        '/vendor/baconfy/payments/resources/js/pages/Invoices/Index.tsx': () =>
          loaded.push('invoices'),
      },
    });

    resolvePage('payments::Invoices/Index');

    expect(loaded).toEqual(['invoices']);
  });

  it('falls back through extensions in order', () => {
    const loaded: string[] = [];
    const { resolvePage } = run(generate(), {
      '/resources/js/pages/**/*.{tsx,jsx}': {
        '/resources/js/pages/Legacy.jsx': () => loaded.push('legacy-jsx'),
      },
    });

    resolvePage('Legacy');

    expect(loaded).toEqual(['legacy-jsx']);
  });

  it('throws a helpful error for an unknown module', () => {
    const { resolvePage } = run(generate(), {});

    expect(() => resolvePage('billing::Index')).toThrowError(/Unknown module: "billing"/);
    expect(() => resolvePage('billing::Index')).toThrowError(/Installed: payments/);
  });

  it('throws a helpful error for a missing page', () => {
    const { resolvePage } = run(generate(), {});

    expect(() => resolvePage('payments::Nope')).toThrowError(/Page not found/);
  });
});