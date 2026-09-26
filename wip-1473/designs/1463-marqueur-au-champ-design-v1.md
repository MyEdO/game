## Design — un marqueur se déclare au champ qui le porte (#1463, #1473), 2026-09-24, v1

Signalement d'origine : fil des sorts (#1897), point 3 de #1473 c.5811424522 : sept Traits portent `specsOpen: true`
(`a-distance`, `arme`, `cornes`, `corruption-mentale`, `lanceur-de-sorts`, `perturbant`, `souffle`), mais leur espace ne
le déclare pas, et `entreeOuverte('trait', …)` les lit fermés sans rien dire. Le fil des sorts l'a corrigé localement sur
`chantier/1897-doublons-fan` (`9fcff459d`) dans le mécanisme `export const marqueurs` / `IDS_PAR_MARQUEUR` que R2 a
démoli sur nos branches ; son message laisse la classe à C4 de R2.

## Invariant

1. En-tête de `src/data/schemas/grammaire/collection-cle.ts` (verbatim) : « une collection dont chaque élément a une
   IDENTITÉ, DÉCLARÉE au nœud qui la porte, jamais devinée. » Question à laquelle il répond : où se déclare un fait de
   structure d'une collection ? Réponse : au nœud de schéma qui le porte.
2. `src/data/schemas/grammaire/ref.ts:101-102` (doc d'`idsDeLEspace`, verbatim) : « une clé absente LÈVE — un
   désignateur qui vise un espace que la phase 2 ne mesure pas refuserait tout en silence. » Question : que fait une
   lecture d'espace quand l'espace n'existe pas ? Réponse : elle lève.
3. Credo, `.claude/credo.md`, « Règles GÉNÉRALES, jamais spécifiques » (verbatim) : « Corriger la classe entière du
   problème, pas le cas rencontré. Une garde de synchronisation est un smell : une seule source de vérité. » Question :
   combien de déclarations pour « ce champ est un marqueur » ? Réponse : une.

## Cas canonique déjà couvert

- `marquerCollection` (`collection-cle.ts`, `WeakMap` `COLLECTIONS`) déclare au nœud qu'un nœud est une collection à clé ;
  la co-descente la retrouve (`collectionsDuDocument`) ; aucun second paramètre ne répète ce que le nœud dit.
- `porteLeMarqueur(type, marqueur)` (`ref.ts:146-151`) lit une sous-liste marquée par `idsDeLEspace`, qui lève sur un
  espace inconnu ; `props.volume` en est le lecteur de production (`src/data/index.ts:2810`,
  `defs-scenes/scene.ts:64`).

Le cas neuf en est une instance : « ce champ marque les entrées qui le portent » est un fait du nœud de CHAMP, comme
« ce nœud est une collection » est un fait du nœud de collection.

## Constat (mesures du lecteur, 2026-09-24, `f878503a2`, à attaquer)

- Le marqueur se déclare DEUX fois : le champ dans `champs` de l'élément, puis son nom dans
  `document(…, { espace: { marqueurs: [...] } })` : `domains.ts:168` (`wind`, `arcane`), `gods.ts:45` (`blessings`,
  `miracles`, `chaosSpells`), `props.ts:104` (`volume`), `skills.ts:81` et `talents.ts:121` (`specsOpen`). `traits.ts`
  déclare le champ `specsOpen` (`:88`) sans aucun `espace` (`:143`).
- Lectures : `porteLeMarqueur` lève sur un espace inconnu ; `entreeOuverte` (`ref.ts:166-168`) rend `false` en silence
  (`lireLEspace(…)?.has(id) ?? false`). `scripts/gen-espaces.mts:50-67` lève sur un marqueur déclaré qu'aucun élément ne
  porte, et ne visite jamais une collection sans `espace` (`:97`).
- `specsOpen` est déclaré trois fois en littéral (`skills.ts:25`, `talents.ts:87`, `traits.ts:88`) ; `specsSource` passe
  par `specsSourceSchema` mais se recopie comme champ dans les trois defs ; `specs` dans deux.
- Le paramètre `discriminant` d'`EspaceDeNoms` (`materials.ts:150` avec `chargeParDiscriminant`, `spells.ts:208`,
  `trappings.ts:290`, `weaponGroups.ts:47`) est de la même classe : un nom de champ répété hors du nœud du champ.

## Design

**D1 — La marque au champ.** Une primitive de grammaire `marqueur(noeud)` pose la marque sur le nœud du champ (même
mécanisme que `marquerCollection`, recopiée par un clone). La phase 2 trouve les marqueurs d'une collection par
co-descente de son schéma d'élément. `EspaceDeNoms.marqueurs` meurt, ainsi que les cinq listes des defs.

