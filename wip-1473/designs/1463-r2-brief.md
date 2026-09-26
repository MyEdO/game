# #1463 · concept RÉFÉRENCE — brief du lot R2, v1 (2026-09-24) : les listes d'entités des documents `config` au registre

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466
ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et
gameOpRefFk.mjs ». Épique : #1463. Voisins : #1528 « Ids de racine des documents config non FK-ables : genIds ne
les indexe pas — ouverture d'un espace FK gatée par l'arbitrage des collisions inter-racines » (ouvert le
2026-08-28), #1932 (références typées par une liste d'ids recopiée), #1902 (`miscast.json`).

Worktree : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1` (lots R1 et R1-bis, CI verte à
`fc7b527fb`). Grounding : rendu de lecteur du 2026-09-24 (recoupé aux points cités) et jugement du lot R1-bis
(même date, lentille 1).

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une
structure plus adapté ».
Consigne de l'utilisateur, 2026-09-23 : « Dit leur de penser a intégrer les chantiers en cours qui sont en
rapport avec leur sujet et qui traine surement dans un worktree avec possiblement du travail en cours et non
fini. Si c'est le cas, surtout relire les tickets concernés mais aussi les commentaires ».
Chantier en cours en rapport : `chantier/1897-doublons-fan` (fil « Mécaniques des sorts », #1897, non fusionné,
tête `ab077ed7e`), commit `fae8ea80c` : `export const marqueurs` lu textuellement par `marqueursDeclares`
(`scripts/gen-registry.mjs`), table `IDS_PAR_MARQUEUR`, lecture `porteLeMarqueur` (`ref.ts`). Même patron que
`discriminant`, mêmes fichiers. Le fil a été prévenu le 2026-09-24.

## Invariant

1. Verbatim (brief R1 v1.1 de #1473, https://github.com/cgauche/game/issues/1473#issuecomment-5801354411) :
   « **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** »
   Question : où une référence à une entité se déclare-t-elle ? Sur une feuille `idDe(type)`, validée au parse
   contre le registre généré.
2. Verbatim : « `config` ⇒ aucun id, aucun défaut — non par principe, mais parce qu'`estRecordAIds` refuse une
   racine `id`+`label` (état courant, réversible : #1528). »
   Source : `scripts/gen-registry.mjs:586-588` (JSDoc de `verifieExhaustiviteDesIds`).
   Question à laquelle elle répondait : pourquoi le registre ne porte-t-il aucun id de RACINE d'un document
   `config` ? Réponse : par état courant, pas par principe. Elle ne dit rien des éléments à `id` qu'un `config`
   porte DANS ses listes : c'est la question de ce lot.
3. Verbatim : « Les 3 EMBALLAGES de fichier d'un document : liste d'entrées, entrée seule, record clé → valeur. »
   Source : `src/data/schemas/grammaire/document.ts:21`.
   Question : qu'est-ce qu'une famille de document ? Un emballage de fichier, pas une nature d'entité. Un
   document `config` peut donc porter des entités dans une liste.
4. Verbatim : « Un type s'ajoute avec le lot qui le migre, jamais « au cas où ». »
   Source : `src/data/schemas/grammaire/ref.ts:44`, dernière phrase du JSDoc de `TYPES` (`:38-44`), qui
   énumère les types entrés lot par lot (Compétence, puis Talent/Trait/…, la Table, la Matière #1686, le
   Terrain et le Décor #1690).
   Question à laquelle elle répondait : quand un type entre-t-il dans `TYPES` ? Réponse : dans le commit qui
   migre ses sites de référence vers `idDe`, jamais avant. Portée pour ce lot : D4 n'ajoute un type de liste
   de `config` qu'avec la migration d'au moins un désignateur réel ; une liste que rien ne désigne n'entre pas
   dans `TYPES`, même si D2 l'indexe (question 7).

## Constat (mesures à re-faire par le juge et le codeur)

- `idsDuDataset` (`scripts/gen-registry.mjs:515-526`) n'indexe qu'une racine tableau ou un record : toute
  racine `config` rend `null`. Aucun `config` n'a d'ids au registre.
- 41 documents `config` sous `src/data/schemas/defs`, dont 26 portent au moins une liste d'éléments à `id`
  (≈ 60 listes). Désignateurs confirmés par le lecteur, typés `z.string()` aujourd'hui :
  - `crew-test-types.json › types[]` ← `naval-traits.json` `skillDRBonus.testType` (2), FK tenue par
    `scripts/guards/lib/gameOpRefFk.mjs` ; ← `sea-events.json` `params.testType` (3), dans un record NON TYPÉ
    (`defs/sea-events.ts:32-35`, `params: z.record(z.string(), z.unknown())`).
  - `sea-weather.json › precipitations/temperatures/visibilites/vents[]` ← `sea-events.json` `params` (même sac
    non typé) et le document lui-même.
  - `sea-cargo.json › cargoes[]` ← `naval-ports.json › production` (`defs/naval-ports.ts:21`), ←
    `defs-scenes/worldmap.ts:36` `portProfileSchema.production`.
  - `land-cargo.json › cargoes[]` ← `defs-scenes/worldmap.ts:65` `landMarketProfileSchema.produits`.
  - `mass-battle.json › warMachines[]` ← `trappings.json › siegeRig` (typage non vérifié).
  - `crew-test-types.json › types[].roles`, `.essential` → `crew-roles.json`, type `crewRole` DÉJÀ au registre,
    en `z.string()` (sens inverse : désignateurs DANS une liste de config).
  - Faux ami écarté : `voyage-stakes.json › kind` (42 valeurs, 5 coïncidences, vocabulaire d'étape de cascade).
- Consommateurs moteur de ces listes : `.find((c) => c.id === id)` en mémoire (`findCrewTestTypeById`,
  `src/data/index.ts:2761` ; `findCargoById`, `src/engine/seaVoyage.ts:108` ; `findLandCargoById`,
  `src/engine/landCargo.ts:64`), sans validation au parse : un id mort rend `undefined` en silence
  (`src/state/portFlow.ts:124`).

## Cas canonique déjà couvert

`idDe('material', 'prop')` : une SOUS-LISTE d'ids d'un dataset, déclarée par le def (`export const
discriminant`, lu par `discriminantsDeclares`, `scripts/gen-registry.mjs:533-542`), indexée par
`idsParDiscriminant` (`:553-…`, fail-fast nominatif) dans `IDS_PAR_DISCRIMINANT`, lue par `idsSousListe`
(`src/data/schemas/grammaire/ref.ts:101`) au régime « mémoire d'abord » (`idsVivantsDuDiscriminant`,
`grammaire/idsVivants.ts:47`). Aucun dataset n'est nommé au générateur.

Le nouveau cas en serait une INSTANCE : un emplacement d'ids DÉCLARÉ par le def, que le générateur lit sans
nommer de dataset et que `idDe` lit par la cible de son type. À juger : est-ce une instance, ou une variante
qui demande de généraliser le patron d'abord ?

## Design proposé (à attaquer)

- **D1.** Le def d'un document `config` déclare ses listes d'entités par une ligne de premier niveau lue
  textuellement, comme `file`/`famille`/`discriminant` (forme exacte à fixer : liste de chemins depuis la
  racine du document, `['types']`, `['cargoes']`, `['precipitations', 'temperatures', …]`).
- **D2.** `scripts/gen-registry.mjs` écrit une table sœur d'`IDS_PAR_DISCRIMINANT` (document › liste → ids
  triés), avec le même fail-fast nominatif (liste déclarée absente, élément sans `id` textuel, `id` qui est un
  libellé, doublon). `verifieExhaustiviteDesIds` (`:590`) suit : `config` ⇒ aucun id de RACINE (#1528 reste ouvert sur
  sa question), ids de ses listes DÉCLARÉES indexés.
- **D3.** `TYPES` : la cible d'un type nomme son dataset et, le cas échéant, sa liste
  (`crewTestType: { dataset: 'crew-test-types.json', liste: 'types', specsOpen: false }`). `idsDe` lit la liste
  quand la cible en nomme une, au même régime « mémoire d'abord » : `SourceDIdsVivants`
  (`grammaire/idsVivants.ts`) apprend à rendre les éléments vivants d'une liste de `config` (une entrée créée
  à l'atelier est référençable aussitôt). Un seul `idsDe`, aucune branche par type.
- **D4.** Premier commit du lot : le socle (D1-D3), les types des listes que la donnée DÉSIGNE par un champ
  déclaré, et la migration de ces désignateurs vers `idDe` : `skillDRBonus.testType` (l'entrée de
  `gameOpRefFk.mjs` meurt), `naval-ports.production`, `worldmap.ts:36` et `:65`, `siegeRig` si confirmé,
  `crew-test-types.types[].roles/essential` → `idDe('crewRole')`. Les désignateurs logés dans
  `sea-events.params` attendent le typage de ce record par `kind` (commit 2 du lot, design à lui).
- **D5.** Critère : une liste de `config` de plus que la donnée désigne = une ligne dans son def + une ligne
  dans `TYPES`.

Alternative à peser : sortir chaque liste désignée en document de famille `entite` (forme de `crew-roles.json`).
Le lecteur mesure que cela toucherait les `find*ById`, les clés `codex`/`edit`, et ferait de `mass-battle.json`
cinq fichiers ; et que cela ne répond pas aux quatre listes de `sea-weather.json`.

## Questions posées au jugement

1. Trois déclarations textuelles de même patron (`discriminant`, `marqueurs` sur la branche du fil des sorts,
   et celle de D1) : faut-il les unifier en UNE déclaration de registre par def dans ce lot, et sous quelle
   forme, ou D1 est-elle la bonne instance telle quelle ? Critère « N+1 = une ligne ».
2. D3 : la cible `{ dataset, liste }` et la cible discriminée (`idDe(type, valeur)`) sont-elles le même concept
   (un emplacement d'ids dans un dataset) ? Si oui, quelle forme unique ?
3. D2 et #1528 : indexer les listes sans indexer la racine est-il cohérent avec l'arbitrage des collisions
   inter-racines que #1528 attend ? Un id de liste vit dans l'espace de son TYPE : la collision entre deux
   listes a-t-elle encore un sens ?
4. Le régime vivant (`idsVivants`) et l'édition des `config` au Compendium (`edit: { niche }`,
   `edit: { object: 'single' }`) : une entrée ajoutée à une liste de `config` à l'atelier devient-elle
   référençable sans `npm run gen` ?
5. L'alternative « liste → document `entite` » est-elle plus juste pour certains cas (catalogues à clé Codex
   propre, comme `crew-test-types`) ? Un dépôt qui mêle les deux formes pour le même concept serait-il pire ?
6. Chaque désignateur de D4 : sa valeur réelle est-elle incluse dans les ids de la liste visée (sonde), et
   quel lecteur branche sur les littéraux (qui interdirait une migration nue) ?

7. D2 indexe-t-il TOUTES les listes à `id` des `config` (≈ 60), ou seulement celles que la donnée désigne ?
   Invariant 4 contre « N+1 = une ligne » : quelle forme tient les deux ?

## Périmètre (fichiers que le codeur peut toucher)

- Socle : `scripts/gen-registry.mjs`, `src/data/schemas/_ids.generated.ts` (généré, `npm run gen`),
  `src/data/schemas/grammaire/ref.ts`, `src/data/schemas/grammaire/idsVivants.ts`,
  `src/data/versionDataset.ts` et `src/data/overrides.ts` (poseurs de la source vivante, à lire avant de
  toucher), leurs tests (`grammaire/grammaire.test.ts`, tests de `scripts/gen-registry.mjs`).
- Défs déclarantes : `src/data/schemas/defs/crew-test-types.ts`, `sea-cargo.ts`, `land-cargo.ts`,
  `mass-battle.ts` (si `siegeRig` le désigne).
- Désignateurs : `src/data/schemas/grammaire/mecanique.ts` (`skillDRBonus.testType`),
  `src/data/schemas/defs/naval-ports.ts:21`, `src/data/schemas/defs-scenes/worldmap.ts:36` et `:65`,
  `src/data/schemas/defs/trappings.ts:125` (`siegeRig`, si la sonde le confirme),
  `crew-test-types.ts` (`roles`, `essential`), `scripts/guards/lib/gameOpRefFk.mjs` (entrée `testType`).
- Docs générés que `npm run docs:build` régénère, stocks et cliquets que la migration fait bouger (sorties
  déclarées ligne `CLIQUET:`).
- Hors périmètre : `sea-events.ts` (commit 2), tout lecteur moteur `find*ById` sauf si la question 6 prouve
  qu'il branche sur un littéral.

## Hors lot

Les références de #1932 (types au registre, sites en `z.enum` recopié) : lot R3. Le régime de spécialisation
aux sites d'effet (`refOuSpec` accepte `choix`, jugement R1-bis) : lot R4. `sea-events.params` : commit 2 de
ce lot.
