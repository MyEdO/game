---
name: creer-une-campagne
description: À utiliser quand on crée ou modifie une CAMPAGNE (scènes reliées par une `WorldMap`, narratif jouable hors scénarios de test) ou qu'on cherche le chemin d'authoring de scène : paquet MANUSCRIT, jamais généré par script.
---

# Créer une campagne

Un paquet de campagne est **MANUSCRIT** : posé à l'éditeur, ou édité comme document JSON, jamais produit
par un script (fiche `user-doctrine-campagne-jamais-generee-par-script`). Modèle : `src/scenes/diligence/`.

## Le chemin canonique en 6 étapes

1. **Le paquet `src/scenes/<campagne>/<campagne>-projet.json`**, commité, MANUSCRIT. À
   l'éditeur : « Ouvrir » une campagne du jeu en fait une COPIE de travail libellée « Copie de <label> » ;
   « Fichier → Exporter JSON » passe la porte UNIQUE du document (`parseProject`, garde
   `src/ui/editor/export-passe-la-porte.test.tsx`) et télécharge `<id de la scène COURANTE>-projet.json`,
   scène courante en tête (donc scène d'entrée). Ce fichier ne remplace PAS le paquet commité tel quel :
   label, nom de fichier et scène d'entrée ont changé (`src/ui/editor/Editor.tsx`, `exportJson` et
   `loadBuiltin` ; #1997). Le paquet commité s'édite donc comme document JSON. Tout paquet neuf se déclare dans
   `MANUSCRITS` de `src/scenes/generateurs-byte-stables.test.ts` : son volet couverture exige que tout
   `*-projet.json` soit produit par un générateur OU nommé manuscrit.
2. **Scènes et cartes à l'éditeur** ; reproduire un plan de livre : skill `creer-une-map`.
3. **Écrire des IDS stables** — `ref` de créature, `skill`, `spell`, `species`, `weapon` (trappingId),
   `appearance.tenue`, trait `arg`. Aucun libellé : `validateScene` refuse une réf de créature ou de décor
   inexistante, `src/scenes/bundled-projects.test.ts` une apparence, un nom ou un catalogue naval non résolu. `appearance.species`
   absent = Humain par défaut.
4. **Identité et carte du monde** : l'identité (`id`, `label`, `versionContenu`) est PLATE à la racine.
   `worldMap.places[].scene` doit pointer un id du tableau `scenes` ; deux routes entre les mêmes lieux
   sont permises (seul `id` est une clé) et le moteur ne force PAS le sens : nommer `-aller`/`-retour`.
5. **Validé par ce qui le lit, AUCUN test nominatif sur le paquet livré.** `parseProject`
   (`src/state/worldMap.ts`) refuse un document mal formé ; au démarrage en DEV, `src/data/dev-validate.ts`
   le confronte à son schéma. `src/scenes/bundled-projects.test.ts` prend tout `src/scenes/**/*-projet.json`
   au GLOB : `parseProject` sans lever, identité valide, apparence et nom résolus, aucune `error` de
   `validateScene` (`src/state/validateScene.ts`), prose sourcée confrontée au `Source/` à l'octet, refus
   du jargon technique dans un texte joueur. Un bump de forme (`SCHEMA_PROJET`) migre les paquets par un
   script daté de `scripts/migrations/` (banc `src/scenes/migrations-format-projet.test.ts`), jamais à la
   main. Une MÉCANIQUE à prouver se prouve sur une scène de FIXTURE (skill `creer-un-scenario-de-test`),
   jamais sur la carte livrée.
6. **Recette navigateur** — `loadProject(doc.scenes, startId, doc.worldMap, doc.narratif)` puis flux
   complet déroulé : skill `recette-navigateur`.

## `scripts/campagne/lib.mjs` et les générateurs

- `lib.mjs` porte les helpers des générateurs existants et les validateurs id-only (`creatureId`,
  `skillId`, `spellId`, `speciesId`, `tenueId`, `weaponId` ; banc `src/scenes/arene/lib-validators.test.ts`).
  `creatureId` accepte créature ∪ véhicule ; `poste(trappingId, side, crewIds?)` émet la référence de
  poste et lève si `trappingId` n'est pas une pièce POSABLE (`siegeRig`).
  Consommateurs : `scripts/arene/`, `scripts/barge-du-sel/generate.mjs`, `scripts/loup-et-saumure/generate.mjs`
  et ce banc. Il ne sert à un contenu neuf que pour du contenu CALCULÉ non authorable à la main, jamais
  pour un projet de campagne ; « enrichir un JSON manuscrit par script » est interdit.
- Les générateurs de `barge-du-sel` et `loup-et-saumure` sont la dette #1601 (« Campagnes possédées par un
  GÉNÉRATEUR … statuer la migration vers MANUSCRIT ») ; `scripts/arene/generate.mjs`
  produit `arene-projet.json` sous le même régime (#1601). Aucun n'est un modèle.

## Narratif — frontière référence ⟂ narratif

Le bloc `narratif` (`src/state/campaignNarratif.ts`) vit au NIVEAU PROJET, frère de `scenes`/`worldMap`
(champs, bridge `presetId`, éditeur : **`docs/campagne-authoring.md` §10ter**). Le contenu de RÉFÉRENCE
(créature, possession, compétence, sort…) vit dans `src/data` (`docs/donnees.md`) ; le contenu NARRATIF
(affaires, indices, méchants, objets d'intrigue) est EMBARQUÉ dans `narratif` et RÉFÉRENCE la règle
globale PAR ID (`PresetPnj.base`), jamais versé dans `src/data` ni au Compendium. `emptyNarratif()` est
valide ; un bloc mal formé fait échouer `parseProject`.

## Pièges

- **Coques de navire** : une coque se pose en `entities`, `ref` = id de véhicule à coque (`vehicles.json`),
  et s'enrôle par `encounters[].members` ; `validateScene` refuse une `ref` que `refEntiteResolue`
  (`src/data/index.ts` : créature, véhicule à coque, pièce d'affût `siegeRig`) ne résout pas. Une coque
  RICHE porte `crewIds`, `upgrades` et `postes`. Un poste est une RÉFÉRENCE JSON
  `{ trappingId, side, crewIds?, uid?, ammo?, ammoUid? … }` (`AuthoredShipPoste`, `src/engine/types.ts`),
  hydratée au spawn par `hydratePoste` (`src/engine/items.ts`), qui lève sur un `trappingId` inconnu.
  `src/scenes/bundled-projects.test.ts` contrôle l'équipage exposé (chaque `crewIds` de la coque = une
  entité de la scène), les améliorations (catalogue naval) et le coffre (`ammo` en munitions de quantité
  non nulle, `ammoUid` dans le coffre) ; rien ne contrôle qu'un `trappingId` de poste désigne une pièce
  POSABLE (art d'affût `siegeRig`, Compendium → Objets, armes de siège) : le vérifier à l'écriture.
- **Navire de campagne = Effect `setVessel`** (`vehicleId`, PV, moral) : une coque spawnée dont
  `creatureId === vessel.vehicleId` est réconciliée aux PV du navire à l'ouverture du combat et réécrit
  ses dégâts dans `vessel.wounds` à la fin. Sans `setVessel`, chaque combat spawn une coque fraîche.
- **`saboteurDR`/sabotage s'authore SUR l'entité-coque**, effet de COMBAT seulement (`seaVoyageFlow` et
  le Test d'équipage ne lisent aucun `GameOp`) ; un `ambush` de route MER ne se déclenche que sur
  poursuite RNG perdue.
- **JAMAIS de note technique dans un texte joueur** : `node.text` et dialogues sont rendus VERBATIM — ni
  identifiant de code, ni tag d'auteur, ni citation RAW (garde de jargon de `bundled-projects.test.ts`).

Renvois : `docs/campagne-effects.md` (Effects de scène, `npm run docs:effects`) · `docs/map-authoring.md`
· `docs/test-scenarios.md` · gardes `src/scenes/arene/lib-validators.test.ts` (id-only) et
`src/scenes/arene/arene-flow.test.ts` (Trigger→Effect→transition). Campagne publiée à adapter : skill
`adapter-une-campagne`.
