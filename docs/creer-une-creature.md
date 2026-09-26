# Créer une nouvelle créature (rig)

Tout passe par le **registre auto-collecté** : 1 créature = 1 fichier dans
`src/gameIso/rig/creatures/defs/<Nom>.ts`, ramassé par `npm run gen` (auto en dev/build).
**Aucune table centrale à éditer.** Ce guide couvre le choix du squelette, la séparation
corps nu / tenue, le calage sur l'illustration officielle et le QC.

## 0. D'abord : l'illustration officielle

`art-ref/ldb/mapping.json` (clé `creatures`) donne le chemin PNG de l'illustration LDB de
chaque créature (dossier gitignoré — droits Cubicle 7 — mais lisible localement ; un script
d'extraction l'alimente depuis les PDF). **L'illustration prime sur le texte** pour les
couleurs, la tenue et les accessoires (la Démonette « crémeuse » du texte est lilas à corset
doré dans l'art p.337). La lire AVANT de dessiner, et y revenir au QC.

## 1. Choisir le squelette (`plan`)

| plan | quand | props |
|---|---|---|
| `biped` | humanoïde (deux jambes, peut porter arme/tenue) | `race` + `perso` |
| `quadruped` / `winged` | bête à 4 pattes (± ailes) | `quad: QuadProps` |
| `serpentine`, `arachnid`, `avian`, `cephalopod`, `spectral`, `squig`, `amorphous`, `jabberslythe` | gabarits exotiques | le champ du même nom |

Pour les non-bipèdes : copier le def existant le plus proche (`Basilic`, `Araignee`,
`Squig`, `Fantome`…) et ajuster les props — ils sont auto-documentés dans
`src/gameIso/rig/<plan>/compose*.ts`.

### Une BÊTE se dessine ENTIÈRE, par vue

Les bêtes (plans non équipables) ne s'assemblent pas pièce à pièce : chaque vue est authorée
comme UNE illustration continue, en coordonnées monde, dans
`src/gameIso/rig/quadruped/atelier/<espèce>-<vue>.dessin.mts` (étalon : `boeuf-profil`), puis
compilée par os — coordonnées cuites dans le repère local de chaque os — par
`scripts/rig/compile-dessin-quad.mts` (`--check` en porte de commit). La sortie alimente le canal
`QuadProps.viewArt` ; une vue non déclarée se compose au socle, comme avant. Arbitrage utilisateur
du 2026-08-06 (validation de l'étalon bovin — verbatim consigné au ticket #1082). L'assemblage par pièces reste aux **bipèdes équipables** (qui doivent recevoir
tenue et armes) et aux **éléments attachés** (`deco` : harnais, collier, fanon…).

**Direction d'art** : épuré, jugé à 40 / 64 / 128 px — la silhouette et deux ou trois masses
lisibles priment sur le détail qui disparaît à la première réduction.

## 2. Bipède — l'empilement d'apparence

```
Plan × Gabarit (carrure) × Race (peau/tête/traits) × Perso (surcharges du def) × Tenue (carrière)
```

```ts
// creatures/defs/Ma-creature.ts
export const creature: CreatureDef = {
  name: 'Ma créature',          // clé d'espèce canonique (le slug dérivé sert de clé de rig)
  plan: 'biped',
  id: 'ma-creature-alt',        // optionnel — SEULEMENT pour désambiguïser une collision de slug
  race: 'Skaven',               // race d'apparence imposée (sinon heuristique baseSpeciesOf)
  perso: { … },                 // surcharges propres à CETTE créature (voir §3)
};
```

- **`race`** (`races/defs/`) porte les défauts partagés : palette de peau, `gabarit` (carrure,
  `gabarits/defs/`), `head`/`legs` monstrueux (remplacent visage/jambes), `features` de corps
  (queue, fourrure, panse…), `pose` (voûté — PROFIL uniquement), `tenue` par défaut, `eyes`.
- **`perso`** (CreaturePerso) surcharge par-dessus : `tenue`, `sex`, `colors`
  (⚠ couleurs de BASE seulement : `peau`/`cheveux`… — les nuances O/H sont dérivées, tsc
  refuse `peauO`), `gabarit`, `scale` (toise : art ∈ [0.5, 1.35]), `parts` (coiffure/visage
  épinglés), `eyes` (clés du catalogue `EYE_OPTIONS` : noir, rouge, chat…), `monster`,
  `features`.

### `monster` vs `features` — le piège n°1

- **`perso.monster`** (MonsterParts : `tete`, `brasG/D`, `jambes`, `ailes`, `griffes`…) =
  **override COMPLET** : la structure de race (head/legs/features — queue comprise) est
  SAUTÉE. À réserver aux créatures qui redéfinissent tout (Démonette).
- **`perso.features`** (RaceFeature[]) = **ADDITIF** par-dessus la race : cornes du Prophète
  gris, griffes du Rat ogre, écailles de la Furie… C'est l'outil « race partagée + extra ».
  Champs : `bone`, `svg` (tokens `@peau`/`@cheveux`…), `layer` (négatif = derrière la part),
  `view` (limiter à une vue), `scale: 'bone'` (suit l'épaisseur de l'os).

## 3. La règle d'or : corps nu ≠ tenue

**Morphologie** (fourrure, cornes, queue, panse, musculature, cicatrices, épines) → `race.features`
ou `perso.features`. **Équipement** (pagne, corset, fétiches, plaque-bedaine, armure) →
**tenue au registre** : `src/gameIso/rig/parts/tenues/defs/<Nom>.ts`, et le def de créature
pointe `perso.tenue: '<Nom>'` (ou `race.tenue` pour la tenue par défaut de la race). Un monstre
mis en tenue `'Nu'` doit être RÉELLEMENT nu.

```ts
// src/gameIso/rig/parts/tenues/defs/<Nom>.ts
import type { TenueDef } from '../types';
import { BODIES } from '../../bodies';

export const tenue: TenueDef = {
  name: 'Ma créature',     // = la tenue pointée par le def (perso.tenue / race.tenue)
  palette: { vet1: '#9a8a6a', cuir: '#4a3a28' },   // tokens recolorables par l'éditeur
  set: {
    // le slot REMPLACE le « Nu » : inclure la CHAIR (BODIES.nu.*) sous l'équipement, par vue
    torse: { front: `<g>${BODIES.nu.torseFront}…pagne…</g>`, back: …, profile: … },
    jambes: BODIES.nu.jambe,
  },
};
```

- Une tenue déclare `pied: BOTTE_CUIR` pour chausser ; sans `pied`, le pied = le Nu de l'espèce (lisse ou griffu selon `extremites`).
- Même logique pour la **main** : une tenue/armure déclare `main: <GANTELET>` pour ganter ; sans
  `main`, la main = le Nu de l'espèce — poing lisse (civilisés) ou patte griffue (bêtes,
  `extremites: 'griffues'`), `src/gameIso/rig/parts/bodies/extremites.ts` (`HAND`/`MAIN_GRIFFUE`).
  Un membre monstrueux qui remplace déjà la main (pince, tentacule) l'efface — jamais de gantelet
  flottant sur un membre `monster`.
- Exception documentée : un équipement porté par un **membre monstrueux** (brassards de la
  Démonette sur ses bras-pinces) reste en `features` — le slot `bras` de la tenue serait
  écrasé par le remplacement monster.
- Dessiner l'équipement de la zone bassin (pagne, jupe) **sur l'os `torse` zone basse
  (y 8..28)** : l'os `bassin` est peint SOUS le torse.

## 4. Pièges de dessin codifiés (récidives connues)

> **Ce qui est GARDÉ vs ce qui repose sur l'auteur.** Un contrat qui n'est qu'un document ne tient
> pas : la règle du format (3 vues) a été violée 167 fois sur 410 slots avant d'être gardée. Ci-dessous,
> chaque piège porte son état réel. Un piège **non gardé** n'est pas moins impératif — il est moins
> protégé : c'est à la relecture d'art de le tenir.

- **MESURE : le harnais est CANONIQUE, on ne l'écrit pas — et il RÉFUTE, il ne certifie jamais.**
  `npx tsx scripts/qc/mesure-volume.mts <tenueId> [--slot bras] [--views back] [--with-flesh] [--no-erode]`
  — verdict PAR VUE : `NON-REFUTE` / `ECHEC` (+ raisons) / `NON MESURABLE`. Le CONTRAT est une
  CONJONCTION ancrée sur la palette : écart P90−P10 ≥ 30 **ET** part de surface claire ≥ 10 % ;
  le drapeau P90=BASE (« ancrage ») rend un `ECHEC`, plus un simple avertissement — l'écart de 30
  points se franchit AUSSI par le bas, en ne creusant que des ombres (cas mesuré : #635). Trois
  agents ont écrit trois harnais jetables et rendu des chiffres **incomparables sur le même
  fichier** (26,8 contre 120,0 pour une même vue) : à P90 identique, le P10 variait de 5,3 points
  selon qu'on érodait ou non le cerne. Une divergence avec le harnais est un **grief à instruire**,
  jamais un chiffre à substituer. Un `NON-REFUTE` n'est PAS un « BON » : le harnais ne voit qu'un
  histogramme de pixels, jamais le rendu — le BON vient d'un juge qui a REGARDÉ l'image.
  - **La chair est HORS masque** (`main*`/`pied*`, `--with-flesh` pour l'inclure, et la sortie le
    dit alors). Une tenue ne possède pas le corps de son porteur : deux vues ont été livrées comme
    « soldées » alors que le plancher n'était franchi que par la luminance des **mains nues**.
  - L'argument est un **id**, jamais un libellé : le harnais refuse le libellé et donne l'id
    (le même piège avait fait rendre 109 replis dans `scripts/gen-tenue-views-gallery.mts`).
- **FORMAT : trois vues par slot** — GARDÉ (`parts/tenues/part-view-format.test.ts`, cliquet).
  `{ front, profile, back }` ; une `string` fait fabriquer la vue par le moteur (silhouette
  générique, ou front plaqué sur `bras`), et une vue recopiée sur le front est refusée de même
  (comparaison de **géométries** : espace, commentaire, `<g>` inerte et recoloriage ne sauvent
  rien). Gardé sur les tenues ET les armures ; **armes et boucliers restent hors garde**.
  Périmètre exact, stocks et plafonds : `rig/PART-CONTRACT.md`.
- **Éléments latéraux pairs de PROFIL** (cornes, pointes d'épaule) : jamais l'art de face
  plaqué (→ « anses »). Cornes **par-vue** : paire front/back, et de profil UNE corne balayée
  en arrière + `lateralPair(art, {dx})` (`parts/parallax.ts`) pour l'exemplaire lointain.
  *Clause « jamais l'art de face plaqué » : GARDÉE (anti-alias du cliquet de format). Clause
  « exemplaire lointain visible » : NON gardée — par CHOIX, pas par nature. Le chemin est connu
  et nommé ici même : que le def déclare sa paire latérale en DONNÉE (appel `lateralPair`) la
  rendrait mécaniquement vérifiable. Ce qu'on refuse est de changer la forme de la donnée pour
  ça ; tant que ce refus tient, la relecture d'art en répond.*
- **Rien de décollé** : oreilles/cheveux/cornes ancrés DANS la silhouette du crâne (base qui
  rentre sous la part de tête, peinte derrière). *NON gardable : « ancré dans le crâne » est une
  relation géométrique entre deux fragments SVG libres — la mesurer suppose de rastériser et de
  juger un recouvrement. Relecture d'art.*
- **Tête de race + coiffe** : la tête (rat, orc…) passe SOUS le casque/capuche de la tenue —
  géré par composeRig, ne pas re-dessiner le crâne dans la coiffe. *NON gardable : rien ne
  distingue un crâne re-dessiné d'un décor de coiffe. Relecture d'art.*
- **Pas de token vif dans un détail front-only** : `dominantCloth` prend le token le plus
  fréquent pour les silhouettes dos/profil substituées (des fioles `@metal` vertes ont déjà
  repeint un torse entier). Détails en couleurs littérales. *NON gardable en l'état (distinguer
  un token « de détail » d'un token « de tissu » suppose l'intention), mais ce piège est un pur
  EFFET du format : `dominantCloth` n'est appelé que sur un slot front-only. Il s'éteint tout
  seul à mesure que `PART_VIEW_RATCHET` se vide — et disparaît à stock nul.*
- **Dents de face** : gueule AU BOUT du museau + crocs aux commissures (un rictus à
  mi-museau lit « dents de lapin »). Yeux : `goatEye` (caprin), `emberEye` (braise démon),
  `ratEye` (rouge skaven), `beastEye` (prédateur) — `parts/monster/eyes.ts`. *NON gardable :
  jugement d'art pur. Relecture.*
- Un bras monstrueux (pince/tentacule) efface son poing automatiquement — GARDÉ
  (`parts/traitVisuals.test.ts`, `parts/mutations.test.ts`).
- **Jamais de littéral hex qui recopie un jeton de SA PROPRE `palette`** — GARDÉ
  (`parts/tenues/palette-literal.test.ts`, cliquet, #583). La chair (`@peau`/`@peauO`/`@peauH`)
  suit TOUJOURS le token — jamais une couleur en dur, peu importe la vue (bras.back/profile
  recopiant `#e2b48c` au lieu de `@peau` produit une couture au poignet sur tout personnage à
  peau non claire). Même règle pour toute autre matière déclarée dans la `palette` (cuir,
  tissu…) : si la valeur existe dans `palette`, c'est le jeton qui se peint, pas le littéral.
- **Une TENUE, une ARME ou une ARMURE ne déclare aucune clé porteur** — GARDÉ
  (`parts/no-porteur-in-palette.test.ts`, #583 chair, #599 flanc jumeau cheveux). Leur `palette`
  déclare le cuir/tissu/métal, jamais `peau`, `cheveux`, `yeux` ni leur ombre/lumière
  (`PORTEUR`) : la chair et la chevelure viennent TOUJOURS de l'espèce (+ personnalisation),
  jamais du costume — 17 tenues qui déclaraient les clés de chair écrasaient la peau de tout
  porteur (174/210 paires avant-bras↔main à couture > 30 RGB, mesuré sans forcer
  `appearance.colors`) ; 5 tenues déclaraient les clés de cheveux (jusqu'à 296 RGB d'écart sur
  un Vampire coiffé de la palette `Nonne`). Piège symétrique : un jeton `@cheveux*` dans l'ART
  d'une tenue peut légitimement peindre une AUTRE matière (guimpe, capuche) — dans ce cas ce
  n'est pas la palette qu'on corrige, c'est le NOM du jeton qui est faux (renommer vers un jeton
  de vêtement dédié, hex inchangé, cf. `Nonne.ts` guimpe/`@voile*`).

## 5. Workflow complet

1. **Lire l'illustration** (`art-ref/ldb/mapping.json`) + le texte source (LDB/campagne FR).
2. Déposer `creatures/defs/<Nom>.ts` (+ `races/defs/` si nouvelle race partagée,
   + `tenues/defs/` si équipement, + `parts/monster/defs/` si nouvelle tête/membre).
3. `npm run gen` (vérifier le compteur de fichiers du registre).
4. **QC rendu** : script temporaire `scripts/_tmp-qc-<nom>.mts` (pattern : `entityRigProfile(name,
   seed)` → `resolveRig` 3 vues → PNG resvg) — **zoom unitaire ~700px OBLIGATOIRE** (la
   planche cache les défauts), comparer à l'illustration, itérer. Supprimer le script après.
5. `npx vitest run src/gameIso` — mettre à jour les cas de routage de
   `creatures/creatures.test.ts` ; goldens (`-u`) APRÈS inspection visuelle uniquement.
6. `npx tsc --noEmit`, `npm run galleries` (la créature apparaît automatiquement dans les
   galeries rig/bestiaire/toise — `public/galeries.html`).
7. Stats : rien à faire si elle est dans `creatures.json` (LDB/ADE) ; créature d'aventure →
   **CustomStatblock dans la scène** (règle 1 : jamais de stats inventées).

## Exemples à copier

- Variante d'une race existante : `creatures/defs/Vermine-de-choc.ts` (+ sa tenue).
- Morpho lourde + tenue : `Rat-ogre.ts` (fourrure/épines/couture en features, pagne en tenue).
- Override complet : `Demonette.ts` (monster + tenue + yeux + cornes par-vue).
- Monstre ailé : `Furie-du-chaos.ts` (ailes de cuir, écailles, cornes par-vue).
- Nouvelle tête : `parts/monster/defs/horreur.ts` (3 vues, tokens @peau).
