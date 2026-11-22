# Maquettes Godot : tables d'essai de la grammaire (étape 2)

Ticket: #4585
(#4585 : vérification du contenu entre états et restes de la revue des maquettes.)

## Synthèse pour trancher

1. **Catalogue** (`hotes/godot/cibles/propositions/kit.md`, § « Catalogue ») : 20 natures comptées, 141 variantes aujourd'hui plus 48 surcharges d'identité, dont 51 variantes propres à un seul type d'état (portée lue au code, pas mesurée sur les 170 états) ; cible proposée : 64. Les tables d'essai ajoutent 10 natures (21 variantes, cible 11).
2. **Grammaire** (`hotes/godot/cibles/propositions/dispositions.md`, § « Grammaire de table ») : les cinq formes de la règle 3 ne suffisent pas. Il en faut huit de plus (D1 à D8), toutes déclaratives.
3. **Tables d'essai** (ce document) : `voyage`, la fiche du héros et les huit pages de la création s'écrivent sans fonction d'écran, à deux conditions : les ajouts D1 à D8, et 21 valeurs que le rendu calcule aujourd'hui passent dans l'état. Trois cas restent à la limite (§ « Verdict »).
4. **Dictionnaire** (`dispositions.md`, § « Dictionnaire des libellés ») : un fichier, id vers texte, avec des trous nommés.

Questions qui vous reviennent :

- **Q1.** Les 51 variantes propres à un écran restent-elles toutes nommées au catalogue jusqu'à l'harmonisation (règle 7), ou fixez-vous un plafond ?
- **Q2.** Admettez-vous les huit déclarations D1 à D8, ou certaines doivent-elles devenir des champs de l'état ?
- **Q3.** L'état porte-t-il les 21 valeurs que le rendu calcule (somme des DR, réussite ou échec, −/+ ouverts, teintes de compte) ? Si oui, `maquette.ts` et les fichiers d'états changent dans les lots de migration.
- **Q4.** Une entrée du dictionnaire peut-elle porter des trous et un pluriel (« {n} km avant {lieu} »), ou seulement un mot fixe ?

## Sources et notation

Plan : `docs/plans/2026-11-21-maquettes-en-donnees.md`, étape 2. Abréviations : `S/` = `hotes/godot/cibles/propositions/sources/`, `R` = `S/rendu.js`, `M` = `S/maquettes/maquette.ts`. Lu sur `chantier/4585-catalogue`, tête `b6e98bdb04`.

La grammaire est définie dans `dispositions.md`. Rappel de la notation des tables :

- `place  nature(param ← source)` : un champ de l'état va à une nature du catalogue, dans une place ;
- sources : `chemin` (champ de l'état, relatif à l'élément courant ; `état.` repart de la racine), `#id` (libellé du dictionnaire), `'x'` (variante nommée du catalogue), `chemin → TABLE` (référence par id) ;
- `?` : optionnel ; `chaque chemin :` : liste ; `selon chemin { 'a' : … }` : alternative sur un littéral ;
- D1 à D8 : les déclarations ajoutées, marquées à chaque emploi ;
- `[état]` : la valeur n'existe pas encore dans l'état, le rendu la calcule aujourd'hui ; son numéro renvoie à la liste « Valeurs à porter par l'état ».

## Table `voyage`

Source : `R:973-982` (corps de `voyage`), ses aides `R:878-888`, `R:905-923`, `R:937-970` ; type `Voyage` `M:669-685`. Neuf états la traversent (`voyage-fluvial` 2, `voyage-en-mer` 4, `evenement-de-route` 3) ; dans les neuf, `groupe` et `fenetre` s'excluent (relevé par import des états).

```
table voyage : Voyage            role = 'voyage'  (aujourd'hui : decor ∈ route | fleuve | traversee, R:1755-1757)
tables déclarées
  héros        ← état.groupe, clé id (nom, prénom [état 1])
  combattants  ← état.combattants
  PICTO_DU_TEMPS, PICTO_A_OUVRIR, PICTO_DU_ROLE, EAU_DU_DECOR      (kit, clé id)
  CADENCES     ← 'jourParJour' | 'commande'                        (kit, ordre fixe ; R:943)
  VIGNETTES    ← peintres d'illustration, clé arret.vignette

titre               temps(teinte ← titre.lumiere, jour ← titre.jour,
                          date ← suite[ titre.date.jour, titre.date.mois, #voyage.jour.{decor}(n ← titre.jourDeVoyage) ],   D7
                          ciel ← titre.meteo.ciel, icone ← titre.meteo.temps → PICTO_DU_TEMPS)
recit               ? recit(rubrique ← recit.rubrique, texte ← recit.texte)
trajet              illustration trajet(titre ← trajet.titre, de ← trajet.de, vers ← trajet.vers, part ← trajet.part,
                                        eau ← état.decor → EAU_DU_DECOR)
colonne-droite-basse  cadre(matière 'bois', ruban ← navire.nom sinon #voyage.titre)          D1 ; vide ⇒ absent D2
  /plein            ? navire.etat :
                        mesure(libellé #navire.coque, compte ← coque {blessures, max}, teinte 'or', taille 'forte')
                        mesure(libellé #navire.moral, compte ← {moral, 100 [état 2]}, teinte 'or', taille 'forte')
                        ligne(libellé #navire.eau, valeur ← eau, format milliers, unité #unite.litre)
                        ligne(libellé #navire.vivres, valeur ← vivres, format quantité #mot.ration)
  /geste            ? titre.cadence :
                        rubrique(libellé #voyage.cadence)
                        chaque CADENCES : plaque(libellé #cadence.{id}, armée ← id = titre.cadence, taille 'petite')   D3, D4
ouvrir-{rang}       chaque ouvrir : ouvrir(libellé #ouvrir.{id}, icone ← id → PICTO_A_OUVRIR)                           D5
frise               ? illustration frise(part ← frise.part, de ← frise.de, vers ← frise.vers, nuits ← frise.nuits,
                                         reste ← #voyage.reste.{unite}(n ← frise.reste, lieu ← frise.vers))               D7
apercu              ? selon apercu.role {
                        'jet' : apercu(nom ← apercu.test, sous ← suite[ apercu.qui → héros.prénom, apercu.poste ? ],
                                       vers 'bas', ancre ← apercu.qui → héros,                                           D6
                                  corps : ligne(#jet.seuil, suite[ difficulte.nom, difficulte.valeur format signé, seuil ])
                                          ligne(#jet.de, valeur ← de, format d100)
                                          ligne(#verdict.{issue [état 3]}, valeur ← dr, format DR signé)
                                          ? effet : ligne(libellé ← effet.nom, valeur ← effet.vitesse, format % signé, unité #unite.vitesse)
                                  pied  : reserves(chance ← {qui, valeur ← chance}))
                        'equipage' [état 4] :
                                apercu(nom ← apercu.nom, sous ← apercu.test, vers 'bas',
                                  corps : chaque lignes : ligne(libellé ← suite[ qui → combattants.nom, poste ],
                                                                valeur ← dr, format DR signé, marque 'double' ? double)
                                          ligne(#equipage.somme, valeur ← somme [état 5], format DR signé, variante 'somme')
                                  pied  : ? reserves(chaque chance : {qui, valeur}))
                      }
carton              ? arret : cadre(matière 'parchemin', ruban ← arret.ruban)
  /vignette             illustration vignette(dessin ← arret.vignette → VIGNETTES)
  /tete                 titre(texte ← arret.titre, variante 'evenement')
                        sousTitre(suite[ arret.ou, ? arret.marins format quantité #mot.marin,
                                         ? arret.jour : #voyage.jour.{decor}(n ← état.titre.jourDeVoyage) ])              D7
  /texte                defile(prose(texte ← arret.texte))
  /de                   ? arret.de : sceau(valeur ← de.valeur, taille 'maitre', dé ← de.de)        place à créer (aujourd'hui hors place, R:969)
  selon arret.choix.role [état 6] {
    'cartes' : /choix   chaque choix.cartes : table carte
    'paies'  : /paies   chaque choix.cartes : table carte
               /parts   cadre(matière 'bois') : bourse(parts ← choix.parts, héros ← .heros → héros)
  }
  /geste                ? choix : plaque(libellé ← choix.geste.libelle, armée ← choix.geste.principal)
bas                 selon état.bas [état 7] { 'groupe' : table bandeau(groupe) ; 'fenetre' : table fenetre(fenetre) }      D8
coins               coins()
```

### Ce que les cinq formes n'expriment pas, dans `voyage`

| # | Cas, source | Verdict |
|---|---|---|
| V1 | Ruban du cadre : le nom du navire, sinon « Le voyage » (`R:947`) | déclaration D1 (repli) |
| V2 | Le cadre du navire existe si `navire` ou `titre.cadence` (`R:975`) | déclaration D2 (un conteneur aux emplacements tous vides ne s'émet pas ; `places` filtre déjà les vides, `S/gestes.js:320`) |
| V3 | Les deux cadences sont une liste du rendu (`R:943`), pas un champ | déclaration D3 (liste sur une table déclarée) |
| V4 | Plaque armée quand son id égale `titre.cadence` (`R:944`) | déclaration D4 (désigné par id) |
| V5 | `ouvrir(…, k + 1)` : la pièce dépend du rang (`R:976`) | déclaration D5 (liste sur places numérotées) |
| V6 | Le billet du jet se pose par `left`, `bottom` et `--pointe` calculés depuis le rang du héros dans `groupe` (`R:952`) | déclaration D6 (ancre par référence) ; le calcul passe dans le moteur des bulles (`poserLesBulles`, `S/gestes.js:254`) |
| V7 | Textes composés : date et jour de voyage (`R:882`, `R:879`), sous-titre du carton (`R:959`), « N km avant X » (`R:917`) | déclaration D7 (suite de fragments) et libellés à trous |
| V8 | `fenetre` prend la place du `groupe` (`R:980`) ; le type admet les deux (`M:683-684`) | champ d'état 7, ou D1 étendu à une place (« sinon ») |
| V9 | `'role' in v.apercu` (`R:978`) : `ApercuDuTest` n'a pas de littéral (`M:555`) | champ d'état 4 |
| V10 | `choix.parts` change la place (`choix` ou `paies`) et ajoute les parts (`R:965-967`) | champ d'état 6 |
| V11 | Somme des DR par `reduce` (`R:923`) ; « Réussite » ou « Échec » par `a.de <= a.seuil` (`R:954`) ; Moral sur 100 (`R:938`) ; prénom par `split` (`R:1109`) | champs d'état 5, 3, 2, 1 |
| V12 | Le sceau du dé est écrit hors de toute place (`R:969`) | une place `carton/de` à déclarer dans `PLACES`, à son rect actuel |
| V13 | Le décor lit l'état (`R:985-991` : `decor`, `vapeur`, `arret.vignette`) | hors grammaire : peintre de décor (règle 5), keyé par ces trois champs |

Clôture sur le relevé `brut` des neuf états (`dist/maquettes-passe/contenus/`) : `div.cadence` → rubrique + plaques ; `table` de l'aperçu → lignes ; `div.etat-du-navire` → mesures et lignes ; `div.vignette` → illustration ; `div.tete` → titre + sous-titre ; `p` → prose ; `div.choix` → cartes ; `div.cadre` → cadre. Aucun sélecteur sans nature. Les 3 à 7 textes d'illustration (`#trajet`, `#frise`) passent par des primitives de texte keyées (règle 5).

## Table `fiche-du-heros`

Source : `R:1652-1667` (`ficheDuHeros`), aides `R:1621-1649` ; type `FicheDuHeros` `M:1656-1669`. Quatre états, tous sur la section `possessions`.

```
table fiche-du-heros : FicheDuHeros          role = 'fiche-du-heros'  (aujourd'hui : 'sets' in e, R:1720)
tables déclarées
  héros     ← état.groupe, clé id
  SECTIONS  ← 'attaques' | 'competences' | 'talents' | 'sorts' | 'possessions'   (kit, ordre fixe ; R:1651)

fond                fond(matière 'bois')                                            (aujourd'hui `#mur` écrit sur place, R:1655)
identite            cadre(matière 'parchemin')
  /tete               identité(portrait ← identite.id, nom ← identite.nom, lignes ← [ identite.espece, identite.carriere ])
  /mesures            mesure(libellé #heros.blessures, compte ← identite.blessures, teinte 'cire', taille 'forte')
  /reserves           filet('fondu-losange')
                      reserves(chaque identite.reserves : table jeton-de-reserve, taille 'grand')
profil              cadre(matière 'parchemin', ruban #heros.caracteristiques)
                      chaque profil : caseDeProfil(abréviation ← carac, valeur ← valeur)
figure              cadre(matière 'bois') : niche(illustration figure(pose ← identite.pose [état 8]))
sections            cadre(matière 'parchemin',
                          tête : onglets(chaque SECTIONS : libellé #section.{id}, présent ← id ∈ sections, ouvert ← id = ouverte))   D3, D4, D5
                      selon ouverte {
                        'possessions' :
                          rubrique(libellé #fiche.panoplies, note #fiche.panoplies.note)
                          chaque sets : panoplie(
                              principale ← selon principale.etat [état 9] { 'tenue' : main(#main.principale, icone ← id, nom ← nom) ; 'vide' : main(#main.principale, #main.vide) }
                              secondaire ← selon secondaire.etat [état 9] { 'tenue' : … ; 'vide' : main(#main.secondaire, #main.vide) ; 'prise' : main(#main.secondaire, #main.prise) }
                              tenue ← enMain, ôter : rond('croix', taille 'menu', fermé ← refus ?), ? survol : raison(refus))
                          panoplie(variante 'neuve')
                          rubrique(#fiche.porte)     chaque porte : ligneDeListe(icone ← id, nom ← nom, précision ← precision ?,
                                                                               fin ← selon lieu.role [état 10] { 'range' : ou ; 'compte' : nombre format ×n }, choisie ← pressee)
                          rubrique(#fiche.vrac)      chaque vrac  : (même ligne)
                          ? faveurs : rubrique(#fiche.faveurs)
                                      chaque faveurs : ligneDeListe(marque sceau 'parchemin', nom ← creancier,
                                                                    fin ← suite[ niveau, solde format compte ], choisie ← pressee)       D7
                          ouvert : cartouche(icone ← ouvert.icone, nom ← ouvert.nom, sous ← ouvert.sous)
                                   ? ouvert.faits        : chaque : ligne(libellé ← rubrique, valeur ← valeur, variante 'empilee')
                                   ? ouvert.lier         : rubrique(#objet.lier, note #objet.lier.note)
                                                           chaque : ligneDeListe(puce ← choisi, nom ← nom, fin ← ni format NI)
                                   ? ouvert.entrainement : rubrique(#objet.entrainement, fin : etiquette(#px.a-depenser(n ← px), teinte 'or'))
                                                           chaque paliers : ligneDeListe(puce ← acquis, nom ← texte,
                                                               fin ← selon acquis { true : note(#px.acquis(n ← px)) ; absent : plaque(valeur ← px format PX, taille 'petite') })
                                   ? ouvert.faveur       : prose(texte ← faveur.nature)
                                                           ligne(#faveur.activites, valeur ← faveur.solde, format compte)
                                                           ligne(#faveur.rompre, valeur ← faveur.rompre)
                                   chaque ouvert.gestes : plaque(libellé ← libelle, armée ← principal, fermée ← refus ?, vers ← vers ?,
                                                                 taille 'petite', ? survol : raison(refus))
                        'attaques' | 'competences' | 'talents' | 'sorts' : aucun état ne les montre (voir F1)
                      }
bas                 table bandeau(groupe)
fermer              croix()
coins               coins()
```

### Ce que les cinq formes n'expriment pas, dans la fiche du héros

| # | Cas, source | Verdict |
|---|---|---|
| F1 | `ficheDuHeros` ne lit `f.ouverte` que pour l'onglet (`R:1664`) : seule la section des possessions est dessinée | constat, hors grammaire : la table ne peut pas inventer les quatre autres sections ; elles restent à maquetter |
| F2 | Les onglets parcourent une liste fixe du rendu, filtrée par `sections`, et gardent le rang de chaque onglet absent (`R:1664`, `S/gestes.js:331`) | D3 + D5 ; l'appartenance `id ∈ sections` est une forme de D4 (désigné par une liste d'ids) |
| F3 | `figure(1)` : la pose est une constante du rendu (`R:1658`) | champ d'état 8, ou illustration sans paramètre |
| F4 | Main tenue, vide ou prise : `Main` vaut `null` (`M:1600`) et « Prise » vient d'un drapeau du set (`R:1636-1637`) | champ d'état 9 (un littéral par main) |
| F5 | `o.ou`, sinon « × nombre » (`R:1639`) : alternative par présence | champ d'état 10, ou D1 |
| F6 | `refus && survol` (`R:1638`, `R:1641`) | exprimable : deux optionnels emboîtés, un drapeau `true` ou absent vaut un discriminant à deux valeurs |
| F7 | « Rompre : … » (`R:1647`), « N PX à dépenser » (`R:1645`), « N PX · acquis » (`R:1645`) | libellés à trous (dictionnaire) |
| F8 | Le « + » d'une panoplie neuve est écrit sur place (`R:1660`) | variante `neuve` de la nature panoplie |
| F9 | Le libellé de plaque reçoit la bulle de refus collée dans son texte (`R:1641`) | la plaque reçoit `refus` et `survol` en paramètres et pose elle-même la bulle |

Clôture sur le relevé `brut` des quatre états : `div.tete` → identité ; `div.bl` → mesure ; `div.c` ×12 → case de profil ; `div.niche` → niche ; `div.rub` → rubrique ; `div.sets` → panoplies ; `div.inventaire` → lignes de liste et objet ouvert. Aucun sélecteur sans nature.

## Table `creation`

Source : `R:1610-1618` (`creation`), `R:1506-1609` (`ETAPES_DE_CREATION`), `R:1482-1500` ; type `Creation` `M:1589-1597`. Douze états, huit pages ; le littéral `page.etape` existe déjà (`M:1437`, `M:1454`…).

```
table creation : Creation                    role = 'creation'  (aujourd'hui : 'etapes' in e, R:1720)
tables déclarées
  héros   ← état.groupe, clé id
  profil  ← page.profil, clé carac        (pages 'caracteristiques' et 'presentation')
  PALIERS ← 0 | 3 | 5                     (kit ; R:1541)

fond                fond(matière 'bois')
etapes              cadre(matière 'bois') : chemin(étapes ← etapes, rang ← rang, variante 'etapes') ; croix(dans le panneau)
choix               cadre(matière 'parchemin', marque ← page.etape)      : selon page.etape { … /choix de chaque page … }
detail              cadre(matière 'parchemin', ruban ← (par page), marque ← page.etape) : selon page.etape { … /detail … }
heros-neuf          cadre(matière 'bois')
                      niche(illustration figure(pose ← heros.pose, palette ← heros.palette))
                      nom(texte ← heros.nom sinon #creation.nouveau-heros)                                              D1
                      chaque heros.acquis : selon .role [état 11] {
                          'retenu' : ligne(libellé ← rubrique, ? px : etiquette(valeur ← px format +PX),
                                           valeur ← suite[ valeur, ? bourse : #acquis.bourse(somme ← bourse format prix) ], variante 'acquis')
                          'compte' : ligne(libellé ← rubrique, valeur ← valeur format compte « n sur m », variante 'acquis')
                          'total'  : ligne(libellé ← rubrique, valeur ← px format PX, variante 'acquis-total') }
                      plaque(libellé ← heros.geste.libelle, icone-de-fin 'chevron_d', armée/fermée ← refus ?, ? survol : raison(refus))
                      plaque(libellé #creation.precedent, icone 'chevron_g', taille 'petite')
bas                 table bandeau(groupe)
coins               coins()
```

Les huit pages, chacune avec ses places de `choix`, son ruban et son détail :

```
'caracteristiques'      ruban #creation.profil                                                       R:1507-1524
  choix/rangee-1        rubrique(#creation.methode)
                        chaque page.methodes : ligneDeListe(puce ← id = page.methode, nom ← nom,                          D4
                                                            fin ← ? px : etiquette(valeur ← px format +PX, teinte ← 'or' si désignée))
  choix/rangee-2        selon page.methode {
                          'points' : etiquette(#compte.a-repartir(compte ← points.reste), teinte ← points.reste.etat [état 12])
                                     note(#creation.points.bornes(min ← points.min, max ← points.max))
                          'garder' | 'reassigner' : sceau('des', taille 'moyen') ; rubrique(#creation.dix-2d10, note #mot.tires)
                                     plaque(libellé #creation.relancer, prix #px.sans, taille 'petite') }
  choix/rangee-{3+rang} chaque page.repartitions :                                                                         D5
                          filet('fondu-losange')
                          rubrique(libellé ← rubrique, note ← note, fin : etiquette(#compte.a-repartir(compte ← reste), teinte 'or'))
                          chaque lignes : ligneDeListe(marque ← ? carac : etiquette(carac, variante 'carac'), nom ← nom,
                                             fin : clous(compte ← augmentations) ; moinsPlus(moins ← moins [état 13], plus ← plus [état 13]) ; valeur ← valeur)
  detail                profil(chaque page.profil : caseDeProfil(abréviation ← carac, valeur ← valeur, désignée ← carac = page.pressee,   D4
                                 porte ← selon .source [état 14] { 'origine' : origine ; 'points' : points ; 'de' : sceau(de, 'petit') },
                                 ? moinsPlus(moins ← moins [état 13], plus ← plus [état 13])))
                        nomDuDetail(nom ← page.pressee → profil.nom,
                                    sous ← #creation.formule.{methode}(points | de ← …, espece ← page.espece.valeur, nom ← page.espece.nom,
                                                                       n ← page.pressee → profil.augmentations))            D7
                        selon page.methode {
                          'reassigner' : rubrique(#creation.jet-de(nom ← page.pressee → profil.nom), note #creation.jet.note)
                                         chaque page.jets : jetTire(de ← de, carac ← carac, pris ← carac = page.pressee)    D4
                          'garder' | 'points' : filet('fondu-losange') ; prose(texte ← page.texte) }
                        chaque page.faits : ligne(libellé ← rubrique, valeur ← valeur, variante 'empilee')

'signe'                 ruban ← page.page.constellation                                             R:1525-1533
  choix/rangee-1        tirage(sceau ← tirage.de, taille 'maitre', rubrique(#signe.au-d100, note #mot.tire),
                               ligneDeListe(puce cochée, nom ← tenu, fin : etiquette(valeur ← tirage.px format +PX, teinte 'or')),
                               note(#signe.garde))
  choix/rangees-2-3     rubrique(#signe.astral)
                        defile(chaque page.signes : ligneDeListe(puce ← . = page.tenu, nom ← .), variante 'liste')         D4
  choix/rangee-4        filet('fondu-losange') ; sceau(taille 'petit', état 'vide')
                        rubrique(#signe.variante, note #signe.variante.note)
                        chaque page.variantes : etiquette(marque ← d10, texte ← nom, variante 'pastille')
  detail                illustration ciel() ; nomDuDetail(nom ← page.tenu) ; filet('fondu-losange')
                        ligne(#signe.classique, valeur ← page.page.classique, variante 'empilee')
                        ligne(#signe.dates,     valeur ← page.page.dates,     variante 'empilee')
                        ligne(#signe.ciel,      valeur ← page.page.ciel,      variante 'empilee')
                        rubrique(#signe.attributs)
                        chaque page.page.attributs : etiquette(suite[ carac, valeur format signé ], teinte ← ton [état 15])
                        prose(texte ← page.page.texte)

'competencesDeRace'     ruban ← page.espece                                                         R:1534-1545
  choix/corps           rubrique(#race.competences, fin : plaque(libellé #race.repartition-par-defaut, taille 'petite'))
                        defile(chaque page.competences : ligneDeListe(marque : etiquette(carac, 'carac'), nom ← nom, précision ← precision ?,
                                   fin : chaque PALIERS : palier(valeur ← ., état ← paliers.{.} [état 16])), variante 'liste')     D3
  choix/pied            chaque page.paliers : etiquette(#race.a-palier(palier ← palier, compte ← pris), teinte ← pris.etat [état 12])
  detail                nomDuDetail(nom #race.competences, sous ← suite[ chaque page.paliers : #race.n-a-palier(n ← pris.sur, palier ← palier) ])   D7
                        filet('fondu-losange')
                        chaque page.paliers : rubrique(#race.augmentations-a(palier ← palier))
                                              chaque groupe [état 17] : carteDeCompetence(carac, valeur ← valeur [état 18], nom, précision ?, calcul)
                                              complétée à pris.sur par carteDeCompetence(variante 'a-choisir', #race.a-choisir)
                        illustration filigrane()

'competencesDeCarriere' ruban ← page.niveau                                                         R:1546-1558
  choix/corps           rubrique(#carriere.competences, fin : plaque(libellé #carriere.repartition-simple, taille 'petite'))
                        defile(chaque page.competences : ligneDeListe(marque : etiquette(carac, 'carac'), nom, précision ?, choisie ← pressee,
                                   fin : palier(valeur ← race, variante 'race') ; clous(compte ← augmentations) ;
                                         moinsPlus(moins [état 13], plus [état 13]) ; valeur ← test), variante 'liste')
  choix/pied            etiquette(#compte.a-repartir(compte ← reste), teinte 'or') ; note(#carriere.plafond(n ← page.plafond [état 19]))
                        palier(valeur 5, variante 'race') ; note(#carriere.race.note(reste ← reste.sur, n ← page.plafond))
  detail                nomDuDetail(nom ← page.pressee [état 20] → competences.nom, sous ← suite[ précision ?, page.page.carac.nom ])
                        filet('fondu-losange')
                        disque(valeur ← test, taille 'grand') ; ligne(#mot.test, valeur ← #carriere.test(carac, valeur, n), variante 'empilee')
                        rubrique(#carriere.specialisation(nom))
                        chaque page.page.specialisations : etiquette(texte ← ., variante 'pastille', prise ← . = précision)        D4
                        chaque page.page.texte : prose(texte ← .)

'talents'               ruban #talents.de-carriere                                                  R:1559-1574
  choix/rangee-1        rubrique(#talents.de-race)
                        chaque page.race.acquis : ligneDeListe(puce cochée armée, nom ← ., fin : note(#mot.acquis))
  choix/rangee-2        rubrique(#mot.au-choix) ; chaque page.race.auChoix : table option
  choix/rangee-3        filet('fondu-losange') ; rubrique(#talents.au-d100(n ← page.tirages longueur))
                        chaque page.tirages : tirage(sceau ← de, taille 'petit', nom ← nom, précision ?,
                                                 ? doublon : note(doublon.raison) ; plaque(libellé ← doublon.relance, taille 'petite'),
                                                 ? utilisation : etiquette(#talents.utilisation, icone-de-fin 'chevron_d', variante 'pastille'))
  choix/rangee-4        filet('fondu-losange') ; rubrique(#talents.de-carriere, note #mot.un-seul) ; chaque page.carriere : table option
  detail                selon page.page.role [état 21] {
                          'talent' : medaillon(icone ← icone) ; nomDuDetail(nom ← talent, sous ← niveau) ; filet('fondu-losange')
                                     ligne(#talents.maxi, valeur ← maxi, 'empilee') ; ligne(#talents.tests, valeur ← tests, 'empilee')
                                     prose(texte ← texte) ; illustration filigrane()
                          'sorts'  : nomDuDetail(nom ← talent, sous ← niveau)
                                     rubrique(#talents.sorts(talent, n ← reste.sur), fin : etiquette(#compte.a-repartir(compte ← reste), teinte 'or'))
                                     chaque sorts : etiquette(texte ← nom, variante 'pastille', prise ← retenu, ? survol : raison(page.page.refus))
                                     prose(texte ← texte, variante 'pied') }

'possessions'           ruban #creation.possessions                                                 R:1575-1586
  choix/rangee-1        tirage(sceau ← bourse.de, taille 'maitre', rubrique(#mot.bourse), valeur ← bourse.somme format prix,
                               rubrique(#bourse.statut(statut ← bourse.statut), note ← bourse.formule))
  choix/rangee-2        rubrique(#bagage.au-choix(niveau ← auChoix.niveau), note #mot.un-seul) ; chaque auChoix.options : table option
  choix/rangee-{3+rang} chaque page.dotations : filet('fondu-losange') ; rubrique(libellé ← rubrique)                      D5
                          defile(chaque objets : ligneDeListe(nom, précision ?, fin ← suite[ note ?, nombre ? format ×n ]), variante 'liste')   D7
  detail                nomDuDetail(nom #bagage.titre, sous ← #bagage.sous(n ← bagage longueur, bourse ← bourse.somme format prix))
                        filet('fondu-losange')
                        chaque page.bagage : objet(illustration ← id, nom ← nom, note ← suite[ note ?, nombre ?, somme ? format prix ], choisi ← choisi)
                        cartouche(icone ← pris.icone, nom ← pris.nom, sous ← pris.sous) ; valeur ← pris.prix format prix

'identite'              ruban #creation.identite                                                    R:1587-1597
  choix/rangee-1        rubrique(#identite.sexe, fin : chaque sexe.valeurs : plaque(libellé ← ., armée ← rang = sexe.tenue, taille 'petite'))   D4
                        rubrique(#identite.nom, note #identite.nom.note, fin : plaque(libellé #identite.nom-aux-des, icone 'de20', taille 'petite'))
                        saisie(texte ← nom)
  choix/rangee-3        filet('fondu-losange')
                        rubrique(#identite.physique, note #identite.physique.note, fin : plaque(libellé #identite.physique-aux-des, icone 'de20', taille 'petite'))
                        chaque page.physique : tirage(sceau ← de, taille 'moyen', rubrique(libellé ← nom, note ← formule), valeur ← valeur)
  detail                nomDuDetail(nom ← nom, sous ← suite[ espece, carriere ]) ; filet('fondu-losange')
                        chaque page.physique : ligne(libellé ← nom, valeur ← valeur, variante 'empilee')
                        chaque page.ecrits : saisie(libellé ← nom, texte ← texte, en saisie ← saisi)
                        illustration signature() ; sceau(valeur ← marque, taille 'moyen')

'presentation'          ruban ← page.carriere                                                       R:1598-1608
  choix/corps           identité(portrait ← buste, nom ← nom, lignes ← [ espece, suite[ carriere, classe ] ],
                                 faits : chaque physique : ligne(libellé ← rubrique, valeur ← valeur, 'empilee'))
                        mesure(libellé #heros.blessures, compte ← blessures, taille 'forte')
                        filet('fondu-losange') ; reserves(chaque reserves : table jeton-de-reserve, taille 'grand') ; filet('fondu-losange')
                        ligne(#signe.astral, valeur ← signe, 'empilee') ; ligne(#mot.statut, valeur ← statut, 'empilee')
                        ligne(#mot.bourse, valeur ← bourse format prix, 'empilee')
  choix/pied            rubrique(#identite.motivation) ; prose(texte ← motivation, variante 'manuscrite')
  detail                profil(chaque page.profil : caseDeProfil(abréviation ← carac, valeur ← valeur))
                        rubrique(#mot.competences) ; chaque page.competences : ligneDeListe(nom, précision ?, fin : valeur ← valeur)
                        rubrique(#mot.talents)     ; chaque page.talents : etiquette(texte ← ., variante 'pastille')
```

`table option` (partagée, `R:1472`) : `ligneDeListe(puce ← choisie, nom ← nom, précision ← precision ?, refusée ← refus ?, ? survol : raison(refus))`.

### Ce que les cinq formes n'expriment pas, dans la création

| # | Cas, source | Verdict |
|---|---|---|
| C1 | `rangee-${k + 3}` : les répartitions et les dotations coulent dans des places numérotées à partir de 3 (`R:1517`, `R:1581`) | déclaration D5 |
| C2 | La ligne désignée par égalité d'id (`m.id === p.methode` `R:1512`, `x.carac === p.pressee` `R:1510`, `s === p.tenu` `R:1527`) ; par rang (`k === p.sexe.tenue` `R:1589`) ; par drapeau sur l'élément (`x.pressee` `R:1547`) | déclaration D4 ; les trois conventions de l'état se ramènent à une (champ d'état 20) |
| C3 | `visee = p.profil.find(…)` (`R:1508`), `c = p.competences.find(…)` (`R:1547`) | référence par id sur une table locale à l'état : forme 5, la table est une liste de l'état |
| C4 | −/+ ouverts par comparaison (`R:1510`, `R:1511`, `R:1550`) ; teinte du compte selon son reste (`R:1515`, `R:1542`) ; état d'un palier lu sur les autres lignes (`R:1535-1536`) ; `c.base + palier` (`R:1537`) ; teinte selon le signe (`R:1532`) | champs d'état 12, 13, 15, 16, 18 : ce sont des faits du jeu (un geste ouvert, un compte atteint), pas de l'affichage |
| C5 | Les compétences groupées par palier, puis complétées par des cases « À choisir » (`R:1538-1539`) | le groupement : champ d'état 17 ; le complément : déclaration D5 (« complétée à ») |
| C6 | `[0, 3, 5]` et `race(5)` écrits dans le rendu (`R:1541`, `R:1552`) | déclaration D3 (table `PALIERS`) |
| C7 | `'sorts' in p.page` (`R:1562`) ; `typeof a.valeur === 'string'` et `a.valeur === undefined` (`R:1494-1496`) ; `x.origine ? … : points ? …` (`R:1509`) | champs d'état 21, 11, 14 |
| C8 | Formules et phrases à nombres (`R:1520`, `R:1515`, `R:1551-1552`, `R:1544`) | libellés à trous, D7 |
| C9 | L'étape faite, en cours ou à venir se déduit de `k` et de `rang` (`R:1482-1485`) | dans la primitive `chemin`, comme `rangDePas(pleins, total)` (`S/gestes.js:362`) : une primitive lit un rang, la table ne calcule rien |
| C10 | Le rail se trace après montage, par mesure du DOM et écriture de `style` (`R:1486-1492`, `R:1712-1718`) | comportement de la primitive `chemin`, au kit, avec `suites` et `paginer` |
| C11 | `classe: pan ${etape} ${classe}` : classe ouverte par page (`R:1614-1615`) | le moteur marque chaque cadre du littéral de son alternative ; la feuille de placement le cible |
| C12 | Le pictogramme collé dans le libellé de la plaque (`R:1499-1500`) | paramètre `icone-de-fin` de la plaque (variante au catalogue) |
| C13 | `h.nom ?? 'Nouveau héros'` (`R:1498`) | déclaration D1 |

Clôture sur le relevé `brut` des douze états : `div.suite` → chemin ; `div.rub` → rubrique ; `div.lignes`, `div.ligne`, `div.deux`, `div.trois` → lignes de liste (le nombre de colonnes est du placement) ; `div.tirage-c`, `div.tirage`, `div.tire`, `div.physique` → tirage ; `div.tete-l` → rubrique avec fin ; `div.page-c` → emplacement du détail ; `div.niche` → niche ; `div.acquis` → nom et lignes ; `div.comptes` → étiquettes et notes ; `div.dot` → ligne de liste ; `div.variante` → sceau, rubrique, étiquettes ; `div.ligne-ecrite` → saisie ; `div.tete`, `div.bl`, `div.faits` → identité, mesure, lignes ; `div.motivation` → prose. Aucun sélecteur sans nature.

## Valeurs à porter par l'état

Ce que le rendu calcule ou devine aujourd'hui et que la grammaire refuse de calculer. Chaque ligne est un champ à ajouter à `M`, donc aux fichiers d'états.

| # | Champ proposé | Remplace | Type concerné |
|---|---|---|---|
| 1 | `prenom` | `nom.split(' ')[0]` (`R:1109`) | `HerosDuGroupe` `M:523`, `Combattant` `M:20` |
| 2 | `moral: { n, sur }` | `n.moral / 100` (`R:938`) | `EtatDuNavire` `M:618` |
| 3 | `issue: Verdict` | `a.de <= a.seuil` (`R:954`) | `ApercuDuJet` `M:638` |
| 4 | `role: 'equipage'` | `'role' in v.apercu` (`R:978`) | `ApercuDuTest` `M:555` |
| 5 | `somme` | `reduce` des DR (`R:923`) | `ApercuDuTest` `M:555` |
| 6 | `choix.role: 'cartes' \| 'paies'` | `a.choix.parts` (`R:965-967`) | `Arret` `M:654` |
| 7 | `bas: 'groupe' \| 'fenetre'` | `v.fenetre ? … : …` (`R:980`) | `Voyage` `M:669`, et les types de lieu qui portent `fenetre?` |
| 8 | `identite.pose` | `figure(1)` (`R:1658`) | `IdentiteDuHeros` `M:1642` |
| 9 | `etat: 'tenue' \| 'vide' \| 'prise'` par main | `null` et `deuxMains` (`R:1636-1637`) | `Main` `M:1600`, `SetDArmes` `M:1604` |
| 10 | `lieu.role: 'range' \| 'compte'` | `o.ou ? … : …` (`R:1639`) | `ObjetDuHeros` `M:1614` |
| 11 | `role: 'retenu' \| 'compte' \| 'total'` | `typeof`, `undefined` (`R:1494-1496`) | `Acquis` `M:1395` |
| 12 | `etat: 'a-tenir' \| 'a-corriger' \| 'epuise'` sur un compte montré | teinte par comparaison (`R:1515`, `R:1542`) | `Compte` `M:1373` |
| 13 | `moins`, `plus` (ouverts ou non) | comparaisons (`R:1510`, `R:1511`, `R:1550`) | `CaseEnCreation` `M:1414`, `Repartition` `M:1426`, `CompetenceDeCarriere` `M:1481` |
| 14 | `source: 'origine' \| 'points' \| 'de'` | `x.origine ? … : points ? …` (`R:1509`) | `CaseEnCreation` `M:1414` |
| 15 | `ton: 'gain' \| 'perte'` | `a.valeur < 0` (`R:1532`) | attributs de `PageDuSigne` `M:1453` |
| 16 | état de chaque palier d'une ligne | `pastille` (`R:1535-1536`) | `CompetenceDeRace` `M:1463` |
| 17 | compétences rangées par palier | `filter` (`R:1538`) | `PageDesCompetencesDeRace` `M:1472` |
| 18 | `valeur` | `c.base + palier` (`R:1537`) | `CompetenceDeRace` `M:1463` |
| 19 | `plafond` | `c.augmentations.sur` lu sur la ligne pressée (`R:1551`) | `PageDesCompetencesDeCarriere` `M:1493` |
| 20 | `pressee: id` sur la page | drapeau `pressee` sur l'élément (`R:1547`) | `PageDesCompetencesDeCarriere` `M:1493` |
| 21 | `page.role: 'talent' \| 'sorts'` | `'sorts' in p.page` (`R:1562`) | `PageDesTalents` `M:1514` |

Le champ 3 est aussi une affaire de règle : le rendu décide seul qu'un jet réussit. Le jeu doit le dire, la maquette n'a pas à le recalculer.

## Verdict sur l'hypothèse du plan

L'hypothèse « la grammaire de table couvre tous les gabarits » tient sur ces deux cas, mais pas avec les cinq formes seules.

- **Aucune fonction d'écran n'est nécessaire**, à condition d'admettre D1 à D8 et les 21 champs d'état.
- **Trois cas deviennent des fonctions si on refuse ces ajouts** :
  1. le billet du jet posé au-dessus de son héros (V6) : sans ancre déclarée, il reste un calcul de pixels par écran ;
  2. les compétences de race groupées et complétées (C5) : sans le champ 17 et « complétée à », c'est un filtre et une répétition ;
  3. les textes à nombres (V7, C8, F7) : sans libellés à trous, chaque phrase reste une concaténation.
- **Ce qui sort de la table sans y revenir** : les peintres (décor, trajet, frise, ciel, filigrane, signature, figure), le rail tracé après montage (C10) et l'état d'une étape (C9). Les deux derniers vont dans la primitive `chemin` du kit ; ce sont des fonctions du kit, pas des fonctions d'écran.
- **Limite de la preuve** : trois types d'état sur trente (`Voyage`, `FicheDuHeros`, `Creation`), 25 états sur 170, lus dans le code sans les exécuter. La fiche du héros n'a qu'une section dessinée (F1). `depense` et `changement` ne sont pas écrits ici ; leur lecture (`R:1685-1709`) ne montre pas de cas d'une autre sorte que C1 à C13. `dossier` (`R:1310`) n'a pas été lu.
