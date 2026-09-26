# Ajouter une icône (et bannir les émojis)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-icones.mjs` (`npm run docs:icones`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUS aux fichiers réels : l'union `IconIdGenerated` de
`src/ui/icons/_registry.generated.ts` (familles, ids, comptes), la charte de dessin et les
constantes de trait de `src/ui/icons/defs/action.ts`, la regex de nommage et les couleurs admises
de `src/ui/icons/icons.test.ts`, les signatures des trois rendus de `src/ui/Icon.tsx`, l'entrée
`ICON_FAMILIES` de `scripts/gen-registry.mjs`, les valeurs `"icon"` des `src/data/*.json`, et le
périmètre + les glyphes tolérés du garde anti-emoji
(`scripts/guards/lib/emojiAffordance.mjs`, `src/ui/no-emoji-affordance.test.ts`) — dont l'ABSENCE de
stock d'exceptions, contrôlée aux identifiants déclarés/importés par cette garde. **Angles morts** :
le comptage d'icônes en DONNÉE est textuel (clé `"icon"` d'un JSON de `src/data/`) — une icône
référencée sous un AUTRE nom de champ, ou depuis du TS, n'est pas comptée ici (la garde de
`src/data/data-wellformed.test.ts`, elle, résout vraiment) ; la QUALITÉ d'un dessin (lisibilité à
14 px, unicité de métaphore) ne se mesure pas — elle se juge à la galerie QC ; les conseils de
geste sont de l'ÉDITORIAL fixé dans le script.

Toute AFFORDANCE de l'UI (bouton, badge, libellé d'action, icône de donnée JSON) passe par le
**registre auto-collecté** `src/ui/icons/` : 1 famille d'icônes = 1 fichier dans
`src/ui/icons/defs/<famille>.ts`, ramassé par `npm run gen` (câblé dans `npm run build`).
**Aucune table centrale à éditer.** Plus jamais d'emoji dans le code ou la donnée — garde
`src/ui/no-emoji-affordance.test.ts`.

## 0. Le registre : familles existantes

**28 familles, 255 icônes.** Chercher d'abord si l'icône voulue existe déjà ;
n'ajouter une entrée que si aucune n'exprime le concept.

