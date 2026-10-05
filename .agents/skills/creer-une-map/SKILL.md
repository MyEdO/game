---
name: creer-une-map
description: À utiliser quand on crée ou modifie une carte, une scène, un bâtiment, un étage ou un extérieur (tuiles, murs, portes, props, points d'entrée), ou avant de toucher src/scenes/ ou l'authoring ASCII. Aussi pour agrandir/retailler une scène existante.
---
<!-- GENERATED: agents:sync; source=.claude/skills/creer-une-map/SKILL.md -->

# Créer une map / une scène

**Dans un paquet de campagne MANUSCRIT, la carte se pose à l'éditeur** (fiche
`user-doctrine-campagne-jamais-generee-par-script`, skill `creer-une-campagne`) : terrain, murs, relief et
escaliers, décor, bâtiments et leurs étages. **`MapSpec` + `buildScene` reste le chemin des scénarios de
test et des générateurs** (dette #1601) : jamais poser les tuiles une à une ; si le vocabulaire manque,
ÉTENDRE une primitive + un golden, jamais bricoler le scénario. Cartes ASCII : `src/state/asciiMap.ts`
(`parseAsciiRows`/`parseWalledAscii`). `buildScene` rejoue les primitives de l'éditeur : son résultat reste
éditable (règle stricte 2).

Référence complète (champs, ordre de compilation, pièges) : **`docs/map-authoring.md`**.

## Reproduire un plan de livre — procédure OBLIGATOIRE (structurel d'abord, mobilier en dernier)

Chaque étape est VALIDABLE avant la suivante. Détail + citations dans `docs/map-authoring.md` § « Procédure
image → grille ».

1. **Échelle** : défaut **une porte = 1 case** (dérogable, à documenter) → `metresPerTile`.
2. **Dimensions communes** : tous les étages partagent le `size` ; z1 = `'vide'` hors emprise bâtie.
3. **Enveloppe + cloisons** en `walled` box-drawing, SANS mobilier. Obliques `\`/`/` ORTHOGONALISÉES
   (habillage, jamais une séparation — `buildScene` refuse un pan sans coin orthogonalement muré).
4. **Ouvertures** : portes `:`, fenêtres `o` — comptées depuis le plan (attendu de test par façade).
5. **Recalage z0↔z1** par les cages d'escalier `cells` (rôle `stair: {to, style?}`) + l'enveloppe commune —
   la compilation ÉCHOUE si les grilles sont décalées (ancre de recalage vérifiée par construction).
6. **Vides & hauteurs** (`elevate`, trémies, balcons) — la validation de trémie de `stair` couvre les
   surfaces fantômes.
7. **Zones nommées** : calque `zoneMap` + `zoneLegend` (un char = une pièce ; nom cuit au centre, révélé
   en cutaway) — recopie la légende du plan.
8. **Mobilier par marqueurs** (`bind`) — EN DERNIER. Vocabulaire d'auberge : `escalier-bois`,
   `balustrade-bois`, `enclume`, `foyer-de-forge`, `cuve-brasserie`, `stalle-ecurie` ; colombage via
   l'apparence de mur `mur-a-ossature-en-bois`.
9. **Recette** — le harnais ci-dessous.

## Harnais QC — CHEMIN OBLIGATOIRE avant de déclarer une carte finie (réfute, ne certifie jamais)

- **Gardes mécaniques** (`src/state/mapQC.ts`, démontré par `src/state/mapQC.test.ts`) dans le test de la
  scène : dimensions + murs/portes témoins ; `unreachableDescriptiveZones(scene, startOf(scene))` **vide**
  (chaque pièce nommée atteignable, BFS `reachableCells`/`walkNeighbors`) ; `reachedFloors` couvre tous les
  étages habités (connexité verticale par `stair`).
- **Jugement visuel** : capture de jeu (patron `scripts/qc/capture-jeu.mjs`) → planche par étage aux
  **4 rotations**, plan source en regard, jugée en RÉFUTATION — jamais une auto-certification.
- Attendus commités DANS les tests, jamais dépendants d'un fichier hors git. Exemple vivant :
  `src/scenes/test-scenarios/zones-pieces.ts`.
