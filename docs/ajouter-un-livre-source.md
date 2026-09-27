# Ajouter un livre source (pipeline complet)

Opération : intégrer au projet un **nouveau livre autorisé** — VF, ou le livre VO nommément
autorisé au § Sources VF de `CLAUDE.md` — de
son PDF à sa présence dans l'Atlas RAW (`docs/raw/`) et, si besoin, dans `src/data/*.json`. Suit le
runbook rejoué pour **La Mer des Griffes** (MDG, 15e livre, 2026-06-22 — commits `295f9a40` +
`819de62d`). Lire d'abord `docs/raw/00-index.md` et `docs/raw/sources.md`.

**Préalable non négociable** (règle 1 de `CLAUDE.md`) : un livre n'entre dans le pipeline que s'il est
déjà listé au § *Sources VF* du `CLAUDE.md` racine du dossier `Game`, en **VF**. Un livre **VO**
n'entre que s'il y est **NOMMÉMENT** autorisé ; à ce jour il y en a UN, le *Core Rulebook 5e*
(arbitrage utilisateur du 2026-09-18, épique #1816). La Boîte d'Initiation
WFRP 4e est explicitement **exclue** (`docs/raw/sources.md` § *Exclu des règles* — ruleset simplifié
divergent, jamais une source de règles ni de stats).

## 0. Format canonique (la forme UNE de toute extraction)

Toutes les extractions de `Source/` ont **UN** format, décrit ici et mesuré par
`scripts/raw/check-source-format.mjs`. **Le geste, un seul** : rejouer la chaîne canonique sur le
livre — re-découpe depuis la sortie Marker conservée sous `Source/_marker/`, ou ré-extraction quand
cette sortie manque. Jamais un rafistolage chapitre par chapitre (arbitrage utilisateur du
2026-09-14, verbatim : « Il faut un format unifié pour toutes les extractions, donc s'il faut
rééxtraire, on rééxtrait » ; fiche
`.claude/memory/user-doctrine-format-unifie-reextraction-permise.md`). La clause de l'épique #1388
« un livre en service ne se ré-extrait plus » est levée par cet arbitrage ; « FORME jamais SENS »
reste.

**La chaîne JOUABLE aujourd'hui** — c'est exactement celle des §1 et §2, et rien d'autre n'est
committé :

- `marker-pdf` (CPU), config `scripts/raw/marker-paginate.json` (`paginate_output: true`, inchangée
  depuis `09b30a7b8`) : le markdown de sortie porte des séparateurs `{N}----`, N = page PDF
  **0-indexée**.
- Une passe **PLEINE** par livre (§1), ou le driver `scripts/raw/reextract-all.sh <id>…` qui boucle
  les livres passés en argument vers le staging `Source/_marker/split/<id>/` sans jamais écraser `Source/`.
- Découpe par `scripts/raw/marker-split.mjs` : il pose lui-même la ligne 1 `*Pages PDF …*` et passe
  chaque nom de fichier par `nomAscii`. Il s'**aligne sur la structure `Source/` préexistante** —
  il lit les anciens `NN - X.md` et leur marqueur `Pages PDF` pour retrouver les frontières. Un
  dossier qui n'en porte pas (les 6 livres en `*Folio N+*`, les 4 dossiers pré-pipeline) ne lui
  donne aucun chapitre : sa structure cible se pose d'abord (§2).
- Folios ensuite : `scripts/raw/folio-bootstrap.mjs` puis `scripts/raw/anchor-fill.mjs` (§ 7, étape 5).
  Le bootstrap ne retient comme folio imprimé que l'UNIQUE nombre nu non nul de la page, présent à
  ses bords : deux nombres nus distincts (bandeau de double page, cellule `d10`) rendent la page non lue.

**Découpage en tranches (reste de #1739).** La session d'extraction produit le PDF par tranches de
40 pages ; le séparateur `{N}----` portant l'index **absolu** de page quelle que soit la tranche,
les tranches s'unissent **par page** (une page en double ou un texte hors pagination doivent être
refusés). L'union vit dans `scripts/raw/lib/marker-pages.mjs` : `mdsDeMarker` accepte un `.md` d'un
tenant comme un dossier de tranches (`<a>-<b>/<pdf>/<pdf>.md`, ordonnées par borne basse) et
`pagesDeMarker` les unit page par page, en levant sur du texte hors pagination comme sur une page
extraite deux fois. `marker-split.mjs` la consomme par son 2ᵉ argument. Les contraintes de machine
citées avec — MAX_PATH (260) dépassé par `<out>/<nom du PDF>/<nom du PDF>.md` et l'échec **après**
conversion, ~7 Go de pointe, 15-20 s par page CPU, un seul Marker à la fois — sont un **témoignage
relevé le 2026-09-14** par la session d'extraction, non mesuré ici.

**La forme CIBLE**, telle que la garde la mesure — **aucune extraction ne l'atteint aujourd'hui**,
LDB compris ; la garde imprime le compte de dossiers hors format à chaque exécution :

| Trait | Forme canonique | Famille d'écart |
|---|---|---|
| Ligne 1 d'un chapitre | `*Pages PDF a-b*` (ou `*Pages PDF a*` pour une page unique) | `ligne1-hors-format` |
| Folios | au moins une ancre `data-folio` par chapitre | `sans-folio` |
| Ancres | `<span id="page-N-0" data-folio="F"></span>` **inline**, préfixe du texte qu'elle ouvre — jamais seule sur sa ligne | `ancre-seule` |
| Nom de fichier | `NN - Titre imprimé.md` par `nomAscii` — jamais un signet Word (`_GoBack`, `_gjdgxs`, `Sans titre`) | `nom-de-signet` |
| HTML | aucun, hors ancres et `<br>` | `html-residuel` |
| `00 - Index.md` | liens relatifs tous vivants | `index-mort` |
| Tables | chaque bloc a sa ligne de séparateur `\|---\|` | `table-sans-separateur` |
| Numéro de chapitre | un **entier** ≥ 1, zéro-paddé à la largeur du **plus grand numéro du livre**, deux au minimum (`livre-de-base` : `21` ; un livre de 120 chapitres : `007`, `105`) — `largeurDeChapitre` / `graphieDeChapitre` (`src/data/source/decoupe.ts`) rendent cette graphie, et elle est la même pour tous les fichiers d'un dossier | `largeur-de-numero` |
| GRAIN | un fichier porte **UNE section** du livre et **OUVRE** sur le titre que la LISTE DE DÉCOUPE lui donne (`ouverture`) | livre AVEC liste : rouge nommé, sans stock — livre SANS liste : `sans-decoupe` |
| Mobilier de page | aucun chiffre d'**onglet** de chapitre ni **folio** mêlé au texte | livre dont la liste porte des `onglets` : `mobilier`, rouge nommé, sans stock |
| Titres d'entrée | aucun gras de tête soudé à une ligne (P5), aucune ligne de titre à deux groupes gras | livre dont la liste porte un `gabaritTitre` : `titre-soude`, rouge nommé, sans stock |

**Le GRAIN, et son régime.** Arbitrage utilisateur du 2026-09-21, verbatim : « Oui : un fichier par
section majeure ». Le grain d'un livre est sa **LISTE DE DÉCOUPE** (§ 2,
`scripts/raw/decoupes/<id>.json`) — jamais un seuil deviné, jamais une comparaison du titre au NOM
du fichier. Cette donnée UNE s'applique par DEUX voies : le **découpeur**, quand le livre est
(ré-)extrait ; **`recouper-source.mjs`**, quand le `.md` en service porte des réparations de contenu
qu'un rejeu de la sortie Marker écraserait (§ 7). D'où deux régimes de garde :

- **livre AVEC liste** : `raw:check-source-format` CONFRONTE le dossier à la liste — noms, ligne 1,
  titre d'ouverture (prédicat unique `scripts/raw/lib/titres.mjs`), index. Tout écart est un **rouge
  nommé, sans entrée de stock** : le geste tient en une commande.
- **livre SANS liste** : son grain n'est déclaré nulle part — UNE entrée de stock par dossier
  (famille `sans-decoupe`), qui sort le jour où sa liste s'écrit.

Le prédicat d'ouverture lit la ligne de titre en TROIS lectures — la ligne entière, les runs GRAS
joints, le reste hors gras — et compare des **suites de mots** translittérées : le mobilier de
gouttière (`# **POISONS** V`, `# • **CONSUMER GUIDE** •`) tombe sans jamais rogner un chiffre romain,
et `APPENDIX III` n'ouvre pas `APPENDIX I`. Ce qu'il ne voit **pas**, et c'est dit : un fichier sans
aucune ligne de titre n'a d'ouverture à juger que si sa liste lui en déclare une.

**Le MOBILIER DE PAGE, et son régime (#1739).** Le chiffre romain de l'onglet de chapitre et le folio
ne sont pas du texte du livre : l'extraction les MÊLE au flux (`III` seul sur sa ligne,
`# **POISONS** V`, `#### **Bounce** XII **Cold-blooded**`). Règle utilisateur du 2026-09-20,
verbatim : « Il est interdit de réécrire le texte. On peut réparer le texte s'il est tronqué/mélangé
car l'extraction n'est pas parfaite. » Le mobilier se RETIRE ; ne bouge que la FORME que son retrait
rend fausse (titre soudé, bandeau lu comme table), jamais un mot. Un prédicat, trois consommateurs :

