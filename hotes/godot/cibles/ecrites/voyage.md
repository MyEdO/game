# Cible de finition de la famille « voyage » (#3935, lot 1b), 2026-11-13

Tirée de la référence de genre (`analyse.md` de ce dossier, 34 captures) et de deux consignes de Clément du
2026-11-13 : la maquette donne « une direction mais pas la destination », et « des jets vont avoir lieu, ils
doivent être en 2nd plan et focaliser sur le voyage (pour ça ce focus sur le décors) plus que le système ».
Évaluation d'ingénierie révisable : la porte de goût (le rendu de Godot à côté de la référence) la tranche.

## Parti pris

La caravane dans le paysage (The Banner Saga pour le décor de profil, Darkest Dungeon II pour la disposition :
véhicule au centre, héros nommés en bas, distance restante, interface aux coins). Deux emprunts que le genre fait
déjà : le contenant d'événement à matière et à image (Battle Brothers, Darkest Dungeon II) et le tableau
d'affectation de la halte (Pathfinder: Kingmaker).

## Ce que le joueur voit pendant le trajet

1. **Le décor prend tout l'écran.** Cinq plans : ciel (dégradé, astre du moment), lointain, relief moyen, plan de
   la route avec le groupe, premier plan en silhouettes sombres qui passent devant la scène. Chaque plan a un grain
   de matière et s'éclaircit vers le lointain (perspective atmosphérique). Le décor dépend du milieu de la route
   (forêt, collines, fleuve, montagne), du moment du jour (quatre palettes) et de la météo (pluie, neige, brume en
   particules et en teinte). Un vignettage ferme les coins, une seule source de lumière dirige l'œil (lanterne de
   la diligence ou feu au crépuscule et la nuit, astre le jour).
2. **Le groupe est dans le décor**, petit, en silhouettes distinctes par moyen (à pied, diligence, barge, navire)
   et par héros (taille de la race, coiffe ou arme de la carrière).
3. **L'interface tient aux bords.** En haut à gauche, le temps en objet : un cartouche qui porte le jour impérial,
   un demi-disque de ciel pour le moment, un pictogramme de météo. En haut à droite, la carte du trajet sur un
   fragment de parchemin encadré, lieux nommés, route à l'encre, partie faite en rouge brun. En bas, le bandeau des
   quatre héros. Juste au-dessus, la frise du trajet, mince : étapes en clous, nuits en croissants, et un seul
   chiffre, la distance restante. Aucun bouton de menu dans la scène : le menu du système est une pastille dans un
   coin.
4. **Les jets sont au second plan.** Un jet de routine ne prend ni fenêtre ni bouton : il se joue avec la journée
   et laisse sur la carte de son héros une pastille (réussite ou échec, icône de la compétence) et une demi-phrase
   de récit. Le détail (seuil, dé, degrés) s'ouvre au survol ou au clic de la pastille. Une relance offerte au
   héros (Chance) se propose sur sa carte, après le jet. À mesurer avant de coder : ce que la journée joue d'office
   aujourd'hui à terre et ce qui l'arrête (`jouerLaJournee`, cadence commandée).
5. **Seule une décision arrête le trajet** : un événement à choix, un combat, la halte. Un événement sans choix
   est une ligne de récit dans la scène et une trace au journal, il ne demande qu'à être lu.
6. **Le vocabulaire de règle quitte la scène** (« Postes de l'Étape », « Tout résoudre », texte de table adressé
   au meneur, valeurs brutes comme « (test) » ou « 0 sc »).

## L'événement de route

Un contenant à matière, posé sur le décor assombri : parchemin à bords irréguliers dans un cadre de chêne ferré.
Il porte un titre en gothique, une image (au minimum une vignette par catégorie de Rencontre, à l'encre deux tons),
le texte du livre en sérif, le dé tiré en sceau de cire, puis les choix : des barres pleine largeur, une phrase
complète par choix, le prérequis écrit sur le choix (compétence, coût), un choix fermé visible en gris. Quand un
choix demande un exécutant, il se désigne sur les portraits du bandeau. Le résultat est raconté par une phrase, le
jet restant une pastille.

## La halte

Un tableau d'affectation (un poste par colonne, un portrait par poste, la compétence et l'effet attendu en clair,
les vivres en compteur, un seul bouton), puis le récit de la nuit : une phrase par poste, sans nombre tiré. Les
listes déroulantes disparaissent.

## Matières, typographie, accents

- **Matières du Vieux Monde** : parchemin vieilli (texte, événements, carte), chêne sombre et fer noirci clouté
  (cadres, bandeau des héros), laiton patiné (filets, médaillons, cadres de portrait, pastilles), cire rouge
  (sceau du dé, danger), toile (cartouches de titre). Aucun rectangle translucide uni.
- **Typographie, trois rôles** : titres en gothique lisible (Grenze Gotisch, OFL) ; rubriques en petites capitales
  d'imprimerie ancienne (IM Fell English SC, OFL) ; texte courant en sérif (Spectral, à faire entrer en graisse de lecture : mesuré le 2026-11-13, le texte courant du
  jeu est en Open Sans, et le Spectral Medium des anciens titres est sorti avec eux). Les chiffres
  et les étiquettes gardent la linéale du projet. Trois tailles par écran.
- **Accents, un rôle chacun** : l'or du laiton pour ce qui se presse, et pour rien d'autre ; le rouge de cire pour
  le danger et l'échec. Tout le reste est encre sur parchemin ou crème sur bois sombre.
- **Portraits** peints, distincts, encadrés de laiton, la vie en barre fine à côté. Les bustes identiques
  d'aujourd'hui relèvent du chantier des modèles (#2972) ; le cadre et la barre sont de ce lot.

## Le kit à produire (lot 1b), dans l'ordre

1. Polices de titre et de rubrique, thème typographique à trois tailles.
2. Cadres en neuf tranches : panneau de parchemin, panneau de chêne ferré, cartouche de titre, infobulle.
3. Cadre de portrait, barre de vie, pastille de jet (deux issues), pastille d'état, sceau du dé.
4. Bouton de choix à quatre états (repos, survol, pressé, fermé), bouton en pastille à icône.
5. Objet du temps, frise du trajet, cadre de la carte du trajet, séparateur orné.
6. La planche du kit : chaque composant, chaque état, rendue par Godot.

Puis l'écran du voyage sur ce kit (décor en cinq plans, bords, jets en pastilles), l'événement de route et la halte.

## Hors de cette cible

Le mouvement (défilement du décor, entrée de l'événement) se juge sur un enregistrement, pas au pixel. Les
illustrations d'événement au-delà d'une vignette par catégorie, les portraits peints et les étapes nommées de la
frise (donnée de route, #3534) sont des lots de donnée nommés à part.
