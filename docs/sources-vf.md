# Sources VF — détail des livres autorisés

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-sources-vf.mjs` (`npm run docs:sources-vf`) — NE PAS ÉDITER À LA MAIN.
> Source factuelle (id, abréviation, dossier `Source/…`) : `src/data/books.json`. Part éditoriale (périmètres
> par passage, arbitrages datés, avertissements d'extraction) : maintenue dans ce script — pas dérivable de la
> donnée. Extrait verbatim du CLAUDE.md (dégraissage 2026-07-05) : lire ici pour le détail d'un livre ; la règle
> et la liste compacte restent dans `CLAUDE.md`.

**Périmètre mesuré / angles morts** — les chemins `Source/…` et abréviations ci-dessous sont LUS depuis
`src/data/books.json` (`id`/`abbr`/`dir`) : un livre renommé/déplacé casse ce script au lieu de laisser le
`.md` mentir. Le compte « 17 livres » (paragraphe Atlas) = nombre d'entrées de `books.json` portant
un champ `dir` (livre effectivement extrait sous `Source/`) ; un livre `language: "VF"` SANS `dir` (ex.
Aventures à Ubersreik II, Compagnon du Pouvoir derrière le Trône) est une édition française CONNUE mais NON
EXTRAITE — ce script ne peut pas distinguer « pas de VF » de « VF pas encore sourcé », il rapporte l'un ou
l'autre selon le champ `dir`, jamais une hypothèse. Le reste (chapitres, périmètres par passage, arbitrages
datés, méthodologie d'extraction) est de l'ÉDITORIAL fixé dans ce script, non re-dérivé à chaque run — une
décision de périmètre qui change se corrige ICI, à la main, comme tout arbitrage.

Tout est en **français** sous `Source/`, dossiers préfixés **`Warhammer v4 - …`**. Les dossiers
SANS ce préfixe (Enemy Within…, Altdorf…, Archives of the Empire…) sont la **VO** (base de
connaissance MJ du dépôt parent) — **ne jamais les lire/citer** ici (la donnée du jeu est FR :
CC/CT/F/E…). **Exception unique** : `Source/Warhammer Fantasy Roleplay 5e Core Rulebook/`, livre VO
AUTORISÉ (`CLAUDE.md` § *Sources VF*). Au moindre doute, **lire le `.md` et citer**
`LDB <chap> l.<ligne>` / `ADE…`.

> **Couche de lecture consolidée = l'Atlas [`docs/raw/`](raw/00-index.md)** : il agrège
> ces 17 livres par domaine + catalogues de stats. Lis l'Atlas pour comprendre/vérifier ; n'ouvre `Source/`
> que pour **citer** ou lever un doute. ⚠ **Source ré-extraite à Marker le 2026-06-22** (tables fiables,
> remplace l'ancien OCR pymupdf4llm) → les **n° de ligne** des anciennes réfs `l.<ligne>` ont **dérivé**
> (le **chapitre** reste juste, la **ligne** est approximative) ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`.

## RÈGLES & STATS — périmètres documentés (règle 1)

> **Arbitrage utilisateur 2026-07-10** : « Tous les livres contiennent des règles. Parfois c'est plus
> 90 % scénario, mais souvent il y a quelques règles. » — la dichotomie livre-de-règles / livre-de-contenu
> ne se juge PAS au niveau du livre : le périmètre s'établit **par passage**, documenté ici, au même
> standard partout (verbatim citable `l.<ligne>`, extraction FR dans `Source/` obligatoire — un livre sans
> extraction ne peut pas fournir de mécanique vérifiable). La VO reste interdite hors l'exception
> unique du `CLAUDE.md` § *Sources VF* (Core Rulebook 5e).