- **Le prédicat** (`scripts/raw/lib/mobilier.mjs`). O, l'ensemble des chiffres d'onglet d'un fichier,
  se tire de la donnée `onglets` de sa liste de découpe : les chiffres dont l'étendue rencontre les
  pages `page..pageFin+1`. Il relève (a) une ligne réduite à un élément de O ; (b) une tête de ligne
  (après ses `#`) faite de 1 à 3 nombres, TOUS de `[page-1, pageFin+1]` — le folio seul, la paire
  d'une double page, dont le folio de gauche précède la 1re page du fichier —, seule (`folio-nu`) ou
  suivie de texte (`folio-tete`) ; (c) un élément de O comme mot isolé hors gras. Dans une table, les cellules
  d'en-tête d'une table de PROFIL (au moins 3 abréviations de Caractéristique de
  `src/data/characteristics.json`) sont exclues.
- **La sonde** : `node scripts/raw/sonde-mobilier.mjs <id>` rend les sites classés, en `NNN:ligne`,
  et dit lesquels une exemption couvre.
- **La réparation** : `node scripts/raw/reparer-mobilier.mjs <id>`, puis `--apply`. Une ligne réduite
  au mobilier est SUPPRIMÉE (`#` compris), avec l'une des deux lignes vides qui l'encadraient ; un
  jeton dans une ligne (onglet mot, folio de tête) est retiré, les blancs du seul point de coupe normalisés ; dans une cellule de table, il
  devient autant d'espaces, et les colonnes restent. Deux classes changent la forme :
  - un jeton entre deux runs gras d'une ligne de titre (titre SOUDÉ) scinde la ligne en DEUX
    titres, au niveau le plus porté par les titres frères du fichier ;
  - une table que le retrait laisse SANS DONNÉE (une seule cellule non vide, dans son en-tête :
    un bandeau lu comme table, `| EXAMPLE DIFFICULTIES OF COMMON SOCIAL ACTIONS | V |`) devient
    UNE ligne de titre au texte verbatim de cette cellule, au niveau le plus porté par les titres de
    LÉGENDE du fichier (un titre que suit une table ; à égalité, le moins profond).

  Elle REFUSE d'écrire si le multi-ensemble des mots d'un fichier perd autre chose que les
  jetons de ses sites, en gagne un, ou si une suppression collait deux lignes non vides. Ensuite, le
  recalage du § 7, étape 2 : `reanchor.mjs --remap` puis `--apply`, et `recouper-source.mjs <id>
  --suivre-diff`.
- **La garde** : la famille `mobilier` de `raw:check-source-format`, pour tout livre dont la liste porte
  des `onglets`. Un mot du livre qui tombe sous le prédicat (le pronom `I`, « Appendix I », une
  colonne Caractéristique) s'exempte AU SITE dans `scripts/guards/lib/mobilierExemptions.mjs` :
  `{ fichier, motif, jetons, raison }`, le motif tenant au TEXTE de la ligne, jamais à son numéro,
  `jetons` au NOMBRE de sites qu'elle couvre sur cette ligne : un chiffre d'onglet de plus y reste
  rouge, et une exemption qui couvre moins que ses `jetons` l'est aussi. Une exemption de plus se
  déclare par `CLIQUET:`.

**La garde et son stock.** `node scripts/raw/check-source-format.mjs` balaie les **dossiers FR
suivis** — les livres à `dir` de `src/data/books.json` plus les dossiers antérieurs au pipeline,
atteints par balayage des préfixes `Warhammer v4 - `, `WH - V4 - `, `WH4_FR_`, `Boite d'Initiation`,
`Warhammer - Habitants` — et compare ce qu'elle mesure au stock nominatif
`scripts/raw/source-format-stock.json` : une entrée par (famille, dossier, détail). Les deux sens
sont rouges — un écart hors du stock (rejouer la chaîne sur le livre, ou déclarer l'entrée au
message par `CLIQUET:`), une entrée sans écart mesuré (la chaîne a été rejouée : l'entrée se
retire). `--ecrire-stock` régénère le stock ; une entrée NEUVE y exige son lot, `--lot <#N …>`, sans
quoi rien n'est écrit (`ecrireStockSousLot`, `scripts/guards/lib/stock.mjs`), et les entrées
existantes gardent le leur. Comme la `ref` d'une entrée porte un **compte**
(« ×N »), **tout geste non canonique se voit** : corriger une occurrence sur N déplace la clé et
rougit la garde — c'est voulu. **Comment le stock décroît** : un livre repassé par la chaîne en sort
dans le train qui l'intègre — remplacement du dossier suivi, `node scripts/raw/reanchor.mjs --apply
--remap`, `node scripts/source/reparer-adresses.mjs --apply`, stocks régénérés, le tout dans le
MÊME commit. L'ordre de ré-extraction vit sur le ticket #1739. Le stock ne remonte jamais sans un
`CLIQUET:` porté au message.

## 1. Extraction Marker (PDF → markdown paginé)

Le PDF est gitignoré, donc présent dans l'arbre PRINCIPAL seulement : son nom se DÉCLARE au registre
(champ `pdf` de `src/data/books.json`, § 3) et son chemin ne se construit que par la couture `pdfDe`
(`scripts/raw/_lib.mjs`) — depuis le shell ou Python, par sa CLI `scripts/raw/pdf-de.mjs`, qui résout
aussi `Source/_marker/` et la COPIE DE TRAVAIL `Source/_marker/<id>.pdf` que Marker lit (MAX_PATH,
ci-dessus). Les sorties Marker se nomment par l'**id de livre** du registre (`<id>` de
`src/data/books.json`, jamais son sigle ni le nom de son PDF) : copie de travail
`Source/_marker/<id>.pdf`, sortie `Source/_marker/full/<id>/` (`copieMarkerDe`, `sortieMarkerDe`) ; un
lecteur de sortie LÈVE en listant les dossiers de `full/` qu'aucun id ne nomme.

L'extraction passe par `marker-pdf` (CPU), avec la couche texte exacte **désactivant l'OCR** —
plus fidèle que l'ancien pymupdf4llm sur les tables :

```bash
marker_single "$(node scripts/raw/pdf-de.mjs --copie-marker <id>)" --output_format markdown \
  --config_json scripts/raw/marker-paginate.json --disable_ocr \
  --output_dir "$(node scripts/raw/pdf-de.mjs --sortie-marker <id>)" --disable_image_extraction
```

Long (~45 min pour un livre dense) — lancer en arrière-plan. `--config_json marker-paginate.json`
active `paginate_output=true` : le markdown de sortie porte des séparateurs `{N}----` (N = page
PDF **0-indexée**).

**Piège connu** : Marker **gate par mise en page** — un livre
saturé d'illustrations en zones « figure » peut perdre une grosse part du texte en `--disable_ocr`
(vécu sur *Le Zoo Impérial* : -70 %, ré-extrait en OCR classique, seul livre du corpus dans ce cas).
Vérifier après coup que le `.md` produit fait une taille plausible (comparer au nombre de pages du
PDF) avant de découper ; si la perte est massive, relancer **sans** `--disable_ocr`.

Pour ré-extraire en lot, le driver `scripts/raw/reextract-all.sh <id>…` (bash) boucle la commande
ci-dessus + l'étape 2 sur les livres passés en argument, vers un **staging**
(`Source/_marker/split/<id>/`) sans jamais écraser `Source/` — la promotion reste une étape
manuelle après revue.

## 2. Découpe en fichiers `Source/<Livre>/NNN - Titre.md`

### La LISTE DE DÉCOUPE est de la DONNÉE — `scripts/raw/decoupes/<id du livre>.json`

Un fichier par livre, nommé par son **id stable** (`src/data/books.json`), lu par l'unique
`_lib.mjs#decoupeDe`. Une entrée par FICHIER à écrire, dans l'ordre du livre :

