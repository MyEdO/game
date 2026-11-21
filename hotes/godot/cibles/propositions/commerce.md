# Propositions : commerce (2026-11-17, #3935)

Compte rendu des dix états dessinés pour la halle, le Marchandage et le port, des écrans sans image d'intention.
Contenu lu au code (`src/hote/`, `src/noyau/`, `src/i18n/messages/fr.ts`), jamais le design d'un écran existant.
Sources au dépôt : trois écrans de `sources/maquettes/`, chacun la liste de ses états au format de
`sources/maquettes/maquette.ts`, dessinés par `sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png>
--format 16:9 [--etat <état>]`) : `halle` (`halle-achat`, `halle-vente`, et `la-main`, la halle vue d'un invité, au compte rendu de `outils.md`), `marchandage` (`marchandage-avant-le-de`,
`marchandage`) et `port` (`port`, `port-negoce`, `port-achat`, `port-chantier`, `port-recrutement`,
`port-avitaillement`). Les décors de la halle et du quai et la carte du port vivent dans `sources/commerce/commerce.js` ;
le Marchandage prend le jet opposé de `sources/combat/` (`jet.css`, `jet.js`).
Premières maquettes : chaque « choix à valider » attend l'utilisateur.

Cible écrite suivie : `../ecrites/lieu.md` (halle : ligne par denrée, chargement, lots, billet de rumeur ; port : un
lieu ; Marchandage : le bandeau de jet du combat à sa place). Règles du 2026-11-16 appliquées par-dessus : un choix
parmi beaucoup d'éléments se met en scène dans son lieu avec ses PNJ ; un service vit sur la page des services de son
lieu.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (`ecran.marche.*` l.1150-1164, `out.bargain*`
l.1899-1910, `lm.rumeur` l.2589, `port.*` l.4061-4104) ; répliques d'accueil de `src/data/lieux-services.json` ; port
de Salzenmund de `src/data/naval-ports.json`.

Exemples chiffrés, sans valeur de règle : bourses des héros et part de chacun, seuil de Marchandage d'Aldric (45),
dés tirés, cale 240 / 300 Enc et coque 52 / 60 de la cogue, durées de mer (3 j, 2 j) ; aux pages du port, les avoirs
(31 CO, 30 CO 9/–, 32 CO 6/–, 31 CO 3/– : un groupe qui vient de vendre ses céréales), l'équipage à bord et les
quantités réglées.

Pièces : les hôtes de la scène (offres, porteurs, navire, services, constructeur) en colonne entre le rail et la
page, en deux colonnes devant la carte du port ; jauge de porteur ; réglette de quantité ; voies d'un lot. Le
bandeau de jet opposé est celui du combat.

## halle-achat
- Page des services de Kemperbad ouverte sur « Marché » (rail : Auberge, Marché, Forgeron, Temple, Port, de
  `src/data/lieux-services.json`). Les offres sont les négociants de la halle : un cartouche par denrée (Laine 350 Enc à 2/– / Enc ; Vin 280 Enc à 6/– / Enc, « Évaluer le vin »).
