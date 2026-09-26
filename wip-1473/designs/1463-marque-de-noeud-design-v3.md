## Design — UNE mécanique de marque de nœud, sur le registre de zod (#1463, #1473, socle de R2), 2026-09-24, v3

v2 (`1463-marque-de-noeud-design-v2.md`) : **FRAGILE** par le workflow `juge-design-socle`, run `wf_cea3e89e-464`
(verdict : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-marque-de-noeud-v2/verdict.json`,
sondes dans le même dossier). Huit bloquants, aucun structurel. Le premier en porte trois : une trace portée par un
CONTRÔLE disparaît quand `.extract`/`.exclude` d'un enum remettent les contrôles à zéro. La v3 porte la trace dans le
DEF du nœud, que tous les clones sans parent recopient (sonde ci-dessous). Traitement de chaque bloquant en fin de
document.

v1 (`1463-marque-de-noeud-design-v1.md`) : RÉFUTÉ, run `wf_5c3eb8d3-ea9`.

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
  const p = schema._zod.parent; if (p) { const pm = { ...(this.get(p) ?? {}) }; delete pm.id; …`, et
  `core/util.js:261-265` : `clone(inst, def, params) { const cl = new inst._zod.constr(def ?? inst._zod.def); if (!def
  || params?.parent) cl._zod.parent = inst;`. zod 4.4.3 (`node_modules/zod/package.json`).
- **Le def que les clones recopient.** Les clones sans parent de zod se bâtissent sur une copie du def :
  `new ZodEnum({ ...def, checks: [], … })` pour `.extract`/`.exclude` (`node_modules/zod/v4/classic/schemas.js:981-986`,
  `:997-1002`), `mergeDefs(schema._zod.def, …)` pour la famille de `.extend` et `.pick`. Un champ du def survit donc à
  tous les clones qui perdent le parent.
- **Un usage dans le dépôt** : `enumNomme` range ses libellés et ses hints au registre global de zod par `.meta()`
  (`valeurs.ts:40`), `valeursDe` (`meta.ts:55`) et `hintDeValeur` (`meta.ts:75`) les relisent.
- **Le lecteur de def** : `defDe` (`grammaire/descente.ts:38`), seul lecteur de `_zod.def` sous la garde
  `scripts/guards/lib/lectureDefZod.mjs`.
- **La co-descente** : `coDescendre` (`grammaire/descente.ts:208`) expose à chaque point ses nœuds
  (`PointDeDonnee.noeuds`, `:193-200`) ; `descendre` parcourt le schéma seul.

Sonde de l'orchestrateur, sur l'arbre `61fef43d7` : `scratchpad/socle-v3/sonde-trace-def.mjs`, sortie
`scratchpad/socle-v3/sortie-trace-def.txt` (sous `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/`).
`poser` y rend `n.clone({ ...def, [TRACE]: genres }, { parent: true })` et range la valeur au registre. Extrait verbatim :

```
.extract               parent false | trace ["enumNomme"] | perdues ["enumNomme"]
.exclude               parent false | trace ["enumNomme"] | perdues ["enumNomme"]
.extend                parent false | trace ["collection"] | perdues ["collection"]
.pick                  parent false | trace ["collection"] | perdues ["collection"]
.partial               parent false | trace ["collection"] | perdues ["collection"]
.refine                parent true | trace ["collection"] | perdues []
deux genres            parent true | trace ["collection","marqueur"] | perdues []
pipe (idDe)            parent true | trace ["feuilleDId"] | perdues []
instance partagée marquée ? false | clone marqué ? true
```

`.pick`, `.omit`, `.partial` ne lèvent plus (aucun contrôle posé) ; ils sont détectés comme les autres.

Le cas neuf en est une instance : chaque genre de marque (collection, feuille d'id, enum nommé, marqueur, valeur par
membre) est une donnée rangée au registre de zod sur le clone qu'il rend, tracée dans le def de ce clone ; seule la
valeur change de type.

## Constat (arbre `61fef43d7`, sondes des juges, à attaquer)

- Trois tables maison : `COLLECTIONS` et `CONTROLES` (`collection-cle.ts:60`, `:62`), `FEUILLES_D_ID` (`ref.ts:200`).
- Deux mécanismes de perte : `collectionsPerdues` (`collection-cle.ts:170`) et le refus de `.extract`/`.exclude`
  d'`enumNomme` (`valeurs.ts:41-48`), doublé de la garde de `valeurs-de-champ.test.ts`.
- `enumNomme` pose DEUX faits au même nœud, `valeurs` et `hints` (`valeurs.ts:40`) ; `hintDeValeur` lit `.meta()`
  directement (`meta.ts:75-77`), sur le type `NoeudEnum` calé sur `.meta()` (`meta.ts:25`). Lecteur de production :
  `src/ui/editor/Inspector.tsx:2103`.
- Lecteurs d'`enumNomme` : `git grep -l "libelleDeValeur\|hintDeValeur\|valeursDe\b" -- src | wc -l` rend 36 (24 sous
  `src/ui`, juge v2).