| Famille | Fichier de def | Icônes | Exemples d'ids |
|---|---|---|---|
| `action` | `src/ui/icons/defs/action.ts` | 21 | `action/aim`, `action/attack`, `action/break-free` … |
| `audio` | `src/ui/icons/defs/audio.ts` | 3 | `audio/music`, `audio/mute`, `audio/volume` |
| `char` | `src/ui/icons/defs/char.ts` | 8 | `char/ag`, `char/cc`, `char/ct` … |
| `condition` | `src/ui/icons/defs/condition.ts` | 13 | `condition/ablaze`, `condition/bleeding`, `condition/blinded` … |
| `coop` | `src/ui/icons/defs/coop.ts` | 5 | `coop/away`, `coop/code`, `coop/host` … |
| `creature` | `src/ui/icons/defs/creature.ts` | 10 | `creature/bite`, `creature/breath`, `creature/gaze` … |
| `expedition` | `src/ui/icons/defs/expedition.ts` | 5 | `expedition/cartography`, `expedition/clover`, `expedition/outdoors` … |
| `faith` | `src/ui/icons/defs/faith.ts` | 3 | `faith/church`, `faith/prayer`, `faith/trident` |
| `file` | `src/ui/icons/defs/file.ts` | 7 | `file/document`, `file/export`, `file/folder` … |
| `fire` | `src/ui/icons/defs/fire.ts` | 2 | `fire/blast`, `fire/flame` |
| `flag` | `src/ui/icons/defs/flag.ts` | 8 | `flag/anger`, `flag/bond`, `flag/defensive` … |
| `item` | `src/ui/icons/defs/item.ts` | 6 | `item/ammo`, `item/armour`, `item/cloak` … |
| `journal` | `src/ui/icons/defs/journal.ts` | 17 | `journal/backstab`, `journal/charge`, `journal/critical` … |
| `magic` | `src/ui/icons/defs/magic.ts` | 5 | `magic/area`, `magic/component`, `magic/gust` … |
| `map-tool` | `src/ui/icons/defs/map-tool.ts` | 11 | `map-tool/crenel`, `map-tool/door`, `map-tool/erase` … |
| `mechanic` | `src/ui/icons/defs/mechanic.ts` | 5 | `mechanic/chain`, `mechanic/invoke`, `mechanic/mind` … |
| `medical` | `src/ui/icons/defs/medical.ts` | 5 | `medical/aid`, `medical/crutch`, `medical/infection` … |
| `melee` | `src/ui/icons/defs/melee.ts` | 7 | `melee/close-in`, `melee/disengage`, `melee/flee` … |
| `merchant` | `src/ui/icons/defs/merchant.ts` | 3 | `merchant/cart`, `merchant/deal`, `merchant/haggle` |
| `nautical` | `src/ui/icons/defs/nautical.ts` | 6 | `nautical/rock`, `nautical/snag`, `nautical/swim` … |
| `nav` | `src/ui/icons/defs/nav.ts` | 17 | `nav/activity`, `nav/art-gallery`, `nav/campaign` … |
| `resource` | `src/ui/icons/defs/resource.ts` | 9 | `resource/fate`, `resource/fortune`, `resource/gold-purse` … |
| `rest` | `src/ui/icons/defs/rest.ts` | 9 | `rest/bed`, `rest/camp`, `rest/cold` … |
| `scenario` | `src/ui/icons/defs/scenario.ts` | 17 | `scenario/ambush`, `scenario/arena`, `scenario/bestiary` … |
| `scene` | `src/ui/icons/defs/scene.ts` | 1 | `scene/light` |
| `time` | `src/ui/icons/defs/time.ts` | 9 | `time/afternoon`, `time/calendar`, `time/clock` … |
| `travel` | `src/ui/icons/defs/travel.ts` | 15 | `travel/anchor`, `travel/barge`, `travel/careen` … |
| `ui` | `src/ui/icons/defs/ui.ts` | 28 | `ui/add`, `ui/balance`, `ui/branch` … |

## 1. Choisir la famille et l'id

Un id = `famille/nom` en kebab-case — la garde `src/ui/icons/icons.test.ts` applique
`/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/`. Créer une NOUVELLE famille seulement si le concept ne rentre dans aucune des
28 existantes — sinon ajouter l'entrée au fichier de famille pertinent.

## 2. Dessiner la def

```ts
// src/ui/icons/defs/<famille>.ts
// Trait principal.
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
// Trait fin (détail secondaire).
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
// Silhouette pleine.
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'famille/nom',
    label: 'Libellé FR',           // tooltip par défaut, galerie QC
    svg: `<path ${F} d="…"/>`,     // contenu INTERNE d'un viewBox 0 0 24 24
  },
  // … reste de la famille
];
```

**Charte de dessin** — bloc en tête de `src/ui/icons/defs/action.ts`, référence pour toutes les
familles, cité ici tel quel :

> Grille 24×24, motif centré, ~2px de marge de respiration.
> Trait principal stroke-width 1.8, terminaisons et jointures RONDES ; détails fins 1.2.
> « Dessiné main » : courbes C plutôt que droites parfaites, micro-asymétries voulues —
> cohérent avec Ornaments.tsx et la direction du rendu iso.
> Silhouette PLEINE (fill currentColor) pour le motif porteur dès que l'icône doit rester
> lisible à 14px ; UNE seule métaphore par icône, pas de micro-détails, pas de texte.
> Couleur : currentColor UNIQUEMENT (accent var(--gold) toléré avec parcimonie), jamais de hex.

Couleur : la garde n'accepte que `currentColor`, `none`, `var(--gold)` pour tout
`fill`/`stroke` — **jamais de hex**.

