import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {discoverModules} from '../src/discovery';

let root: string;

function makeRoot(): string {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'inertia-modules-'));
  return root;
}

function writeInstalled(packages: unknown[]): void {
  const dir = path.join(root, 'vendor', 'composer');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'installed.json'), JSON.stringify({packages}));
}

function makePackage(vendorPath: string): void {
  fs.mkdirSync(path.join(root, vendorPath), {recursive: true});
}

function discover(manifestKey = 'inertia-modules') {
  return discoverModules({root, manifestKey, defaultPagesPath: 'resources/js/pages'});
}

afterEach(() => {
  if (root) fs.rmSync(root, {recursive: true, force: true});
});

describe('discoverModules', () => {
  it('returns empty when installed.json does not exist', () => {
    makeRoot();

    expect(discover()).toEqual([]);
  });

  it('returns empty when installed.json is invalid JSON', () => {
    makeRoot();
    const dir = path.join(root, 'vendor', 'composer');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'installed.json'), '{nope');

    expect(discover()).toEqual([]);
  });

  it('discovers a package that declares the manifest key', () => {
    makeRoot();
    makePackage('vendor/baconfy/payments');
    writeInstalled([
      {
        name: 'baconfy/payments',
        'install-path': '../baconfy/payments',
        extra: {'inertia-modules': {module: 'payments'}},
      },
    ]);

    const modules = discover();

    expect(modules).toHaveLength(1);
    expect(modules[0]).toMatchObject({
      package: 'baconfy/payments',
      name: 'payments',
      webPath: '/vendor/baconfy/payments',
      pagesPath: 'resources/js/pages',
    });
  });

  it('ignores packages without the manifest key', () => {
    makeRoot();
    makePackage('vendor/laravel/framework');
    writeInstalled([
      {name: 'laravel/framework', 'install-path': '../laravel/framework', extra: {}},
    ]);

    expect(discover()).toEqual([]);
  });

  it('ignores manifest entries without a module name', () => {
    makeRoot();
    makePackage('vendor/acme/broken');
    writeInstalled([
      {
        name: 'acme/broken',
        'install-path': '../acme/broken',
        extra: {'inertia-modules': {pages: 'resources/js/pages'}},
      },
    ]);

    expect(discover()).toEqual([]);
  });

  it('ignores packages whose install path does not exist on disk', () => {
    makeRoot();
    writeInstalled([
      {
        name: 'acme/ghost',
        'install-path': '../acme/ghost',
        extra: {'inertia-modules': {module: 'ghost'}},
      },
    ]);

    expect(discover()).toEqual([]);
  });

  it('respects a custom pages path from the manifest', () => {
    makeRoot();
    makePackage('vendor/acme/custom');
    writeInstalled([
      {
        name: 'acme/custom',
        'install-path': '../acme/custom',
        extra: {'inertia-modules': {module: 'custom', pages: 'frontend/pages'}},
      },
    ]);

    expect(discover()[0].pagesPath).toBe('frontend/pages');
  });

  it('respects a custom manifest key', () => {
    makeRoot();
    makePackage('vendor/baconfy/auth');
    writeInstalled([
      {
        name: 'baconfy/auth',
        'install-path': '../baconfy/auth',
        extra: {baconfy: {module: 'auth'}},
      },
    ]);

    expect(discover('baconfy')).toHaveLength(1);
    expect(discover()).toEqual([]);
  });

  it('resolves symlinked packages to their real path', () => {
    makeRoot();
    const real = path.join(root, 'packages', 'payments');
    fs.mkdirSync(real, {recursive: true});
    fs.mkdirSync(path.join(root, 'vendor', 'baconfy'), {recursive: true});
    fs.symlinkSync(real, path.join(root, 'vendor', 'baconfy', 'payments'));
    writeInstalled([
      {
        name: 'baconfy/payments',
        'install-path': '../baconfy/payments',
        extra: {'inertia-modules': {module: 'payments'}},
      },
    ]);

    const [module] = discover();

    expect(module.webPath).toBe('/vendor/baconfy/payments');
    expect(module.realPath).toBe(fs.realpathSync(real));
  });
});