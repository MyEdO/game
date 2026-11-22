# Lot de natures : étiquettes, listes, filets et noms

Ticket: #4585

(#4585 : vérification du contenu entre états et restes de la revue des maquettes.)

Partie du lot « natures restantes » du plan `docs/plans/2026-11-21-maquettes-en-donnees.md` (règle 7, étape 3), au modèle de `docs/plans/2026-11-21-lot-titres.md`. L'utilisateur tranche toutes les natures restantes en une fois (« Un seul arrêt (Recommandé) », 2026-11-22). Ce document couvre quatre natures du catalogue (`hotes/godot/cibles/propositions/kit.md`) : **étiquette**, **puce et liste** (`ligneDeListe`, `puce`, `separateur`), **filet** et **nom**. Aucune migration n'est faite. La planche est `hotes/godot/cibles/propositions/sources/kit/planche-listes-et-noms.html`.

## Méthode

- **Source** : le DOM des 170 états rendus en 16:9 (1280 × 720) sur la tête du lot titres appliqué (`93d7e9a949`), lu par une sonde Playwright (`node_modules/.cache/sondes/listes-et-noms/releve.mjs`, hors dépôt). Pour chaque élément : styles calculés, rect, fond (plus proche ancêtre `.parchemin`, `.bois`, `.fer`, plaque ; « scène » sinon).
- **Ce que la sonde prend** :
  - nom : tout texte propre en Grenze Gotisch ; le rôle se décide hors de la page, par la règle de chemin du lot titres, reprise telle quelle ;
  - étiquette : les classes émises du catalogue (`.modif`, `.chip`, `.tag`, `.pill`, `.jeton`, `.puce`, `.etat-porte`, `.marque`), plus toute boîte à texte de 12 à 28 px de haut et de 240 px de large au plus, habillée (fond, ou rayon avec liseré), hors des pièces du kit ;
  - filet : `.filet`, `.trait`, plus toute boîte de 1 à 3 px de haut et de 16 px de large au moins, habillée ;
  - puce et séparateur : `.losange` hors d'un filet, `.pt`, `.pastille-entite`, `.sep`, `.point`, `.dot`, et « · » écrit dans un texte ;
  - ligne de liste : au moins deux frères de même balise et même première classe, empilés, de 14 à 60 px de haut ; le rôle est ensuite donné par le chemin (familles ci-dessous).
- **Exclus par la règle de chemin** (autres lots) : disques et touches de clavier (`kbd`), `.consequence` (primitive `consequences`), `#etat > .jeton` (ligne libellé-valeur), les lignes de la fiche lue (`.prop`), les tables, l'ordre de jeu du combat (`#ordre > .rang`, primitive `rang`), les jauges (`.rail`, `.reglette u`), les noms posés dans une plaque (lot plaques).
- **Une variante** = fond, police, taille, hauteur, interligne, marge, rayon, couleur ou fond de pièce distincts au rendu.
- **Limite** : seul le 16:9 est sondé ; 21:9, 16:10 et `bureau` ne le sont pas.

## Variantes réelles par rôle

| Nature, rôle | Variantes | Sites | États |
|---|---|---|---|
| nom (personne, objet) | 24 | 531 | 145 |
| nom d'entrée (ligne de liste) | 27 | 183 | 46 |
| étiquette rectangle | 20 | 119 | 44 |
| étiquette pastille | 10 | 96 | 10 |
| étiquette compte | 11 | 134 | 18 |
| ligne de liste | 43 | 420 lignes | 33 |
| puce de ligne (`.losange`, `.pt` de coop) | 2 | 57 | 12 |
| séparateur (`.sep`) | 2 | 15 | 5 |
| séparateur « · » écrit en texte | — | 342 éléments | 52 écrans |
| filet du kit | 17 | 108 | 65 |
| trait hors du kit | 3 | 8 | 8 |
| trait de borne (combat) | 1 | 55 | 55 |

Ce que le DOM montre et que le catalogue n'avait pas :

- **Nom** : 714 sites et non 769. L'écart, 55 sites, est « Round 1 » (`#round`, 55 états), passé au titre de panneau à l'application du lot titres. Sur l'arbre appliqué, la règle de chemin range aussi en nom les quatre `titre({ ecran })` des éditeurs (`div.titre.ecran`, 31 px), qui n'en sont pas : ils sont retirés du compte.
- **Nom** : le nom 22 / 30 sur bois (34 sites : arrivée, halle, marchandage, nuit) est celui du cartouche `ligne` (`S/gestes.css:119`). Le cran `grand` de l'échelle proposée en vient.
- **Étiquette** : six classes habillées que le catalogue ne nomme pas :
  - `.attend` (« Mène le groupe », 10 états, laiton) ;
  - `.facettes > b` (Compendium, 16 sites) ;
  - `.palier` (création, 31 sites, Chiffres 11, rayon 10) ;
  - `.defaut` (options) ;
  - `.issue > b` (« Critique ») ;
  - `.atouts > span` (tour de combat, pastille 12,5 px).
- **Étiquette** : `.puce` du Compendium n'a pas la forme d'une étiquette : c'est une boîte de 31 px de haut à deux lignes (Spectral 14,5 et Fell SC 12,5).
- **Étiquette** : `.etat-porte` est un sceau suivi d'un libellé sans fond. Ce n'est pas une étiquette mais un sceau légendé.
- **Puce** :
  - `.pt` a deux sens : une puce de 8 px en coop, une station de 34 px au changement de carrière ;
  - `.dot` est une ligne de dotation ;
  - `.pastille-entite` est un badge de 48 px sur une entité ;
  - `.point` n'est rendu nulle part (il n'est émis par aucun script : `kit.md`, à retirer).

  Seuls `.losange` (55 sites) et `.pt` de coop (2) sont des puces de ligne. Le losange des lignes de la fiche est déjà celui du kit : plein, 7 px (rect 10 × 10 une fois tourné), `S/heros/heros.css:45` ne lui donne que sa marge.
- **Filet** :
  - `.filet{margin:11px 0 8px}` est déclaré sans portée dans `S/voyage/voyage.css:12` : il change la marge du kit dans tout gabarit qui charge cette feuille ;
  - 27 filets posés dans le corps d'une colonne (`div.defile.corps > div.filet`) ont une marge 0 : celle de la place ;
  - le trait de borne du combat (`div.borne > i`, dégradé crème, 55 états) est un filet fondu dessiné à la main.

### nom (personne, objet) : 24 variantes, 531 sites, 145 états

