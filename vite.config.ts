import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
// @ts-expect-error - generateur ESM JS (pas de types)
import { genAll, REGISTRIES } from './scripts/gen-registry.mjs';
// @ts-expect-error - module ESM JS (pas de types)
import { ENTETE_RACINE, portDev, portPreview, valeurEnteteRacine } from './scripts/port-dev.mjs';
// @ts-expect-error - plugin ESM JS (pas de types)
import { proseSource } from './scripts/source/prose-source-plugin.mjs';

/** Auto-génération des registres « dépose un fichier → intégré » et de l'INDEX DES IDS (`genAll`,
 *  phases 1 et 2) au démarrage et à chaque ajout/suppression dans un dossier `defs/` (HMR récupère
 *  ensuite). */
function registryGen() {
  const dirs = (REGISTRIES as { dir: string }[]).map((r) => r.dir.replace(/\\/g, '/'));
  const touched = (f: string) => dirs.some((d) => f.replace(/\\/g, '/').includes(d));
  return {
    name: 'registry-gen',
    buildStart() { genAll(); },
    configureServer(server: { watcher: { on(e: string, cb: (f: string) => void): void } }) {
      const on = (f: string) => { if (touched(f)) genAll(); };
      server.watcher.on('add', on);
      server.watcher.on('unlink', on);
    },
  };
}

export default defineConfig({
  plugins: [registryGen(), proseSource(), react()],
  base: './',
  // Port propre à l'arbre + `strictPort` (#1679 L1c-M6) : sans lui, Vite glisse sur le port suivant
  // quand un autre arbre tient déjà le sien, et une recette lancée sur le port attendu mesure
  // l'AUTRE arbre. Ici, chaque arbre a son port, et une collision fait ÉCHOUER le lancement.
  // L'en-tête publie en plus la racine SERVIE : la recette refuse un serveur qui sert un autre arbre
  // (`verdictArbreServi`, `scripts/recette/lib.mjs`) au lieu de mesurer le voisin sans le savoir.
  server: {
    port: portDev(),
    strictPort: true,
    headers: { [String(ENTETE_RACINE)]: String(valeurEnteteRacine()) },
  },
  preview: {
    port: portPreview(),
    strictPort: true,
    headers: { [String(ENTETE_RACINE)]: String(valeurEnteteRacine()) },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Dépendances stables (React/Zustand…) → chunk vendor bien caché.
        // L'éditeur et le rendu de jeu sortent déjà en chunks async (React.lazy, ui/App.tsx).
        manualChunks(id) {
          // `three` a son PROPRE chunk : `vendor` est préchargé par index.html (modulepreload), donc
          // tout ce qui y entre est payé au MENU. Le moteur volumique n'est atteint que par les écrans
          // async (CampaignView, Editor) — mesuré : sorti de `vendor`, il quitte le préchargement.
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules')) return 'vendor';
          // Tables de règles générées (~1 Mo) : chunk séparé, cacheable indépendamment du
          // code applicatif (changer le code ne réinvalide pas les données). Encore chargées
          // au démarrage (le moteur pur les importe) — le découplage paresseux reste à faire.
          if (id.includes('/src/data/') && id.endsWith('.json')) return 'gamedata';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/src/**/*.test.ts', 'scripts/map/**/*.test.ts'],
    // Le graphe de modules (moteur pur + ~1 Mo de `src/data/*.json`) est ré-évalué une fois PAR
    // WORKER au lieu d'une fois par fichier de test → effondre la phase `collect` (l'essentiel du temps
    // de suite). Contrepartie : le graphe étant partagé, un mock de MODULE ne se lie plus de façon
    // déterministe (l'ordre des fichiers du worker décide) — interdit et gardé par
    // `src/vi-mock-isolate-guard.test.ts`.
    // Chaque test reposant sur le store établit son propre état (startScene/startCombat) + reset
    // global (cf. src/test-setup.ts).
    isolate: false,
    // Second effet du graphe PARTAGÉ : un `vi.spyOn` sur un namespace de module (ou sur un prototype
    // `three`) mute l'instance du worker et fuit vers les fichiers suivants. Fermé PAR CONSTRUCTION
    // ici plutôt que par une règle textuelle : chaque espion est rendu après SON test, les 144
    // occurrences de `spyOn` des 48 fichiers du périmètre comprises (mesure 2026-09-02).
    restoreMocks: true,
    // Paramètre de BANC calé sur le test volumique le plus lourd mesuré en CI (#1619) — le contrat des tests ne change pas.
    testTimeout: 15_000,
    // Filet d'isolation GLOBAL : restaure les vrais timers après chaque test (cf. src/test-setup.ts) —
    // empêche tout fake timer fantôme de fuir d'un test à l'autre (flake de combat).
    // Ancré sur le fichier : un root de worktree sans slash final ferait remonter un chemin relatif à l'arbre parent (#1679 L1c-M1).
    setupFiles: [fileURLToPath(new URL('./src/test-setup.ts', import.meta.url))],
  },
});