| clé | sens |
|---|---|
| `titre` | le TITRE du fichier (`NNN - <titre>.md`, passé par `nomAscii` à l'écriture) |
| `ouverture` | le TITRE IMPRIMÉ sur lequel le fichier ouvre — **absent** quand le fichier n'en porte aucun (couverture, feuille de personnage) |
| `page`, `pageFin` | la PLAGE de pages PDF 1-based du fichier, **lue au livre** — les outils la COPIENT, aucun ne la calcule ; deux voisins **partagent** une page quand la section suivante n'ouvre pas la sienne (`pageFin(i) = page(i+1)`), une page sans texte suit le fichier qui la précède |
| `chapitre` | le CHAPITRE du livre auquel le fichier appartient, tel que le sommaire l'imprime — **absent** des pièces hors chapitre (couverture, sommaire, crédits, index, feuille de personnage) |

**Où la liste se tire** : du **SOMMAIRE IMPRIMÉ** du livre, pas d'une mesure de polices — ouvertures
de chapitre et entrées de **premier rang** ; une entrée **en retrait** est une sous-section et
n'ouvre rien ; une **série de fiches** de même gabarit (les Carrières) reste **entière** dans le
fichier de la section qui l'introduit. Intégrité : `scripts/raw/decoupes.test.mjs` (le nom du
fichier est l'id d'un livre couvert, chaque entrée porte exactement son jeu de clés, les plages
PAVENT le livre — débuts croissants, aucun trou, au plus une page partagée —, les entrées d'un
chapitre sont contiguës et son titre n'ouvre que sa première, aucune entrée en double, chaque titre
survit à `nomAscii`, `onglets` est déclaré — chiffres romains valides, étendues dans le livre,
disjointes et ordonnées, chaque `chapitre` couvert par au moins une ; `gabaritOnglet` non nul si et
seulement si `onglets` l'est, et bien formé).

**Les ONGLETS DE CHAPITRE** — clé `onglets`, REQUISE au niveau du LIVRE, à côté de `book` :
`[{ chiffre, pages: [a, b] }]`, le chiffre romain imprimé en onglet et l'ÉTENDUE de pages PDF, de la
première à la dernière qui l'IMPRIMENT (une page paire en frontière de chapitre n'est rattachée à
aucun chiffre) ; `null` DÉCLARÉ pour un livre qui n'en imprime aucun. Son voisin `gabaritOnglet` =
`{ police, taille, bandeHaute }`, MESURÉ au PDF (police sans préfixe de sous-ensemble, corps en pt, pt
sous le haut de page que le HAUT de l'onglet ne dépasse pas), `null` avec `onglets` : un livre de plus reste UN fichier de
donnée. `onglets` se LIT au PDF, jamais à la main : `python scripts/raw/onglets.py <id>` l'écrit,
`--check` la relit sans rien écrire et rapporte les pages impaires sans onglet ; un livre sans
`gabaritOnglet` est refusé et nommé. La sonde passe par le **lecteur géométrique**
`scripts/raw/lib/pdf_geometrie.py` (pdfminer : caractères avec police, taille et bbox, aplats, spans,
folio imprimé — le même que `scripts/data/gen-progression-schemas.py`). Hors CI (pas de PDF) : la
donnée committée fait foi.

**Les TITRES D'ENTRÉE** — clé `gabaritTitre`, REQUISE à côté de `gabaritOnglet` : les typographies
`{ police, taille? }` MESURÉES au PDF que lit la sonde des titres — `titre` (celle qu'un run de tête
de ligne CONTIENT), `accompagnement` (celles qui peuvent la suivre dans ce run : « Climb (S) » + `basic`
en italique, sort à lore en gras italique), `encadre` (titre d'encadré ou de tableau), `capitales`
(nom de créature en petites capitales, toute taille), `intertitre` (titre du fil du texte d'un corps
plus petit, en tête de run : événements, niveaux de carrière) et `exclusions` (une ligne qui en porte une n'est
pas un titre : en-têtes de statbloc) ; `null` pour un livre non sondé. La sonde,
`node scripts/raw/sonde-titres.mjs <id> [--boites <boites.json>] [--json <sites.json>]`, lit le PDF
par `python scripts/raw/lib/pdf-lignes.py <id> <boites.json>` : l'analyse de mise en page de pdfminer
(paramètres de pdfminer à `all_texts=True` — ses défauts, plus le texte des figures où vivent les encadrés) rend
boîtes et lignes avec leurs spans typographiques ; `scripts/raw/lib/colonnes.mjs` ne fait qu'ORDONNER
ces boîtes (colonnes par grappes d'abscisses de boîte, pur et joué en CI sur des pages réelles
réduites, `scripts/raw/lib/fixtures/pages-crb/`). Chaque titre imprimé s'apparie à la ligne qui précède
la 1re ligne de SON corps dans le `.md` (d'un corps en tableau, la ligne qui précède l'EN-TÊTE de son
bloc ; une clé de corps à plusieurs candidats se départage par les clés suivantes que porte la
section de chacun) ; un titre imprimé sur deux lignes (même gabarit, même colonne,
interligne serré) est UN titre. Familles : entrée, encadré, tableau, capitales,
intertitre ; entrée et intertitre sont les familles d'ENTRÉE. Formes des entrées : S soudé, F fragment soudé à un corps étranger, M migré, S′ absent, B gras sans `#`, O hors
d'ordre (à poser `devant` le titre qui la suit au PDF), N niveau, `corps-introuvable` avec sa cause ;
des autres familles, S et F seuls, plus le S′ de capitales par COMPTAGE (imprimé sur les pages de son
fichier plus de fois que son `.md` ne le porte, une fois au moins ; restauré dans la forme de ses
frères du `.md`). La LÉGENDE d'un tableau (légende UNIQUE de son bloc — plusieurs titres sur un bloc
en sont les en-têtes de colonne) s'écrit en paragraphe `**X**` seul au-dessus de la table, jamais en
titre de section : `tablesOf` (`src/data/source/decoupe.ts`) la lit `TableParse.titre`, comme la
bannière. En ligne de titre `#` ou en bannière de la table, forme **L** (`ligneLegende` ; bannière :
en-tête suivant, ou VIDE quand la rangée suivante porte une phrase — trois mots au moins, ponctuation
finale) ; absente du `.md` (même comptage,
zéro fois au moins), `legende-absente`, posée `**X**` au-dessus de l'en-tête. Débris devant un corps à sa place, toutes familles : `doublon` — les folios sont
du mobilier de page, jamais un débris de titre. Toute cible est le DÉBUT d'un bloc Markdown (en tête
de fichier, après une ligne vide ou un titre ; une ligne de tableau se remonte à l'en-tête de son
bloc) ; sinon le site sort en `cible-invalide`. Les ancres `<span id="page-…">` ne comptent pas
(`stripSpans`). Les formes du TEXTE, chacune prouvée au PDF site par site (`formesDuTexte`) : **P**
paragraphe scindé (une ligne du `.md` que précède une prose coupée commence par la ligne du PDF qui
suit, dans la même colonne et sans retrait, la fin de cette prose ; pas de libellé `X:` en tête, 1er
mot qui ne tenait pas sur la ligne d'avant — bord droit de sa boîte, ou pour une boîte d'une ligne le
plus grand de son bloc (même colonne, même bord gauche) —, ou texte qui CONTINUE (`a` finit sur `,`,
`-` ou `/`, ou la suite s'ouvre en minuscule), typographie continue ; sans aucune de ces preuves, la
ligne est rapportée (`paragraphe-non-prouve`, avec son motif), comme le joint d'une césure (`cesure` :
le livre imprime `Xy`, jamais `X-y`) ; le site
nomme la ligne `avec` laquelle recoller, l'`etiquette` avant laquelle recouper s'il y en a une, sa
`preuve` ; une preuve ne sert qu'une ligne, une ligne à plusieurs preuves reste sans site), **D**
ligne déplacée (une ligne du `.md` commence par une ligne du PDF que la preuve de P fait suivre la fin
d'une AUTRE ligne de prose du fichier ; le folio imprimé de sa page, lu aux ancres, n'est pas le folio
roulant de la ligne — `parseChapitre` — mais celui de cette prose ; une seule paire, sinon pas de
site), **E**
libellé soudé (un `**X:**` au milieu d'une ligne du `.md` ouvre, avec la suite de la ligne, sa ligne au
PDF, alors que son 1er mot tenait sur la précédente — ou que le livre ne l'imprime jamais en milieu de
ligne, et l'y ouvre au moins `OUVERTURES_PROBANTES` fois ou suit une ligne qui CLÔT son élément (ni
`,`, ni `-`, ni `/` final ; sinon `libelle-non-prouve`, rapporté) : la ligne se coupe devant lui ; une ligne du PDF que deux libellés réclament n'en prouve aucun), **A** appel
de figure (nombre imprimé dans une pastille, `cercles` de `pdf-lignes.py`, mêlé en queue de ligne),
**G** gras italique perdu (run `BoldItalic` rendu `*x*` ; aucun site sur une ligne qui porte `x` sous
deux emphases, l'occurrence n'y est pas désignée), **T** tiret cadratin perdu (`X — Y` au PDF, dans la
ligne ou à sa jointure, `X Y` au `.md`), **J** joint mal fait (`X/ Y` au `.md`, là où une ligne du
PDF finit par `X/` et la suivante s'ouvre par `Y` ; pour `X- Y`, le livre doit imprimer `X-Y`
ailleurs). Une ligne du `.md` ne répond qu'aux lignes du PDF de SA plage de pages, bornée par
les titres à leur place qui l'encadrent. Sites en `NNN:ligne`, avec `titreMd` (le texte EXACT du titre dans le `.md`), la
page, la position au PDF et la ligne CIBLE ; pour tout titre à poser, `ligneTitre` (la ligne de titre
complète : texte du `.md`, ou texte imprimé pour un S′ ; niveau et gras du FRÈRE TYPOGRAPHIQUE
précédent — même gabarit, à sa place dans le MÊME fichier —, le suivant pour le premier du fichier ;
`frere` le nomme), et
pour un déplacement vers un autre fichier la vérification de sa découpe (`interFichiers`). Elle
n'écrit rien sous le dépôt (`--json` sous la racine est refusé) ; hors CI (pas de PDF).

**La RÉPARATION des titres** : `node scripts/raw/reparer-titres.mjs <id> [--sites <json> | --boites
<json>]`, puis `--apply`. Elle CONSOMME les sites de la sonde (le JSON `--json`, ou la sonde
rejouée) et n'en relève aucun : S détaché de la tête de sa ligne ; F et M retirés de la ligne
étrangère (la ligne part si rien ne reste) et posés devant leur corps ; B promu ; S′ inséré ; O,
l'entrée entière, posée devant le titre qui la suit au PDF ; le débris d'un doublon retiré. Le titre
posé est un bloc (une ligne vide avant et après, jamais deux). Elle retire les appels **A** de leur
ligne, rend `***x***` aux **G** et le `—` aux **T**, `X/Y` aux **J**, coupe les **E**, recolle chaque ligne **D** à sa prose `avec` (elle quitte sa place), puis chaque site **P** à
sa ligne `avec`, de la plus basse à la plus haute (un paragraphe en trois morceaux se recolle entier) :
l'emphase coupée refaite une (`**A** **B**`, `*A* *B*`), aucune espace après un trait d'union ou une
barre de fin de ligne (`Nimble-fingered`, `Read/Write`), la ligne repartant à son `etiquette` s'il y en a une. Elle REFUSE d'écrire si une
ligne ne porte plus ce que la sonde a vu (JSON périmé), si un S′ est déjà dans son fichier sous une
autre forme (même clé, ancre, `#` et emphase ôtés, autant de fois que ses pages l'impriment), si deux gestes tombent sur une ligne, ou si
le multi-ensemble des MOTS du LIVRE gagne autre chose que les mots des S′ ou perd autre chose que les
débris et les appels de figure. Rejouée sur un livre réparé, la sonde ne rend plus aucun site à réparer (N reste rapporté), et la réparation rien. Puis le
recalage du § 7, étape 2. **La garde** : la famille `titre-soude` de `raw:check-source-format`,
pour tout livre à `gabaritTitre`, sur TOUT le livre — P5 (`**X** Y…` : groupe hors étiquette
`X:`, hors repère `A)`, hors gras fini par `,` ou `;`, `Y` ni minuscule ni `:-–—(|=`) et titre à
deux groupes gras, prédicats de `scripts/raw/lib/titres-soudes.mjs`. La sonde PDF reste la porte de
S′, F, M, O, P, D, E, A, G, T et J, que le `.md` seul ne trahit pas sans bruit : une prose qui s'arrête sans
ponctuation devant une ligne neuve est aussi un item de liste ; une ligne n'a pas de page au `.md`, seul
le PDF dit sous quelle ancre elle s'imprime ; un libellé en milieu de ligne, un nombre
en queue de ligne, un `*x*`, un `X Y` ou un `X/ Y` sont du texte ordinaire hors de leur preuve au PDF.

**Le critère à tenir** : mettre le livre N+1 au grain de ses sections coûte **UN fichier de donnée,
zéro ligne de code**.

### Mettre un livre DÉJÀ SERVI au grain de ses sections — `recouper-source.mjs`

```bash
node scripts/raw/recouper-source.mjs <id du livre> [--dry] [--carte <fichier>]
node scripts/raw/recouper-source.mjs <id du livre> --suivre-diff [--dry]   # § 7 : édition EN PLACE, aucune re-coupe
```

Le FLUX est fait des `.md` **en service** du livre, dans l'ordre — **jamais** la sortie Marker, qui
ne porte pas les réparations de contenu faites au `.md` (§ 7). Il coupe à la LIGNE de chaque titre
d'ouverture par la primitive unique `lib/marker-pages.mjs#couperAuxTitres` (recherche **séquentielle**
— chaque titre après la coupe précédente, ce qui écarte les homonymes d'APRÈS ; un titre introuvable
est **nommé** et rien n'est écrit), **copie** l'en-tête `*Pages PDF X-Y*` de la plage que la liste
déclare (`page`, `pageFin` — aucun outil ne la calcule ; deux entrées voisines **partagent** au plus
une page), régénère `00 - Index.md`, émet la CARTE
ancien → nouveau (fichier + plage de lignes du flux) et **recale les stocks nominatifs keyés par
chemin** — chaque `preuve` suit son site avec sa date. Il **REFUSE d'écrire** tant que la
concaténation des corps n'est pas identique à l'octet avant / après (arbitrage utilisateur du
2026-09-20 : « Il est interdit de réécrire le texte »). Il est **idempotent** : rejoué sur un livre
déjà au grain, il n'écrit rien et sort 0.

Deux limites dites. (1) La recherche séquentielle n'écarte pas un homonyme situé **AVANT** la
section qu'il double : seul un flux PAGINÉ (sortie Marker) porte la fenêtre de page qui le ferait
tomber — la carte émise est ce qui se relit pour le vérifier. (2) Le recalage ne suit que les
entrées de stock keyées par **section** (`slug#occ :: …`) ; les autres sont **nommées** et se
régénèrent par le `--ecrire-stock` de leur propre garde, qui rétablit aussi l'ORDRE canonique du
fichier de stock.

**Après la re-découpe d'un livre DÉJÀ CITÉ** : une re-coupe déplace le `ch` et le `secOcc` de TOUTE
adresse `descRef` du livre. L'ordre sain est **grain d'abord, curation d'adresses ensuite** — la
séquence est celle du § 7 (`reanchor --apply --remap` AVANT de committer, `prose-resolution.test.ts`,
`scripts/source/reparer-adresses.mjs`), et les gardes le disent bruyamment si elle est sautée.

Les PORTES après la re-découpe, dans le même commit : `npm run -s test:raw`,
`raw:check-source-format`, `raw:check-source-tables`, `raw:check-source-puces`, `raw:check-renvois`,
`raw:check-folio-continuity`, `raw:check-refs`, `raw:check-code-refs`, `raw:coverage`,
`raw:reconcile`, `raw:check-catalogue-complete` — plus le recalage des références (§ 4,
`reanchor.mjs`) et des coordonnées citées hors `docs/raw/`.

### Découper un livre NEUF depuis la sortie Marker

Un découpeur coupe une sortie Marker **FRAÎCHE** et ne connaît rien des réparations de contenu
faites aux `.md` : le rejouer sur un livre EN SERVICE les écraserait. Le geste rejouable sur un livre
servi est `recouper-source.mjs` (ci-dessus). Selon que le livre a ou non une structure `Source/`
**préexistante** à réaligner :

- **Livre déjà présent sous `Source/`** (ré-extraction) : `marker-split.mjs <id du livre>
  "<marker-paginé.md>" "<dossier-sortie>"` — les anciens `.md` sont ceux du
  `dir` du livre ; son PDF (`pdfRequisDe`, registre SEUL : un livre sans `pdf` échoue) est la référence des vérifications de
  pages perdues (ci-dessous) ; le 2ᵉ argument accepte un `.md` d'un tenant **ou un
  dossier de tranches `--page_range`** (`slices/<a>-<b>/<pdf>/<pdf>.md`, union des tranches par la lib
  `scripts/raw/lib/marker-pages.mjs`, parseur `{N}----` UNIQUE du dépôt). Aligne les nouveaux chapitres sur les noms de fichiers
  et pages de début des anciens `.md` (marqueur `Pages PDF X` en tête de chaque ancien chapitre),
  frontière **titre-d'abord** (cherche l'en-tête markdown au/après la page de début), repli sur
  l'offset de page si le titre ne matche pas (gère les chapitres qui partagent une page — génère
  alors un stub `*(Page X partagée avec un chapitre voisin…)*`, à vérifier).
  **Nommage** : un titre d'ancien fichier qui est un nom de **signet Word** (`_gjdgxs`, `Sans titre`)
  ne se recopie pas — le fichier de sortie prend le **titre imprimé** (texte de l'en-tête Marker qui a
  matché, réduit par `nomAscii`) ; si aucun en-tête n'a matché pour ce chapitre, le script **échoue**
  en le nommant (jamais un `Sans titre` écrit sous `Source/`).
