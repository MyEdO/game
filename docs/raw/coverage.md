# Atlas RAW — Registre de couverture

> Contrat « l'Atlas remplace la source » : chaque chapitre des 17 livres doit être **couvert**
> (cité par une fiche `docs/raw/`, ✅) ou explicitement **hors-règle** (narratif). Un chapitre `⬜` = trou.
> `📖` = crédité par un CATALOGUE seul (donnée verbatim ré-extraite au chapitre) — **transcrit, pas
> traité** : recourir à la source pour un point qui y vit encore = un défaut de l'Atlas à corriger.
> Régénéré par `node scripts/raw/coverage.mjs`. Détail **section-granulaire** (niveau de heading
> ADAPTATIF par livre, #604) sous la table d'un chapitre qui enfouit ou troue une section :
> `⬜` = section sans aucune réf de fiche dans sa plage (`trou` = candidate règle non couverte,
> `scénario` = bruit de campagne pure) · `📖` = section 0-réf d'un chapitre catalogué (transcrite,
> jamais traitée — plus jamais masquée) · `🔻 enfoui` = titre orné (`•`) rétrogradé par l'extraction
> — un défaut d'extraction, pas une section ordinaire (#454).

**Couverture (profondeur), par groupe de livres** :

- **Cœur 4e** : ✅ 40 traités par une fiche · 📖 33 transcrits par un catalogue seul (jamais traités) · 🟡 0 effleurés · ⬜ 1 trous, sur 74 chapitres-règles (hors artefacts OCR).
- **Cœur 5e** : ✅ 33 traités par une fiche · 📖 0 transcrits par un catalogue seul (jamais traités) · 🟡 17 effleurés · ⬜ 67 trous, sur 117 chapitres-règles (hors artefacts OCR).
- **Livres sans cœur déclaré** : ✅ 49 traités par une fiche · 📖 45 transcrits par un catalogue seul (jamais traités) · 🟡 2 effleurés · ⬜ 0 trous, sur 96 chapitres-règles (hors artefacts OCR).

