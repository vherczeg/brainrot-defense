# Deployment — GitHub Pages and custom domain

## Selected target

Production target: **`https://brainrot.herczeg.cc/`** (custom-domain root).

The repository and CI therefore build with:

```text
VITE_BASE_PATH=/
```

`public/CNAME` contains `brainrot.herczeg.cc`. The generated service worker, manifest, hashed
Vite assets, and index URLs all assume the custom-domain root.

**No production deployment has been performed by this milestone.** DNS, GitHub Pages source,
the custom domain, and HTTPS still have to be configured by the repository owner.

## GitHub Actions behavior

Workflow: `.github/workflows/deploy.yml`

- Pull requests: lint, typecheck, unit/integration tests, build, asset/precache verification,
  and Playwright tests. No artifact upload or deploy.
- Push to `main` and manual `workflow_dispatch`: the same verification suite runs.
- The **deploy job** runs only when all of these are true:
  - event is `push` or `workflow_dispatch`;
  - ref is `refs/heads/main`;
  - repository Actions variable `PAGES_DEPLOY_ENABLED` is exactly `true`.

This gate is intentional. It prevents an accidental production deployment before the custom
domain and Pages settings are ready.

The job uses minimal permissions: repository contents are read-only; only the deploy job gets
`pages: write` and `id-token: write`. The Pages artifact is produced from `dist/`. After a deploy,
the workflow requests `https://brainrot.herczeg.cc/` with curl and fails if the production URL is
not reachable, so a successful deploy job means the custom-domain URL answered.

## Required owner actions before the first production deploy

1. **DNS**
   - Add a DNS record for `brainrot.herczeg.cc`.
   - For a GitHub Pages project site owned by `vherczeg`, the usual record is:
     - Type: `CNAME`
     - Host: `brainrot`
     - Value: `vherczeg.github.io`
     - TTL: automatic/3600 (or your provider's default)
   - Do not continue until the record resolves. GitHub Pages can issue invalid certificates or
     redirect unexpectedly if the domain is configured before DNS is ready.

2. **GitHub Pages**
   - Repository → Settings → Pages.
   - Set **Build and deployment → Source** to **GitHub Actions**.
   - Under **Custom domain**, enter `brainrot.herczeg.cc` and save.
   - Wait for DNS verification, then enable **Enforce HTTPS**.

3. **Deployment gate**
   - Repository → Settings → Secrets and variables → Actions → Variables.
   - Create `PAGES_DEPLOY_ENABLED` with value `true` only after steps 1–2 are verified.
   - Without this variable the deploy job is skipped; verification still runs.

4. **Trigger**
   - Push to `main`, or run the workflow manually from `main` via `workflow_dispatch`.
   - A manual run on another branch verifies but does not deploy.

## Local production verification

```bash
npm ci
npm run build
npm run verify:build
npm run preview
```

`verify:build` checks that:

- HTML-referenced scripts/styles exist in `dist/`;
- manifest icons exist;
- `dist/sw.js` exists, has a content-versioned cache name, and precaches the HTML assets.

The Playwright suite additionally checks that all HTML/manifest/service-worker URLs resolve and
that a fresh first-visit offline reload works.

## Asset and service-worker paths

- `index.html`, the manifest, and the generated service worker use the configured Vite `base`.
- The service worker is generated at `dist/sw.js` by the Vite build plugin. Do not hand-edit
  `dist/sw.js`; edit `scripts/serviceWorkerTemplate.ts` and rebuild.
- The generated precache list includes the actual hashed JS/CSS filenames plus HTML, manifest,
  icons, and CNAME. It uses `ignoreVary` matching because the preview/Pages server sends
  `Vary: Origin` on static assets.
- Cache names include a hash of the build contents. A changed build installs into a staging
  cache first; a failed install does not activate an incomplete shell. Activation removes old
  caches with the same prefix.
- Navigation is network-first with precached-shell fallback. Essential assets are served from
  the precache when offline.

## Alternative: GitHub Pages project subpath

If the owner chooses `https://vherczeg.github.io/brainrot-defense/` instead of the custom
domain:

1. Set `VITE_BASE_PATH=/brainrot-defense/` in `.github/workflows/deploy.yml` (and in local
   builds).
2. Remove or replace `public/CNAME`.
3. Do **not** configure the custom domain in Pages.
4. Re-run `npm run build` and `npm run verify:build` with the same `VITE_BASE_PATH`.
5. Update this document and README so the stated target matches the real deployment.

The workflow currently sets `VITE_BASE_PATH: /` at workflow level, so switching targets
requires changing that value.

## Rollback

- Revert the deployment commit and re-run the workflow.
- The new service worker keeps the previous cache until activation; after activation the old
  cache prefix is removed. Users who loaded the previous page keep running the already-loaded
  JavaScript until they reload.
- IndexedDB saves are independent of deployment and service-worker caches. Do not ask users to
  clear site data to roll back.
- If a schema-incompatible release was deployed, keep the newer records intact and ship a
  migration; do not delete user data.

## Pre-deploy checklist

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run verify:build`
- [ ] `npm run test:e2e`
- [ ] DNS record resolves
- [ ] Pages source is GitHub Actions
- [ ] Custom domain verified and HTTPS enforced
- [ ] `PAGES_DEPLOY_ENABLED=true` set only after the above
- [ ] Manual smoke test at desktop, tablet, and phone widths
- [ ] Fresh-profile offline reload test on the deployed URL
- [ ] Export/import and reload persistence verified on the deployed URL
- [ ] Owner approval for the production push/deploy
