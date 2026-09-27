# Atlas RAW — Index

Base de connaissance des **règles (RAW)** du projet, **consolidées** depuis les livres autorisés, à
**usage d'agent** : répondre vite et sûrement à *« est-ce que X est RAW, et que dit exactement la
source ? »* quand la réponse est éclatée sur plusieurs chapitres **et** plusieurs livres.

Cette page ROUTE. Une fiche appartient à **un cœur de règles**, et son **chemin** le dit
(`docs/raw/<coeur>/<domaine>.md`) : aucun cœur n'est le cœur implicite. Les trois rapports générés
ci-dessous, eux, couvrent **tous les livres**, tous cœurs confondus.

## Cœurs de règles

La liste sort du registre des livres (`src/data/books.json`, champ `coeur`) — un cœur de plus y est
UNE entrée plus un dossier.

<!-- ATLAS-COEURS:DEBUT -->
- [`4e/`](4e/00-index.md) — livre(s) de cœur : LDB
- [`5e/`](5e/00-index.md) — livre(s) de cœur : CRB
<!-- ATLAS-COEURS:FIN -->

## ⚠ Fichiers au-dessus du seuil d'outillage (512 Ko)

Les outils de recherche des sessions (`ctx_search`, lean-ctx) **sautent SILENCIEUSEMENT** les
fichiers de plus de 512 Ko et rendent « 0 résultat » : toute preuve d'existence ou d'absence
dans ces fichiers se fait au **grep natif** (`Select-String`/`grep`) — un « 0 résultat »
d'outil n'y prouve RIEN. Fichiers de l'Atlas concernés (garde
`src/oversize-search-blindspot.test.ts` : cette liste et la mesure doivent coïncider) :

- [`4e/catalogue-creatures.md`](4e/catalogue-creatures.md)
- [`4e/catalogue-equipement.md`](4e/catalogue-equipement.md)
- [`4e/combat.md`](4e/combat.md)
- [`4e/catalogue-sorts.md`](4e/catalogue-sorts.md)
- [`4e/catalogue-carrieres.md`](4e/catalogue-carrieres.md)

Même piège hors Atlas : `src/data/*.json` volumineux (`creatures.json`, `spells.json`,
`careerLevels.json`) et certains extraits `Source/**/*.md` — listes gelées dans la même garde.

## Gardes déterministes (rejouables)