Section-granulaire (niveau de heading ADAPTATIF par livre — H2 pour AA/VDM/ADE I/ADE II/EDO, H3 pour LDB/CRB/MCLB/ACE/ZI/MDG/EDOC/MSRC/NADJ/MSR/PDT, H4 pour AU1, #604), ventilation DÉRIVÉE (jamais un compte recopié) sur 3844 section(s) non couvertes par une fiche : **639 transcrite(s) en catalogue** (recopiées, pas traitées) · **2463 hors-règle** (chapitre explicitement exclu) · **61 bruit de scénario** (livres de teneur `scenario` AU1/EDO/MSR/PDT : prose de campagne, aucune règle) · **681 candidat(s) trou de règle** (reste : LDB/CRB/AA/VDM/ADE I/ADE II/MCLB/ACE/ZI/MDG/EDOC/MSRC/NADJ — livres de règles et compagnons mixtes, où une section vide peut cacher une vraie règle non couverte) — et 12 titre(s) de chapitre enfoui(s) détecté(s) (titre orné rétrogradé par l'extraction). Ce chiffre reste un PLANCHER : les sections couvertes par une fiche (✅ au niveau section) ne sont pas dénombrées ici (volume, cf. #604 DoD « la sortie ne liste pas l'exhaustif »). Réfs folio (`ABBR NN p.X`, #606) : 2 ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre). Par livre : LDB ✅40·📖33·🟡0·⬜1 · CRB ✅33·📖0·🟡17·⬜67 · AA ✅9·📖4·🟡0·⬜0 · VDM ✅4·📖10·🟡0·⬜0 · ADE I ✅0·📖2·🟡0·⬜0 · ADE II ✅3·📖3·🟡0·⬜0 · MCLB ✅0·📖5·🟡0·⬜0 · ACE ✅1·📖2·🟡0·⬜0 · ZI ✅4·📖10·🟡0·⬜0 · MDG ✅8·📖2·🟡0·⬜0 · EDOC ✅4·📖0·🟡1·⬜0 · MSRC ✅3·📖4·🟡1·⬜0 · AU1 ✅1·📖0·🟡0·⬜0 · NADJ ✅6·📖0·🟡0·⬜0 · EDO ✅4·📖0·🟡0·⬜0 · MSR ✅0·📖1·🟡0·⬜0 · PDT ✅2·📖2·🟡0·⬜0.

## LDB — ✅ 40 · 📖 33 · 🟡 0 · ⬜ 1

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | VERSION ORIGINALE | ➖ hors-règle | « VERSION ORIGINALE » / « TRADUCTION FRANÇAISE » — crédits d'édition, aucune règle |
| 02 | Introduction | ➖ hors-règle | |
| 03 | *(artefact OCR)* | ➖ | |
| 04 | Cités et villes | ✅ | 7 (4e/creation.md ×7) |
| 05 | Points de vue | ✅ | 91 (4e/creation.md ×52) |
| 06 | *(artefact OCR)* | ➖ | |
| 07 | Carrieres | ✅ | 83 (4e/avancement.md ×61) |
| 08 | Statut | ✅ | 26 (4e/carrieres.md ×22) |
| 09 | Competences | ✅ | 146 (4e/competences.md ×137) |
| 10 | Talents | ✅ | 200 (4e/talents.md ×138) |
| 11 | Sixième sens | ✅ | 31 (4e/talents.md ×30) |
| 12 | Tests | ✅ | 50 (4e/tests.md ×45) |
| 13 | Combat | ✅ | 132 (4e/combat.md ×122) |
| 14 | OPTION : FRAPPE MORTELLE | ✅ | 141 (4e/combat.md ×136) |
| 15 | Deplacement | ✅ | 70 (4e/combat.md ×62) |
| 16 | Etats | ✅ | 56 (4e/etats.md ×31) |
| 17 | Destin et Resistance | ✅ | 55 (4e/destin.md ×31) |
| 18 | Traumatisme | ✅ | 107 (4e/traumatisme.md ×68) |
| 19 | Corruption | ✅ | 35 (4e/corruption.md ×29) |
| 20 | Maladies et infections | ✅ | 30 (4e/maladies.md ×30) |
| 21 | Psychologie | ✅ | 53 (4e/psychologie.md ×29) |
| 22 | Evenements | ✅ | 4 (4e/activites.md ×4) |
| 23 | Activites | ✅ | 41 (4e/activites.md ×36) |
| 24 | Les dieux | 📖 | catalogue (catalogue-*.md) |
| 25 | Les cultes | ✅ | 3 (4e/religion.md ×3) |
| 26 | Le culte de Manaan, dieu de la mer | 📖 | catalogue (catalogue-*.md) |
| 27 | Le culte de Morr, Dieu de la Mort | 📖 | catalogue (catalogue-*.md) |
| 28 | Le culte de Myrmidia, deesse de la Strategie | 📖 | catalogue (catalogue-*.md) |
| 29 | Le culte de Ranald, Dieu de la ruse | 📖 | catalogue (catalogue-*.md) |
| 30 | Le culte de Rhya, deesse de la Fertilite | 📖 | catalogue (catalogue-*.md) |
| 31 | Le culte de Shallya, deesse de la Misericorde | 📖 | catalogue (catalogue-*.md) |
| 32 | Le culte de Sigmar, dieu de l'Empire | 📖 | catalogue (catalogue-*.md) |
| 33 | Le culte de Taal, dieu de la Nature | 📖 | catalogue (catalogue-*.md) |
| 34 | Le culte d'Ulric, dieu de la Guerre | 📖 | catalogue (catalogue-*.md) |
| 35 | Le culte de Verena, deesse de la sagesse | 📖 | catalogue (catalogue-*.md) |
| 36 | Les dieux ancetres nains | 📖 | catalogue (catalogue-*.md) |
| 37 | Les dieux elfes | 📖 | catalogue (catalogue-*.md) |
| 38 | Les dieux halflings | 📖 | catalogue (catalogue-*.md) |
| 39 | Les dieux du Chaos | 📖 | catalogue (catalogue-*.md) |
| 40 | Les prieres | ✅ | 48 (4e/religion.md ×24) |
| 41 | Benedictions | ✅ | 12 (4e/religion.md ×7) |
| 42 | Miracles | 📖 | 4 (4e/magie.md ×2) |
| 43 | Miracles de Rhya | 📖 | catalogue (catalogue-*.md) |
| 44 | L'Aethyr | ✅ | 11 (4e/magie.md ×11) |
| 45 | • MAGIE • | ➖ hors-règle | ouverture « • MAGIE • » : exergue + prose d'intro ; les règles vivent aux ch. suivants |
| 46 | Les regles magiques | ✅ | 90 (4e/magie.md ×50) |
| 47 | Listes des sorts | ✅ | 7 (4e/magie.md ×7) |
| 48 | Magie des Couleurs | ✅ | 18 (4e/magie.md ×18) |
| 49 | Sorcellerie | ✅ | 4 (4e/magie.md ×3) |
| 50 | Magie noire | 📖 | catalogue (catalogue-*.md) |
| 51 | Magie du Chaos | ✅ | 14 (4e/deplacement.md ×14) |
| 52 | configuration du terrain | ➖ hors-règle | section MJ/cadre du LDB (terrain/politique/colonies/sites = direction de jeu, pas des règles PC) |
| 53 | Le canal Grünberg | ➖ hors-règle | section MJ/cadre du LDB (terrain/politique/colonies/sites = direction de jeu, pas des règles PC) |
| 54 | La politique | ➖ hors-règle | section MJ/cadre du LDB (terrain/politique/colonies/sites = direction de jeu, pas des règles PC) |
| 55 | Colonies | ➖ hors-règle | section MJ/cadre du LDB (terrain/politique/colonies/sites = direction de jeu, pas des règles PC) |
| 56 | Sites anciens et ruines terrifiantes | ➖ hors-règle | section MJ/cadre du LDB (terrain/politique/colonies/sites = direction de jeu, pas des règles PC) |
| 57 | La monnaie | 📖 | 1 (4e/economie.md ×1) |
| 58 | •GUIDE DE L'ÉQUIPEMENT • | ➖ hors-règle | ouverture « • GUIDE DE L'ÉQUIPEMENT • » : intro + index des listes (renvois de pages) |
| 59 | Faire son marche | ✅ | 19 (4e/economie.md ×19) |
| 60 | Fabrication | ✅ | 16 (4e/economie.md ×13) |
| 61 | Encombrement | ✅ | 40 (4e/equipement.md ×18) |
| 62 | Les armes | ✅ | 119 (4e/combat.md ×112) |
| 63 | Armures | ✅ | 28 (4e/combat.md ×27) |
| 64 | Sacs et contenants | 📖 | catalogue (catalogue-*.md) |
| 65 | Vetements et accessoires | 📖 | 1 (4e/traumatisme.md ×1) |
| 66 | Nourriture, boisson et hebergement | 📖 | catalogue (catalogue-*.md) |
| 67 | Outils et necessaires | ✅ | 5 (4e/equipement.md ×5) |
| 68 | Livres et documents | 📖 | catalogue (catalogue-*.md) |
| 69 | Outils professionnels et Ateliers | 📖 | catalogue (catalogue-*.md) |
| 70 | Animaux et vehicules | 📖 | 1 (4e/deplacement.md ×1) |
| 71 | Drogues et poisons | 📖 | 2 (4e/equipement.md ×2) |
| 72 | Herbes et potions | ✅ | 8 (4e/equipement.md ×8) |
| 73 | Protheses | ✅ | 5 (4e/equipement.md ×5) |
| 74 | Possessions diverses | ✅ | 13 (4e/equipement.md ×12) |
| 75 | Mercenaires | 📖 | catalogue (catalogue-*.md) |
| 76 | Point d'Impact des Creatures | ✅ | 53 (4e/combat.md ×29) |
| 77 | Les populations du Reikland | ✅ | 9 (4e/combat.md ×5) |
| 78 | Les Betes du Reikland | 📖 | catalogue (catalogue-*.md) |
| 79 | Les betes monstrueuses du Reikland | 📖 | catalogue (catalogue-*.md) |
| 80 | Les hordes de peaux-vertes | 📖 | catalogue (catalogue-*.md) |
| 81 | Vouivre | ⬜ |  |
| 82 | Les morts sans repos | 📖 | catalogue (catalogue-*.md) |
| 83 | Esclaves des Tenebres | 📖 | catalogue (catalogue-*.md) |
| 84 | Guerrier du Chaos | 📖 | catalogue (catalogue-*.md) |
| 85 | Traits de creature | ✅ | 299 (4e/combat.md ×205) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **LDB 04** (_GoBack) :
  - 🔻 enfoui l.53-102 « PERSONNAGE » — titre orné rétrogradé par l'extraction, 6 réf
  - ⬜ l.13-52 « Vie rurale » — candidat trou de règle, 0 réf
- **LDB 05** (_gjdgxs) :
  - ⬜ l.11-90 « Points de vue » — candidat trou de règle, 0 réf
  - ⬜ l.91-168 « Points de vue » — candidat trou de règle, 0 réf
  - ⬜ l.594-600 « Noms humains reiklanders » — candidat trou de règle, 0 réf
  - ⬜ l.601-608 « NOMS HUMAINS ET LEURS ORIGINES » — candidat trou de règle, 0 réf
  - ⬜ l.714-717 « Couleur des yeux » — candidat trou de règle, 0 réf
  - ⬜ l.876-888 « Quels sont vos meilleurs et vos pires souvenirs ? » — candidat trou de règle, 0 réf
  - ⬜ l.931-967 « AUTRES COÛTS D'AUGMENTATION » — candidat trou de règle, 0 réf
  - ⬜ l.968-971 « Expérience » — candidat trou de règle, 0 réf
  - ⬜ l.972-984 « Ambitions » — candidat trou de règle, 0 réf
  - ⬜ l.985-1010 « Corruption et mutation » — candidat trou de règle, 0 réf
- **LDB 08** (Statut) :
  - 📖 l.765-772 « Maître duelliste – Or 1 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.773-899 « Champion de Justice – Or 3 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.900-1186 « Schéma de Progression d'Intendant » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1187-1196 « Garde – Argent 2 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1197-1367 « Garde d'honneur – Argent 3 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1368-1585 « Sergent – Argent 5 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1586-1634 « h Postillon – Argent 1 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1635-1853 « Schéma de Progression du Colporteur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1854-2069 « Capitaine Patrouilleur – Or 1 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2070-2284 « Schéma de Progression de l'Érudit » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2285-2457 « Médecin de la cour – Or 1 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2458-2571 « Maître Sorcier – Or 1 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2572-2577 « Contrebandier – Bronze 3 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2578-2661 « Maître contrebandier – Bronze 5 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2662-2691 « Schéma de Progression de la Femme du fleuve » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2692-2819 « Sage des rives – Bronze 5 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.2820-3021 « Pirate des rivières – Bronze 5 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3022-3059 « Schéma de progression de l'Entremetteur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3060-3281 « Meneur – Argent 3 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3282-3326 « Maître receleur – Argent 3 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3327-3389 « Sorcier dissident – Bronze 2 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3390-3397 « Maître voleur – Bronze 5 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3398-3534 « Cambrioleur – Argent 3 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3535-3556 « Schéma de Progression de l'Éclaireur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3557-3833 « Guide – Argent 1 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.3834-3843 « Doyen – Argent 2 » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 11** (_3znysh7) :
  - 🔻 enfoui l.207-241 « RÈGLES » — titre orné rétrogradé par l'extraction, 13 réf
- **LDB 15** (Deplacement) :
  - ⬜ l.113-120 « OPTION : COMPLICATIONS DE POURSUITE » — candidat trou de règle, 0 réf
- **LDB 21** (Psychologie) :
  - 🔻 enfoui l.98-111 « ENTRE DEUX AVENTURES » — titre orné rétrogradé par l'extraction, 2 réf
- **LDB 23** (Activites) :
  - 🔻 enfoui l.251-256 « RELIGIONS ET CROYANCES » — titre orné rétrogradé par l'extraction, 0 réf
- **LDB 24** (Les dieux) :
  - 📖 l.23-56 « Les dieux provinciaux » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 38** (Les dieux halflings) :
  - 📖 l.36-44 « PRINCIPAUX DIEUX HALFLINGS » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 41** (Benedictions) :
  - 📖 l.192-218 « Bénédiction de Vigueur » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 42** (Miracles) :
  - 📖 l.17-95 « Encalminé » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.96-103 « Masque mortuaire » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.104-131 « Rites funéraires » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.132-138 « Inspirant » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.139-148 « Lance de Myrmidia » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.149-182 « Œil de l'aigle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.183-216 « Que la chance persiste » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.217-229 « Yeux de chat » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 43** (Miracles de Rhya) :
  - 📖 l.36-71 « Secours de Rhya » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.72-81 « Endurance de l'anachorète » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.82-92 « Innocence immaculée » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.93-116 « Larmes de Shallya » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.117-146 « Feu de l'âme » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.147-187 « Vaincre les impies » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.188-197 « Roi de la Nature » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.198-215 « Seigneur de la Chasse » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.216-225 « Fureur d'Ulric » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.226-254 « Hurlement du loup » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.255-290 « Peau de loup d'hiver » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.291-316 « La Vérité éclatera » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 44** (L'Aethyr) :
  - ⬜ l.42-50 « Domaine des Cieux » — candidat trou de règle, 0 réf
  - ⬜ l.51-58 « Domaine du Feu » — candidat trou de règle, 0 réf
  - ⬜ l.59-75 « Domaine de la Lumière » — candidat trou de règle, 0 réf
  - ⬜ l.76-83 « Domaine de la Mort » — candidat trou de règle, 0 réf
  - ⬜ l.84-91 « Domaine des Ombres » — candidat trou de règle, 0 réf
- **LDB 46** (Les regles magiques) :
  - ⬜ l.179-191 « OPTION : VENTS TOURBILLONNANTS » — candidat trou de règle, 0 réf
- **LDB 47** (Listes des sorts) :
  - 📖 l.63-88 « Bruits » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.89-116 « Conservation » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.117-161 « Drain » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.162-193 « Flamme magique » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.194-223 « Murmures » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.224-231 « Purification de l'eau » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.232-240 « Putréfaction » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.241-268 « Repères » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.269-290 « Sommeil » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.291-312 « Tendre l'oreille » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.313-351 « Arme aethyrique » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.352-359 « Bouclier anti-flèches » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.360-472 « Bouclier magique » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.473-480 « Poussée » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.481-540 « Protection » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 48** (Magie des Couleurs) :
  - 📖 l.29-44 « Incarnation de Wyssan » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.45-56 « Langue bestiale » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.57-69 « Maître de la bête » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.126-136 « Bouclier céruléen » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.137-186 « Comète de Cassandora » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.221-230 « Cœurs ardents » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.231-243 « Couronne de Flammes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.244-275 « Grands feux d'*U'Zhul* » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.276-287 « Mur de feu » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.308-330 « Bannissement » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.627-670 « Linceul d'Invisibilité » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.704-763 « Don de Vie » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.800-850 « Bonne Volonté » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.851-860 « Séparer les branches » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 49** (Sorcellerie) :
  - 📖 l.52-63 « Malédiction de malchance » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.64-88 « Mauvais œil » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 50** (Magie noire) :
  - 📖 l.33-44 « Manifestation de Démon Mineur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.45-62 « Octogramme » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.63-83 « Crâne hurlant » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.84-107 « Réanimation » — transcrit en catalogue, jamais traité, 0 réf
- **LDB 51** (Magie du Chaos) :
  - 🔻 enfoui l.52-250 « MENEUR DE JEU » — titre orné rétrogradé par l'extraction, 14 réf
  - 📖 l.39-51 « Trahison de Tzeentch » — transcrit en catalogue, jamais traité, 0 réf

## CRB — ✅ 33 · 📖 0 · 🟡 17 · ⬜ 67

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 001 | Cover | ➖ hors-règle | couverture : la seule accroche « A GRIM WORLD OF PERILOUS ADVENTURE » (3 lignes) |
| 002 | Contents | ➖ hors-règle | sommaire (tables de renvois de pages) |
| 003 | Credits | ➖ hors-règle | crédits d'édition |
| 004 | Introduction | ✅ | 18 (5e/tests.md ×18) |
| 005 | Character Building | ⬜ |  |
| 006 | 1. Species | ✅ | 6 (5e/tests.md ×6) |
| 007 | Character Sheet Explained | ✅ | 4 (5e/tests.md ×4) |
| 008 | Humans (Reiklanders) | 🟡 | 2 (5e/tests.md ×2) |
| 009 | Dwarfs | 🟡 | 2 (5e/tests.md ×2) |
| 010 | Halflings | 🟡 | 2 (5e/tests.md ×2) |
| 011 | High Elves | 🟡 | 2 (5e/tests.md ×2) |
| 012 | Wood Elves | 🟡 | 2 (5e/tests.md ×2) |
| 013 | 2. Class and Career | ⬜ |  |
| 014 | 3. Characteristics | ⬜ |  |
| 015 | 4. Skills | ⬜ |  |
| 016 | 5. Talents, Trappings, and Final Game Details | 🟡 | 2 (5e/tests.md ×2) |
| 017 | 6. Personality and Background | 🟡 | 2 (5e/tests.md ×2) |
| 018 | Class and Careers | ⬜ |  |
| 019 | Skills and Talents | ⬜ |  |
| 020 | Skills | ✅ | 15 (5e/tests.md ×15) |
| 021 | Talents | ✅ | 22 (5e/tests.md ×22) |
| 022 | Rules | ✅ | 13 (5e/tests.md ×13) |
| 023 | Tests | ✅ | 11 (5e/tests.md ×11) |
| 024 | Making a Test | ✅ | 359 (5e/tests.md ×359) |
| 025 | Fate and Fortune | ✅ | 71 (5e/tests.md ×71) |
| 026 | Using the Rules | ✅ | 3 (5e/tests.md ×3) |
| 027 | Theft and Skullduggery | ✅ | 6 (5e/tests.md ×6) |
| 028 | Flattery, Bribery, and Status | ✅ | 3 (5e/tests.md ×3) |
| 029 | Nosing Around | ✅ | 4 (5e/tests.md ×4) |
| 030 | Life Beyond the Walls | 🟡 | 2 (5e/tests.md ×2) |
| 031 | Cunning Crafts | 🟡 | 2 (5e/tests.md ×2) |
| 032 | Getting Around | ✅ | 4 (5e/tests.md ×4) |
| 033 | Combat | ✅ | 4 (5e/tests.md ×4) |
| 034 | Taking Your Turn | ✅ | 5 (5e/tests.md ×5) |
| 035 | Moving in Combat | ⬜ |  |
| 036 | Attacking | ✅ | 29 (5e/tests.md ×29) |
| 037 | Momentum | ✅ | 5 (5e/tests.md ×5) |
| 038 | Injury, Healing, and Death | ✅ | 11 (5e/tests.md ×11) |
| 039 | Disease and Infection | 🟡 | 2 (5e/tests.md ×2) |
| 040 | Poisons | 🟡 | 2 (5e/tests.md ×2) |
| 041 | Psychology | ✅ | 4 (5e/tests.md ×4) |
| 042 | Conditions | ✅ | 14 (5e/tests.md ×14) |
| 043 | Corruption and Mutation | ⬜ |  |
| 044 | Between Adventures | ⬜ |  |
| 045 | Spending XP | ⬜ |  |
| 046 | Regional Events | ⬜ |  |
| 047 | Character Events | ✅ | 4 (5e/tests.md ×4) |
| 048 | Endeavours | 🟡 | 2 (5e/tests.md ×2) |
| 049 | Religion and Belief | ⬜ |  |
| 050 | Gods of the Empire | ⬜ |  |
| 051 | The Cults | ⬜ |  |
| 052 | The Cult of Manann, God of the Sea | ⬜ |  |
| 053 | The Cult of Morr, God of Death | ⬜ |  |
| 054 | The Cult of Myrmidia, Goddess of Strategy | ⬜ |  |
| 055 | The Cult of Ranald, God of Trickery | ⬜ |  |
| 056 | The Cult of Rhya, Goddess of Fertility | ⬜ |  |
| 057 | The Cult of Shallya, Goddess of Mercy | ⬜ |  |
| 058 | The Cult of Sigmar, God of the Empire | ⬜ |  |
| 059 | The Cult of Taal, God of the Wild | ⬜ |  |
| 060 | The Cult of Ulric, God of Wolves, War, and Winter | ⬜ |  |
| 061 | The Cult of Verena, Goddess of Wisdom | ⬜ |  |
| 062 | Dwarf Ancestor Gods | ⬜ |  |
| 063 | Halfling Gods | ⬜ |  |
| 064 | Chaos Gods | ⬜ |  |
| 065 | Prayers | ✅ | 10 (5e/tests.md ×10) |
| 066 | Blessings | 🟡 | 2 (5e/tests.md ×2) |
| 067 | Miracles | ✅ | 4 (5e/tests.md ×4) |
| 068 | Magic | ⬜ |  |
| 069 | The Aethyr | ⬜ |  |
| 070 | Magic Rules | ✅ | 11 (5e/tests.md ×11) |
| 071 | Colour Magic | ✅ | 10 (5e/tests.md ×10) |
| 072 | Witch Magic | ✅ | 3 (5e/tests.md ×3) |
| 073 | Dark Magic | ⬜ |  |
| 074 | Chaos Magic | 🟡 | 1 (5e/tests.md ×1) |
| 075 | The Gamemaster | ✅ | 12 (5e/tests.md ×12) |
| 076 | Running the Game | ✅ | 97 (5e/tests.md ×97) |
| 077 | Glorious Reikland | ⬜ |  |
| 078 | The Lie of the Land | ⬜ |  |
| 079 | The Powers That Be | ⬜ |  |
| 080 | Settlements | ⬜ |  |
| 081 | Consumer Guide | ⬜ |  |
| 082 | Money | ⬜ |  |
| 083 | Going to Market | ⬜ |  |
| 084 | Craftsmanship | ⬜ |  |
| 085 | Encumbrance | ⬜ |  |
| 086 | Weapons | ✅ | 6 (5e/tests.md ×6) |
| 087 | Armour | ⬜ |  |
| 088 | Packs and Containers | ⬜ |  |
| 089 | Clothing and Accessories | ⬜ |  |
| 090 | Food, Drink, and Lodging | 🟡 | 2 (5e/tests.md ×2) |
| 091 | Tools and Kits | ⬜ |  |
| 092 | Books and Documents | ⬜ |  |
| 093 | Trade Tools and Workshops | ⬜ |  |
| 094 | Animals and Vehicles | ⬜ |  |
| 095 | Travel Prices | ⬜ |  |
| 096 | Poisons | ⬜ |  |
| 097 | Herbs and Remedies | ✅ | 4 (5e/tests.md ×4) |
| 098 | Prosthetics | ⬜ |  |
| 099 | Magical Items | ⬜ |  |
| 100 | Miscellaneous Trappings | 🟡 | 2 (5e/tests.md ×2) |
| 101 | Hirelings | ⬜ |  |
| 102 | Bestiary | ⬜ |  |
| 103 | Creature Hit Locations | ⬜ |  |
| 104 | The Peoples of the Reikland | ⬜ |  |
| 105 | The Beasts of the Reikland | ⬜ |  |
| 106 | The Monstrous Beasts of the Reikland | ⬜ |  |
| 107 | The Orc and Goblin Hordes | ⬜ |  |
| 108 | The Restless Dead | ⬜ |  |
| 109 | Beastmen, the Children of Chaos | ⬜ |  |
| 110 | Cultists, the Lost and the Damned | ⬜ |  |
| 111 | Daemons, the Gibbering Hosts | ⬜ |  |
| 112 | The Loathsome Ratmen | ⬜ |  |
| 113 | Creature Templates | ⬜ |  |
| 114 | Ungrakk's Brayherd | 🟡 | 2 (5e/tests.md ×2) |
| 115 | Creature Traits | ✅ | 5 (5e/tests.md ×5) |
| 116 | Appendix I | ✅ | 22 (5e/tests.md ×22) |
| 117 | Appendix II | ⬜ |  |
| 118 | Appendix III | ⬜ |  |
| 119 | Appendix IV | ⬜ |  |
| 120 | Appendix V | ⬜ |  |
| 121 | Index | ➖ hors-règle | |
| 122 | Character Sheet | ➖ hors-règle | feuille de personnage : rappels imprimés, chacun défini ailleurs dans ce livre — ch.35 (déplacement), ch.38 (blessures), ch.43 (corruption), ch.20 (compétence ↔ caractéristique), ch.82 et ch.85 (monnaie, encombrement) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **CRB 004** (Introduction) :
  - ➖ l.19-24 « NEW TO ROLEPLAYING GAMES » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
- **CRB 005** (Character Building) :
  - ⬜ l.20-23 « FITTING IN » — candidat trou de règle, 0 réf
- **CRB 009** (Dwarfs) :
  - ⬜ l.61-64 « Fluent Languages » — candidat trou de règle, 0 réf
  - ⬜ l.65-68 « Starting Skills » — candidat trou de règle, 0 réf
- **CRB 010** (Halflings) :
  - ⬜ l.37-42 « Names » — candidat trou de règle, 0 réf
- **CRB 011** (High Elves) :
  - ⬜ l.55-58 « Fluent Languages » — candidat trou de règle, 0 réf
- **CRB 012** (Wood Elves) :
  - ⬜ l.41-48 « Names » — candidat trou de règle, 0 réf
  - ⬜ l.49-68 « Wood Elf Physical Characteristics » — candidat trou de règle, 0 réf
  - ⬜ l.87-94 « SYLVAN COUSINS » — candidat trou de règle, 0 réf
- **CRB 013** (2. Class and Career) :
  - ⬜ l.17-104 « CAREER LEVEL » — candidat trou de règle, 0 réf
- **CRB 017** (6. Personality and Background) :
  - ⬜ l.5-8 « Who are You? » — candidat trou de règle, 0 réf
  - ⬜ l.9-20 « Choose an Ambition » — candidat trou de règle, 0 réf
  - ⬜ l.21-26 « Achieving Your Ambitions » — candidat trou de règle, 0 réf
  - ⬜ l.27-33 « What Brings You Together? » — candidat trou de règle, 0 réf
  - ⬜ l.34-65 « QUESTIONS » — candidat trou de règle, 0 réf
  - ⬜ l.72-85 « PLAYER REFERENCE » — candidat trou de règle, 0 réf
- **CRB 018** (Class and Careers) :
  - ⬜ l.11-14 « CLASSES » — candidat trou de règle, 0 réf
  - ⬜ l.15-18 « CAREERS » — candidat trou de règle, 0 réf
  - ⬜ l.19-30 « Advancing Through Your Career » — candidat trou de règle, 0 réf
  - ⬜ l.31-34 « Anatomy of a Career » — candidat trou de règle, 0 réf
  - ⬜ l.35-38 « 1. Career Levels » — candidat trou de règle, 0 réf
  - ⬜ l.39-50 « 2. Characteristics » — candidat trou de règle, 0 réf
  - ⬜ l.51-60 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.61-66 « 3. Skills » — candidat trou de règle, 0 réf
  - ⬜ l.67-70 « NON-CAREER ADVANCES » — candidat trou de règle, 0 réf
  - ⬜ l.71-74 « 4. Talents » — candidat trou de règle, 0 réf
  - ⬜ l.75-78 « 5. Trappings » — candidat trou de règle, 0 réf
  - ⬜ l.79-82 « 6. Status » — candidat trou de règle, 0 réf
  - ⬜ l.83-100 « ADVISER » — candidat trou de règle, 0 réf
  - ⬜ l.101-140 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.141-170 « AGITATOR » — candidat trou de règle, 0 réf
  - ⬜ l.171-204 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.205-230 « APOTHECARY » — candidat trou de règle, 0 réf
  - ⬜ l.231-264 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.265-278 « ARTISAN » — candidat trou de règle, 0 réf
  - ⬜ l.279-288 « A MULTITUDE OF TRADES » — candidat trou de règle, 0 réf
  - ⬜ l.289-322 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.323-344 « ARTIST » — candidat trou de règle, 0 réf
  - ⬜ l.345-378 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.379-406 « BAILIFF » — candidat trou de règle, 0 réf
  - ⬜ l.407-440 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.441-462 « BEGGAR » — candidat trou de règle, 0 réf
  - ⬜ l.463-472 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.473-488 « Beggar — Brass 1 » — candidat trou de règle, 0 réf
  - ⬜ l.489-502 « Beggar King — Silver 2 » — candidat trou de règle, 0 réf
  - ⬜ l.503-526 « BOATMAN » — candidat trou de règle, 0 réf
  - ⬜ l.527-532 « BOATMAN ADVANCE SCHEME » — candidat trou de règle, 0 réf
  - ⬜ l.533-566 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.567-596 « BOUNTY HUNTER » — candidat trou de règle, 0 réf
  - ⬜ l.597-630 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.631-656 « CAVALRYMAN » — candidat trou de règle, 0 réf
  - ⬜ l.657-708 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.709-748 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.749-774 « COACHMAN » — candidat trou de règle, 0 réf
  - ⬜ l.775-834 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.835-870 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.871-894 « ENGINEER » — candidat trou de règle, 0 réf
  - ⬜ l.895-928 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.929-950 « ENTERTAINER » — candidat trou de règle, 0 réf
  - ⬜ l.951-984 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.985-1012 « ENVOY » — candidat trou de règle, 0 réf
  - ⬜ l.1013-1046 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1047-1074 « FENCE » — candidat trou de règle, 0 réf
  - ⬜ l.1075-1108 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1109-1132 « FLAGELLANT » — candidat trou de règle, 0 réf
  - ⬜ l.1133-1158 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1159-1166 « Prophet of Doom — Brass 0 » — candidat trou de règle, 0 réf
  - ⬜ l.1167-1194 « GRAVE ROBBER » — candidat trou de règle, 0 réf
  - ⬜ l.1195-1228 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1229-1254 « GUARD » — candidat trou de règle, 0 réf
  - ⬜ l.1255-1288 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1289-1308 « HEDGE WITCH » — candidat trou de règle, 0 réf
  - ⬜ l.1309-1318 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1319-1348 « Hedge Witch — Brass 4 » — candidat trou de règle, 0 réf
  - ⬜ l.1349-1370 « HERBALIST » — candidat trou de règle, 0 réf
  - ⬜ l.1371-1404 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1405-1428 « HUNTER » — candidat trou de règle, 0 réf
  - ⬜ l.1429-1462 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1463-1490 « INVESTIGATOR » — candidat trou de règle, 0 réf
  - ⬜ l.1491-1524 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1525-1550 « KNAVE » — candidat trou de règle, 0 réf
  - ⬜ l.1551-1584 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1585-1606 « KNIGHT » — candidat trou de règle, 0 réf
  - ⬜ l.1607-1640 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1641-1662 « LAWYER » — candidat trou de règle, 0 réf
  - ⬜ l.1663-1674 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1675-1704 « Lawyer — Silver 3 » — candidat trou de règle, 0 réf
  - ⬜ l.1705-1730 « MERCHANT » — candidat trou de règle, 0 réf
  - ⬜ l.1731-1764 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1765-1788 « MESSENGER » — candidat trou de règle, 0 réf
  - ⬜ l.1789-1822 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1823-1848 « MINER » — candidat trou de règle, 0 réf
  - ⬜ l.1849-1882 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1883-1910 « MYSTIC » — candidat trou de règle, 0 réf
  - ⬜ l.1911-1944 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.1945-1970 « NOBLE » — candidat trou de règle, 0 réf
  - ⬜ l.1971-2004 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2005-2030 « NUN » — candidat trou de règle, 0 réf
  - ⬜ l.2031-2064 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2065-2092 « OUTLAW » — candidat trou de règle, 0 réf
  - ⬜ l.2093-2126 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2127-2154 « PEDLAR » — candidat trou de règle, 0 réf
  - ⬜ l.2155-2188 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2189-2210 « PHYSICIAN » — candidat trou de règle, 0 réf
  - ⬜ l.2211-2244 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2245-2270 « PILOT » — candidat trou de règle, 0 réf
  - ⬜ l.2271-2272 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2273-2288 « Riverguide — Brass 4 » — candidat trou de règle, 0 réf
  - ⬜ l.2289-2304 « Navigator — Silver 3 » — candidat trou de règle, 0 réf
  - ⬜ l.2305-2332 « PIT FIGHTER » — candidat trou de règle, 0 réf
  - ⬜ l.2333-2366 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2367-2388 « PRIEST » — candidat trou de règle, 0 réf
  - ⬜ l.2389-2432 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2433-2460 « PROTAGONIST » — candidat trou de règle, 0 réf
  - ⬜ l.2461-2496 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2497-2520 « RACKETEER » — candidat trou de règle, 0 réf
  - ⬜ l.2521-2554 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2555-2580 « RAT CATCHER » — candidat trou de règle, 0 réf
  - ⬜ l.2581-2616 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2617-2642 « RIVERWARDEN » — candidat trou de règle, 0 réf
  - ⬜ l.2643-2676 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2677-2704 « RIVERWOMAN » — candidat trou de règle, 0 réf
  - ⬜ l.2705-2738 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2739-2764 « ROADWARDEN » — candidat trou de règle, 0 réf
  - ⬜ l.2765-2792 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2793-2800 « Road Captain — Gold 1 » — candidat trou de règle, 0 réf
  - ⬜ l.2801-2828 « SAILOR » — candidat trou de règle, 0 réf
  - ⬜ l.2829-2864 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2865-2892 « SCHOLAR » — candidat trou de règle, 0 réf
  - ⬜ l.2893-2910 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.2911-2926 « Fellow — Silver 5 » — candidat trou de règle, 0 réf
  - ⬜ l.2927-2954 « SCOUT » — candidat trou de règle, 0 réf
  - ⬜ l.2955-3020 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3021-3054 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3055-3084 « SLAYER » — candidat trou de règle, 0 réf
  - ⬜ l.3085-3094 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3095-3118 « Giant Slayer — Brass 2 » — candidat trou de règle, 0 réf
  - ⬜ l.3119-3146 « SMUGGLER » — candidat trou de règle, 0 réf
  - ⬜ l.3147-3166 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3167-3174 « Master Smuggler — Silver 5 » — candidat trou de règle, 0 réf
  - ⬜ l.3175-3182 « Smuggler King — Gold 3 » — candidat trou de règle, 0 réf
  - ⬜ l.3183-3206 « SOLDIER » — candidat trou de règle, 0 réf
  - ⬜ l.3207-3240 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3241-3262 « SPY » — candidat trou de règle, 0 réf
  - ⬜ l.3263-3280 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3281-3302 « Agent — Gold 1 » — candidat trou de règle, 0 réf
  - ⬜ l.3303-3330 « STEVEDORE » — candidat trou de règle, 0 réf
  - ⬜ l.3331-3366 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3367-3396 « THIEF » — candidat trou de règle, 0 réf
  - ⬜ l.3397-3430 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3431-3456 « TOWNSMAN » — candidat trou de règle, 0 réf
  - ⬜ l.3457-3490 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3491-3514 « VILLAGER » — candidat trou de règle, 0 réf
  - ⬜ l.3515-3552 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3553-3580 « WARDEN » — candidat trou de règle, 0 réf
  - ⬜ l.3581-3614 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3615-3638 « WARRIOR PRIEST » — candidat trou de règle, 0 réf
  - ⬜ l.3639-3666 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3667-3674 « Priest Captain — Gold 1 » — candidat trou de règle, 0 réf
  - ⬜ l.3675-3702 « WATCHMAN » — candidat trou de règle, 0 réf
  - ⬜ l.3703-3728 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3729-3736 « Watch Captain — Gold 1 » — candidat trou de règle, 0 réf
  - ⬜ l.3737-3762 « WITCH » — candidat trou de règle, 0 réf
  - ⬜ l.3763-3796 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3797-3822 « WITCH HUNTER » — candidat trou de règle, 0 réf
  - ⬜ l.3823-3856 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3857-3882 « WIZARD » — candidat trou de règle, 0 réf
  - ⬜ l.3883-3916 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3917-3940 « WRECKER » — candidat trou de règle, 0 réf
  - ⬜ l.3941-3966 « Career Path » — candidat trou de règle, 0 réf
  - ⬜ l.3967-3974 « Wrecker Captain — Silver 5 » — candidat trou de règle, 0 réf
- **CRB 020** (Skills) :
  - ⬜ l.57-60 « Animal Care (Int) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.61-66 « Animal Training (Int) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.73-76 « Athletics (Ag) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.77-80 « Bribery (Fel) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.81-86 « Channelling (WP) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.87-90 « Charm (Fel) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.91-94 « Charm Animal (WP) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.95-98 « Climb (S) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.99-102 « Consume Alcohol (T) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.103-106 « Cool (WP) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.107-110 « Dodge (Ag) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.111-114 « Drive (Ag) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.115-118 « Endurance (T) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.119-122 « Entertain (Fel) *basic, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.123-126 « Evaluate (Int) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.127-130 « Gamble (Int) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.131-134 « Gossip (Fel) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.135-138 « Haggle (Fel) basic » — candidat trou de règle, 0 réf
  - ⬜ l.139-142 « Heal (Int) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.143-146 « Intimidate (S) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.147-150 « Intuition (I) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.151-156 « Language (Int) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.157-160 « Leadership (Fel) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.161-166 « Lore (Int) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.167-172 « Melee (WS) *basic, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.173-176 « Navigation (I) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.177-180 « Outdoor Survival (Int) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.185-190 « Perform (Ag) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.191-194 « Pick Lock (Dex) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.195-198 « Play (Dex) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.199-210 « THE OLD WORLD'S A STAGE… » — candidat trou de règle, 0 réf
  - ⬜ l.211-214 « Pray (Fel) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.215-220 « Ranged (BS) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.221-224 « Research (Int) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.225-228 « Ride (Ag) *basic, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.229-232 « Row (S) *basic* » — candidat trou de règle, 0 réf
  - ⬜ l.233-236 « Sail (Ag) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.237-240 « LOCAL LORES » — candidat trou de règle, 0 réf
  - ⬜ l.241-246 « Secret Signs (Int) *advanced, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.247-250 « Set Trap (Dex) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.251-254 « Sleight of Hand (Dex) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.255-260 « Stealth (Ag) *basic, grouped* » — candidat trou de règle, 0 réf
  - ⬜ l.261-264 « Swim (S) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.265-268 « Track (I) *advanced* » — candidat trou de règle, 0 réf
  - ⬜ l.269-274 « Trade (Dex) *advanced, grouped* » — candidat trou de règle, 0 réf
- **CRB 021** (Talents) :
  - ⬜ l.3-6 « TALENTS » — candidat trou de règle, 0 réf
  - ⬜ l.7-10 « Accurate Shot » — candidat trou de règle, 0 réf
  - ⬜ l.11-14 « Acute Sense (Sense) » — candidat trou de règle, 0 réf
  - ⬜ l.15-18 « Aethyric Attunement » — candidat trou de règle, 0 réf
  - ⬜ l.23-26 « Ambidextrous » — candidat trou de règle, 0 réf
  - ⬜ l.27-30 « Animal Affinity » — candidat trou de règle, 0 réf
  - ⬜ l.31-44 « Arcane Magic (Lore) » — candidat trou de règle, 0 réf
  - ⬜ l.49-52 « Artistic (Art) » — candidat trou de règle, 0 réf
  - ⬜ l.53-56 « Attractive » — candidat trou de règle, 0 réf
  - ⬜ l.57-60 « Battle Rage » — candidat trou de règle, 0 réf
  - ⬜ l.61-64 « Beat Blade » — candidat trou de règle, 0 réf
  - ⬜ l.65-68 « Beneath Notice » — candidat trou de règle, 0 réf
  - ⬜ l.69-72 « Berserk Charge » — candidat trou de règle, 0 réf
  - ⬜ l.73-76 « Blather » — candidat trou de règle, 0 réf
  - ⬜ l.77-82 « Bless (Deity) » — candidat trou de règle, 0 réf
  - ⬜ l.83-86 « Bookish » — candidat trou de règle, 0 réf
  - ⬜ l.87-90 « Break and Enter » — candidat trou de règle, 0 réf
  - ⬜ l.91-94 « Briber » — candidat trou de règle, 0 réf
  - ⬜ l.95-98 « Cardsharp » — candidat trou de règle, 0 réf
  - ⬜ l.99-106 « Careful Strike » — candidat trou de règle, 0 réf
  - ⬜ l.107-110 « Catfall » — candidat trou de règle, 0 réf
  - ⬜ l.111-114 « Cat-tongued » — candidat trou de règle, 0 réf
  - ⬜ l.115-130 « Chaos Magic (Lore) » — candidat trou de règle, 0 réf
  - ⬜ l.135-138 « Combat Master » — candidat trou de règle, 0 réf
  - ⬜ l.139-142 « Combat Reflexes » — candidat trou de règle, 0 réf
  - ⬜ l.143-146 « Commanding Presence » — candidat trou de règle, 0 réf
  - ⬜ l.147-150 « Concoct » — candidat trou de règle, 0 réf
  - ⬜ l.151-154 « Contortionist » — candidat trou de règle, 0 réf
  - ⬜ l.155-158 « Coolheaded » — candidat trou de règle, 0 réf
  - ⬜ l.159-162 « Crack the Whip » — candidat trou de règle, 0 réf
  - ⬜ l.163-166 « Craftsman (Trade) » — candidat trou de règle, 0 réf
  - ⬜ l.167-172 « Criminal » — candidat trou de règle, 0 réf
  - ⬜ l.173-176 « Deadeye Shot » — candidat trou de règle, 0 réf
  - ⬜ l.177-180 « Dealmaker » — candidat trou de règle, 0 réf
  - ⬜ l.181-184 « Detect Artefact » — candidat trou de règle, 0 réf
  - ⬜ l.185-188 « Dicer » — candidat trou de règle, 0 réf
  - ⬜ l.189-192 « Dirty Fighting » — candidat trou de règle, 0 réf
  - ⬜ l.193-196 « Disarm » — candidat trou de règle, 0 réf
  - ⬜ l.197-200 « Distract » — candidat trou de règle, 0 réf
  - ⬜ l.226-229 « Drilled » — candidat trou de règle, 0 réf
  - ⬜ l.230-233 « Dual Wielder » — candidat trou de règle, 0 réf
  - ⬜ l.234-239 « Embezzle » — candidat trou de règle, 0 réf
  - ⬜ l.240-243 « Enclosed Fighter » — candidat trou de règle, 0 réf
  - ⬜ l.244-247 « Etiquette (Social Group) » — candidat trou de règle, 0 réf
  - ⬜ l.248-255 « Fast Hands » — candidat trou de règle, 0 réf
  - ⬜ l.256-259 « Fearless (Enemy) » — candidat trou de règle, 0 réf
  - ⬜ l.260-263 « Feint » — candidat trou de règle, 0 réf
  - ⬜ l.264-267 « Field Dressing » — candidat trou de règle, 0 réf
  - ⬜ l.268-271 « Fisherman » — candidat trou de règle, 0 réf
  - ⬜ l.272-275 « Flagellant » — candidat trou de règle, 0 réf
  - ⬜ l.276-279 « Flee! » — candidat trou de règle, 0 réf
  - ⬜ l.280-283 « Fleet-footed » — candidat trou de règle, 0 réf
  - ⬜ l.284-287 « Frenzy » — candidat trou de règle, 0 réf
  - ⬜ l.288-291 « Frightening » — candidat trou de règle, 0 réf
  - ⬜ l.292-295 « Furious Assault » — candidat trou de règle, 0 réf
  - ⬜ l.296-299 « Gregarious » — candidat trou de règle, 0 réf
  - ⬜ l.300-303 « Gunner » — candidat trou de règle, 0 réf
  - ⬜ l.304-307 « Hardy » — candidat trou de règle, 0 réf
  - ⬜ l.314-317 « Holy Hatred » — candidat trou de règle, 0 réf
  - ⬜ l.318-321 « Holy Visions » — candidat trou de règle, 0 réf
  - ⬜ l.322-345 « Hunter's Eye » — candidat trou de règle, 0 réf
- **CRB 028** (Flattery, Bribery, and Status) :
  - ⬜ l.86-259 « Making Friends (and Enemies) » — candidat trou de règle, 0 réf
  - ⬜ l.260-269 « Mistaken Identity » — candidat trou de règle, 0 réf
- **CRB 029** (Nosing Around) :
  - ⬜ l.203-208 « Tracking » — candidat trou de règle, 0 réf
- **CRB 035** (Moving in Combat) :
  - ⬜ l.43-58 « Disengaging » — candidat trou de règle, 0 réf
- **CRB 038** (Injury, Healing, and Death) :
  - ⬜ l.204-299 « Broken Bones » — candidat trou de règle, 0 réf
- **CRB 039** (Disease and Infection) :
  - ⬜ l.81-170 « Itching Pox » — candidat trou de règle, 0 réf
  - ⬜ l.171-216 « Infection » — candidat trou de règle, 0 réf
- **CRB 041** (Psychology) :
  - ⬜ l.27-34 « Frenzy » — candidat trou de règle, 0 réf
  - ⬜ l.35-46 « Hatred (Target) » — candidat trou de règle, 0 réf
- **CRB 043** (Corruption and Mutation) :
  - ⬜ l.61-142 « Manifestation Time » — candidat trou de règle, 0 réf
- **CRB 048** (Endeavours) :
  - ⬜ l.27-69 « Elves and Yenlui » — candidat trou de règle, 0 réf
  - ⬜ l.214-227 « Training » — candidat trou de règle, 0 réf
- **CRB 050** (Gods of the Empire) :
  - ⬜ l.37-40 « The Chaos Gods » — candidat trou de règle, 0 réf
- **CRB 053** (The Cult of Morr, God of Death) :
  - ⬜ l.23-42 « Worshippers » — candidat trou de règle, 0 réf
- **CRB 054** (The Cult of Myrmidia, Goddess of Strategy) :
  - ⬜ l.33-48 « Penances » — candidat trou de règle, 0 réf
- **CRB 055** (The Cult of Ranald, God of Trickery) :
  - ⬜ l.21-42 « Worshippers » — candidat trou de règle, 0 réf
- **CRB 058** (The Cult of Sigmar, God of the Empire) :
  - ⬜ l.23-28 « Worshippers » — candidat trou de règle, 0 réf
  - ⬜ l.29-32 « Holy Sites » — candidat trou de règle, 0 réf
  - ⬜ l.33-36 « Penances » — candidat trou de règle, 0 réf
  - ⬜ l.37-44 « Strictures » — candidat trou de règle, 0 réf
- **CRB 060** (The Cult of Ulric, God of Wolves, War, and Winter) :
  - ⬜ l.19-42 « Worshippers » — candidat trou de règle, 0 réf
- **CRB 063** (Halfling Gods) :
  - ⬜ l.11-36 « CHIEF GODS OF DWARFS, ELVES, AND HALFLINGS » — candidat trou de règle, 0 réf
- **CRB 065** (Prayers) :
  - ⬜ l.75-86 « DIVINE SERVANTS » — candidat trou de règle, 0 réf
- **CRB 066** (Blessings) :
  - ⬜ l.7-46 « PRAYER FORMAT » — candidat trou de règle, 0 réf
  - ⬜ l.47-62 « Blessing of Battle » — candidat trou de règle, 0 réf
  - ⬜ l.63-78 « Blessing of Charisma » — candidat trou de règle, 0 réf
  - ⬜ l.79-94 « Blessing of Courage » — candidat trou de règle, 0 réf
  - ⬜ l.145-166 « Blessing of Protection » — candidat trou de règle, 0 réf
  - ⬜ l.167-184 « Blessing of Savagery » — candidat trou de règle, 0 réf
  - ⬜ l.185-208 « Blessing of Wisdom » — candidat trou de règle, 0 réf
- **CRB 067** (Miracles) :
  - ⬜ l.17-86 « Becalm » — candidat trou de règle, 0 réf
  - ⬜ l.87-94 « Last Rites » — candidat trou de règle, 0 réf
  - ⬜ l.95-110 « Portal's Threshold » — candidat trou de règle, 0 réf
  - ⬜ l.111-122 « Blazing Sun » — candidat trou de règle, 0 réf
  - ⬜ l.123-154 « Fury's Call » — candidat trou de règle, 0 réf
  - ⬜ l.155-162 « An Invitation » — candidat trou de règle, 0 réf
  - ⬜ l.163-168 « Cat's Eyes » — candidat trou de règle, 0 réf
  - ⬜ l.177-222 « Ranald's Grace » — candidat trou de règle, 0 réf
  - ⬜ l.223-251 « Rhya's Shelter » — candidat trou de règle, 0 réf
  - ⬜ l.252-269 « Rhya's Union » — candidat trou de règle, 0 réf
  - ⬜ l.270-289 « Balm to a Wounded Mind » — candidat trou de règle, 0 réf
  - ⬜ l.290-341 « Shallya's Tears » — candidat trou de règle, 0 réf
  - ⬜ l.342-379 « Twin-tailed Comet » — candidat trou de règle, 0 réf
  - ⬜ l.380-385 « Lord of the Hunt » — candidat trou de règle, 0 réf
  - ⬜ l.386-403 « Tanglefoot » — candidat trou de règle, 0 réf
  - ⬜ l.424-451 « The Snow King's Judgement » — candidat trou de règle, 0 réf
  - ⬜ l.452-473 « Blind Justice » — candidat trou de règle, 0 réf
  - ⬜ l.474-489 « Truth Will Out » — candidat trou de règle, 0 réf
- **CRB 069** (The Aethyr) :
  - ⬜ l.19-32 « What Is the Aethyr? » — candidat trou de règle, 0 réf
  - ⬜ l.33-56 « The Lore of Light » — candidat trou de règle, 0 réf
  - ⬜ l.57-68 « The Lore of Shadows » — candidat trou de règle, 0 réf
  - ⬜ l.69-92 « The Lore of Fire » — candidat trou de règle, 0 réf
  - ⬜ l.93-114 « Warpstone » — candidat trou de règle, 0 réf
- **CRB 070** (Magic Rules) :
  - ⬜ l.11-20 « Critical Casting » — candidat trou de règle, 0 réf
  - ⬜ l.21-24 « Fumbled Casting » — candidat trou de règle, 0 réf
  - ⬜ l.25-28 « Duration » — candidat trou de règle, 0 réf
  - ⬜ l.29-32 « Magic Missiles » — candidat trou de règle, 0 réf
  - ⬜ l.39-46 « Ingredients » — candidat trou de règle, 0 réf
  - ⬜ l.115-118 « Memorising Spells » — candidat trou de règle, 0 réf
- **CRB 071** (Colour Magic) :
  - ⬜ l.380-572 « Blinding Light » — candidat trou de règle, 0 réf
- **CRB 076** (Running the Game) :
  - ⬜ l.148-230 « Roads & Rivers » — candidat trou de règle, 0 réf
- **CRB 078** (The Lie of the Land) :
  - ⬜ l.15-54 « The Grey Mountains » — candidat trou de règle, 0 réf
  - ⬜ l.55-192 « The Vorbergland » — candidat trou de règle, 0 réf
- **CRB 079** (The Powers That Be) :
  - ⬜ l.227-292 « 1053–1115 IC » — candidat trou de règle, 0 réf
  - ⬜ l.293-308 « 2135 IC » — candidat trou de règle, 0 réf
  - ⬜ l.309-354 « 2308–2310 IC » — candidat trou de règle, 0 réf
  - ⬜ l.355-358 « 2508 IC » — candidat trou de règle, 0 réf
- **CRB 083** (Going to Market) :
  - ⬜ l.7-56 « Availability » — candidat trou de règle, 0 réf
- **CRB 085** (Encumbrance) :
  - ⬜ l.49-52 « Encumbrance and Travel Fatigue » — candidat trou de règle, 0 réf
- **CRB 103** (Creature Hit Locations) :
  - ⬜ l.21-30 « BESTIARY FORMAT » — candidat trou de règle, 0 réf
- **CRB 104** (The Peoples of the Reikland) :
  - ⬜ l.153-176 « Skills » — candidat trou de règle, 0 réf
  - ⬜ l.177-232 « HUMAN MERCHANT » — candidat trou de règle, 0 réf
  - ⬜ l.233-370 « Skills » — candidat trou de règle, 0 réf
  - ⬜ l.371-374 « HALFLINGS AND OGRES » — candidat trou de règle, 0 réf
- **CRB 106** (The Monstrous Beasts of the Reikland) :
  - ⬜ l.190-352 « Armour » — candidat trou de règle, 0 réf
  - ⬜ l.353-402 « TROLL TYPES » — candidat trou de règle, 0 réf
- **CRB 108** (The Restless Dead) :
  - ⬜ l.101-286 « UNQUIET DEAD » — candidat trou de règle, 0 réf
  - ⬜ l.287-416 « TOMB BANSHEE » — candidat trou de règle, 0 réf
- **CRB 109** (Beastmen, the Children of Chaos) :
  - ⬜ l.53-138 « UNGOR » — candidat trou de règle, 0 réf
- **CRB 110** (Cultists, the Lost and the Damned) :
  - ⬜ l.40-67 « Optional Traits » — candidat trou de règle, 0 réf
  - ⬜ l.68-111 « Optional Traits » — candidat trou de règle, 0 réf
- **CRB 111** (Daemons, the Gibbering Hosts) :
  - ⬜ l.9-104 « BLOODLETTER OF KHORNE » — candidat trou de règle, 0 réf
- **CRB 112** (The Loathsome Ratmen) :
  - ⬜ l.19-60 « CLANRAT » — candidat trou de règle, 0 réf
  - ⬜ l.61-136 « STORMVERMIN » — candidat trou de règle, 0 réf
- **CRB 113** (Creature Templates) :
  - ⬜ l.103-146 « SPELLCASTER » — candidat trou de règle, 0 réf
- **CRB 115** (Creature Traits) :
  - ⬜ l.9-12 « Amphibious » — candidat trou de règle, 0 réf
  - ⬜ l.13-16 « Animosity (Target) » — candidat trou de règle, 0 réf
  - ⬜ l.17-20 « Belligerent » — candidat trou de règle, 0 réf
  - ⬜ l.21-30 « Bestial » — candidat trou de règle, 0 réf
  - ⬜ l.31-34 « Blessed (Deity) » — candidat trou de règle, 0 réf
  - ⬜ l.35-38 « Bounce » — candidat trou de règle, 0 réf
  - ⬜ l.39-51 « Breath » — candidat trou de règle, 0 réf
  - ⬜ l.52-55 « Champion » — candidat trou de règle, 0 réf
  - ⬜ l.56-59 « Chill Grasp » — candidat trou de règle, 0 réf
  - ⬜ l.60-63 « Cold-blooded » — candidat trou de règle, 0 réf
  - ⬜ l.64-67 « Constrictor » — candidat trou de règle, 0 réf
  - ⬜ l.68-71 « Construct » — candidat trou de règle, 0 réf
  - ⬜ l.72-75 « Corrosive Blood » — candidat trou de règle, 0 réf
  - ⬜ l.84-89 « Daemonic (Rating) » — candidat trou de règle, 0 réf
  - ⬜ l.90-93 « Disease (Type) » — candidat trou de règle, 0 réf
  - ⬜ l.94-97 « Distracting » — candidat trou de règle, 0 réf
  - ⬜ l.98-105 « Ethereal » — candidat trou de règle, 0 réf
  - ⬜ l.106-111 « Fly (Rating) » — candidat trou de règle, 0 réf
  - ⬜ l.112-115 « Frenzy » — candidat trou de règle, 0 réf
  - ⬜ l.116-119 « Ghostly Howl » — candidat trou de règle, 0 réf
  - ⬜ l.120-123 « Grim » — candidat trou de règle, 0 réf
  - ⬜ l.124-127 « Hatred (Target) » — candidat trou de règle, 0 réf
  - ⬜ l.128-131 « Horns » — candidat trou de règle, 0 réf
  - ⬜ l.132-135 « Hungry » — candidat trou de règle, 0 réf
  - ⬜ l.136-139 « Immune to Psychology » — candidat trou de règle, 0 réf
  - ⬜ l.140-143 « Immunity (Type) » — candidat trou de règle, 0 réf
  - ⬜ l.144-147 « Infected » — candidat trou de règle, 0 réf
  - ⬜ l.148-151 « Infestation » — candidat trou de règle, 0 réf
  - ⬜ l.152-167 « Many Heads (Number) » — candidat trou de règle, 0 réf
  - ⬜ l.168-171 « Magical » — candidat trou de règle, 0 réf
  - ⬜ l.172-175 « Magic Resistance » — candidat trou de règle, 0 réf
  - ⬜ l.176-183 « Mental Corruption » — candidat trou de règle, 0 réf
  - ⬜ l.184-187 « Mutation » — candidat trou de règle, 0 réf
  - ⬜ l.192-195 « Painless » — candidat trou de règle, 0 réf
  - ⬜ l.196-199 « Petrifying Gaze » — candidat trou de règle, 0 réf
  - ⬜ l.200-203 « Regeneration » — candidat trou de règle, 0 réf
  - ⬜ l.204-273 « Size (Various) » — candidat trou de règle, 0 réf
  - ⬜ l.274-277 « Skittish » — candidat trou de règle, 0 réf
  - ⬜ l.278-281 « Spellcaster (Various) » — candidat trou de règle, 0 réf
  - ⬜ l.282-285 « Sprinter » — candidat trou de règle, 0 réf
  - ⬜ l.286-289 « Stealthy » — candidat trou de règle, 0 réf
  - ⬜ l.290-313 « Striding Gait (Terrain) » — candidat trou de règle, 0 réf
  - ⬜ l.314-317 « # Tentacles » — candidat trou de règle, 0 réf
  - ⬜ l.318-363 « Territorial » — candidat trou de règle, 0 réf
  - ⬜ l.364-371 « Vampiric » — candidat trou de règle, 0 réf
  - ⬜ l.372-379 « Vomit » — candidat trou de règle, 0 réf
  - ⬜ l.380-387 « Wallcrawler » — candidat trou de règle, 0 réf
- **CRB 119** (Appendix IV) :
  - ⬜ l.67-92 « Prone (page 186) » — candidat trou de règle, 0 réf

## AA — ✅ 9 · 📖 4 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | CREDITS | 📖 | 1 (4e/combat.md ×1) |
| 02 | INTRODUCTION | 📖 | 2 (4e/competences.md ×2) |
| 03 | LES CHEVALIERS DE L'EMPIRE | ✅ | 3 (4e/competences.md ×3) |
| 04 | LES CHIENS DE GUERRE | 📖 | catalogue (catalogue-*.md) |
| 05 | LA TILEE ET LES PERSONNAGES TILEENS | 📖 | 1 (4e/competences.md ×1) |
| 06 | LE CULTE DE MYRMIDIA | ✅ | 25 (4e/combat.md ×24) |
| 07 | MISES A JOUR DE L'ETAT HEMORRAGIQUE | ✅ | 46 (4e/combat.md ×41) |
| 08 | LA RESERVE DE L'INTENDANT | ✅ | 101 (4e/combat.md ×100) |
| 09 | LE COMBAT MONTE | ✅ | 24 (4e/combat.md ×23) |
| 10 | L'ARTILLERIE ET LES DEGATS INFLIGES AUX STRUCTURES | ✅ | 97 (4e/combat.md ×92) |
| 11 | ANNEXE I AVANTAGES DE GROUPE | ✅ | 12 (4e/combat.md ×12) |
| 12 | ANNEXE II ACTIVITES DE GUERRIER | ✅ | 21 (4e/combat.md ×20) |
| 13 | ANNEXE III NOUVEAUX TALENTS ET TALENTS MIS A JOUR | ✅ | 17 (4e/combat.md ×17) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H2) :

- **AA 01** (CREDITS) :
  - 📖 l.34-65 « SOMMAIRE » — transcrit en catalogue, jamais traité, 0 réf
- **AA 02** (INTRODUCTION) :
  - 🔻 enfoui l.26-666 « DES SOLDATS EN TOUT GENRE » — titre orné rétrogradé par l'extraction, 2 réf
  - ➖ l.5-12 « AUX ARMES ! » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.13-25 « En garde ! » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
- **AA 03** (LES CHEVALIERS DE L'EMPIRE) :
  - 📖 l.7-12 « DES CONFRÉRIES TRIÉES SUR LE VOLET » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.13-22 « Histoire » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.23-33 « Les ordres » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.34-41 « Les chevaliers dans la société » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.42-120 « DEVENIR CHEVALIER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.121-128 « Les chevaliers comme aventuriers » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.129-190 « Les Possessions d'un chevalier » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.191-239 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.300-317 « CHEVALIER DU SOLEIL FLAMBOYANT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.398-423 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.441-466 « UNE MAUVAISE SURPRISE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.467-485 « Notes de réflexion sur un harnois médiocre des umgi » — transcrit en catalogue, jamais traité, 0 réf
- **AA 04** (LES CHIENS DE GUERRE) :
  - 📖 l.13-23 « Les mercenaires » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.24-33 « LE PAYS DES MERCENAIRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.34-54 « Origines » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.55-83 « Le rôle des mercenaires » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.84-112 « Embaucher des mercenaires » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.113-185 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.186-254 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.255-268 « SPÉCIALISTE DE SIÈGE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.269-338 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
- **AA 05** (LA TILEE ET LES PERSONNAGES TILEENS) :
  - 📖 l.5-29 « LA TILÉE, SES TERRES ET SON PEUPLE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.30-93 « INDEX GÉOGRAPHIQUE DE TILÉE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.94-103 « TABLEAU DES PRIX DE BASE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.104-113 « LES MERCENAIRES TILÉENS DANS L'EMPIRE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.114-117 « CRÉER DES PERSONNAGES TILÉENS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.129-132 « LA DESTINÉE EN TILÉE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.133-154 « Carrières » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.155-166 « CHRONOLOGIE DE LA TILÉE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.167-190 « Âge archaïque » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.191-206 « Âge sombre tiléen » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.207-233 « Ère des guerres d'Arabie » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.234-411 « Âge de l'exploration » — transcrit en catalogue, jamais traité, 0 réf
- **AA 06** (LE CULTE DE MYRMIDIA) :
  - 🔻 enfoui l.554-559 « UNE APPROCHE ALTERNATIVE DES BLESSURES » — titre orné rétrogradé par l'extraction, 2 réf
  - 📖 l.7-27 « UNE FOI EN GUERRE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.28-35 « Fondation du culte » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.36-64 « La tradition tiléenne » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.65-80 « La tradition estalienne » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.81-89 « Le point de vue d'une personne extérieure » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.90-112 « Le culte dans l'Empire » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.113-183 « FIGURES IMPORTANTES DU CULTE MYRMIDÉEN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.184-201 « CROYANCES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.202-210 « UNE FAMILLE SAINTE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.211-228 « COMMANDEMENTS DE MYRMIDIA » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.229-239 « Obéir <sup>à</sup> tous les ordres honorables » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.240-249 « SUPERSTITIONS DU CULTE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.250-253 « RELATIONS AVEC LES AUTRES CULTES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.254-261 « Myrmidia et Ulric » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.262-268 « Myrmidia et Sigmar » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.269-274 « Myrmidia et Handrich » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.275-281 « Myrmidia et Ranald » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.282-287 « Myrmidia et Solkan » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.288-301 « LES ADORATEURS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.302-310 « L'initiation » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.311-320 « L'Ordre de l'Aigle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.321-333 « L'Ordre de la Lance Vertueuse » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.334-351 « Les ordres mineurs de Myrmidia » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.352-372 « Les zélotes de Myrmidia » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.373-399 « Les temples » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.400-431 « Les reliques sacrées » — transcrit en catalogue, jamais traité, 0 réf
- **AA 07** (MISES A JOUR DE L'ETAT HEMORRAGIQUE) :
  - 📖 l.13-16 « BLESSURES, BLESSURES CRITIQUES ET MORT » — transcrit en catalogue, jamais traité, 0 réf
- **AA 08** (LA RESERVE DE L'INTENDANT) :
  - 📖 l.63-66 « OPTIONS D'ARME » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.392-401 « LES ARMES À POUDRE À CANON » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.402-407 « Les modèles affinés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.408-413 « Les innovations ultérieures » — transcrit en catalogue, jamais traité, 0 réf
- **AA 09** (LE COMBAT MONTE) :
  - 🔻 enfoui l.191-502 « LES INTÉRIMAIRES DE L'AVENTURE » — titre orné rétrogradé par l'extraction, 1 réf
  - 📖 l.108-111 « MA PROVINCE POUR UN CHEVAL ! » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.138-141 « LES MONTURES EXOTIQUES » — transcrit en catalogue, jamais traité, 0 réf
- **AA 10** (L'ARTILLERIE ET LES DEGATS INFLIGES AUX STRUCTURES) :
  - 🔻 enfoui l.280-435 « LA POURSUITE DE L'EXCELLENCE » — titre orné rétrogradé par l'extraction, 21 réf
- **AA 13** (ANNEXE III NOUVEAUX TALENTS ET TALENTS MIS A JOUR) :
  - 📖 l.101-344 « INDEX » — transcrit en catalogue, jamais traité, 0 réf

## VDM — ✅ 4 · 📖 10 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | Contes de sorcellerie | ➖ hors-règle | histoire de la magie (cadre, prose pure) ; ch.15 némésis = PNJ nommés STATBLOCKÉS → catalogue-creatures (comme PDT) ; 2-14 = règles/data |
| 02 | Revisions des regles d'incantation | ✅ | 61 (4e/magie.md ×61) |
| 03 | Travaux arcaniques | ✅ | 128 (4e/competences.md ×76) |
| 04 | Hysh - Domaine de la Lumiere | 📖 | catalogue (catalogue-*.md) |
| 05 | Chamon - Domaine du Metal | 📖 | catalogue (catalogue-*.md) |
| 06 | Ghyran - Domaine de la Vie | 📖 | catalogue (catalogue-*.md) |
| 07 | Azyr - Domaine des Cieux | 📖 | catalogue (catalogue-*.md) |
| 08 | Ulgu - Domaine des Ombres | 📖 | catalogue (catalogue-*.md) |
| 09 | Shyish - Domaine de la Mort | 📖 | catalogue (catalogue-*.md) |
| 10 | Aqshy - Domaine du Feu | 📖 | catalogue (catalogue-*.md) |
| 11 | Ghur - Domaine de la Bete | 📖 | catalogue (catalogue-*.md) |
| 12 | Artefacts magiques | 📖 | catalogue (catalogue-*.md) |
| 13 | Creatures magiques | ✅ | 9 (4e/magie.md ×9) |
| 14 | Les Vents a l'oeuvre | ✅ | 24 (4e/magie.md ×24) |
| 15 | Nemesis et aventures magiques | 📖 | catalogue (catalogue-*.md) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H2) :

- **VDM 09** (Shyish - Domaine de la Mort) :
  - 📖 l.375-536 « Le Labyrinthe de Cristal » — transcrit en catalogue, jamais traité, 0 réf

## ADE I — ✅ 0 · 📖 2 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | LES GRANDES PROVINCES | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 02 | CLANS HALFLING DU REIKLAND | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 03 | GUIDE DU GRAND COMTE DU MOOTLAND | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 04 | Les nains imperiaux | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 05 | Guide de Karak Azgaraz | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 06 | Guide de la Laurelorn | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 07 | Annexe I | 📖 | 3 (4e/competences.md ×2) |
| 08 | Annexe II | 📖 | 2 (4e/carrieres.md ×1) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H2) :

- **ADE I 07** (Annexe I) :
  - 📖 l.3-6 « ANNEXE I • CARRIÈRES • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.7-12 « Chevaucheur de blaireau » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.13-16 « Gardechamps » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.17-20 « Patrouilleur des karak » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.93-143 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.144-184 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf

## ADE II — ✅ 3 · 📖 3 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | Mercenaires ogres dans le Vieux Monde | 📖 | catalogue (catalogue-*.md) |
| 02 | Les ogres | ✅ | 51 (4e/combat.md ×43) |
| 03 | Des signes dans le ciel | 📖 | catalogue (catalogue-*.md) |
| 04 | Un peu de magie | ✅ | 28 (4e/combat.md ×24) |
| 05 | L'hospice | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 06 | Le personnel | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 07 | Les patients | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 08 | Le theatre de la guerre | ✅ | 70 (4e/combat.md ×69) |
| 09 | Annexe I | 📖 | 1 (4e/activites.md ×1) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H2) :

- **ADE II 01** (Mercenaires ogres dans le Vieux Monde) :
  - 🔻 enfoui l.248-249 « VOUS REPRENDREZ BIEN UN MORCEAU ? PERSONNAGES JOUEURS OGRES » — titre orné rétrogradé par l'extraction, 0 réf
  - 📖 l.3-10 « MERCENAIRES OGRES DANS LE VIEUX MONDE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.11-25 « Buffet <sup>à</sup> volonté » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.26-34 « Des assiettes bien remplies » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.35-59 « UNE INDEMNISATION SAVOUREUSE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.60-137 « S'en mettre plein les joues » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.138-147 « De couteaux et d'épées » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.148-154 « LA LOI DU PLUS FORT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.155-174 « L'art sacré du combat de gladiateurs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.175-230 « Un foyer loin de chez soi » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.231-247 « Ugrik l'Égarée » — transcrit en catalogue, jamais traité, 0 réf
- **ADE II 02** (Les ogres) :
  - 📖 l.3-15 « LES OGRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.16-33 « Histoire des ogres » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.34-96 « Point de vue » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.97-103 « UN HÉRITAGE COMMUN ? » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.104-107 « PERSONNAGES OGRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.108-111 « Races » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.112-197 « TABLEAU DES RACES ALÉATOIRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.198-214 « OGRES EXPATRIÉS ET IMPÉRIAUX » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.215-238 « Attributs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.239-250 « Compétences et Talents » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.251-271 « NOUVEAUX TALENTS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.272-275 « Détails physiques » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.276-279 « Âge » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.280-324 « Couleur des yeux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.325-328 « Noms des ogres » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.329-336 « Générer des noms d'ogres » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.337-390 « Titres des ogres et noms de clan » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.391-442 « Insuffler la vie à votre ogre » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.443-481 « AVANCEMENT DES PERSONNAGES OGRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.482-483 « EXEMPLES DE PERSONNAGES OGRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.484-534 « Nazzaalta Affabule » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.535-550 « À L'ATTENTION DU MENEUR DE JEU » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.551-556 « Les ogres sont-ils surpuissants ? » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.592-599 « Un ogre entre dans un bar... » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.712-715 « Lanceurs de sorts ogres » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.823-836 « Rhinox » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.913-951 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.952-961 « BOUCHER OGRE Ogre » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.962-999 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
- **ADE II 03** (Des signes dans le ciel) :
  - 📖 l.3-29 « DES SIGNES DANS LE CIEL SIGNES ASTRAUX ET ASTROLOGIE • • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.30-69 « SIGNES ASTROLOGIQUES ET CRÉATION DE PERSONNAGE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.70-73 « LES SIGNES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.74-87 « Wymund l'Anachorète » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.88-118 « La Grande Croix » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.119-134 « Gnuthus le Buffle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.135-169 « Dragomas le Dragon » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.170-191 « Le Fourreau de Grungni » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.192-222 « Mammit le Sage » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.223-240 « Les Deux Bœufs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.241-275 « Le Danseur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.276-289 « Le Flûtiste » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.290-361 « Vobist le Pâle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.362-377 « Cackelfax le Coq » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.378-392 « La Scie à Os » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.393-408 « L'Étoile du Sorcier » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.409-410 « L'ASTROLOGIE DANS L'EMPIRE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.411-418 « Le Collège Céleste » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.419-429 « Astrologues » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.430-439 « Dans l'art » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.440-449 « Dans les classes sociales » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.450-489 « DE MAGISTER REGNAT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.490-529 « Étapes facultatives » — transcrit en catalogue, jamais traité, 0 réf
- **ADE II 04** (Un peu de magie) :
  - 🔻 enfoui l.508-521 « LE GRAND HOSPICE » — titre orné rétrogradé par l'extraction, 0 réf
  - ⬜ l.3-16 « UN PEU DE MAGIE OBJETS MAGIQUES ET ENCHANTEMENTS • • » — candidat trou de règle, 0 réf
  - ⬜ l.17-53 « Trouver un artefact magique » — candidat trou de règle, 0 réf
  - ⬜ l.54-72 « Commander un artefact magique » — candidat trou de règle, 0 réf
  - ⬜ l.102-117 « LE PRODUIT FINI » — candidat trou de règle, 0 réf
  - ⬜ l.118-134 « TABLEAU DE CRÉATURE ALÉATOIRE » — candidat trou de règle, 0 réf
  - ⬜ l.185-192 « Armes magiques » — candidat trou de règle, 0 réf
  - ⬜ l.289-355 « ENCHANTEMENTS TEMPORAIRES » — candidat trou de règle, 0 réf
  - ⬜ l.356-373 « ATOUTS D'ARMURE MAGIQUE » — candidat trou de règle, 0 réf
  - ⬜ l.374-397 « Boucliers magiques » — candidat trou de règle, 0 réf
  - ⬜ l.398-425 « Parchemins » — candidat trou de règle, 0 réf
  - ⬜ l.426-439 « Bâtons » — candidat trou de règle, 0 réf
  - ⬜ l.440-507 « Baguettes » — candidat trou de règle, 0 réf
- **ADE II 09** (Annexe I) :
  - 📖 l.3-6 « ANNEXE I TROUBLES PSYCHOLOGIQUES • • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.7-12 « Phobie du noir » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.13-16 « Animosité et Haine » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.17-24 « Trauma » — transcrit en catalogue, jamais traité, 0 réf

## MCLB — ✅ 0 · 📖 5 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | MIDDENHEIM | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 02 | Guide du visiteur | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 03 | Au-dela des murs | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 04 | Bestiaire | 📖 | catalogue (catalogue-*.md) |
| 05 | Le Grand-Duche | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 06 | Les Petits Rois | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 07 | Cultes du Chaos de Middenheim | 📖 | catalogue (catalogue-*.md) |
| 08 | ANNEXE I | 📖 | catalogue (catalogue-*.md) |
| 09 | ANNEXE II | 📖 | catalogue (catalogue-*.md) |
| 10 | ANNEXE III | 📖 | catalogue (catalogue-*.md) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **MCLB 04** (Bestiaire) :
  - 📖 l.3-4 « MIDDENHEIM • BESTIAIRE • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.5-13 « PRÉDATEUR SANGLANT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.14-34 « ENFANT D'ULRIC » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.35-45 « LA DESCENDANCE D'ULRIC » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.46-58 « SPECTRE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.59-75 « LOUP BLANC » — transcrit en catalogue, jamais traité, 0 réf
- **MCLB 07** (Cultes du Chaos de Middenheim) :
  - 📖 l.3-8 « MIDDENHEIM CULTES DU CHAOS • • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.9-12 « TZEENTCH » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.13-18 « La Main Pourpre » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.19-27 « Secteurs d'activité » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.28-39 « Le Cercle intérieur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.40-45 « La Couronne Rouge » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.46-82 « La hiérarchie du culte AVERHEIM ? WOLFENBURG ? » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.83-96 « Le plan de la Couronne Rouge » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.97-107 « L'Œil Errant » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.108-111 « KHORNE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.112-119 « Le Crâne Écarlate » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.120-123 « La hiérarchie du culte » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.124-127 « NURGLE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.128-135 « La Communauté Tinéenne » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.136-140 « RADIÉE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.141-156 « SLANEESH » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.157-160 « AUTRES ORGANISATIONS INTERDITES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.161-173 « Les Fils d'Ulric » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.174-183 « Porteurs du Sang » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.184-198 « Les Mangeurs du Monde » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.199-208 « Les Nouveaux Millénaristes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.209-221 « Le Serment de Volans » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.222-243 « « Magister » Hugo Vallonvert » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.244-264 « Beate Moser » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.265-281 « Le vieil Otto » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.282-300 « Brigitte Schleigel » — transcrit en catalogue, jamais traité, 0 réf
- **MCLB 08** (ANNEXE I) :
  - 📖 l.3-8 « ANNEXE I • MIDDENBALL • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.9-22 « JOUEURS DE MIDDENBALL » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.23-34 « ATHLÈTE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.35-48 « NAIN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.49-66 « RÈGLES CUSM » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.67-72 « Règles de base pour les matches rapides » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.73-81 « Règles avancées » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.82-85 « Le terrain » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.86-101 « Phase d'équipe » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.102-119 « LE TABLEAU D'ATHLÉTISME » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.120-131 « DÉTERMINATION DU JOUEUR » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.132-162 « LE TABLEAU DE BRUTALITÉ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.163-171 « Phase de mouvement » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.172-184 « COUP D'ENVOI » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.185-188 « JOUEURS LIBRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.189-203 « Phase d'action » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.204-207 « DÉFENSE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.208-215 « Mi-temps et prolongations » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.216-233 « ÉVÉNEMENTS ALÉATOIRES » — transcrit en catalogue, jamais traité, 0 réf
- **MCLB 09** (ANNEXE II) :
  - 📖 l.3-6 « ANNEXE II • CRÉATION DE PERSONNAGE • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.7-48 « ORIGINES, CARRIÈRES ET EXEMPLES DE PERSONNAGES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.49-60 « Classe et Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.61-104 « NOUVELLE RÈGLE : CARRIÈRES PLUS LONGUES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.105-122 « GERDON SALZWED » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.123-127 « C'EST TON DESTIN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.128-147 « HASSO SCHROETER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.148-164 « HUMAINS DE MIDDENHEIM » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.165-180 « KAT SPERBER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.181-189 « HUMAINS DU MIDDENLAND » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.190-207 « THERESIA KLEIST » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.208-230 « HUMAINS DU NORDLAND » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.231-236 « Schéma de Progression du Frère Loup » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.237-238 « Évolution de Carrière » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.239-248 « h Survivant – Bronze 0 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.249-260 « Frère Loup – Bronze 0 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.261-268 « Compagnon Loup – Bronze 0 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.269-280 « Grand Loup – Bronze 0 » — transcrit en catalogue, jamais traité, 0 réf
- **MCLB 10** (ANNEXE III) :
  - 📖 l.3-4 « ANNEXE III MIDDENHEIM ET LES ÉVÉNEMENTS FUTURS • • » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.5-14 « ATTENTION SPOILER ! » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.15-24 « Arrivée à Middenheim avant Le Pouvoir derrière le Trône » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.25-34 « Sur la piste de la Main Pourpre » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.35-43 « Sur la piste de Gotthard von Wittgenstein » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.44-53 « Changements après Le Pouvoir derrière le Trône » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.54-59 « Une nouvelle manifestation de Babrakkos » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.60-72 « Mettre les Personnages sur l'affaire » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.73-80 « Babrakkos – Liche » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.81-86 « Une véritable mort pour Babrakkos » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.87-100 « BABRAKKOS - LICHE PESTILENTIELLE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.101-104 « La Querelle de Khazrak » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.105-108 « 2516-2517 CI » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.109-112 « 2518 CI » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.113-116 « 2519 CI » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.117-376 « Le rôle de la Couronne Rouge » — transcrit en catalogue, jamais traité, 0 réf

## ACE — ✅ 1 · 📖 2 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | La Couronne de l'Empire | ➖ hors-règle | |
| 02 | Le gouvernement d'Altdorf | ➖ hors-règle | |
| 03 | Les gangs d'Altdorf | ➖ hors-règle | |
| 04 | La Grande Puanteur | ➖ hors-règle | |
| 05 | La rive sud | ➖ hors-règle | |
| 06 | Le Quartier est | ➖ hors-règle | |
| 07 | La Ville Nord | ➖ hors-règle | |
| 08 | La Cite souterraine | ➖ hors-règle | |
| 09 | Au-dela des murs | ➖ hors-règle | |
| 10 | L'Espionnage a Altdorf | 📖 | catalogue (catalogue-*.md) |
| 11 | Cultes interdits et groupes extremistes | 📖 | catalogue (catalogue-*.md) |
| 12 | Activites | ✅ | 17 (4e/activites.md ×17) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **ACE 10** (L'Espionnage a Altdorf) :
  - 📖 l.27-32 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.33-39 « Préoccupations Actuelles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.40-52 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.53-58 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.59-64 « Préoccupations Actuelles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.65-68 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.69-72 « La Bannière Secrète » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.73-77 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.78-83 « Préoccupations Actuelles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.84-87 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.88-91 « Les yeux de l'Empereur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.92-96 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.97-101 « Préoccupations Actuelles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.102-109 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.110-115 « Les Gardiens Gris » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.116-122 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.123-128 « Préoccupations Actuelles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.129-134 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.135-138 « Les Todbringer » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.139-144 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.145-150 « Préoccupations Actuelles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.151-154 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.155-158 « Autres provinces » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.159-162 « Les Frères à la cape » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.163-166 « Réseaux et espions privés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.167-189 « ESPIONS RELIGIEUX » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.190-194 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.195-202 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.203-208 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.209-216 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.217-221 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.222-230 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.231-236 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.237-245 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.246-251 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.252-261 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.262-267 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.268-271 « Personnalités clés » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.272-277 « Utiliser les espions d'Altdorf dans une aventure » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.278-281 « La cape et la dague empoisonnée » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.282-285 « La morale est le luxe de ceux qui n'ont aucun pouvoir » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.286-289 « Une toile ne peut jamais être trop emmêlée » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.290-295 « Les complots font naître d'étranges tandems » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.296-299 « EXEMPLE D'AVENTURE » — transcrit en catalogue, jamais traité, 0 réf
- **ACE 11** (Cultes interdits et groupes extremistes) :
  - 📖 l.27-52 « UN TIENS VAUT MIEUX QUE DEUX TU L'AURAS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.53-83 « TENTEZ VOTRE CHANCE ! » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.84-97 « KATARINA BRIESACH - CHAMPION DU CHAOS MUTANT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.98-146 « BOUTON BRÛLANT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.147-163 « Gridli Ahlquist, Cultiste » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.164-174 « SORTS » — transcrit en catalogue, jamais traité, 0 réf
- **ACE 12** (Activites) :
  - 📖 l.165-206 « F » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.207-343 « H Haffenstadt..............................................194 » — transcrit en catalogue, jamais traité, 0 réf

## ZI — ✅ 4 · 📖 10 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | TROIS EXPEDITIONS | ✅ | 3 (4e/combat.md ×3) |
| 02 | Griffon | ✅ | 8 (4e/combat.md ×5) |
| 03 | Dragon | 📖 | catalogue (catalogue-*.md) |
| 04 | L'abominable Halagrundsor | 📖 | 1 (4e/etats.md ×1) |
| 05 | Amibe | 📖 | 1 (4e/etats.md ×1) |
| 06 | Cockatrice | 📖 | catalogue (catalogue-*.md) |
| 07 | Chimere | 📖 | catalogue (catalogue-*.md) |
| 08 | Grand taurus | 📖 | catalogue (catalogue-*.md) |
| 09 | Tregara | 📖 | catalogue (catalogue-*.md) |
| 10 | Macareux a bec tranchant | 📖 | catalogue (catalogue-*.md) |
| 11 | Chat sauvage | 📖 | catalogue (catalogue-*.md) |
| 12 | Il Potente Granchio | 📖 | catalogue (catalogue-*.md) |
| 13 | Sirene | ✅ | 4 (4e/etats.md ×3) |
| 14 | Expeditions prevues | ✅ | 27 (4e/combat.md ×23) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **ZI 01** (TROIS EXPEDITIONS) :
  - 📖 l.3-31 « TROIS EXPÉDITIONS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.198-253 « Loup géant » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.254-296 « Razorgor » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 02** (Griffon) :
  - 📖 l.3-26 « Griffon » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.27-65 « Gueule d'effroi » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.75-120 « Rhinox » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 03** (Dragon) :
  - 📖 l.3-58 « Dragon » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.59-95 « Vouivre » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 04** (L'abominable Halagrundsor) :
  - 📖 l.3-52 « « L'abominable » Halagrundsor » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.53-87 « Brochet du Stir » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.131-235 « Le premier incident Le griffon et les hommes-rats » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 05** (Amibe) :
  - 📖 l.3-60 « Amibe » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.61-90 « Amphisbaena » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.149-188 « Sangsue caméléon » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.189-224 « Ver des marais » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.225-260 « Le déchiqueteur de cadavres de Carroburg » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.261-281 « Pégase noir » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.282-314 « Noctecorbe » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.315-404 « Preyton » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 06** (Cockatrice) :
  - 📖 l.3-39 « Cockatrice » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 07** (Chimere) :
  - 📖 l.3-64 « Chimère » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.65-153 « Le second incident Ce qui se passe à Wheburg » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 08** (Grand taurus) :
  - 📖 l.3-39 « Grand taurus » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 09** (Tregara) :
  - 📖 l.3-34 « Trégara » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 10** (Macareux a bec tranchant) :
  - 📖 l.3-33 « Macareux à bec tranchant » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.34-96 « Créatures fantastiques des Terres du Sud » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 11** (Chat sauvage) :
  - 📖 l.3-57 « Chat sauvage » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 12** (Il Potente Granchio) :
  - 📖 l.3-51 « Il Potente Granchio » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 13** (Sirene) :
  - 📖 l.35-68 « Wyrm des mers » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.69-136 « Dragon barbelé » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.251-275 « Précieuses entrailles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.276-301 « Qu'est-ce que ça vaut ? » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.302-311 « Quantité exploitable » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.312-387 « Quelles pièces ? » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.388-415 « Degré de conservation » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.416-432 « Recherche d'un acheteur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.433-442 « Potions et onguents » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.443-516 « Potions » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.517-752 « Antidotes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.753-758 « Armes et armures » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.862-871 « Objets magiques » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.872-974 « Armes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.975-1033 « Postface » — transcrit en catalogue, jamais traité, 0 réf
- **ZI 14** (Expeditions prevues) :
  - 📖 l.3-218 « Expéditions prévues » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.219-385 « JORUNN GROMSDOTTIR » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.386-699 « LYNATHRYN CHANTENUIT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.700-847 « VASYA GHORSHKOV » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1291-1372 « Index » — transcrit en catalogue, jamais traité, 0 réf

## MDG — ✅ 8 · 📖 2 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | La Mer des Griffes | ➖ hors-règle | gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles |
| 02 | La Bretonnie et le Wasteland | ✅ | 4 (4e/magie.md ×4) |
| 03 | La cote du Nordland | ➖ hors-règle | gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles |
| 04 | La cote de l'Ostland | ➖ hors-règle | gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles |
| 05 | Le Pays des Trolls | ➖ hors-règle | gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles |
| 06 | Kraka Ravnsvake | ➖ hors-règle | gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles |
| 07 | La cote des Skaelings | ✅ | 24 (4e/carrieres.md ×24) |
| 08 | La cote des Bjornlings | ➖ hors-règle | gazetteer côtier (cadre, pas de règles) ; 2/7/9-16 = règles |
| 09 | La classe Cotier | ✅ | 32 (4e/carrieres.md ×32) |
| 10 | Le culte de Manann | 📖 | 2 (4e/religion.md ×2) |
| 11 | Le culte de Stromfels | 📖 | 1 (4e/religion.md ×1) |
| 12 | Navires et construction navale | ✅ | 130 (4e/equipement.md ×60) |
| 13 | Navigation maritime | ✅ | 143 (4e/combat.md ×83) |
| 14 | Navigation a bord de grands vaisseaux | ✅ | 52 (4e/maladies.md ×19) |
| 15 | Longs voyages | ✅ | 45 (4e/deplacement.md ×23) |
| 16 | Bestiaire | ✅ | 10 (4e/bestiaire.md ×10) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **MDG 07** (La cote des Skaelings) :
  - ⬜ l.38-41 « MÉCHANTS OU MARCHANDS ? » — candidat trou de règle, 0 réf
  - ⬜ l.42-100 « SUR LA GLACE » — candidat trou de règle, 0 réf
  - ⬜ l.101-112 « SNAEGRS EXALTÉS » — candidat trou de règle, 0 réf
  - ⬜ l.113-145 « TOUT A UN PRIX » — candidat trou de règle, 0 réf
  - ⬜ l.146-188 « LE MARIN IVRE » — candidat trou de règle, 0 réf
- **MDG 09** (La classe Cotier) :
  - 📖 l.639-644 « JOURNAL DU CAPITAINE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.645-651 « L'AMIRAUTÉ DE BRETONNIE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.808-821 « L'HOMME D'ALGUES » — transcrit en catalogue, jamais traité, 0 réf
- **MDG 10** (Le culte de Manann) :
  - 📖 l.30-60 « HAUTS FAITS DE MANANN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.61-68 « Odrall le Dévot » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.69-76 « Amiral Ludovico Dandola » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.141-185 « Cathédrale de Manaan, Marienburg » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.186-214 « Ordre des Chevaliers des Mers » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.215-220 « Les Profondeurs Vertueuses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.258-269 « Contre-courants » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.270-305 « Malédiction de la mer » — transcrit en catalogue, jamais traité, 0 réf
- **MDG 11** (Le culte de Stromfels) :
  - 📖 l.156-178 « Faire fi de l'Humeur de Manann » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.179-186 « Lame de fond » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.187-196 « Mal de mer » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.197-206 « Malédiction de la maîtresse cruelle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.207-216 « Sacrifice à Stromfels » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.217-228 « Vents de tempête » — transcrit en catalogue, jamais traité, 0 réf
- **MDG 16** (Bestiaire) :
  - 🔻 enfoui l.539-610 « INDEX » — titre orné rétrogradé par l'extraction, 0 réf
  - 📖 l.346-538 « LE QUART DE NUIT Nom du navire Équipage Voile M (É) Avirons M (É) Man Taille E B Contenance Traits et Améliorations » — transcrit en catalogue, jamais traité, 0 réf

## EDOC — ✅ 4 · 📖 0 · 🟡 1 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | INTRODUCTION | ➖ hors-règle | |
| 02 | Commentaires des invites | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 03 | CHAPITRE 1 - Easter eggs | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 04 | ORGANISATIONS ET LIEUX | ➖ hors-règle | « ORGANISATIONS ET LIEUX » / « L'INTRIGUE » — prose de campagne |
| 05 | CHAPITRE 2 - L'Empire | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 06 | Chapitre 3 - Les routes et grandes routes | 🟡 | 1 (4e/deplacement.md ×1) |
| 07 | Chapitre 4 - Montures et vehicules | ✅ | 19 (4e/deplacement.md ×19) |
| 08 | CHAPITRE 5 - Voyager | ✅ | 16 (4e/deplacement.md ×7) |
| 09 | OÙ EST MON TABLEAU DE RENCONTRES ALÉATOIRES ? | ➖ hors-règle | encarts de conseil au MJ (« OÙ EST MON TABLEAU DE RENCONTRES ALÉATOIRES ? ») |
| 10 | CHAPITRE 6 - Patrouilleurs routiers | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 11 | CHAPITRE 7 - Toutes les routes menent a Bogenhafen | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 12 | CHAPITRE 8 - Les mutants dans l'Empire | ✅ | 3 (4e/corruption.md ×3) |
| 13 | CHAPITRE 9 - La Main pourpre - Guide du Meneur | ✅ | 6 (4e/talents.md ×6) |
| 14 | CHAPITRE 10 - Sur la route | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 15 | CHAPITRE 11 - L'Affaire du joyau cache - Un melodrame a l'intrigue complexe | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 16 | CHAPITRE 12 - LE CARNAVAL DU PANDEMONIUM | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **EDOC 06** (Chapitre 3 - Les routes et grandes routes) :
  - ⬜ l.3-12 « LES ROUTES » — candidat trou de règle, 0 réf
  - ⬜ l.13-16 « Routes principales » — candidat trou de règle, 0 réf
  - ⬜ l.17-20 « Routes secondaires » — candidat trou de règle, 0 réf
  - ⬜ l.21-38 « LES RELAIS DE DILIGENCES » — candidat trou de règle, 0 réf
  - ⬜ l.39-44 « Les Diligences des Quatre Saisons » — candidat trou de règle, 0 réf
  - ⬜ l.45-52 « Les Diligences de la Tour du Roc » — candidat trou de règle, 0 réf
  - ⬜ l.53-62 « Les Lignes Rochet » — candidat trou de règle, 0 réf
  - ⬜ l.63-68 « Auberges relais » — candidat trou de règle, 0 réf
  - ⬜ l.69-74 « ACCROCHE D'AVENTURE UN CARROSSE TROP LOIN » — candidat trou de règle, 0 réf
- **EDOC 07** (Chapitre 4 - Montures et vehicules) :
  - 📖 l.3-6 « CHAPITRE 4 : MONTURES ET VÉHICULES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.7-94 « ANIMAUX DE TRAIT ET MONTURES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.132-137 « CONDUIRE ET CHEVAUCHER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.176-183 « TRAÎNÉ AU SOL » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.184-191 « Véhicules routiers dans l'Empire » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.192-205 « Chaises à porteurs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.206-214 « ACCROCHE D'AVENTURE LA FOLIE DE LA MODE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.215-224 « Litières » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.288-291 « COMBAT MONTÉ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.292-295 « Localisations des Coups » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.296-311 « ATTAQUES SUR DES QUADRUPÈDES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.312-315 « Attaques sur les Véhicules » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.316-325 « SOINS AUX ANIMAUX BLESSÉS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.326-348 « ON NE S'ARRÊTE PAS ! » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.349-356 « RÉPARATION DES VÉHICULES » — transcrit en catalogue, jamais traité, 0 réf
- **EDOC 08** (CHAPITRE 5 - Voyager) :
  - ⬜ l.3-10 « CHAPITRE 5 : VOYAGER » — candidat trou de règle, 0 réf
  - ⬜ l.11-20 « DESTINATIONS ET DIRECTIONS » — candidat trou de règle, 0 réf
  - ⬜ l.31-35 « OPTIONS : TOUT EST OPTIONNEL, NE L'OUBLIEZ PAS ! » — candidat trou de règle, 0 réf
  - ⬜ l.36-43 « LA DISTANCE JUSQU'À… ? » — candidat trou de règle, 0 réf
  - ⬜ l.70-87 « Beau temps » — candidat trou de règle, 0 réf
  - ⬜ l.182-185 « RENCONTRES » — candidat trou de règle, 0 réf
  - ⬜ l.186-200 « RENCONTRES POSITIVES » — candidat trou de règle, 0 réf
  - ⬜ l.201-218 « RENCONTRES FORTUITES » — candidat trou de règle, 0 réf
  - ⬜ l.219-234 « RENCONTRES DANGEREUSES » — candidat trou de règle, 0 réf
- **EDOC 12** (CHAPITRE 8 - Les mutants dans l'Empire) :
  - 📖 l.3-18 « CHAPITRE 8 : » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.19-22 « SOCIÉTÉ MUTANTE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.23-32 « Mutants secrets » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.33-39 « Mutants cultistes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.40-45 « Mutants Bandits et Sauvages » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.46-53 « Mutants et hommes-bêtes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.54-62 « CRÉER DES MUTANTS » — transcrit en catalogue, jamais traité, 0 réf
- **EDOC 13** (CHAPITRE 9 - La Main pourpre - Guide du Meneur) :
  - ➖ l.3-11 « CHAPITRE 9 : LA MAIN POURPRE : GUIDE DU MENEUR » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.12-23 « TZEENTCH LE CHANGEUR DE VOIES » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.24-29 « Autres Dieux du Chaos » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.30-38 « ORGANISATION » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.39-57 « Les Grades de l'Ordre » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.58-72 « Symbole » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.73-80 « Rivaux » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.113-118 « CULTISTES DE LA MAIN POURPRE » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.119-126 « Cultistes » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.127-132 « Acolytes » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.133-144 « Magus du Culte » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.145-169 « SORCIERS DU CHAOS DE TZEENTCH » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.170-210 « Évolution de Carrière » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.211-223 « SOURCES DE *DHAR* » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.224-227 « Canaliser *Dhar* » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.228-247 « Lancer des Sorts avec *Dhar* » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.309-342 « Déchirer l'Aethyr » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.343-371 « Explosion de Corruption » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.372-393 « Odieux messager » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.394-409 « Le Domaine de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.410-419 « Avantage de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.420-444 « Éclair du changement » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.445-458 « Feu rose de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.459-482 « Feu spirituel » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.483-494 « La Main Pourpre » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.495-543 « Malédiction de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.544-549 « Percevoir l'écheveau » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.550-563 « Tempête de feu de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.564-575 « Transformation de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.576-580 « OPTION : HORREURS ALÉATOIRES » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.581-608 « Furies du Chaos » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf
  - ➖ l.609-636 « Horreurs de Tzeentch » — hors-règle (narratif/cadre), chapitre par ailleurs couvert, 0 réf

## MSRC — ✅ 3 · 📖 4 · 🟡 1 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | PREFACE - UN PEU D'HISTOIRE | ➖ hors-règle | |
| 02 | Commentaires des Auteurs | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 03 | CHAPITRE 1 - EASTER EGGS | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 04 | CHAPITRE 2 - Les herbes et leurs usages | ✅ | 4 (4e/maladies.md ×4) |
| 05 | CHAPITRE 3 - Scenes coupees | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 06 | CHAPITRE 4 - Les fleuves de l'Empire | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 07 | CHAPITRE 5 - Navigation fluviale | 📖 | catalogue (catalogue-*.md) |
| 08 | CHAPITRE 6 - La Patrouille fluviale imperiale | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 09 | CHAPITRE 7 - Compagnons de voyage | 📖 | catalogue (catalogue-*.md) |
| 10 | CHAPITRE 8 - LES RIVERAINS | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 11 | CHAPITRE 9 - Le service des tours imperiales a signaux | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 12 | CHAPITRE 10 - Personnalisation | 🟡 | 2 (4e/combat.md ×2) |
| 13 | CHAPITRE 11 - Regles du commerce | 📖 | catalogue (catalogue-*.md) |
| 14 | CHAPITRE 12 - Naufrageurs, contrebandiers et pirates | 📖 | catalogue (catalogue-*.md) |
| 15 | CHAPITRE 13 - Bestiaire fluvial | ✅ | 14 (4e/combat.md ×14) |
| 16 | CHAPITRE 14 - Maladies transmises par l'eau | ✅ | 16 (4e/maladies.md ×16) |
| 17 | CHAPITRE 15 - La Couronne Rouge Guide du Meneur de Jeu | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 18 | CHAPITRE 16 - L'Empereur Luitpold | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |
| 19 | CHAPITRE 17 - La vengeance du Roi des tombes | ➖ hors-règle | Chapitres-scénario explicites des compagnons MIXTES (le reste de ces livres = règles, couvertes). |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **MSRC 04** (CHAPITRE 2 - Les herbes et leurs usages) :
  - ⬜ l.3-14 « CHAPITRE 2 » — candidat trou de règle, 0 réf
  - ⬜ l.15-52 « LIEU ET SAISON » — candidat trou de règle, 0 réf
  - ⬜ l.53-72 « RÉCOLTER DES HERBES » — candidat trou de règle, 0 réf
  - ⬜ l.73-78 « CATAPLASMES, POTIONS ET INFUSIONS » — candidat trou de règle, 0 réf
  - ⬜ l.79-86 « Cataplasmes » — candidat trou de règle, 0 réf
  - ⬜ l.87-94 « Potions » — candidat trou de règle, 0 réf
  - ⬜ l.95-98 « HERBES DE L'EMPIRE » — candidat trou de règle, 0 réf
  - ⬜ l.99-123 « Agurk » — candidat trou de règle, 0 réf
  - ⬜ l.124-135 « Aromage » — candidat trou de règle, 0 réf
  - ⬜ l.136-141 « DEUX SUR TROIS, C'EST PAS SI MAL » — candidat trou de règle, 0 réf
  - ⬜ l.142-154 « Cervolent » — candidat trou de règle, 0 réf
  - ⬜ l.155-162 « Feuille d'araignée » — candidat trou de règle, 0 réf
  - ⬜ l.163-166 « FEUILLE D'ARAIGNÉE » — candidat trou de règle, 0 réf
  - ⬜ l.167-177 « Feuille de mage » — candidat trou de règle, 0 réf
  - ⬜ l.254-263 « *Schlafenkraut* » — candidat trou de règle, 0 réf
  - ⬜ l.264-286 « Sobriandre » — candidat trou de règle, 0 réf
  - ⬜ l.287-292 « Valériane » — candidat trou de règle, 0 réf
  - ⬜ l.293-310 « THÉ CORSÉ » — candidat trou de règle, 0 réf
- **MSRC 07** (CHAPITRE 5 - Navigation fluviale) :
  - 📖 l.3-8 « CHAPITRE 5 NAVIGATION FLUVIALE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.9-18 « RÈGLES DE NAVIGATION » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.19-43 « CONDITIONS MÉTÉOROLOGIQUES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.44-71 « DÉGÂTS INFLIGÉS AU BATEAU » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.72-96 « Coups Critiques au bateau » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.97-106 « S'échouer » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.107-118 « RÉPARER DES BATEAUX » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.119-129 « DANGERS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.130-151 « Rochers et eaux peu profondes » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.152-159 « ACCIDENTS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.160-185 « Gréement brisé » — transcrit en catalogue, jamais traité, 0 réf
- **MSRC 09** (CHAPITRE 7 - Compagnons de voyage) :
  - 📖 l.3-12 « CHAPITRE 7 » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.13-16 « CHARLATANS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.17-72 « UN GRAND MAÎTRE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.73-78 « PILLEURS DE TOMBES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.79-86 « LA PROMESSE D'UN REMÈDE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.87-107 « PRENDRE DES COMMANDES, LES HONORER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.108-145 « CHASSEURS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.146-157 « NOBLES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.158-190 « BIEN SÛR, J'AI PRIS MA RETRAITE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.191-213 « SE BATTRE À ARMES ÉGALES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.214-248 « GLADIATEURS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.249-281 « DÉBARDEURS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.282-307 « BLANCS-BECS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.308-347 « CUISINIERS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.348-388 « SORCIERS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.389-396 « MÉDECINS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.397-426 « JE NE VOUS VEUX AUCUN MAL » — transcrit en catalogue, jamais traité, 0 réf
- **MSRC 12** (CHAPITRE 10 - Personnalisation) :
  - ⬜ l.3-6 « CHAPITRE 10 PERSONNALISATION » — candidat trou de règle, 0 réf
  - ⬜ l.7-8 « COQUE » — candidat trou de règle, 0 réf
  - ⬜ l.50-51 « SYSTÈME DE DIRECTION » — candidat trou de règle, 0 réf
  - ⬜ l.52-59 « Safran » — candidat trou de règle, 0 réf
  - ⬜ l.60-67 « Bouteur » — candidat trou de règle, 0 réf
  - ⬜ l.68-75 « Ralentisseurs latéraux » — candidat trou de règle, 0 réf
  - ⬜ l.76-77 « SUPERSTRUCTURE » — candidat trou de règle, 0 réf
  - ⬜ l.78-86 « Murs blindés » — candidat trou de règle, 0 réf
  - ⬜ l.87-104 « Sabord » — candidat trou de règle, 0 réf
  - ⬜ l.105-120 « Plat-bord » — candidat trou de règle, 0 réf
  - ⬜ l.121-122 « GRÉEMENT » — candidat trou de règle, 0 réf
  - ⬜ l.123-130 « Clinfoc » — candidat trou de règle, 0 réf
  - ⬜ l.131-141 « Gréement de course » — candidat trou de règle, 0 réf
  - ⬜ l.142-143 « RAMES » — candidat trou de règle, 0 réf
  - ⬜ l.144-151 « Dames de nage fermées » — candidat trou de règle, 0 réf
  - ⬜ l.152-159 « Cuillères » — candidat trou de règle, 0 réf
  - ⬜ l.160-161 « ARMES » — candidat trou de règle, 0 réf
  - ⬜ l.172-186 « Canons » — candidat trou de règle, 0 réf
  - ⬜ l.187-190 « Catapultes » — candidat trou de règle, 0 réf
  - ⬜ l.191-196 « Mortiers » — candidat trou de règle, 0 réf
  - ⬜ l.197-216 « Fourquines » — candidat trou de règle, 0 réf
  - ⬜ l.217-220 « Fusils à salve » — candidat trou de règle, 0 réf
  - ⬜ l.221-236 « ARMES MONTÉES SUR BATEAU » — candidat trou de règle, 0 réf
  - ⬜ l.237-238 « PROPULSION » — candidat trou de règle, 0 réf
  - ⬜ l.239-246 « Magique » — candidat trou de règle, 0 réf
  - ⬜ l.247-268 « Vapeur » — candidat trou de règle, 0 réf
- **MSRC 13** (CHAPITRE 11 - Regles du commerce) :
  - 📖 l.3-10 « CHAPITRE 11 RÈGLES DU COMMERCE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.11-14 « LA VIE DE MARCHAND » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.15-21 « ACHAT » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.22-29 « 1. Disponibilité des biens » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.30-35 « 2. Type de cargaison » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.36-61 « 3. Taille des cargaisons disponibles » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.62-124 « OÙ SONT MON OR ET MON ARGENT ? » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.125-132 « 4. Marchandage » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.133-136 « VENTE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.137-248 « Demande » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.249-259 « INDEX GÉOGRAPHIQUE DE LA *FREISTADT* DE BÖGENHAFEN (2512 CI) » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.260-306 « INDEX GÉOGRAPHIQUE DE LA *FREISTADT* D'AUERSWALD (2512 CI) » — transcrit en catalogue, jamais traité, 0 réf
- **MSRC 14** (CHAPITRE 12 - Naufrageurs, contrebandiers et pirates) :
  - 📖 l.3-6 « CHAPITRE 12 NAUFRAGEURS, CONTREBANDIERS ET PIRATES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.7-12 « NAUFRAGEURS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.13-27 « Balisage trompeur » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.28-31 « Dangers artificiels » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.32-82 « Bandes de naufrageurs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.83-93 « PIRATES CÉLÈBRES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.94-99 « PIRATES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.100-107 « Flottes de pirates » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.108-150 « Carrières de pirates » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.151-166 « Bateaux pirates » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.167-171 « ACCROCHE D'AVENTURE : UN PIRATE HONNÊTE » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.172-185 « CONTREBANDIERS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.186-221 « Rencontres » — transcrit en catalogue, jamais traité, 0 réf
- **MSRC 15** (CHAPITRE 13 - Bestiaire fluvial) :
  - ⬜ l.3-4 « CHAPITRE 13 BESTIAIRE FLUVIAL » — candidat trou de règle, 0 réf
  - ⬜ l.5-8 « RIVIÈRES PÉRILLEUSES » — candidat trou de règle, 0 réf
  - ⬜ l.9-13 « AMIBES » — candidat trou de règle, 0 réf
  - ⬜ l.14-28 « ANGUILLES DU REIK » — candidat trou de règle, 0 réf
  - ⬜ l.29-43 « SANGSUES GÉANTES » — candidat trou de règle, 0 réf
  - ⬜ l.44-47 « Sangsues-caméléons » — candidat trou de règle, 0 réf
  - ⬜ l.48-65 « Sangsues des arbres » — candidat trou de règle, 0 réf
  - ⬜ l.66-67 « XIII » — candidat trou de règle, 0 réf
  - ⬜ l.68-91 « NAÏADES » — candidat trou de règle, 0 réf
  - ⬜ l.92-104 « BROCHETS DU STIR » — candidat trou de règle, 0 réf
  - ⬜ l.105-113 « ACCROCHE D'AVENTURE : LE MONSTRE À TROIS YEUX » — candidat trou de règle, 0 réf
  - ⬜ l.165-168 « Hallucinogène » — candidat trou de règle, 0 réf
  - ⬜ l.169-172 « Rampant » — candidat trou de règle, 0 réf
  - ⬜ l.173-176 « Salive analgésique » — candidat trou de règle, 0 réf
  - ⬜ l.177-182 « Salive anticoagulante » — candidat trou de règle, 0 réf

## AU1 — ✅ 1 · 📖 0 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | introduction | ➖ hors-règle | |
| 02 | Si un regard pouvait tuer | ➖ hors-règle | |
| 03 | pour etoffer un peu | ➖ hors-règle | |
| 04 | Ca fait beaucoup de Traits ! | ✅ | 7 (4e/combat.md ×7) |
| 05 | *(artefact OCR)* | ➖ | |
| 06 | LES FOUS DE GOTHEIM | ➖ hors-règle | |
| 07 | Wilhelm Kreigrisch, le bourgmestre | ➖ hors-règle | |
| 08 | *(artefact OCR)* | ➖ | |
| 09 | Demarrer l'aventure | ➖ hors-règle | |
| 10 | COEUR DE VERRE | ➖ hors-règle | |
| 11 | *(artefact OCR)* | ➖ | |
| 12 | Demarrer l'Aventure | ➖ hors-règle | |
| 13 | LA TOUR DES VENTS | ➖ hors-règle | |
| 14 | MASSACRE A SPITTLEFELD | ➖ hors-règle | |
| 15 | *(artefact OCR)* | ➖ | |
| 16 | Comment commencer l'aventure | ➖ hors-règle | |
| 17 | *(section sans titre)* | ➖ hors-règle | |
| 18 | D'Appats et de Sorciers | ➖ hors-règle | |
| 19 | *(artefact OCR)* | ➖ | |
| 20 | Debuter l'Aventure | ➖ hors-règle | |
| 21 | *(section sans titre)* | ➖ hors-règle | |
| 22 | Les coupables | ➖ hors-règle | |
| 23 | *(artefact OCR)* | ➖ | |
| 24 | Comment commencer l'Aventure | ➖ hors-règle | |
| 25 | Index des PNJ | ➖ hors-règle | |
| 26 | *(section sans titre)* | ➖ hors-règle | |

## NADJ — ✅ 6 · 📖 0 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | Avant-propos | ➖ hors-règle | |
| 02 | Introduction | ➖ hors-règle | |
| 03 | Une nuit agitee aux Trois Plumes | ➖ hors-règle | |
| 04 | Les autres invités | ➖ hors-règle | |
| 05 | 22h00 | ✅ | 6 (4e/combat.md ×4) |
| 06 | Une journee au tribunal | ✅ | 13 (4e/combat.md ×13) |
| 07 | Les dignitaires du tribunal | ➖ hors-règle | |
| 08 | Une nuit a l'Opera | ✅ | 3 (4e/combat.md ×3) |
| 09 | Le répurgateur | ➖ hors-règle | |
| 10 | le mariage de nastassia | ➖ hors-règle | |
| 11 | Le joyau volé | ✅ | 6 (4e/combat.md ×6) |
| 12 | *(artefact OCR)* | ➖ | |
| 13 | SEIGNEUR D'UBERSREIK - | ➖ hors-règle | |
| 14 | appendice I - Gnomes | ➖ hors-règle | |
| 15 | LE PEUPLE DES LANDES | ✅ | 4 (4e/talents.md ×3) |
| 16 | JEUX DE TAVERNE | ✅ | 17 (4e/tests.md ×14) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **NADJ 05** (_GoBack) :
  - ⬜ l.5-10 « 22h00 » — candidat trou de règle, 0 réf
  - ⬜ l.11-22 « 22h10 » — candidat trou de règle, 0 réf
  - ⬜ l.23-28 « 22h15 » — candidat trou de règle, 0 réf
  - ⬜ l.29-32 « 22h25 » — candidat trou de règle, 0 réf
  - ⬜ l.33-36 « 22h40 » — candidat trou de règle, 0 réf
  - ⬜ l.37-55 « 22h45 » — candidat trou de règle, 0 réf
  - ⬜ l.62-73 « 23h30 » — candidat trou de règle, 0 réf
  - ⬜ l.74-79 « 23h50 » — candidat trou de règle, 0 réf
  - ⬜ l.80-89 « Minuit » — candidat trou de règle, 0 réf
  - ⬜ l.90-106 « 00h20 » — candidat trou de règle, 0 réf
  - ⬜ l.107-114 « 01h20 » — candidat trou de règle, 0 réf
  - ⬜ l.130-131 « CONCLUSION » — candidat trou de règle, 0 réf
  - ⬜ l.132-144 « Récompenses » — candidat trou de règle, 0 réf
  - ⬜ l.145-146 « Conséquences » — candidat trou de règle, 0 réf
  - ⬜ l.147-152 « Continuer la campagne » — candidat trou de règle, 0 réf
  - ⬜ l.153-158 « Une aventure indépendante » — candidat trou de règle, 0 réf
  - ⬜ l.159-160 « PERSONNAGES NON JOUEURS » — candidat trou de règle, 0 réf
  - ⬜ l.161-181 « La suite de la Gravin » — candidat trou de règle, 0 réf
  - ⬜ l.182-196 « Bruno Franke » — candidat trou de règle, 0 réf
  - ⬜ l.197-202 « LA SUITE DE LA GRAVIN » — candidat trou de règle, 0 réf
  - ⬜ l.203-241 « Gustaf Rechtshandler » — candidat trou de règle, 0 réf
  - ⬜ l.242-260 « Éliza la servante » — candidat trou de règle, 0 réf
  - ⬜ l.261-262 « Les « Morriens » et leur poursuivante » — candidat trou de règle, 0 réf
  - ⬜ l.263-292 « Les «Morriens » » — candidat trou de règle, 0 réf
  - ⬜ l.293-312 « La chasseuse de primes » — candidat trou de règle, 0 réf
  - ⬜ l.313-360 « « Johann Schmidt » et « Frau Schmidt » » — candidat trou de règle, 0 réf
  - ⬜ l.361-377 « Les cultistes » — candidat trou de règle, 0 réf
  - ⬜ l.378-379 « Les autres clients » — candidat trou de règle, 0 réf
  - ⬜ l.380-383 « Cochers et bateliers » — candidat trou de règle, 0 réf
  - ⬜ l.384-448 « Glimbrin et Plantule » — candidat trou de règle, 0 réf
  - ⬜ l.449-456 « VIEILLE BESS - ARTISAN (ARGENT 1) » — candidat trou de règle, 0 réf
  - ⬜ l.457-458 « Le personnel des Trois Plumes » — candidat trou de règle, 0 réf
  - ⬜ l.459-464 « Le propriétaire et son personnel » — candidat trou de règle, 0 réf
  - ⬜ l.465-472 « AUBERGES À PROBLÈMES » — candidat trou de règle, 0 réf
- **NADJ 06** (Une journee au tribunal) :
  - ⬜ l.7-10 « LE LIEU » — candidat trou de règle, 0 réf
  - ⬜ l.11-14 « Y ARRIVER » — candidat trou de règle, 0 réf
  - ⬜ l.15-20 « Suite de la campagne » — candidat trou de règle, 0 réf
  - ⬜ l.21-24 « Une aventure indépendante » — candidat trou de règle, 0 réf
  - ⬜ l.25-28 « LE PALAIS DE JUSTICE » — candidat trou de règle, 0 réf
  - ⬜ l.29-34 « La place » — candidat trou de règle, 0 réf
  - ⬜ l.35-40 « La cour » — candidat trou de règle, 0 réf
  - ⬜ l.41-46 « Le rez-de-chaussée » — candidat trou de règle, 0 réf
  - ⬜ l.47-52 « Le premier étage » — candidat trou de règle, 0 réf
  - ⬜ l.53-56 « L'AVENTURE » — candidat trou de règle, 0 réf
  - ⬜ l.57-65 « Présentation des protagonistes » — candidat trou de règle, 0 réf
  - ⬜ l.66-71 « Résumé des intrigues » — candidat trou de règle, 0 réf
  - ⬜ l.72-75 « Intrigue n° 2 – Évasion » — candidat trou de règle, 0 réf
  - ⬜ l.76-81 « Intrigue n° 3 – Indiscrétions de jeunesse » — candidat trou de règle, 0 réf
  - ⬜ l.82-92 « Intrigue n° 4 – Présomption d'innocence » — candidat trou de règle, 0 réf
  - ⬜ l.93-102 « Intrigue n° 6 – Jour de sang » — candidat trou de règle, 0 réf
  - ⬜ l.103-106 « Évènements » — candidat trou de règle, 0 réf
  - ⬜ l.107-112 « 9h00 » — candidat trou de règle, 0 réf
  - ⬜ l.113-130 « 9h15 » — candidat trou de règle, 0 réf
  - ⬜ l.131-137 « 10h00 » — candidat trou de règle, 0 réf
  - ⬜ l.138-143 « 10h15 » — candidat trou de règle, 0 réf
  - ⬜ l.152-159 « 10h45 » — candidat trou de règle, 0 réf
  - ⬜ l.160-174 « 11h00 » — candidat trou de règle, 0 réf
  - ⬜ l.197-209 « 11h45 » — candidat trou de règle, 0 réf
  - ⬜ l.210-215 « Deux Rounds plus tard… » — candidat trou de règle, 0 réf
  - ⬜ l.216-227 « 12h15 » — candidat trou de règle, 0 réf
  - ⬜ l.228-248 « Deux Rounds plus tard… » — candidat trou de règle, 0 réf
  - ⬜ l.249-275 « Deux Rounds plus tard… » — candidat trou de règle, 0 réf
  - ⬜ l.276-277 « CONCLUSION » — candidat trou de règle, 0 réf
  - ⬜ l.278-299 « Récompenses » — candidat trou de règle, 0 réf
  - ⬜ l.300-301 « Conséquences » — candidat trou de règle, 0 réf
  - ⬜ l.302-309 « Continuer la campagne » — candidat trou de règle, 0 réf
  - ⬜ l.310-313 « Une aventure indépendante » — candidat trou de règle, 0 réf
  - ⬜ l.314-315 « PERSONNAGES NON JOUEURS » — candidat trou de règle, 0 réf
  - ⬜ l.316-342 « La suite de la Gravin » — candidat trou de règle, 0 réf
  - ⬜ l.343-354 « Le serpent de l'agent » — candidat trou de règle, 0 réf
  - ⬜ l.355-358 « Autre membre du personnel » — candidat trou de règle, 0 réf
  - ⬜ l.359-374 « Les hommes d'affaires locaux » — candidat trou de règle, 0 réf
  - ⬜ l.375-376 « Les cultistes » — candidat trou de règle, 0 réf
  - ⬜ l.377-381 « Cultistes de l'*Ordo Ultima* » — candidat trou de règle, 0 réf
  - ⬜ l.382-383 « Le répurgateur et sa victime » — candidat trou de règle, 0 réf
  - ⬜ l.384-402 « Matthias Hubkind » — candidat trou de règle, 0 réf
  - ⬜ l.403-415 « Le fantôme » — candidat trou de règle, 0 réf
  - ⬜ l.416-417 « La chasseuse de primes » — candidat trou de règle, 0 réf
  - ⬜ l.418-421 « Ursula Kopfgeld » — candidat trou de règle, 0 réf
  - ⬜ l.422-423 « Le voleur opportuniste » — candidat trou de règle, 0 réf
  - ⬜ l.424-427 « Glimbrin Drol'detype » — candidat trou de règle, 0 réf
- **NADJ 08** (Une nuit a l'Opera) :
  - ⬜ l.7-10 « LE LIEU » — candidat trou de règle, 0 réf
  - ⬜ l.11-14 « Y ARRIVER » — candidat trou de règle, 0 réf
  - ⬜ l.15-21 « Suite de la campagne » — candidat trou de règle, 0 réf
  - ⬜ l.22-27 « Une aventure indépendante » — candidat trou de règle, 0 réf
  - ⬜ l.28-33 « L'OPÉRA » — candidat trou de règle, 0 réf
  - ⬜ l.34-41 « Le rez-de-chaussée » — candidat trou de règle, 0 réf
  - ⬜ l.42-50 « L'étage supérieur » — candidat trou de règle, 0 réf
  - ⬜ l.51-54 « L'AVENTURE » — candidat trou de règle, 0 réf
  - ⬜ l.55-58 « Présentation des protagonistes » — candidat trou de règle, 0 réf
  - ⬜ l.59-60 « Résumés des intrigues » — candidat trou de règle, 0 réf
  - ⬜ l.61-64 « Intrigue n°1 - Meilleur servi chaud » — candidat trou de règle, 0 réf
  - ⬜ l.65-68 « Intrigue n° 2 - Une farce d'étudiant » — candidat trou de règle, 0 réf
  - ⬜ l.69-72 « Intrigue n°3 - Critiques réfutées » — candidat trou de règle, 0 réf
  - ⬜ l.73-76 « Intrigue n° 4 - Liens avec le collège » — candidat trou de règle, 0 réf
  - ⬜ l.77-82 « Intrigue n° 5 - Rivalités locales » — candidat trou de règle, 0 réf
  - ⬜ l.83-86 « Intrigue n° 6 - Honneur à la famille » — candidat trou de règle, 0 réf
  - ⬜ l.87-91 « Intrigue n° 7 - Le répurgateur » — candidat trou de règle, 0 réf
  - ⬜ l.92-95 « Événements » — candidat trou de règle, 0 réf
  - ⬜ l.96-103 « 18 h 30 » — candidat trou de règle, 0 réf
  - ⬜ l.104-107 « 19 h 00 » — candidat trou de règle, 0 réf
  - ⬜ l.108-113 « 19h40 » — candidat trou de règle, 0 réf
  - ⬜ l.114-130 « 19h45 » — candidat trou de règle, 0 réf
  - ⬜ l.131-142 « 19h55 » — candidat trou de règle, 0 réf
  - ⬜ l.143-146 « 20h04 » — candidat trou de règle, 0 réf
  - ⬜ l.147-156 « 20h05 » — candidat trou de règle, 0 réf
  - ⬜ l.157-169 « 20h20 » — candidat trou de règle, 0 réf
  - ⬜ l.192-208 « 21h34 » — candidat trou de règle, 0 réf
  - ⬜ l.209-239 « 21h35 » — candidat trou de règle, 0 réf
  - ⬜ l.240-260 « 21h55 » — candidat trou de règle, 0 réf
  - ⬜ l.269-276 « 23h00 » — candidat trou de règle, 0 réf
  - ⬜ l.277-285 « 23h30 » — candidat trou de règle, 0 réf
  - ⬜ l.286-287 « CONCLUSION » — candidat trou de règle, 0 réf
  - ⬜ l.288-306 « Récompenses » — candidat trou de règle, 0 réf
  - ⬜ l.307-308 « Conséquences » — candidat trou de règle, 0 réf
  - ⬜ l.309-314 « Suite de la campagne » — candidat trou de règle, 0 réf
  - ⬜ l.315-320 « Une aventure indépendante » — candidat trou de règle, 0 réf
  - ⬜ l.321-322 « PERSONNAGES NON JOUEURS » — candidat trou de règle, 0 réf
  - ⬜ l.323-326 « La suite de la Gravin » — candidat trou de règle, 0 réf
  - ⬜ l.327-349 « La Comtesse et sa suite » — candidat trou de règle, 0 réf
  - ⬜ l.350-361 « Brecht Kavenner, Avocat » — candidat trou de règle, 0 réf
  - ⬜ l.362-394 « Serviteurs royaux et gardes » — candidat trou de règle, 0 réf
  - ⬜ l.395-396 « Personnel de l'Opéra » — candidat trou de règle, 0 réf
  - ⬜ l.397-432 « Serviteurs, musiciens, artistes et employés » — candidat trou de règle, 0 réf
  - ⬜ l.433-450 « Les agents de Dammenblatz » — candidat trou de règle, 0 réf
  - ⬜ l.451-456 « L'École d'Artillerie » — candidat trou de règle, 0 réf
  - ⬜ l.457-496 « L'acteur offensé et ses « amis » » — candidat trou de règle, 0 réf
  - ⬜ l.497-511 « Detlef Sierck » — candidat trou de règle, 0 réf
  - ⬜ l.512-533 « Les ennemis d'Oldenhaller » — candidat trou de règle, 0 réf
  - ⬜ l.534-570 « Le Culte de la Larve sacrée » — candidat trou de règle, 0 réf
  - ⬜ l.571-578 « Le voleur » — candidat trou de règle, 0 réf
- **NADJ 11** (_GoBack) :
  - ⬜ l.3-4 « Le joyau volé » — candidat trou de règle, 0 réf
  - ⬜ l.5-17 « La duchesse douairière du Telland » — candidat trou de règle, 0 réf
  - ⬜ l.34-53 « Le Spectre » — candidat trou de règle, 0 réf
  - ⬜ l.54-59 « Le voleur gnome » — candidat trou de règle, 0 réf
- **NADJ 15** (_GoBack) :
  - ⬜ l.68-73 « Noms de clan gnomes » — candidat trou de règle, 0 réf
  - ⬜ l.74-77 « Traits physiques » — candidat trou de règle, 0 réf
  - ⬜ l.78-81 « Âge » — candidat trou de règle, 0 réf
  - ⬜ l.82-105 « Couleur des yeux » — candidat trou de règle, 0 réf
  - ⬜ l.106-109 « GNOMES COLPORTEURS » — candidat trou de règle, 0 réf
  - ⬜ l.110-113 « Taille » — candidat trou de règle, 0 réf
  - ⬜ l.114-118 « LES DIEUX DES GNOMES » — candidat trou de règle, 0 réf
  - ⬜ l.119-128 « DIEUX DES GNOMES » — candidat trou de règle, 0 réf
  - ⬜ l.129-134 « Prêtres gnomes » — candidat trou de règle, 0 réf
  - ⬜ l.135-138 « Evawn » — candidat trou de règle, 0 réf
  - ⬜ l.139-150 « COMMANDEMENTS » — candidat trou de règle, 0 réf
  - ⬜ l.151-158 « COMMANDEMENTS » — candidat trou de règle, 0 réf
  - ⬜ l.159-162 « Ringil » — candidat trou de règle, 0 réf
  - ⬜ l.163-170 « COMMANDEMENTS » — candidat trou de règle, 0 réf
  - ⬜ l.171-174 « GNOMES ET CORRUPTION » — candidat trou de règle, 0 réf
- **NADJ 16** (JEUX DE TAVERNE) :
  - ⬜ l.36-52 « LA BÊTE PARMI LES TAILLEURS » — candidat trou de règle, 0 réf
  - ⬜ l.66-83 « L'ARÈNE » — candidat trou de règle, 0 réf
  - ⬜ l.84-92 « LE CEREVIS » — candidat trou de règle, 0 réf
  - ⬜ l.101-106 « LES DOMINOS » — candidat trou de règle, 0 réf
  - ⬜ l.107-112 « LE TORCHON TREMPÉ » — candidat trou de règle, 0 réf
  - ⬜ l.113-120 « MIDDENBALL » — candidat trou de règle, 0 réf
  - ⬜ l.121-126 « LES MOULINS » — candidat trou de règle, 0 réf
  - ⬜ l.127-132 « QUESTIONS - RÉPONSES » — candidat trou de règle, 0 réf
  - ⬜ l.133-140 « L'IMPÉRATRICE ÉCARLATE » — candidat trou de règle, 0 réf
  - ⬜ l.141-146 « LES PIERRES » — candidat trou de règle, 0 réf

## EDO — ✅ 4 · 📖 0 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | Chapitre 1 - On recherche - aventuriers courageux | ➖ hors-règle | |
| 02 | Chapitre 2 - Erreur sur la personne | ➖ hors-règle | |
| 03 | Chapitre 3 - Le coeur de l'Empire | ➖ hors-règle | |
| 04 | Chapitre 4 - Sur la route de Bogenhafen... | ➖ hors-règle | |
| 05 | Chapitre 5 - Le faux heritage | ➖ hors-règle | |
| 06 | Chapitre 6 - La Schaffenfest | ➖ hors-règle | |
| 07 | Chapitre 7 - Dans les tenebres | ✅ | 3 (4e/combat.md ×3) |
| 08 | Chapitre 8 - Chasser les ombres | ➖ hors-règle | |
| 09 | Chapitre 9 - L'heure fatidique | ✅ | 3 (4e/combat.md ×3) |
| 10 | APPENDICE 1 - Un guide de Bogenhafen | ➖ hors-règle | |
| 11 | APPENDICE 2 - Nouvelles regles | ✅ | 19 (4e/combat.md ×19) |
| 12 | Annexe 3 - Documents et aides de jeux | ✅ | 39 (4e/deplacement.md ×39) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H2) :

- **EDO 07** (Chapitre 7 - Dans les tenebres) :
  - ⬜ l.9-14 « ENTRER DANS LES ÉGOUTS » — bruit de scénario, 0 réf
  - ⬜ l.15-20 « PENDANT CE TEMPS-LÀ, AILLEURS… » — bruit de scénario, 0 réf
  - ⬜ l.21-30 « S'AVENTURER DANS LES ÉGOUTS » — bruit de scénario, 0 réf
  - ⬜ l.31-39 « Se déplacer dans les égouts » — bruit de scénario, 0 réf
  - ⬜ l.40-59 « Les égouts et les couleurs » — bruit de scénario, 0 réf
  - ⬜ l.60-68 « Vue, ouïe et odorat » — bruit de scénario, 0 réf
  - ⬜ l.69-84 « RENCONTRES FACULTATIVES » — bruit de scénario, 0 réf
  - ⬜ l.85-155 « TABLE DES ÉVÉNEMENTS ALÉATOIRES » — bruit de scénario, 0 réf
  - ⬜ l.156-159 « EMPLACEMENTS PRINCIPAUX » — bruit de scénario, 0 réf
  - ⬜ l.160-173 « Lieu d'entrée du gobelin » — bruit de scénario, 0 réf
  - ⬜ l.174-209 « Porte des Piques Croisées » — bruit de scénario, 0 réf
  - ⬜ l.210-225 « Cadavre de Gottri » — bruit de scénario, 0 réf
  - ⬜ l.226-229 « Tuyaux d'évacuation » — bruit de scénario, 0 réf
  - ⬜ l.230-233 « Canal <sup>à</sup> ciel ouvert » — bruit de scénario, 0 réf
  - ⬜ l.234-244 « Temple secret » — bruit de scénario, 0 réf
  - ⬜ l.245-265 « OPTIONS : LIBÉREZ LE DÉMON ! » — bruit de scénario, 0 réf
  - ⬜ l.266-271 « AU SORTIR DES ÉGOUTS » — bruit de scénario, 0 réf
  - ⬜ l.272-277 « Aller se coucher » — bruit de scénario, 0 réf
  - ⬜ l.278-291 « La Fin du Voyage » — bruit de scénario, 0 réf
  - ⬜ l.292-293 « CONCLUSION » — bruit de scénario, 0 réf
  - ⬜ l.294-306 « Récompenses » — bruit de scénario, 0 réf
  - ⬜ l.307-308 « PNJ » — bruit de scénario, 0 réf
- **EDO 09** (Chapitre 9 - L'heure fatidique) :
  - ⬜ l.7-12 « DÉCLENCHER LE RITUEL » — bruit de scénario, 0 réf
  - ⬜ l.13-28 « Une visite inattendue » — bruit de scénario, 0 réf
  - ⬜ l.29-59 « LE MESSAGE » — bruit de scénario, 0 réf
  - ⬜ l.60-73 « UN HORRIBLE MEURTRE » — bruit de scénario, 0 réf
  - ⬜ l.74-102 « OPTION : LES NERFS QUI LÂCHENT » — bruit de scénario, 0 réf
  - ⬜ l.103-108 « Pris au piège ! » — bruit de scénario, 0 réf
  - ⬜ l.109-119 « S'enfuir de la maison » — bruit de scénario, 0 réf
  - ⬜ l.120-133 « UNE CHOSE APRÈS L'AUTRE » — bruit de scénario, 0 réf
  - ⬜ l.134-141 « UN INCIDENT FLAMBOYANT » — bruit de scénario, 0 réf
  - ⬜ l.142-145 « L'OSTENDAMM » — bruit de scénario, 0 réf
  - ⬜ l.146-156 « OPTION : DES MUTANTS… LUNATIQUES » — bruit de scénario, 0 réf
  - ⬜ l.157-164 « L'Entrepôt 17 » — bruit de scénario, 0 réf
  - ⬜ l.165-176 « L'Entrepôt 13 » — bruit de scénario, 0 réf
  - ⬜ l.177-180 « L'INSTANT CRITIQUE » — bruit de scénario, 0 réf
  - ⬜ l.181-189 « Derniers préparatifs » — bruit de scénario, 0 réf
  - ⬜ l.190-201 « La consécration » — bruit de scénario, 0 réf
  - ⬜ l.202-214 « Le rituel » — bruit de scénario, 0 réf
  - ⬜ l.215-230 « Faire échouer le rituel » — bruit de scénario, 0 réf
  - ⬜ l.231-252 « Voler ou détruire des éléments indispensables » — bruit de scénario, 0 réf
  - ⬜ l.253-271 « Le rituel est interrompu » — bruit de scénario, 0 réf
  - ⬜ l.272-317 « Le rituel est achevé » — bruit de scénario, 0 réf
  - ⬜ l.318-325 « OPTION : TRAUMA » — bruit de scénario, 0 réf
  - ⬜ l.326-327 « CONCLUSION » — bruit de scénario, 0 réf
  - ⬜ l.328-334 « Récompenses » — bruit de scénario, 0 réf
  - ⬜ l.335-340 « Répercussions » — bruit de scénario, 0 réf
  - ⬜ l.341-350 « Convaincre les autorités » — bruit de scénario, 0 réf
  - ⬜ l.351-357 « OPTION : QUEL DEGRÉ DE CORRUPTION ? » — bruit de scénario, 0 réf
  - ⬜ l.358-375 « Quitter la ville » — bruit de scénario, 0 réf
  - ⬜ l.376-379 « Éviter le Guet » — bruit de scénario, 0 réf
  - ⬜ l.380-383 « Excursions sur le Reik » — bruit de scénario, 0 réf
  - ⬜ l.384-414 « OPTION : UNE REFONTE DE GIDEON » — bruit de scénario, 0 réf
  - ⬜ l.415-416 « PNJ » — bruit de scénario, 0 réf
  - ⬜ l.417-467 « L'Entrepôt 17 » — bruit de scénario, 0 réf
  - ⬜ l.574-750 « CHRONOLOGIE DE BÖGENHAFEN » — bruit de scénario, 0 réf
- **EDO 11** (APPENDICE 2 - Nouvelles regles) :
  - 📖 l.7-16 « PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.17-22 « Créez le vôtre » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.23-47 « Doktor Langstrasse » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.48-80 « Les accents de l'Empire » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.81-84 « PORTES ET SERRURES » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.103-106 « MALADIE ET INFECTION » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.107-120 « Litanie de la Pestilence » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.247-266 « ANNEAU D'OPSIANON » — transcrit en catalogue, jamais traité, 0 réf
- **EDO 12** (Annexe 3 - Documents et aides de jeux) :
  - ⬜ l.3-10 « ANNEXE 3 : » — bruit de scénario, 0 réf
  - ⬜ l.49-59 « L'HARMONIE DES SPHÈRES » — bruit de scénario, 0 réf
  - ⬜ l.434-503 « INDEX DES PNJ » — bruit de scénario, 0 réf

## MSR — ✅ 0 · 📖 1 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | PREFACE - Un peu d'histoire | ➖ hors-règle | |
| 02 | INTRODUCTION | ➖ hors-règle | |
| 03 | CHAPITRE 1 - De Bogenhafen a Altdorf | ➖ hors-règle | |
| 04 | CHAPITRE 2 - D'Altdorf a Kemperbad | ➖ hors-règle | |
| 05 | CHAPITRE 3 - De Kemperbad aux Cretes noires | ➖ hors-règle | |
| 06 | CHAPITRE 4 - De Grissenwald aux Collines steriles | ➖ hors-règle | |
| 07 | CHAPITRE 5 - D'Unterbaum a Wittgendorf | ➖ hors-règle | |
| 08 | CHAPITRE 6 - Wittgendorf | ➖ hors-règle | |
| 09 | CHAPITRE 7 - Chateau von Wittgenstein | ➖ hors-règle | |
| 10 | CHAPITRE 8 - Une halte en chemin | ➖ hors-règle | |
| 11 | APPENDICE I - L'entrainement et les mentors | 📖 | catalogue (catalogue-*.md) |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **MSR 11** (APPENDICE I - L'entrainement et les mentors) :
  - 📖 l.7-25 « Josef Quartjin » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.26-101 « LE SORCIER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.102-140 « LE MÉDECIN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.141-359 « LE RANÇONNEUR » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.360-419 « CHRONOLOGIE DE L'AVENTURE » — transcrit en catalogue, jamais traité, 0 réf

## PDT — ✅ 2 · 📖 2 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 01 | Avant-propos | ➖ hors-règle | |
| 02 | Introduction | ➖ hors-règle | |
| 03 | En route vers Middenheim | ➖ hors-règle | |
| 04 | Middenheim | ➖ hors-règle | |
| 05 | LE PLAN MACHIAVELIQUE | ➖ hors-règle | |
| 06 | Enquetes preliminaires | ➖ hors-règle | |
| 07 | LE CARNAVAL | ➖ hors-règle | |
| 08 | Les pouvoirs en place | ➖ hors-règle | |
| 09 | LE TRAITRE DEMASQUE | ➖ hors-règle | |
| 10 | Fiches de PNJ | 📖 | catalogue (catalogue-*.md) |
| 11 | doppleganger | 📖 | catalogue (catalogue-*.md) |
| 12 | HYPNOTISME | ✅ | 6 (4e/competences.md ×6) |
| 13 | POINTS D'EXPERIENCE | ✅ | 6 (4e/avancement.md ×6) |
| 14 | CALENDRIER DES ATTRACTIONS PRINCIPALES | ➖ hors-règle | |

**Sections trouées/cataloguées/enfouies** (niveau de heading H3 adaptatif) :

- **PDT 10** (Fiches de PNJ) :
  - 📖 l.7-24 « LE CHANCELIER : JOSEF SPARSAM » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.25-28 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.29-32 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.33-38 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.39-42 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.43-46 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.47-53 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.54-81 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.82-89 « Secret mortel : Un problème de poudre » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.90-96 « REMARQUE SUR LES POSSESSIONS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.97-118 « LE CHAMPION DU GRAF : DIETER SCHMIEDEHAMMER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.119-122 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.123-126 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.127-132 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.133-136 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.137-147 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.148-177 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.178-194 « Secret mortel : Hypnotisé ! » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.195-213 « LE MÉNESTREL DE LA COUR : RALLANE LAFAREL » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.214-217 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.218-221 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.222-227 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.228-240 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.241-248 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.249-297 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.298-301 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.302-305 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.306-311 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.312-320 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.321-324 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.325-332 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.333-360 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.361-392 « REMARQUE SUR LES TRAITS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.393-396 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.397-400 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.401-410 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.411-419 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.420-423 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.424-431 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.432-457 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.458-464 « Secret mortel : Le mouton noir » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.465-468 « LES MIDDENMARSHALLS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.469-482 « Le Commandant de la Garde Ulrich Schutzmann » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.483-510 « Le Général Johann Schwermutt » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.511-514 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.515-518 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.519-522 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.523-526 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.527-562 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.563-586 « LES SORCIERS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.587-593 « ALBRECHT HELSEHER, GRAND SORCIER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.594-619 « JANNA EBERHAUER, SUPPLÉANTE DU GRAND SORCIER » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.620-623 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.624-627 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.628-631 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.632-638 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.639-642 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.643-648 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.649-679 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.680-683 « LE GRAND PRÊTRE AR-ULRIC JARRICK VALGEIR » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.684-708 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.709-712 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.713-718 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.719-722 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.723-731 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.732-761 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.762-778 « Secret Mortel : le chantage » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.779-793 « LA FAVORITE : EMMANUELLE SCHLAGEN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.794-797 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.798-801 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.802-807 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.808-818 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.819-822 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.823-828 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.829-861 « Autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.862-879 « LE CHEVALIER ÉTERNEL : SIEGFRIED PRUNKVOLL » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.880-887 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.888-896 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.897-900 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.901-904 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.905-908 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.909-957 « Autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.958-961 « GRAND VENEUR : ALLAVANDREL FANMARIS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.962-965 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.966-969 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.970-982 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.983-986 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.987-994 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.995-1027 « Autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1028-1042 « LE KOMMISSION CONVENOR : GOTTHARD WALLENSTEIN » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1043-1046 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1047-1050 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1051-1059 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1060-1065 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1066-1119 « Autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1120-1123 « LE MÉDECIN DU BARON, HERR DOKTOR LUIGI PAVAROTTI » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1124-1127 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1128-1131 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1132-1135 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1136-1144 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1145-1148 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1149-1152 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1153-1184 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1185-1193 « Luigi vs Hildergarde » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1194-1209 « LES DAMES DE LA COUR » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1210-1240 « Kirsten Jung » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1241-1244 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1245-1248 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1249-1256 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1257-1275 « Connaissances » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1276-1316 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1317-1320 « LES SEIGNEURS DES LOIS » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1321-1334 « Reiner Ehrlich » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1335-1375 « Joachim Hoflich » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1376-1379 « Rôle » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1380-1385 « Lieux » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1386-1400 « Attitude » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1401-1404 « Idées fausses » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1405-1412 « Objectifs » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1413-1442 « Les autres PNJ » — transcrit en catalogue, jamais traité, 0 réf
  - 📖 l.1443-1448 « Secret mortel : La Main Pourpre » — transcrit en catalogue, jamais traité, 0 réf
- **PDT 11** (doppleganger) :
  - 📖 l.5-23 « MAL DANS TA PEAU » — transcrit en catalogue, jamais traité, 0 réf
- **PDT 12** (HYPNOTISME) :
  - ⬜ l.9-10 « La Compétence » — bruit de scénario, 0 réf
- **PDT 13** (POINTS D'EXPERIENCE) :
  - ⬜ l.81-82 « ANNEXE V » — bruit de scénario, 0 réf
<!-- sources-empreinte: fa057014bb78cb7b35d9aba38887a6b2d4cbcad5 (468 fichiers, 20 dossiers) corps: 21843b7a83d1443cafc7dc96cd7a9d1f0734942f -->
