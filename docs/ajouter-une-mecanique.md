# Ajouter une mécanique à une entité (trait, talent, qualité, mutation, maladie, atout…)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-mecanique.mjs` (`npm run docs:mecanique`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : le SITE réel du lecteur de
chaque canal (`src/engine/trauma.ts:983`, `src/state/triggeredEffects.ts:475`, `src/engine/capabilities.ts:45`), les
20 membres d'`EffectTrigger` et les 6 formes d'`EffectTargeting`
(`src/engine/flowCore.ts`), les 7 champs de `TriggeredEffect`, les 8 kinds
de source réunis par `effectSourcesOf`, les 4 interfaces de capacités et leur nombre de
drapeaux, les documents PORTEURS de chaque canal (def zod + population réelle du `.json`), le site
de l'annulation `suppressesCapabilities` avec ses porteurs, les trois sites de l'Indice de qualité,
et le site de `registerCombatHook`.
**Angles morts** : le catalogue des `GameOp` et des `Condition` n'est pas repris ici — source
unique `docs/vocabulaire-mecanique.md` ; le détail du canal PASSIF (annulation, combinaison,
collecteur) vit dans `docs/systeme-passifs.md` ; le scan des defs ne voit qu'un champ déclaré au
PREMIER niveau du document (un champ niché dans un sous-objet lui échappe) ; le critère de décision,
la frontière donnée/machinerie et les recettes sont de l'ÉDITORIAL fixé dans le script.

Toute mécanique — trait de créature, talent, atout d'arme/armure, mutation, symptôme de maladie,
État — s'exprime dans **UN des 3 canaux** ci-dessous, jamais un type ad hoc.

## 0. Les 3 canaux

| Canal | Ce qu’il porte | Lu par |
|---|---|---|
| `passive: GameOp[]` | modificateur CONTINU, sans déclencheur | `passiveMods` (`src/engine/trauma.ts:983`) |
| `effects: TriggeredEffect[]` | effet sur ÉVÉNEMENT (à la touche, en fin de Round…) | `fireTriggers` (`src/state/triggeredEffects.ts:475`) |
| `capabilities` | drapeau IRRÉDUCTIBLE que le moteur INTERROGE (aucune valeur numérique ni formule) | `hasCapability` (`src/engine/capabilities.ts:45`) |

Chaque champ est du **`GameOp[]`** ou du **`TriggeredEffect[]`** — jamais un type propre à
l'entité. Si un besoin ne rentre dans aucune op existante, on **étend le vocabulaire**, on n'invente
jamais un champ parallèle ni un chemin de code par nom d'entité. Le catalogue des ops et des
Conditions qui EXISTENT est `docs/vocabulaire-mecanique.md` : le lire AVANT de conclure à un manque.

## 1. Choisir le canal

> « Un designer pourrait-il vouloir une version DIFFÉRENTE de ça, attachée à un monstre / un objet /
> un sort / un État précis, éditable au Codex ? » — OUI → **donnée** (`passive`/`effects`/
> `capabilities`). NON, même règle universelle pour tous → **machinerie** (hooks de Round, qui ne
> nomment AUCUNE entité).

Une fois qu'on sait que c'est de la donnée :

- **un déclencheur nommé** (« à la touche », « en fin de Round », « quand elle tue ») → `effects` ;
- **continu, sans déclencheur** (bonus de Caractéristique, malus de Test, modif de Mouvement, PA) →
  `passive` ;
- **un drapeau que le moteur doit pouvoir INTERROGER**, sans valeur numérique, qui pilote une branche
  de résolution / d'IA / de build → `capabilities`.

« Difficile à exprimer » n'autorise **jamais** un repli en machinerie ni un champ ad hoc — c'est le
signal qu'il faut étendre le vocabulaire.

## 2. Canal `passive` — le continu

Le même vocabulaire d'ops que les sorts. Le collecteur UNIQUE est `passiveMods`
(`src/engine/trauma.ts:983`) ; **ne jamais lire un champ typé d'origine** dans un consommateur — toujours
passer par ses helpers d'extraction. Détail complet (profils d'annulation, combinaison, branches du
collecteur) : `docs/systeme-passifs.md`.