| Fond | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|
| bois | 17.5 | 28 | -3 0 | (244,232,202) | 0.3 | ombre | 247 | 70 | arrivee, bataille-de-masse, carte-du-monde, changement-de-carriere +18 (`div.qui > div.nom.gothique`) |
| parchemin | 21 | normal | -4 0 0 | (58,26,16) | 0.3 |  | 82 | 59 | combat-naval, contre-sort, corruption-mutation, coup-critique +20 (`div.place > div.n.gothique`) |
| scène | 16 | normal | 0 | (246,234,208) | 0.3 | ombre | 45 | 45 | combat-naval, corruption-mutation, coup-critique, desengagement +9 (`div.qui > div.nom.gothique.ombre`) |
| bois | 22 | 30 | -4 0 -5 | (243,230,198) | 0.3 | ombre | 34 | 18 | arrivee, halle, marchandage, nuit +2 (`div > div.n.gothique`) |
| parchemin | 22 | 24 | 0 | (58,26,16) | 0.3 |  | 18 | 18 | bataille-de-masse, compendium, course-poursuite-en-mer, designation-d-un-heros +7 (`div.tete > span.n.gothique`) |
| parchemin | 16 | 22 | 0 | (58,26,16) | 0.3 |  | 17 | 17 | combat-naval, defense, dissipation, evenement-de-route +5 (`div.place > div.sorte-du-jet.gothique`) |
| parchemin | 26 | 36 | -3 0 1 | (58,26,16) | 0.3 |  | 13 | 13 | changement-de-carriere, creation, depense-d-experience, dossier +1 (`div.q > div.nom`) |
| bois | 24 | 32 | -4 0 4 | (243,230,198) | normal | ombre | 12 | 12 | creation (`div.acquis > div.qui`) |
| scène | 20 | 27 | 0 | (243,230,198) | 0.3 | ombre | 9 | 9 | combat-naval, tour-de-combat (`div#actif-nom > div.n.gothique`) |
| scène | 16 | normal | 0 | (246,185,166) | 0.3 | ombre | 8 | 8 | contre-sort, defense, sauvetage-par-le-destin, tour-de-combat (`div.qui > div.nom.gothique.ombre`) |
| bois | 19 | normal | 0 | (246,234,208) | 0.3 | ombre | 8 | 2 | interlude (`div.qui > div.nom.gothique.ombre`) |
| parchemin | 23 | 26 | 0 | (58,26,16) | 0.3 |  | 6 | 3 | dossier, tour-de-combat (`div.texte > div.n.gothique`) |
| bois | 17 | 26 | -4 0 | (244,232,202) | 0.3 |  | 5 | 1 | chapitre (`div.qui > div.n.gothique`) |
| parchemin | 21 | 24 | 0 | (58,26,16) | normal |  | 4 | 2 | bataille-de-masse (`div > div.n`) |
| parchemin | 19 | normal | 0 | (58,26,16) | 0.3 |  | 4 | 1 | coop (`div.qui > div.nom.gothique.ombre`) |
| parchemin | 20 | 30 | -4 0 -5 | (58,26,16) | 0.3 |  | 4 | 4 | fiche-du-heros (`div > div.n.gothique`) |
| parchemin | 21 | 32 | -5 0 -4 | (58,26,16) | 0.3 |  | 4 | 1 | fin-de-seance (`div.qui > div.n.gothique`) |
| bois | 17.5 | 28 | -3 0 | (201,185,149) | 0.3 | ombre | 3 | 3 | nouvelle-partie (`div.qui > div.nom.gothique`) |
| parchemin | 16 | 20 | 0 | (58,26,16) | 0.3 |  | 2 | 1 | incantation (`div > div.n.gothique`) |
| parchemin | 22 | 24 | 0 0 0 2 | (58,26,16) | 0.3 |  | 2 | 2 | jet-avant-le-de (`div.regle.localisation > span.gothique`) |
| parchemin | 22 | 30 | -4 0 -5 | (58,26,16) | 0.3 |  | 1 | 1 | creation (`div > div.n.gothique`) |
| parchemin | 17 | 18 | -4 0 0 | (58,26,16) | 0.3 |  | 1 | 1 | dissipation (`div.place > div.n.gothique`) |
| scène | 20 | 27 | 0 | (246,185,166) | 0.3 | ombre | 1 | 1 | tour-de-combat (`div#actif-nom > div.n.gothique`) |
| parchemin | 28 | 30 | 0 | (58,26,16) | 0.3 |  | 1 | 1 | tour-de-combat (`div > div.n.gothique`) |

### nom d'entrée (ligne de liste) : 27 variantes, 183 sites, 46 états

