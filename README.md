# Cartable Vivant — Site du délégué

Cartable moderne infographique pour une classe collège/lycée : résumés de cours jour par jour, devoirs, questions-réponses, et synchronisation EcoleDirecte.

## Lancer en local sur Mac (présentation sans Wi-Fi) — une commande

**Préparer la démo (une fois, avec Internet) :**

```bash
git clone <ton-repo>
cd <ton-repo>
bun install        # ou npm install / pnpm install
bun run build:demo # fabrique le site statique démo dans dist/
```

**Le jour J, sans Wi-Fi :**

```bash
bun run preview:demo
# ouvre http://localhost:4173
```

Coupe le Wi-Fi avant, recharge avec `⌘ + R` : tout doit marcher — `/` → `/auth` (prénom + e-mail quelconque, ex. `isaac@demo.local`) → `/dashboard` (Cours / Devoirs / Questions / Ma classe) → `/questions`. Aucun écran d'erreur : les données sont dans `localStorage`, le résumé IA est généré en local (`src/lib/offline-summary.ts`).

Variante dev live sans build (aussi sans Wi-Fi, mais serveur de dev) : `bun run demo` ou `bun run dev:demo` → `http://localhost:5173`.

**Données de démo :** `src/demo/store.tsx` seed (3 élèves, 3 cours, 3 devoirs, EDT demain, 1 question + 1 réponse, 1 invite pending). Tout est modifiable et persistant (localStorage `cartable-vivant:demo-state:v2`). Bouton *Réinitialiser la démo* dans le bandeau ambre et dans `OfflineBanner`.

## Comment ça marche (architecture hors-ligne)

| Besoin | En ligne (Convex) | Sans Wi-Fi (VITE_DEMO_MODE=true) |
|---|---|---|
| `VITE_CONVEX_URL` manquant ? | crash avant | `src/main.tsx` détecte via `src/demo/mode.ts:isDemoMode()` et monte `DemoProvider` + `AuthDemo`/`DashboardDemo` — **jamais** `new ConvexReactClient(undefined)` |
| Auth | `src/convex/emailSignIn` + Convex Auth | `src/demo/store:signInLocal(name,email)` + `DemoRequireAuth` — e-mail non vérifié, 1er inscrit = `delegue` |
| Cours / devoirs / questions / invites / EDT | `src/convex/{lessons,homework,questions,invites,tomorrow,homeworkNotes}.ts` | `src/demo/store.tsx` (même shape, `localStorage`) |
| Générer un résumé | `src/convex/ai.ts` → Vly AI / OpenAI | `src/lib/offline-summary.ts:localSummarize` via `src/lib/ai-offline-guard.ts` — fallback automatique si `!navigator.onLine` ou `isDemoMode()` ou si l'appel Convex throw |
| Importer (PDF/DOCX/photo/audio) | `src/lib/courseImport.ts` (pdfjs, mammoth, tesseract, transformers) — déjà local | idem offline ; l'analyse `analyzeImportedSources` bascule sur `localDetectSubjectAndFormat` |
| EcoleDirecte | `src/convex/auth/ecoleDirecte.ts` + `src/convex/delegueEcoleDirecte.ts` → `api.ecoledirecte.com` | **Désactivé** en démo : panneau *Ma classe → EcoleDirecte — démo* explique qu'aucun appel n'est fait ; *Synchroniser (démo)* injecte un devoir + des créneaux EDT factices |
| Pièces jointes | `src/convex/attachments.ts` | non disponible offline (gardé hors du store démo par simplicité — à étendre si besoin) |

**Ce qui dépend encore d'Internet en mode normal (non-démo) :**
- Convex (`VITE_CONVEX_URL` + `CONVEX_DEPLOYMENT`) — synchro temps réel
- Vly AI / OpenAI (`src/convex/ai.ts`) — génération de résumés
- `api.ecoledirecte.com` — login + synchro devoirs/EDT
- OCR `tesseract.js` au 1er chargement du worker, STT `@huggingface/transformers` — mis en cache ensuite

Tous ces appels sont **gardés** en démo : `CourseImporter` et `DashboardV2` passent par `ai-offline-guard`, `src/main.tsx` court-circuite Convex, aucune requête n'est émise.

## Scripts

| Script | Usage |
|---|---|
| `bun run dev` | Vite normal (besoin de `VITE_CONVEX_URL` + Convex) |
| `bun run dev:demo` / `bun run demo` | Vite en **mode démo** (`VITE_DEMO_MODE=true`), sans Convex |
| `bun run build` | `tsc -b && vite build` normal |
| `bun run build:demo` | Build statique démo (`dist/`) — prêt à présenter sans Wi-Fi |
| `bun run preview` | `vite preview` normal |
| `bun run preview:demo` | Preview du **build démo** sur `0.0.0.0:4173` |

## Présentation conseillée

1. `bun run preview:demo` → `http://localhost:4173` → montre `/` (landing).
2. `/auth` → tape `Isaac` / `isaac@demo.local` → *Rejoindre*.
3. `/dashboard` → *Cours* : *Importer → texte → Générer hors-ligne → Publier* ; *Devoirs* : cocher/faire ; *Questions* : poser/répondre ; *Ma classe* : *Inviter* + *EcoleDirecte (démo) → Synchroniser*.
4. Coupe le Wi-Fi mid-demo si tu veux prouver le offline : tout reste cliquable.

## Stack

Vite · TypeScript · React 19 · React Router v7 · Tailwind v4 · shadcn/ui · Lucide · Convex · Convex Auth · Framer Motion — Bun recommandé.

## Variables d'environnement (mode en ligne uniquement)

`VITE_CONVEX_URL` (client), `CONVEX_DEPLOYMENT` — fournis par l'environnement cloud. En mode démo elles ne sont **pas** requises (le `.env` peut rester vide).