**D2 — Le discriminant aussi.** Le champ discriminant d'un espace se marque au champ ; `EspaceDeNoms.discriminant`
meurt. Pour `chargeParDiscriminant`, la question Q2 dit si les clés de charge admises se DÉRIVENT des branches du schéma
d'élément (union discriminée) plutôt que d'une table écrite à la main.

**D3 — Un fragment de spécialisation.** `specs`, `specsSource`, `specsOpen` (marqué) et les champs voisins de la même
famille (`specsMulti`, à mesurer) forment un fragment de grammaire unique, étalé dans les defs qui l'adoptent
(`skills`, `talents`, `traits`) ; un type spécialisable de plus coûte un étalement.

**D4 — Une seule lecture, qui lève.** `entreeOuverte` meurt : ses lecteurs (`ref.ts:428`, `careerSlots.ts:226`) lisent
`porteLeMarqueur(type, 'specsOpen')`. Aucun `?? false` : un type sans le marqueur n'a pas la clé, et le demander lève.
Les appelants d'un type qui ne porte pas le fragment ne posent pas la question (à établir par le typage, Q3).

**D5 — Zéro porteur, liste vide.** Un marqueur déclaré qu'aucune entrée ne porte émet une sous-liste VIDE : la
déclaration est le fait, la donnée peut ne pas le porter encore. `gen-espaces.mts:66` cesse de lever.

**D6 — Fusion avec la branche des sorts.** À la fusion de `chantier/1897-doublons-fan`, chaque nom de
`export const marqueurs` (dont `traits.ts` : `indice`, `range`, `specsOpen`) devient une marque sur son champ, et
`IDS_PAR_MARQUEUR` meurt. `refusDArgDeTrait` y lit `porteLeMarqueur('trait', …)` sans changement de son côté. La
première branche publiée impose sa base.

**D7 — Le sens de l'ouverture.** Une entrée est OUVERTE quand le joueur peut créer une spécialisation hors du catalogue.
Le train 2a2 (corrections 3, M1) établit au `Source/`, entrée par entrée, les neuf Talents qui portent `specsOpen`
(Destinée, LDB 10 l.315 ; Compétence Groupée de LDB 09 l.40 ; ou simple liste d'exemples). Ce design en tire la règle
générale, citée : l'ouverture d'une entrée dont les spécialisations viennent d'une `specsSource` est-elle celle de
l'UNIVERS source (la Compétence Groupée, LDB 09 l.40) plutôt qu'une déclaration répétée sur l'entrée ? Si oui,
`specsOpen` se déclare sur l'univers et se lit à travers `specsSource`, jamais recopié. Les réponses de M1 sont
collées ici avant le jugement.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — le reste de la classe.** La sonde du lecteur ne voit que les booléens déclarés au texte ; lister tout champ lu
  comme sous-liste (`cleFiltree(…, { champ })`, `porteLeMarqueur`, `IDS_PAR_MARQUEUR` sur la branche des sorts,
  `qualities.indice` que cite `9fcff459d`) et dire lequel n'est pas déclaré marqueur. Une garde : un marqueur LU dont le
  champ n'est pas marqué lève à la construction du lecteur.
- **Q2 — `chargeParDiscriminant`.** Dérivable des branches du schéma d'élément de `materials.ts`, ou fait distinct ?
- **Q3 — typage des lecteurs.** Peut-on rendre `porteLeMarqueur(type, marqueur)` refusé AU TYPAGE pour un couple
  (type, marqueur) que le schéma ne marque pas, plutôt qu'à l'exécution ?
- **Q4 — clone.** Un `.optional()`/`.default()` posé après `marqueur(…)` garde-t-il la marque (comme
  `collectionsPerdues` pour les collections) ?

## Critère N+1

Un marqueur neuf coûte un appel `marqueur(…)` sur son champ : ni liste parallèle, ni clé à écrire, ni lecteur qui
retombe en silence.

## Périmètre et séquence

`chantier/1473-r2`, après C4a (qui touche `gen-espaces`, `collection-cle.ts`, `ref.ts`) ; jugé sur l'arbre du commit de
C4a, avec les réponses de M1 collées en D7. Le fil des sorts est prévenu de D6 quand la forme est posée.

## Lexique

« marqueur » (un champ dont la présence sur une entrée la range dans une sous-liste de son espace) entre au lexique des
structures dans le commit qui pose D1, avec « ouverture » (D7).
