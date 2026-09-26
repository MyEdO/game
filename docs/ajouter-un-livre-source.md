# Ajouter un livre source (pipeline complet)

Opération : intégrer un **nouveau livre VF autorisé** (§ Sources VF de `CLAUDE.md`) au projet — de
son PDF à sa présence dans l'Atlas RAW (`docs/raw/`) et, si besoin, dans `src/data/*.json`. Suit le
runbook rejoué pour **La Mer des Griffes** (MDG, 15e livre, 2026-06-22 — commits `295f9a40` +
`819de62d`). Lire d'abord `docs/raw/00-index.md` et `docs/raw/sources.md`.

**Préalable non négociable** (règle 1 de `CLAUDE.md`) : un livre n'entre dans le pipeline que s'il est
déjà listé au § *Sources VF* du `CLAUDE.md` racine du dossier `Game`, en **VF**. La Boîte d'Initiation
WFRP 4e est explicitement **exclue** (`docs/raw/sources.md` § *Exclu des règles* — ruleset simplifié
divergent, jamais une source de règles ni de stats).

## 1. Extraction Marker (PDF → markdown paginé)

Le PDF est gitignoré ; l'extraction passe par `marker-pdf` (CPU), avec la couche texte exacte
**désactivant l'OCR** — plus fidèle que l'ancien pymupdf4llm sur les tables :

```bash
marker_single "Source/<Nom du livre>.pdf" --output_format markdown \
  --config_json scripts/raw/marker-paginate.json --disable_ocr \
  --output_dir "Source/_marker/full/<Nom du livre>" --disable_image_extraction
```

Long (~45 min pour un livre dense) — lancer en arrière-plan. `--config_json marker-paginate.json`
active `paginate_output=true` : le markdown de sortie porte des séparateurs `{N}----` (N = page
PDF **0-indexée**).

**Piège connu** : Marker **gate par mise en page** — un livre
saturé d'illustrations en zones « figure » peut perdre une grosse part du texte en `--disable_ocr`
(vécu sur *Le Zoo Impérial* : -70 %, ré-extrait en OCR classique, seul livre du corpus dans ce cas).
Vérifier après coup que le `.md` produit fait une taille plausible (comparer au nombre de pages du
PDF) avant de découper ; si la perte est massive, relancer **sans** `--disable_ocr`.

Pour ré-extraire en lot les 13 suppléments existants (hors LDB déjà fait), le driver
`scripts/raw/reextract-all.sh` (bash) boucle la commande ci-dessus + l'étape 2 vers un **staging**
(`Source/_marker/split/<dir>/`) sans jamais écraser `Source/` — la promotion reste une étape
manuelle après revue.

## 2. Découpe en chapitres `Source/<Livre>/NN - Titre.md`

Deux scripts selon que le livre a ou non une structure `Source/` **préexistante** à réaligner :

- **Livre déjà présent sous `Source/`** (ré-extraction) : `marker-split.mjs "<ancien-dossier>"
  "<marker-paginé.md>" "<dossier-sortie>"`. Aligne les nouveaux chapitres sur les noms de fichiers
  et pages de début des anciens `.md` (marqueur `Pages PDF X` en tête de chaque ancien chapitre),
  frontière **titre-d'abord** (cherche l'en-tête markdown au/après la page de début), repli sur
  l'offset de page si le titre ne matche pas (gère les chapitres qui partagent une page — génère
  alors un stub `*(Page X partagée avec un chapitre voisin…)*`, à vérifier).
- **Livre neuf, sans structure à réaligner** : écrire un splitter dédié sur le patron de
  `scripts/raw/split-mdg.mjs` — liste ordonnée `[titre de fichier, clé normalisée du titre]` tirée
  du **sommaire** du livre, recherche **séquentielle** de chaque en-tête `#…` (gère les titres
  dupliqués ailleurs dans le texte), page PDF déduite du dernier séparateur `{N}----` rencontré + 1.
  Sortie : `Source/<Livre>/NN - Titre.md` (garde l'en-tête `*Pages PDF X*` ou `*Pages PDF X-Y*`,
  séparateurs `{N}----` retirés) + `00 - Index.md` récapitulatif.

