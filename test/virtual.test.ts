import { describe, expect, it } from 'vitest';
import { generateVirtualModule } from '../src/virtual';
import type { ComposerModule } from '../src/discovery';

const payments: ComposerModule = {
  package: 'baconfy/payments',
  name: 'payments',
  webPath: '/vendor/baconfy/payments',
  realPath: '/tmp/whatever',
  pagesPath: 'resources/js/pages',
};

describe('generateVirtualModule', () => {
  it('imports the runtime resolver from the package', () => {
    const code = generateVirtualModule({
      modules: [payments],
      appPagesPath: '/resources/js/pages',
      extensions: ['tsx'],
    });

    expect(code).toContain("from 'vite-plugin-inertia-modules/runtime'");
    expect(code).toContain('createResolver({');
  });

  it('generates literal glob patterns for app and module pages', () => {
    const code = generateVirtualModule({
      modules: [payments],
      appPagesPath: '/resources/js/pages',
      extensions: ['tsx', 'jsx'],
    });

    expect(code).toContain("import.meta.glob('/resources/js/pages/**/*.{tsx,jsx}')");
    expect(code).toContain(
      "import.meta.glob('/vendor/baconfy/payments/resources/js/pages/**/*.{tsx,jsx}')",
    );
  });

  it('uses no brace expansion for a single extension', () => {
    const code = generateVirtualModule({
      modules: [payments],
      appPagesPath: '/resources/js/pages',
      extensions: ['vue'],
    });

    expect(code).toContain('*.vue');
    expect(code).not.toContain('*.{');
  });

  it('exports the list of module names', () => {
    const code = generateVirtualModule({
      modules: [payments],
      appPagesPath: '/resources/js/pages',
      extensions: ['tsx'],
    });

    expect(code).toContain(`export const modules = ["payments"]`);
  });
});