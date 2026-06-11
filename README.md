# vite-plugin-inertia-modules

[![CI](https://github.com/baconfy/vite-plugin-inertia-modules/actions/workflows/ci.yml/badge.svg)](https://github.com/baconfy/vite-plugin-inertia-modules/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vite-plugin-inertia-modules.svg)](https://www.npmjs.com/package/vite-plugin-inertia-modules)
[![license](https://img.shields.io/npm/l/vite-plugin-inertia-modules.svg)](./LICENSE)

> Serve Inertia pages straight from Composer packages.

Build modular Laravel + Inertia applications where each module is a Composer
package that ships its own backend **and** its own pages — discovered,
compiled, and resolved automatically by the host application's Vite.

```php
// In a controller, anywhere:
return Inertia::render('payments::Invoices/Index', ['invoices' => $invoices]);
```

```bash
composer require acme/payments   # pages included. No publishing, no copying.
```

## The problem

Inertia resolves page components inside the host application — there is no
built-in way for a Composer package to ship pages. The usual workarounds all
hurt: publishing stubs means updates never reach the app, and isolated builds
(Nova-style) duplicate the framework runtime and break visual consistency.

This plugin makes Composer packages first-class page providers. Pages live in
the package, are compiled by the host's Vite (one bundle, shared chunks,
normal code splitting), and are addressed with a `module::Page` namespace.

## Installation

```bash
npm install -D vite-plugin-inertia-modules
```

Requires Vite 5+ and an Inertia app (React, Vue, or Svelte — pages must use
the same framework as the host).

## Quick start

**1. Declare the module** in your package's `composer.json`:

```json
{
    "name": "acme/payments",
    "extra": {
        "inertia-modules": {
            "module": "payments",
            "pages": "resources/js/pages"
        }
    }
}
```

**2. Register the plugin** in the host's `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import inertiaModules from 'vite-plugin-inertia-modules';

export default defineConfig({
    plugins: [
        laravel({ input: ['resources/js/app.tsx'], refresh: true }),
        inertiaModules(),
        react(),
    ],
});
```

**3. Use the unified resolver** in `resources/js/app.tsx`:

```ts
import { createInertiaApp } from '@inertiajs/react';
import { resolvePage } from 'virtual:inertia-modules';

createInertiaApp({
    resolve: resolvePage, // handles both app pages and module pages
    // ...
});
```

Using SSR? Make the same swap in `resources/js/ssr.tsx`.

**4. Render module pages** from anywhere in your Laravel code:

```php
Inertia::render('payments::Invoices/Index');  // from acme/payments
Inertia::render('Dashboard');                 // regular app page, as always
```

That's it. `composer require` a new module while `npm run dev` is running and
the browser reloads with its pages available.

## How it works

The plugin reads `vendor/composer/installed.json` (Composer 2's authoritative
registry of installed packages) and collects every package that declares an
`extra["inertia-modules"]` manifest. It then exposes a virtual module —
`virtual:inertia-modules` — containing lazy `import.meta.glob` maps for the
app's pages and each module's pages, plus the `resolvePage` function that
routes `module::Page` names to the right loader.

Because everything goes through the host's Vite, you keep one React/Vue/Svelte
runtime, shared vendor chunks, per-page code splitting, and HMR — including
HMR for files inside `vendor/`.

## Options

```ts
inertiaModules({
    manifestKey: 'inertia-modules',      // key under "extra" in composer.json
    appPages: '/resources/js/pages',     // host app pages (root-relative)
    pages: 'resources/js/pages',         // default pages dir inside packages
    extensions: ['tsx', 'jsx'],          // tried in order; e.g. ['vue'] or ['svelte']
    virtualId: 'virtual:inertia-modules' // rename the virtual module if you like
});
```

| Option        | Default                    | Description                                          |
| ------------- | -------------------------- | ---------------------------------------------------- |
| `manifestKey` | `'inertia-modules'`        | Key under `extra` that marks a package as a module   |
| `appPages`    | `'/resources/js/pages'`    | Where the host app's own pages live                  |
| `pages`       | `'resources/js/pages'`     | Default pages path inside packages (overridable per package via the manifest) |
| `extensions`  | `['tsx', 'jsx']`           | Page extensions, tried in order                      |
| `virtualId`   | `'virtual:inertia-modules'`| Id of the generated virtual module                   |

## TypeScript

Add the bundled ambient types to your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "types": ["vite-plugin-inertia-modules/client"]
    }
}
```

If you customize `virtualId`, declare the module yourself using the same shape
as [`client.d.ts`](./client.d.ts).

## Writing a module package

- Pages go in `resources/js/pages` (or wherever your manifest points).
- Declare the host-provided libraries (`react`, `@inertiajs/react`, your design
  system) as `peerDependencies` — never bundle your own copy.
- Backend concerns (routes, migrations, config) are regular Laravel package
  territory; this plugin only cares about pages.
- Local development with Composer [path repositories](https://getcomposer.org/doc/05-repositories.md#path)
  works out of the box — symlinks are resolved and allowed in the dev server.

## Laravel starter kits and the `@vite` directive

Laravel's React/Vue starter kits include the current page component in the
`@vite` directive of `resources/views/app.blade.php`:

```blade
@vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
```

This is a dev-only optimization: it preloads the page's own CSS to avoid a
flash of unstyled content. For namespaced pages (`payments::Invoices/Index`),
the path is built by convention and doesn't exist — resulting in a harmless
but noisy `404` request on every page load.

You have two options:

**Drop the page entry** (simplest — pages still load normally through the
resolver; you only lose the dev-mode CSS preload, which is irrelevant unless
your pages import their own CSS files):

```blade
@vite(['resources/css/app.css', 'resources/js/app.tsx'])
```

**Or skip it conditionally**, keeping the optimization for conventional pages:

```blade
@php
    $entries = ['resources/css/app.css', 'resources/js/app.tsx'];

    if (! str_contains($page['component'] ?? '', '::')) {
        $entries[] = "resources/js/pages/{$page['component']}.tsx";
    }
@endphp

@vite($entries)
```

## License

[MIT](./LICENSE)