## 3. Régénérer le registre

```
npm run gen
```

Réécrit `src/ui/icons/_registry.generated.ts` (import explicite de chaque fichier de `src/ui/icons/defs` +
union de littéraux `IconIdGenerated`, dérivée des champs `id: '…'` — script générique
`scripts/gen-registry.mjs`, entrée `ICON_FAMILIES`). Auto en dev (plugin Vite) et
câblé dans `npm run build` — mais lancer la commande à la main après un ajout pour vérifier le
compteur de fichiers (`ICON_FAMILIES ← N fichiers`) et committer le fichier généré à jour.

Le nouvel id devient un littéral du type fermé `IconId` (`src/ui/icons/types.ts`) — un id
inventé côté TS ne compile pas.

## 4. Les 3 rendus (`src/ui/Icon.tsx`)

| Contexte | Primitive | Détail |
|---|---|---|
| Composant React HTML | `Icon({ id, size = 'md', className }: { id: IconIdInput; size?: number \| keyof typeof SIZES; className?: string })` | `<svg viewBox="0 0 24 24">`, tailles nommées `sm: 14` / `md: 18` / `lg: 24` px |
| Contexte SVG existant (pion iso, carte du monde, FX) | `IconG({ id, x = 0, y = 0, size = 24 }: { id: IconIdInput; x?: number; y?: number; size?: number })` | `<g transform="translate(x,y) scale(size/24)">`, couleur via `currentColor` posé sur un ancêtre |
| Fragment brut (scripts SSR/galeries) | `iconSvg(id: IconIdInput): string` | retourne le fragment `svg` de la def, seul |

