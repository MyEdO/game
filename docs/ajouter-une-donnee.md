# Ajouter / curer une donnée dans `src/data/*.json`

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-ajouter-donnee.mjs` (`npm run docs:ajouter-donnee`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont MESURÉS à chaque génération : les 124 fichiers
de `src/data/*.json`, les 30 entrées de `src/data/books.json` (dont 19 en VF) et le nom
RÉEL de leur clé d'abréviation (`abbr`), les 11 clés d'ENVELOPPE et leurs libellés FR
lus par AST dans `src/data/schemas/grammaire/document.ts`, les 3 familles de document, les 5 skills de domaine (existence
sur disque + `description` lue au frontmatter de leur `SKILL.md`) et les 6 gardes (chemin
ancré + intitulé de leur `describe(...)`, lu au fichier). **Angles morts** : ce doc est le DÉROULÉ,
pas la CARTE — quel concept vit dans quel fichier, les conventions de champ et les pièges d'homonymes
restent dans `docs/donnees.md` (généré à part), et la FORME de chaque graphie dans
`docs/structures-donnees.md` ; l'ordre des étapes, le check-first et la doctrine « zéro invention »
sont de l'ÉDITORIAL fixé dans le script ; la description d'un skill est tronquée à sa 1re phrase (le
reste vit au skill) ; aucun contrôle ici que la donnée ajoutée est FIDÈLE à sa source — c'est le rôle
du Source et de la revue, pas d'un générateur.

Guide de la donnée app-owned « générique » (trapping, qualité, carrière, structure, machine de guerre,
trait naval, activité, critique, lieu…). La **carte** de où-vit-quoi et les conventions de champs vivent
dans `docs/donnees.md` ; ce guide est le **déroulé**. Motivé par l'incident #148 (doublon + mauvaise
lecture de source par un agent).

## 0. D'abord : router vers le skill de domaine

Si ton ajout tombe dans une de ces familles, **STOP** — le skill dédié couvre le rig / les canaux
d'effet / la résolution que ce guide générique ne connaît pas.

| Tu ajoutes… | Skill | Donnée | Ce que le skill dit de lui-même |
|---|---|---|---|
| un **sort**, une Prière, une Bénédiction, un Miracle | `ajouter-un-sort` | `src/data/spells.json` | À utiliser quand on ajoute ou cure un sort (effets, métadonnées de résolution, Projectile magique, ZdE), quand un sort n'a aucun effet mécanique en jeu, ou quand son badge mécanique/partiel/narratif semble faux. |
| une **créature**, un PNJ, une race/tenue | `creer-une-creature` | `src/data/creatures.json`, `src/data/species.json` | À utiliser quand on ajoute une créature, un monstre ou un PNJ au bestiaire (rig, apparence, statbloc), quand une créature s'affiche mal (blob, proportions), ou avant de toucher src/gameIso/rig/creatures/. |
| l'**effet mécanique** d'un trait/talent/qualité/mutation/maladie/atout | `ajouter-une-mecanique` | `src/data/traits.json`, `src/data/talents.json`, `src/data/qualities.json` | À utiliser quand on implémente l'effet d'un trait, talent, qualité, mutation, maladie, atout ou consommable — ou dès qu'on est tenté d'ajouter un champ ad hoc, un type dédié ou un dispatch par nom d'entité pour un effet mécanique. |
| une **icône** d’affordance | `ajouter-une-icone` | `src/ui/icons/_registry.generated.ts` | À utiliser quand une affordance a besoin d'une icône, dès qu'on est tenté de mettre un émoji dans l'UI ou une donnée d'affichage, ou quand le garde no-emoji-affordance échoue. |
| un **livre source** entier | `ajouter-un-livre-source` | `src/data/books.json` | À utiliser quand on intègre un nouveau livre ou supplément WFRP (PDF → Source/ → Atlas → données), quand une abréviation de livre inconnue apparaît dans une réf, ou avant de citer un livre absent de docs/sources-vf.md. |

Sinon (le RESTE de `src/data`, soit 124 fichiers), suis le déroulé ci-dessous.

## 1. CHECK-FIRST (anti-doublon) — non négociable

```
grep -rniE '<id-candidat>|<label>|<concept>' src/data/*.json
```

Le concept vit peut-être **déjà** dans un autre sous-système (#148 : le Bélier était dans 6 fichiers).
S'il existe → **ne duplique pas** : étends-le là où il vit, ou re-scope la tâche. Carte et pièges
d'homonymes : `docs/donnees.md`. Le hook `scripts/hooks/data-edit-guard.mjs` rappelle ce check à chaque
écriture d'un `src/data/*.json` (il atteint aussi les sous-agents, où les skills ne se déclenchent pas).

## 2. Choisir le fichier — et sa FAMILLE

Via la carte `docs/donnees.md`. **Règle d'or** : une « machine de guerre / véhicule / navire » n'est
PAS un `trappings`. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats — leur forme
fait foi, et elle est déclarée : chaque document appartient à l'une des 3 familles de
`src/data/schemas/grammaire/document.ts` (`entite` · `config` · `record`), qui décide de l'emballage du
FICHIER (liste d'entrées, entrée seule, ou enveloppe + `entries`).

## 3. Vérifier la source RAW

Ouvrir le `Source/…` (FR, plus le Core Rulebook 5e — `CLAUDE.md` § *Sources VF*), lire le
**tableau ET son en-tête** (l'erreur #148 = la colonne « Équipe » lue comme « Encombrement »).
Citer `<LIVRE> <chap> l.<ligne>` dans le message de commit / l'issue. ⚠ Le n° de ligne a dérivé
(ré-extraction Marker) ET les ancres `<span id="page-N">` sont **non fiables** : n'en déduis jamais une `source.page`.

Le champ `book` d'une entrée porte l'**`abbr`** de `src/data/books.json` — 30 livres
enregistrés, dont 19 en VF : `LDB`, `AA`, `VDM`, `ADE I`, `ADE II`, `MCLB`, `ACE`, `ZI`, `MDG`, `EDOC`, `MSRC`, `BI`, `AU1`, `AU2`, `NADJ`, `EDO`, `MSR`, `PDT`, `frenchy.bzh`.
Les 11 autres entrées sont en VO : seul le livre VO nommé au `CLAUDE.md` § *Sources VF* est citable.

## 4. L'ENVELOPPE est posée par la fabrique — ne la redéclare jamais

Tout document passe par `document(...)` (`src/data/schemas/grammaire/document.ts`), qui pose SEULE les
11 clés d'enveloppe ci-dessous : les redéclarer dans les champs du def est une erreur de
compilation ET d'exécution. Leur libellé FR appartient donc lui aussi à la fabrique.

| Clé | Libellé FR | Un document peut-il l’EXIGER ? |
|---|---|---|
| `id` | Identifiant | — |
| `type` | Type de document | — |
| `label` | Libellé | — |
| `labelF` | Libellé (forme féminine) | oui (`options.exiges`) |
| `desc` | Description | oui (`options.exiges`) |
| `descRef` | Adresse de la prose (livre) | — |
| `source` | Source | oui (`options.exiges`) |
| `alsoIn` | Aussi publié dans | oui (`options.exiges`) |
| `variants` | Variantes | — |
| `maison` | Arbitrage maison | oui (`options.exiges`) |
| `icon` | Icône | oui (`options.exiges`) |

**LIBELLÉS** : le nom FR d'un CHAMP vit dans la `meta` du def ; le nom FR d'une **valeur d'enum
affichée se pose par `enumNomme`** (`src/data/schemas/grammaire/valeurs.ts`), qui porte la table
`{ option: 'Libellé FR' }` SUR LE NŒUD — jamais un Record de libellés côté UI (ce serait une seconde
vérité, et l'atelier ne saurait pas la lire en profondeur).

**PROVENANCE** : une entrée porte `source` **ou** `maison` (la raison de l'arbitrage en clair),
jamais ni l'un ni l'autre — le refus est posé par la fabrique elle-même, pas par une garde
secondaire. Une entrée sans folio n'est pas interdite : elle doit DIRE pourquoi.

## 5. Chaque champ = Source ⊕ convention voisine

Conventions complètes : `docs/donnees.md` ; formes observées champ par champ :
`docs/structures-donnees.md`. En bref : `desc` = **verbatim** Markdown (règle 5 de `CLAUDE.md`,
garde `no-html-in-prose`) ; les formes de champ se copient des voisins ; la logique est keyée par
**id stable**, `label` = affichage.

## 6. Zéro invention, zéro inflexion RAW

Un champ introuvable au Source → omission assumée (pas une valeur inventée). Une **mécanique RAW que le
moteur ne modélise pas** → ce n'est pas « hors scope » : c'est une dette → **issue** (ou une valeur
`maison` taguée si le RAW laissait le choix au MJ — house-rule ≠ lacune, règle 7 de `CLAUDE.md`).
JAMAIS un choix d'agent silencieux enterré. Avant de conclure « le moteur ne sait pas faire X » :
`docs/vocabulaire-mecanique.md` (les ops et Conditions qui EXISTENT) et `docs/index-moteur.md`
(les coutures qui existent).

## 7. Canonicaliser + gardes

- Canonicaliser via `serializeDataset` (`src/data/serialize.ts`) — jamais un reformatage manuel ni un
  `JSON.stringify` maison (le round-trip est byte-exact).
- `npm test` + `npm run typecheck` verts.
- Si l'élément est visible au Codex/éditeur → **recette navigateur** (`docs/recette-navigateur.md`).

| Garde | Ce qu’elle verrouille (son propre `describe`) |
|---|---|
| `src/data/serialize.test.ts` | serializeDataset — round-trip byte-fidèle des datasets app-owned |
| `src/data/no-html-in-prose.test.ts` | Règle 5 — prose en Markdown, jamais en HTML |
| `src/data/id-collisions.test.ts` | intégrité des ids de données |
| `src/data/data-atlas-complete.test.ts` | atlas des données (docs/donnees.md) — complétude |
| `src/data/maison-sans-source.test.ts` | cliquet « maison sans source » — le régime d’arbitrage ne dérive pas (#1467 L1b) |
| `src/data/data-wellformed.test.ts` | Intégrité des données src/data/*.json |
<!-- sources-empreinte: 08f0b024d8365f86a9d6be16b49ee122a544d5c7 (18 fichiers, 1 dossiers) corps: 2523c80a365c9477a00835647a730dd605a87cfa -->