- **Livre neuf, sans structure à réaligner** : écrire un splitter dédié sur le patron de
  `scripts/raw/split-wfrp5.mjs` — il lit sa LISTE DE DÉCOUPE (ci-dessus) et coupe à la LIGNE du titre
  d'ouverture **dans la page déclarée** (`couperAuxTitres`), une page pouvant porter deux sections.
  Sortie : `Source/<Livre>/NNN - Titre.md` (en-tête `*Pages PDF X*` ou `*Pages PDF X-Y*`, plage
  **COPIÉE** de la liste ; séparateurs `{N}----` retirés) + `00 - Index.md` récapitulatif. `--dry`
  n'écrit rien et **rapporte les titres d'ouverture introuvables** dans la sortie Marker — un
  découpage réel les REFUSE, il ne devine aucune coupe.
  `scripts/raw/split-mdg.mjs` et `scripts/raw/split-vdm.mjs` sont deux découpeurs du même patron
  **dont la liste vit encore DANS le code** (`CHAPTERS`) : leur livre n'a pas encore de fichier de
  découpe, et la garde `raw:check-source-format` le NOMME (famille `sans-decoupe`).

**Pages perdues** — Marker gate PAR MISE EN PAGE : une page saturée de planches ou d'encadrés peut
sortir **vide** (son seul contenu est un saut de ligne) alors que la couche texte du PDF en porte
des milliers de caractères. Une page vide est INVISIBLE pour un simple inventaire des pages
absentes : les deux découpeurs la mesurent (`pagesPerdues` de `scripts/raw/lib/marker-pages.mjs` —
page vide ou absente chez Marker **et** plus de 200 caractères lus par pypdf) et **refusent de
découper** en imprimant, pour chaque page, la commande de **ré-extraction ciblée** à jouer
(`--disable_ocr --force_layout_block Text --page_range <k>` sur cette page seule, sortie dans
`restitutions/<k>/` à côté des tranches). Au run suivant, `restituerPages` fusionne ces restitutions
dans l'extraction de base — une restitution ne remplace QU'une page vide ou absente ; sur une page
déjà pleine, elle lève. Mesuré sur le *WFRP 5e Core Rulebook* : pages PDF 17, 19 et 126 (1806 / 1461 /
2070 caractères chez pypdf, `'\n'` chez Marker — la page entière classée `Figure` par la mise en page).
`--force_ocr` n'y change RIEN (même page vide) : c'est la mise en page qui gate, pas la couche texte ;
`--force_layout_block Text` la saute et rend le texte à plat (titres et paragraphes non séparés, à
recoller au PDF si la page est citée).