Après découpe : vérifier qu'aucun chapitre n'est un stub vide/mal replié (grep `Page .* partagée`),
puis committer le dossier `Source/<Livre>/` (le PDF et `Source/_marker/` restent gitignorés).

## 3. Enregistrement du livre dans le pipeline

Trois points d'enregistrement, dans cet ordre :

1. **`src/data/books.json`** (SOURCE UNIQUE des acronymes, #585) — l'entrée du livre porte
   `abbr: '<ABRÉV>'`, `dir: 'Source/<dossier du livre>'` et `language: 'VF'` (un livre déjà présent en
   placeholder VO sans `dir` se COMPLÈTE, jamais un doublon). Puis **`scripts/raw/_lib.mjs`** — ajouter
   l'`id` du livre au tableau `BOOK_ORDER` : `BOOKS` en DÉRIVE (filtre les entrées porteuses d'un `dir`,
   ordonnées par `BOOK_ORDER` — source unique partagée par `coverage.mjs`/`reconcile.mjs`/`reanchor.mjs`).
   L'ordre de `BOOK_ORDER` fixe l'ordre d'affichage des rapports. (Édition de `books.json` : round-trip
   octet-fidèle exigé par `src/data/serialize.test.ts`.)
2. **`docs/raw/sources.md`** — ajouter une ligne à la table *Les N livres* (abrév, titre, dossier,
   rôle en une phrase) et incrémenter le compte en tête de fichier (« Le **RAW** du projet = ces
   **N livres** »). Si le livre a des chapitres purement narratifs/de cadre (gazetteer), documenter
   le partage règles/cadre ici ou dans `CLAUDE.md`.
3. **`CLAUDE.md`** (§ *Sources VF*) — ajouter l'entrée abrév + dossier + **périmètre par passage** dans
   la liste **RÈGLES & STATS** de `docs/sources-vf.md` (arbitrage 2026-07-10 : tout livre FR peut fournir
   des règles ; un livre dont aucune règle n'est extraite reste simplement listé parmi les volumes
   scénario, comme Ubersreik). La curation est toujours *à la main* (voir § 5) ; préciser le tag
   `source.book` attendu dans `src/data/*.json`.

`docs/raw/00-index.md` liste séparément le compte de livres en tête (« consolidées depuis les N
livres autorisés ») — **vérifier qu'il reste synchronisé** avec `sources.md` à chaque ajout (cf.
§ Anomalies : au moment de la rédaction, `00-index.md` n'a pas suivi le dernier ajout MDG).

Si le livre a des chapitres de **cadre pur** (gazetteer, sans règle), les lister dans
`HORS_REGLE` de `scripts/raw/coverage.mjs` (ex. `'MDG 1', 'MDG 3', …` — cadre côtier) pour qu'ils
sortent du dénominateur de couverture au lieu de compter comme des trous.

## 4. Intégration à l'Atlas RAW (`docs/raw/`)

L'Atlas (cf. `docs/raw/00-index.md`) consolide les règles **par domaine**, pas par livre — un
nouveau livre vient enrichir les fiches de domaine existantes (`combat.md`, `magie.md`, …) ou en
créer une nouvelle si le livre introduit un domaine inédit (le combat naval de MDG a justifié
`docs/raw/combat-naval.md`, un fichier dédié référencé dans la table `Domaines` de `00-index.md`).