| Fond | Taille | Interligne | Marge | Couleur | Inter-lettre | Ombre | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|
| bois | 16 | 17 | 0 | (244,232,202) | 0.3 |  | 41 | 12 | bataille-de-masse, le-bord, nouvelle-partie, nuit (`div.et.bois > b`) |
| bois | 15 | 17 | 0 | (226,213,182) | 0.3 |  | 23 | 11 | bataille-de-masse, exploration, le-bord, nuit (`div.et.bois > b`) |
| parchemin | 18 | 20 | 0 | (42,29,18) | 0.3 |  | 17 | 8 | halle, marchandage, port (`div.l > b`) |
| bois | 15.5 | 17 | 0 | (244,232,202) | 0.3 |  | 15 | 2 | interlude (`div > b`) |
| parchemin | 17 | 22 | 0 | (42,29,18) | 0.3 |  | 13 | 4 | changement-de-carriere, depense-d-experience (`div.et > b`) |
| parchemin | 18 | 30 | -4 0 | (58,26,16) | 0.3 |  | 12 | 3 | nouvelle-partie (`div.avis.parchemin > b.gothique`) |
| parchemin | 17.5 | normal | 0 | (42,29,18) | 0.3 |  | 12 | 2 | port (`div.ligne > b`) |
| bois | 16 | 18 | 0 | (243,230,198) | 0.3 |  | 6 | 2 | carte-du-monde (`div > b`) |
| bois | 20 | 23 | 0 | (244,232,202) | 0.3 |  | 5 | 4 | arrivee, port (`div.ou > b`) |
| parchemin | 15 | 17 | 0 | (58,26,16) | 0.3 |  | 5 | 2 | combat-naval (`div.q > b.gothique`) |
| parchemin | 16 | 17 | 0 | (58,26,16) | 0.3 |  | 4 | 1 | butin (`div.q > b`) |
| bois | 18.5 | 24 | -3 0 -2 | (243,230,198) | 0.3 |  | 4 | 2 | carte-du-monde (`div.q > b`) |
| parchemin | 16 | 22 | -2 0 -4 | (42,29,18) | normal |  | 4 | 1 | nuit (`div.siege > b`) |
| parchemin | 18.5 | 20 | 0 | (42,29,18) | 0.3 |  | 4 | 2 | soins (`div.t > b`) |
| parchemin | 16 | 22 | 0 | (42,29,18) | 0.3 |  | 2 | 1 | butin (`div.t > b`) |
| parchemin | 21 | 24 | 0 | (58,26,16) | 0.3 |  | 2 | 1 | carnet (`div.tete > b.gothique`) |
| bois | 22 | 34 | -7 0 -6 | (244,232,202) | 0.3 |  | 2 | 1 | coop (`div > b.gothique`) |
| parchemin | 17 | 22 | 0 | a(42,29,18,0.6) | 0.3 |  | 2 | 1 | depense-d-experience (`div.t > b`) |
| bois | 16.5 | 21 | -3 0 -2 | (244,232,202) | 0.3 |  | 2 | 2 | interlude (`div > b`) |
| parchemin | 24 | 30 | 0 6 0 0 | (58,26,16) | 0.3 |  | 1 | 1 | carnet (`div.indice > b.gothique`) |
| parchemin | 17 | 22 | 0 | a(42,29,18,0.5) | 0.3 |  | 1 | 1 | changement-de-carriere (`div.et > b`) |
| bois | 22 | 34 | -7 0 -6 | (240,200,180) | 0.3 |  | 1 | 1 | coop (`div > b.gothique`) |
| parchemin | 22 | 30 | -5 0 | (58,26,16) | 0.3 |  | 1 | 1 | coop (`div.r > b.gothique`) |
| parchemin | 17 | 36 | 0 | (42,29,18) | 0.3 |  | 1 | 1 | dossier (`label.champ > b`) |
| bois | 22 | 32 | -5 0 -4 | (244,232,202) | 0.3 |  | 1 | 1 | halle (`div > b.gothique`) |
| parchemin | 18 | 24 | 0 | (58,26,16) | 0.3 |  | 1 | 1 | incantation (`div.t > b.gothique`) |
| bois | 15 | 17 | 0 | (141,132,116) | 0.3 |  | 1 | 1 | le-bord (`div.et.bois > b`) |


### étiquette rectangle : 20 variantes, 119 sites, 44 états
| Fond | Police | Taille | Hauteur | Rayon | Couleur | Teinte | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 11 | 18 | 2 | (90,42,18) | voile (0.25) | 54 | 8 | creation, depense-d-experience (`div.achat > span.tag`) |
| bois | Fell SC | 12.5 | 19 | 2 | (230,218,189) | lit sombre | 12 | 4 | compendium (`div.facettes > b`) |
| bois | Fell SC | 12 | 18 | 2 | (42,26,8) | or (laiton) | 10 | 10 | document, exploration, halle, interlude +1 (`div.qui > span.attend.rubrique`) |
| plaque | Fell SC | 12.5 | 19 | 2 | (58,42,18) | voile (0.35) | 4 | 4 | bataille-de-masse, debut-du-round, tour-de-combat (`div.c > span.modif.rubrique`) |
| parchemin | Fell SC | 12.5 | 20 | 2 | (58,42,18) | voile (0.35) | 4 | 2 | combat-naval (`p.phrase-du-jet > span.modif.rubrique`) |
| parchemin | Fell SC | 12.5 | 23 | 2 | (58,42,24) | voile (0.3) | 4 | 1 | compendium (`div.facettes > b`) |
| parchemin | Fell SC | 12.5 | 19 | 2 | (58,42,18) | voile (0.35) | 4 | 4 | defense, dissipation, jet-avant-le-de, tour-de-combat (`div.regle > span.modif.rubrique`) |
| parchemin | Spectral | 14.5 | 31 | 2 | (42,29,18) | voile (0.3) | 3 | 3 | compendium (`div.puces > div.puce`) |
| parchemin | Fell SC | 12.5 | 31 | 2 | (107,28,16) | voile (0.3) | 3 | 3 | compendium (`div.puces > div.puce`) |
| scène | Grenze Gotisch | 14 | 20 | 0 | (243,230,198) | sans fond | 3 | 3 | determination, tour-de-combat (`div.etats > div.etat-porte`) |
| scène | Fell SC | 11.5 | 20 | 0 | (240,226,194) | sans fond | 3 | 3 | determination, tour-de-combat (`div.etats > div.etat-porte`) |
| bois | Fell SC | 12 | 18 | 2 | (207,197,174) | fer | 3 | 1 | halle (`div.joue > span.attend.rubrique.autre`) |
| parchemin | Fell SC | 12.5 | 23 | 2 | (107,28,16) | voile (0.3) | 3 | 3 | options (`div.c > span.defaut.rubrique`) |
| parchemin | Fell SC | 15 | 19 | 2 | (42,29,18) | or (laiton) | 2 | 2 | focalisation, incantation (`div.issue.critique > b`) |
| bois | Fell SC | 11 | 31 | 2 | (42,29,18) | or (laiton) | 2 | 2 | port (`div.n.gothique > span.marque`) |
| bois | Fell SC | 12 | 18 | 2 | (226,192,106) | or sombre (radial) | 1 | 1 | bataille-de-masse (`div.qui > span.attend.sombre.rubrique`) |
| parchemin | Fell SC | 12 | 18 | 2 | (42,29,18) | voile (0.25) | 1 | 1 | carnet (`div.indice > span.chip`) |
| parchemin | Fell SC | 12 | 18 | 2 | (243,230,198) | cire | 1 | 1 | carnet (`div.indice > span.chip.neuf`) |
| plaque | Fell SC | 12.5 | 35 | 2 | (58,42,18) | voile (0.35) | 1 | 1 | debut-du-round (`div.c > span.modif.rubrique`) |
| bois | Fell SC | 11.5 | 20 | 0 | (240,226,194) | sans fond | 1 | 1 | tour-de-combat (`div.portes > div.etat-porte`) |