Les noms de dossier et de chapitre sont **ASCII** : les scripts de découpe écrivent par `nomAscii`
(`scripts/source/nom-ascii.mjs`, la seule translittération du dépôt) et la garde
`src/source-hygiene-guard.test.ts` refuse le reste — un caractère hors de sa table s'y déclare, il ne
s'absorbe pas en silence.

Après découpe : vérifier qu'aucun chapitre n'est un stub vide/mal replié (grep `Page .* partagée`),
puis committer le dossier `Source/<Livre>/` (le PDF et `Source/_marker/` restent gitignorés).

## 3. Enregistrement du livre dans le pipeline

Trois points d'enregistrement, dans cet ordre :

1. **`src/data/books.json`** (SOURCE UNIQUE des acronymes, #585) — l'entrée du livre porte
   `abbr: '<ABRÉV>'`, `dir: 'Source/<dossier du livre>'`, `pdf: '<nom du PDF officiel sous Source/>'`
   (lu par la couture `pdfDe` de `scripts/raw/_lib.mjs` ; aucun script ne construit ni ne code en dur
   un chemin de PDF de livre, garde `scripts/guards/lib/pdfHorsCouture.mjs`) et `language` : la langue DU LIVRE
   (`'VF'`, ou `'VO'` pour un livre VO autorisé) — un livre déjà présent en placeholder VO sans `dir` se
   COMPLÈTE, jamais un doublon. **Aucun script ne porte la LISTE des livres** : `BOOKS`
   (`scripts/raw/_lib.mjs`, source unique partagée par `coverage.mjs`/`reconcile.mjs`/`reanchor.mjs`)
   DÉRIVE de `books.json` — les entrées porteuses d'un `dir`, dans l'ORDRE DU FICHIER. (Les réglages
   PAR CHAPITRE, eux, vivent au registre d'outillage `scripts/raw/chapitres.json`, § 3.) L'entrée s'insère au RAYON qui lui revient, jamais
   forcément en fin de fichier : aucun artefact commité ne suit l'ordre du registre — les stocks
   nominatifs se rendent en ordre canonique de clé (#1825). Cet ordre décide en revanche de
   l'affichage : les rapports de l'Atlas suivent `BOOKS` (section par livre de `docs/raw/coverage.md`,
   puces des champs `**Implémente :**`), et au Compendium la catégorie « Livres »
   (`src/ui/compendium/registry.ts`, `books.map` non trié) est REGROUPÉE par `folder`
   (`CompendiumScreen.tsx`) : les rayons sortent dans l'ordre de leur PREMIÈRE apparition au fichier,
   et les livres dans l'ordre du fichier à l'intérieur d'un rayon. (Édition de `books.json` :
   round-trip octet-fidèle exigé par `src/data/serialize.test.ts`.)

   **Livre de CŒUR (`coeur`)** — champ OPTIONNEL de la même entrée, la valeur nommant le corps de
   règles dont ce livre est le livre de base (`"4e"`, `"5e"` ; graphie normalisée : minuscules, sans
   espace de bord — deux livres ne portent jamais deux graphies d'un même cœur). Un supplément ne le
   porte PAS. Le déclarer entraîne, sans une ligne de code (`coeurDe`, `scripts/raw/_lib.mjs`) :
   - **R0** — le cœur est un DOSSIER de l'Atlas : ses fiches, ses catalogues et ses pages d'auteur
     vivent sous `docs/raw/<coeur>/`, et le nom du dossier EST la valeur du champ. Un cœur déclaré
     sans dossier est DIT au routeur `docs/raw/00-index.md` (bloc généré, « dossier à créer ») ; une
     page de règles posée à la RACINE de l'Atlas, ou un sous-dossier qui n'est pas un cœur du
     registre, fait LEVER la couture d'énumération (`pagesDeLAtlas`) — donc toutes les gardes `raw:*` ;
   - **R1** — le Sens A du livre passe à tolérance ZÉRO : un chapitre que le code cite et qu'aucune
     fiche ni aucun catalogue de l'Atlas ne porte se CORRIGE à l'Atlas, il ne se stocke PAS dans
     `scripts/raw/reconciliation-stock.json` (CLAUDE.md règle 1) ; `raw:reconcile` refuse le trou
     comme l'entrée de stock ;
   - **R2** — le Sens B2 est calculé pour lui : les chapitres que l'Atlas décrit et qu'aucune réf de
     code ni aucune source folio de `src/data` n'atteint deviennent des trous `B2 <ABRÉV> <ch>`,
     stockables avec une dette instruite. La section B2 du rapport est rendue pour TOUT livre de
     cœur, « _Aucun._ » compris.

   Le résumé de tête de `docs/raw/coverage.md` se ventile par GROUPE (une ligne par valeur de
   `coeur`, une pour les livres sans cœur déclaré) : deux corps de règles ne s'additionnent jamais.

   **INVARIANT (#1825)** — *le code ne nomme aucun livre : un livre de plus, c'est de la DONNÉE.* Ce
   qu'on sait du LIVRE vit dans son entrée de `src/data/books.json` ; ce qu'on sait de ses CHAPITRES
   vit dans `scripts/raw/chapitres.json` (§ 3) — zéro ligne de code dans les deux cas. La séparation
   n'est pas cosmétique : `books.json` est la donnée de JEU, éditable au Compendium et servie au
   joueur ; `chapitres.json` est de l'OUTILLAGE, qui ne sert qu'à la chaîne Atlas.

   **Les deux PROPRIÉTÉS d'Atlas du LIVRE** — champs OPTIONNELS de la même entrée, éditables au
   Compendium, lus par des accesseurs de `scripts/raw/_lib.mjs` :
   - **`teneur`** (`"scenario"` · `"mixte"`, liste à l'atelier) — ce que contiennent les chapitres du
     livre NON couverts par une fiche. `scenario` = campagne pure : une section vide y est du bruit.
     `mixte` = scenario ET règles : une section vide peut y cacher une règle. ABSENTE = livre de
     règles. C'est elle qui décide le `➖ hors-règle` de tout chapitre non crédité et la ventilation
     section-granulaire du résumé. À ne pas confondre avec `folder`, qui est le RAYON de
     bibliothèque (rangement au Compendium), jamais la teneur.
   - **`niveauDeSection`** (entier 2–6) — le niveau de heading qui porte les SUJETS du livre, pour la
     mesure section-granulaire. ABSENT = 2. À mesurer sur l'histogramme réel H2/H3/H4 du livre (#604)
     plutôt qu'à deviner : un argmax brut se fait piéger par les listes profondément imbriquées.

   **Fiches extraites AVANT l'implémentation — la dette se déclare UNE fois.** Une fiche neuve dont
   aucun topic n'est encore codé rendrait autant d'orphelins que de topics (`raw:implemente`) et
   autant de trous `B2` que de chapitres. Les deux se déclarent par UNE ligne de
   `src/data/raw.manifest.json` : une entrée dont l'`id` est le STEM de la fiche (`magie`, pas
   `magie#seconde-vue`), avec le `ticket` de la phase qui portera l'implémentation — `ticket` est
   OBLIGATOIRE sur une entrée de fiche, `bloque` seul est refusé. Elle couvre tout topic de la fiche
   qui n'a pas d'entrée propre (la plus spécifique l'emporte), et `raw:reconcile` CRÉDITE les
   chapitres de cœur dont toutes les fiches qui les décrivent sont ainsi déclarées : aucune entrée
   `B2 <ABRÉV> <ch>` à écrire au stock. L'entrée vit aussi longtemps que son ticket
   (`scripts/hooks/solde-ticket-guard.mjs`, `evaluateRegistresPorteurs`, qui boucle sur les registres
   PORTEURS de ticket listés par `scripts/hooks/registres-porteurs.json`) : à la fermeture elle part,
   et tout topic encore non implémenté redevient orphelin, à ticketer nommément.
2. **`docs/raw/sources.md`** — la page des sources est TRANSVERSE : elle vit à la racine de l'Atlas et
   porte les livres de TOUS les cœurs, quel que soit le cœur du livre ajouté (ou son absence de cœur).
   Y ajouter une ligne à la table *Les N livres* (abrév, titre, dossier,
   rôle en une phrase) et incrémenter le compte en tête de fichier (« Le **RAW** du projet = ces
   **N livres** »). Si le livre a des chapitres purement narratifs/de cadre (gazetteer), documenter
   le partage règles/cadre ici ou dans `CLAUDE.md`.
3. **`CLAUDE.md`** (§ *Sources VF*) — ajouter l'entrée abrév + dossier + **périmètre par passage** dans
   la liste **RÈGLES & STATS** de `docs/sources-vf.md` (arbitrage 2026-07-10 : tout livre FR peut fournir
   des règles ; un livre dont aucune règle n'est extraite reste simplement listé parmi les volumes
   scénario, comme Ubersreik). La curation est toujours *à la main* (voir § 5) ; préciser le tag
   `source.book` attendu dans `src/data/*.json`.

**Aucun compte de livres ni de chapitres ne s'écrit à la main dans l'Atlas** : un nombre recopié ment
dès le commit suivant, les comptes courants vivent dans les rapports GÉNÉRÉS (`coverage.md`,
`reconciliation.md`, `reanchor.md`). La garde `node scripts/raw/check-atlas-counts.mjs` (chaînée dans
`npm run docs:check`) refuse `N livres`, `N chapitres` et tout compte d'état `✅/🟡/⬜/❌ N` dans
**toutes les pages manuscrites de `docs/raw/`** ET dans `scripts/raw/assemble-domain.mjs`, qui écrit
leur en-tête. En sont hors : les rapports générés, les catalogues (verbatim de `Source/`) et les
épreuves datées. Rien à vérifier à la main à l'ajout d'un livre.

### Le registre de CHAPITRES — `scripts/raw/chapitres.json`

Ce qu'on sait des CHAPITRES d'un livre y vit, en DEUX listes d'objets qui désignent leur livre par son
**`id` STABLE** (jamais son sigle : le sigle est de l'affichage). Rien à éditer dans un script.

- **`horsRegle`** — `{ book, ch, motif }` par chapitre exclu du dénominateur de couverture. À remplir
  quand le livre a des chapitres de **cadre pur** (gazetteer, sans règle), pour qu'ils en sortent au
  lieu de compter comme des trous. Conservateur : n'y taguer que le clairement-non-règle, pour ne
  jamais masquer un vrai trou ; le front-matter (index/intro/préface) est déjà écarté par son TITRE.
  Si le livre ENTIER est une campagne ou un compagnon, c'est sa `teneur` qu'il faut renseigner (§ 1),
  pas ses chapitres un à un.
  ⚠ Un motif est NOTRE prose éditoriale : il renvoie au CHAPITRE (« ch.8 »), **jamais** à une réf
  citable `<ABRÉV> NN l.X` — ce serait une citation que RIEN ne vérifie : aucun scanner de réfs ne
  lit ce fichier (`reconcile.mjs` et `check-code-refs.mjs` scannent `src/**`, `check-refs.mjs` les
  `.md` de `docs/raw/`), elle pourrirait donc en silence au premier réancrage.
- **`enCatalogue`** — `{ book, ch, catalogue, from?, to?, title? }` par chapitre de DONNÉES que
  l'Atlas transcrit verbatim (§ 4), **une entrée par chapitre ET par catalogue** : un chapitre qui
  alimente deux catalogues porte deux entrées. `from`/`to`/`title` n'y servent qu'à n'en transcrire
  qu'une PLAGE de sous-section, pour un chapitre trop large pour le catalogue.

L'ORDRE des entrées est celui du registre des livres, puis du numéro de chapitre — c'est aussi
l'ordre des blocs dans les catalogues produits (rien n'est retrié à la lecture).

**Intégrité** — `scripts/raw/chapitres.test.mjs` (`npm run test:raw`) refuse un `book` qui n'est pas
l'id d'un livre couvert par l'Atlas, un `ch` qui ne résout aucun fichier sous son `dir`, un motif
vide ou porteur d'une réf citable, un `catalogue` que `build-catalogs.mjs` ne produit pas, un
doublon, un ordre de fichier qui dérive, et toute CLÉ hors du jeu admis — `from` mal orthographié
ferait transcrire le chapitre ENTIER sans un mot, et `to`/`title` sans `from` n'ouvrent aucune
plage. Ces contrôles ne peuvent pas vivre au schéma : zod ne voit ni `Source/` ni le registre des
livres.

## 4. Intégration à l'Atlas RAW (`docs/raw/`)

L'Atlas (cf. `docs/raw/00-index.md`) consolide les règles **par domaine**, pas par livre — un
nouveau livre vient enrichir les fiches de domaine existantes (`combat.md`, `magie.md`, …) ou en
créer une nouvelle si le livre introduit un domaine inédit (le combat naval de MDG a justifié
`docs/raw/4e/combat-naval.md`). Un domaine inédit est UNE entrée de `scripts/raw/domaines.json`
(`{ cle, titre }` sous son cœur) : la fiche porte le nom de la `cle`, le bloc `Domaines` de
`docs/raw/<coeur>/00-index.md` en est GÉNÉRÉ, et `scripts/raw/domaines.test.mjs` refuse une fiche
sans domaine comme un domaine ni extrait ni dû.

Une aire **cadrée dont la fiche reste à extraire** se déclare avec les autres : son entrée porte en
plus `"ticket": "#N"` — la dette d'EXTRACTION, due par le chantier qui extrait (même graphie que le
`ticket` de `src/data/raw.manifest.json`, qui porte, lui, la dette d'IMPLÉMENTATION d'une fiche déjà
écrite). L'index du cœur la rend alors SANS lien, avec son ticket : lier une fiche absente serait un
lien mort. La marque se RETIRE dans le commit qui publie la fiche — une entrée qui a sa fiche ET un
`ticket` est refusée, comme une entrée sans fiche ni `ticket`. Tant qu'une aire porte `#N`, le
pre-commit REFUSE de fermer `#N` (même garde que pour le manifeste : `registres-porteurs.json`).

Un `titre` d'aire ne porte **aucun `#`** : le hook de fermeture scanne les registres porteurs à la
recherche de `#N`, et y lirait un ticket que ce registre ne doit rien (`scripts/raw/domaines.test.mjs`).

**Un CŒUR de règles de plus** (un livre qui ouvre un corps de règles, pas un supplément) se pose dans
cet ordre, et l'ordre compte : l'entrée `coeur` de `src/data/books.json`, puis **ensemble** le
dossier `docs/raw/<coeur>/` avec son `00-index.md` manuscrit ET l'entrée `"<coeur>": [ … ]` de
`scripts/raw/domaines.json` — la carte du cœur naît **ENTIÈRE**, toutes ses aires à `ticket`, AVANT
sa première extraction : c'est elle qui borne chaque domaine contre les autres (`cadragePrompt`), et
un premier run contre une carte à une entrée sur-absorberait ses voisines. Cet index manuscrit DOIT
porter la paire de marqueurs
`<!-- ATLAS-DOMAINES:DEBUT -->` / `<!-- ATLAS-DOMAINES:FIN -->` — c'est entre eux que
`node scripts/raw/build-atlas-index.mjs` écrit la table des domaines, et il REFUSE (une ligne, exit 1)
un index sans la paire, comme un cœur déclaré sans un seul domaine : un cœur sans domaine serait un
survol silencieux.

La chaîne, dans l'ordre — **périmètre → workflow → assemble → apply → gardes** :

1. **Périmètre** — `node scripts/raw/workflow-args.mjs <coeur> --avec-supplements|--coeur-seul --domaines a,b`
   imprime le JSON `{ coeur, supplements, domaines: [{ cle, titre }], lot: [cle], livres: [{ ab, dir, coeur, language }] }`,
   projeté des registres `src/data/books.json` et `scripts/raw/domaines.json`. Le drapeau de
   suppléments est EXIGÉ : le registre dit l'appartenance d'un livre à un cœur, il ne dit RIEN de la
   compatibilité d'un supplément avec ce cœur — c'est l'appelant qui déclare, et le résultat porte
   son choix. `--domaines` l'est aussi : il porte le LOT que CE run traite (une ou plusieurs `cle` du
   cœur, séparées par des virgules) ; sans lui, ou sur une clé inconnue, la commande LÈVE en nommant
   les domaines déclarés pour ce cœur. `domaines` est la CARTE complète du cœur (`cle`, `titre`),
   que le workflow emploie pour tenir chaque domaine dans son périmètre au cadrage.
2. **Workflow multi-agents** — `scripts/raw/atlas-domain.workflow.js` (opt-in « ultracode », cf. skill
   `orchestrer-des-agents`) : un agent par domaine touché fait `extract → verify` adversarial — la
   vérification reconfronte chaque réf/citation à la source, indispensable (des fabrications de
   contenu ont été trouvées et corrigées lors de l'épreuve du 2026-06-22,
   `docs/raw/4e/epreuve-2026-06-22.md`). Le script n'a pas d'accès filesystem ni d'`import` : c'est un
   corps d'`AsyncFunction` que le lanceur enveloppe, et le JSON de l'étape 1 lui arrive par le global
   **`args`** (champ `args` du lanceur de workflows, collé tel quel). Il ne nomme **aucun livre** —
   rien à y éditer quand un livre s'ajoute. Langue des prompts : la **synthèse** d'une fiche est en
   français, les **citations, termes et abréviations de jeu** restent verbatim dans la langue du livre
   cité (champ `language`), jamais traduits. Il ne nomme **aucun domaine** non plus : la carte et le
   lot lui arrivent par le même `args`.
   Tous ses agents sont en **LECTURE SEULE** (type d'agent sans outil d'écriture, posé au point
   unique `lire()`, et clause dans chaque prompt) : un passage de source tronqué ou fusionné se
   SIGNALE (`sourceAbimee: [{ phase, ref, constat }]`, remonté au rendu du domaine) et ne se répare
   jamais — un agent qui corrige la source qu'il cite ensuite fabrique sa propre preuve. APRÈS un
   run, `git status --porcelain` du worktree doit donc être IDENTIQUE à ce qu'il était AVANT : toute
   écriture apparue rend le rendu suspect (une preuve a pu être fabriquée) et se remonte au ticket.
   Il rend `{ coeur, supplements, domains: […], sautes: [{ domain, raison }] }` —
   `sautes` nomme les domaines qu'il n'a PAS traités (cadrage, inventaire ou taxonomie vides), et
   `assemble-domain` refuse un rendu qui en porte : une fiche absente ne doit pas pouvoir se lire
   « pas encore faite ».
3. **Assemblage de la fiche** — `node scripts/raw/assemble-domain.mjs <output.json> [Titre]` écrit
   `docs/raw/<coeur>/<domaine>.md` depuis ce JSON : le CHEMIN dit le cœur, et c'est la seule chose
   qui le dise. Il LÈVE si le rendu ne porte pas son `coeur`, et NOMME ce cœur dans l'en-tête. Il
   REFUSE aussi un rendu dont un topic n'est pas PROUVÉ fidèle — `faithful:false` (refus tenu après
   la passe de correction) comme `faithful:null` (aucun verdict rendu) —, en nommant chaque topic et
   ses `issues`. Son refus ressemble à :

   ```
   assemble-domain: le domaine « tests » porte 2 topic(s) dont la fidelite n'est pas prouvee — une
   fiche ne publie que du texte confronte a la source :
   - degres-de-reussite : fidelite REFUSEE — la table est reduite a ses bornes
   - fortune-et-destin : JAMAIS verifie
   Corriger le RENDU (relancer la verification/correction de fidelite sur ces topics), puis rejouer
   l assemblage.
   ```

   La sortie est de corriger le RENDU, jamais un drapeau de contournement : on REJOUE la
   vérification sur ces topics-là, **sans rejouer le run**, par le mode de REPRISE du workflow —
   `node scripts/raw/workflow-args.mjs <coeur> --coeur-seul --domaines <domaine> --reprise
   <rendu.json>` rend les `args` d'un run qui ne joue que Vérif → correction de fidélité →
   re-vérif sur les topics non prouvés fidèles, et rend le MÊME rendu complété. `<rendu.json>` est
   le JSON du run précédent, **tel qu'il sort** : le rendu du lot (`{ coeur, …, domains: […] }`), ce
   que le lanceur en a emballé (`{ result: { … } }`), ou un domaine nu — rien à redécouper à la
   main ; c'est `--domaines` qui nomme le domaine à reprendre. Un topic déjà jugé `faithful:false`
   garde ses `issues` si la re-vérification reste muette : un verdict ne s'efface pas.
4. **Apply déterministe** (enrichir des fiches DÉJÀ écrites, au lieu d'en assembler une) —
   `node scripts/raw/apply-livre.mjs <ABRÉV> <workflow-output.json>` insère topics + sommaire dans
   les fiches de domaine, **idempotent** via un sentinel `<!-- <ABRÉV>-INTEGRATION -->` (sigle en
   argument, libellé lu au registre ; le motif du marqueur est dérivé du registre dans `_lib.mjs`,
   donc un sigle à espace ou à point reste préservé par `build-catalogs.mjs`).
5. **Gardes** — `npm run raw:coverage`, `raw:reconcile` (dont le refus d'une fiche qui cite le livre
   de cœur d'un AUTRE cœur que celui de son dossier),
   `raw:implemente`, `raw:check-refs`, `node scripts/raw/check-atlas-counts.mjs`.

- **Catalogues de données verbatim** (`docs/raw/<coeur>/catalogue-*.md`) : régénérés par
  `node scripts/raw/build-catalogs.mjs`, qui concatène **verbatim** les chapitres de données des
  livres. Rien à éditer dans le script : ajouter une entrée `{ book, ch, catalogue }` à la liste
  **`enCatalogue`** de `scripts/raw/chapitres.json` (§ 3), le `catalogue` étant `creatures`, `sorts`,
  `divin`, `equipement`, `carrieres` ou `divers`. Seuls le fichier, le titre et la fiche de règles
  d'un catalogue vivent dans le script — jamais une liste de livres. Un chapitre cité par un catalogue est crédité
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
  source) ; `--remap` (réservé aux réfs de *synthèse*, sans citation attachée, et aux
  continuations nues `l.N` qui suivent une réf `<ABRÉV> NN l.X` sur leur ligne ou dans leur cellule)
  les porte par la carte de lignes EXACTE du diff `git diff -U0` (`scripts/raw/lib/carte-lignes.mjs`) :
  dans un hunk, une nouvelle ligne s'apparie à l'ancienne qui lui est égale après `normalize`,
  sinon dont elle est l'amputée (mêmes jetons, moins certains, dont un d'au moins trois lettres) —
  rang à rang si le hunk garde son nombre de lignes et que chaque paire correspond, sinon à
  condition que l'appariement soit unique et garde l'ordre des lignes ; une ancienne ligne non appariée est
  supprimée si toutes les nouvelles sont appariées. Une réf vers une ligne supprimée ou non appariable
  est RAPPORTÉE (sortie en échec), jamais réécrite : après une ré-extraction COMPLÈTE, la plupart des
  réfs de synthèse sortent donc rapportées, à reprendre à la main, au lieu d'être devinées. Il ne doit être lancé
  **qu'avant de committer** une nouvelle extraction de la Source — une fois committée, `git HEAD`
  == l'arbre de travail et la carte devient un no-op. Ne jamais lancer `--remap` sur une Source déjà
  committée : il recalerait aussi les réfs des autres livres via le diff `git HEAD`↔arbre.
- `coverage.mjs` doit sortir le nouveau livre à `⬜ 0` (tout chapitre-règle couvert par une fiche
  **ou** déclaré par la `teneur` du livre / la liste `horsRegle` du registre de chapitres) avant de considérer
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

**Frontière avec le §0** : ce geste manuel ne vaut que pour un défaut de **CONTENU** — ce que la
bonne chaîne, rejouée, produirait de la même façon. Un défaut de **FORMAT** (l'une des sept familles
de `scripts/raw/check-source-format.mjs`) ne se corrige JAMAIS à la main : on rejoue la chaîne
canonique sur le livre entier (§0). Corriger une seule occurrence d'une famille déplace la clé du
stock et rougit la garde — c'est ainsi qu'un geste non canonique se voit.

1. **Éditer** `Source/<livre>/NN - X.md`, la page PDF ouverte à côté — verbatim, y compris les
   coquilles du livre. Les marqueurs `<span … data-folio="N">` sont l'ancrage de page : on les
   déplace avec leur texte, on n'en invente pas.
2. `node scripts/raw/reanchor.mjs --apply --remap` — **avant** de committer la Source. La clause de
   `--remap` est écrite plus haut (§6, « Ne jamais lancer `--remap` sur une Source déjà committée ») :
   la carte de recalage se lit du diff `git HEAD`↔arbre, elle n'existe donc que tant que la
   correction n'est pas commitée. Les stocks keyés par section (`slug#occ :: …`) suivent la MÊME
   carte : `node scripts/raw/recouper-source.mjs <id du livre> --suivre-diff --dry`, puis sans
   `--dry` — un titre réécrit emmène sa clé, un titre DÉPLACÉ (sa ligne ôtée, son slug sur une seule
   ligne de titre neuve) la sienne ; une entrée keyée sur une section qu'un titre NEUF scinde, ou sur
   un titre supprimé, scindé ou d'appariement incertain, ou une entrée sans section porteuse, est
   RAPPORTÉE et BLOQUE l'écriture (sortie en échec) jusqu'à son tri à la main. Un titre rapporté
   qu'aucune entrée ne keye est listé « aucun stock keyé » et ne bloque pas.
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
5. `node scripts/raw/anchor-fill.mjs <ABBR> --ch NN --apply` s'il reste des blocs sans folio (PDF du
   registre SEUL, lu par pdfminer : `lib/pdf-lignes.py` puis `lib/colonnes.mjs`) : il pose des ancres
   `data-folio` **ciblées**, et saute tout candidat absent, multiple ou hors bornes. Aucune ligne ne
   bouge, aucun mot ne change ; l'ancre se pose APRÈS la marque de bloc de sa ligne (`# `, `> `,
   puce), en tête du texte qu'elle ouvre :
   - les pages d'un fichier se consomment dans l'ordre : la tête d'une page est la 1re ligne de contenu
     après la fin du texte de la page précédente ancrée, si elle s'ouvre sur les 1res lignes de la page
     au PDF ; sinon, la plus petite ligne trouvée par ses ordres de lecture (colonnes, titres remontés,
     rangées de table) ;
   - une ancre nue Marker `<span id="page-K-0"></span>` est **complétée** de son `data-folio`, en place
     (jamais un second `id` identique) ;
   - la 1re page de la plage `*Pages PDF a-b*` s'ancre en tête de la 1re ligne de contenu : un chapitre
     qui s'ouvre en milieu de page porte ainsi le MÊME folio que celui qui la commence ;
   - une page sans texte (planche, intercalaire) reçoit une ancre VIDE juste avant l'ancre de la page à
     texte qui la suit dans le fichier, à défaut en fin de sa dernière ligne de contenu —
     `check-folio-continuity` la trie ensuite bénigne (`empty-folios-benignes-stock.json`).
   Le banc des têtes de page réelles, étiquetées au PDF, est `scripts/raw/lib/fixtures/tetes-de-page.json`.