- Une instance PARTAGÉE : `src/data/schemas/defs/sizes.ts:15-33`, `sizeTable` sert à `rangedMod` (marqué), à
  `shipboardEnc` et à `footprintSide` (non marqués). Aujourd'hui `marquerCollection` marque le clone que rend
  `superRefine` (`collection-cle.ts:118-137`).
- Le contrôle d'une collection `record` ne valide rien (`collection-cle.ts:122`) : il ne sert qu'à porter la marque.
- Une contrainte ENTRE genres, à des points différents : `collection-cle.ts:113-116` refuse `espace` quand la clé
  d'élément est une feuille `idDe`.
- Le scan des structures a sa propre marche de la donnée, sans schéma, `parcourir` (`scripts/docs/lib/structures-scan.mts:419-427`,
  appelée en `:500`, `:540`, `:593`, `:804`) : les ids de record entrent dans son chemin, les tableaux sont aplatis. Le
  design R2 v4.1, D9, la garde comme côté OBSERVÉ (`/mnt/project-files/dettes/1463-r2v41-brief.md`, D9 : « La marche de
  la donnée (`:420`) reste le côté OBSERVÉ »), et `scannerDonnees` y reçoit les defs (C5). Les faits des defs lui
  arrivent aujourd'hui par des paramètres positionnels (`:439-443`, `:1105-1110`).
- `marquerOpAtteinte` (`ref.ts:261-269`) « marque le nœud » au sens d'un REPÈRE émis au parse de mesure.
- Commentaires et docs qui décrivent l'ancien mécanisme (juge v2) : `collection-cle.ts:3-5`, `:14-15`, `:61` ;
  `valeurs.ts:14-15`, `:22`, `:27-32` ; `meta.ts:24`, `:47-52` ; l'entrée « co-descente » du lexique généré
  (`scripts/docs/lib/structures-lexique.mts:170`), émise dans `docs/structures-donnees.md`.

## Design

**M1 — Une table des marques, instance du registre de zod.** `grammaire/marques.ts` déclare UNE instance
`z.registry<MarquesDeNoeud>()`, où `MarquesDeNoeud` a une clé par genre. Une seule fabrique, `genreDeMarque(nom,
options)`, déclare un genre et rend `poser(noeud, valeur)` et `lire(noeud)`.
- `poser` ne touche JAMAIS le nœud reçu : il rend un clone AVEC parent (`clone(def, { parent: true })`), dont le def est
  une COPIE qui porte la trace du genre (M2), et range la valeur au registre sur ce clone, en gardant les marques
  d'autres genres. Une instance partagée (`sizes.ts`) n'est donc marquée qu'au champ qui reçoit le clone, et un clone
  fait AVANT la pose n'hérite de rien.
- `get` fusionne les marques du parent et de l'enfant clé par clé (`registries.js:30-41`) : une clé est un genre, la
  valeur d'un genre posée sur l'enfant remplace celle du parent en entier. `get` retire la clé `id` du parent : aucun
  genre ne s'appelle `id`.
- `lire` passe par `get`, jamais par `has`, qui ne suit pas les parents.
- Les règles d'un genre (coexistence au même point, contrainte envers un autre genre comme `collection-cle.ts:113-116`)
  vivent dans sa déclaration. Le contrôle d'unicité d'une liste à clé reste : c'est une validation, pas un porteur. Le
  contrôle vide des records meurt : rien ne le remplace sur le nœud.

