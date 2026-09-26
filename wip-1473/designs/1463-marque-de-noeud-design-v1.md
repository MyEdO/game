## Design — UNE mécanique de marque de nœud (#1463, #1473, socle de R2), 2026-09-24, v1

Origine : le juge du design « valeur par membre » (`/mnt/project-files/dettes/1463-par-membre-design-v1.md`, workflow
`juge-design-socle` run `wf_5a2555ce-553`, RÉFUTÉ) pose en bloquant structurel B2 : « Poser dans le design, avant D1,
une seule mécanique de marque de nœud : un registre de marques typées, un seul `…Perdues`, une seule co-descente qui rend
toutes les marques d'un point. » Deux designs en cours du même chantier en dépendent : la valeur par membre et le
marqueur déclaré au champ (`1463-marqueur-au-champ-design-v1.md`). C'est le niveau au-dessus des deux : il se juge et se
code AVANT eux.

## Invariant

1. En-tête de `src/data/schemas/grammaire/collection-cle.ts` (verbatim) : « une collection dont chaque élément a une
   IDENTITÉ, DÉCLARÉE au nœud qui la porte, jamais devinée. » Question à laquelle il répond : où se déclare un fait de
   structure ? Réponse : au nœud de schéma, et on le relit au nœud.
2. Credo, `.claude/credo.md` (verbatim) : « Réutiliser l'existant — le CANONIQUE, pas le voisin. […] Étendre le général
   et le paramétrer plutôt que créer un parallèle ». Question : un genre de fait de structure de plus (un marqueur, une
   carte par membre) ouvre-t-il sa propre table, sa propre descente et sa propre détection de perte ? Réponse : non, il
   se déclare dans la mécanique générale.
3. Doc de `collectionsPerdues`, `collection-cle.ts` (verbatim) : « Collections à clé PERDUES dans un schéma : les nœuds
   qui portent le contrôle d'une marque sans la marque — le clone d'une collection marquée, par un `.min`/`.refine` posé
   APRÈS `marquerCollection`. » Question : que devient une marque quand zod clone le nœud ? Réponse aujourd'hui : elle
   tombe, et une passe dédiée le détecte.

## Cas canonique déjà couvert

- `marquerCollection` (`collection-cle.ts:110-139`) : la marque est rangée dans `COLLECTIONS` (`:60`) ET portée par un
  CONTRÔLE (`superRefine`) indexé dans `CONTROLES` (`:62`) ; zod recopie les contrôles au clone, si bien qu'un clone se
  reconnaît à son contrôle (`collectionsPerdues`, `:170-181`).
- `coDescendre` (`grammaire/descente.ts:208-224`) est la co-descente unique d'une donnée avec son schéma (C3) ; chaque
  point expose ses nœuds (`PointDeDonnee.noeuds`, `:193-200`). `coDescendreLesCollections` (`collection-cle.ts:212`) la
  spécialise pour UN genre de marque, avec la règle « deux marques différentes au même point lèvent ».