6. `npm run gates && git commit` — tout dans le même commit.

### Défaut de table → geste

Les tables sont là où Marker casse le plus, et une table cassée est une table **inadressable** (une
`descRef` de cellule vise une ligne par sa CLÉ et une colonne par son EN-TÊTE). L'inventaire est
MESURÉ et cliqueté : `node scripts/raw/check-source-tables.mjs` — une entrée par site dans
`scripts/raw/source-tables-stock.json`, un site hors stock comme une entrée sans site sont rouges.
Le fichier de stock est l'**INVENTAIRE** des sites mesurés ; la **dette** est le compte `à trier`
(entrées sans `preuve`), qui décroît vers zéro. Deux gestes soldent donc un site : **corriger** le
`.md` (le site disparaît, on retire son entrée), ou **prouver au PDF** que la forme est celle du livre
(`"preuve": "PDF p.N : …"` + `"date"` sur l'entrée, qui RESTE — le site existe toujours, il est
jugé). Une `preuve` vide, ou posée sur un site qui n'est plus mesuré, est rouge.

| Défaut (famille du détecteur) | À quoi ça ressemble | Geste au `.md` |
|---|---|---|
| `br-litteral` | `\| Gagnez 3 États<br>Assourdi \|` | **RIEN par réflexe** : la lib absorbe la FORME (adressage `sansBr`, rendu de cellule `brEnSaut` → saut de ligne), le site n'est plus inadressable. Son SENS se **lit au PDF, site par site** : une simple **césure** typographique se recolle en espace dans `Source/` ; une **liste d'items** réellement imprimée en colonne se garde telle quelle et se solde par une `preuve` (« PDF p.N : … ») + `date` sur son entrée de stock |
| marqueur de folio collé à une ligne de table — **PAS un défaut** | `<span … data-folio="7"></span>\| Lancer \| …` | **RIEN** : `toBlocks` retire les `<span>` AVANT `parseTable`, la table se lit entièrement (25 lignes sur 25 mesurées le 2026-09-14). L'ancre **reste où la page coupe** — la déplacer réécrirait `Source/` pour un défaut déjà absorbé |
| `donnee-en-tete` | une table dont les « en-têtes » sont `\| 81-85 \| Bouche explosée \|` | c'est la **continuation** de la table précédente coupée par un saut de page : **fusionner** les deux blocs sous les en-têtes réels |
| `cle-de-ligne-ambigue` | deux tables d'une même section partagent la clé `01-10`, et leurs TITRES ne les séparent pas | restituer les **titres IMPRIMÉS** qui séparent les tables au livre : heading de section, ou légende `**X**` de la table (la cellule s'adresse alors dans SA table, `FragmentCellule.table`) — jamais inventer un titre |
| `table-avalee-par-titre` | `## **BAILIFF ADVANCE SCHEME WS BS S T I Ag Dex Int WP Fel** h h h` — bandeau (gras ou nu), rangée de labels et valeurs à plat sur la ligne du titre | **restituer la table telle qu'imprimée**, à l'IMAGE de la page : bandeau → légende `**X**`, rangée de labels → en-têtes, valeurs → rangées. Une cellule **fusionnée** (pas de rowspan en GFM) voit sa valeur **répétée** sur chaque rangée qu'elle couvre — c'est de la FORME. Les paragraphes qui suivent le titre et portent la fin de la table (rangées orphelines) rentrent dans la table |
| catégorie en mauvaise colonne | `ARMES D'HAST` en 5ᵉ colonne | la ramener en **colonne 1**, comme le bandeau intérieur du PDF — la table reste **UNE et entière**, jamais découpée en headings |
| bandeau de titre en MAJUSCULES | `\| \| TABLEAU DES MOUVEMENTS \| \|` devant les en-têtes | **RIEN** : le parseur l'absorbe (`parseTable` → `titre`), les en-têtes réels remontent tout seuls |
| `banniere-suspecte`, bandeau **non majuscule** ou d'**une seule lettre** | `\| Effet \| \|` (en-tête réel d'une table à UNE colonne), `\| A \| \|` (séparateur d'index), `\| \| \| 159 \|` (folio capté) | **trier au PDF, un par un** : en-tête réel → on n'y touche pas ; folio capté ou séparateur d'index → se retire ou se sort de la table. Jamais d'élargissement de la garde, qui sauterait un en-tête réel |
| `banniere-suspecte`, bandeau **MAJUSCULE sans rangée de donnée** (titres de statbloc PNJ et leurs rubriques) | `\| \| ISABELLA — PROPHÈTE (BRONZE 4) \| \| \|`, `\| COMPÉTENCES DE BASE \| \| \|` | si le livre imprime ce libellé comme un **TITRE** au-dessus du bloc, il devient un **heading `####` tel qu'imprimé**, au-dessus de la table — jamais un titre inventé. Le corpus le prouve pour une partie d'entre eux : `ZI 14 - Expéditions prévues.md:66` porte déjà `#### COMPÉTENCES DE BASE` là où `:234` rend le même libellé en rangée (14 des 63 bandeaux à ≤ 2 rangées sont dans ce cas, mesuré). Pour les autres (`ISABELLA — PROPHÈTE…`, jamais heading ailleurs) : **trier au PDF** |
| `banniere-suspecte`, bandeau **MAJUSCULE devant une table SANS en-têtes** | `46 - Les règles magiques.md:34-36` : `TABLEAU DES INCANTATIONS IMPARFAITES MINEURES` puis directement `\| 01-05 \| Signe de Sorcière… \|` | **restituer la rangée d'en-têtes telle qu'imprimée au PDF**, entre le bandeau et la première donnée. Le parseur REFUSE d'absorber ce bandeau (`estCleDePlage(headers[0])`) : l'absorber promouvrait la fourchette `01-05` en en-tête et ferait perdre une rangée à la table |

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
- `npx vitest run src/data/no-html-in-prose.test.ts` — aucune description collée en HTML. Son prédicat
  `HTML_TAG` vit dans `src/data/source/normalize.ts` et sert AUSSI au volet E de
  `src/data/prose-resolution.test.ts` : la prose **adressée** ne rend pas plus de HTML que la prose
  copiée — un `<br>` resté dans une cellule du `Source/` ne peut donc pas atteindre le joueur.
- `node scripts/raw/check-source-tables.mjs` — tables cassées du `Source/` (cinq familles, stock
  nominatif décroissant `scripts/raw/source-tables-stock.json`) ; le geste est le tableau
  « défaut de table → geste » du §7. `--ecrire-stock` régénère le stock après une correction.
- `node scripts/raw/check-source-puces.mjs` — la PUCE imprimée que l'extraction a rendue par le CODE
  de son glyphe d'ornement (Core Rulebook 5e : le `0` de la police `onlyskulls`, un petit crâne) :
  une liste dont au moins DEUX items consécutifs s'ouvrent par le MÊME jeton d'un seul caractère est
  un site (stock nominatif `scripts/raw/source-puces-stock.json`). Le geste se fait au `.md`, jeton
  par jeton, contre la PAGE : le jeton PART si la page n'imprime qu'une puce — et prend la place du
  marqueur `- ` là où l'extraction l'a perdu (`0 Texte` → `- Texte`) —, il RESTE si la page
  l'imprime (une liste réellement numérotée ne mord d'ailleurs pas : ses jetons diffèrent, et un
  jeton de ponctuation OUVRANTE — `Pi`/`Ps` : `«`, `“`, `‹`, `(`, `[`… — ouvre une citation, pas un
  item). COUVERTURE : l'item ISOLÉ et la puce INTERNE à une ligne (colonnes effondrées) restent
  invisibles à la garde ; ils se tranchent à la page, pas au stock.
  `--ecrire-stock` régénère le stock après une correction.
