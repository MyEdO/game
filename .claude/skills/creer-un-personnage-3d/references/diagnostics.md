# Diagnostics de construction et de rendu

Lire le cas correspondant au défaut visible. Isoler une cause à la fois, garder pose et caméra,
comparer le GLB réimporté avant/après. Les requêtes Blender aident à construire ; une mesure de
validation appartient exclusivement à l'évaluateur Node. Un diagnostic visuel ne rend pas verte
une garde manquante ou en échec. La base reste intacte ; un défaut de base revient à sa porte L1.

## Seuil de passage

**Retour à la construction :** silhouette contraire à l'image ; gros trou ou peau traversante
dans une pose usuelle ; pièce flottante ; couture ouverte au repos ; poing illisible ; surface
cassée à taille du jeu ; retrait cassé ; voisin ou animation perdus. Un gros défaut dans un gros
plan de contrôle reste à corriger même si une capture distante le masque.

**Acceptable artistiquement pour avancer :** petits plis anguleux, coutures simplifiées,
microdétail absent sans effet sur l'identité, approximation invisible d'une surface interne.
Ce jugement ne dispense pas des gardes techniques. Une pose non contrôlée reste NON VÉRIFIÉ.

## Couture ouverte, peau traversante, épaule creuse

- Examiner la frontière réelle du corps et du vêtement dans le même espace et la même pose.
  Les sommets correspondants partagent positions et poids ; comparer après déformation.
- Une décimation indépendante de deux zones peut détruire la frontière commune : revenir au
  donneur avant décimation, reconstruire la couture, puis simplifier en protégeant cette zone.
- Une épaule ne se construit pas par deux ellipses indépendantes autour d'os. Préserver deltoïde,
  clavicules et emmanchure ; vérifier que les filtres de poids ne retirent aucune face nécessaire.
  Un rayon de secours ne prouve pas qu'il retrouve la bonne surface.
- Une chemise composée de fragments du corps peut être fissurée. Vérifier connectivité, ourlet
  et encolure ; une coupe horizontale ne remplace pas une encolure construite.
- Contrôler ensemble peau, dessous, cuir et manche. Corriger coupe et poids localement ; gonfler
  tout le vêtement déplace souvent le défaut et ruine la silhouette.

## Col, revers, nœud ou drapé qui flottent

Tracer les contours visibles et vérifier le support en profondeur. Un revers élargi peut encore
passer derrière le manteau. Prolonger le col depuis sa frontière, avec attaches et poids cohérents.
Un foulard forme une nappe continue autour du cou, avec côtés et attaches raccordés.
Contrôler les faces entre sommets, côté intérieur compris ; quelques points décalés ne prouvent
pas le dégagement des nappes. Des crêtes parallèles et bandes sombres peuvent évoquer des plaques :
simplifier les plis au service du tissu.

## Support, accessoire souple ou coque mal ajustés

Projeter sur la surface porteuse réelle évaluée (vêtement si porté sur un vêtement), normales
et positions dans les mêmes espaces. Choisir liaison rigide ou poids du porteur selon la fonction,
puis contrôler les poses utiles. Vérifier face/profil et profondeur : un rayon de secours peut
retrouver le dos au lieu du devant. Les seuils techniques viennent de la garde Node concernée.

Construire attache et souplesse ensemble. Un papier sous une cire peut avoir un contact volontaire
à sa racine ; cela ne justifie ni traversée du vêtement ni lame rigide flottante. Contrôler
courbure, sortie de l'attache et déformation avec le porteur dans les poses utiles.

Pour une coque ajourée, préserver vide intérieur et séparation avec peau et cheveux. Exposer
ouvertures et dégagements des deux côtés, puis en tenue complète ; le retrait d'un voisin sert
au diagnostic et ne dispense pas de vérifier l'assemblage restauré.

## Taches noires, triangles parasites, ombres suspectes

Faire une sonde ombres ON/OFF sans changer simultanément géométrie, matériaux et éclairage.
Si le défaut reste, examiner doublures traversantes, normales, faces non planaires et culling.
Une face double ne corrige pas une orientation ou une épaisseur incohérente.

Sur une géométrie reconstruite en pose, distinguer espace de liaison et espace posé : vérifier
matrices de bind, poids et skinning effectif de l'exporteur puis du moteur. Transformer les
normales de la surface finale après épaisseur selon ces conventions ; réexporter et regarder
dans la cible. Une formule inverse de skinning n'est pas une prescription universelle.
Deux nappes liées : vérifier poids des jumeaux, normales, triangulation et diagonales correspondantes.

## Poing, poignée ou gant déformés

Reprendre la main anatomique intacte ; vérifier FK et opposition du pouce avant le gant.
Les moyennes de centres d'os ne définissent pas l'espace libre de la poignée. Interroger les
surfaces évaluées après fermeture, puis regarder paume, dos et dessous en GLB. Garder un diamètre
de poignée crédible ; ne pas le réduire pour obtenir artificiellement une mesure nulle.
Une correction des clips de base doit repasser leur porte, sans patch dans l'élément.
Contrôler la lame dans l'ensemble du personnage.

Pour un objet plat, construire la prise visible sur la référence : appui sur paume ou bord et
opposition doigts/pouce selon le mode de prise. Regarder les deux faces utiles : les axes des os
ne prouvent pas le contact et une arme voisine peut le masquer.

Une enveloppe de gant gonflée dans les concavités peut croiser ses faces. Repartir d'une enveloppe
mince, limiter localement l'épaisseur par courbure/arêtes ; contrôler les creux des doigts et
la peau séparément du gant. Un décalage global ne répare pas cette construction.

## Compteur d'intersections et contact apparent

Un BVH compte des paires de triangles : auto-contact, voisinage et surfaces de confinement peuvent
produire des résultats sans trou visible. Inversement, un mauvais périmètre peut ignorer un défaut.
Nommer pièce, région et pose ; inspecter contact réel au repos, en déformation et en tenue complète.
Un compteur seul, nul ou non nul, ne valide pas le rendu. Corriger la garde canonique si son
périmètre est faux ; ne pas la contourner par une seconde mesure Python.

## Pièce disparue ou cadrage faux en gros plan

Calculer la boîte sur la géométrie déformée avec matrices monde réellement évaluées, parents,
matrices de liaison et déplacement de pose compris. Recentrer après changement de clip. Vérifier
near/far et culling : une sphère englobante mise en cache peut masquer une partie animée hors
de son ancien volume. Corriger les bounds, refaire gros plan et vue entière. Une capture où
la pièce manque ne prouve rien sur sa qualité.

## Silhouette encore fausse après plusieurs retouches

Revenir à la comparaison image/ensemble et aux trois à cinq signes d'identité. Examiner base,
proportions, pose, coupe et grands accessoires avant facettes et matières. Après deux corrections
inefficaces, changer de méthode ; garder la lumière stable. Une base inadéquate est une dépendance
à corriger dans son lot, pas un corps à morpher pour ce personnage.