- **[`coverage.md`](coverage.md)** (`node scripts/raw/coverage.mjs`) — chaque chapitre des livres autorisés (table dans [`sources.md`](sources.md)) : ✅ couvert par une fiche / 📖 transcrit par un catalogue seul (jamais traité) / 🟡 effleuré / ⬜ trou / ➖ hors-règle (scénario, prose ≠ règle). **Seuil : ⬜ = 0.** Détail section-granulaire à niveau de heading ADAPTATIF par livre (#604) : la mesure ne suppose plus H2, elle DESCEND (H3/H4) sur les livres qui structurent leurs chapitres plus fin.
- **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non-régression LDB verrouillée par `reconcile.test.mjs`, tous livres couverts, folio compris). **Sens B (#434) : tout topic `(non implémenté)` porte une entrée de manifest (ticket #N ou blocage consigné dans `src/data/raw.manifest.json`) — gardé par `npm run raw:implemente --check` (exit 1 sur orphelin).**
- **`node scripts/raw/check-source-tables.mjs`** (#1384) — les TABLES du `Source/` que leur FORME rend inadressables, en cinq familles : `br-litteral` (un `<br>` littéral dans une cellule — un saut de ligne IMPRIMÉ que la lib absorbe pour l'adressage, et dont le SENS se tranche au PDF, site par site, `preuve` à l'appui sur l'entrée), `donnee-en-tete` (continuation après saut de page dont les « en-têtes » sont une fourchette), `banniere-suspecte` (bandeau de titre que le parseur n'absorbe pas), `cle-de-ligne-ambigue` (clé de ligne partagée par deux tables d'une même section) et `table-avalee-par-titre` (bandeau, rangée de labels et valeurs effondrés sur la ligne d'un titre : la table n'existe plus, aucune autre famille ne la voit). **INVENTAIRE NOMINATIF** `scripts/raw/source-tables-stock.json` (une entrée par site, clé `famille :: fichier :: réf :: occurrence`) : un site hors stock ET une entrée sans site sont rouges, et le nombre d'entrées est PLAFONNÉ. La **dette**, elle, est le compte `à trier` (entrées sans `preuve`) imprimé à chaque run : **décroissant vers zéro**, sous son propre plafond (`PLAFOND_A_TRIER`). Un site se solde en corrigeant le `.md` (l'entrée part) ou en prouvant sa forme au PDF (`preuve` + `date` sur l'entrée, qui reste). Le geste de réparation est le tableau « défaut de table → geste » de [`../ajouter-un-livre-source.md`](../ajouter-un-livre-source.md) §7 ; le stock se régénère par `--ecrire-stock`.
- **`node scripts/raw/check-source-puces.mjs`** (#1820) — la PUCE IMPRIMÉE LUE COMME UN JETON : les PDF impriment leurs listes avec un glyphe d'ornement (Core Rulebook 5e : le chiffre `0` de la police `onlyskulls`, un petit crâne), et l'extraction Marker rend le CODE du glyphe — un caractère que la page n'imprime nulle part, et qu'une fiche citerait pour du texte. Un SITE est une liste dont au moins DEUX items consécutifs s'ouvrent par le MÊME jeton d'un seul caractère (`- 0 Texte`, ou sans marqueur `0 Texte` quand l'extraction a aussi perdu le `- `) ; une liste réellement NUMÉROTÉE (`0`, `1`, `2`) ne mord pas, ses jetons DIFFÈRENT. Aucun jeton n'est écrit dans la garde : une puce lue `O`, `Q` ou `•` entre par la même porte. En revanche un jeton de PONCTUATION OUVRANTE (catégorie Unicode `Pi`/`Ps` : `«`, `“`, `‹`, `(`, `[`…) n'ouvre pas un item mais une citation ou une incise dont la page IMPRIME le signe : il sort de la classe. COUVERTURE DITE : l'item ISOLÉ (pas de frère au même jeton) et la puce INTERNE à une ligne (colonnes de la page effondrées par l'extraction) restent invisibles — le banc le dit. **INVENTAIRE NOMINATIF** `scripts/raw/source-puces-stock.json` (clé `fichier :: réf :: occurrence`, la réf portant le jeton et l'ouverture normalisée du premier item — jamais une position) : un site hors stock ET une entrée sans site sont rouges, le nombre d'entrées est PLAFONNÉ. Un site se solde au `.md`, jeton par jeton, contre la page : le jeton PART s'il n'y a qu'une puce imprimée (et devient le marqueur `- ` là où l'extraction l'a perdu), il RESTE si la page l'imprime. Le stock se régénère par `--ecrire-stock`.
- **`node scripts/raw/check-renvois.mjs`** (#1393) — les RENVOIS « page N » du texte d'un livre, résolus en ADRESSE (`DescRef` d’une section entière aux niveaux section et table ; toute résolution porte aussi la page `{ book, page }` que le livre dit ; empreinte calculée à la résolution) par le résolveur PUR `src/data/source/renvoi.ts`, qui porte son NIVEAU DE PREUVE : `table` (la clause nomme « X table » et une section du folio a ce titre), `section-adjacente` (titre du folio le plus proche avant le renvoi dans sa clause ; un titre à parenthèse finale se compare aussi sans elle ; à tout niveau, un titre trouvé DANS l’étendue d’un autre titre trouvé n’est pas nommé), `section-phrase` (un seul titre du folio dans la phrase), `page` (un seul fichier au folio, aucune table nommée : la cible est la page `{ book, page: N }` elle-même, aucune section), `ambigu` (candidats listés), `introuvable`. Motifs par LANGUE (`books.json#language`), mesurés au corpus : VO seule à ce jour. **INVENTAIRE NOMINATIF** `scripts/raw/renvois-stock.json` (clé `famille :: fichier :: slug#occ :: p.N :: rang R :: occurrence`, jamais une ligne) : un renvoi non résolu hors stock ET une entrée résolue sont rouges, le nombre d'entrées est PLAFONNÉ.
- **[`reanchor.md`](reanchor.md)** (`node scripts/raw/reanchor.mjs` ; `--apply` verbatim + `--remap` synthèse) — ré-ancre les réfs `l.X` contre la Source Marker : citations « … » par **match exact**, réfs de synthèse et leurs continuations nues par la **carte de lignes EXACTE du diff `git HEAD`↔arbre** (`--remap`, avant de committer la Source ; une réf non appariable est RAPPORTÉE, jamais devinée — après une ré-extraction complète, la plupart le sont : règle d'appariement dans [`ajouter-un-livre-source.md`](../ajouter-un-livre-source.md) §6). **Seuils : 🔧 = 0 · 🟡 = 0 · ❌ = 0** (un résidu irréductible recrée `reanchor-low-stock.json`, cliquet NOMINATIF par site, à sa mesure minimale). Voir l'**[épreuve du 2026-06-22](4e/epreuve-2026-06-22.md)**.

> Les COMPTES courants (✅/🟡/❌, chapitres non pinés, marqueurs, B2) vivent dans les fichiers GÉNÉRÉS ci-dessus, jamais dans cette page — un compte recopié à la main ment dès le commit suivant.

> **Source = Marker propre pour tous les livres autorisés** (table dans [`sources.md`](sources.md) ; texte exact ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`). L'Atlas remplace la source : 0 trou de règle. Les TABLES, elles, ne sont pas toutes intactes : leur dette de forme est MESURÉE et cliquetée par `check-source-tables` ci-dessus — elle se solde à la main au PDF, jamais par une ré-extraction (⚠️ ci-dessous).

> ⚠️ **Ré-extraction de `Source/` : JAMAIS en masse.** Une re-passe Marker totale décale les numéros de
> ligne de ~3 000 citations du CODE que `reanchor.mjs --remap` ne couvre pas (il ne remappe que les fiches) —
> c'est le chantier de ré-ancrage de 2026-07-16 (#434, ~400 réfs corrigées à la main au Source) à refaire en
> entier. Les trous d'ancrage folio se corrigent par **insertions d'ancres CIBLÉES** (#522), chapitre par
> chapitre, gardes `raw:*` relancées avant commit. Une ré-extraction totale exige d'ABORD un outil de remap
> code-side.

> ⚠️ **Limite connue (#323, vérifiée 2026-07-11)** : Marker perd les GLYPHES des schémas de progression
> (marteau/crâne/bouclier — seule la croix survit en `h`). Les gardes `coverage`/`reconcile` ne peuvent
> PAS le détecter (absence silencieuse, pas un caractère corrompu) — seule une comparaison au rendu-image
> du PDF le peut. La donnée app-owned (`careers.json`/`careerLevels.json`) est vérifiée SAINE (10 carrières
> échantillonnées, 40 valeurs conformes PDF) : le défaut ne touche que la prose `Source/*.md` — réparation
> des glyphes au fil des besoins Atlas, par comparaison PDF.
