import {describe, expect, it} from 'vitest';
import {createResolver} from '../src/runtime';

function makeResolver(overrides = {}) {
  return createResolver({
    extensions: ['tsx', 'jsx'],
    appBase: '/resources/js/pages',
    appPages: {},
    moduleMap: {},
    ...overrides,
  });
}

describe('createResolver', () => {
  it('resolves app pages without a namespace', async () => {
    const resolvePage = makeResolver({
      appPages: {'/resources/js/pages/Dashboard.tsx': async () => 'dashboard'},
    });

    await expect(resolvePage('Dashboard')).resolves.toBe('dashboard');
  });

  it('resolves module pages through the namespace', async () => {
    const resolvePage = makeResolver({
      moduleMap: {
        payments: {
          base: '/vendor/acme/payments/resources/js/pages',
          pages: {
            '/vendor/acme/payments/resources/js/pages/Invoices/Index.tsx':
              async () => 'invoices',
          },
        },
      },
    });

    await expect(resolvePage('payments::Invoices/Index')).resolves.toBe('invoices');
  });

  it('falls back through extensions in order', async () => {
    const resolvePage = makeResolver({
      appPages: {'/resources/js/pages/Legacy.jsx': async () => 'legacy'},
    });

    await expect(resolvePage('Legacy')).resolves.toBe('legacy');
  });

  it('throws a helpful error for an unknown module', () => {
    const resolvePage = makeResolver({
      moduleMap: {payments: {base: '/x', pages: {}}},
    });

    expect(() => resolvePage('billing::Index')).toThrowError(/Unknown module: "billing"/);
    expect(() => resolvePage('billing::Index')).toThrowError(/Installed: payments/);
  });

  it('throws a helpful error for a missing page', () => {
    const resolvePage = makeResolver();

    expect(() => resolvePage('Nope')).toThrowError(/Page not found/);
  });
});