- **LDB** = `Source/Warhammer v4 - Livre de base version corrigee/` — chapitres `NN - Titre.md` ;
  les commentaires de code `LDB <n> l.<ligne>` pointent ces fichiers. Chapitres clés :
  06 Classes · 07 Carrières · 08 Statut · 09 Compétences · 10 Talents · 12 Tests · **13 Combat** ·
  15 Déplacement · **16 États** · **17 Destin et Résistance** (« Résilience/Détermination ») ·
  **18 Traumatisme** (critiques) · 19 Corruption · 20 Maladies · **21 Psychologie** ·
  40-43 Prières/Bénédictions/Miracles · 46-51 Règles magiques/Sorts/Magie des Couleurs/Sorcellerie ·
  57 Monnaie · 59 Faire son marché · 60 Fabrication · 61 Encombrement · **62 Les armes** ·
  **63 Armures** · 71 Drogues et poisons · **76 Point d'Impact des Créatures** · 77-83 bestiaire ·
  **85 Traits de créature**. Index : `00 - Index.md`.
- **ADE I** = `Source/Warhammer v4 - Les archives de l'Empire volume 1/`.
- **ADE II** = `Source/Warhammer v4 - Les archives de l'Empire volume 2/`.
- **EDO** (L'Ennemi dans l'Ombre, T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` — périmètre
  RE-VÉRIFIÉ au `Source/` (2026-09-13) : le livre ne porte **aucun bloc de Sort** (zéro `**NI :**` sur
  l'ensemble de ses chapitres) **ni de Talent** ; ses seuls blocs de créature sont **Horreur rose / Horreur bleue de
  Tzeentch** (`EDO 09 l.556-570`, folio 114) — les **Furies du Chaos**, les 3 Talents de culte et les Sorts du
  Chaos que l'on croisait attribués « EDO p.7X-8X » sont en réalité **EDOC ch.9** (voir l'entrée suivante).
  Nouvelles règles propres à EDO = **Appendice 2** (folios 145-149) : PNJ, portes & serrures, fièvre cérébrale
  pourpre + symptômes, 6 Traits de créature et 5 Mutations (folios 147-148), Anneau d'Opsianon.
  2026-07-11 (#309) : Calendrier Impérial (Annexe 3, folios 149-150 — mois/jours/intercalaires ;
  la table est INTROUVABLE au LDB, l'ancienne attribution « LDB » des datasets calendrier était fausse).
- **EDOC** (Compagnon T1) = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/` — véhicules ;
  **ch.9 « La Main pourpre »** = la source RÉELLE de la matière Tzeentch (folios 75-85) : les Talents de culte
  (`EDOC 13 l.85-101` — Bénédiction de Tzeentch, Disciple du changement, Double vie, folio 75), les Sorts du
  Chaos avec leurs blocs NI/Portée (folios 79-83), Marque de Tzeentch (folio 83), **Furies du Chaos** (folio 84),
  **Horreurs de Tzeentch** (folio 85). Avant de taguer `book`+`page` sur une entrée « Chaos T1 », vérifier au
  `Source/` de quel des deux volumes vient le bloc.
- **Middenheim** = `Source/Warhammer v4 - Middenheim la cite du Loup Blanc/` — origines humaines + carrière Frère Loup.
- **AA** (Aux Armes / *Up in Arms*) = `Source/WH - V4 - Aux Armes/` — supplément combat & armes (autorisé 2026-06-14 ;
  source des talents que frenchy.bzh référence : Fusilier, Officier de Siège, etc.).
- **ZI** (Zoo Impérial / *The Imperial Zoo*) = `Source/WH - V4 - Le zoo imperial/` — créatures exotiques + le trait
  **Redoutable** (*Grim*) (autorisé 2026-06-14). Donnée **curée à la main directement dans
  `src/data/*.json`** (commitée, éditable au Codex), chaque entrée taguée à sa `source`.
- **MDG** (La Mer des Griffes / *Sea of Claws*) = `Source/WH - V4 - La Mer de Griffe/` — **cadre côtier + règles navales**
  (autorisé 2026-06-22) : navires & construction/artillerie (ch.12), navigation/manœuvres/**combat naval** + dégâts &
  Critiques sur navire (ch.13), tests d'équipage & moral (ch.14), longs voyages/commerce/**activités & maladies en mer**
  (ch.15), classe **Côtier** (ch.9) + carrières norses (ch.7), cultes **Manann/Stromfels** + miracles
  (ch.10-11), magie des mers (ch.2), **bestiaire marin** + capitaines nommés (ch.16). Comme AA/ZI : extraction curée à la main.
- **ACE** (Altdorf – Couronne de l'Empire) = `Source/Warhammer v4 - Aldorf la Couronne de l'Empire/` — **UNIQUEMENT
  l'Annexe I « Activités à Altdorf » (ch.12)** : les Activités « entre deux aventures » gated par lieu (Pénitence,
  Entraînement à une arme inhabituelle, Tester des objets magiques, Mécénat, Recherche universitaire) — cf. `activities.json`
  (`book: "altdorf-couronne-de-l-empire"`, l'id de `books.json` ; `where: ["altdorf"]`). Le reste du livre = contenu de campagne (tout passage de
  règle supplémentaire s'ajoute au périmètre ici, arbitrage 2026-07-10). Comme AA/ZI/MDG : extraction curée à la main.
- **MSRC** (Mort sur le Reik – Compagnon) = `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/`
  — autorisé 2026-07-10 (#277). Périmètre constaté : **ch.5 « Navigation
  fluviale »** (tables de `river-navigation.json`/`river-perils.json`, critiques fluviaux
  `river-criticals.json`), **ch.10 « Personnalisation »** (traits navals d'aménagement de
  `naval-traits.json` : bouteur, murs blindés, coque de course, safran, plat-bord, allègement, gréement de
  course, fourquines), **ch.13 « Bestiaire fluvial »** (créatures), **ch.14 « Maladies transmises par
  l'eau »** (maladies/symptômes/états, `water-exposure.json`), véhicules fluviaux. Curation à la main.
- **NADJ** (Nuits agitées & dures journées) = `Source/Warhammer v4 - Nuits agitees & dures journees/` —
  autorisé 2026-07-10 (arbitrage par-passage). Périmètre constaté : **appendice I « Gnomes »**
  (espèce jouable, `species.json`), **« Jeux de taverne »** (`tavernGames.json`), des entrées de
  `gods.json`, `talents.json` et `trappings.json`.
- **VDM** (Les Vents de Magie / *Winds of Magic*) = `Source/Warhammer v4 - Les Vents de Magie/` —
  supplément **magie des 8 Collèges** (autorisé 2026-07-22, extrait Marker). Périmètre :
  **règles d'incantation RÉVISÉES** (ch.2 — le livre déclare *remplacer* LDB 46-51 : Focalisation,
  Surincantation, Incantations Imparfaites, dissipation, Repousser les Vents ; + **magie rituelle** &
  rituels, nouvelles **Activités**) ; **carrières & compétences arcaniques** (ch.3 — Alchimiste ordinaire,
  Bedeau, Devin, Magister Vigilant, compétences Augure/Psychométrie/Alchimie) ; **8 domaines de couleur**
  (ch.4-11 Hysh/Chamon/Ghyran/Azyr/Ulgu/Shyish/Aqshy/Ghur : Ordre, carrière de sorcier, listes de sorts
  révisées/étendues, mécène nommé) ; **artefacts magiques** (ch.12) ; **créatures magiques** (ch.13 —
  élémentaires incarnés, Fabriqués, familiers jouables) ; **sites, lignes de force & saturation
  environnementale** (ch.14). Ch.1 (histoire de la magie) & ch.15 (némésis/aventures) = majoritairement
  cadre. Curation `src/data` à la main (tag `source.book: "vents-de-la-magie"`), comme AA/ZI/MDG.
- **CRB** (*Warhammer Fantasy Roleplay*, **5th Edition** — livre **VO**, l'exception
  unique) = `Source/Warhammer Fantasy Roleplay 5e Core Rulebook/` — **cœur des règles de la 5e édition** (autorisé 2026-09-18,
  épique #1816 ; arbitrages utilisateur du même jour : « Elle est en VO, mais ce n'est pas grave, ca sera
  l'occasion d'éprouver notre système de langue VO/VF ! » et « Pas de traduction, on va gérer la VO dans
  l'application. »). Extraction Marker ; chapitres de CONTENU : 04 Introduction ·
  05 Character Building · 06 Class and Careers · 07 Skills and Talents · **08 Rules** (tests, combat,
  blessures, maladies, psychologie, États, corruption) · 09 Between Adventures · 10 Religion and
  Belief · 11 Magic · 12 The Gamemaster · 13 Glorious Reikland · 14 Consumer Guide · 15 Bestiary ·
  16 Appendices ; les autres sont l'appareil du livre : 01 Cover · 02 Contents · 03 Credits ·
  17 Index · 18 Character Sheet.
  Le texte reste en ANGLAIS, verbatim — **aucune traduction** dans `Source/`. Périmètre par passage et
  curation `src/data` (tag `source.book: "core-rulebook-5e"`) : phases suivantes de #1816.
- **frenchy.bzh** (fan — *Habitants & Créatures du Vieux-Monde*, « version 4.5 ») = `Source/Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF/` —
  **complète** le bestiaire et les PNJ, ne remplace rien ; chaque entrée vit dans le JSON app-owned de son
  domaine, taguée `source.book: "frenchy-bzh"`. Deux règles d'IMPORT, lues à son Avertissement :
  les profils sont écrits avec des **PA doublés** — « *les Points d'Armure sont doublés et on ignore le Bonus
  d'Endurance pour diminuer les dégâts* […] *il suffit de diviser par deux les Points d'Armures des PNJ et des
  Créatures et de rajouter le Bonus d'Endurance !* » (`frenchy.bzh 01 l.19`) → **÷2 à l'import**, notre moteur
  étant RAW ; et les noms sont des **traductions personnelles**, à résoudre par les **annexes** qui donnent
  « *les équivalences entre les noms d'origine en VO, les traductions officielles de l'éditeur français (Khaos
  Projet) et les traductions personnelles* » (`frenchy.bzh 01 l.8`) — la colonne VO est le pivot quand la
  traduction personnelle diverge de l'officielle.
- **Tomes de campagne (règles ponctuelles)** : **MSR** (T2 base) — 1 statbloc (`creatures.json`) ;
  **PDT** (T3 base) — 1 entrée de compétence (`skills.json`). Admis par l'arbitrage 2026-07-10, chaque
  entrée taguée à sa `source`.
- `src/data/*.json` est la **SOURCE app-owned** (commitée, éditée dans le Compendium) ; tout contenu
  s'ajoute à la main / via l'éditeur.
  EDO/EDOC/Middenheim sont AUSSI des livres de scénario (cf. ci-dessous) ; seule leur **donnée extraite**
  entre dans les règles, pas leur prose narrative.

## Volumes majoritairement SCÉNARIO (règles ponctuelles admises — voir arbitrage ci-dessus)

- Tome 1 : `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` + `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/`.
- Tome 2 : `Source/Warhammer v4 - 2.0 Mort sur le Reik/` + `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/`.
- Tome 3 : `Source/Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone/` (Compagnon VO, non extrait dans `Source/`).
- Suppléments VF dispo : `Altdorf — La Couronne de l'Empire`,
  `Aventures à Ubersreik I` (extrait : `Source/Warhammer v4 - Aventures a Ubersreik/`),
  `Middenheim — La Cité du Loup Blanc`, `Nuits Agitées & Dures Journées`,
  `Boîte d'Initiation` (+ `WH4_FR_BI_Livre_Aventure` / `…_Ubersreik`).
<!-- sources-empreinte: c39226e18eee7663b7fa1733b9480b14b7b28631 (18 fichiers, 0 dossiers) corps: da8cffdb50ddfde41209add487d250ed45aed89e -->