Le cas neuf en est une instance : chaque genre de marque (collection, feuille d'id, marqueur, carte par membre) est « un
fait de structure posé au nœud, porté par un contrôle, relu au point de co-descente » ; seule la valeur de la marque
change de type.

## Constat (arbre `61fef43d7`, à attaquer)

- Genres de marque existants, chacun avec sa table : `COLLECTIONS`/`CONTROLES` (`collection-cle.ts:60-62`) ;
  `FEUILLES_D_ID` (`ref.ts:200`, posée par `idDe`, `:237-262`) ; la meta `valeurs` d'`enumNomme` (`valeurs.ts:40`), lue
  par `valeursDe` (`meta.ts:52-55`) dans le registre de zod.
- Lecteurs : `collectionDe`, `collectionsRetrouvees`, `collectionsPerdues`, `coDescendreLesCollections`
  (`collection-cle.ts`) ; `typeDeFeuilleDId`/`estFeuilleDId` (`ref.ts:203-221`) ; lecteurs hors grammaire :
  `src/data/schemas/validate.ts`, `scripts/docs/lib/slots-registre.mts`. L'éditeur (`src/ui`) ne lit aucune marque
  (juge : `grep collectionDe src/ui` → 0).
- Sonde du juge (`scratchpad/juge-par-membre-2/sonde.mts`, zod 4.4.3) : une `WeakMap` indexée sur l'instance est perdue
  par `.meta()`, `.describe()` et `.refine()` ; `.optional()` la garde (l'intérieur reste le même nœud).
- Le scan des structures ne voit aucun schéma (`scannerDonnees(root, familles, choix)`) ; `scanDuCorpus`
  (`structures-scan.mts:1105-1111`) lui passe déjà des faits dérivés des defs (`familles`, `choix`).
- À naître : le marqueur au champ, la carte par membre, le discriminant d'espace.

## Design

**M1 — Un registre de genres de marque.** Une seule fabrique de grammaire déclare un genre de marque (nom, type de sa
valeur, règle de coexistence au même point) et rend son couple `poser(noeud, valeur)` / `lire(noeud)`. Poser range la
marque ET pose un contrôle porteur ; il n'existe qu'une table des contrôles porteurs, commune à tous les genres.

**M2 — Une marque survit au clone, ou sa perte est générique.** Défaut proposé : `lire(noeud)` trouve la marque par le
nœud, sinon par un contrôle porteur de ses `checks` ; un clone garde alors la marque par construction, et
`collectionsPerdues` meurt. Si la sonde de Q1 montre un clone qui ne doit PAS hériter (un clone qui change le sens du
nœud), la perte reste détectée, mais par UNE passe `marquesPerdues(schema)` pour tous les genres.

**M3 — Une co-descente des marques.** Un seul lecteur, au-dessus de `coDescendre`, rend à chaque point les marques de
chaque genre (`p.noeuds` lus par le registre) et applique la règle de coexistence de chaque genre.
`coDescendreLesCollections` devient un consommateur de ce lecteur, sans descente propre.

**M4 — Les genres existants migrent.** Collection et feuille d'id deviennent deux déclarations du registre ;
`COLLECTIONS`, `CONTROLES` et `FEUILLES_D_ID` meurent. Les lecteurs exportés (`collectionDe`, `typeDeFeuilleDId`, …)
deviennent le `lire` de leur genre ou meurent au profit de lui.

**M5 — Les consommateurs reçoivent les marques, pas une passe par genre.** La phase 2 de `gen`, la validation
(`validate.ts`), le registre des slots et le scan des structures lisent les marques par M3. Le scan les reçoit par le
canal de `scanDuCorpus` (un fait dérivé des defs de plus, générique), jamais par une passe propre à un genre.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — hériter ou détecter.** Sonde sur zod 4.4.3 (`package.json`) : `.min`, `.refine`, `.superRefine`, `.optional`,
  `.nullable`, `.default`, `.meta`, `.describe`, `.extend`/`.pick`/`.omit` d'un objet, `.transform`/`.pipe` : lesquels
  recopient les `checks` ? Pourquoi `collection-cle.ts` a-t-il choisi de DÉTECTER la perte plutôt que d'hériter (chercher
  le motif au commit qui a posé `CONTROLES`, `git log -S CONTROLES`) ? Trancher M2 avec ces deux réponses.
- **Q2 — la meta d'`enumNomme`.** Les libellés d'un vocabulaire vivent dans le registre de zod (survit au clone, perdu à
  l'extension, dit du juge). Sont-ils un genre de marque (fait de structure) ou une métadonnée d'affichage qui reste à
  zod ? Trancher, avec le coût de chaque voie pour `valeursDe`.
- **Q3 — le coût.** `build-structures` passe de 717 ms à 1260 ms depuis C3 (mesure du commit `f878503a2`). Une co-descente
  qui lit tous les genres une fois coûte-t-elle moins que les passes actuelles ? Mesure avant et après.
- **Q4 — `FEUILLES_D_ID` au parse de mesure.** La feuille d'id émet aussi un REPÈRE au parse de mesure (`ref.ts:190-196`,
  `:243-246`) : cette émission reste-t-elle propre à `idDe`, ou est-ce un second rôle que le registre doit porter ?

## Critère N+1

Un genre de marque neuf coûte une déclaration au registre : pose, lecture, survie au clone, co-descente et réception par
le scan viennent avec.

## Périmètre et séquence

`chantier/1473-r2`, train propre APRÈS C4a (qui touche `collection-cle.ts`, `ref.ts`, `gen-espaces`) et AVANT les trains
« valeur par membre » et « marqueur au champ », qui en deviennent deux déclarations. Jugé sur l'arbre de lecture
`61fef43d7` ; le codeur relocalise les ancres sur la tête de C4a.

## Lexique

« marque de nœud » (un fait de structure posé au nœud de schéma), « genre de marque » (collection, feuille d'id,
marqueur, carte par membre…) et « contrôle porteur » naissent au lexique des collections dans le commit qui pose M1.