**M2 — Aucune perte silencieuse, un seul mécanisme.** La trace est un champ du DEF du clone que rend `poser` : la liste
des genres posés. Tout clone de zod la recopie, avec ou sans parent (sonde). Le def se lit par `defDe`, sous la garde
`lectureDefZod`. Une marque est PERDUE quand le def d'un nœud trace un genre que `lire` ne lui rend pas. Deux lecteurs,
une seule définition :
- `lire(noeud)` d'un genre LÈVE, nommément, sur une marque perdue : un lecteur de production ne reçoit jamais
  `undefined` pour un nœud qui a perdu sa marque.
- `marquesPerdues(schema)` nomme toutes les pertes d'un schéma ; une garde la joue sur chaque def de `SCHEMA_DEFS` et
  d'`OP_DEFS`, pour les nœuds qu'aucun lecteur n'atteint.
`collectionsPerdues`, `CONTROLES`, le refus d'`enumNomme` (`valeurs.ts:41-48`) et la garde de source de
`valeurs-de-champ.test.ts` meurent. Le scellement (Q1 de la v2) est écarté : il change le type du nœud, et la trace au
def rend la détection sans lui.

**M3 — Deux lectures, une seule source.** (a) `lire(noeud)` de chaque genre, la lecture AU NŒUD, que consomment
`descendre`, `enfantsDe` et la construction (`slots-registre.mts:122`, `validate.ts:157`, `collection-cle.ts:98-101`).
(b) `marquesAuPoint`, au-dessus de `coDescendre`, qui rend à chaque point de donnée les marques de chaque genre par (a)
et applique ses règles de coexistence. `coDescendreLesCollections` devient un consommateur de (b), sans descente propre,
et l'entrée « co-descente » du lexique le dit.

**M4 — Les genres existants migrent, les lecteurs aussi.** Collection, feuille d'id et enum nommé deviennent trois
déclarations.
- L'enum nommé porte ses DEUX faits dans la table : `{ valeurs, hints? }`. `valeursDe`, `libelleDeValeur` et
  `hintDeValeur` lisent la table ; `NoeudEnum` et la lecture de `.meta()` meurent. Aucun fait d'`enumNomme` ne reste au
  registre global de zod.
- `COLLECTIONS`, `CONTROLES`, `FEUILLES_D_ID` meurent. Le `lire` du genre EST le lecteur du domaine, exporté sous son
  nom (`collectionDe`, `typeDeFeuilleDId`, `valeursDe`) ; `estFeuilleDId` s'en dérive. Aucun second accès.
- Tous les appelants, tests compris, migrent dans le même commit ; `collection-cle.test.ts:28-42` devient le test de
  `marquesPerdues`, de `lire` qui lève, et de l'héritage.
- La sonde `sonde-trace-def.mjs` est PROMUE en test committé : chaque clone de zod 4.4.3, avec et sans parent, pour
  chaque forme de nœud marquée (tableau, objet, enum, record, pipe, littéral, union), sa trace et sa perte.
- Commentaires et docs : `git grep -n "marquerCollection\|\.meta({ valeurs\|CONTROLES\|SUR LE NŒUD\|collectionsPerdues"`
  sur `src scripts docs`, et chaque ligne du Constat, sont réécrits dans le même commit ; la sortie du grep, après, est
  collée au rendu.

**M5 — Le scan lit les marques par l'identité de la donnée.** Pas de canal de marques. `scannerDonnees` reçoit les
defs (D9 de R2 v4.1) et lance (b) sur la même racine qu'il marche (`brutParDocument`, `structures-scan.mts:445`). Il lit
les marques d'un point par son CONTENEUR de donnée et sa clé, `marquesDe(conteneur, cleOuRang)` (une `WeakMap` des
conteneurs rendue par (b)) : aucun chemin ne se traduit entre `parcourir` et `coDescendre`, et `parcourir` reste le côté
observé (D9). Ce que chaque genre change à la mesure vit dans UN aiguillage du scan, un cas par genre ; les faits
`familles` et `choix` y passent s'ils sont des marques (Q4). M5 entre dans C5 avec D9.