### étiquette pastille : 10 variantes, 96 sites, 10 états
| Fond | Police | Taille | Hauteur | Rayon | Couleur | Teinte | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|
| parchemin | Fell SC | 10.5 | 21 | 11 | (42,29,18) | voile (0.25) | 37 | 3 | changement-de-carriere, creation (`div.pills > span.pill`) |
| parchemin | Fell SC | 12 | 23 | 11 | a(42,29,18,0.68) | sans fond | 22 | 1 | creation (`div.pills.mineurs > span.pill.fermee`) |
| parchemin | Fell SC | 10 | 19 | 11 | (42,29,18) | voile (0.25) | 16 | 1 | depense-d-experience (`div.pills > span.pill`) |
| parchemin | Fell SC | 11 | 22 | 11 | (42,29,18) | voile (0.25) | 6 | 1 | creation (`div.pills > span.pill`) |
| parchemin | Fell SC | 10.5 | 22 | 11 | (42,29,18) | voile (0.25) | 4 | 1 | creation (`div.pills > span.pill`) |
| parchemin | Fell SC | 11 | 20 | 11 | (42,29,18) | voile (0.25) | 3 | 3 | creation (`div.ligne > span.pill`) |
| parchemin | Fell SC | 12 | 23 | 11 | (42,29,18) | or (laiton) | 3 | 1 | creation (`div.pills.mineurs > span.pill.prise`) |
| parchemin | Fell SC | 12.5 | 24 | 12 | (42,29,18) | voile (0.4) | 3 | 1 | tour-de-combat (`div.atouts > span.rubrique`) |
| parchemin | Fell SC | 10.5 | 21 | 11 | (42,29,18) | or (laiton) | 1 | 1 | creation (`div.pills > span.pill.prise`) |
| parchemin | Fell SC | 10 | 19 | 11 | (42,29,18) | or (laiton) | 1 | 1 | depense-d-experience (`div.pills > span.pill.prise`) |

### étiquette compte : 11 variantes, 134 sites, 18 états
| Fond | Police | Taille | Hauteur | Rayon | Couleur | Teinte | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|
| bois | Chiffres | 10 | 16 | 11 | (243,230,198) | ombre | 44 | 12 | creation (`i > span.jeton`) |
| fer | Chiffres | 10.5 | 19 | 11 | (141,132,116) | fer | 19 | 3 | depense-d-experience (`div.c > span.jeton.fer`) |
| parchemin | Chiffres | 11.5 | 21 | 11 | (42,29,18) | or (laiton) | 17 | 10 | changement-de-carriere, creation, fiche-du-heros (`div.tete-l > span.jeton.or`) |
| parchemin | Chiffres | 10.5 | 19 | 11 | (42,29,18) | or (laiton) | 16 | 5 | changement-de-carriere, depense-d-experience (`div.c.carr > span.jeton.or`) |
| parchemin | Chiffres | 11 | 20 | 10 | (90,69,48) | voile (0.25) | 15 | 1 | creation (`div.paliers > span.palier`) |
| parchemin | Chiffres | 11 | 20 | 10 | (42,29,18) | voile fort | 7 | 1 | creation (`div.paliers > span.palier.zero`) |
| parchemin | Chiffres | 11 | 20 | 10 | (42,29,18) | or (laiton) | 5 | 1 | creation (`div.paliers > span.palier.pris`) |
| parchemin | Chiffres | 11.5 | 21 | 11 | (42,29,18) | voile (0.25) | 4 | 3 | creation (`div.ligne > span.jeton`) |
| parchemin | Chiffres | 11 | 20 | 10 | (243,230,198) | cire | 4 | 1 | creation (`div.ligne.carriere > span.palier.race`) |
| parchemin | Chiffres | 11.5 | 21 | 11 | (243,230,198) | cire | 2 | 2 | creation (`div.tirage-c > span.jeton.cire`) |
| fer | Chiffres | 11.5 | 21 | 11 | (141,132,116) | fer | 1 | 1 | creation (`div.comptes > span.jeton.fer`) |

### filet du kit : 17 variantes, 108 sites, 65 états
| Classes | Fond | Marge | Losange | Trait | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|
| filet | parchemin | 0 |  | plein 0,5 | 27 | 17 | compendium, halle, marchandage, nuit +2 (`div.defile.corps > div.filet`) |
| filet.fondu | parchemin | 4 26 5 | losange | fondu 0,5 | 16 | 9 | creation (`div.place > div.filet.fondu`) |
| filet.fondu | parchemin | 9 26 | losange | fondu 0,5 | 13 | 13 | changement-de-carriere, depense-d-experience, dossier, fiche-du-heros (`div.place > div.filet.fondu`) |
| filet.fondu | parchemin | 7 40 | losange | fondu 0,5 | 10 | 10 | changement-de-carriere, creation (`div.page-c > div.filet.fondu`) |
| filet.fondu | bois | 0 |  | fondu 0,5 | 8 | 8 | bataille-de-masse, le-bord, nuit (`div.defile.corps > div.filet.fondu`) |
| filet | parchemin | 10 30 | losange | plein 0,5 | 6 | 2 | sauvegardes (`div.fond.parchemin > div.filet`) |
| filet | parchemin | 18 0 12 |  | plein 0,5 | 5 | 3 | dossier (`div.defile > div.filet`) |
| filet | parchemin | 4 0 | losange | plein 0,5 | 5 | 3 | options (`div.feuille.g.parchemin > div.filet`) |
| filet | parchemin | 0 | losange | plein 0,5 | 4 | 2 | sauvegardes (`div.blanc > div.filet`) |
| filet.fondu | parchemin | 6 26 | losange | fondu 0,5 | 3 | 2 | creation (`div.place > div.filet.fondu`) |
| filet | parchemin | 7 30 6 | losange | plein 0,5 | 3 | 3 | nouvelle-partie (`div.affiche.parchemin > div.filet`) |
| filet.or | scène | 0 | losange | plein 0,5 or | 2 | 2 | accueil, menu-de-la-partie (`div.place > div.filet.or`) |
| filet | parchemin | 4 120 6 | losange | plein 0,5 | 2 | 2 | document (`div.fond.parchemin > div.filet`) |
| filet | parchemin | 11 0 |  | plein 0,5 | 1 | 1 | carnet (`div.fond.parchemin > div.filet`) |
| filet | parchemin | 0 0 6 |  | plein 0,5 | 1 | 1 | tour-de-combat (`div.defile.au-pied.avant > div.filet`) |
| filet | parchemin | 13 0 6 |  | plein 0,5 | 1 | 1 | tour-de-combat (`div.defile.au-pied.avant > div.filet`) |
| filet | parchemin | 12 8 | losange | plein 0,5 | 1 | 1 | tour-de-combat (`div.fond.parchemin > div.filet`) |

### trait : 3 variantes, 8 sites, 8 états
| Classes | Fond | Marge | Losange | Trait | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|
| trait | parchemin | 9 0 3 |  | (60,40,20,0.35) | 4 | 4 | editeur-carte-du-monde, editeur-de-scene (`div.place > div.trait`) |
| trait | bois | 4 2 |  | (226,192,106,0.28) | 3 | 3 | nouvelle-partie (`div.fond.bois > div.trait`) |
| trait | scène | 8 0 |  | dégradé | 1 | 1 | menu-de-la-partie (`div.place > div.trait`) |