Documents porteurs :

| Document | Champ(s) | Def | Entrées porteuses |
|---|---|---|---|
| `src/data/etats.json` | `passive` | `src/data/schemas/defs/etats.ts` | 9 / 21 |
| `src/data/maladies.json` | `infectionPassive` | `src/data/schemas/defs/maladies.ts` | 1 / 18 |
| `src/data/mutations.json` | `passive` | `src/data/schemas/defs/mutations.ts` | 84 / 116 |
| `src/data/naval-traits.json` | `passive` | `src/data/schemas/defs/naval-traits.ts` | 9 / 27 |
| `src/data/psychology.json` | `passive` | `src/data/schemas/defs/psychology.ts` | 1 / 9 |
| `src/data/qualities.json` | `passive` | `src/data/schemas/defs/qualities.ts` | 17 / 59 |
| `src/data/symptoms.json` | `passive`, `passiveBySeverity`, `visiblePassive` | `src/data/schemas/defs/symptoms.ts` | 10 / 18 |
| `src/data/talents.json` | `passive` | `src/data/schemas/defs/talents.ts` | 21 / 187 |
| `src/data/traits.json` | `passive` | `src/data/schemas/defs/traits.ts` | 26 / 132 |
| `src/data/trappings.json` | `passive` | `src/data/schemas/defs/trappings.ts` | 15 / 441 |
| `src/data/traumas.json` | `passiveKind` | `src/data/schemas/defs/traumas.ts` | 0 / 29 |

## 3. Canal `effects` — le déclenché

Un `TriggeredEffect` (`src/engine/flowCore.ts:567`) est un Flow d'ops appliqué à `on` quand `trigger` se
produit — le MÊME Flow que les sorts, jamais un handler en dur par nom d'entité.

| Champ | Type | Rôle (JSDoc) |
|---|---|---|
| `trigger` | `EffectTrigger` | — |
| `on` | `EffectTargeting` | — |
| `flow` | `Flow<E>` | — |
| `condition?` | `string` | Filtre du déclencheur `onGainCondition` : ne réagit que si l'État GAGNÉ a cet `id` (Mâchoires d'acier : `condition:'sonne'`). |
| `attackType?` | `'melee' \| 'ranged'` | Filtre par TYPE d'attaque (`onHit`/`onWoundLoss`) : ne réagit que si la touche/perte provient d'une attaque de ce type (`melee`/`ranged`). |
| `optional?` | `boolean` | Effet OPT-IN (RAW « Vous pouvez… » — Contrôle de la Frénésie, LDB 10 l.251-255) : le porteur CHOISIT de le déclencher. |
| `source?` | `EffectSource` | ENTITÉ SOURCE — JAMAIS authorée : posée à l'ÉNUMÉRATION par `effectSourcesOf` (`src/state/triggeredEffects.ts`), qui seule sait de quelle entité l'effet est tiré. |

### Les 20 déclencheurs (`EffectTrigger`, `src/engine/flowCore.ts:538`)

`onHit` · `onCrit` · `onWoundLoss` · `onSlain` · `onRoundStart` · `onStartled` · `onKill` · `onCharged` · `onGainCondition` · `onCombatStart` · `onCombatEnd` · `onRoundEnd` · `onTurnStart` · `onTurnEnd` · `onDayStart` · `onWake` · `onAttackResolved` · `onCastResolved` · `onMiscast` · `onOwnTestFailed`


### Les 6 formes de ciblage (`EffectTargeting`, `src/engine/flowCore.ts:564`)

- `'self'`
- `'victim'`
- `'engaged'`
- `'grappled'`
- `{ near: 'victim' \| 'self'; radiusMeters: number }`
- `{ pick: 'engaged'; sizeAtMost?: 'self'; max: number }`

### Le dispatcher unique — `fireTriggers`

`fireTriggers` (`src/state/triggeredEffects.ts:475`) est le **SEUL** point d'entrée pour jouer les effets
déclenchés d'un combattant. Il réunit ses sources via `effectSourcesOf` (`src/state/triggeredEffects.ts:102`), qui
énumère aujourd'hui **8 kinds** dans un ordre FIGÉ (déroulé RNG déterministe) :
`trapping` → `trait` → `quality` → `talent` → `symptom` → `mutation` → `condition` → `psychology`.