- Les porteurs du groupe (charrette 25 Enc, `src/data/vehicles.json` ; mule 14 Enc).
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
- À valider (#4585) : chaque hôte de la scène dans une case de 340 × 152 ; la colonne en montre trois et fait défiler
  la suite (la mule de la vente sous la charrette) ; le corps d'une offre dépliée défile sous son cartouche, ses
  gestes au pied de la case ; la page du service sur la grille commune des colonnes : la tête, le corps qui défile
  (entrées à 6 px), le geste au pied, la note sous lui.

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
- À valider : le centre est celui de tout jet avant le dé (`combat.md`, grille d'avant le dé) : le lot et
  l'estimation au sous-titre, « Test opposé » en grande ligne, les quatre enjeux en cartes 1-4, le négociant à droite.
- À valider : tombé, le prix conclu reste visible dans la valeur de la conséquence prix (« −10 % », l'ancien prix
  barré, le nouveau), le chiffre qui décide entre « Conclure » et « Refuser le marché » (fiche
  `user-doctrine-icone-identifie-survol-detaille`).
- À valider : le Marchandage dans le bandeau de jet, la halle restant visible ; les enjeux affichés avant le dé ; le
  seuil du négociant masqué ; « Soutien du groupe » en pastille près du nom.

## marchandage
- Le jet résolu : dés et DR des deux camps, « DR net +4 », « Gagné (−10 % à l'achat) », prix barré et prix marchandé
  (2 CO 15/– vers 2 CO 9/– 6 sc), ligne « Marchandage gagné −10 % » ajoutée au compte de la page.
- Les parts des bourses suivent le prix marchandé. Suites : les réserves, « Conclure », « Relancer » et « Résilience »
  fermées sur une réussite, « Chance : +1 DR », « Pacte », « Refuser le marché » (`src/noyau/merchantFlow.ts:879`,
  `:897-916`).
- RAW : LDB 59 l.43 ; MSRC 13 l.127.
- À valider : le centre de tout jet (`combat.md`, « Bandeau du jet »), même structure que l'attaque : « Réussite », la
  conséquence `prix` −10 % (pictogramme `pieces`, le prix conclu, 594 sous au lieu de 660, au survol, montré ouvert),
  le DR net +4 en petit ; les suites en plaques, « Conclure » armée ; le compte de la page mis à jour dès le verdict.

## port
- Le port est un lieu (Salzenmund, `src/data/naval-ports.json`) : récit, quai, navire du groupe à l'amarre. Les
  services sont des cartouches, en deux colonnes devant la carte : L'entrepôt (déplié, réplique d'accueil,
  « Entrer »), Votre cogue (coque et cale), Chantier naval, La taverne, L'avitailleur.
- Fragment de carte, « Ouvrir la carte », départs « Prendre la mer » (Norden, Hargendorf) ; sortie « Explorer ».
- Code : `src/noyau/portFlow.ts:1-25` (recruter l.521, avitailler l.588), `src/noyau/seaVoyageFlow.ts:2345-2403`
  (devis de chantier, réparation, carénage).
- À valider : le port dessiné comme un lieu, ses services en cartouches plutôt qu'en liste ; l'état du navire lu sur le
  navire ; les départs en mer sur la carte du lieu ; un seul cartouche déplié à la fois.
- À valider (#4585) : le récit garde la ligne de sa rubrique, vide hors d'une arrivée : son texte part du même y qu'à
  l'arrivée (`voyage.md`).

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

## port-achat (2026-11-17, #4411)
- Écran 11. La page des services du port sur « Négoce de cargaison », côté achat : l'offre « Bois » dépliée sur le
  quai, la page « Le lot » avec l'Encombrement à acheter (60 sur 320), le prix de base, le lot partiel (vendeur
  +1 DR), 90 CO, les parts des quatre bourses (22 CO 10/– chacun) par `bourse({parts,total})` et « Conclure
  l'achat ». Le bandeau ne porte plus les bourses : elles se lisent au bloc des parts.
- Verbes : `fenetreChoisir('port','offre', id)`, `fenetreChoisir('port','encombrement', n)`,
  `fenetreChoisir('port','acheter')` ; paiement `payFromGroup` (entreprise commune, #3004).
- RAW : MDG 15 l.331-341. Code : `src/noyau/portFlow.ts:188-201`, `:315`.
- À valider : la réglette d'Encombrement sur la page ; le +1 DR du lot partiel annoncé avant le Marchandage ; les
  parts réglables par bourse, que le noyau ne prend pas en argument (il débite le groupe).

## port-chantier (2026-11-17, #4411)
- Le constructeur en cartouche sur sa cale sèche, ses Améliorations en lignes (Ancre, Bélier, Figure de proue,
  Nid-de-pie, Sabord ; Blindage (bronze) fermé : Salzenmund n'a pas de chantier spécialisé). Page « Le chantier » :
  l'état de la coque et des Salissures, trois voies (Réparer 8 CO, Caréner 15 CO, Poser le Nid-de-pie 5 CO), la
  voie choisie armée, les parts (2 CO chacun), « Réparer la coque ».
- Verbes : `reparerLeNavire()`, `reparerParLeGroupe()`, `carenerLeNavire()`, `installerLAmelioration(traitId, units?)`.
- RAW : réparation 1 CO par Blessure, 1d10 heures MDG 13 l.643 ; par le groupe, Charpentier −10 MDG 13 l.641,
  pièces détachées MDG 15 l.306 ; Salissures MDG 13 l.144-159 ; Améliorations MDG 12 l.195-364 ; pose MDG 15 l.255.
  Code : `src/noyau/seaVoyageFlow.ts` (`devisDeChantier`, `portRepairVessel`, `reparerParLeGroupe`,
  `portCareenVessel`, `installerLAmelioration`).
- À valider : une voie à la fois, pas de devis cumulé ; la durée de pose (1d10 jours) et le Métier 50 du constructeur
  sont des valeurs maison du noyau ; le carénage à 15 CO est 5 % des 300 CO de la cogue, Salissures de niveau 1.

## port-recrutement (2026-11-17, #4411)
- La taverne des marins : les neuf rôles de `src/data/crew-roles.json` en lignes, la solde à la semaine et le nombre
  à bord ; « Mousse » choisi, « Mousses à embaucher » réglé à 2, « Solde ajoutée 2 CO 8/– », « Solde de l'équipage
  18 CO », plaques « Embaucher » et « Débarquer ». Aucun bloc de bourses : l'embauche ne débite rien
  (`src/noyau/portFlow.ts:517-520`), la solde tombe à la semaine.
- Verbes : `recruterLEquipage(roleId, count?)`, `renvoyerLEquipage(roleId, count?)`.
- RAW : soldes MDG 14 l.293-302. Code : `src/noyau/portFlow.ts:499-551`.
- À valider : seuls Mousse et Chirurgien sont des lignes du livre, les sept autres soldes sont une correspondance
  maison de la donnée ; l'équipage sans portrait ; « Débarquer » sur la même page que l'embauche.

## port-avitaillement (2026-11-17, #4411)
- L'avitailleur : Biscuits de mer (120), Nourriture préservée (60), Tonneau d'eau (8), chacun sa réglette et son
  prix ; devis 15 CO 8/–, parts 3 CO 17/– chacun, « Avitailler la cale » ; la phrase du tonneau en verbatim.
- Verbe : `avitaillerLeNavire(quantites, tonneaux)`.
- RAW : MDG 14 l.236-252. Code : `src/noyau/portFlow.ts:553-601`.
- À valider : les jours de vivres que l'achat donne à l'équipage ne sont pas montrés (aucun lecteur ne les sert) ;
  l'Encombrement des vivres dans la cale non montré.

## Non dessiné
- L'achat à l'échoppe (acte individuel, payé par l'acheteur, #3004) n'a pas d'image dans cette famille.
- Halle et port : refus (bourse sous le plancher, porteur plein), aucun acheteur trouvé, moitié du lot proposée,
  évaluation du vin résolue, Marchandage de vente, Marchandage perdu.
- Port : refus des quatre pages (bourses courtes, cale pleine, effectif complet), Amélioration à unités, pose en
  cours.