### trait de borne : 1 variante, 55 sites, 55 états
| Classes | Fond | Marge | Losange | Trait | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|
|  | scène | 0 |  | dégradé | 55 | 55 | combat-naval, contre-sort, corruption-mutation, coup-critique +13 (`div.borne > i`) |

### ligne de liste : 43 variantes, 420 lignes, 33 états
| Famille | Fond | Hauteur | Police | Taille | Bordure h/b/g | Puce | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|
| rangee | bois | 23 | Spectral | 14.5 | 0/1/0 |  | 100 | 4 | compendium (`div.defile.suite > div.rangee`) |
| index | parchemin | 26 | Spectral | 14 | 0/1/0 |  | 96 | 4 | compendium (`div.noms > div.nom-renvoi`) |
| fiche | parchemin | 26 | Fell | 14 | 2/1/2 | svg | 27 | 4 | fiche-du-heros (`div.lignes > div.ligne`) |
| achat | parchemin | 34 | Fell SC | 11 | 0/1/0 | span | 18 | 3 | depense-d-experience (`div.defile > div.achat`) |
| fiche | parchemin | 30 | Fell | 14 | 2/1/2 | svg | 14 | 2 | changement-de-carriere (`div.lignes > div.ligne.refusee`) |
| fiche | parchemin | 30 | Fell | 14 | 2/1/2 | i | 13 | 2 | changement-de-carriere (`div.lignes > div.ligne`) |
| fiche | parchemin | 28 | Fell SC | 11 | 2/1/2 |  | 12 | 1 | creation (`div.defile.lignes.suite > div.ligne`) |
| fiche | parchemin | 30 | Fell SC | 11 | 2/1/2 |  | 9 | 3 | creation (`div.lignes > div.ligne.repartie`) |
| cochable | bois | 27 | Spectral | 11.5 | 0/0/0 | i | 8 | 1 | chapitre (`div.col > div.cochable`) |
| achat | parchemin | 31 | Fell | 14.5 | 0/1/0 |  | 8 | 1 | depense-d-experience (`div.fond.parchemin > div.achat.sort`) |
| index | bois | 40 | Spectral | 18 | 0/0/0 |  | 7 | 1 | compendium (`div.familles > div.ligne`) |
| fiche | parchemin | 36 | Fell SC | 11 | 2/1/2 |  | 7 | 1 | creation (`div.defile.lignes > div.ligne.carriere`) |
| exigence | parchemin | 27 | Fell | 14 | 0/0/0 | div | 6 | 4 | changement-de-carriere, depense-d-experience (`div.exigences > div.exige`) |
| cochable | bois | 41 | Spectral | 11.5 | 0/0/0 | i | 6 | 1 | chapitre (`div.col > div.cochable`) |
| fiche | parchemin | 28 | Fell | 15 | 2/1/2 | i | 6 | 3 | creation (`div.lignes.methodes > div.ligne`) |
| fiche | parchemin | 30 | Fell | 15 | 2/1/2 |  | 6 | 3 | creation (`div.lignes > div.ligne.repartie`) |
| outils | bois | 32 | Spectral | 14 | 0/0/0 |  | 6 | 2 | editeur-de-scene (`div.defile.corps > div.ligne`) |
| lot | bois | 30 | Spectral | 13 | 0/0/0 |  | 6 | 1 | port (`div.defile.suite > div.lot`) |
| rangee | parchemin | 32 | Grenze Gotisch | 15 | 0/0/0 |  | 5 | 2 | combat-naval (`div.rangees > div.rangee`) |
| soin | parchemin | 54 | Grenze Gotisch | 18 | 1/1/1 |  | 5 | 3 | halle, port (`div.voies > div.soin`) |
| exigence | parchemin | 27 | Fell | 14 | 0/0/0 | i | 4 | 3 | depense-d-experience (`div.exigences > div.exige`) |
| outils | bois | 32 | Spectral | 14 | 0/0/0 | svg | 4 | 1 | editeur-carte-du-monde (`div.defile.corps > div.ligne`) |
| fiche | parchemin | 30 | Fell | 14 | 2/2/2 | svg | 3 | 2 | changement-de-carriere (`div.lignes > div.ligne.choisie`) |
| fiche | parchemin | 28 | Fell | 15 | 2/2/2 | svg | 3 | 3 | creation (`div.lignes.methodes > div.ligne.choisie`) |
| exigence | parchemin | 38 | Fell | 14 | 0/0/0 | i | 3 | 3 | depense-d-experience (`div.exigences > div.exige`) |
| achat | parchemin | 34 | Fell | 14.5 | 0/0/0 | span | 3 | 3 | depense-d-experience (`div.defile > div.achat.hors`) |
| fiche | parchemin | 26 | Fell | 14 | 2/2/2 | svg | 3 | 3 | fiche-du-heros (`div.lignes > div.ligne.choisie`) |
| vaincu | parchemin | 28 | Spectral | 14.5 | 0/0/0 |  | 3 | 1 | fin-du-combat (`div.vaincus > div.v`) |
| butin | parchemin | 34 | Spectral | 14.5 | 0/1/0 |  | 3 | 1 | fin-du-combat (`div.lignes-b > div.ligne-b`) |
| soin | parchemin | 56 | Grenze Gotisch | 18 | 2/2/2 |  | 3 | 3 | halle, port (`div.voies > div.soin.pris`) |
| couche | bois | 46 | Fell SC | 12 | 0/0/0 |  | 3 | 1 | nuit (`div.defile.corps > div.couche`) |
| fiche | parchemin | 41 | Grenze Gotisch | 17.5 | 1/0/0 |  | 3 | 1 | port (`div.lignes > div.ligne`) |
| objet | parchemin | 33 | Grenze Gotisch | 16 | 0/0/0 |  | 2 | 1 | butin (`div.partage > div.objet`) |
| exigence | parchemin | 38 | Fell | 14 | 0/0/0 | div | 2 | 2 | changement-de-carriere (`div.exigences > div.exige`) |
| joueur | bois | 34 | Spectral | 16 | 0/0/0 | i | 2 | 1 | coop (`div > div.joueur`) |
| achat | parchemin | 34 | Fell SC | 11 | 2/2/2 | span | 2 | 2 | depense-d-experience (`div.defile > div.achat.vise`) |
| outils | bois | 46 | Spectral | 14 | 0/0/0 |  | 2 | 2 | editeur-de-scene (`div.defile.corps > div.ligne`) |
| cochable | bois | 27 | Spectral | 14 | 0/0/0 | i | 2 | 1 | fin-de-seance (`div.cases > div.cochable.cochee`) |

