## Design — UNE mécanique de marque de nœud, sur le registre de zod (#1463, #1473, socle de R2), 2026-09-24, v2

v1 (`1463-marque-de-noeud-design-v1.md`) : **RÉFUTÉ** par le workflow `juge-design-socle`, run `wf_5c3eb8d3-ea9`
(verdict : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-marque-de-noeud/verdict.json`,
sondes dans le même dossier). Trois bloquants structurels d'une même racine : v1 fabriquait un canal d'héritage parallèle
(« contrôle porteur ») alors que zod en a un, le registre et sa chaîne `_zod.parent` ; et un contrôle posé sur chaque
nœud marqué ne peut pas porter la feuille `idDe` (un pipe sans contrôle) et fait lever `.pick`/`.omit`/`.partial`. Sept
retouches. Leur traitement est en fin de document.

Origine du socle : le juge du design « valeur par membre » (`1463-par-membre-design-v1.md`, run `wf_5a2555ce-553`,
RÉFUTÉ) pose en bloquant structurel B2 : « Poser dans le design, avant D1, une seule mécanique de marque de nœud : un
registre de marques typées, un seul `…Perdues`, une seule co-descente qui rend toutes les marques d'un point. » La valeur
par membre et le marqueur au champ (`1463-marqueur-au-champ-design-v1.md`) en deviennent deux déclarations.

## Invariant

1. En-tête de `src/data/schemas/grammaire/collection-cle.ts` (verbatim) : « une collection dont chaque élément a une
   IDENTITÉ, DÉCLARÉE au nœud qui la porte, jamais devinée. » Question à laquelle il répond : où se déclare un fait de
   structure ? Réponse : au nœud de schéma, et on le relit au nœud.
2. Credo, `.claude/credo.md` (verbatim) : « Réutiliser l'existant — le CANONIQUE, pas le voisin. […] Étendre le général
   et le paramétrer plutôt que créer un parallèle ». Question : où se range un fait posé au nœud ? Réponse : dans le
   mécanisme que la bibliothèque de schéma fournit pour cela, pas dans une table maison à côté.
3. En-tête de `src/data/schemas/grammaire/document.ts` (verbatim) : « Elle rend un HANDLE FERMÉ : le schéma sort SCELLÉ,
   si bien que `.extend` et `.shape` n'existent plus NI au type NI au runtime (zod 4.4.3 perd le registre et la `.meta()`
   d'un nœud à l'extension — la composition se fait ICI, une fois, ou pas du tout). » Question : une opération de zod
   perd-elle un fait posé au nœud en silence ? Réponse : jamais en silence ; ici, l'opération disparaît.

## Cas canonique déjà couvert

- **Le registre de zod.** `node_modules/zod/v4/core/registries.js:30-41` (verbatim) : `get(schema) { // inherit metadata
  const p = schema._zod.parent; if (p) { const pm = { ...(this.get(p) ?? {}) }; …`, et `core/util.js:261-265` : `clone(
  inst, def, params) { … if (!def || params?.parent) cl._zod.parent = inst;`. Zod rattache une donnée à un nœud et la
  transmet aux clones qui gardent le sens du nœud (`.min`, `.refine`, `.superRefine`, `.meta`, `.describe` : sonde du
  juge, `scratchpad/juge-marque-de-noeud/sortie.txt`, bloc A). zod 4.4.3 (`node_modules/zod/package.json`).
- **Un usage dans le dépôt** : `enumNomme` range ses libellés au registre global de zod par `.meta()` (`valeurs.ts:40`),
  et `valeursDe` les relit (`meta.ts:55`).
- **Le scellement** : `document()` rend un pipe (`document.ts:504`, `affine.pipe(z.transform((v) => v))`) qui ôte
  `.extend` et `.shape`.
- **La co-descente** : `coDescendre` (`grammaire/descente.ts:208`) expose à chaque point ses nœuds
  (`PointDeDonnee.noeuds`, `:193-200`) ; `descendre` parcourt le schéma seul.

Le cas neuf en est une instance : chaque genre de marque (collection, feuille d'id, vocabulaire, marqueur, valeur par
membre) est une donnée rangée au registre de zod sur le nœud qui la porte ; seule la valeur change de type.

## Constat (arbre `61fef43d7`, sondes du juge, à attaquer)

- Trois tables maison : `COLLECTIONS` et `CONTROLES` (`collection-cle.ts:60`, `:62`), `FEUILLES_D_ID` (`ref.ts:200`) ;
  `grep -rn "new WeakMap" src/data/schemas` n'en rend pas d'autre (juge).
- Clones de zod (sortie de sonde collée plus haut dans ce fil, bloc B et D) : sur un objet, `.extend`, `.safeExtend`,
  `.catchall`, `.strip`, `.required` clonent SANS parent et recopient les contrôles ; `.pick`, `.omit`, `.partial` LÈVENT
  sur un objet qui porte un contrôle (« cannot be used on object schemas containing refinements ») ; sur un enum,
  `.extract` clone sans parent (`meta après .extract = false`). Les enveloppes (`.optional`, `.default`, `.transform`,
  `.pipe`) laissent le nœud intérieur intact, et `ouverts` le traverse.
- La feuille `idDe` est un pipe sans contrôle (`checks du nœud = 0`, bloc E) : aucun contrôle ne peut la porter.
- Le contrôle d'une collection `record` ne valide rien (`collection-cle.ts:122`, `if (marque.forme !== 'liste' …)
  return;`) : il ne sert qu'à porter la marque.
- Lecteurs des marques, par `git grep -n "typeDeFeuilleDId\|estFeuilleDId\|collectionDe"` (juge, 8 fichiers) :
  `schemas/validate.ts:54`, `:130`, `:157` ; `collection-cle.ts:98-101` (`porteUneFeuilleDId`, à la construction),
  `:158-163`, `:170`, `:319-326` ; `ref.ts` ; `scripts/docs/lib/slots-registre.mts:122-124` (schéma seul, sur
  `OP_DEFS`) ; tests `collection-cle.test.ts`, `co-descente.test.ts`, `parse-de-mesure.test.ts`,
  `sortsFusionnes.test.ts`. `valeursDe` est lu par 10 fichiers de `src/ui` (juge).
- Une contrainte ENTRE genres, à des points différents : `collection-cle.ts:113-116` refuse `espace` quand la clé
  d'élément est une feuille `idDe`.
- Deux mécanismes de perte existent : `collectionsPerdues` (`collection-cle.ts:170`) et le refus de
  `.extract`/`.exclude` d'`enumNomme` (`valeurs.ts:43-48`), doublé de la garde de `valeurs-de-champ.test.ts`.
- Le scan des structures reçoit des faits des defs par des paramètres POSITIONNELS
  (`scripts/docs/lib/structures-scan.mts:439-443`, `:1105-1110`), et le sens de chacun y est codé (`:467`, `:519`).
- `marquerOpAtteinte` (`ref.ts:261-269`) « marque le nœud » au sens d'un REPÈRE émis au parse de mesure, pas d'un fait
  de structure.

## Design

**M1 — Une table des marques, instance du registre de zod.** `grammaire/marques.ts` déclare UNE instance
`z.registry<MarquesDeNoeud>()`, où `MarquesDeNoeud` a une clé typée par genre de marque. Une seule fabrique,
`genreDeMarque(nom, options)`, déclare un genre et rend `poser(noeud, valeur)` et `lire(noeud)`. `poser` range la
valeur au registre (en gardant les marques d'autres genres du même nœud) et n'ajoute AUCUN contrôle ; `lire` passe par
`get`, jamais par `has`, qui ne suit pas les parents. Les règles d'un genre (coexistence au même point, contrainte
envers un autre genre comme `collection-cle.ts:113-116`) vivent dans sa déclaration. Le contrôle d'unicité d'une liste
à clé reste : c'est une validation, pas un porteur.

**M2 — Aucune perte silencieuse.** Un clone AVEC parent hérite de la marque par `get` : `collectionsPerdues`,
`CONTROLES` et le contrôle vide des records meurent. Un clone SANS parent ne concerne que les genres dont le nœud peut
être un objet ou un enum (Constat). Défaut proposé : la déclaration d'un tel genre pose une TRACE que ces clones
recopient, UN contrôle nommé par le genre, et une seule passe `marquesPerdues(schema)` nomme tout nœud qui porte la
trace d'un genre sans que `lire` lui rende la marque. La trace a donc un lecteur, et sur un objet elle fait lever
`.pick`/`.omit`/`.partial` avant toute perte. Le refus d'`enumNomme` (`valeurs.ts:43-48`) et sa garde de source meurent
au profit de cette passe. Alternative écartée, à contester en Q1 : sceller le nœud marqué comme `document()` (un pipe) ;
elle change le type du nœud (un enum scellé n'a plus `options`, une clé de `z.record` n'est plus un enum).

**M3 — Deux lectures, une seule source.** (a) `lire(noeud)` de chaque genre, la lecture AU NŒUD, que consomment
`descendre`, `enfantsDe` et la construction (`slots-registre.mts:122`, `validate.ts:157`, `collection-cle.ts:98-101`).
(b) `marquesAuPoint`, au-dessus de `coDescendre`, qui rend à chaque point de donnée les marques de chaque genre par (a)
et applique ses règles de coexistence. `coDescendreLesCollections` devient un consommateur de (b), sans descente propre.

**M4 — Les genres existants migrent, les lecteurs aussi.** Collection, feuille d'id et vocabulaire (les libellés
d'`enumNomme`, qui quittent `.meta()` pour la table) deviennent trois déclarations. `COLLECTIONS`, `CONTROLES`,
`FEUILLES_D_ID` meurent. Le `lire` du genre EST le lecteur du domaine, exporté sous son nom (`collectionDe`,
`typeDeFeuilleDId`, `valeursDe`) ; `estFeuilleDId` s'en dérive. Aucun second accès. Tous les appelants du Constat, tests
compris, migrent dans le même commit ; `collection-cle.test.ts:28-42` devient le test de `marquesPerdues` et de
l'héritage ; les commentaires qui décrivent l'ancien mécanisme (`collection-cle.ts:14-15`, `valeurs.ts:27-32`,
`meta.ts:24`) sont réécrits dans le même commit.

**M5 — Un seul canal vers le scan.** `scannerDonnees` reçoit les marques par UN paramètre,
`marques: ReadonlyMap<document, ReadonlyMap<cheminDeSchéma, MarquesDuPoint>>`, rempli par (b) dans `scanDuCorpus`
(`structures-scan.mts:1105-1110`). Ce que chaque genre change à la mesure vit dans UN aiguillage du scan, un cas par
genre ; les faits `familles` et `choix` y passent s'ils sont des marques (Q4).

**M6 — Le repère de parse n'est pas une marque.** `REPERE` d'`idDe` et `REPERE_OP` de `marquerOpAtteinte` restent
propres à leurs émetteurs (ce sont des faits du PARSE de mesure, pas de la structure). `marquerOpAtteinte` prend le
vocabulaire du repère (`repererOpAtteinte`) dans le commit qui pose M1.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — les clones sans parent, et la trace.** Sonde exhaustive sur zod 4.4.3, promue en test : pour chaque genre et
  chaque forme de nœud qu'il marque (tableau, objet, enum, record, pipe, littéral, union), quelles méthodes clonent
  sans parent, et recopient-elles les contrôles ? Existe-t-il, hors d'un contrôle, une donnée que zod recopie à ces
  clones et qui porterait la trace ? Trancher M2 (trace ou scellement) avec ces réponses.
- **Q2 — le vocabulaire quitte `.meta()`.** Qui d'autre lit le registre global de zod (`.describe(`, `.meta(` : une
  occurrence de `.describe(` hors tests dans `src`) ? Ce que devient chaque lecteur de `valeursDe` (10 fichiers de
  `src/ui`, `records-de-libelles.test.ts`, `valeurs-de-champ.test.ts`).
- **Q3 — le coût.** `build-structures` passe de 717 ms à 1260 ms depuis C3 (commit `f878503a2`). Mesure avant et après
  M3.
- **Q4 — `familles` et `choix`.** Les deux faits que `scanDuCorpus` passe au scan (`famillesDeclarees`,
  `choixDeclares`) sont-ils des faits posés à un nœud de schéma (donc des genres) ou des faits de document ?

## Critère N+1

Un genre de marque neuf coûte une déclaration : pose, lecture au nœud, héritage, détection de perte, lecture au point
de donnée et passage au scan viennent avec. Si le genre change ce que le scan mesure, il coûte aussi un cas de
l'aiguillage du scan.

## Périmètre et séquence

`chantier/1473-r2`, train propre APRÈS C4a (qui touche `collection-cle.ts`, `ref.ts`, `gen-espaces`) et AVANT les trains
« valeur par membre » et « marqueur au champ ». Jugé sur l'arbre de lecture `61fef43d7` ; le codeur relocalise les
ancres sur la tête de C4a.

## Lexique

Entrent au lexique des collections (`TERMES_COLLECTION_A_CLE`, `scripts/docs/lib/structures-lexique.mts:156`) dans le
commit qui pose M1 : « marque de nœud » (un fait de structure posé au nœud de schéma), « genre de marque » (collection,
feuille d'id, vocabulaire, marqueur, valeur par membre), « table des marques » (l'instance unique), « trace » (le
contrôle qu'un genre pose pour détecter un clone sans parent). Faux amis déclarés : « registre de zod » (la primitive),
« registre des ids » (`_ids.generated.ts`), « registre généré » (`scripts/guards/lib/registreDeDefs.ts`), « repère »
(M6).

## Traitement du verdict v1

- B1, B4, B5 (structurels) : M1 range les marques au registre de zod, sans contrôle ; M2 garde une détection pour les
  seuls clones sans parent (le réfutateur de B1 l'exige : `.extend` et sa famille perdent la marque du registre).
- B2, B6 : M3 a deux niveaux, la lecture au nœud et la lecture au point ; M5 nomme qui lit quoi.
- B3 : M5 donne la signature du canal et l'aiguillage ; le Critère N+1 dit ce qui reste à écrire.
- B7 : « table des marques » ; « registre » garde ses sens existants, déclarés faux amis.
- B8 : « valeur par membre » partout.
- B9 : M6.
- B10 : Constat (lecteurs par grep), M4 (le `lire` remplace, tout migre dans le même commit, test et commentaires
  réécrits), Q2 (lecteurs de `valeursDe`).
