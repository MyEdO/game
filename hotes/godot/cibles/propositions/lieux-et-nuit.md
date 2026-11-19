# Propositions : lieux et nuit (2026-11-16, #3935)

Compte rendu des écrans dessinés depuis les maquettes validées de lieu et de voyage, la cible écrite
`../ecrites/lieu.md` et le relevé de ce qui se joue la nuit (ci-dessous). Sources au dépôt : trois écrans de
`sources/maquettes/`, chacun la liste de ses états au format de `sources/maquettes/maquette.ts`, dessinés par
`sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png> --format 16:9 [--etat <état>]`) : `nuit`
(`nuit-a-l-auberge`, `jeux-de-taverne`, `bivouac`), `soins` (`services-du-lieu-medecin`) et `interlude`
(`interlude-en-ville`). Les décors peints vivent dans `sources/lieux-et-nuit/` (`auberge.js`, `taverne.js`,
`bivouac.js`, `cabinet.js`, `carte-de-la-ville.js`). Premières maquettes : rien n'est validé.

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

## nuit
Un seul écran pour la nuit, à l'auberge comme à la halte : un seul panneau « Qui dort où », à droite, range les héros
dans les lits d'une chambre ou les places d'un abri, et à part ceux qui restent dehors.

### nuit-a-l-auberge
- La salle de La Fin du Voyage ; l'aubergiste et ses offres au prix de la maison, sans choix de qualité (la qualité
  est une donnée de l'établissement, `src/noyau/restFlow.ts`, `p.quality`) : chambre commune 10 sc par tête, chambre
  privée 10/– (2 lits), grande chambre 20/– (4 lits, LDB 66 l.28), repas 1/– par tête (LDB 66 l.12-16).
- Qui dort où : les quatre portraits posés dans la grande chambre, « 4 sur 4 ». Tarif par personne (#3004) :
  « Bourses du groupe », la part de chacun (6/–) sous son nom, réglable, et le total ; « Passer la nuit ». Postes de
  soirée : boire (bière, la pinte 3 sc, LDB 66), écouter les rumeurs, jouer, se faire soigner, dormir.
- À valider : une seule activité de soirée par héros (transposition de l'Étape, aucun RAW) ; « Boire » demande une
  offre au noyau (M12 de l'audit ; la règle d'ivresse existe, LDB 09 l.475) ; écurie à la nuit (LDB 66 l.14) non
  offerte ; l'offre de l'hôte à gauche, alors que les jeux montrent le rail des services de la maison.

### jeux-de-taverne
- La même maison, service « Les jeux » : la table sous sa lanterne, trois joueurs PNJ, la place libre ; l'Al-zahr,
  les fléchettes, le bras de fer (NADJ 16) ; sièges, mise, pot, « S'asseoir et lancer les dés ».
- À valider : jeux proposés par maison ; mise libre (le livre ne chiffre pas) ; nombre cible et variante rapide non
  montrés.

### bivouac
- Clairière de nuit (lune, lisière, feu, tente, diligence dételée). La nourriture se choisit par héros, sur sa carte
  du bandeau (« Ration » ou « Rien », `src/i18n/messages/fr.ts:439-444`, choix de `src/noyau/restFlow.ts:163`).
- Qui dort où : l'abri se choisit, « Petite tente », « Belle étoile » ou « Abri de fortune » (Test de Survie en
  extérieur, LDB 09 l.554) ; les places de la petite tente (deux, toutes prises), ceux qui restent dehors, ceux qui
  dorment dans leur sac de couchage (+20 au froid, LDB 74 l.60) ; le temps ; « Ce que la nuit jouera » : le froid
  (Résistance), le repos ; « Passer la nuit ». La sortie « Reprendre la route ».
- À valider : tente sans effet chiffré aux livres (LDB 74 l.62, règle maison `exposition-tente-annule`) ; le nombre
  de places d'une tente ; le sac de couchage et l'abri de fortune, que le noyau n'applique pas ; la ligne « Le
  froid » sous la tente dépend de la sévérité du temps (`exposureTestCount`, `src/noyau/restFlow.ts:486-512`), non
  relue pour le gel ; une halte de voyage qui se quitte (`src/noyau/modalArbiter.ts:192` ne la quitte pas).

## soins

### services-du-lieu-medecin
- La page des services du quartier (rail : auberge, taverne, guilde des Joailliers, guilde des Médecins, Guet),
  le cabinet en image, le docteur et son boniment ; le patient se choisit par son portrait dans le bandeau ; soins :
  Panser (Guérison, LDB 09 l.260), Recoudre (Chirurgie, LDB 10 l.184, LDB 18 l.314).
- Payer : chaque acte se paie au lancer du Test (`src/noyau/medicFlow.ts:182`), par le bénéficiaire (#3004) :
  « À payer », « Bourse de Greta », « Payer et soigner ». La page des soins est celle des soins entre héros
  (`exploration-et-recit`, `sources/lieux-et-nuit/soins.js`, `soins.css`).
- La Chirurgie à 15/– est dite « valeur maison » sur l'image : aucun prix aux livres (LDB 75 l.19 ne donne que la
  visite, « 4-6 pistoles »).
- À valider : visite à 5/– dans la fourchette du livre, à tracer en valeur maison elle aussi ; le noyau débite le
  groupe, pas le patient ; docteur anonyme ; rail du quartier ou du bâtiment.

## interlude

### interlude-en-ville
- Le plan de Bögenhafen ; sept lieux épinglés, chacun une Activité (LDB 23 l.132-240) ; le lieu choisi à droite, son
  hôte (le tenancier et sa réplique), ses seules activités et « Envoyer Mira à la taverne ».
- À gauche, par héros : l'Événement de sa période (LDB 22 l.5, LDB 23 l.15, `eventRoll`) et le compteur de ses
  Activités restantes sur trois (LDB 23 l.5, `src/noyau/interludeEnVue.ts:48-52`) ; l'avis de la reprise (LDB 23
  l.13-19). La sortie est la pastille « Reprendre la route » (le noyau ne tient pas de semaine courante).
  « Semer la dissension » dit ses deux Activités (LDB 23 l.240).
- Le même écran porte la préparation d'une bataille de masse (`bataille-de-masse-preparation`, `combat-suite.md`).
- À valider : rattacher chaque Activité à un lieu et à un PNJ est une adaptation de scénario ; restriction par
  Classe (LDB 23 l.195) ; plusieurs Activités absentes du plan ; l'effet de l'Événement n'est pas montré.
