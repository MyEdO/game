# Propositions : commerce (2026-11-17, #3935)

Compte rendu des six états dessinés pour la halle, le Marchandage et le port, des écrans sans image d'intention.
Contenu lu au code (`src/hote/`, `src/noyau/`, `src/i18n/messages/fr.ts`), jamais le design d'un écran existant.
Sources au dépôt : `sources/commerce/` ; elles lient le socle commun de `sources/lieux-et-nuit/` et, pour le
Marchandage, le jet opposé de `sources/combat/` (`jet.css`, `jet.js`).
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

Cible écrite suivie : `../ecrites/lieu.md` (halle : ligne par denrée, chargement, lots, billet de rumeur ; port : un
lieu ; Marchandage : le bandeau de jet du combat à sa place). Règles du 2026-11-16 appliquées par-dessus : un choix
parmi beaucoup d'éléments se met en scène dans son lieu avec ses PNJ ; un service vit sur la page des services de son
lieu.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (`ecran.marche.*` l.1150-1164, `out.bargain*`
l.1899-1910, `lm.rumeur` l.2589, `port.*` l.4061-4104) ; répliques d'accueil de `src/data/lieux-services.json` ; port
de Salzenmund de `src/data/naval-ports.json`.

Exemples chiffrés, sans valeur de règle : bourses des héros et part de chacun, seuil de Marchandage d'Aldric (45),
dés tirés, cale 240 / 300 Enc et coque 52 / 60 de la cogue, durées de mer (3 j, 2 j).

Pièces neuves : cartouche d'offre pointé sur son PNJ ; jauge de porteur ; réglette de quantité ; voies d'un lot. Le
bandeau de jet opposé est celui du combat.

## halle-achat
- Page des services de Kemperbad ouverte sur « Marché » (rail : Auberge, Marché, Forgeron, Temple, Port, de
  `src/data/lieux-services.json`). Les offres sont les négociants de la halle : un cartouche par denrée, pointé sur
  son PNJ (Laine 350 Enc à 2/– / Enc ; Vin 280 Enc à 6/– / Enc, « Évaluer le vin »).
- Les porteurs du groupe au premier plan (charrette 25 Enc, `src/data/vehicles.json` ; mule 14 Enc).
- Page « Le chargement » : porteur et sa jauge, Enc à acheter (de 10 à 25), prix de base, lot partagé +10 %,
  estimation, « Bourses du groupe » par `bourse(…)` (entreprise commune, #3004 : la part de chaque héros réglable et
  le total), « Conclure l'achat » (`src/noyau/marcheEnVue.ts:50-88`, `src/hote/ecran.ts:837-871`).
- Billet de rumeur cloué : « Vivres, Bois se vendraient le double à Eilhart. »
- RAW : disponibilité (Taille + Richesse) × 10 MSRC 13 l.26 ; taille de cargaison l.38 ; prix de base l.86-91 (laine,
  printemps) ; vin et Évaluation l.95-104 ; lot partagé +10 %, pas moins de 10 Enc l.131 ; rumeur l.180 ; Kemperbad
  l.227 ; Eilhart l.216. Formule : `src/noyau/cargaison.ts:72-85`.
- À valider : les offres en cartouches sur les négociants plutôt qu'en lignes d'un pupitre (la cible écrite du 13 dit
  « une ligne par denrée ») ; le rail des services du lieu gardé ouvert à gauche pendant le commerce ; les porteurs
  dessinés dans la scène et choisis sur la page ; la page de droite pour composer l'achat ; le billet de rumeur cloué
  sous le rail ; « mènera le Marchandage » dit sous le héros qui marchande.

## halle-vente
- La même halle, charrette chargée. Les lots sont sur leurs porteurs : cartouche « Charrette » déplié sur son lot
  (Laine 25 Enc), mule vide ; les négociants ne montrent plus que leur enseigne.
- Page « Le lot » : prix de base, mise à prix à Kemperbad (+5 %), trois voies : Vendre (acheteur sur 60 ou moins,
  puis Marchandage), Brader (moitié du prix de base), Déplacer (vers la mule).
- RAW : acheteur Taille × 10, +30 en place de Commerce, moitié du lot sinon MSRC 13 l.146 ; mise à prix l.150-156 et
  exemple l.174 ; brader à la moitié l.160. Code : `src/noyau/landMarketFlow.ts`, `src/noyau/cargaison.ts:72-85`.
- La table de mise à prix (MSRC 13 l.150-156) et son exemple (l.174) ne donnent pas le même indice de richesse ;
  l'image suit l'exemple (+5 %).
- À valider : la vente lue sur les porteurs (un lot se choisit sur sa charrette) plutôt que dans une liste de
  cargaison ; les trois voies du lot en cartes, la voie choisie armée ; le nombre visé de l'acheteur dit en clair
  avant le jet ; l'achat et la vente en deux états de la même halle plutôt qu'en deux onglets.

