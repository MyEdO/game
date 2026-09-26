# #1463 · concept RÉFÉRENCE — brief du lot R2 v2 (2026-09-24) : un seul concept d'espace d'ids

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466
ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et
gameOpRefFk.mjs ». Voisins : #1528 « Ids de racine des documents config non FK-ables : genIds ne les indexe pas —
ouverture d'un espace FK gatée par l'arbitrage des collisions inter-racines » ; #1932 (références typées par une
liste d'ids recopiée, lot R3, après celui-ci) ; #1939 (événements de mer, porte les désignateurs de
`sea-events.params`).

**Base jugée** : `55d4ea7fc`, tête de `origin/chantier/1897-doublons-fan` (fil « Mécaniques des sorts », #1897 « Sorts
du livre fan : 47 doublons d'entrées officielles deviennent UNE entité à plusieurs emplacements (lot 1 de #838) »),
non publiée, qui livre le lecteur textuel unique `lireExports`. Arbre de lecture détaché à cette tête :
`/home/claude/game/.wt-1473-r2v2-lecture` (dépendances installées). Le codeur partira d'une branche `chantier/1473-r2` qui fusionne `chantier/1473-r1` et
`55d4ea7fc` (ou `main`, si #1897 publie avant). Les numéros de ligne ci-dessous sont ceux de `55d4ea7fc`.

Historique : la v1 (`/mnt/project-files/dettes/1463-r2-brief.md`) a été RÉFUTÉE le 2026-09-24 (verdict
`/mnt/project-files/dettes/1463-r2-juge-design-v1.json`, 9 bloquants dont 5 structurels). Grounding v2 : rendu de
lecteur du 2026-09-24 sur `55d4ea7fc`, recoupé par l'orchestrateur aux verbatims cités.

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une
structure plus adapté ».

## Invariant

1. Verbatim (brief R1 v1.1 de #1473, https://github.com/cgauche/game/issues/1473#issuecomment-5801354411) :
   « **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** »
   Question à laquelle il répondait : où une référence à une entité se déclare-t-elle ? Sur une feuille `idDe`.
   Portée : les désignateurs de listes de `config` (`skillDRBonus.testType`, `naval-ports.production`…) sont en
   `z.string()`, faute d'un espace d'ids où `idDe` puisse les lire.
2. Verbatim (`.claude/credo.md`) : « Une garde de synchronisation est un smell : une seule source de vérité. »
   Question : combien de déclarations pour « cette liste d'un document est un ensemble d'ids » ? Aujourd'hui
   quatre mécanismes, quatre lecteurs : `export const discriminant` (`defs/materials.ts:34`), `export const
   marqueurs` (`defs/props.ts:18`, `defs/skills.ts:14`, `defs/talents.ts:26`), `exposition.edit.niche.categories`
   (25 defs, ex. `defs/crew-test-types.ts:43`) avec leurs bindings manuscrits `ARRAYS`/`NESTED_ARRAY_ROOT`
   (`src/data/overrides.ts:159-260`, `:350-421`), et les listes des documents `edit: { object: 'single' }`
   (`OBJECTS`, `overrides.ts:275-294`), qui n'en ont aucune.
3. Verbatim (`src/data/schemas/grammaire/document.ts:125-127`) : « `niche.categories` nomme les clés de catégorie
   Codex de CE document qui sont routées comme datasets (`CodexEdit.CATEGORY_DATASET`) : chacune édite UN champ
   tableau du document, jamais le document entier ».
   Question à laquelle il répondait : que désigne une catégorie niche ? Un champ tableau du document, c'est-à-dire
   une liste d'entrées à `id`, éditée comme un dataset. C'est déjà un espace d'ids ; le registre l'ignore.
4. Verbatim (`src/data/config-id-unique.test.ts:20-21`) : « ANGLE MORT DIT : les espaces de noms NICHÉS (jetons de
   scène, sous-entrées) ne sont pas relevés — seul le PREMIER NIVEAU l'est, qui est le seul que `IDS_PAR_DATASET`
   indexe. »
   Question : qu'indexe le registre ? Le premier niveau seulement. La lacune est dite, pas justifiée.
5. Verbatim (`src/data/schemas/grammaire/ref.ts:39`) : « Un type s'ajoute avec le lot qui le migre, jamais « au cas
   où ». »
   Question : quand un type entre-t-il dans `TYPES` ? Dans le commit qui migre ses désignateurs vers `idDe`.
   Portée : un ESPACE déclaré n'est pas un TYPE. L'espace existe dès que le def le déclare (l'édition l'exige
   déjà) ; le type n'entre que pour un désignateur réel.
6. Verbatim (`.claude/credo.md`) : « Étendre le général et le paramétrer plutôt que créer un parallèle ».
   Question : que faire du troisième, quatrième régime ? Les fondre dans un seul, paramétré.

## Cas canonique déjà couvert

- **Lecteur textuel unique des exports de def** : `lireExports(src, noms, def)` (`scripts/gen-registry.mjs:393-411`),
  formes fermées `FORMES_D_EXPORT` (`:367-373`) ; tout export hors forme lève en nommant le def.
- **Table générée et lecture d'un id** : `IDS_PAR_DATASET` (`genIds`, `gen-registry.mjs:668-753`), lu par `idsDe`
  (`ref.ts:90-96`) au régime « mémoire d'abord » (`idsVivants`, `grammaire/idsVivants.ts:66-68`).
- **Sous-liste filtrée, deux régimes** : par valeur (`idsParDiscriminant`, `gen-registry.mjs:620-635` →
  `IDS_PAR_DISCRIMINANT` → `idsSousListe`, `ref.ts:105-122` → `idsVivantsDuDiscriminant`, `idsVivants.ts:72-76`) ;
  par présence et valeur (`idsParMarqueur`, `:599-609` → `IDS_PAR_MARQUEUR` → `porteLeMarqueur`, `ref.ts:132-141`
  → `idsVivantsDuMarqueur`, `idsVivants.ts:90-92`, prédicat unique `porteLeChampMarqueur`, `:83-86`).
- **Clé de record typée** : `hauteurs: z.record(idDe('shipStation'), formulaSchema)` (`defs/ship-criticals.ts:26`).

Le nouveau cas serait une INSTANCE si les quatre mécanismes deviennent un seul, paramétré par (document, chemin,
filtre), et si une liste de `config` n'est qu'un espace de plus, sans branche dans `idsDe`. À juger.

## Constat (mesures du lecteur, à re-faire par le juge et le codeur)

- `IDS_PAR_DATASET` n'indexe que la racine des documents `entite`/`record` ; `verifieExhaustiviteDesIds`
  (`gen-registry.mjs:651-666`) ferme `config` ⇒ aucun id de racine, et ne dit rien des listes nichées.
- Le régime vivant est keyé par FICHIER (`SourceDIdsVivants`, `idsVivants.ts:24-32`) et EXCLUT les listes nichées
  (`overrides.ts:443-461`, verbatim : « NICHÉS EXCLUS — un tableau niché (`mass-battle.json` en porte 5,
  `criticals.json` 8) n'est pas la liste d'entrées de son document, et son fichier désigne le PARENT »). Les
  datasets-objets (`OBJECTS`) n'ont aucun chemin vers lui.
- `TYPES` : cible `{ dataset, catalogue }` (`ref.ts:24-30`) ; aucun type ne vise une liste de `config`.
- Désignateurs réels, aujourd'hui en `z.string()` (v1 et son verdict) :
  - `crew-test-types.json › types[]` ← `skillDRBonus.testType` (`naval-traits.json`, 2 valeurs, incluses) ;
    ← `sea-events.params.testType` (#1939, hors lot).
  - `crew-test-types.types[].roles` et `.essential` → `crew-roles.json`, type `crewRole` DÉJÀ dans `TYPES`
    (`ref.ts:56`) ; 60 valeurs, 0 hors liste.
  - `sea-cargo.json › cargoes[]`, DEUX populations (marchandises, et marqueurs d'Index `commerce`/`minimum-vital`,
    `src/engine/cargo.ts:29-53`) ← `naval-ports.production` (entrées), `surplus`/`demande` (`naval-ports.ts:21-23`,
    clés de record, marchandises), `defs-scenes/worldmap.ts:36-39` (mêmes champs).
  - `land-cargo.json › cargoes[]` (marqueurs `commerce`/`subsistance`, `landCargo.ts:23-65`) ←
    `worldmap.ts:65-67` `produits`, `demande`.
  - `sea-weather.json` (document objet), 4 listes ← `sea-events.params` (#1939, hors lot).
  - Faux amis écartés par le juge v1 : `siegeRig` (désigne un rig), `voyage-stakes.kind`.
- Unions littérales d'ids écrites à la main : `raceKeySchema` (`grammaire/valeurs.ts:588-591`, `z.enum` de 7 espèces),
  consommée par de nombreux `Record<RaceKey, …>` (`src/data/index.ts:809`, `:1590-1596`…) ; relève de #1932.
- Collisions de termes : « marqueur » a au moins trois sens métier (`NARRATIVE_MARKERS`, `engine/conditions.ts:60` ;
  marqueurs d'Index des cargaisons ; marqueur d'état en combat, `engine/combat.ts:100-104`) en plus du sens du
  registre ; « emplacement » désigne déjà l'emplacement d'avancement (`src/data/index.ts:897`) et des outils
  d'éditeur ; « niche » désigne aussi la niche d'États (`defs/actions.ts:36`).

## Design proposé (à attaquer)

- **E1. Un concept, un nom : l'ESPACE D'IDS** = (document, chemin, filtre). Chemin : vide (la racine d'un
  document `entite`/`record`) ou un champ tableau (`types`, `cargoes`, `precipitations`). Filtre : aucun, par
  VALEUR d'un champ (ex-`discriminant`, un espace par valeur), ou par PRÉSENCE (ex-`marqueurs`, prédicat
  `porteLeChampMarqueur`). Terme choisi pour éviter « marqueur », « emplacement » et « niche », déjà chargés ; il
  reprend « espaces de noms » de l'Invariant 4.
- **E2. Une seule déclaration par def**, lue par `lireExports` : `export const espaces = { … };` sur une ligne, forme
  `dictionnaire` ajoutée à `FORMES_D_EXPORT`. Clé = nom de l'espace (pour une liste éditée, la clé de catégorie
  Codex, `crewTestTypes`) ; valeur = sélecteur `chemin[?champ[=]]`. Remplace `discriminant` et `marqueurs` ;
  `exposition.edit.niche.categories` et les bindings `NESTED_ARRAY_ROOT` (chemin manuscrit) en DÉRIVENT. La racine
  d'un document `entite`/`record` reste implicite (espace = fichier).
- **E3. Une seule table générée**, `IDS_PAR_ESPACE`, keyée par une clé d'espace canonique
  (`fichier`, `fichier#chemin`, `fichier?champ`, `fichier?champ=valeur`). Meurent `IDS_PAR_DISCRIMINANT`,
  `IDS_PAR_MARQUEUR`, et `IDS_PAR_DATASET` sous son nom. `SPECS_PAR_DATASET` reste (autre concept : catalogue de
  spécialisations). `verifieExhaustiviteDesIds` ferme : tout espace déclaré est indexé ; `config` n'a toujours
  aucun espace de racine (#1528 inchangé).
- **E4. Un seul chemin de lecture** : la cible d'un type nomme son espace (`TYPES.crewTestType = { espace:
  'crew-test-types.json#types', catalogue }`) ; `idsDe(type, valeur?)` compose la clé et lit la mémoire puis la
  table, sans branche par régime. `idsSousListe`, `porteLeMarqueur` (ou sa signature) et les `idsVivantsDu*`
  meurent ou deviennent des appels de ce chemin.
- **E5. Un seul lecteur vivant** : `SourceDIdsVivants.entrees(espace)` ; `overrides.ts` pose la source pour TOUS
  les espaces (racines, listes nichées, listes des documents objets), depuis la même déclaration. L'exclusion des
  nichés tombe : un tableau niché n'est pas la liste de son document, mais il est SON espace.
- **E6. Commit 1 = socle, sans changement de comportement** : E1-E5, migration des déclarations existantes
  (`discriminant`, `marqueurs`, 25 `niche`), preuve que les ids résolus sont identiques avant et après (ancienne
  table vs nouvelle, par espace). **Commit 2 = types et désignateurs** : `crewTestType`, les deux cargaisons
  (noms distincts, ids qui se recoupent : `produits-de-luxe`, `bois`, `vin`…), leurs désignateurs
  (`skillDRBonus.testType`, `roles`/`essential` en `idDe('crewRole')`, `production`, `surplus`/`demande` en
  `z.record(idDe(…), …)`, `worldmap.ts:36-39` et `:65-67`), chaque migration prouvée par sa sonde d'inclusion.
- **E7. Critère « N+1 = une ligne »** : une liste de plus = une clé dans `export const espaces` de son def ; un
  type de plus = une ligne dans `TYPES`.
- **E8. Registre des fossiles** : aucun shim. Ce qui meurt meurt dans le commit 1 (exports `discriminant`/
  `marqueurs`, tables sœurs, lecteurs sœurs, champ `niche.categories` s'il devient dérivé, bindings manuscrits).

## Questions posées au jugement

1. E1 : le triplet (document, chemin, filtre) couvre-t-il les quatre mécanismes sans reste ? La partition par
   valeur (un espace par valeur de `domain`) est-elle un filtre comme les autres, ou un second concept ?
2. E2 : la déclaration textuelle `export const espaces` peut-elle porter la clé de catégorie Codex, ou la
   dérivation `niche` a-t-elle besoin d'autre chose (route d'édition, fichier parent réécrit au save,
   `object: 'single'`) ? Une liste d'un document objet doit-elle devenir éditable comme une niche, ou seulement
   référençable ?
3. E3 : `fichier#chemin?champ=valeur` est-elle la bonne forme de clé, lisible par les messages de refus d'`idDe`
   (le refus nomme aujourd'hui `catalogue`, pas le fichier) ?
4. E4 : la cible `{ espace }` remplace-t-elle `{ dataset }` partout (`cibleDe` a d'autres lecteurs : lesquels) ?
5. E5 : la réécriture de `SourceDIdsVivants` casse-t-elle un invariant du régime vivant (version par fichier,
   mémo, `bumperDataset` de `versionDataset.ts`) ? Une entrée ajoutée à une liste nichée au Compendium est-elle
   référençable sans `npm run gen` après E5 ?
6. Cargaisons : deux populations dans une liste. Filtre sur quel champ, avec quelle valeur, et la donnée le
   porte-t-elle déjà (marchandises sans `echangeable`, marqueurs à `false`) ? Faut-il un espace « marchandises » et
   un espace « entrées », ou un seul et une restriction au site ?
7. Fermeture dans l'autre sens : un `z.string()` dont toutes les valeurs appartiennent à un espace déclaré sans
   type est un désignateur non migré. Quelle garde le voit ? Celle de #1932 (R3), ou une garde de ce lot ?
8. Unions littérales : le registre doit-il exporter l'union des ids d'un espace, pour que `raceKeySchema` et ses
   `Record<RaceKey, …>` en dérivent ? Ce lot, ou #1932 ?
9. Ordre de fusion avec #1897 : ses lots en vol ne touchent ni `gen-registry.mjs`, ni `ref.ts`, ni `idsVivants.ts`
   (message du fil #1897, 2026-09-24). La base `55d4ea7fc` est-elle suffisante, ou faut-il attendre sa publication ?

## Périmètre (fichiers que le codeur pourra toucher)

- Socle : `scripts/gen-registry.mjs`, `src/data/schemas/_ids.generated.ts` (par `npm run gen`),
  `src/data/schemas/grammaire/ref.ts`, `src/data/schemas/grammaire/idsVivants.ts`, `src/data/overrides.ts`,
  `src/data/versionDataset.ts`, `src/data/schemas/exposition-derivee.ts`, `src/data/schemas/grammaire/document.ts`,
  `src/data/index.ts` (bindings manuscrits), et leurs tests (`src/data/schemas/gen-contrat-ids.test.ts`,
  `grammaire/grammaire.test.ts`, `src/data/config-id-unique.test.ts`…).
- Defs déclarants : les 25 defs à `niche`, `defs/materials.ts`, `defs/props.ts`, `defs/skills.ts`, `defs/talents.ts`,
  et les defs `object: 'single'` qui portent des listes désignées.
- Désignateurs (commit 2) : `grammaire/mecanique.ts` (`skillDRBonus.testType`), `defs/crew-test-types.ts`,
  `defs/naval-ports.ts`, `defs-scenes/worldmap.ts`, et `scripts/guards/lib/gameOpRefFk.mjs`.
- Hors périmètre : `defs/sea-events.ts` (#1939), les unions de #1932 si la question 8 les renvoie à R3.
