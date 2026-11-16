# Propositions : lieux et nuit (2026-11-16, #3935)

Compte rendu des cinq écrans dessinés depuis les maquettes validées de lieu et de voyage, la cible écrite
`../ecrites/lieu.md` et le relevé de ce qui se joue la nuit (ci-dessous). Sources HTML hors dépôt :
`/mnt/project-files/interface-3935/maquettes/lieux-et-nuit/`. Rien n'est validé.

Directions de l'utilisateur (verbatims au 2026-11-16, fiche `user-doctrine-la-cible-prime-sur-l-ancien-ecran`) : une
image autour d'un feu de camp et une quand on dort à l'auberge ; affectations à des postes dans la lignée du voyage ;
interludes liés à des lieux et à des PNJ, jamais une fenêtre à cinquante choix ; un PNJ qui donne un service ouvre la
page des services de son lieu.

Choix transverses à valider : le poste (médaillon ou portrait, étiquette de chêne à pointe) est la pièce unique
d'affectation (bivouac, auberge, table de jeu), geste supposé « choisir un héros au bandeau, puis cliquer un poste » ;
rail de services à gauche et panneau de parchemin à droite forment le gabarit de toute page de service.

## Ce qui se joue la nuit (relevé aux livres)
- Aucune règle de tour de garde aux livres. Bases : Surprise LDB 13 l.53-59 (au MJ), Rester aux aguets EDOC 08
  l.155-157, Vigilance LDB 13 l.64.
- Campement : Survie en extérieur LDB 09 l.554 (abri et nourriture, +1 Personnage par DR, échec Résistance ou
  Exténué, Échec Stupéfiant au MJ) ; tente LDB 74 l.62 ; sac de couchage +20 au froid LDB 74 l.60.
- Récupération LDB 18 l.296 ; Exténué LDB 16 l.92, l.101 (durée au MJ), LDB 61 l.48 ; Guérison LDB 09 l.256-269 ;
  faim et soif LDB 18 l.338-342, EDOC 08 l.46 ; Exposition LDB 18 l.328-334, EDOC 08 l.90, l.139-141 ; marche forcée
  LDB 51 l.195 ; péripéties LDB 51 l.208-221.
- Activités d'Étape, une par Personnage « autour d'un feu de camp » : EDOC 08 l.131-180.
- Mer : MDG 13 l.111, MDG 15 l.76, l.104-108, l.268, l.304-306. Fleuve : MSRC 7 l.21.
- Auberge : qualité et prix LDB 66 l.5-28, ACE 02 l.99 ; boisson LDB 09 l.473-485 ; Pari LDB 09 l.389 ; jeux NADJ 16 ;
  rumeurs EDOC 08 l.151-153, EDOC 09 l.19-23.
- Au code : `src/noyau/restFlow.ts:204`, `:435`, `:562-578`, `:759` ; `travelFlow.ts:314` ; `travelPostes.ts:136`
  derrière `voyage-etapes` (défaut `false`) ; `seaVoyageFlow.ts:1815-1825` ; `riverVoyageFlow.ts:862` ;
  `innFlow.ts:42` ; `tavernFlow.ts:237` ; `medicFlow.ts:72`.
- Absent du code : veille de nuit ; abri de fortune complet ; sac de couchage +20 ; boire une pinte.

## bivouac
- Clairière de nuit (lune, lisière, feu, tente, diligence dételée). Les huit Activités d'Étape sont huit postes dans
  la scène ; un héros posé remplace le médaillon. Billet d'aperçu de « Rester aux aguets » (Perception
  Intermédiaire, pas de surprise, échec Exténué).
- Panneau « Le campement » : abri Tente ou Belle étoile, couchage (sacs), vivres (rations), temps ; « Ce que la nuit
  jouera » : campement, activités, repos ; plaque « Passer la nuit » ; pastille « Lever le camp ».
- À valider : « Rester aux aguets » tient lieu de veille (ni tour ni relève) ; les huit postes offerts à toute halte
  alors que le code les éteint par défaut ; tente sans effet chiffré ; poste fermé visible en fer ou caché ;
  « Lever le camp » sans règle de marche forcée.

## nuit-a-l-auberge
- La salle de La Fin du Voyage ; l'aubergiste et sa grille chambre commune, chambre privée, repas par qualité
  (piètre la moitié, grande le double, LDB 66 l.5, l.12-16) ; la note ; « Passer la nuit ». Postes de soirée :
  boire, écouter les rumeurs, jouer, se faire soigner, dormir.
- À valider : qualité au choix du joueur alors que `logis-qualites` en fait une donnée de la maison ; bourse du groupe
  alors que la cible lieu dit une bourse par héros ; une seule activité de soirée par héros (transposition de
  l'Étape) ; grande chambre absente ; boire une pinte absent du code.

## services-du-lieu-medecin
- La page des services du quartier (rail : auberge, armurier, guilde des Joailliers, guilde des Médecins, Guet),
  le cabinet en image, le docteur et son boniment ; soins par patient : Panser (Guérison, LDB 09 l.260), Recoudre
  (Chirurgie, LDB 10 l.184, LDB 18 l.314) ; compte et « Payer le docteur ».
- À valider : visite à 5/– (le livre dit 4-6 pistoles, LDB 75 l.19) ; Chirurgie à 15/– (aucun prix aux livres) ;
  docteur anonyme ; rail du quartier ou du bâtiment.

## jeux-de-taverne
- La même page à l'auberge, onglet « Les jeux » : la table sous sa lanterne, trois joueurs PNJ, la place libre ;
  l'Al-zahr, les fléchettes, le bras de fer (NADJ 16) ; sièges, mise, pot, « S'asseoir et lancer les dés ».
- À valider : jeux proposés par maison ; mise libre (le livre ne chiffre pas) ; nombre cible et variante rapide non
  montrés.

## interlude-en-ville
- Le plan de Bögenhafen ; sept lieux épinglés, chacun une Activité et son hôte (LDB 23 l.132-240) ; le lieu choisi
  à gauche avec ses seules activités ; à droite le tableau des trois semaines par héros ; avis « Argent à
  gaspiller » (LDB 23 l.13-19).
- À valider : rattacher chaque Activité à un lieu et à un PNJ est une adaptation de scénario ; restriction par
  Classe (LDB 23 l.195) ; trois semaines fixes ; Événements (LDB 22) non montrés ; plusieurs Activités absentes du
  plan.