## marchandage-avant-le-de
- Le bandeau de jet du combat prend la place du bandeau des héros : Aldric (≤ 45) contre « Le négociant en laine »
  (seuil masqué « ? », `src/engine/combat.ts:519`), « Test opposé », les enjeux (Gagné −10 %, Succès Stupéfiant −20 %,
  Perdu +10 %, Négociateur 10 % de plus), les réserves, « Lancer », « Résilience », « Annuler ». Le cartouche du négociant et la page du chargement restent lisibles au-dessus.
- RAW : Marchandage, « augmenter ou diminuer le prix de 10 % », jusqu'à 20 % sur Succès Stupéfiant (+6) ou avec
  Négociateur LDB 59 l.43, MSRC 13 l.127 ; le marchand qui gagne monte le prix (`src/noyau/landMarketFlow.ts:325`) ;
  marchand 2d10+30 MSRC 13 l.129. Code : `src/engine/bargain.ts:15-29`, `src/noyau/merchantFlow.ts:236`, `:861`.
- À valider : le Marchandage dans le bandeau de jet, la halle restant visible ; les enjeux affichés avant le dé ; le
  seuil du négociant masqué ; « Soutien du groupe » en pastille près du nom.

## marchandage
- Le jet résolu : dés et DR des deux camps, « DR net +4 », « Gagné (−10 % à l'achat) », prix barré et prix marchandé
  (2 CO 15/– vers 2 CO 9/– 6 sc), ligne « Marchandage gagné −10 % » ajoutée au compte de la page.
- Les parts des bourses suivent le prix marchandé. Suites : les réserves, « Conclure », « Relancer » et « Résilience »
  fermées sur une réussite, « Chance : +1 DR », « Pacte », « Refuser le marché » (`src/noyau/merchantFlow.ts:879`,
  `:897-916`).
- RAW : LDB 59 l.43 ; MSRC 13 l.127.
- À valider : le verdict au centre avec le prix avant et après ; les suites en plaques sous le verdict, « Conclure »
  armée ; le compte de la page mis à jour dès le verdict.

## port
- Le port est un lieu (Salzenmund, `src/data/naval-ports.json`) : récit, quai, navire du groupe à l'amarre. Les
  services sont des cartouches sur leurs PNJ et bâtiments : Chantier naval, L'entrepôt (déplié, réplique d'accueil,
  « Entrer »), Taverne des marins, L'avitailleur ; « Votre cogue » porte coque et cale.
- Fragment de carte, « Ouvrir la carte », départs « Prendre la mer » (Norden, Hargendorf) ; sortie « Explorer ».
- Code : `src/noyau/portFlow.ts:1-25` (recruter l.521, avitailler l.588), `src/noyau/seaVoyageFlow.ts:2345-2403`
  (devis de chantier, réparation, carénage).
- À valider : le port dessiné comme un lieu, ses services sur le quai plutôt qu'en liste ; l'état du navire lu sur le
  navire ; les départs en mer sur la carte du lieu ; un seul cartouche déplié à la fois.

## port-negoce
- Page « Services du port » ouverte sur « Négoce de cargaison » (rail : Négoce de cargaison, Chantier naval,
  Recrutement, Avitaillement). Offres sur le quai : Bois 320 Enc, Produits de luxe 360 Enc « Surplus ». « La cale »
  porte le lot du groupe (Céréales 60 Enc).
- Page du lot : prix de base 120 CO, demande +1, prix d'offre, vendeur +2 DR, « Vendre » (nombre visé 80), « Brader »
  au quart (30 CO). Note : « Au port, seule la cale du navire se négocie. » (`src/noyau/cargaison.ts:60-71`).
- RAW : cargaisons et taille MDG 15 l.321-331 ; Marchandage 3d10+40, +1 DR lot partiel, +1 DR Surplus l.335-341 ;
  nombre visé (Taille + Demande) × 10, +30 l.362 ; prix d'offre l.378-383 ; +1 DR, +1 DR Demande l.389 ; brader au
  quart l.399 ; prix l.424-436.
- À valider : le négoce de mer sur la page des services du port, même mise en scène que la halle ; la cale comme seul
  porteur, dite en note ; les avantages de DR du vendeur annoncés avant le jet ; le rail propre au port, distinct du
  rail de la ville.

## Non dessiné
- L'achat à l'échoppe (acte individuel, payé par l'acheteur, #3004) n'a pas d'image dans cette famille.
- Halle et port : refus (bourse sous le plancher, porteur plein), aucun acheteur trouvé, moitié du lot proposée,
  évaluation du vin résolue, Marchandage de vente, Marchandage perdu.
- Port : pages du chantier naval, du recrutement et de l'avitaillement (aucun tarif de réparation ni de carénage
  n'est montré).