Les trois throw en DEV sur un id inconnu (`import.meta.env?.DEV` — `?.` car `import.meta.env`
n'existe pas sous `tsx`), en nommant le geste : déposer une def dans `src/ui/icons/defs/` puis
`npm run gen`. Pas de repli muet ; en prod (non-DEV), `Icon`/`IconG` rendent `null`/`''`.

`IconIdInput` (`src/ui/icons/types.ts`) = `IconId | (string & {})` : les 3 primitives acceptent aussi un
`string` brut porté par la DONNÉE JSON, pas seulement l'union typée — l'autocomplete reste côté
code authoré en TS, la validation se fait au rendu.

## 5. Icône portée par une DONNÉE (JSON)

Toute affordance de contenu (`src/data/*.json`) référence une icône par **id de chaîne**, jamais
un émoji :

```json
{ "id": "…", "icon": "action/aim", … }
```

Fichiers de `src/data/` qui portent une clé `"icon"` :

| Fichier | Ids d'icônes distincts | Hors registre |
|---|---|---|
| `src/data/actions.json` | 38 | — |
| `src/data/activities.json` | 39 | — |
| `src/data/calendarPhases.json` | 7 | — |
| `src/data/etats.json` | 12 | — |
| `src/data/lieux-services.json` | 7 | — |
| `src/data/psychology.json` | 5 | — |
| `src/data/qualities.json` | 2 | — |
| `src/data/reglesOptionnelles.json` | 1 | — |
| `src/data/talents.json` | 1 | — |
| `src/data/vehicles.json` | 5 | — |

Gardes correspondantes dans `src/data/data-wellformed.test.ts` (chaque `icon` doit résoudre dans
`ICON_DEFS`) :

- « 8 — activities.json : chaque Activité porte une icône du registre (ActivityDef.icon ∈ ICON_DEFS) »
- « 9 — actions.json : id unique, icône du registre, règle liée à une catégorie (registre des actions, spec HUD zone 12) »

## 6. QC visuel

```
npx tsx scripts/gen-icon-gallery.mts
```

Génère une galerie HTML (dans `npm run galleries`) : chaque icône rendue aux tailles canon
(14/18/24) + loupe, groupée par famille — vérifier la
lisibilité à la plus petite taille et l'absence de couleur en dur AVANT de committer.

## 7. Bannir les émojis (garde `src/ui/no-emoji-affordance.test.ts`)

**Couverture EXHAUSTIVE, sans liste opt-in** : le test balaie TOUT `src/` en récursif
(extensions `/\.(ts|tsx|json)$/`) et fait échouer la suite sur tout emoji détecté. Aucun stock
d'exceptions par état de migration n'y est déclaré — état VÉRIFIÉ à chaque génération, aux
identifiants de la garde (`npm run docs:icones` échoue nominativement si un cliquet, un stock ou une
liste opt-in y réapparaît). Seulement des exclusions **par NATURE** :

> Exclusions par NATURE (jamais par état de migration) :
>  - `*.test.*` : les tests portent les emojis de leurs composants non migrés et sont réécrits AVEC
>    leur composant (ils ne rendent rien à l'utilisateur) ;
>  - `_registry.generated.ts` : fichiers ÉMIS par scripts/gen-registry.mjs (en-tête « généré ») ;
>  - `__snapshots__/` : instantanés Vitest générés, non édités à la main.

Plages Unicode considérées comme emoji (`EMOJI_RANGES`, `scripts/guards/lib/emojiAffordance.mjs` —
délibérément SANS les blocs typographiques flèches/formes géométriques) :

- `0x1f000`–`0x1faff` — Mahjong → Symbols & Pictographs Extended (émoticônes, transport, suppléments…)
- `0x2600`–`0x27bf` — Miscellaneous Symbols + Dingbats
- `0x2b00`–`0x2bff` — Misc Symbols and Arrows (⬆ ⭐ …)
- `0x231a`–`0x231b` — ⌚ ⌛
- `0x23e9`–`0x23f3` — ⏩ … ⏳ (timers/lecteur)
- `0x23f8`–`0x23fa` — ⏸ ⏹ ⏺
- `0x2139`–`0x2139` — ℹ
- `0xfe0f`–`0xfe0f` — sélecteur de variation emoji

Glyphes TEXTE tolérés partout (`ALLOWED_CHARS`, 12 entrées) :
`✓` `✗` `✔` `✘` `✕` `★` `⚜` `☰` `♂` `♀` `✦` `✸` — coches/croix de résultat, fermeture,
ornement, burger de menu, symboles de sexe, particules FX en `<text>` SVG.

Pour ajouter une AFFORDANCE : utiliser `<Icon id>` / `<IconG id>` dès l'écriture — jamais un
emoji, même « juste pour l'instant ».

## Gardes

- `npx vitest run src/ui/icons/icons.test.ts` — a des ids uniques ; nomme chaque icône `famille/nom` en kebab-case ; a un label FR non vide pour chaque def ; ne contient AUCUNE couleur en dur (currentColor / none / var(--gold) seulement) ; a un fragment svg non vide (paths dans le viewBox 24×24) ; rend le fragment du registre dans un viewBox 24×24 (défaut md=18px) ; accepte les tailles nommées et numériques ; jette sur un id inconnu en DEV (rien de silencieux).
- `npx vitest run src/ui/no-emoji-affordance.test.ts` — zéro emoji dans tout `src/`,
  hors exclusions par nature.
- `npx vitest run src/data/data-wellformed.test.ts` — 2 cas résolvent une icône
  dans `ICON_DEFS`.
- `npm run gen` — régénère `src/ui/icons/_registry.generated.ts` (n'écrit rien si le contenu est inchangé ;
  vérifier le compteur de fichiers affiché).
- `npm run typecheck` — un id d'icône authoré en TS hors du registre ne compile pas
  (`IconIdGenerated` est une union fermée).
<!-- sources-empreinte: 44808a40b7fdf8252d018d1f6c0bc97e99178600 (137 fichiers, 2 dossiers) corps: e02688e6eab83bfaa5a891ead92463b25c8a79e0 -->
