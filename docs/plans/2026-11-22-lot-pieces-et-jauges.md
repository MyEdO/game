# Lot de natures : bulles, plaques et boutons, jauges

Ticket: #4585

(#4585 : vérification du contenu entre états et restes de la revue des maquettes.)

Partie du point d'arrêt unique des natures restantes (plan `docs/plans/2026-11-21-maquettes-en-donnees.md`, étape 3, choix de l'utilisateur du 2026-11-22 : « Un seul arrêt (Recommandé) »). Méthode et forme du document : `docs/plans/2026-11-21-lot-titres.md`. Ce document relève et propose ; il n'applique rien. La planche est `hotes/godot/cibles/propositions/sources/kit/planche-pieces-et-jauges.html` (script `kit/proposition-pieces-et-jauges.js`).

Trois natures du catalogue (`hotes/godot/cibles/propositions/kit.md`, § « Catalogue ») :

- **bulle** : `raison`, `apercu`, et l'infobulle native (`title`) ;
- **plaque et bouton** : `plaque`, `rond`, `outil`, `medaillon`, avec `disque` et `compteur` (l'ancien `medaillon` du combat) ;
- **jauge** : `jauge`, `rangDePas`, `reglette`, et les `clous` de la création.

Les noms posés dans une plaque sont ici : ce sont les libellés de plaque. Les cartes de choix (`carte`), les sceaux et la `mesure` (ligne libellé + jauge, lot lignes) ne sont pas relevés.

## Méthode

- **Source** : le DOM des 170 états rendus en 16:9 (1280 × 720), lu par une sonde Playwright (`node_modules/.cache/sondes/pieces-et-jauges/releve.mjs`, hors dépôt). Sélecteurs : `.bulle-refus`, `.raison-de-refus`, `.apercu`, `[title]` ; `.plaque:not(.carte)`, `.bouton-rond`, `.outil`, `.medaillon`, `.disque`, `.compteur`, `.geste`, `.case-r` ; `.jauge`, `.pas`, `.clous`, `.reglette`. Pour chacun : rect, styles calculés de la pièce, de son premier enfant et de son premier texte, pictogramme, fond (plus proche ancêtre `.parchemin` ou `.bois`, « scène » sinon).
- **Relevé** : 2 827 éléments visibles. Le rôle est attribué par la classe émise et le chemin DOM (règle écrite par sélecteur, pas état par état).
- **Une variante** = taille nommée, rect, police, taille de texte, inter-lettre, marge du libellé, nombre de lignes, pictogramme, ombre ou état distincts au rendu. La largeur et la position sont du placement (A1) et ne comptent pas, sauf pour la bulle, dont la largeur est sa forme (elle n'a pas d'emplacement).
- **Limite** : seul le 16:9 est sondé ; 21:9, 16:10 et `bureau` ne le sont pas. Le nombre de lignes d'un libellé est compté par les rects du texte ; un pictogramme en ligne peut compter pour une ligne (les « 2 l. » avec pictogramme sont souvent une seule ligne de texte).

## Variantes réelles par rôle

| Nature | Rôle | Variantes | Sites | États |
|---|---|---|---|---|
| bulle | raison (bulle de refus) | 7 | 20 | 20 |
| bulle | raison en ligne (`.raison-de-refus`) | 4 | 4 | 4 |
| bulle | aperçu | 1 (corps : 5 feuilles) | 17 | 17 |
| bulle | infobulle native (`title`) | 12 porteurs | 113 | 30 |
| plaque | plaque | 68 | 669 | 162 |
| plaque | rond | 11 (5 tailles × états) | 746 | 168 |
| plaque | outil | 4 | 16 | 4 |
| plaque | médaillon | 10 | 204 | 76 |
| plaque | disque | 4 | 235 | 83 |
| plaque | compteur | 1 (4 libellés) | 4 | 1 |
| plaque | geste de scène, case rapide | 4 | 12 | 7 |
| jauge | jauge | 8 (2 hauteurs × 2 teintes × 2 liserés) | 478 | 130 |
| jauge | pas (losanges) | 4 | 17 | 16 |
| jauge | clous | 1 | 23 | 4 |
| jauge | réglette | 3 (largeurs) | 21 | 6 |

Ce que le DOM montre et que le catalogue n'avait pas :

- **Plaque** : le catalogue compte 5 surcharges d'habillage ; le rendu en porte 68 signatures, issues d'environ cinquante règles de famille qui changent la taille, l'inter-lettre, la marge ou la police du libellé (`S/heros/heros.css:30,116,170,307,322,335,342,343,348,379`, `S/outils/outils.css:20,63,66,70,73,86,108`, `S/commerce/commerce.css:12,40,60,69`, `S/lieux-et-nuit/nuit.css:9,28,40,43`, `S/rendu.css:31,68,82,155,213,279,285`, `S/accueil-et-systeme/nouvelle-partie.css:7,13,24`, …). Seuls 81 libellés sur 669 ont aujourd'hui la forme du kit (`S/gestes.css:183-187`).
- **Le libellé le plus fréquent n'est pas celui du kit** : 192 plaques moyennes sont en 13 px, inter-lettre 0,3, marge 0 4 : c'est la rangée des gestes de la fenêtre du bas (`#suites`, `S/combat/jet.css:60`), dont la forme est déjà retenue au kit (§ 2, « Plaque : gabarit », 13/12 sur trois lignes au plus).
- **Libellés en chiffres** : 48 plaques petites portent un libellé en police `Chiffres` 12 ou 12,5 (« 10 PX », « 5 sc », « 1 CO », « 2 j » : `S/heros/heros.css:322,342`, `S/lieux-et-nuit/nuit.css:9`, `S/commerce/commerce.css:69`). Le kit a pour cela l'emplacement `prix` (`.chiffres` 12,5 px).
- **Bulle** : la forme du texte est unique (Spectral italique 13 / 17, marge 4 11 5) ; les 7 variantes ne diffèrent que par la largeur et le retour à la ligne, fixés par famille : `width:340px` (`S/outils/outils.css:199`), `width:310px` (`S/voyage/voyage.css:58`), `width:100%` (`S/heros/heros.css:272`), plus les positions de `S/heros/heros.css:42-43,174-175,289-290,309-310`.
- **Infobulle native** : 113 sites dans 30 états, 12 porteurs (cases de bourse 35, cases de profil du dossier 27, lanceurs 13, soins 12, conséquences 7…). Rien ne s'en voit dans les maquettes : le détail promis par la doctrine du survol n'y est pas dessiné.
- **Rond, disque, jauge, réglette** sont déjà à une forme : les variantes relevées sont exactement les tailles et états du kit.

### bulle : raison (bulle de refus) : 7 variantes, 20 sites, 20 états
| Fond | Police | Taille | Interligne | Style | Blanc | Largeur | Marge int. | Couleur | Sites | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| parchemin | Spectral | 13 | 17 | italique | nowrap | au texte | 4 11 5 | (42,29,18) | 10 | creation, fiche-du-heros, fuite, incantation +3 (`div.ligne.refusee > span.bulle-refus` +6) |
| bois | Spectral | 13 | 17 | italique | normal | 174 | 4 11 5 | (42,29,18) | 3 | creation (`.acquis .gestes .bulle-refus`) |
| bois | Spectral | 13 | 17 | italique | nowrap | au texte | 4 11 5 | (42,29,18) | 3 | editeur-de-scene, interlude, tour-de-combat (`span.bulle-refus.dessous` +1) |
| parchemin | Spectral | 13 | 17 | italique | normal | 340 | 4 11 5 | (42,29,18) | 1 | compendium (`#fiche-du-compendium .pied .bulle-refus`) |
| parchemin | Spectral | 13 | 17 | italique | nowrap | 322 (au texte) | 4 11 5 | (42,29,18) | 1 | dossier |
| parchemin | Spectral | 13 | 17 | italique | nowrap | 301 (au texte) | 4 11 5 | (42,29,18) | 1 | fiche-du-heros (`div.oter > span.bulle-refus`) |
| bois | Spectral | 13 | 17 | italique | normal | 310 | 4 11 5 | (42,29,18) | 1 | le-bord (`.poste.ferme .et .bulle-refus`) |

### bulle : raison en ligne (`.raison-de-refus`) : 4 variantes, 4 sites, 4 états
| Fond | Police | Taille | Interligne | Style | Couleur | Écran (sélecteur) |
|---|---|---|---|---|---|---|
| parchemin | Fell SC | 10,5 | 13 | droit | (90,58,28,0.6) | changement-de-carriere (`div.et > i.raison-de-refus`) |
| plaque fermée | Spectral | 13 | 16 | italique | (141,132,116) | desengagement (`div.qui > div.c.raison-de-refus`) |
| parchemin | Spectral | 13,5 | 18 | italique | (58,42,24) | options (`div.regle.pointee > p.aide.raison-de-refus`) |
| plaque fermée | Spectral | 11,5 | 16 | italique | (141,132,116) | voyage-en-mer (`div.qui > div.c.raison-de-refus`) |

### bulle : aperçu : 1 variante, 17 sites, 17 états
| Fond | Tête | Largeur | Marge int. | Hauteur | Sites | Écrans |
|---|---|---|---|---|---|---|
| parchemin | gothique 22 / 24 | 300 | 11 14 | 103 à 269 (suit le texte) | 17 | bataille-de-masse, compendium, course-poursuite-en-mer, designation-d-un-heros, evenement-de-route, exploration (4), le-bord (3), tour-de-combat (3), voyage-en-mer, voyage-fluvial |

Le corps est redéfini par cinq feuilles, lu au code (la sonde ne lit pas l'intérieur du corps) : valeur de table Fell SC 14,5 (`S/combat/combat.css:65`) ou 14 (`S/lieux-et-nuit/commun.css:46`) ; paragraphe 13 / 17 (`S/exploration-et-recit/recit.css:24`) ou 14 / 19 (`S/outils/outils.css:182`) ; pied 13 / 17 italique deux fois à l'identique (`S/combat/combat.css:68`, `S/lieux-et-nuit/commun.css:47`) ; table et somme (`S/rendu.css:122-125`).

### bulle : infobulle native (`title`) : 12 porteurs, 113 sites, 30 états
| Fond | Porteur | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|
| parchemin | case de bourse | 35 | 7 | halle, marchandage, port (`div.bourses > div.case-bourse`) |
| parchemin | case de profil | 27 | 4 | dossier (`div.fond.parchemin > div.c`, `S/rendu.js:1632`) |
| parchemin | lanceur | 13 | 3 | course-poursuite-en-mer, poursuite-terrestre (`S/rendu.js:377`) |
| parchemin | soin | 12 | 5 | halle, port, soins (`S/lieux-et-nuit/soins.js:6`) |
| parchemin | conséquence | 7 | 7 | defense, evenement-de-route, incantation, jet-d-attaque +1 (`S/combat/jet.js:40`) |
| bois | activité brève | 6 | 2 | interlude (`S/rendu.js:1079`) |
| parchemin | carte courte | 4 | 2 | combat-naval, test-de-corruption |
| bois | issue | 3 | 3 | course-poursuite-en-mer (`S/rendu.js:897`) |
| parchemin | ligne de rôle | 2 | 2 | halle |
| bois | jet de la nuit | 2 | 1 | nuit (`S/rendu.js:1157`) |
| bois | rang d'abri | 1 | 1 | nuit |
| parchemin | ligne de compte | 1 | 1 | port (`S/rendu.js:1236`) |

### plaque : libellés par taille : 669 sites, 162 états

Les 68 signatures se regroupent ainsi (taille nommée, police, taille du libellé ; nombre de sites) :

| Taille | Rendus du libellé (px : sites) | Forme du kit | Sites déjà au kit |
|---|---|---|---|
| `petite` 28 | Fell SC 10 : 8 · 11 : 2 · 12 : 26 · 12,5 : 55 · **13 : 99** · 13,5 : 7 · 14,5 : 3 ; Chiffres 12 : 30 · 12,5 : 18 ; pictogramme seul : 24 | Fell SC 13, inter-lettre 1, marge 0 10 | 32 |
| `moyenne` 40 | Fell SC 12 : 6 · 12,5 : 5 · **13 : 192** (dont rangée des gestes) · 13,5 : 12 · 14 : 6 · 14,5 : 66 · 15 : 75 · 15,5 : 3 · 16 : 2 · 16,5 : 16 · 17 : 2 | Fell SC 15, inter-lettre 1, marge 0 10 | 49 |
| `appel` 52 | Fell SC 18 : 12 (marges 0 20 et 0 24) | Fell SC 18, inter-lettre 1,4 | 0 (marge) |

Les plus fréquentes, avec leurs sélecteurs (table complète : relevé hors dépôt, 68 lignes) :

| Taille | Hauteur | Police | Taille | Inter-lettre | Marge | Lignes | Picto | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|---|---|---|
| moyenne | 40 | Fell SC | 13 | 0,3 | 0 4 | 1 à 3 / 12 |  | 192 | 61 | bataille-de-masse, butin, carte-du-monde, combat-naval +24 (`#suites div.place > div.plaque`) |
| moyenne | 40 | Fell SC | 14,5 | 1 | 0 10 | 1 | 19 | 64 | 16 | carnet, halle, marchandage, nouvelle-partie +3 (`#rail .plaque`, `S/lieux-et-nuit/commun.css:60`) |
| petite | 28 | Fell SC | 13 | 1 | 0 6 | 1 |  | 29 | 12 | depense-d-experience, dossier, fiche-du-heros, le-bord |
| moyenne | 40 | Fell SC | 15 | 1 | 0 10 | 1 |  | 24 | 16 | bataille-de-masse, depense-d-experience, document, dossier +4 (`div.gestes > div.plaque`) |
| petite | 28 | Chiffres | 12 | 0,2 | 0 4 | 1 |  | 24 | 4 | depense-d-experience, fiche-du-heros (`div.achat > div.plaque`) |
| petite | 28 | — | — | — | 0 9 | — | 19 | 24 | 4 | editeur-carte-du-monde, editeur-de-scene (`div.plaque.petite.seule`) |
| petite | 28 | Fell SC | 12,5 | 1 | 0 10 | 1 |  | 23 | 11 | bataille-de-masse, creation, editeur-de-scene, fiche-du-heros (`div.et.bois > div.plaque` +4) |
| petite | 28 | Fell SC | 13 | 1 | 0 8 | 1 |  | 21 | 9 | combat-naval, tour-de-combat |
| petite | 28 | Fell SC | 12,5 | normal | 0 4 | 1 |  | 20 | 8 | combat-naval, defense, jet-avant-le-de (`#jet .regle .options .plaque`) |
| moyenne | 40 | Fell SC | 15 | 1 | 0 8 | 1 | 19 | 14 | 5 | tour-de-combat |
| moyenne | 40 | Fell SC | 13,5 | 0,5 | 0 4 | 1 |  | 11 | 2 | sauvegardes (`.feuillet .gestes .plaque`) |
| petite | 28 | Chiffres | 12,5 | 0,2 | 0 4 | 1 |  | 10 | 3 | nuit (`.grille .plaque`) |
| moyenne | 40 | Fell SC | 16,5 | 1 | 0 10 | 1 |  | 9 | 8 | halle, port (`.plaque.conclure`) |
| petite | 28 | Fell SC | 10 | 0,2 | 0 4 | 1 |  | 8 | 1 | nuit (`.choix-h .plaque`, `S/rendu.css:82`) |
| moyenne | 40 | Fell SC | 12 | normal | 0 10 | 1 | 19 | 6 | 1 | tour-de-combat (`div.case-r > div.plaque`) |
| petite | 31 à 51 | Fell SC | 12 | normal | 4 10 | 1 |  | 4 | 3 | dialogue (`#jet .reponses .plaque`, hauteur auto, `S/exploration-et-recit/recit.css:35-36`) |
| moyenne | 41,3 | Fell SC | 15,5 | 1 | 0 10 | 1 | 19,2 | 3 | 3 | nouvelle-partie (`.affiche .plaque`, mise à l'échelle) |

### plaque : rond : 11 variantes, 746 sites, 168 états
| Taille | L × H | Marge | Picto | État | Sites | États |
|---|---|---|---|---|---|---|
| grand | 52 | 4 | 24 | repos | 205 | 83 |
| menu | 20 | 2 | 11 | repos | 174 | 30 |
| moyen | 44 | 4 | 20 | repos | 125 | 120 |
| petit | 34 | 3 | 18 | repos | 75 | 65 |
| menu | 20 | 2 | 11 | armé | 74 | 37 |
| maître | 92 | 5 | 44 | fermé | 46 | 46 |
| menu | 20 | 2 | 11 | fermé | 25 | 9 |
| maître | 92 | 5 | 44 | repos | 9 | 9 |
| petit | 34 | 3 | 18 | fermé | 7 | 7 |
| petit | 34 | 3 | 18 | armé | 5 | 3 |
| grand | 52 | 4 | 24 | armé | 1 | 1 |

### plaque : outil : 4 variantes, 16 sites, 4 états
| Fond | Libellé | Couleur | Picto | État | Sites | Écrans (sélecteur) |
|---|---|---|---|---|---|---|
| bois | Fell SC 11,5, 0,7 | `--creme-2` | 18 | repos | 7 | combat-naval, tour-de-combat |
| scène | Fell SC 13, 0,7 | `--ivoire` | 24 | repos | 5 | accueil (`#outils .outil`, `S/accueil-et-systeme/ouverture.css:21`) |
| bois | Fell SC 11,5, 0,7 | `--ivoire` | 18 | ouvert | 2 | combat-naval, tour-de-combat |
| scène | Fell SC 11,5, 0,7 | `--creme-2` | 18 | repos | 2 | nouvelle-partie |

### plaque : médaillon : 10 variantes, 204 sites, 76 états
| Taille | L × H | Picto | Ombre | État | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|
| moyen | 40 | 20 | portée | repos | 77 | 35 | arrivee, bataille-de-masse, coop, creation +10 |
| grand | 54 | 27 | portée | inerte | 56 | 56 | cartouche de titre, 23 écrans |
| petit | 30 | 15 | portée | repos | 46 | 17 | bataille-de-masse, carte-du-monde, exploration, halle +4 |
| moyen | 40 | 20 | portée | inerte | 8 | 8 | compendium, éditeurs |
| moyen | 40 | 20 | portée | fermé | 5 | 3 | depense-d-experience, interlude, le-bord |
| moyen | 40 | 20 | liseré intérieur (201,185,149,.45) | repos | 4 | 2 | carte-du-monde (`div.moyen.pris > div.medaillon`) |
| moyen | 40 | 20 | halo 18 px (255,214,140,.9) | visé | 4 | 4 | exploration, nuit (`.poste.vise .medaillon`, `S/lieux-et-nuit/commun.css:39`) |
| grand | 54 | 27 | portée | repos | 2 | 2 | creation |
| petit | 30 | 15 | halo 18 px (255,214,140,.9) | visé | 1 | 1 | bataille-de-masse |
| petit | 30 | 15 | halo 16 px `--halo-vif` | visé | 1 | 1 | changement-de-carriere (`.station.visee .medaillon`, `S/heros/heros.css:365`) |

### plaque : disque et compteur
| Pièce | Taille | L × H | Chiffre | État | Sites | États |
|---|---|---|---|---|---|---|
| disque | petit | 28 | Grenze 16 | repos | 133 | 53 |
| disque | moyen | 32 | Grenze 16 | repos | 60 | 56 |
| disque | grand | 42 | Grenze 20 | repos | 40 | 12 |
| disque | petit | 28 | Grenze 16 | vide | 2 | 2 |
| compteur | disque grand + libellé Fell SC 14,5 | 182 de large | — | — | 4 | 1 (tour-de-combat : Destin, Chance, Résilience, Détermination) |

### plaque : geste de scène, case rapide : 4 variantes, 12 sites, 7 états
| Pièce | L × H | Libellé | Sites | Écrans (sélecteur) |
|---|---|---|---|---|
| case rapide | 60 × 57 | Fell SC 12 | 6 | tour-de-combat (`div.rapides > div.case-r`, `S/rendu.js:447`) |
| geste de scène | 272 × 28 | Fell SC 14 | 4 | exploration (`div.apercu > div.geste`, `S/exploration-et-recit/recit.css:21`) |
| geste d'inspecteur | 254 × 35 | Fell SC 13 | 2 | editeur-carte-du-monde, editeur-de-scene (`S/rendu.js:818`) |

### jauge : jauge : 8 variantes, 478 sites, 130 états
| Fond | Hauteur | Teinte | Liseré | Sites | États | Écrans |
|---|---|---|---|---|---|---|
| bois | 6 | cire | `--filet-or` | 229 | 67 | arrivee, bataille-de-masse, carte-du-monde +18 |
| scène | 6 | cire | `--filet-or` | 184 | 55 | combat-naval, contre-sort, corruption-mutation +14 |
| bois | 8 | or | `--filet-or` | 18 | 15 | bataille-de-masse, combat-naval, course-poursuite-en-mer, halle +4 |
| parchemin | 8 | cire | `--trait-encre` | 17 | 17 | creation, dissipation, dossier, fiche-du-heros +4 |
| parchemin | 8 | or | `--trait-encre` | 14 | 9 | dossier, halle, marchandage, port |
| bois | 8 | cire | `--filet-or` | 12 | 12 | bataille-de-masse, combat-naval, tour-de-combat |
| parchemin | 6 | or | `--trait-encre` | 3 | 1 | butin |
| parchemin | 6 | cire | `--trait-encre` | 1 | 1 | butin |

### jauge : pas, clous, réglette
| Pièce | Fond | Élément | Écart | Plein | Sites | États | Écrans (sélecteur) |
|---|---|---|---|---|---|---|---|
| pas | bois | losange 15 | 5 | `--ivoire` → `--creme-2` | 8 | 8 | tour-de-combat (`#etat .pas`, `S/rendu.css:205`) |
| pas petit | parchemin | losange 11 | 8 | (106,61,28) → (42,22,10) | 8 | 8 | dissipation, focalisation, incantation (`S/combat-suite/suite.css:5-9`) |
| pas petit cire | parchemin | losange 11 | 13 | (210,85,58) → (124,31,20) | 1 | 1 | test-de-corruption (`.points .pas`, `S/combat-suite/suite.css:36`) |
| clous | parchemin | rond 9, groupe de 5 | 3 (+4) | or (`--or-eclat` → `--or-moyen`) | 23 | 4 | creation (`S/heros/heros.css:67-70`) |
| réglette | bois | piste 3, poignée 12 | — | cire → sang | 12 | 3 | options |
| réglette | parchemin | piste 3, poignée 12 | — | `--sang` | 9 | 5 | options, halle, port |

L'écart du kit (`.pas` 7, `S/gestes.css:177`) n'est rendu nulle part : chaque site le surcharge.

## Forme cible proposée

Une forme par rôle ; le fond ne change la forme que là où la pièce n'a pas sa propre matière (jauge, pas). Valeurs prises aux variantes rendues.

| Nature | Rôle | Primitive, signature | Forme | Pris à |
|---|---|---|---|---|
| bulle | raison | `raison({ texte })` | Spectral italique 13 / 17, marge 4 11 5, `--encre` sur parchemin ; **une ligne jusqu'à 300, puis à la ligne** ; la position reste du placement (`poserLesBulles`) | forme du texte : 20 sites sur 20 ; 300 : la largeur de l'aperçu (`S/gestes.css:145`), la bulle sœur |
| bulle | raison en ligne | la même `raison`, posée à la place de la ligne secondaire | Spectral italique 13 / 16, couleur de la ligne remplacée | `.c` de la carte (`S/gestes.css:209`, 13 / 16), 1 des 4 sites, et 3 sur 4 en Spectral italique |
| bulle | aperçu | `apercu({ nom, sous, corps, vers })` | inchangé ; un seul corps au kit : valeur de table Fell SC 14, paragraphe 13 / 17 italique, pied 13 / 17 | `S/lieux-et-nuit/commun.css:46-47`, `S/exploration-et-recit/recit.css:24` |
| bulle | infobulle native | supprimée : `raison` au survol (`data-ancre="survol"`, invisible au repos) | — | doctrine `user-doctrine-icone-identifie-survol-detaille` ; `reserves` le fait déjà (`S/combat/jet.js:75`) |
| plaque | plaque | `plaque({ libelle, taille, … })` | Fell SC, marge 0 10 ; `petite` 28 / 13, inter-lettre 1 · `moyenne` 40 / 15, 1 · `appel` 52 / 18, 1,4. Variante **`geste`** (rangée des gestes de la fenêtre du bas) : 40, 13 / 12, inter-lettre 0,3, marge 0 4, trois lignes au plus. Un nombre va dans `prix` (Chiffres 12,5) | `S/gestes.css:183-187` ; `geste` : `S/combat/jet.css:60` et `kit.md` § 2, 192 sites |
| plaque | rond | `rond(contenu, taille, { ferme, arme, survol })` | inchangé : 5 tailles, 4 états | 746 sites, déjà à une forme |
| plaque | outil | `outil(nom, libelle, { ouvert, ferme })` | rond `petit` + Fell SC 11,5, inter-lettre 0,7, `--creme-2` (ouvert `--ivoire`) | 11 sites sur 16 |
| plaque | médaillon | `medaillon(nom, { taille, ferme, inerte, vise })` | 3 tailles ; état **`vise`** neuf : halo `0 0 18px var(--halo-vif)` | le halo du portrait choisi (`S/gestes.css:87`) ; 18 px : 5 des 6 sites visés |
| plaque | disque | `disque(n, { taille, vide })` | inchangé | 235 sites |
| plaque | compteur | supprimé : `reserves` (icône + disque, nom au survol) | — | doctrine du survol ; `S/combat/jet.js:75` |
| jauge | jauge | `jauge({ compte, teinte, taille, ajout })` | inchangée : `fine` 6 · `forte` 8 ; `cire`, `or` ; liseré `--filet-or` sur bois et scène, `--trait-encre` sur parchemin | 478 sites, déjà à une forme |
| jauge | pas | `rangDePas({ pleins, total, taille, teinte })` | `moyen` losange 15 · `petit` 11 ; **écart 8** ; plein `--ivoire` → `--creme-2` sur bois, (106,61,28) → (42,22,10) sur parchemin ; teinte `cire` | écart 8 : 8 sites sur 17 (l'autre moitié à 5) |
| jauge | clous | supprimés : `rangDePas({ taille: 'petit' })` | — | `kit.md`, catalogue : « `clous` rejoint `pas` » |
| jauge | réglette | `reglette(part, largeur)` | inchangée | 21 sites |

Ce que la cible retire :

- **Bulle** : les largeurs fixes de famille (340, 310, 174, 100 %) et les `white-space` posés par famille ; les 11 émissions de `title=` (113 sites) ; les trois corps d'aperçu en double.
- **Plaque** : les quelque cinquante surcharges de libellé ; 669 libellés passent à quatre formes. Les libellés en chiffres passent en Fell SC, leur nombre dans `prix`. Les réponses du dialogue (hauteur auto, `S/exploration-et-recit/recit.css:35-36`) gardent une plaque `petite` à trois lignes au plus : la cible n'y simule que le libellé.
- **Médaillon** : deux halos écrits à la main (`S/lieux-et-nuit/commun.css:39`, `S/heros/heros.css:365`) deviennent l'état `vise`.
- **Compteur** : le libellé écrit (« Détermination » élargit sa case : 182 px pour quatre longueurs de nom) ; le nom passe au survol.
- **Pas** : les écarts 5, 13 et l'écart du kit 7, jamais rendu. **Clous** : le rond 9 px d'or et son groupe de cinq.

## Tenue de la forme cible : mesure

La forme cible a été **simulée** par une feuille injectée dans `rendre.mjs` (préchargement Playwright, `node_modules/.cache/sondes/pieces-et-jauges/cible.css` et `injecter.mjs`, rien au dépôt), sur les 170 états en 16:9, et comparée à une passe de référence rendue sur la même tête, sans feuille. Sont simulés : bulle de refus, raison en ligne, corps d'aperçu, libellés de plaque et `prix`, libellé d'outil, médaillon visé, compteur sans libellé, écart des pas, clous en pas petits. Rond, disque, jauge et réglette ne changent pas : rien à simuler. L'infobulle native ne se voit pas au repos : sa cible non plus.

- **Relevés bloquants** : 155 états sur 170 restent sans relevé neuf ; 15 en reçoivent un. Deux attributions ont été isolées en rendant l'écran sous une seule règle de la feuille : `changement-de-carriere` (raison en ligne seule) et `creation-competences-de-carriere` (clous seuls).
- **Rect des contenus** (`contenu`, comparé état par état à la référence) : 169 états inchangés ; 1 état où une boîte change de hauteur (`compendium/consultation` : le paragraphe de l'aperçu passe de 14 / 19 à 13 / 17, −6 px sur la tête, le texte et la source du renvoi).

### Sites où la forme cible ne tient pas

Le critère : un relevé bloquant, ou un voisin qui se déplace.

| Nature | Site | États | Relevé | Avant → cible |
|---|---|---|---|---|
| plaque | options du jet (`#jet .regle .options .plaque`, `S/rendu.css:31`, `S/combat/combat.css:182`) | `combat-naval`, `combat-naval-bordee`, `defense-avant-le-de`, `jet-avant-le-de` | `recouvert` et `chevauche` : « Virage » sur « Bâbord 45° », « Munition des pièces qui portent » sur « Boulet et poudre », « Porte-bouclier (2 Av.) » sur « Aucun » et « Résilience », le sceau vide sur « Au hasard » | petite 12,5, inter-lettre normal, marge 0 4 → 13, 1, 0 10 |
| plaque | barre d'outils des éditeurs (`#barre .plaque`, `S/outils/outils.css:63`) | `editeur-carte-du-monde`, `outil-terrain`, `porte`, `supprimer` | `rogne` : les segments « Narratif » rognés par la barre | moyenne 13, marge 0 11 → 15, 0 10 |
| plaque | socle de la nuit, choix des rations (`.choix-h .plaque`, `S/rendu.css:82`) | `bivouac` | `deborde` du socle ; `recouvert`, `chevauche` : « Rien » sur le portrait voisin | petite 10, inter-lettre 0,2, marge 0 4 → 13, 1, 0 10 |
| bulle | refus de la dernière panoplie (`.set .oter .bulle-refus`) | `fiche-possessions-prothese` | `recouvert` : la bulle (301 px sur une ligne) passe sur deux lignes et couvre « Possessions » ; « bulle sans pose libre » | nowrap → une ligne jusqu'à 300 |
| bulle | largeurs déclarées (`S/outils/outils.css:199`, `S/voyage/voyage.css:58`) | `compendium/atelier`, `le-bord/activites-en-mer` | `retrecit` : 300 au lieu de 340 et de 310 déclarés ; aucun texte caché, la bulle gagne une ligne | 340, 310 → 300 |
| raison en ligne | aide refusée des options (`p.aide.raison-de-refus`) | `options/verrou` | `coupe` : l'aide | Spectral 13,5 / 18 → 13 / 16 |
| raison en ligne | station de carrière (`div.et > i.raison-de-refus`) | `progression-changement-de-carriere` | `retrecit` : `pt` 32 au lieu de 34 | Fell SC 10,5 / 13 → Spectral 13 / 16 |
| clous | répartition des Augmentations (`.ligne.repartie .clous`) | `creation-competences-de-carriere` | `coupe` et `rogne` : « Art (Peinture) », « Discrétion (Urbaine) », « Évaluation », « Perception », « Résistance à l'alcool » | 10 ronds de 9, écart 3 (+4) = 121 px → 10 losanges de 11, écart 8 = 182 px |

Vu à l'image et non relevé : dans `creation`, la bulle des Augmentations (174 px fixés) prend 300 px et sort de sa colonne vers la gauche, au-dessus du panneau voisin (`data-dessus` l'exempte de `croise`).

### Sites sans écart mesuré

Libellés de plaque partout ailleurs (environ 580 sites, dont les 192 de la rangée des gestes, inchangés par construction) ; prix ; outil (accueil 13 → 11,5) ; médaillon visé (6 sites) ; compteur sans libellé (`tour-de-combat`, 4 sites) ; écart des pas (17 sites) ; les autres bulles de refus (14 sites).

Non couvert par la mesure : le survol (aucune maquette ne dessine l'état survolé d'une infobulle native, ni l'aperçu d'un compteur) ; la place prise par une icône de réserve à la place du libellé du compteur (la simulation retire le libellé sans poser d'icône) ; les places que `gestes.js` mesure au montage, la feuille simulée étant posée à `DOMContentLoaded` ; les formats 21:9, 16:10 et `bureau` ; les cartes de choix.

## Questions

Seulement les vrais choix ; ce que la doctrine du survol tranche déjà (infobulle native → `raison` au survol, compteur → `reserves`) n'en est pas un.

1. **Plaque petite dans les rangées denses** (options du jet, barre des éditeurs, rations de la nuit : 8 états ne tiennent pas).
   - *Une taille par plaque, les rangées reprises par leur disposition (Recommandé)* : 13 px pour toute plaque petite, comme le titre de panneau à 28 px partout ; la rangée gagne de la largeur ou passe à la ligne.
   - *Une variante `serree` 12 px* : 26 sites la portent déjà, mais elle garde une taille propre à la densité d'un écran.
2. **Un nombre seul dans une plaque** (« 10 PX », « 5 sc », « 2 j » : 48 plaques en police `Chiffres` 12 ou 12,5).
   - *Le nombre dans l'emplacement `prix`, Chiffres 12,5, le libellé en Fell SC (Recommandé)* : une police de chiffres, une place, comme les plaques d'achat d'aujourd'hui.
   - *Une variante de libellé chiffré* : le libellé entier en Chiffres 12, sans `prix`.
3. **Bulle de refus longue** (4 sites à 300 px ou plus).
   - *Une ligne jusqu'à 300, puis à la ligne (Recommandé)* : la largeur de l'aperçu, la bulle sœur ; une bulle ne traverse plus les cadres. Le refus de la dernière panoplie se repose par `poserLesBulles`.
   - *Toujours sur une ligne* : la bulle suit son texte, sans largeur fixée ; une bulle de 340 px et plus reste possible.
4. **Raison en ligne** (4 sites, 4 formes ; 2 ne tiennent pas).
   - *La forme de la ligne secondaire d'une carte, Spectral italique 13 / 16, partout (Recommandé)* : une forme, celle de la ligne que la raison remplace dans la carte ; les deux sites se reprennent par leur disposition.
   - *La forme de la ligne qu'elle remplace, site par site* : aucun relevé, mais quatre formes restent.
5. **Clous de la création** (23 sites ; en pas petits, 61 px de plus par ligne coupent cinq noms).
   - *Une forme `clous` de `rangDePas` : rond d'or 9 px, écart 3, groupe de cinq (Recommandé)* : une primitive, deux formes, chacune déjà rendue ; la liste de la création tient.
   - *Les pas petits partout, la liste de la création reprise* : une seule forme, la colonne des noms ou des clous à redessiner.

## Images

- Planche : `hotes/godot/cibles/propositions/sources/kit/planche-pieces-et-jauges.html`, rendue en code 0, relevé vide. Elle montre une sélection : 10 des 68 libellés de plaque, les variantes de bulle par largeur et la raison en ligne, l'outil, le médaillon visé et le compteur, les jauges et les pas ; la cible sur bois et sur parchemin. Le rond, le disque et la réglette, inchangés, n'y sont pas.
- Avant / après simulés (hors dépôt, avant à gauche) : bulles `fiche-possessions-prothese`, `activites-en-mer` ; plaques `bivouac`, `defense-avant-le-de` ; jauges `creation-competences-de-carriere`.