- `node scripts/raw/check-renvois.mjs` (#1393) — les renvois « page N » du texte, résolus en ADRESSE
  par `src/data/source/renvoi.ts` (niveaux `table`, `section-adjacente`, `section-phrase`, `page`),
  pour tout livre extrait dont la `language` a ses motifs (`MOTIFS_DE_RENVOI`, construits par comptage
  du corpus — une langue neuve se mesure avant de s'y ajouter). Stock nominatif décroissant
  `scripts/raw/renvois-stock.json` : les renvois `ambigu` et `introuvable`, clé
  `slug#occ :: p.N :: rang R` de la section porteuse. Une entrée part quand son renvoi se résout ;
  `--ecrire-stock` régénère le stock, `--lot <#N>` requis pour toute entrée neuve.
- `node scripts/raw/check-source-format.mjs` — écart de FORME des 20 dossiers FR au format canonique
  (sept familles, stock nominatif décroissant `scripts/raw/source-format-stock.json`) ; le geste est
  de REJOUER la chaîne canonique sur le livre (§0), jamais une correction manuelle.
  `--ecrire-stock` régénère le stock après ce passage.
- `node scripts/raw/check-ancres.mjs` (`npm run raw:check-ancres`) — les RENVOIS D'ANCRE des pages de
  l'Atlas : tout `](#un-titre)`, `](autre.md#un-titre)`, `](../coeur/autre.md#un-titre)` désigne une
  ancre EXISTANTE de la page visée. Refus DUR, aucun stock : l'ancre d'un titre se CALCULE
  (`scripts/raw/lib/ancres.mjs`, la définition unique qu'adresse aussi le Sommaire écrit par
  `scripts/raw/assemble-domain.mjs`), donc un renvoi mort est un renvoi FAUX. Le geste :
  `node scripts/raw/reparer-ancres.mjs --dry` rend ce que le pliage de la cible citée (accents, puis
  suites de `-`) résout, `--apply` le réécrit ; ce qu'il ne plie pas se vise à la main, au titre que
  le texte du lien nomme. Si aucun titre ne le porte (un `#implemente` vise un CHAMP, pas une
  section) : dans un SOMMAIRE, l'entrée annonce une section qui n'existe pas — elle part en entier ;
  dans la PROSE, le balisage de lien part et le texte reste.
- `node scripts/source/reparer-adresses.mjs` (+ `--apply`, `--dataset <nom>`, `--depuis <ref-git>`) —
  adresses `descRef` recalées après une correction d'extraction ; sortie 1 tant qu'une adresse reste
  cassée. La garde qui les JUGE est `src/data/prose-resolution.test.ts`.