**M6 — Le repère de parse n'est pas une marque.** `REPERE` d'`idDe` et `REPERE_OP` de `marquerOpAtteinte` restent
propres à leurs émetteurs (ce sont des faits du PARSE de mesure, pas de la structure). `marquerOpAtteinte` devient
`repererOpAtteinte` dans le commit qui pose M1.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — la sonde promue.** Le test de M4 couvre-t-il toutes les méthodes de clone de zod 4.4.3 sur chaque forme
  marquée ? Liste des méthodes lue dans `node_modules/zod/v4/classic/schemas.js`, citée.
- **Q2 — le registre global de zod.** Après M4, qui lit encore le registre global (`.describe(`, `.meta(` hors
  `enumNomme`) ? Ce que devient chaque lecteur de `valeursDe`, `libelleDeValeur`, `hintDeValeur`.
- **Q3 — le coût.** `build-structures` : mesure avant et après M3 (le profil de C4a nomme `build-structures.mts:172`,
  une co-descente de 128 documents pour deux comptes, et `enfantsDe` rejoué à chaque point de donnée).
- **Q4 — `familles` et `choix`.** Les deux faits que `scanDuCorpus` passe au scan (`famillesDeclarees`,
  `choixDeclares`) sont-ils des faits posés à un nœud de schéma (donc des genres) ou des faits de document ?

## Critère N+1

Un genre de marque neuf coûte une déclaration : pose, lecture au nœud, héritage, trace, détection de perte, lecture au
point de donnée et lecture par le scan viennent avec. Si le genre change ce que le scan mesure, il coûte aussi un cas de
l'aiguillage du scan.

## Périmètre et séquence

`chantier/1473-r2`. M1 à M4 et M6 : un train propre après C4b (qui touche `collection-cle.ts`, `ref.ts`, `gen-espaces`)
et avant les trains « valeur par membre » et « marqueur au champ ». M5 : dans C5, avec D9. Jugé sur l'arbre de lecture
`61fef43d7` ; le codeur relocalise les ancres sur la tête de C4b.

## Lexique

Entrent au lexique des collections (`TERMES_COLLECTION_A_CLE`, `scripts/docs/lib/structures-lexique.mts:156`) dans le
commit qui pose M1 : « marque de nœud » (un fait de structure posé au nœud de schéma), « genre de marque » (collection,
feuille d'id, enum nommé, marqueur, valeur par membre), « table des marques » (l'instance unique), « trace » (le champ du
def qui liste les genres posés). « Enum nommé » garde son sens (#1694, `valeurs.ts:13`) : c'est le nom du genre, pas un
synonyme. Faux amis déclarés : « registre de zod » (la primitive), « registre des ids » (`_ids.generated.ts`),
« registre généré » (`scripts/guards/lib/registreDeDefs.ts`), « repère » (M6).

## Traitement du verdict v2

- Bloquants 1 et 3 (la trace par contrôle perdue sur `.extract`/`.exclude`) : M2, trace au def, sonde citée, promue en
  test (M4).
- Bloquant 2 (canal keyé par chemin de schéma, étranger à la marche du scan) : M5, lecture par l'identité du conteneur
  de donnée, sans chemin.
- Bloquant 4 (`poser` marque l'instance partagée) : M1, `poser` rend un clone avec parent et ne touche jamais le nœud
  reçu ; sonde « instance partagée marquée ? false ».
- Bloquant 5 (« vocabulaire », synonyme et homonyme) : le genre s'appelle « enum nommé », le terme du dépôt ; le mot
  « vocabulaire » ne sort plus du design.
- Bloquant 6 (demi-migration, les hints restent dans `.meta()`) : M4, l'enum nommé porte `{ valeurs, hints? }`.
- Bloquant 7 (commentaires oubliés) : Constat, liste du juge ; M4, un grep dont la sortie est collée.
- Bloquant 8 (le contrôle vide renommé en trace) : M1 et M2, la trace n'est pas un contrôle et aucun contrôle ne porte
  plus de marque ; la trace porte elle-même ses genres, sans table d'identité contrôle → genre.

---
_Generated by [Claude Code](https://claude.ai/code)_
