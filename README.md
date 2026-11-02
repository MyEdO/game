# Warhammer Fantasy v4 — RPG tactique au tour par tour (web)

Jeu de rôle vidéoludique **100 % web, en français**, type *Neverwinter Nights*, basé sur les
règles de **Warhammer Fantasy Roleplay 4ᵉ édition**. On contrôle un groupe de 4 aventuriers
(créés un par un ou pré-tirés) à travers la campagne impériale **L'Ennemi Intérieur**.

> Les règles sont vérifiées dans les livres autorisés sous `Source/`, répertoriés dans
> [les sources VF](docs/sources-vf.md). La base de jeu (`src/data/*.json`) est la source
> app-owned, commitée, éditable dans le Compendium et curée à la main.

## Fonctionnalités (PR1 — fondations + tranche jouable)

- **Moteur de règles WFRP4** (`src/engine`) : Tests & Degrés de Réussite, Caractéristiques,
  Blessures, combat (touche/localisation/dégâts), états, création de personnage. Testé avec Vitest.
- **Créateur de personnage** : aléatoire complet ou manuel, espèces et carrières du Livre de base.
- **Groupe de 4** : créés ou choisis parmi des pré-tirés.
- **Mode campagne** : ouverture du Tome 1 (*L'Ennemi dans l'Ombre*) — l'auberge « La Diligence »
  et l'embuscade des mutants, en combat tactique sur grille.
- **Éditeur de niveau** : peinture de tuiles, placement d'entités, dialogues/triggers/combats.
  La scène de campagne est un document au même format → **entièrement ré-éditable dans l'éditeur**.
- **Coop hotseat** : les héros jouent tour à tour, le joueur actif est mis en avant.
- **Art sans asset binaire** : le décor est peint en billboards depuis `src/gameIso/catalog/decor/` ;
  sol, murs, toits et les props volumiques sont bâtis en géométrie par `src/gameIso/builders/`. Le jeu
  web n'affiche plus les personnages : leur rendu passe à l'hôte Godot (`hotes/godot/`).

## Pile technique

- **three.js** — rendu volumique du monde : la géométrie et les matières sont montées par
  `src/gameIso/backends/webgl/`, la scène elle-même (caméra, lumières, ambiance) par
  `src/gameIso/stage/`.
- **React + TypeScript** — interface (menus, créateur, fiches, dialogues, HUD, éditeur) et surcouches
  SVG du plateau (grille, traits de mur, réticules, chrome des jetons).
- **Zustand** — état partagé reliant React et le rendu du monde.
- **Vite** — bundler · **Vitest** — tests, du moteur pur jusqu'à l'UI et au rendu.

## Démarrage

Sous Linux, les commandes supervisées (push et publication) requièrent `python3` dans le PATH de l’appelant, avec sa bibliothèque standard. Sous Windows, elles utilisent Windows PowerShell et le Job Object natif ; Python n’est pas requis.

```bash
npm install
npm run dev          # serveur de développement
```

Autres scripts : `npm test` (suite complète), `npm run build` (build de production),
`npm run typecheck`.

## Architecture

```
src/engine/             Règles WFRP4 (pur TS, testé)
src/data/               Base app-owned (JSON commité, éditable dans le Compendium)
src/state/              Schéma de Scène, store Zustand, flux de jet, IA, pathfinding
src/gameIso/            Rendu du monde : builders/ (géométrie pure) montée par stage/ sur le backend
                        three.js (backends/webgl/) ; catalog/ porte l'art SVG du décor ; plus
                        authoring/, detail/, fx/, pov/
src/geometry/           Grille, projection isométrique, déplacement
src/ui/                 Interface React (menus, créateur, HUD, éditeur, compendium)
src/scenes/             Documents de scène et de campagne
src/net/                Coop en ligne : client du relay WS (le Worker Cloudflare vit dans server/)
src/audio/              Musique et sons
src/i18n/               Textes français de l'interface
```

Le **schéma de Scène** (`src/noyau/monde/scene.ts`) est l'unique contrat partagé par l'éditeur, le
runtime et la campagne : aucune scène n'est codée « en dur ».

## Périmètre & suite

PR1 pose les fondations et une tranche jouable. Les itérations suivantes ajouteront les Tomes
1-3 complets, la coop en ligne, la magie/les prières en combat, l'économie entre aventures et un
bestiaire étendu — la structure data-driven est prévue pour les accueillir sans refonte.