**Ajouter une source de déclenché = l'ajouter dans `effectSourcesOf`**, jamais un chemin de dispatch
parallèle. C'est là, et nulle part ailleurs, que se lit la liste des porteurs reconnus.

Documents porteurs :

| Document | Champ(s) | Def | Entrées porteuses |
|---|---|---|---|
| `src/data/domains.json` | `effects` | `src/data/schemas/defs/domains.ts` | 5 / 20 |
| `src/data/etats.json` | `effects` | `src/data/schemas/defs/etats.ts` | 11 / 21 |
| `src/data/maneuvers.json` | `effects` | `src/data/schemas/defs/maneuvers.ts` | 16 / 20 |
| `src/data/mutations.json` | `effects` | `src/data/schemas/defs/mutations.ts` | 1 / 116 |
| `src/data/psychology.json` | `effects` | `src/data/schemas/defs/psychology.ts` | 1 / 9 |
| `src/data/qualities.json` | `effects` | `src/data/schemas/defs/qualities.ts` | 10 / 59 |
| `src/data/spells.json` | `effects` | `src/data/schemas/defs/spells.ts` | 576 / 576 |
| `src/data/symptoms.json` | `effects` | `src/data/schemas/defs/symptoms.ts` | 1 / 18 |
| `src/data/talents.json` | `effects` | `src/data/schemas/defs/talents.ts` | 4 / 187 |
| `src/data/traits.json` | `effects` | `src/data/schemas/defs/traits.ts` | 25 / 132 |
| `src/data/trappings.json` | `onHitEffects` | `src/data/schemas/defs/trappings.ts` | 6 / 441 |

## 4. Canal `capabilities` — l'irréductible

Réservé aux drapeaux que le moteur **interroge** (résolution, IA, psychologie, build, artisanat),
SANS formule ni déclencheur : un booléen (ou un petit scalaire) qui pilote une branche de code, pas
un chiffre qui s'additionne.

| Interface | Site | Drapeaux déclarés |
|---|---|---|
| `TraitCapabilities` | `src/data/index.ts:1704` | 43 |
| `QualityCapabilities` | `src/data/index.ts:1902` | 26 |
| `ItemCapabilities` | `src/data/index.ts:1113` | 12 |
| `SymptomCapabilities` | `src/data/index.ts:1969` | 6 |

Lecture — un seul point d'entrée par portée, chaque canal restant disjoint par nom de capacité :

| Lecteur | Site | Portée |
|---|---|---|
| `traitCapability` | `src/engine/traits/dispatch.ts:222` | par trait |
| `itemCapability` | `src/engine/capabilities.ts:25` | par objet |
| `hasCapability` | `src/engine/capabilities.ts:45` | agrégat cross-source, par personnage |

### Une capacité peut être ANNULÉE par un autre trait porté

`suppressesCapabilities` (lu par `traitCapability`, `src/engine/traits/dispatch.ts:226`) : un trait déclare
les capacités qu'il annule chez **les autres traits du même porteur** — la résolution rend `false`
même si un second trait la déclare. C'est de la DONNÉE, jamais un chemin de code par nom de trait :
1 entrée(s) de `src/data/traits.json` l'exercent, dont `dresse-dompte`
(« Dressé (Dompté) ») qui annule `bestial`.

### Une capacité est un marqueur de PRÉSENCE, jamais un nombre