5 variantes à un site ne sont pas listées. L'écart entre deux lignes est du placement : il n'entre pas dans la variante. Les 39 lignes `ligneDu` (`S/rendu.js:888`, libellé en `span.rubrique` puis valeur) sont des lignes libellé-valeur : elles sont exclues.

### puces et séparateurs : 9 variantes, 90 sites
| Nature | Classes | Fond | L | H | Teinte | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|
| puce | losange | parchemin | 10 | 10 | (90,69,48) | 55 | 11 | changement-de-carriere, creation, fiche-du-heros (`div.ligne > i.losange`) |
| separateur | sep | bois | 1 | 30 | a(226,192,106,0.28 | 12 | 4 | editeur-carte-du-monde, editeur-de-scene (`div.fond.bois > div.sep`) |
| puce | pt | parchemin | 34 | 34 | a(0,0,0,0) | 8 | 2 | changement-de-carriere (`div.station.faite > div.pt`) |
| puce | dot | parchemin | 428 | 28 | a(0,0,0,0) | 7 | 1 | creation (`div.defile.lignes.dots.suite > div.dot`) |
| separateur | sep | plaque | 9 | 17 | a(0,0,0,0) | 3 | 1 | voyage-en-mer (`div.c > span.sep`) |
| puce | pt | bois | 8 | 8 | a(0,0,0,0) | 2 | 1 | coop (`div.joueur > i.pt`) |
| puce | pastille-entite | scène | 48 | 51 | a(0,0,0,0) | 1 | 1 | tour-de-combat (`div.pastille-entite`) |
| puce | pastille-entite | scène | 39 | 51 | a(0,0,0,0) | 1 | 1 | tour-de-combat (`div.pastille-entite`) |
| puce | pastille-entite | scène | 47 | 51 | a(0,0,0,0) | 1 | 1 | tour-de-combat (`div.pastille-entite`) |

médian en texte : 342 éléments, 52 écrans


## Forme cible proposée

Un rôle, une forme par fond. Les valeurs sont prises aux variantes existantes, la plus fréquente d'abord.

| Nature | Primitive, signature | Forme | Bois | Parchemin | Pris à |
|---|---|---|---|---|---|
| Nom | `nom({ texte, taille })` | Grenze Gotisch 600, inter-lettre 0,3, marge 0 ; sur la scène, `--ivoire` avec l'ombre `.ombre` (`S/gestes.css:50`), comme ses 63 sites. `grand` 22 / 30 (93 sites), `moyen` 18 / 24 (446), `petit` 16 / 22 (175) | `--ivoire`, ombre `0 1px 2px --noir` (celle du cartouche `ligne`, `S/gestes.css:119` ; 304 noms sur bois sur 410 en portent une) | `--sepia`, sans ombre | `grand` : cartouche `ligne` (`S/gestes.css:119`), 34 sites ; `moyen` : 18 / 24 (incantation, `div.t > b`), remplace 17, 17,5, 18, 18,5, 19, 20 et 21 ; `petit` : 16 / 22, sorte du Test (`div.sorte-du-jet`, 17 sites) et butin. Le lot titres proposait 16 / 19 (carte, `kit.md` § 2) : il coupe 55 états, voir la mesure |
| Étiquette | `etiquette({ texte, valeur, format, teinte, variante })` | `rectangle` : Fell SC 12,5, hauteur 19, rayon 2, marge intérieure 0 9 ; `pastille` : Fell SC 10,5, inter-lettre 0,8, hauteur 21, rayon 11 ; `compte` : Chiffres 600 11,5, hauteur 21, rayon 11 ; teintes `voile` (repos), `or`, `cire`, `fer` | liseré `--filet-or-vif`, `--ivoire` sur `--ombre` (`S/heros/heros.css:49`) | liseré `--trait-encre`, `--encre` sur `--voile` | `rectangle` : `.modif` (`S/combat/jet.css:36`) ; 12,5 px compte 35 sites sur 119 et 8 écrans, contre 54 sites pour `.tag` 11 px, sur 2 écrans seulement (création, dépense d'expérience) ; `pastille` : `.pill` 10,5 / 21, 42 sites sur 96 ; `compte` : `.jeton` 11,5 / 21, 3 écrans, et la même hauteur que la pastille |
| Ligne de liste | `ligneDeListe({ puce, marque, nom, precision, fin, choisie, refusee })` | hauteur 28 pour une ligne, 44 quand `precision` passe dessous (question 3), marge intérieure 0 8, filet dessous `--filet-encre` (`--filet-creme` sur bois), nom `nom({ taille: 'petit' })` ou texte Fell 15 ; `choisie` : bordure laiton 2 px (`S/heros/heros.css:42`) | — | — | `.ligne` de la fiche (`S/heros/heros.css:36`). 28 compte 24 lignes, contre 126 à 26 et 100 à 23 : ces deux hauteurs sont celles du seul Compendium (renvois, rangées, 4 états chacune), 28 est celle de la fiche, de la création, du changement de carrière et des vaincus |
| Puce | `puce` : `losange`, `coche` | losange plein 7 px (`S/gestes.css:269`), coche `picto('coche')` | teinte du texte | teinte du texte | le losange du kit, déjà rendu sur les 55 lignes qui portent une puce ; `.pt` de coop (rond d'or de 8 px, 2 sites) devient le losange |
| Séparateur | `separateur('median')` | « · » entre deux textes, espace fine de part et d'autre | — | — | 342 éléments l'écrivent en texte ; `.sep` vertical de la barre des éditeurs devient du placement entre les groupes de la barre |
| Filet | `filet({ fondu, losange, or })` | deux traits de 1 px à 0,5, `--creme-2` sur bois, `--encre-2` sur parchemin, `--or` avec `or` ; marge : du placement (question 2) | — | — | `S/gestes.css:262-269`, 108 sites ; `.trait` (3 feuilles) et le trait de borne deviennent `filet()` et `filet({ fondu })` |

Ce que la cible retire :

- **Nom** : 52 rendus (25 + 27) deviennent trois crans par fond. Les teintes d'état restent des états de la donnée et non des variantes :
  - l'ennemi `(246,185,166)` ;
  - l'éteint `(201,185,149)`, `(226,213,182)`, `(141,132,116)` ;
  - le refusé (opacité 0,5 et 0,6).

  Le noir d'encre `(42,29,18)` des `b` sur parchemin (halle, port, soins, carrière) devient `--sepia`.
- **Étiquette** : 41 rendus deviennent 3 variantes et 4 teintes. `.tag` garde sa largeur fixe de 32 px, qui est du placement (colonne de caractéristique). `.puce` du Compendium et `.etat-porte` sortent de la nature : le premier est une ligne libellé-valeur, le second un sceau légendé.
- **Ligne de liste** : 18 familles, de 20 à 56 px de haut, deviennent une ligne de 28 (44 à deux étages). Les lignes à deux étages (`.exige` 38, `.achat` 34, `.soin` 54, `.cochable` 41, `.couche` 46) ne tiennent pas en 28 : voir la mesure et la question 3.
- **Filet** : les trois `.trait` (`S/outils/outils.css:12`, `S/accueil-et-systeme/nouvelle-partie.css:11`, `S/accueil-et-systeme/ouverture.css:17`, et `options.css:7` non rendu en 16:9), le trait de borne et la portée globale de `S/voyage/voyage.css:12`. Les marges propres (12 surcharges, carte § 9.7) sont du placement ou disparaissent : question 2.

## Tenue de la forme cible : mesure

Chaque forme cible est **simulée seule** par une feuille injectée dans `rendre.mjs` (préchargement Playwright, `node_modules/.cache/sondes/listes-et-noms/cible-<nature>.css`, rien au dépôt), sur les 170 états en 16:9, avec leurs relevés réels. Chaque passe est comparée à la passe d'avant de la même tête : seul un relevé **neuf** compte. La passe d'avant est sans aucun rouge (57 écrans, code 0). La sonde du DOM est rejouée sous chaque feuille pour mesurer les rects des voisins.

- **Contrôle de la simulation du nom** : la feuille est générée depuis les chemins du relevé. Elle touche les 714 sites du rôle, aucun autre texte en gothique ne change de taille.
- **Passe des quatre formes ensemble** (échelle du nom à 16 / 19, lignes `ligneDu` comprises) : 32 écrans sur 57 ont un relevé neuf. La somme des passes séparées ci-dessous l'explique.

### Nom (échelle du lot titres : 22 / 30, 18 / 24, 16 / 19)

**63 états avec un relevé neuf.**

| Relevé | États | Site et cause (probable, sauf mention) | Avant → cible |
|---|---|---|---|
| `coupe` | 53 | nom du rang actif dans la fenêtre du bas (`div.rang > div.qui > div.nom.gothique.ombre`, scène). Le rang coupe son texte par une ellipse, et la gothique de 16 px déborde verticalement d'une ligne de 19 (mesuré : l'essai à 16 / 22 la lève) | 16 / normal (24) → 16 / 19 |
| `coupe` | 1 | butin, nom d'objet (`div.objet > div.t > b`), même cause (mesuré) | 16 / 22 → 16 / 19 |
| `coupe` | 1 | fin de séance, nom du héros (`div.tete > div.qui > div.n`), 1 px plus large dans une boîte de 133 | 21 / 32 → 22 / 30 |
| `masque` | 4 | halle (vente), port (port, achat, négoce) : la liste des hôtes (77 > 73) et le corps de page (254 > 248). Les noms des hôtes grandissent : `div.ou > b` (20 / 23 → 18 / 24) et le nom du cartouche `ligne` (marge −4 0 −5 → 0, boîte nette 21 → 30) | 20 / 23 → 18 / 24 ; 22 / 30 −4 0 −5 → 22 / 30 |
| `croise` | 3 | nouvelle partie : le voyageur croise « Recruter ». Les quatre avis cloués grandissent (`div.avis > b`) | boîte nette 22 → 24 |
| `deborde` | 1 | clôture du chapitre (`chapitre/fin`) : la séance déborde de son cadre (`div.qui > div.n`) | 17 / 26, marge −4 → 18 / 24 |
| `recouvert`, `chevauche` | 1 | dissipation (entrée) : « Porteur désigné » passe à deux lignes et touche la jauge | 17 / 18 → 18 / 24 |

**Passe de l'échelle recommandée (22 / 30, 18 / 24, 16 / 22)**, sur les 170 états : la `coupe` du rang et du butin disparaît. 16 / 22 est déjà rendu (sorte du Test, 17 sites) ; c'est la recommandation (question 1). Il reste 10 états avec un relevé neuf :
- les masques de la halle et du port (4) ;
- le croisement de la nouvelle partie (3) ;
- la clôture du chapitre ;
- la dissipation (entrée) ;
- la fin de séance.

Ce sont des listes ou des têtes à hauteur fixe dont la disposition doit reprendre la boîte du nom.

### Étiquette

**2 états avec un relevé neuf** : `creation-identite` et `creation-possessions` (`coupe` « nom du héros », `rogne` le nom dans `heros-neuf`). Le compte de la colonne des acquis (`div.acquis > div.a > i > span.jeton`, 44 sites) passe de 10 / 16 à 11,5 / 21. Les 60 lignes d'acquis grandissent chacune de 5 px, jusqu'à 20 px en tout, et poussent le nom hors de son cadre.

Voisins déplacés sans relevé :

| Site | États | Écart mesuré |
|---|---|---|
| création, compétences mineures (`div.pills.mineurs > span.pill.fermee`, 22 sites) | 1 | les pastilles passent de 12 / 23 à 10,5 / 21 ; la rangée se recompose, jusqu'à 41 px |
| dépense d'expérience, pastilles 10 / 19 et `.tag` des achats | 1 ; 3 | jusqu'à 10 et 11,5 px |
| Compendium, `.puce` (31 → 19) | 3 | −12 px. La puce du Compendium a deux lignes : elle sort de la nature (forme cible, « ce que la cible retire ») |
| maladresse, `div.issue > b` (15 px → 12,5) | 1 | −19 px sur la ligne de l'issue |

### Filet (marge du kit 11 0 partout, trait devenu `filet()`)

**26 états avec un relevé neuf.**

| Relevé | États | Site et cause (probable) | Avant → cible |
|---|---|---|---|
| `masque` | 8 | halle (achat, vente, la main), port (achat, avitaillement, négoce, recrutement), nuit (bivouac). Les filets posés entre les lignes du corps prennent 22 px chacun ; le corps passe jusqu'à 297 > 248 | `div.defile.corps > div.filet` 0 → 11 0 |
| `retrecit` | 4 | création : les talents tirés (`div.tire`, 38 → 35) et la jauge de la présentation (8 → 2) sont écrasés par le filet de tête du choix | `#choix .place > .filet:first-child` 4 26 5 → 11 0 |
| `deborde` | 3 | nouvelle partie : l'affiche des campagnes déborde | `.affiche .filet` 7 30 6 → 11 0 |
| `rogne` | 3 | options : la dernière préférence de la feuille est rognée | `.feuille .filet` 4 0 → 11 0 |
| `contenu` seul | 8 | le corps des pages de la halle, du marchandage, du port, des soins, de la nuit, et la colonne de droite de la poursuite et du bord : ce qui défile se déplace | — |

Le trait devenu `filet()` ne change aucune hauteur : le trait et le filet font tous deux 1 px. Seules sa teinte et sa marge changent.

### Ligne de liste (hauteur 28, puce du kit)

**5 états avec un relevé neuf** (feuille sans les lignes `ligneDu`, libellé-valeur).

| Relevé | États | Site | Avant → cible |
|---|---|---|---|
| `retrecit`, `chevauche` | 2 | combat naval, rangées de l'équipage (`div.rangees > div.rangee`) : les portraits se chevauchent | 32 → 28 |
| `retrecit`, `chevauche` | 1 | fin du combat (victoire), lignes du butin (`div.lignes-b > div.ligne-b`) : les portraits se chevauchent | 34 → 28 |
| `retrecit` | 1 | Compendium, index des familles (`div.familles > div.ligne`) | 40 → 28 |
| `chevauche` | 1 | port (avitaillement) : « ration pour un jour » chevauche les noms des lots | 41 → 28 |

Voisins déplacés sans relevé :
- Compendium : les rangées et les renvois (23 et 26 → 28), sur 95 et 87 lignes. Ce sont des listes qui défilent : jusqu'à 145 px plus bas en fin de liste.
- Fiche et changement de carrière : 26 et 30 → 28, jusqu'à 14 px.

Non couvert par la mesure :
- les formats 21:9, 16:10 et `bureau` ;
- les places que `gestes.js` mesure au montage, la feuille simulée étant posée à `DOMContentLoaded` ;
- la teinte des noms et des étiquettes, qui ne déplace rien et n'est pas simulée ;
- le séparateur « · » ;
- les familles de lignes hors de la feuille simulée (`.achat`, `.exige`, `.soin`, `.cochable`, `.couche`, `.jouera`), à deux étages.

La sonde générique d'étiquette et de ligne compte aussi des boîtes qui n'en sont pas. Elles sont écartées par une règle de chemin écrite (méthode), sans contrôle état par état.

## Images

- Planche : `hotes/godot/cibles/propositions/sources/kit/planche-listes-et-noms.html` (feuille de `kit/proposition-listes-et-noms.js`, chargée après `planche.js`), rendue en code 0, relevé vide. Pour chaque nature, à gauche les variantes d'aujourd'hui et leur taille, à droite la forme cible sur bois et sur parchemin. La boîte pointillée d'un nom est son interligne.
- Avant / après simulés (hors dépôt, avant à gauche). Les images du filet et de la ligne montrent la forme mesurée, pas la forme recommandée, qui n'est pas simulée (questions 2 et 3) :
  - nom : `coup-critique` en trois volets (avant, 16 / 19 qui coupe le rang actif, 16 / 22 qui tient), `halle-vente` à l'échelle recommandée ;
  - étiquette : `creation-identite` ;
  - filet : `halle-achat`, `options` (marge 11 0 partout, la forme mesurée et déconseillée) ;
  - ligne : `compendium-index`, `fin-victoire` (hauteur unique de 28, la forme mesurée).

## Questions à l'utilisateur

Choix d'interface, révisable (pas une règle de jeu).

1. **Cran `petit` du nom : 16 / 22 (recommandé) ou 16 / 19.**
   - 16 / 19 est la proposition du lot titres, prise à la carte. Il coupe 55 états (mesuré) : la gothique de 16 px déborde d'une ligne de 19 quand la boîte coupe son texte par une ellipse.
   - 16 / 22 est déjà rendu (sorte du Test, butin). Mesuré sur les 170 états, il lève la coupe du rang et du butin ; il reste 10 états à reprendre par leur disposition, dont la coupe horizontale de la fin de séance.
   - La carte (lot plaques) peut garder son interligne de 19 sur deux lignes : ce n'est pas une ellipse.
2. **Marge du filet : du placement (recommandé) ou 11 0 partout.**
   - Recommandé : `filet()` n'a pas de marge propre, comme la rubrique au lot titres (« Nu + filet() »). L'écart à ses voisins et le retrait latéral (26, 30, 40, 120) sont du placement : l'écart de la colonne ou la table du gabarit. 27 filets ont déjà la marge 0 de leur place.
   - 11 0 partout casse 26 états (mesuré) : des listes masquées, l'affiche, la création, les options. Chacun devrait reprendre sa disposition.
   - La forme recommandée n'est pas simulée : par définition, elle ne déplace rien, puisque chaque filet garde l'écart de sa disposition.
3. **Ligne de liste : une hauteur (28) ou deux (recommandé : 28 pour une ligne, 44 pour deux).**
   - Une seule hauteur casse 5 états, et toutes les lignes à deux étages : exigences 38, achats 34, soins 54, cochables 41, couches 46.
   - 44 est la ligne de choix en deux de `cartesDu` (`kit.md` § 2, « Plaque : carte »), déjà rendue. `precision` passe alors sous le nom.
   - Seule la hauteur unique de 28 est simulée. La paire 28 / 44 ne l'est pas : elle reste à mesurer après la réponse.
4. **Compte : 11,5 / 21 (recommandé) ou 10 / 16.**
   - 10 / 16 a le plus de sites (44), mais sur un seul écran : les acquis de la création, sur bois.
   - 11,5 / 21 est rendu sur trois écrans et a la hauteur de la pastille : les deux pièces rondes s'alignent.
   - Avec 11,5 / 21, la colonne des acquis grandit de 20 px et coupe le nom du héros (2 états). Sa disposition doit la reprendre.

Tranché sans question par un arbitrage déjà cité :
- l'intertitre nu du lot titres (« Nu + filet() ») : le trait de bloc de la rubrique et le filet de bloc appartiennent à leur nature ;
- les teintes d'état des noms (ennemi, éteint, refusé) : ce sont des états de la donnée, non des variantes.

## Signalements hors lot

- `S/voyage/voyage.css:12` : `.filet{margin:11px 0 8px}` sans portée. Elle change la marge du kit dans les gabarits qui chargent `voyage/voyage.css` (route et relais, `S/rendu.js:1742`, `:1754`).
- `S/rendu.css:15` : `#verdict .sous .point`, émis par aucun script (déjà noté au catalogue).
- `.pt` a deux sens : puce de coop (`S/outils/outils.css:45`) et station du changement de carrière (`S/heros/heros.css:361`).