- **Workflow multi-agents** (opt-in « ultracode », cf. skill `orchestrer-des-agents`) :
  un agent par domaine touché fait `extract → verify` adversarial — la vérification reconfronte
  chaque réf/citation à la source, indispensable (des fabrications de contenu ont été trouvées et
  corrigées lors de l'épreuve du 2026-06-22, `docs/raw/epreuve-2026-06-22.md`). Le script workflow
  n'a pas d'accès filesystem : il renvoie topics/entrées de catalogue/sommaire en JSON.
- **Apply déterministe** : un script `apply-<livre>.mjs` (patron `scripts/raw/apply-mdg.mjs`) lit
  le JSON de sortie du workflow et insère topics + sommaire dans les fiches de domaine, **idempotent**
  via un sentinel `<!-- <LIVRE>-INTEGRATION -->`.
- **Catalogues de données verbatim** (`docs/raw/catalogue-*.md`) : régénérés par
  `node scripts/raw/build-catalogs.mjs`, qui concatène **verbatim** les chapitres de données du
  livre (repérés par chapitre dans la table `DOMAINS` en tête du script — ajouter les paires
  `[ABRÉV, [numéros de chapitre]]` du nouveau livre au domaine catalogue concerné :
  `catalogue-creatures`, `catalogue-sorts`, `catalogue-divin`, `catalogue-equipement`,
  `catalogue-carrieres` ou `catalogue-divers`). Un chapitre cité par un catalogue est crédité
  **au niveau chapitre** par `coverage.mjs`/`reconcile.mjs` (pas besoin de citation `l.X`).

## 5. Curation de la donnée dans `src/data/*.json`

> ⚠️ **AVANT de curer : inventaire de complétude par TYPE d'entité (garde anti-oubli, #734/#735).**
> `coverage.mjs ⬜0` mesure la **CITATION** (chapitre cité par une fiche / crédité par un catalogue /
> hors-règle), **jamais** la CAPTURE du contenu — un chapitre `📖` est *« transcrit, jamais traité »*.
> Ne JAMAIS prendre `⬜0` pour « livre intégré », et ne PAS dériver le périmètre de curation des seuls
> buckets de catalogue : les entités **transverses** (un talent défini au ch.X, modifié aux ch.Y/Z)
> tombent entre les mailles (vécu VDM 2026-07-22 : le Talent *Concocter* modifié en ch.12 et les 4
> nouveaux Traits, ratés par une énumération pilotée par la couverture — trouvés par l'utilisateur).
>
> **Passe OBLIGATOIRE avant de déclarer le livre intégré** — workflow multi-agents, **un agent par
> chapitre** (patron `vdm-completude-entites`, cf. run 2026-07-22) : recenser EXHAUSTIVEMENT, **par
> TYPE** (sort · carrière · compétence · **talent** · trait · qualité · objet/équipement · état ·
> créature/PNJ · règle · activité · rituel · table · race), tout ce que le livre **ajoute / MODIFIE
> (variante gatée par le module, cf. [`game-doctrine-une-entite-n-livres-n-variantes`]) / republie**,
> avec réf `<ABRÉV> NN l.X`. Sortie = un artefact DATÉ `docs/plans/AAAA-MM-JJ-<livre>-inventaire-entites.md`.
> Puis **RÉCONCILIER** : chaque entité est soit déjà dans `src/data`, soit portée par un ticket. Rien
> qui flotte. Le livre n'est « fait » que quand l'inventaire est soldé (précédent VDM :
> `docs/plans/2026-07-22-vdm-inventaire-entites.md`, 460 entités → tickets #729-#735).

`src/data/*.json` est la **source app-owned**, commitée, éditable au Compendium. Toute donnée
mécanique tirée d'un nouveau livre s'ajoute **à la main** (ou via l'éditeur en jeu), jamais par
re-seed automatique — c'est le chemin suivi par AA, ZI, MDG, ACE, MSRC et NADJ (périmètres :
`docs/sources-vf.md`).

- Chaque entrée mécanique tagge sa provenance avec un champ `source: { book: "<ABRÉV>", page: N }`
  (vu tel quel dans `src/data/traits.json`, `naval-traits.json`, `creatures.json`, `activities.json`,
  `mutations.json`, `careers.json`, etc. — 38 fichiers portent ce champ). Certaines données de
  périmètre (activités, véhicules) portent en plus un `where: [...]` qui gate par lieu/contexte
  (ex. `activities.json` avec `"source":{"book":"ACE"}, "where":["altdorf"]`).
- Coller le texte **verbatim** (règle 5 de `CLAUDE.md`) : aucune reformulation, formatage Markdown
  conservé (`**gras**`, listes, sauts `\n\n`), jamais de HTML — garde-fou
  `src/data/no-html-in-prose.test.ts`.
- Toute description mécanique passe par la primitive `<Prose>` (`src/ui/Prose.tsx`) au rendu, pas
  par un `dangerouslySetInnerHTML` ou un template ad hoc.
- Tout **effet mécanique** (passif, déclenché, soin, dégâts…) issu du nouveau livre s'exprime en
  `GameOp[]` (`src/engine/ops.ts`), édité via `<GameOpEditor>` — jamais un type/champ ad hoc (cf. `docs/primitives.md`).

## 6. Vérification (gardes rejouables)

Dans l'ordre, après toute extraction/intégration :

```bash
node scripts/raw/reanchor.mjs --apply     # ré-ancre les citations verbatim « … » de l'Atlas contre la Source courante
node scripts/raw/coverage.mjs             # chapitres du livre : ✅ couvert / 📖 catalogue seul / 🟡 effleuré / ⬜ trou / ➖ hors-règle
node scripts/raw/reconcile.mjs            # code ↔ Atlas : Sens A (règle codée absente de l'Atlas) doit rester à 0
```

- `reanchor.mjs --apply` corrige les dérives **HIGH** (citation retrouvée de façon unique dans la
  source) ; `--remap` (réservé aux réfs de *synthèse*, sans citation attachée) ne doit être lancé
  **qu'avant de committer** une nouvelle extraction de la Source — une fois committée, `git HEAD`
  == l'arbre de travail et la carte devient un no-op. Ne jamais lancer `--remap` sur une Source déjà
  committée : il recalerait aussi les réfs des autres livres via le diff `git HEAD`↔arbre.
- `coverage.mjs` doit sortir le nouveau livre à `⬜ 0` (tout chapitre-règle couvert par une fiche
  **ou** un catalogue **ou** listé en `HORS_REGLE`/`SCENARIO_BOOKS`) avant de considérer
  l'intégration terminée.
- `reconcile.mjs` ne réconcilie que les réfs **`LDB NN l.X`** en profondeur (Sens A ligne-par-ligne) ;
  pour les autres livres (dont un nouveau livre comme MDG), il ne fait qu'un comptage global des
  mentions par livre (section *Autres livres* du rapport), sans le calcul de trou fin par ligne.

## 7. Corriger un défaut d'extraction (table cassée, césure, chapitre mal titré, page perdue)

Un `.md` de `Source/` n'est pas figé : une table recollée de travers, un paragraphe coupé par une
césure, une page que Marker a sautée se corrigent **à la main**, au PDF. Ce geste **déplace du
texte**, donc il déplace ce qui le cite : les numéros de ligne des réfs de l'Atlas et du code, et les
**adresses** `descRef` de la donnée. Tout se rejoue en une passe, et **tout part dans le MÊME
commit** (Source corrigée + réfs recalées + adresses recalées + fiches `Implémente` régénérées).

1. **Éditer** `Source/<livre>/NN - X.md`, la page PDF ouverte à côté — verbatim, y compris les
   coquilles du livre. Les marqueurs `<span … data-folio="N">` sont l'ancrage de page : on les
   déplace avec leur texte, on n'en invente pas.
2. `node scripts/raw/reanchor.mjs --apply --remap` — **avant** de committer la Source. La clause de
   `--remap` est écrite plus haut (§6, « Ne jamais lancer `--remap` sur une Source déjà committée ») :
   la carte de recalage se lit du diff `git HEAD`↔arbre, elle n'existe donc que tant que la
   correction n'est pas commitée.
3. `npx vitest run src/data/prose-resolution.test.ts` — la garde de re-résolution liste **exactement**
   les entrées dont l'adresse ne rend plus son texte, avec le code de la rupture
   (`bornes-hors-limites`, `empreinte-divergente`, `ligne-introuvable`…). C'est l'inventaire des
   consommateurs impactés : ni plus, ni moins.
4. `node scripts/source/reparer-adresses.mjs` puis `--apply` — relocalise chaque adresse cassée par
   son **texte d'origine** (la même adresse résolue sur la version `--depuis`, lue par `git show`) et
   propose l'adresse corrigée. Quatre verdicts : `RECALÉE` (un seul emplacement, et l'adresse neuve
   re-rend le texte d'origine à l'octet), `AMBIGUË` (plusieurs emplacements, listés), `PERDUE` (le
   texte n'est plus là), `IRRÉCUPÉRABLE` (l'adresse ne résolvait déjà pas à `--depuis`). Sur un
   montage, c'est le verdict le plus coûteux qui gouverne : un fragment `PERDUE` rend l'adresse
   entière `PERDUE`, même si un autre fragment n'était qu'`AMBIGUË`. **`--apply` n'écrit que les
   `RECALÉE`** ; les trois autres se règlent à la main, au PDF.
5. `node scripts/raw/anchor-fill.mjs <ABBR> --ch NN --pdf <chemin> --apply` s'il reste des blocs sans
   folio : il pose des ancres `data-folio` **ciblées**, et saute tout candidat absent, multiple ou
   hors bornes.
6. `npm run gates && git commit` — tout dans le même commit.

Ce que chaque outil voit, et ce qu'il ne voit **pas** :

| Outil | Ce qu'il juge | Son angle mort |
|---|---|---|
| `scripts/raw/check-code-refs.mjs` | qu'une réf `<ABRÉV> NN l.X` du code tient dans les bornes du chapitre, et que la ligne citée n'est pas vide | le **contenu** : une réf qui tombe sur un autre paragraphe de la bonne longueur passe |
| `scripts/raw/reanchor.mjs` | les citations verbatim de l'Atlas, retrouvées à l'identique dans la Source courante | les réfs de *synthèse* (sans citation) — d'où `--remap`, et sa clause d'antériorité au commit |
| `src/data/prose-resolution.test.ts` | que toute `descRef` du dépôt rend son texte AUJOURD'HUI (empreintes comprises) | il nomme la rupture, il ne la répare pas |
| `scripts/source/reparer-adresses.mjs` | où le texte d'origine a atterri, et le re-prouve à l'octet | il n'écrit que les `RECALÉE` — une source **réécrite** n'est pas un déplacement |

Deux précédents exécutés de bout en bout : `850ae3199` (le folio 88 du livre de base restitué — la
page du Juriste revenue à la vérité citable, la donnée suivant le livre) et `8d7465698` (20
lignes-titres de carrières restituées au chapitre 08, `careers.json` repassé au folio imprimé).

## Piège des PDF sources faillibles

Un écart entre `src/data/*.json` et la Source `.md` **n'implique pas que le JSON est faux** — les
PDF WFRP4 (même passés à Marker) contiennent de vraies erreurs, et une partie de la donnée a déjà
été corrigée à la main contre ces erreurs (exemple fondateur : la table de carrières Middenheim
suit l'ordre alphabétique **anglais** dans le PDF FR, ce que le JSON corrige). Sur tout audit,
traiter chaque écart **au cas par cas** : citer la source, se demander si c'est un bug JSON ou une
correction volontaire, et flaguer plutôt qu'imposer la valeur de la source. En cas de doute sur une
valeur/orthographe (pas sur un ordre de collation), la **VO** du même livre (dispo sous `Source/`)
sert d'arbitre — jamais comme source de la donnée affichée, qui reste recollée du FR.

## Gardes

- `node scripts/raw/coverage.mjs` — couverture chapitre-par-chapitre du livre (doit atteindre ⬜0).
- `node scripts/raw/reconcile.mjs` — Sens A (règle codée absente de l'Atlas) doit rester à 0 après
  toute extension de `src/engine`/`src/data` qui cite le nouveau livre.
- `node scripts/raw/reanchor.mjs` (+ `--apply`, one-shot `--remap` avant commit de la Source) —
  citations verbatim de l'Atlas alignées sur la Source courante.
- `npx vitest run src/data/no-html-in-prose.test.ts` — aucune description collée en HTML.
- `node scripts/source/reparer-adresses.mjs` (+ `--apply`, `--dataset <nom>`, `--depuis <ref-git>`) —
  adresses `descRef` recalées après une correction d'extraction ; sortie 1 tant qu'une adresse reste
  cassée. La garde qui les JUGE est `src/data/prose-resolution.test.ts`.