Le drapeau dit qu'une mécanique s'applique ; sa VALEUR (Salve N, Protectrice N, Solide N…) vit sur
l'INSTANCE portée par l'objet — `QualityInstance.value` (`src/engine/types.ts:362`), que le
dispatcher runtime expose sous `indice` (`resolveQualities`, `src/engine/qualities/dispatch.ts:56`).
La saisie en prose (« Solide 3 ») n'est convertie en instance qu'à l'AUTHORING, par
`parseQuality` (`src/engine/qualities/normalize.ts:31`) — le runtime ne re-parse jamais un libellé
(convention `indice:{label}` côté champ d'édition). N'ajoute donc **jamais** un drapeau numéroté
(`salve3`) : la capacité marque la présence, l'Indice se lit sur l'instance.

Au Codex, `capabilities` n'a **pas** de widget dédié : il retombe dans le formulaire générique
inféré, qui projette l'objet en sous-champs (une case à cocher par booléen).

Documents porteurs :

| Document | Champ(s) | Def | Entrées porteuses |
|---|---|---|---|
| `src/data/qualities.json` | `capabilities` | `src/data/schemas/defs/qualities.ts` | 31 / 59 |
| `src/data/symptoms.json` | `capabilities` | `src/data/schemas/defs/symptoms.ts` | 6 / 18 |
| `src/data/traits.json` | `capabilities` | `src/data/schemas/defs/traits.ts` | 51 / 132 |
| `src/data/trappings.json` | `capabilities` | `src/data/schemas/defs/trappings.ts` | 20 / 441 |

## 5. Éditer — au Codex, jamais en dur

- `passive` → `GameOpEditor`, la primitive de liste d'ops EXISTANTE (celle des sorts) ;
- `effects` → le champ d'effets déclenchés, qui compose le même éditeur d'ops sous chaque feuille ;
- `capabilities` → formulaire générique inféré (§4) ;
- la sauvegarde réécrit le `.json` app-owned ; Vite recharge.

**Réutiliser, ne jamais réinventer** : toute liste d'ops passe par la primitive partagée (table des
primitives, `CLAUDE.md`). Ne pas dupliquer une op qui existe déjà sous un autre nom.

## 6. Frontière donnée / machinerie

- **Donnée** = tout ce qu'un designer voudrait pouvoir varier par entité, éditable au Codex →
  `passive` / `effects` / `capabilities`.
- **Machinerie** = les règles UNIVERSELLES de l'arène, qui ne nomment AUCUNE entité (décrément des
  durées, ré-ordonnancement d'initiative, purge des invocations…) — elles s'enregistrent par
  `registerCombatHook` (`src/state/combatHooks.ts:57`), la primitive unique des hooks de combat.
- Un hook qui teste un id d'entité en dur est une **dette démasquée** : il doit migrer vers les
  `effects`/`passive` de l'entité nommée et disparaître du registre de hooks. La garde qui le fait
  rougir est listée ci-dessous.
- La doctrine complète (et ses cas jugés) vit dans `docs/combat-events-coherence.md`.

## 7. Recettes

- **Modificateur de profil sur un trait** : Codex → le trait → `passive` → `+` une op de
  modificateur. La def TS du registre ne porte que le libellé.
- **Effet « à la touche » sur un Atout d'arme** : Codex → la qualité → `effects` → une entrée dont
  le `trigger` est le déclencheur voulu et le `flow` la conséquence.
- **Capacité irréductible sur un trait** : Codex → le trait → `capabilities` → la case ; puis
  ajouter la LECTURE (`traitCapability`) au site qui en a besoin.

## Gardes

| Garde | Ce qu’elle verrouille (son propre `describe`) |
|---|---|
| `src/ui/compendium/no-json-fields.test.ts` | Codex — aucun champ éditable n’infère kind:json (E3b) |
| `src/data/defs-migrated.test.ts` | Traits et Qualités : mécanique en DONNÉE, résolution PAR ID |
| `src/data/data-wellformed.test.ts` | Intégrité des données src/data/*.json |
| `src/engine/trauma.test.ts` | traumaFromKind (LDB 18-Traumatisme) |
| `src/state/triggered-effects.test.ts` | fireTriggers — Traits et Atouts sur le même système flow+déclencheur |
| `src/state/combat-hardcode-guard.test.ts` | garde-fou « tout migrer » — réactions de combat hardcodées (cliquet généralisé, Lot 8) |
<!-- sources-empreinte: a8a4e4842fcf27fbbcaec3a98f872c91625c6d6f (158 fichiers, 1 dossiers) corps: 98e28f7b5766877461749bba6575b18d2ae5bf88 -->
