⚠️ INSTRUMENT du sujet global #3001 — compteur de reprise (460 entités)

Ticket: #3001

# Inventaire de complétude — Les Vents de Magie (VDM)

> **Artefact DATÉ 2026-07-22** — sortie de l'audit adversarial par TYPE d'entité (workflow `vdm-completude-entites`, 15 agents, un par chapitre). Recense TOUT ce que VDM ajoute/modifie/republie. Sert de base de réconciliation pour la curation `src/data` (#729-#735). À SUPPRIMER une fois la curation soldée (git porte l'historique).

## Synthèse par type (460 entités)

| Type | Neuf | Modifié | Republié | Ticket |
|---|--:|--:|--:|---|
| sort | 183 | **9** | 15 | #729 |
| carriere | 11 | **3** | 1 | #730 |
| competence | 2 | **1** | 0 | #730 |
| talent | 2 | **2** | 1 | #734 |
| trait | 4 | **0** | 1 | #735 (à ouvrir) |
| qualite | 1 | **0** | 0 | #735 (à ouvrir) |
| objet-equipement | 54 | **1** | 0 | #732 |
| creature-pnj | 21 | **0** | 0 | #731 |
| regle-mecanique | 63 | **15** | 3 | #733 (incant.) / #732 (rituels) |
| activite | 8 | **0** | 0 | #735 (à ouvrir) |
| rituel | 18 | **0** | 0 | #732 |
| table-aleatoire | 34 | **4** | 1 | #729/#733 |
| race-espece | 1 | **0** | 0 | #731 |
| autre | 1 | **0** | 0 | — |

## ⚠ Entités MODIFIÉES (variantes doctrine — gatées par le module, jamais des doublons)

- **[carriere]** Gardien Gris (Or 1) — `VDM 08 l.61` — Variante Ordre Gris d'un niveau de carrière de sorcier : compétences (Chevaucher, Évaluation, Recherche, Savoir Politique), talents (Baratiner, Diction instinctive, Imitation, Perception de la magie), possessions dédiées.
- **[carriere]** Seigneur Gris (Or 2) — `VDM 08 l.67` — Variante Ordre Gris d'un niveau de carrière de sorcier : compétences (Langue au choix, Savoir au choix), talents (Discret, Identité Secrète, Mage de guerre, Tour des souvenirs), possessions dédiées.
- **[carriere]** Pyromancien — `VDM 10 l.57-96` — Variante college (Ordre Flamboyant) de la carriere Sorcier du LDB : 4 niveaux (Apprenti/Pyromancien/Maitre/Seigneur), Focalisation (Aqshy), Magie des Arcanes (Feu), Clefs des Secrets, schema de progression et possessions dedies.
- **[competence]** Métier (Alchimiste) — `VDM 03 l.584` — Précise l'usage alchimique de la compétence existante (Basse et Haute Alchimie, tests de fabrication, renvoi au Tableau des Catastrophes de brassage sur Maladresse).
- **[objet-equipement]** Malepierre (incantation) — `VDM 02 l.161` — Double les DR d'Incantation/Focalisation mais Influence corruptrice/malveillante ; ressource finie ~1 g = 20 NI.
- **[regle-mecanique]** Composants (d'incantation) — `VDM 02 l.105` — Un composant transforme une Imparfaite Majeure en Mineure ou annule une Mineure ; consommé quoi qu'il arrive ; coûte le NI en pistoles d'argent.
- **[regle-mecanique]** Restrictions à l'incantation — `VDM 02 l.114` — Voix entravée = +1 cran de Difficulté ; un sort doit finir/être dissipé avant relance ; bonus/malus non cumulatifs (meilleur/pire) ; cible en Ligne de Vue.
- **[regle-mecanique]** Test de Focalisation — `VDM 02 l.129` — Focalisation via Test étendu : chaque DR alimente une réserve réduisant le NI (min 0) du prochain sort du Vent canalisé ; énergie perdue après lancement, ne peut pas surincanter.
- **[regle-mecanique]** Mémoriser des Sorts — `VDM 02 l.17` — Remplace les règles du LDB ch.8 : on mémorise un sort en dépensant les PX indiqués par les Talents Magie mineure ou Magie des Arcanes.
- **[regle-mecanique]** Dissipation — `VDM 02 l.174` — Dissiper un sort ciblant le lanceur (portée = FM en m), 1/Round, Test opposé de Langue (Magick) ; + variante Sorts permanents (Test étendu jusqu'au NI, Soutenu si même Domaine, +1 DR pour son propre sort).
- **[regle-mecanique]** Surincantation — `VDM 02 l.194` — DR excédentaires dépensés pour augmenter Portée/ZdE/Durée/Cibles (et Dégâts si Projectile magique) selon le Tableau de Surincantation, une colonne par catégorie.
- **[regle-mecanique]** Grimoires (lancer un sort depuis un grimoire) — `VDM 02 l.21` — Lancer un sort d'un grimoire d'un Domaine possédé, deux mains libres, NI doublé pour méconnaissance.
- **[regle-mecanique]** Anatomie d'un Sort — `VDM 02 l.28` — Redéfinit le format des sorts (NI, Portée, Cible, Durée, Description), dont la mention ZdE et Cible « Spécial » (pas de Surincantation de cibles).
- **[regle-mecanique]** Test d'Incantation — `VDM 02 l.42` — Remplace le LDB : l'incantation est un Test de Langue (Magick) ; DR ≥ NI = sort lancé.
- **[regle-mecanique]** Incantation Critique — `VDM 02 l.50` — Double sur Test réussi → lancer sur Incantations Imparfaites Mineures (sauf Diction instinctive) + choix d'un des 3 effets bonus (Incantation Critique/Puissance totale/Force inéluctable).
- **[regle-mecanique]** Incantations Imparfaites — `VDM 02 l.58` — Double sur Test échoué → lancer sur le Tableau des Incantations Imparfaites Mineures.
- **[regle-mecanique]** Projectiles magiques — `VDM 02 l.66` — Sort infligeant des Dégâts : résultat d'Incantation inversé → Localisation, Dégâts = valeur du sort + BFM, réduits par E et PA.
- **[regle-mecanique]** Sorts de Contact en combat — `VDM 02 l.99` — Toucher une cible réticente/en combat : Test opposé de Corps à corps (Bagarre) après l'incantation ; bâton enchanté → Corps à corps adapté (Arme d'hast).
- **[regle-mecanique]** Sorts prémonitoires — `VDM 03 l.491` — Ajoute aux sorts Célestes existants (Ironie du Destin, Maudit, Signes d'Amul) l'option de dépenser des DR pour un jet sur le Tableau des Symboles ; Incantation Imparfaite peut infliger un symbole inversé.
- **[regle-mecanique]** Les familiers et les États — `VDM 13 l.508-514` — Change l'application des États aux familiers : Empreint d'Aqshy annule En flammes (feu non magique + feu du Domaine du Feu) ; immunité à Empoisonné/Exténué/Hémorragique sauf source magique ; autres États normaux.
- **[sort]** Lumière de guérison — `VDM 04 l.458` — VARIANTE du sort LDB : la perte de 1 Point de Corruption (dernière heure) exige désormais un Test de Résistance Très Difficile (−30) au lieu de Difficile (−20) au LDB ; soin (BInt+BFM) inchangé.
- **[sort]** Cœurs ardents — `VDM 10 l.294-302` — Variante du LDB : ajoute la clause explicite « si une cible possede deja l'un des Talents (Coude-a-coude/Sans peur/Cœur vaillant), elle gagne temporairement un niveau supplementaire ».
- **[sort]** L'Égide d'Aqshy — `VDM 10 l.354-362` — Variante du LDB : la Protection 9+ couvre desormais explicitement la maleflamme et le Trait Souffle (Feu) (le souffle des monstres passe de l'immunite non-magique du LDB a la protection magique).
- **[sort]** L'Épée ardente de Rhuin — `VDM 10 l.376-386` — Variante du LDB : precise que l'arme enveloppee doit etre une « Arme simple » (restriction absente du LDB) ; reste Degats +6, Percutante, En flammes, Maladresse sans Magie des Arcanes Feu.
- **[sort]** Grands feux d'U'Zhul — `VDM 10 l.471-481` — Variante du LDB : les Degats persistants de zone sont subis « a la fin d'un Round » (LDB : « au debut d'un Round ») et le jet de defense est precise en Esquive Intermediaire (+0).
- **[sort]** Mur de feu — `VDM 10 l.484-494` — Variante du LDB : ajoute une hauteur explicite (« haut d'1 metre ») au mur (absente du LDB qui ne donne que largeur et epaisseur).
- **[sort]** Forme bestiale — `VDM 11 l.301-311` — NI 5 — VDM ajoute le Mouvement à la liste des Caractéristiques remplacées par celles de la créature (LDB : seulement F/E/Agi/Dex).
- **[sort]** Maître de la bête — `VDM 11 l.353-363` — NI 10 — VDM restreint la cible aux créatures Bestial ET de Taille Petite/Moyenne/Grande (LDB : toute créature Bestial, sans limite de Taille).
- **[sort]** Serres d'ambre — `VDM 11 l.420-426` — NI 6 — VDM change la formule de Dégâts en DR + Bonus de Force + Bonus de Force Mentale (LDB : Bonus de Force Mentale seul) ; +1 Hémorragique conservé.
- **[table-aleatoire]** Tableau de Surincantation — `VDM 02 l.205` — Barème DR → Cible additionnelle / Dégât / Portée / ZdE / Durée (1 à 21+ DR).
- **[table-aleatoire]** Tableau des Incantations Imparfaites Mineures — `VDM 02 l.218` — Table d100 rééditée pour VDM (entrées propres, dont « Marqué par la Magie » renvoyant aux Marques de chaque Vent).
- **[table-aleatoire]** Tableau des Incantations Imparfaites Majeures — `VDM 02 l.242` — Table d100 rééditée pour VDM (Voix fantomatiques, Choc aethyrique, Essaim, Contre-réaction aethyrique…).
- **[table-aleatoire]** Carrières aléatoires — Second lancer — `VDM 03 l.23` — Étend le tableau des Carrières aléatoires du LDB : second jet aiguillant Apothicaire→Alchimiste ordinaire, Sorcier→Magister Vigilant, Garde→Bedeau, Mystique→Devin.
- **[talent]** Magie des Arcanes — `VDM 02 l.188` — Acquisition modifiée : un elfe apprend jusqu'à BFM Domaines ; nouveau Talent Magie des Arcanes interdit tant que < 20 Améliorations en Focalisation et < 8 sorts du Domaine précédent ; +1 Domaine sombre possible.
- **[talent]** Concocter — `VDM 12 l.411` — Nouvelles règles remplaçant la version existante : Maxi = Bonus d'Intelligence, Tests = Métier (Apothicaire) ou (Alchimiste) ; permet une Activité Artisanat/Brasser une potion GRATUITE sans atelier ni laboratoire.

## Détail par chapitre

### 01 - Contes de sorcellerie (1)

- `VDM 01 l.304` **[regle-mecanique·nouveau]** Percevoir la corruption arcanique — Test de Perception Difficile (–20) — Ajoute une règle : un Sorcier peut déceler des signes imperceptibles de corruption arcanique avant qu'elle n'apparaisse via un Test de Perception Difficile (–20) ; la perception varie selon l'origine/formation (renvoi à Seconde Vue, WFJDR p.233).

### 02 - Révisions des règles d'incantation (64)

- `VDM 02 l.9` **[talent·republie]** Seconde vue — Re-décrit le Talent : requis pour ressentir les Vents, jamais retirable, permet des Tests d'Intuition/Perception/Pistage pour obtenir des renseignements magiques.
- `VDM 02 l.17` **[regle-mecanique·modifie]** Mémoriser des Sorts — Remplace les règles du LDB ch.8 : on mémorise un sort en dépensant les PX indiqués par les Talents Magie mineure ou Magie des Arcanes.
- `VDM 02 l.21` **[regle-mecanique·modifie]** Grimoires (lancer un sort depuis un grimoire) — Lancer un sort d'un grimoire d'un Domaine possédé, deux mains libres, NI doublé pour méconnaissance.
- `VDM 02 l.28` **[regle-mecanique·modifie]** Anatomie d'un Sort — Redéfinit le format des sorts (NI, Portée, Cible, Durée, Description), dont la mention ZdE et Cible « Spécial » (pas de Surincantation de cibles).
- `VDM 02 l.42` **[regle-mecanique·modifie]** Test d'Incantation — Remplace le LDB : l'incantation est un Test de Langue (Magick) ; DR ≥ NI = sort lancé.
- `VDM 02 l.50` **[regle-mecanique·modifie]** Incantation Critique — Double sur Test réussi → lancer sur Incantations Imparfaites Mineures (sauf Diction instinctive) + choix d'un des 3 effets bonus (Incantation Critique/Puissance totale/Force inéluctable).
- `VDM 02 l.58` **[regle-mecanique·modifie]** Incantations Imparfaites — Double sur Test échoué → lancer sur le Tableau des Incantations Imparfaites Mineures.
- `VDM 02 l.66` **[regle-mecanique·modifie]** Projectiles magiques — Sort infligeant des Dégâts : résultat d'Incantation inversé → Localisation, Dégâts = valeur du sort + BFM, réduits par E et PA.
- `VDM 02 l.70` **[regle-mecanique·nouveau]** Vortex aléatoires — Règle de mouvement des sorts « Vortex aléatoire » : invocation adjacente, jet de FM Accessible (+20) pour trajectoire, 2d10 m par Round en direction aléatoire.
- `VDM 02 l.84` **[table-aleatoire·nouveau]** Tableau de mouvements du vortex — Table d10 (grille / abstrait) donnant la direction du déplacement du vortex ; 1 = disparition.
- `VDM 02 l.99` **[regle-mecanique·modifie]** Sorts de Contact en combat — Toucher une cible réticente/en combat : Test opposé de Corps à corps (Bagarre) après l'incantation ; bâton enchanté → Corps à corps adapté (Arme d'hast).
- `VDM 02 l.105` **[regle-mecanique·modifie]** Composants (d'incantation) — Un composant transforme une Imparfaite Majeure en Mineure ou annule une Mineure ; consommé quoi qu'il arrive ; coûte le NI en pistoles d'argent.
- `VDM 02 l.114` **[regle-mecanique·modifie]** Restrictions à l'incantation — Voix entravée = +1 cran de Difficulté ; un sort doit finir/être dissipé avant relance ; bonus/malus non cumulatifs (meilleur/pire) ; cible en Ligne de Vue.
- `VDM 02 l.124` **[regle-mecanique·nouveau]** Avantages et Magie — Les Avantages s'appliquent aux Tests d'Incantation (pas de Focalisation) ; +1 Avantage si la cible a déjà subi un sort du même Domaine ce Round.
- `VDM 02 l.129` **[regle-mecanique·modifie]** Test de Focalisation — Focalisation via Test étendu : chaque DR alimente une réserve réduisant le NI (min 0) du prochain sort du Vent canalisé ; énergie perdue après lancement, ne peut pas surincanter.
- `VDM 02 l.143` **[regle-mecanique·nouveau]** Focalisation Critique — Double sur Focalisation réussie → +DR bonus égal au BFM + lancer sur Imparfaites Mineures (sauf Harmonisation aethyrique).
- `VDM 02 l.147` **[regle-mecanique·nouveau]** Maladresse de Focalisation — Double sur Focalisation ratée → lancer sur le Tableau des Incantations Imparfaites Mineures.
- `VDM 02 l.151` **[regle-mecanique·nouveau]** Interruptions (de Focalisation) — Perturbé pendant la focalisation (Dégâts, Surpris…) → Test de Calme Difficile (−20) ou perte des DR + lancer sur Imparfaites Mineures.
- `VDM 02 l.155` **[regle-mecanique·nouveau]** Influences malveillantes — Proximité d'une Influence corruptrice : tout jet raté d'Incantation/Focalisation → Imparfaite Mineure (ou Majeure si déjà déclenchée) ; les Domaines sombres ne s'auto-affectent pas.
- `VDM 02 l.161` **[objet-equipement·modifie]** Malepierre (incantation) — Double les DR d'Incantation/Focalisation mais Influence corruptrice/malveillante ; ressource finie ~1 g = 20 NI.
- `VDM 02 l.167` **[regle-mecanique·nouveau]** Repousser les Vents (armure & incantation) — −1 DR par PA de la Localisation la mieux protégée aux Tests d'Incantation/Focalisation ; Magie des Arcanes (Métal) ignore le métal, (Bête) le cuir, Sorcier du Chaos les armures du Chaos.
- `VDM 02 l.174` **[regle-mecanique·modifie]** Dissipation — Dissiper un sort ciblant le lanceur (portée = FM en m), 1/Round, Test opposé de Langue (Magick) ; + variante Sorts permanents (Test étendu jusqu'au NI, Soutenu si même Domaine, +1 DR pour son propre sort).
- `VDM 02 l.188` **[talent·modifie]** Magie des Arcanes — Acquisition modifiée : un elfe apprend jusqu'à BFM Domaines ; nouveau Talent Magie des Arcanes interdit tant que < 20 Améliorations en Focalisation et < 8 sorts du Domaine précédent ; +1 Domaine sombre possible.
- `VDM 02 l.194` **[regle-mecanique·modifie]** Surincantation — DR excédentaires dépensés pour augmenter Portée/ZdE/Durée/Cibles (et Dégâts si Projectile magique) selon le Tableau de Surincantation, une colonne par catégorie.
- `VDM 02 l.205` **[table-aleatoire·modifie]** Tableau de Surincantation — Barème DR → Cible additionnelle / Dégât / Portée / ZdE / Durée (1 à 21+ DR).
- `VDM 02 l.218` **[table-aleatoire·modifie]** Tableau des Incantations Imparfaites Mineures — Table d100 rééditée pour VDM (entrées propres, dont « Marqué par la Magie » renvoyant aux Marques de chaque Vent).
- `VDM 02 l.242` **[table-aleatoire·modifie]** Tableau des Incantations Imparfaites Majeures — Table d100 rééditée pour VDM (Voix fantomatiques, Choc aethyrique, Essaim, Contre-réaction aethyrique…).
- `VDM 02 l.276` **[sort·nouveau]** Agressivité de la Maresang — Sort d'Arcane NI 2 : octroie le Trait Frénésie à une bête des marais.
- `VDM 02 l.284` **[sort·nouveau]** Argile fertile — Sort d'Arcane NI 4 : double la régénération de PB d'une bête des marais pour la Durée.
- `VDM 02 l.292` **[sort·nouveau]** Décrypter une malédiction — Sort d'Arcane NI 4 : révèle si un objet est maudit (bienfaits/méfaits/déclencheur) ; échec au Test d'Intelligence (+0) = Exposition Modérée à la Corruption.
- `VDM 02 l.304` **[sort·nouveau]** Effondrement de Fabriqué — Sort d'Arcane NI 6 : Test opposé FM/Endurance contre un Fabriqué ; réussite = inerte et sans vie.
- `VDM 02 l.316` **[sort·nouveau]** Perturber la Magie — Sort d'Arcane NI 8 : Dissipation agressive contre un sorcier en focalisation ; Test opposé de FM, réussite = son sort échoue + Imparfaite Mineure.
- `VDM 02 l.328` **[sort·nouveau]** Secourir un serviteur magique — Sort d'Arcane NI 2 : rend BE PB à un Fabriqué/familier (double BE si lancé avec +3 DR).
- `VDM 02 l.341` **[sort·nouveau]** Silence — Sort d'Arcane NI 4 : zone (ZdE BFM m) où aucun son ne passe ; incantation à l'intérieur subit −3 DR.
- `VDM 02 l.353` **[sort·nouveau]** Varech avarié — Sort d'Arcane NI 4 : octroie le Trait Perturbant à une bête des marais (nuée d'insectes).
- `VDM 02 l.361` **[regle-mecanique·nouveau]** La magie rituelle (règles générales) — Cadre des Rituels : sorts puissants exigeant environnement, composants et sacrifices ; MJ encouragé à en créer d'après les modèles.
- `VDM 02 l.365` **[regle-mecanique·nouveau]** Grimoires et Rituels — Lancer un Rituel depuis un grimoire d'un Domaine possédé (deux mains libres) : le NI est quadruplé.
- `VDM 02 l.377` **[regle-mecanique·nouveau]** Anatomie d'un Rituel — Format des Rituels : NI, Type (Domaines autorisés), PX d'apprentissage, Composants (obligatoires/consommés), Conditions, Sacrifices, Conséquences, Description.
- `VDM 02 l.396` **[rituel·nouveau]** Art de la malédiction — NI 50 (25), tout Domaine : imprègne un objet d'un bienfait + méfait ; sacrifice de 1 PB non guérissable + Exposition Modérée à la Corruption.
- `VDM 02 l.412` **[rituel·nouveau]** Corrompre une pierre gardienne — NI 60, Domaine sombre : corrompt une pierre gardienne (effets p.194) et interrompt la ligne tellurique.
- `VDM 02 l.428` **[rituel·nouveau]** Créer un Fabriqué — NI 60, tout Domaine : anime un corps de matériaux bruts en Fabriqué (profil par défaut fourni) ; sacrifice F ou E à chaque Round.
- `VDM 02 l.463` **[creature-pnj·nouveau]** Fabriqué (profil par défaut) — Statbloc de base du Fabriqué (M4 CC25 F45 E45 I10 Ag20 Dex10 B32) ; Traits : Arme +8, Fabriqué, Insensible à la douleur, Instable, Taille (Grande).
- `VDM 02 l.472` **[table-aleatoire·nouveau]** Traits de Fabriqué (coût en NI) — Barème du surcoût de NI par Trait ajouté à un Fabriqué (Brutal +5, Champion +10, Vol(20) +30, Tailles −20 à +120…).
- `VDM 02 l.446` **[rituel·nouveau]** Élémentaires mineurs (variante de Créer un Fabriqué) — Rituel dérivé de Créer un Fabriqué : NI total doublé, l'élémentaire a Traits Magique et Taille (Petite), Talent Empreint de Magie (Vent) ; contrôle par Test opposé FM/Force, vit BFM jours.
- `VDM 02 l.495` **[rituel·nouveau]** Créer un familier — NI 45, tout Domaine : crée un familier (pouvoir/sorts/combat), Personnage à part entière ; sacrifice 1 PB/Destin/Résilience ; 2e familier NI 80 et double sacrifice.
- `VDM 02 l.520` **[table-aleatoire·nouveau]** Traits de familier (coût en NI) — Barème du surcoût de NI selon la forme du familier (Amphibie +20, Protection(10+) +30, Sans bras −10, Vol(20) +20…).
- `VDM 02 l.535` **[rituel·nouveau]** Créer une pierre de pouvoir — NI 64, Domaine des Huit Vents : produit une pierre de pouvoir du Domaine utilisé ; deux apprentis pour trianguler, NI −½ à une Jonction/Appui.
- `VDM 02 l.547` **[rituel·nouveau]** Créer une propriété de pierre gardienne — NI 40, tout Domaine : dote une pierre gardienne active d'un effet Amplification/Isolation/Atténuation/Réfraction (p.193).
- `VDM 02 l.565` **[rituel·nouveau]** Les Faux croisées — NI = FM de l'entité, Domaine de la Mort : grave un sceau de Shyish scellant un mort-vivant derrière un seuil (Test de Calme −30 / Résistance −30 pour le franchir, États Exténué ou Blessures par −DR).
- `VDM 02 l.586` **[rituel·nouveau]** Graver une pierre d'ogham — NI 50, tout Domaine : crée une pierre d'ogham (propriété Attraction/Isolation/Atténuation) ; exige Talent Lire/Écrire + Tests Langue (Magick) −10 et Art (Gravure) +20.
- `VDM 02 l.602` **[rituel·nouveau]** Imprégner un bâton — NI 35, Domaine des Huit Vents : enchante un bâton/baguette (p.152) ; sacrifice 1 Chance ou Détermination.
- `VDM 02 l.618` **[rituel·nouveau]** Invocation de démon — NI = FM du démon, Domaine de la Démonologie : requiert le Sort Octogramme préalable ; le démon se manifeste BInt jours ; +3 DR possibles selon recherche du nom.
- `VDM 02 l.638` **[rituel·nouveau]** Invocation de l'élémentaire incarné de la Mort — NI 90, Domaine de la Mort : fait éclore un élémentaire incarné de la Mort d'un sablier de poudre d'os de monarque ; échec = Dégâts BFM + État À Terre en zone.
- `VDM 02 l.653` **[regle-mecanique·nouveau]** Contrôler des élémentaires (incarnés) — Après convocation, Test opposé FM/Force pour contrôler un élémentaire incarné (sinon il attaque le plus proche) ; vit BFM jours, doublé en Saturation Extrême.
- `VDM 02 l.661` **[rituel·nouveau]** Invocation de Jack des Cendres — NI 85, Domaine du Feu : convoque un élémentaire incarné du Feu d'un bûcher ; échec = 4 États En flammes en zone.
- `VDM 02 l.679` **[rituel·nouveau]** Invocation du Prédateur sanglant — NI 85, Domaine de la Bête : convoque un élémentaire incarné de la Bête via un totem d'os/peau ; échec = explosion de Ghur Dégâts 12 ignorant cuir/fourrure.
- `VDM 02 l.698` **[rituel·nouveau]** Lever une malédiction — NI 40, tout Domaine : élimine bienfaits/méfaits d'un objet maudit (préalable : Décrypter une malédiction réussi) ; une arme conserve son Atout Magique.
- `VDM 02 l.716` **[rituel·nouveau]** Lier une bête monstrueuse — NI = PB de la bête, Domaine de la Bête : asservit une bête via Test opposé de FM ; sert BFM jours si liée.
- `VDM 02 l.734` **[rituel·nouveau]** Lier un esprit à une pierre de pouvoir — NI 32, Domaine des Huit Vents : lie un élémentaire mineur/esprit à une pierre de pouvoir ; NI −½ à une Jonction/Appui.
- `VDM 02 l.750` **[rituel·nouveau]** Matérialiser le marais-vivant — NI 40, Domaines Mort/Vie/Ombres/Magie naturelle/Sorcellerie : crée une bête des marais d'un cœur-de-pierre + matière organique ; vit BFM jours.
- `VDM 02 l.771` **[activite·nouveau]** Accomplir un Rituel — Activité inter-aventures : réaliser un Rituel au calme réduit son NI de moitié (arrondi sup.), mais ses effets peuvent s'estomper / attirer les ennemis.
- `VDM 02 l.779` **[activite·nouveau]** Améliorer un familier — Activité : Test de Recherche Difficile (−20) pour permettre au familier d'entreprendre une Activité (Entraînement, Apprentissage particulier hors Béni/Invocation/Âme pure, etc.).
- `VDM 02 l.792` **[activite·nouveau]** Brasser une potion — Activité inter-aventures : fabriquer une potion (procédé p.160) avec ingrédients et laboratoire, sauf Talent Concocter.
- `VDM 02 l.798` **[activite·nouveau]** Réunir des ingrédients — Activité : passer une semaine dans un lieu adéquat pour réunir des ingrédients de potion ; réessai possible via une 2e Activité.

### 04 - Hysh — Domaine de la Lumière (29)

- `VDM 04 l.73` **[carriere·nouveau]** Hiérophante (Acolyte de l'Ordre Lumineux → Hiérophante → Maître Hiérophante → Gardien de l'Ordre Lumineux) — Carrière académique complète en 4 échelons (Bronze 3 → Or 2) avec compétences/talents/possessions par niveau et schéma de progression CC..Soc — absente du LDB.
- `VDM 04 l.48` **[regle-mecanique·nouveau]** Un vent difficile (maîtrise de Hysh) — Hysh impose −1 DR aux Tests d'Incantation/Focalisation et −2 DR aux Tests de Seconde vue (Perception/Intuition/Pistage) ; un acolyte proche avec Focalisation (Hysh) qui réussit Langue (Magick) Facile (+40) et chante annule ces malus.
- `VDM 04 l.249` **[regle-mecanique·republie]** Le Domaine de la Lumière (règle de domaine) — Option d'infliger 1 État Aveuglé (sauf cible avec Magie des Arcanes (Lumière)) + Dégâts supp = Bonus d'Int ignorant Bonus d'End et PA vs Démoniaque/Mort-vivant, + Composants — identique à la règle de domaine du LDB (prose reformulée).
- `VDM 04 l.153` **[table-aleatoire·nouveau]** Marques arcaniques de Hysh (1d10) — Table 1d10 des Marques (Vulnérabilité aux ténèbres, Aura de lumière, Autoluminescence, Stoïcisme, Condescendance éclairée, Yeux blancs, Décoloration, Souvenir instantané, Purification, Marque de Hysh qui octroie le Talent Empreint de Hysh).
- `VDM 04 l.224` **[creature-pnj·nouveau]** Ashamira Dib — PNJ statblocké Hiérophante (Argent 3) : profil complet, compétences/talents/traits, Marques (Marque de Hysh, Stoïcisme), sorts et possessions — mécène jouable.
- `VDM 04 l.259` **[sort·nouveau]** Assaut de pierre — NI 12 ; forme une colline de terre/roche (20 m diam., 5 m haut) ; Esquive Intermédiaire ou 20 Dégâts (10 si réussi).
- `VDM 04 l.269` **[sort·republie]** Bannissement — NI 12 ; ZdE, End < FM ; Démoniaque/Mort-vivant reçoivent Instable (Blessures à 0 s'ils l'ont déjà) — identique au LDB (prose reformulée).
- `VDM 04 l.279` **[sort·nouveau]** Bibliothécaire instantané de Meissner — NI 2 ; illumine le livre/sujet recherché et accorde (1+DR) aux DR d'un Test étendu de Recherche.
- `VDM 04 l.291` **[sort·republie]** Clarté d'esprit — NI 6 ; la cible ignore tous les modificateurs négatifs sur ses pensées (États, mutations mentales, Traits Psychologiques) — identique au LDB (prose reformulée).
- `VDM 04 l.303` **[sort·nouveau]** Collet d'Abulla — NI 5 ; piège magique : 2 États Empêtré (Force = FM), soulève et suspend la cible, +1 Empêtré ou +2 m de lévitation par +1 DR, Dégâts de chute au relâchement.
- `VDM 04 l.316` **[sort·nouveau]** Compréhension parfaite — NI 5 ; comprend toute langue (parlée/écrite/codée), hors langues anciennes/obscures et langue sombre laissées au MJ ; comprend sans pouvoir s'exprimer.
- `VDM 04 l.326` **[sort·nouveau]** Crevasse — NI 8 ; ouvre une crevasse 3 m (extensible à 10 m de profondeur) ; Esquive Intermédiaire ou chute ; à la fermeture 20 Dégâts + Suffocation.
- `VDM 04 l.338` **[sort·nouveau]** Distorsion temporelle — NI 11 ; tous les alliés gagnent une Action supplémentaire (pas de Mouvement) résolue par ordre d'initiative avant reprise du tour.
- `VDM 04 l.348` **[sort·nouveau]** Édifice érigé — NI 9 ; élève un mur de terre/pierre (5 m×1 m×15 cm, couverture totale), extensible par DR ; renouvelé, squelette de bâtiment (s'effondre sans Ingénierie/Maçonnerie) ; Terrassement si règles Aux Armes!.
- `VDM 04 l.362` **[sort·nouveau]** Édifice illuminé — NI 4 ; illumine l'intérieur d'un bâtiment ; démons/morts-vivants doivent réussir FM Intermédiaire pour entrer, sinon Dégâts = total des DR ignorant End et PA.
- `VDM 04 l.377` **[sort·republie]** Fauche-démon — NI 10 ; Incantation opposée à la FM ; annihile un Démoniaque, +DR État Aveuglé aux témoins (sauf Magie des Arcanes (Lumière)) — identique au LDB (prose reformulée).
- `VDM 04 l.389` **[sort·republie]** Filet d'Amyntok — NI 8 ; +1 État Sonné irrécupérable tant que le sort dure, récupération par Test d'Int au lieu de Résistance ; Bestial immunisé — identique au LDB (prose reformulée).
- `VDM 04 l.401` **[sort·nouveau]** Halo purificateur — NI 6 ; empreint une source de lumière : les personnes éclairées gagnent Résistance (Maladie), bonus de dissipation des sorts de Magie noire/Chaos = total des DR ; portée/durée selon la source (max 1 km / 1 jour).
- `VDM 04 l.413` **[sort·nouveau]** Intention inspirée — NI 4 ; +2 DR aux Tests pour résister au Charme et à l'Intimidation ; sur soi, +2 DR aux Tests de Charme si l'on dit la vérité.
- `VDM 04 l.425` **[sort·nouveau]** Lever le voile — NI 4 ; voit à travers ténèbres/brume/fumée/brouillard, voit l'invisible/les illusions et à travers l'obscurité magique (Test opposé de FM).
- `VDM 04 l.433` **[sort·nouveau]** Lueur éblouissante — NI 5 ; explosion de lumière en ZdE : 1 État Aveuglé (sauf Magie des Arcanes (Lumière)) ; les démons reçoivent 1 État Sonné.
- `VDM 04 l.448` **[sort·republie]** Lumière aveuglante — NI 5 ; +DR État Aveuglé à quiconque regarde vers le lanceur (sauf Magie des Arcanes (Lumière)) — identique au LDB (prose reformulée).
- `VDM 04 l.458` **[sort·modifie]** Lumière de guérison — VARIANTE du sort LDB : la perte de 1 Point de Corruption (dernière heure) exige désormais un Test de Résistance Très Difficile (−30) au lieu de Difficile (−20) au LDB ; soin (BInt+BFM) inchangé.
- `VDM 04 l.470` **[sort·nouveau]** Mains de Karkora — NI 8 ; des mains surgissent en ZdE, Esquive Intermédiaire ou Empoigné (Force = FM) ; option déclarée d'entraîner sous terre pour Suffocation au lieu de Dégâts.
- `VDM 04 l.482` **[sort·nouveau]** Manteau miroitant — NI 9 ; les attaques CàC/projectiles perdent leur indice de Dégâts (n'infligent que leur DR), annule tout autre type de dégâts (feu, chute…) ; sans effet sur les attaques magiques, empêche de se cacher.
- `VDM 04 l.492` **[sort·nouveau]** Orbe de Hysh — NI 5 ; télékinésie (Enc max = BFM+DR, vitesse = BFM) ; emprisonne un objet à Influence malveillante et rend ses Tests de Corruption Accessible (+20).
- `VDM 04 l.504` **[sort·republie]** Pensée rapide — NI 8 ; +20 en Initiative et en Intelligence — identique au LDB (prose reformulée).
- `VDM 04 l.514` **[sort·republie]** Protection de Phâ — NI 10 ; aura sacrée : les impies (Démoniaque/Mort-vivant, mutants, sur-corrompus) ne peuvent entrer, les présents reçoivent Brisé, aucun gain de Corruption dans la zone — identique au LDB (prose reformulée).
- `VDM 04 l.522` **[sort·nouveau]** Yeux de Volans — NI 6 ; −2 DR aux Tests de Perception visuelle (ou +20 avec Seconde vue pour voir les vents) ; voit la corruption et les mutations chez les races civilisées, révèle les Points de Corruption / le Trait Corruption.

### 05 - Chamon — Domaine du Métal (VDM / Les Vents de Magie) (31)

- `VDM 05 l.67-98` **[carriere·nouveau]** Alchimiste — Carrière de sorcier propre à l'Ordre Doré, 4 niveaux (Apprenti Alchimiste Bronze 4, Alchimiste Argent 4, Maître Alchimiste Or 3, Seigneur Alchimiste Or 4) avec compétences/talents/possessions et schéma de progression.
- `VDM 05 l.38-44` **[regle-mecanique·nouveau]** Magnétisme magique — Focalisation (Chamon) selon le terrain — −1 DR aux Tests de Focalisation (Chamon) en direction de l'équateur, +1 DR là où abondent les métaux (mines, trésors, navires à vapeur nains).
- `VDM 05 l.142` **[table-aleatoire·nouveau]** Marques Arcaniques de Chamon — Table 1d10 de marques de sorcier propres à Chamon (Larmes de vif-argent, Mécanique, Lueur de la forge, Au voleur !, Langue de plomb, Juste un peu raide, Orbites luisantes, Solidité, Affinité métallique, Marque de Chamon), chacune avec effet mécanique.
- `VDM 05 l.233-237` **[regle-mecanique·nouveau]** Attribut du Domaine du Métal — Attribut de domaine : contre armures métalliques, les Sorts de Dégâts ignorent les PA et gagnent un bonus de Dégâts égal aux PA de l'armure métallique à la Localisation frappée ; + note de Composants du domaine.
- `VDM 05 l.198-222` **[creature-pnj·nouveau]** Balthasar Gelt, Seigneur Alchimiste (Or 4) — Statbloc complet du Patriarche de l'Ordre Doré (caractéristiques, compétences, talents, traits, possessions, marques, listes de sorts Magie mineure/Arcane/Domaine du Métal).
- `VDM 05 l.224-226` **[objet-equipement·nouveau]** Amulette d'Or Marin — Objet magique de Gelt : +2 DR lorsque le porteur tente de dissiper un Sort.
- `VDM 05 l.228-230` **[objet-equipement·nouveau]** La Robe Scintillante — Objet magique de Gelt : si le porteur s'est déplacé au round, tout missile le ciblant (ou ciblant sa monture) subit −2 DR.
- `VDM 05 l.239-247` **[sort·nouveau]** Arme enchantée — NI 6 ; arme non magique devient Magique, +Dégâts = BFM et Atout Incassable ; +3 DR = 1 Atout ajouté ou 1 Défaut retiré.
- `VDM 05 l.249-259` **[sort·nouveau]** Armure de fer blanc — NI 4 ; ZdE ; les porteurs d'armure métallique perdent 2 PA à chaque Localisation.
- `VDM 05 l.261-271` **[sort·nouveau]** Bouclier en acier doré — NI 10 ; enveloppe d'acier doré : +4 Armure, immunité aux phénomènes naturels, réduit de 2 crans une Influence corruptrice, +1 DR Dissipation ; sans effet sur les tissus organiques.
- `VDM 05 l.273-283` **[sort·nouveau]** Boussole d'argent de Puchta — NI 2 ; imprègne une boussole ordinaire qui fonctionne comme une Boussole d'argent météorique (renvoi p.53).
- `VDM 05 l.285-293` **[sort·nouveau]** Cage dorée — NI 9 ; barreaux dorés en cage (pliables sur Force Difficile −20), espacement 30 cm laisse passer Taille Minuscule/Très Petite, projectiles passent entre les barres.
- `VDM 05 l.296-304` **[sort·nouveau]** Contact doré — NI 7 ; la prochaine créature touchée se change en statue dorée (résistance FM Intermédiaire +0), durée secrète MJ (FM×1d10 min), BE 10, prend fin si Blessures.
- `VDM 05 l.306-314` **[sort·nouveau]** Creuset de Chamon — NI 7 ; un objet métallique non magique fond ; si porté, frappe type Projectile magique (Dégâts = BFM, ignore le BE) ; métal conserve sa valeur de base.
- `VDM 05 l.316-328` **[sort·nouveau]** Défaut — NI 2 ; arme (au moins partiellement métal) perd ses Atouts, −1 DR pour attaquer, aggrave Dangereuse/Recharge/Lente ; +4 DR annule temporairement un enchantement magique.
- `VDM 05 l.330-338` **[sort·nouveau]** Dénouer les nœuds — NI 5 ; le MJ donne un indice pour résoudre casse-tête/énigme/piège (+1 par +2 DR) et +2 DR aux Tests de Savoir pertinents.
- `VDM 05 l.340-352` **[sort·nouveau]** Dévoiler l'inconnu — NI 4 ; révèle les propriétés physiques d'un objet/créature (santé, Attribut physique le plus élevé) ; +1 détail par +2 DR ; sur objet magique touché, usage temporaire du Talent Détection d'artefact.
- `VDM 05 l.354-360` **[sort·nouveau]** Écaille d'acier — NI 5 ; gagne Trait Protection (9+) contre toutes attaques/Sorts, chaque frappe évitée améliore la Protection de 1 (max Protection 3+).
- `VDM 05 l.362-374` **[sort·nouveau]** Forge de Chamon — NI 9 ; modifie la qualité d'un objet métal : +1 Atout ou −1 Défaut, plus 1 autre par +2 DR.
- `VDM 05 l.377-387` **[sort·nouveau]** Globe doré de Gehenna — NI 13 ; Vortex aléatoire (renvoi p.20) transformant en statues (comme Contact doré) tout ce qui est dans la ZdE.
- `VDM 05 l.389-397` **[sort·nouveau]** Inscription — NI 2 ; grave métal à main nue (runes secrètes révélables par un autre sorcier Doré sur +2 DR) ; en urgence, jet d'acide Projectile magique Dégâts +2 détruisant 1 PA.
- `VDM 05 l.399-411` **[sort·nouveau]** Malédiction de la rouille — NI 4 ; transforme en rouille un objet métal non magique (Enc ≤1, +1 par +2 DR) ; +4 DR fragilise aussi le non-métal comme du verre.
- `VDM 05 l.413-423` **[sort·nouveau]** Métal changeant — NI 5 ; objet métal non magique chauffe et se plie/tord (Force Accessible +20) ou modification complexe via Test de Métier/Art Accessible (+20).
- `VDM 05 l.425-435` **[sort·nouveau]** Méthode essai-erreur — NI 3 ; +2 DR à la prochaine utilisation d'une Compétence choisie pour la cible ; +2 DR = relance supplémentaire.
- `VDM 05 l.437-447` **[sort·nouveau]** L'Or des fous — NI 4 ; tout le métal d'un objet non magique devient réellement de l'or pour la Durée puis revient (peut alourdir armures, endommager armes).
- `VDM 05 l.450-464` **[sort·nouveau]** Plume de plomb — NI 5 ; ZdE : modifie la densité des biens des cibles — Surchargé de 2 paliers de plus, ou n'est pas considéré comme Surchargé.
- `VDM 05 l.466-476` **[sort·nouveau]** Protections de fer météorique — NI 7 ; ZdE : cibles gagnent Trait Protection (7+), armure magique très légère cumulable avec l'armure normale ; Durée 1 round.
- `VDM 05 l.478-486` **[sort·nouveau]** Réfraction prismatique de Habermas — NI 5 ; −1 DR à tous les Tests de Focalisation/Incantation dans la ZdE ; à la fin, produit un fluide aethyrique d'une couleur choisie donnant +1 DR à un Test d'Incantation du Domaine lié (s'évapore en 2 rounds).
- `VDM 05 l.488-496` **[sort·nouveau]** Réparer du métal — NI 4 ; répare un objet métal abîmé (si ≥3/4 présent) ou 'fritte' deux objets ensemble (aide Métier Forgeron, ou soude une armure ennemie en ajoutant Peu fiable + Volumineux).
- `VDM 05 l.498-508` **[sort·nouveau]** Reproduction de Levorg — NI 6 ; invoque un objet non magique inanimé (Enc ≤4, +1 par +2 DR), Durée 1d10 h secrète ; variante 1d10 Couronnes (interdite par le Collège) ; objet chimiquement simple, non consommable/explosif/composant.
- `VDM 05 l.510-518` **[sort·nouveau]** Transmutation de Chamon — NI 12 ; Projectile magique de ZdE (Dégâts = BFM, ignore BE), +1 Aveuglé/Assourdi/Sonné et Suffocation, +1 PA d'or aux cibles ; cibles tuées enfermées en carapace de métal.

### 06 - Ghyran — Domaine de la Vie (29)

- `VDM 06 l.61` **[carriere·nouveau]** Druide — Carrière de mage propre à l'Ordre de Jade (4 niveaux : Apprenti Druide/Druide/Maître Druide/Seigneur Druide) avec schéma de progression, compétences, talents et possessions dédiés.
- `VDM 06 l.34` **[regle-mecanique·nouveau]** Variations saisonnières (Focalisation Ghyran) — Modificateurs aux Tests de Focalisation (Ghyran) : +1 DR près d'eau abondante / −1 DR en milieu sec ; +1 DR à Sommerzeit et Vorgeheim / −1 DR à Ulriczeit et Vorhexen.
- `VDM 06 l.141` **[table-aleatoire·nouveau]** Marques de Ghyran (1d10) — Table d10 des marques physiques/mentales acquises par les sorciers de Jade (Croissance rapide, Nu-pieds, Vulnérabilité au feu, octroi de Trait Arboricole ou Talent Empreint de Ghyran, etc.).
- `VDM 06 l.244` **[regle-mecanique·nouveau]** Le Domaine de la Vie (attribut de domaine) — Attribut du Domaine : +10 pour Incanter/Focaliser en milieu rural/sauvage ; les vivants ciblés perdent États Exténué et Hémorragique ; les Morts-vivants subissent des Dégâts = BFM ignorant BE et PA ; liste de composants.
- `VDM 06 l.219` **[creature-pnj·nouveau]** Tochter Grunfeld, Seigneur Druide (Humain, Or 2) — PNJ statblocké complet (profil, compétences, talents, traits, possessions, marques, sorts) + accroches d'aventure.
- `VDM 06 l.252` **[sort·nouveau]** Almanach — Sort de Jade (NI 4) : prédit les événements saisonniers/météo de l'année à venir, précision affinée selon les DR.
- `VDM 06 l.260` **[sort·nouveau]** Apothéose verdoyante — Sort de Jade (NI 16) : ranime les personnages tués dans la dernière minute (Test d'Exposition Modérée à la Corruption ; ni critiques ni membres ni décapités).
- `VDM 06 l.274` **[sort·nouveau]** Cercueil de Jade — Sort de Jade (NI 6) : ranime un cadavre (mort depuis <1h) comme serviteur non mort-vivant conservant compétences/traits/talents non magiques.
- `VDM 06 l.286` **[sort·nouveau]** Chair de pierre — Sort de Jade (NI 9) : transforme la cible en pierre vivante (+30 F et E, +4 PA/localisation, Mouvement /2, ne parle plus).
- `VDM 06 l.298` **[sort·nouveau]** Chant revigorant — Sort de Jade (NI 6) : réveille/anime des créatures végétales dans la ZdE, les soigne +DR Blessures et +DR à tous leurs Tests (sans contrôle).
- `VDM 06 l.309` **[sort·nouveau]** Chute de feuilles — Sort de Jade (NI 6) : −2 DR aux projectiles contre soi, octroie Talent Contorsionniste, réduit de 3 Dégâts de Chute et d'armes contondantes.
- `VDM 06 l.317` **[sort·nouveau]** Configuration du terrain — Sort de Jade (NI 5) : carte mentale des caractéristiques naturelles à portée (reliefs, forêts, rivières).
- `VDM 06 l.327` **[sort·nouveau]** Cri de guerre du Druide — Sort de Jade (NI 9) : invoque une Forêt de sang (10 Dégâts + État Hémorragique dans la ZdE ; persiste, Test d'Agilité pour la traverser).
- `VDM 06 l.337` **[sort·nouveau]** Croissance vitale — Sort de Jade (NI 7) : fait pousser une plante/arbre à sa taille max, jusqu'au quadruple selon Rounds de concentration et DR.
- `VDM 06 l.349` **[sort·nouveau]** Don de Vie — Sort de Jade (NI 8) : régénère une zone/cible délabrée (rivière asséchée, puits pollué, champ, animal malade).
- `VDM 06 l.364` **[sort·nouveau]** Eau de la terre — Sort de Jade (NI 8) : disparition sous terre puis réapparition à distance = FM mètres (+FM par +2 DR), ennemis Engagés reçoivent Surpris.
- `VDM 06 l.371` **[sort·nouveau]** Écorce — Sort de Jade (NI 3) : peau dure comme l'écorce, +2 au Bonus d'Endurance mais −10 en Agilité et Dextérité.
- `VDM 06 l.383` **[sort·nouveau]** Escalier en colimaçon — Sort de Jade (NI 6) : escalier brumeux montant (hauteur = FM m, jusqu'à 200 m), +3 PA, gêne les projectiles ; autres sorciers de Jade y accèdent via Savoir (Magie).
- `VDM 06 l.393` **[sort·nouveau]** Êtres du dessous — Sort de Jade (NI 13) : esprits de terre emportent les cibles sous terre (Test de Force) pour 1d10 h, puis Test d'Exposition Modérée à la Corruption.
- `VDM 06 l.407` **[sort·nouveau]** Forêt d'épines — Sort de Jade (NI 6) : ronces couvrant la ZdE ; traverser sans Magie des Arcanes (Vie) exige un Test d'Agilité Difficile sous peine d'États Hémorragique et Empêtré.
- `VDM 06 l.417` **[sort·nouveau]** Geyser — Sort de Jade (NI 8) : geyser infligeant un Projectile magique Dégâts +4, projection à BFM m, État À Terre (+ Sonné par +2 DR).
- `VDM 06 l.429` **[sort·nouveau]** Graisse de la terre — Sort de Jade (NI 4) : la cible n'a plus besoin de manger ni boire pendant BFM jours (excréments verts).
- `VDM 06 l.441` **[sort·nouveau]** Murmure de la nature — Sort de Jade (NI 8) : communication télépathique avec les esprits mineurs d'une rivière (mémoire 24 h) ou d'un arbre (mémoire d'années, lents).
- `VDM 06 l.452` **[sort·nouveau]** Régénération — Sort de Jade (NI 6) : la cible gagne le Trait de créature Régénération pendant BFM Rounds.
- `VDM 06 l.466` **[sort·nouveau]** Sang de la terre — Sort de Jade (NI 6) : les créatures vivantes en contact avec la terre dans la ZdE guérissent BFM Blessures au début de chaque Round.
- `VDM 06 l.474` **[sort·nouveau]** Transformation en arbre — Sort de Jade (NI 8) : transforme la cible/soi en chêne (vulnérable haches/feu) ; cible réticente résiste par Test de FM Accessible.
- `VDM 06 l.488` **[sort·nouveau]** Transmutation fantasmagorique de Colchis — Sort de Jade (NI 6) : ignifuge la ZdE, éteint les feux et retire tous les États En flammes (immunité perdue en quittant le périmètre).
- `VDM 06 l.496` **[sort·nouveau]** Trouver des lignes de force telluriques — Sort de Jade (NI 5) : carte mentale des lignes de force et cercles de pierres à portée, +2 DR aux Tests d'Orientation associés.
- `VDM 06 l.508` **[sort·nouveau]** La Voie de Paranoth — Sort de Jade (NI 4) : le groupe gagne le Talent Bon marcheur (Régions boisées) (+niveaux temporaires selon DR) et peut progresser sans laisser de trace à +4 DR.

### 07 - Azyr — Domaine des Cieux (Les Vents de Magie) (29)

- `VDM 07 l.61` **[carriere·republie]** Astromancien — Re-présente le schéma de progression du Sorcier Céleste (Acolyte Céleste Bronze 4, Astromancien Argent 4, Grand Astromancien Or 1, Seigneur Céleste Or 2) avec compétences/talents/possessions par rang — à vérifier verbatim vs LDB.
- `VDM 07 l.48` **[regle-mecanique·nouveau]** Vent d'Azyr — bonus de Focalisation en hauteur — +1 DR aux Tests de Focalisation en tour ou colline élevée ; +2 DR au sommet d'une haute montagne ou à bord d'un appareil en vol.
- `VDM 07 l.239` **[regle-mecanique·nouveau]** Domaine des Cieux — attribut de domaine — Les Sorts de Dégâts ignorent les PA des armures métalliques et frappent toutes les cibles dans 2 m, sauf porteurs du Talent Magie des Arcanes (Cieux) (Dégâts = BFM, traités comme Projectile magique) ; liste des Composants du domaine.
- `VDM 07 l.143` **[table-aleatoire·nouveau]** Marques Arcaniques d'Azyr — Table 1d10 de marques arcaniques (Prévision troublante, Yeux céruléens, Voix murmurée, Inconsistant, Hautement cérébral, Aura de tranquillité, Conscience vagabonde, Inodore, Astronome, Marque d'Azyr octroyant le Talent Empreint d'Azyr).
- `VDM 07 l.216` **[creature-pnj·nouveau]** Raphael Julevno — PNJ statblocké complet (Grand Astromancien Or 1) : profil, compétences, talents, traits, possessions et listes de sorts.
- `VDM 07 l.245` **[sort·nouveau]** Arc de T'Essla — Éclair — Projectile magique Dégâts +10 infligeant +1 État Aveuglé (en-tête de nom perdu au formatage, mais NI/premier sort du domaine).
- `VDM 07 l.253` **[sort·nouveau]** Arche de saphir — NI 6 — arche téléportante hors du temps ; retour à la prochaine incantation, ou renvoi avec États Sonné et À Terre si le lanceur meurt.
- `VDM 07 l.263` **[sort·nouveau]** Bouclier céruléen — NI 7 — +DR PA à toutes localisations contre le corps à corps ; renvoie des Dégâts (BFM, réduits par BE mais pas PA) aux armes métalliques.
- `VDM 07 l.271` **[sort·nouveau]** Comète de Cassandora — NI 10 — Test de Perception Accessible (+20) pour déplacer le point cible ; Projectile magique Dégâts +12 en ZdE, +1 État En flammes et À Terre.
- `VDM 07 l.288` **[sort·nouveau]** Destin éclairci — NI 5 — question fermée oui/non sur les intentions (une de plus par +2 DR) ; au contact, révèle Destinée, présages et symboles d'Augure.
- `VDM 07 l.302` **[sort·nouveau]** Le Deuxième Signe d'Amul — NI 6 — gagne +DR Points de Chance (+1 par +2 DR) ; points inutilisés perdus en fin de durée.
- `VDM 07 l.310` **[sort·nouveau]** Ennemi prévisible — NI 4 — ne peut être Surpris ; le MJ alerte d'embuscade BI Rounds à l'avance.
- `VDM 07 l.318` **[sort·nouveau]** Ironie du Destin — NI 6 — les alliés en ZdE (sauf porteurs de Magie des Arcanes Cieux) partagent une réserve commune de Points de Chance (premier arrivé premier servi).
- `VDM 07 l.328` **[sort·nouveau]** Lames d'Azur — NI 6 — sphère de lames : un adversaire au corps à corps subit 3 frappes de 8 Dégâts (localisations aléatoires), ni esquivables ni parables ; interaction selon l'allonge de l'arme.
- `VDM 07 l.336` **[sort·nouveau]** Lentille céleste — NI 3 — disque flottant : vision nette jusqu'à 3 milles, +2 DR Perception à longue distance, annule nuages/brume, +2 DR au prochain Test d'Orientation.
- `VDM 07 l.344` **[sort·nouveau]** Lueur stellaire — NI 8 — révèle les cibles invisibles et dissipe l'obscurité naturelle/magique en ZdE, dévoile créatures et portes dissimulées ; la zone suit le lanceur.
- `VDM 07 l.357` **[sort·nouveau]** Malédiction du Destin — NI 8 — cible −10 à tous les Tests 1 journée (Ligne de Vue) ; variante Destin fatal (à +6 DR) : portée 1 mille, perte définitive d'un Point de Destin ou prochain Critique traité comme « 00 ».
- `VDM 07 l.371` **[sort·nouveau]** Maudit — NI 7 — permet de dépenser des Points de Chance pour forcer un adversaire à relancer ses Tests tant que le Sort est actif.
- `VDM 07 l.383` **[sort·nouveau]** Miroir mystique — NI 7 — communication à distance (FM milles) via surface réfléchissante ; nécessite de connaître le nom/avoir rencontré la cible, qui doit avoir un miroir en vue.
- `VDM 07 l.395` **[sort·nouveau]** Mistral de la stratosphère — NI 7 — 12 Dégâts (BE, pas PA) en ZdE + Test de Résistance Difficile ou Exposition au Froid ; gèle l'eau ; redirigeable les Rounds suivants.
- `VDM 07 l.405` **[sort·nouveau]** Nettoyage impeccable — NI 1 — nettoie un objet en verre ; enchantement temporaire (+2 DR : +20 Savoir Astronomie ; +4 DR : +20 Perception visuelle avec Seconde vue).
- `VDM 07 l.415` **[sort·nouveau]** Prédiction prodigieuse — NI 7 — alliés en ZdE relancent leur premier échec en Incantation/Focalisation/Dissipation ; inverse Bouleversement de Solmann : les sorciers adverses tirent deux fois et gardent le pire.
- `VDM 07 l.425` **[sort·nouveau]** Le Premier Signe d'Amul — NI 3 — +1 Point de Chance (+1 par +2 DR) ; points inutilisés perdus en fin de durée.
- `VDM 07 l.434` **[sort·nouveau]** Prémonition — NI 3 — un de 3 effets au choix : moment opportun (Test d'Int secret), localiser un objet perdu (direction), ou modifier un prochain lancer de ±10.
- `VDM 07 l.446` **[sort·nouveau]** Projection astrale — NI 7 — esprit hors du corps (invisible, traverse les solides, ni sorts ni manipulation) ; Test contre Exposition Modérée à la Corruption si non-retour à temps.
- `VDM 07 l.456` **[sort·nouveau]** Que soufflent les Quatre Vents ! — NI 9 — 4 Vortex aléatoires ou 4 groupes repoussés de BFM m (+BFM par +2 DR) ; 7 Dégâts (BE+PA) à l'impact d'un obstacle + État À Terre.
- `VDM 07 l.468` **[sort·nouveau]** Tempête de Shemtek — NI 11 — (BI×2) éclairs Projectile magique Dégâts +6 ; lanceur Sonné, témoins non-Cieux Test de Peur (1) ; variante moins risquée : BI éclairs, sans Sonné ni Peur.
- `VDM 07 l.484` **[sort·nouveau]** Tornade de Thorsen — NI 11 — Vortex aléatoire : Projectile magique Dégâts +8 en ZdE puis projection aléatoire (règles de Que soufflent les Quatre Vents).
- `VDM 07 l.494` **[sort·nouveau]** Le Troisième Signe d'Amul — NI 12 — +1 Point de Destin ; perdu si inutilisé à la fin de la durée.

### 09 - Shyish — Domaine de la Mort (VDM / Les Vents de Magie) (33)

- `VDM 09 l.42` **[regle-mecanique·nouveau]** Focalisation (Shyish) — modificateur de lieu — Les Tests de Focalisation (Shyish) gagnent +1 DR là où de nombreux corps sont enterrés / des massacres ont eu lieu, et -1 DR dans les zones épargnées par la mort.
- `VDM 09 l.72` **[carriere·nouveau]** Spirite (Apprenti Spirite / Spirite / Maître Spirite / Seigneur Spirite) — Carrière de sorcier de l'Ordre d'Améthyste, 4 niveaux Bronze 2 → Or 2, avec listes complètes de Compétences/Talents/Possessions par échelon.
- `VDM 09 l.136` **[table-aleatoire·nouveau]** Marques Arcaniques de Shyish — Table 1d10 de marques/effets permanents propres à Shyish (Ossature squelettique, Malédiction du vieillissement, Siphon, etc. ; le 10 octroie le Talent Empreint de Shyish).
- `VDM 09 l.242` **[regle-mecanique·nouveau]** Domaine de la Mort — attribut de drain — Attribut du Domaine : +1 État Exténué assignable à chaque cible vivante affectée par un Sort du Domaine, une seule fois cumulable par cible.
- `VDM 09 l.207` **[regle-mecanique·nouveau]** Mécénat d'Elspeth von Draken (tutorat) — Bonus de tutorat d'Elspeth aux Activités : +1 DR (Rituel +2 si Shyish composant), pas de Test de Ragot pour la localiser mais Charme Difficile pour la convaincre, entraînement de compétences/talents avec Test abaissé Difficile→Complexe.
- `VDM 09 l.215` **[creature-pnj·nouveau]** Elspeth von Draken (Seigneur Spirite Humain, Or 2) — Statbloc complet (profil, Compétences, Talents, Traits Éthéré/Immunité Psychologique/Arme (Faux blafarde) +7, Possessions, Sorts — a mémorisé tous les Sorts du Domaine de la Mort).
- `VDM 09 l.235` **[objet-equipement·nouveau]** La Faux blafarde — Arme magique d'Elspeth : Arme d'hast, Enc 2, Allonge Longue, Dégâts +BF+4, qualités Dévastatrice/Empaleuse/Magique.
- `VDM 09 l.203` **[objet-equipement·nouveau]** Le Sablier de la Mort — Artefact : tant qu'il est porté, le porteur a toujours 1 Point de Chance même après avoir dépensé les 3 de Chanceux ; maîtrise via l'Activité Tester des objets magiques, échec = Blessure Critique aléatoire.
- `VDM 09 l.280` **[trait·nouveau]** Désespoir (Trait Psychologique) — Trait psychologique octroyé par le sort Aperçu de la mort : dans la semaine, la victime reçoit +1 État Exténué chaque matin au réveil.
- `VDM 09 l.246` **[sort·nouveau]** Amarante — NI 7 ; réduit de 10 les résultats de Critique subis et octroie Résistance (Poison, Maladie et Chaos), +1 niveau par +2 DR.
- `VDM 09 l.256` **[sort·nouveau]** Âme emprisonnée — NI 12 ; emprisonne l'âme d'une cible dans un réceptacle, corps léthargique ; sert de composant pour Télépathie à portée infinie.
- `VDM 09 l.270` **[sort·nouveau]** Aperçu de la mort — NI 7 ; Corruption Mineure + Tests de Calme échelonnés → Inconscient/Sonné/Exténué et Trait Désespoir.
- `VDM 09 l.282` **[sort·nouveau]** Caresse de Laniph — NI 4 ; Projectile magique Dégâts +6 ignorant BE et PA, récupère 1 PB par 2 PB infligés.
- `VDM 09 l.291` **[sort·nouveau]** Cendre et poussière — NI 9 ; Vortex aléatoire, 8 Dégâts ignorant PA + Suffocation ; à +4 DR invoque le Soleil violet de Xereus (Peur 2, mort instantanée sur échec de Calme).
- `VDM 09 l.305` **[sort·nouveau]** Contraindre les esprits — NI 6 ; autorité sur créatures Mort-vivant+Éthéré (les commander via Test opposé de FM) ou invoquer des fantômes égaux au DR.
- `VDM 09 l.316` **[sort·nouveau]** Dernières paroles — NI 6 ; rappelle l'âme d'un mort récent (≤1 jour) pour lui parler ; elle ne ment pas mais peut refuser de répondre.
- `VDM 09 l.328` **[sort·nouveau]** Destin de Bjuna — NI 8 ; fou rire mortel : chaque Round Test de Calme ou Sonné + Dégâts 6+BF ignorant PA ; à +2 DR ajoute Suffocation par cible.
- `VDM 09 l.342` **[sort·nouveau]** Embrasser son destin — NI 6 ; alliés immunisés à la Peur (Terreur→Peur) et retrait des effets de chagrin ; variante ennemis empêchés de fuir.
- `VDM 09 l.356` **[sort·nouveau]** Étreinte d'Iyrtu — NI 4 ; +10 Force par +1 DR et réussite automatique des attaques pour Empoigner.
- `VDM 09 l.365` **[sort·nouveau]** La Faux de Shyish — NI 6 ; invoque une faux magique (Arme d'hast, Dégâts BFM+3) ; les Mort-vivant ne gagnent pas d'Avantage en Engagement contre vous.
- `VDM 09 l.375` **[sort·nouveau]** Le Labyrinthe de Cristal — NI 13 ; piège des ennemis dans l'Aethyr, chaque cible lance 1d10 (table Échappée/Désorientée/Perdue/Condamnée au Royaume de Tzeentch).
- `VDM 09 l.394` **[sort·nouveau]** Libération de la mort — NI 5 ; les créatures Mort-vivant+Éthéré subissent Sonné par Round ; 3 États Sonné cumulés = esprit libéré du royaume des mortels.
- `VDM 09 l.406` **[sort·nouveau]** Membre flétri — NI 5 ; engourdit un membre (considéré amputé) pendant (BFM) minutes ; variante malédiction du pilleur de tombe (BFM jours).
- `VDM 09 l.418` **[sort·nouveau]** Mort rapide — NI 6 ; achève une cible à 0 Blessure et ≥2 Blessures Critiques ; empêche sa réanimation en mort-vivant.
- `VDM 09 l.426` **[sort·nouveau]** Parent sauvage de Zandox — NI 5 ; invoque deux chiens d'ombre (CC 50, Trait Arme (Morsure) +8, rayon 4 m) invisibles, ni attaquables ni source d'Avantage.
- `VDM 09 l.436` **[sort·nouveau]** Poids des années — NI 3 ; vieillit un objet non magique (Enc max 2, +1 par +2 DR) en poussière ; à 4+ DR peut cibler une créature vivante (−1d10 F et E permanent).
- `VDM 09 l.451` **[sort·nouveau]** Sanctifier — NI 10 ; trace un cercle infranchissable par les créatures Mort-vivant (ni entrée ni sortie).
- `VDM 09 l.463` **[sort·nouveau]** Shyish à découvert — NI 4 ; révèle les créatures mortes dans la ZdE sur le dernier mois (+1 mois par DR) ; questions aux morts nommés par +2 DR.
- `VDM 09 l.475` **[sort·nouveau]** Télépathie — NI 1 ; message télépathique à un sorcier d'Améthyste (portée 100 m, illimitée via Âme emprisonnée) ou lecture de pensées superficielles.
- `VDM 09 l.489` **[sort·nouveau]** Vitesse de Lykos — NI 3 ; la cible se déplace de 100 m et agit quand même ; tuée sous l'effet, elle effectue une action supplémentaire avant de mourir.
- `VDM 09 l.501` **[sort·nouveau]** Voile violet de Shyish — NI 9 ; +(BFM) PA à toutes les Localisations et Trait Peur (1), +1 Indice de Peur par +2 DR.
- `VDM 09 l.511` **[sort·nouveau]** Vol de vie — NI 7 ; Projectile magique Dégâts +6 ignorant PA + 1 État Exténué ; retire vos États Exténué et vous guérit de la moitié des Blessures infligées.
- `VDM 09 l.525` **[sort·nouveau]** Vortex d'âmes — NI 8 ; +1 État Brisé dans la ZdE ; les Mort-vivant subissent un Projectile magique Dégâts +10 ignorant BE et PA.

### 10 - Aqshy — Domaine du Feu (29)

- `VDM 10 l.42` **[regle-mecanique·nouveau]** Quand souffle le Sirocco (Focalisation près du feu) — Les sorciers Flamboyants gagnent +1 DR aux Tests de Focalisation (Aqshy) près d'un feu (feu de joie, bâtiment en flammes), +2 DR près d'un volcan actif ou d'une ville en flammes.
- `VDM 10 l.57-96` **[carriere·modifie]** Pyromancien — Variante college (Ordre Flamboyant) de la carriere Sorcier du LDB : 4 niveaux (Apprenti/Pyromancien/Maitre/Seigneur), Focalisation (Aqshy), Magie des Arcanes (Feu), Clefs des Secrets, schema de progression et possessions dedies.
- `VDM 10 l.122-154` **[table-aleatoire·nouveau]** Marques arcaniques d'Aqshy (1d10) — Table d10 de marques de sorcier Flamboyant (Cheveux de feu, Odeur d'Aqshy, Brume rouge, Vulnerabilite au froid, Aquaphobe, Pyromane, Peau luisante, Nourrir le feu, Resistant au feu, Marque d'Aqshy) ; certaines entrees octroient des Traits Psychologiques ou le Talent Empreint d'Aqshy.
- `VDM 10 l.225-247` **[creature-pnj·nouveau]** Sergov Pfeiffer — PNJ statblocke : Sorcier Flamboyant humain (Argent 3), profil complet, competences, talents, traits d'arme, sorts (magie mineure, arcane, Domaine du Feu).
- `VDM 10 l.250-256` **[regle-mecanique·republie]** Domaine du Feu (regle de domaine + Composants) — Reprend a l'identique du LDB : +1 Etat En flammes aux cibles des sorts du Domaine (sauf Magie des Arcanes Feu), +10 Focalisation/Incantation par Etat En flammes dans le Bonus de FM en metres ; paragraphe Composants inflammables.
- `VDM 10 l.258-270` **[sort·nouveau]** Allumer le feu — NI 2, ZdE : rend inflammable tout ce qui ne l'est pas (meme eau/pierre) ; l'inflammable present recoit +1 Etat En flammes et +DR Degats de feu.
- `VDM 10 l.272-280` **[sort·nouveau]** Blizzard ardent d'Ygethmor — NI 12, ZdE : 8+DR Degats/tour, Test d'Athletisme ou Etat A Terre, 25% que les objets/terrain prennent feu ; seule une couverture totale protege.
- `VDM 10 l.282-292` **[sort·republie]** Cautériser — Identique au LDB : NI 4, guerit 1d10 Blessures, retire Hemorragique, pas d'infection ; Test de Calme ou hurlement, echec -6 DR = Inconscient marque a vie.
- `VDM 10 l.294-302` **[sort·modifie]** Cœurs ardents — Variante du LDB : ajoute la clause explicite « si une cible possede deja l'un des Talents (Coude-a-coude/Sans peur/Cœur vaillant), elle gagne temporairement un niveau supplementaire ».
- `VDM 10 l.304-314` **[sort·nouveau]** Cognat de l'âtre — NI 4 : invoque un elementaire de feu mineur gardien de campement (M3, CC=FM, Degats +6, Peur 1, inflige En flammes) ; couteau en Endurance a l'invocation, detruit par une pinte d'eau.
- `VDM 10 l.316-332` **[sort·nouveau]** Colérique — NI 2 : impose le Trait Psychologique Prejuge (puis Animosite a +4 DR, Haine a +8 DR) envers une personne designee ; resistible par Calme si amis.
- `VDM 10 l.334-344` **[sort·nouveau]** Corps de feu — NI 5 : corps enflamme, sang pyrophorique ; punit les empoignades (8+DR Degats, En flammes) et asperge l'assaillant d'un Projectile magique ignorant les PA si le lanceur est blesse.
- `VDM 10 l.346-352` **[sort·republie]** Couronne de Flammes — Identique au LDB : NI 8, octroie Peur 1 et le Talent Seigneur de guerre, +1 Peur ou +1 Seigneur de guerre par +2 DR, +10 Focalisation/Incantation Aqshy.
- `VDM 10 l.354-362` **[sort·modifie]** L'Égide d'Aqshy — Variante du LDB : la Protection 9+ couvre desormais explicitement la maleflamme et le Trait Souffle (Feu) (le souffle des monstres passe de l'immunite non-magique du LDB a la protection magique).
- `VDM 10 l.364-374` **[sort·nouveau]** Embrasement — NI 3 : cible +2 Etats En flammes ; si deja En flammes, distribue 3 Etats En flammes a d'autres cibles a 2 m ou moins.
- `VDM 10 l.376-386` **[sort·modifie]** L'Épée ardente de Rhuin — Variante du LDB : precise que l'arme enveloppee doit etre une « Arme simple » (restriction absente du LDB) ; reste Degats +6, Percutante, En flammes, Maladresse sans Magie des Arcanes Feu.
- `VDM 10 l.388-400` **[sort·nouveau]** Épées sanguines — NI 6 : invoque jusqu'a 6 epees volantes (Vol 20, CC 60, 8 Degats) dirigees par action ; indestructibles, sans Avantages, dissipables.
- `VDM 10 l.403-415` **[sort·nouveau]** Flamme fascinante — NI 3 : hypnotise un observateur d'un feu (Test de Calme ou 3 Etats Sonne) ; +2 DR/+4 DR elargit a un brasier/enorme feu et plusieurs/tous les observateurs.
- `VDM 10 l.417-431` **[sort·nouveau]** Flamme inextinguible — NI 3 : rend un feu (taille max feu de camp) inextinguible pendant heures (jusqu'a mois avec DR), ne consomme pas de combustible ; ou eteint un feu de taille similaire, non dissipable.
- `VDM 10 l.433-441` **[sort·nouveau]** La Forge de Tarnus — NI 6 : embrase une forge, +1 DR aux Tests de Metier (Forgeron/Armurier) y compris pour creer des Objets magiques (ADE Vol. II).
- `VDM 10 l.443-455` **[sort·nouveau]** Fournaise flétrissante — NI 6, ZdE : les ennemis qui courent/chargent/fuient recoivent un Etat Extenue/Round (retire par le retrait d'armure) ; toute source de feu inflige En flammes + Degats egaux aux +DR.
- `VDM 10 l.457-469` **[sort·nouveau]** Goût du feu — NI 2 : rend un aliment/liquide brulant — nourriture ultra-epicee (Test de Resistance), liquide change en alcool fort, ou en huile inflammable de lanterne.
- `VDM 10 l.471-481` **[sort·modifie]** Grands feux d'U'Zhul — Variante du LDB : les Degats persistants de zone sont subis « a la fin d'un Round » (LDB : « au debut d'un Round ») et le jet de defense est precise en Esquive Intermediaire (+0).
- `VDM 10 l.484-494` **[sort·modifie]** Mur de feu — Variante du LDB : ajoute une hauteur explicite (« haut d'1 metre ») au mur (absente du LDB qui ne donne que largeur et epaisseur).
- `VDM 10 l.496-506` **[sort·republie]** Purification — Identique au LDB (leger reformulage) : NI 10, embrase la zone, +DR Etat En flammes, consume Dhar/malepierre/objets de Chaos, maintien par Test de Focalisation.
- `VDM 10 l.508-518` **[sort·nouveau]** Sang bouillant — NI 5, Contact : Test de Resistance Complexe ou 2 Etats Aveugle + 10+DR Degats ignorant les PA (pas le Bonus d'End.) ; cible tuee explose en Projectile magique de zone.
- `VDM 10 l.520-528` **[sort·nouveau]** Tempête de flammes — NI 8 : colonne de feu 2x2 m (agrandie par DR), Projectile magique +8, 3 Etats En flammes, projette et met A Terre ; persiste jusqu'au lever du soleil ou dissipation.
- `VDM 10 l.530-542` **[sort·nouveau]** Tempête de magma — NI 13 : vortex aleatoire (regles p.20) de roche en fusion, 2 Etats En flammes + Projectile magique +12 ; +2 DR engendre des vortex plus petits (max 3).
- `VDM 10 l.544-556` **[sort·nouveau]** Tête enflammée — NI 6 : boule de feu en tete riante frappant en ligne droite (Projectile magique +4, +0 si Esquive), En flammes ; le lanceur est considere Peur 1 par les cibles ayant perdu au moins 1 Blessure.

### 15 - Némésis et aventures magiques (18)

- `VDM 15 l.61` **[creature-pnj·nouveau]** Egrimm van Horstmann — Statbloc complet de némésis (magister apostat de Tzeentch) : profil, compétences, talents, traits, possessions, corruption mentale et listes de sorts.
- `VDM 15 l.90` **[objet-equipement·nouveau]** Le Crâne de Katam — Artefact démonologique : accorde +2 DR à tous les Tests de Focalisation, au prix d'un Test de Calme Difficile (−20) sous peine d'État Exténué + 1 Point de Corruption.
- `VDM 15 l.104` **[objet-equipement·nouveau]** Cape de charme doré — Cape magique : octroie les Traits Perturbant et Protection 9+ ; les adeptes/démons de Slaanesh la Haïssent mais retiennent leurs coups et n'attaquent pas à distance son porteur.
- `VDM 15 l.148` **[creature-pnj·nouveau]** P'tarix, Celui qui écrit — Statbloc de démon Scribe Bleu de Tzeentch (celui qui écrit sans lire), porteur du nouveau Trait Siphonnage de sort.
- `VDM 15 l.159` **[creature-pnj·nouveau]** Xirat'p, Celui qui lit — Statbloc de démon Scribe Bleu de Tzeentch (celui qui lit sans écrire), porteur du nouveau Trait Incantateur hasardeux.
- `VDM 15 l.184` **[trait·nouveau]** Incantateur hasardeux — Nouveau Trait de créature : le porteur lance un sort aléatoire une fois par Round quand il est attaqué, domaine déterminé sur une table 1d100.
- `VDM 15 l.188` **[table-aleatoire·nouveau]** Table 1d100 — Domaine (Incantateur hasardeux) — Table 1d100 déterminant le domaine du sort lancé aléatoirement (Magie mineure, Arcanes, huit Domaines, Sorcellerie, Démonologie, Nécromancie, Slaanesh, Tzeentch, au choix du MJ).
- `VDM 15 l.208` **[trait·nouveau]** Siphonnage de sort — Nouveau Trait de créature : impose un Test opposé de Force Mentale quand un ennemi lance un sort ; en cas de réussite, résultat sur table 1d10 + Test de Calme Très Difficile (−30) pour la cible.
- `VDM 15 l.212` **[table-aleatoire·nouveau]** Table 1d10 — Siphonnage de sort — Table 1d10 d'effet du siphonnage : aucun effet, sort siphonné, sort en miroir, ou fuite d'énergie (Explosion 5, 6 Dégâts).
- `VDM 15 l.275` **[creature-pnj·nouveau]** Mòna Mimn — Matriche Fimir — Statbloc de némésis meargh fimir millénaire : profil, compétences, talents, traits, possessions et listes de sorts dont sa lore propre.
- `VDM 15 l.297` **[trait·nouveau]** Mauvais œil — Nouveau Trait de créature (fimir) : octroie le Talent Seconde vue, +2 DR aux Tests de Pistage/Orientation/Perception, +1 DR aux Tests de Langue (Magick)/Focalisation, et permet d'annuler une Incantation Imparfaite via un Test de Perception Complexe (−10).
- `VDM 15 l.305` **[sort·nouveau]** Bourbier d'abattement — Nouveau sort (Magie du marais de Mòna, NI 6) : inflige un État Empêtré de Force égale à l'Intelligence, +1 par tranche de +2 DR, avec Test de Calme Accessible (+20) chaque Round sous peine d'État Exténué.
- `VDM 15 l.317` **[sort·nouveau]** Brume mystique — Nouveau sort (Magie du marais de Mòna, NI 4) : reproduit l'effet du sort du Domaine des Ombres Miasme mystifiant mais à NI réduit.
- `VDM 15 l.327` **[sort·nouveau]** De la boue jusqu'au bout ! — Nouveau sort (Magie du marais de Mòna, NI 20) : lancé au bord d'un marais, fait déborder le marais sur une distance égale à la ZdE, durée en années.
- `VDM 15 l.335` **[sort·nouveau]** Empreint de bruine — Nouveau sort (Magie du marais de Mòna, NI 9) : fait tomber une pluie gelée ; Test de Résistance Facile (+40) sous peine d'État Exténué, −2 DR aux tirs à poudre, sorts du Feu et entrée en Frénésie.
- `VDM 15 l.345` **[sort·nouveau]** Piqûres de moustiques — Nouveau sort (Magie du marais de Mòna, NI 5) : nuée de moustiques infligeant +2 Dégâts (Projectile magique) et Test de Résistance Accessible (+20) sous peine d'États Aveuglé + Exténué aux créatures à sang chaud.
- `VDM 15 l.355` **[sort·nouveau]** Tourner en rond — Nouveau sort (Magie du marais de Mòna, NI 4) : maudit une cible inconsciente du lancement, lui infligeant −3 DR à tous ses Tests d'Orientation dans un marais.
- `VDM 15 l.400` **[sort·nouveau]** Peau d'écorce et d'os — Nouveau sort à double lanceur (NI 1 Ghyran + NI 3 Ghur, deux sorciers différents le même Round) créé par les Quatre de Weissenberg : accorde +20 en Endurance à l'un des lanceurs.

### VDM 03 — Travaux arcaniques (31)

- `VDM 03 l.40` **[carriere·nouveau]** Alchimiste ordinaire — Nouvelle carrière de Lettrés (Nain/Halfling/Humain) : Rétameur Bronze 3 → Alchimiste Argent 2 → Maître Alchimiste Argent 3 → Transmutateur Or 1, avec schéma, compétences/talents/possessions par échelon.
- `VDM 03 l.144` **[carriere·nouveau]** Bedeau — Nouvelle carrière de Guerriers (garde d'institution savante) : Aide bedeau Argent 1 → Bedeau Argent 2 → Gardien des lieux Argent 4 → Terreur de la faculté Argent 5.
- `VDM 03 l.236` **[carriere·nouveau]** Devin — Nouvelle carrière de Ruraux (voit le passé par contact) : Hanté Bronze 1 → Devin Bronze 3 → Psychométricien Argent 2 → Rétrolecteur Or 1 ; possède Psychométrie de départ.
- `VDM 03 l.349` **[carriere·nouveau]** Magister Vigilant — Nouvelle carrière : sorcier-chasseur de renégats des Collèges (extraction FR partielle/brouillée des compétences/talents).
- `VDM 03 l.424` **[competence·nouveau]** Augure — Nouvelle Compétence Avancée (Int) de divination du futur : 1 Test/jour, versions Complexe (−10) pour autrui/Démonologie, résout via Tableau d'Augure + Tableau des Symboles (+1/−1 DR à un Test lié).
- `VDM 03 l.543` **[competence·nouveau]** Psychométrie — Nouvelle Compétence Avancée (Int) : lire un événement/pensée par contact ; chaque Test → Test de Résistance Accessible (+20) ou État Exténué ; humains uniquement.
- `VDM 03 l.584` **[competence·modifie]** Métier (Alchimiste) — Précise l'usage alchimique de la compétence existante (Basse et Haute Alchimie, tests de fabrication, renvoi au Tableau des Catastrophes de brassage sur Maladresse).
- `VDM 03 l.23` **[table-aleatoire·modifie]** Carrières aléatoires — Second lancer — Étend le tableau des Carrières aléatoires du LDB : second jet aiguillant Apothicaire→Alchimiste ordinaire, Sorcier→Magister Vigilant, Garde→Bedeau, Mystique→Devin.
- `VDM 03 l.33` **[regle-mecanique·nouveau]** 10 Compétences de départ — Variante de création : les carrières de ce livre offrent 10 compétences au niveau 1 (au lieu de 8), dont il faut en augmenter au moins 8.
- `VDM 03 l.129` **[regle-mecanique·nouveau]** Lancement de sorts pour les alchimistes — Restreint Magie mineure/Magie des Arcanes (Métal) à une liste de sorts fixe pour l'Alchimiste ordinaire ; nains et halflings ne peuvent pas les prendre.
- `VDM 03 l.445` **[table-aleatoire·nouveau]** Tableau d'Augure — Table DR→résultat (Succès Stupéfiant à Échec Stupéfiant) déterminant combien de lancers/choix sur le Tableau des Symboles et s'ils sont inversés.
- `VDM 03 l.461` **[table-aleatoire·nouveau]** Tableau des Symboles — Table d10 de symboles (Morrslieb, Morr, Ulric…) avec significations et Tests associés en version droite et inversée, socle des augures.
- `VDM 03 l.499` **[table-aleatoire·nouveau]** Table de Surincantation des Sorts d'Augure — Barème de DR dépensés en Surincantation → lancers/choix sur le Tableau des Symboles pour les sorts prophétiques Célestes.
- `VDM 03 l.491` **[regle-mecanique·modifie]** Sorts prémonitoires — Ajoute aux sorts Célestes existants (Ironie du Destin, Maudit, Signes d'Amul) l'option de dépenser des DR pour un jet sur le Tableau des Symboles ; Incantation Imparfaite peut infliger un symbole inversé.
- `VDM 03 l.571` **[table-aleatoire·nouveau]** Tableau du résultat de Psychométrie — Table DR→informations reçues (colonnes Général + exemple de cambriolage) ; Échec Stupéfiant octroie un point de Corruption.
- `VDM 03 l.483` **[objet-equipement·nouveau]** Thaumodivinator — Machine à augure d'Altdorf : 1 pistole → Test d'Intelligence Complexe (−10) à la place d'Augure (Accessible +20 si Lire/Écrire), résolu sur Tableaux d'Augure/Symboles.
- `VDM 03 l.516` **[objet-equipement·nouveau]** Liqueur de rêve — Vin narcotique interdit : Test de Résistance à l'alcool → visions ; octroie Sixième sens + Perception de la magie et +2 DR Intuition, mais Exposition Modérée à la Corruption et « l'appel ».
- `VDM 03 l.531` **[objet-equipement·nouveau]** Mystracine — Stupéfiant mâché : +10 E/FM, −10 Ag/I/Int, durée mâche +1d10×10 min ; permet un Test d'Intelligence Difficile (−20) au lieu d'Augure.
- `VDM 03 l.615` **[objet-equipement·nouveau]** Laboratoire alchimique portatif — Malle-atelier d'alchimiste (mortier, creusets, petite forge, verrerie, ingrédients) coûtant 12 CO ; sert de laboratoire portable.
- `VDM 03 l.592` **[activite·nouveau]** Alchimie ordinaire (Basse Alchimie) — Cadre d'artisanat via Métier (Alchimiste) + laboratoire ou Concocter : isoler des éléments, composés simples, magnétisme, optique, substances caustiques, et vente (Test de Ragot 1/jour).
- `VDM 03 l.692` **[activite·nouveau]** Haute Alchimie — Imprégner un matériau ordinaire de Chamon par Test étendu de Métier (Alchimiste) ; requiert Seconde vue ; Maladresse → 1d10+3 sur Tableau des Catastrophes de brassage.
- `VDM 03 l.646` **[autre·nouveau]** Tableau des Produits alchimiques — Table de données de fabrication (unités, coût matériaux bruts, temps, valeur marché, difficulté du Test de Ragot) pour argent, poudre noire, teintures, aimant, boussole, optique, etc.
- `VDM 03 l.674` **[objet-equipement·nouveau]** Poudre noire améliorée — Poudre supérieure : Temps de Recharge −1 (min 1) et Test de Projectiles (Poudre noire/Ingénierie) Intermédiaire pour ignorer un raté d'allumage.
- `VDM 03 l.680` **[objet-equipement·nouveau]** Boussole — Aiguille magnétisée : +2 DR aux Tests d'Orientation quand connaître le nord importe.
- `VDM 03 l.684` **[objet-equipement·nouveau]** Bésicles — Lunettes à poignées : +20 aux Tests de Langue (écriture minuscule/illisible) et +20 aux Tests de Perception (détails, compartiments secrets).
- `VDM 03 l.690` **[objet-equipement·nouveau]** Télescope — Lentilles sur tubes de cuivre : +20 aux Tests de Perception pour observer objets/formes éloignés.
- `VDM 03 l.629` **[objet-equipement·nouveau]** Substances caustiques/corrosives — Acides/alcalis alchimiques : lançables comme une bombe incendiaire, l'État En flammes obtenu étant une brûlure chimique.
- `VDM 03 l.706` **[objet-equipement·nouveau]** Al-kahest — Artefact de Haute Alchimie (solvant universel) : ronge portes/murs ; comme arme = bombe incendiaire infligeant 5 + DR États En flammes ; Test étendu Métier (Alchimie) Difficile totalisant 20 DR.
- `VDM 03 l.713` **[objet-equipement·nouveau]** Poudre alchimique de Leonardo — Poudre noire magique explosant à l'air : Dégâts +2 en arme à feu/explosif, mais tout Dégât d'Incident de tir aussi +2 ; Test étendu Métier (Alchimiste) Complexe 20 DR.
- `VDM 03 l.719` **[objet-equipement·nouveau]** Boussole d'argent météorique — Artefact indiquant la magie : +2 DR aux Tests d'Orientation pour localiser saturation Élevée/Extrême, appuis arcaniques, Tempêtes de Magie et autres phénomènes (ZdE 8 km).
- `VDM 03 l.727` **[objet-equipement·nouveau]** Prisme de pouvoir — Artefact isolant/substituant les Vents de Magie : attirer un vent d'une source de Dhar (Savoir (Magie) Complexe) ou altérer un vent par un autre (Très Difficile), Tests étendus.

### VDM 08 — Ulgu • Domaine des Ombres (30)

- `VDM 08 l.40` **[regle-mecanique·nouveau]** Focalisation (Ulgu) — modificateur météorologique — +1 DR aux Tests de Focalisation (Ulgu) par temps orageux/brumeux, −1 DR les jours ensoleillés ou par brise légère.
- `VDM 08 l.61` **[carriere·modifie]** Gardien Gris (Or 1) — Variante Ordre Gris d'un niveau de carrière de sorcier : compétences (Chevaucher, Évaluation, Recherche, Savoir Politique), talents (Baratiner, Diction instinctive, Imitation, Perception de la magie), possessions dédiées.
- `VDM 08 l.67` **[carriere·modifie]** Seigneur Gris (Or 2) — Variante Ordre Gris d'un niveau de carrière de sorcier : compétences (Langue au choix, Savoir au choix), talents (Discret, Identité Secrète, Mage de guerre, Tour des souvenirs), possessions dédiées.
- `VDM 08 l.115` **[table-aleatoire·nouveau]** Marques d'Ulgu (1d10) — Table 1d10 des marques/stigmates du Vent Gris (Confus, Manteau de brume, Vulnérabilité à l'ensoleillement, Aversion animale, Regard perturbant, Ombre obstinée, Fantoche, Lueur vacillante, Fantasmatique, Marque d'Ulgu), chacune octroyant malus/bonus de DR ou un Talent.
- `VDM 08 l.199` **[creature-pnj·nouveau]** Immanuel-Ferrand Holswig-Schliestein (Maître-espion humain, Or 4) — PNJ statblocké complet (profil, compétences, talents dont Magie des Arcanes Ombres, traits, possessions, sorts) — Grand Chancelier et Gardien Gris.
- `VDM 08 l.220` **[regle-mecanique·nouveau]** Attribut du Domaine des Ombres (Lore d'Ulgu) — Les Sorts de protection du Domaine octroient +20 aux Tests de Discrétion pendant leur Durée ; les Sorts du Domaine infligeant des Dégâts ignorent les Points d'Armure non magiques ; définit aussi les Composants (objets de dissimulation).
- `VDM 08 l.226` **[sort·nouveau]** Ailes grises — Sort du Domaine des Ombres (NI 6) — téléportation d'une cible/soi jusqu'à 100 m, +100 m par +2 DR ; cibles réticentes évitent par Esquive Facile.
- `VDM 08 l.238` **[sort·nouveau]** Bosquet d'Ombre — Sort du Domaine des Ombres (NI 5) — rend toutes les ombres visibles dans une ZdE, révèle invisibles/possédés ; attaques contre découverts à −10.
- `VDM 08 l.252` **[sort·nouveau]** Charme changeant — Sort du Domaine des Ombres (NI 4) — modifie l'apparence d'une cible (±10 Soc, faux mort, méconnaissable) ; résistance par Test opposé de FM.
- `VDM 08 l.268` **[sort·nouveau]** Chut ! — Sort du Domaine des Ombres (NI 3) — aura étouffant les sons, 3 formes au choix (sons ne sortent pas / n'entrent pas / aucun son produit).
- `VDM 08 l.284` **[sort·nouveau]** Corne d'Andar — Sort du Domaine des Ombres (NI 5) — alliés +2 DR Calme/Commandement, ennemis −2 DR et Test de Peur (1) immédiat.
- `VDM 08 l.297` **[sort·nouveau]** Danse du désespoir — Sort du Domaine des Ombres (NI 13) — force les ennemis à danser, blocage sauf Athlétisme Difficile ou Représentation (Danse) ; État Exténué en fin.
- `VDM 08 l.309` **[sort·nouveau]** Désorientation — Sort du Domaine des Ombres (NI 5) — désoriente une cible (Test de FM Intermédiaire) ; inclut une sous-table 1d10 de comportement (Confuse/Erre/Attaque/Ne fait rien/Se roule en boule).
- `VDM 08 l.329` **[sort·nouveau]** Destrier d'Ombre — Sort du Domaine des Ombres (NI 6) — invoque un cheval fantomatique (règles de cheval + traits Éthéré, Foulée, Furtif, etc. hors soleil), sans le trait Nerveux ; Dégâts de Chute à la fin si chevauché.
- `VDM 08 l.345` **[sort·nouveau]** Horreurs noires — Sort du Domaine des Ombres (NI 6) — ombre hantant une zone, Peur (1) sans attaquer, indice de Peur +1 par +2 DR (max 4) ; zone reste magiquement obscure.
- `VDM 08 l.355` **[sort·nouveau]** Illusion — Sort du Domaine des Ombres (NI 8) — image illusoire immobile trompant qui n'a pas Seconde vue ; déplaçable via Focalisation Difficile.
- `VDM 08 l.363` **[sort·nouveau]** Illusion grandiose — Sort du Domaine des Ombres (NI 14) — comme Illusion mais multisensorielle et interactive pour ceux qui y croient.
- `VDM 08 l.374` **[sort·nouveau]** Illusion rétroactive de Ribauld — Sort du Domaine des Ombres (NI 11) — téléporte un élément d'environnement (≤ taille d'une maison) jusqu'à FM mètres ; MJ arbitre le connu/rationnel.
- `VDM 08 l.386` **[sort·nouveau]** Jumeau maléfique — Sort du Domaine des Ombres (NI 10) — prend l'apparence d'un autre humanoïde familier ; Seconde vue le remarque par Intuition Complexe.
- `VDM 08 l.394` **[sort·nouveau]** Linceul d'Invisibilité — Sort du Domaine des Ombres (NI 8) — rend une cible invisible aux sens ordinaires ; prend fin si bruit/attaque ; Seconde vue par Perception Intermédiaire.
- `VDM 08 l.408` **[sort·nouveau]** Miasme mystifiant — Sort du Domaine des Ombres (NI 6) — brume octroyant Aveuglé/Assourdi/Exténué à ceux sans Magie des Arcanes (Ombres) ; À Terre si échec Perception ; Sonné si dissipé et échec Initiative.
- `VDM 08 l.420` **[sort·nouveau]** Ombre errante — Sort du Domaine des Ombres (NI 4) — détache son ombre (voir/entendre/sentir à distance, pas de sort) ; détruite hors lumière ou >44 m ; provoque Peur (1).
- `VDM 08 l.430` **[sort·nouveau]** Ombres étrangleuses — Sort du Domaine des Ombres (NI 6) — tentacules d'ombre au cou : +1 État Exténué, mutisme, règles de Suffocation.
- `VDM 08 l.442` **[sort·nouveau]** Perte de mémoire — Sort du Domaine des Ombres (NI 6) — efface le souvenir du lanceur chez la cible ; devient permanent si échec Test d'Intelligence Accessible en fin.
- `VDM 08 l.455` **[sort·nouveau]** Poches profondes — Sort du Domaine des Ombres (NI 5) — range un objet (Enc 0-1, +1 par +2 DR) dans une poche dimensionnelle invisible ; perdu si non retiré avant la fin.
- `VDM 08 l.465` **[sort·nouveau]** Pont des ombres — Sort du Domaine des Ombres (NI 6) — transporte un groupe de cibles volontaires par voie aérienne sur une bande d'ombre jusqu'à FM mètres.
- `VDM 08 l.479` **[sort·nouveau]** Portail d'Ombre — Sort du Domaine des Ombres (NI 8) — téléportation personnelle jusqu'à FM mètres ; ennemis Engagés reçoivent l'État Surpris.
- `VDM 08 l.489` **[sort·nouveau]** Puits de Tarnus — Sort du Domaine des Ombres (NI 8) — ouvre un puits sombre (Esquive pour éviter la chute) ; broie à 20 Dégâts et Suffocation à la fermeture.
- `VDM 08 l.499` **[sort·nouveau]** Substance de l'Ombre — Sort du Domaine des Ombres (NI 9) — rend une cible dans l'ombre invisible et intangible aux attaques matérielles ; se termine si elle sort de l'ombre.
- `VDM 08 l.515` **[sort·nouveau]** Traître de Tarn — Sort du Domaine des Ombres (NI 12) — force un ennemi à changer d'allégeance (Test opposé de FM) ; +2 DR Sociabilité sur cible neutre.

### VDM 11 — Ghur, Domaine de la Bête (30)

- `VDM 11 l.67-106` **[carriere·nouveau]** Chamane — Carrière du Collège d'Ambre à 4 niveaux (Apprenti Chamane Bronze 3, Chamane Argent 3, Maître Chamane Or 1, Seigneur Chamane Or 2) : liste de Compétences/Talents/Possessions propre à l'Ambre (Magie des Arcanes fixée à Bêtes, Emprise sur les animaux, Signes secrets (Ordre d'Ambre)…) ; nom propre absent du LDB (qui n'a que le générique Sorcier).
- `VDM 11 l.42-44` **[regle-mecanique·nouveau]** Focalisation (Ghur) — modificateurs d'environnement — Les Tests de Focalisation (Ghur) subissent −1 DR en ville, −2 DR en cité, +1 DR en pleine nature, +2 DR en région reculée ; +2 DR à Middenheim (Source de Ghur du Fauschlag).
- `VDM 11 l.243-245` **[regle-mecanique·republie]** Peur (1) après incantation d'un sort du Domaine de la Bête — Règle de Domaine : après un sort réussi du Domaine de la Bête, on peut gagner le Trait Peur (1) pendant 1d10 Rounds — re-donnée à l'identique au LDB (Magie des Couleurs).
- `VDM 11 l.536-562` **[regle-mecanique·nouveau]** Forme bestiale et autres Sorts de transformation (précisions) — Arbitrages sur les sorts de transformation : possessions/vêtements détruits (sauf bâton enchanté et robe magique infusés de Ghur), durée limitable à l'incantation, Blessures Critiques reportées en bras au retour, Compétences/Talents conservés mais pénalisés, aucun bénéfice des Augmentations de Caractéristiques (mais Augmentations de Compétences oui).
- `VDM 11 l.142-153` **[table-aleatoire·nouveau]** Marques de Ghur (1d10) — Table 1d10 de marques du Vent d'Ambre : Regard féroce, Claustrophobe, Agité, Sale, Poilu, Sauvage, Musc, Instincts de chasseur, Petits amis, Marque de Ghur (10 = octroie le Talent Empreint de Ghur).
- `VDM 11 l.218-238` **[creature-pnj·nouveau]** Gregor Martak — Statbloc complet Seigneur Chamane Humain (Or 2) : profil, Compétences, Talents (dont Empreint de Ghur, Détection d'artefact), Traits, Possessions, Marques et listes de sorts (patriarche pressenti de la Confrérie d'Ambre).
- `VDM 11 l.249-257` **[sort·nouveau]** Appeler une monture — NI 6 — invoque un animal sauvage non monstrueux comme monture ; Chevaucher temporaire égale à Langue (Magick).
- `VDM 11 l.259-280` **[sort·nouveau]** Bête indomptée — NI 4 — rend féroce un animal domestique ; à +4 DR, transforme un humain (Test de FM Complexe) avec table 1d10 de comportement (Distraite/Paniquée/Amicale/Enragée).
- `VDM 11 l.282-288` **[sort·nouveau]** Capuche vengeresse — NI 7 — capuche de lumière ambrée réduisant/redirigeant les attaques non magiques via Test de Calme (Dégâts −BFM+DR ; à 0, redirection).
- `VDM 11 l.290-298` **[sort·nouveau]** Éveil du bois — NI 8 — ZdE forestière : Projectile magique Dégâts +4 ; échec d'Esquive → +1 Hémorragique et +1 Empêtré (Force 30).
- `VDM 11 l.301-311` **[sort·modifie]** Forme bestiale — NI 5 — VDM ajoute le Mouvement à la liste des Caractéristiques remplacées par celles de la créature (LDB : seulement F/E/Agi/Dex).
- `VDM 11 l.313-321` **[sort·republie]** Incarnation de Wyssan — NI 8 — octroie 9 Traits (Arboricole, Arme +2, Armure 2, Belliqueux, Grand, Magique, Morsure +1, Peur 1, Rage) ; texte identique au LDB.
- `VDM 11 l.323-333` **[sort·republie]** La Lance d'Ambre — NI 8 — Projectile magique Dégâts +12 traversant, ignore PA cuir/fourrure, +1 Hémorragique ; identique au LDB.
- `VDM 11 l.335-343` **[sort·republie]** Langue bestiale — NI 3 — communiquer avec les créatures Bestial, +20 Emprise sur les animaux/Dressage ; identique au LDB.
- `VDM 11 l.345-351` **[sort·nouveau]** Les lunes du chasseur — NI 8 — ZdE : alliés gagnent +1 Mouvement et +10 en Force et Endurance.
- `VDM 11 l.353-363` **[sort·modifie]** Maître de la bête — NI 10 — VDM restreint la cible aux créatures Bestial ET de Taille Petite/Moyenne/Grande (LDB : toute créature Bestial, sans limite de Taille).
- `VDM 11 l.366-376` **[sort·nouveau]** Malédiction d'Anraheir — NI 5 — ZdE : ennemis −2 Mouvement et −20 CC/CT/Ag (−1/−10 hors zone) ; montures fuient sauf Test de Calme.
- `VDM 11 l.378-386` **[sort·nouveau]** Obstination du bœuf — NI 5 — ZdE alliée : retire DR+1 États Brisé, dispense des Tests de Peur/Terreur pendant la durée.
- `VDM 11 l.388-396` **[sort·republie]** Peau du chasseur — NI 6 — +20 Endurance, Traits Infravision et Peur (1), Talent Sens aiguisé (Odorat) ; contenu identique au LDB (y orthographié « Peau de chasseur »).
- `VDM 11 l.398-406` **[sort·nouveau]** Pelage d'hiver — NI 2 — immunité à l'Exposition au Froid, −10 aux Tableaux de Coups Critiques subis, mais −10 Agilité et Sociabilité.
- `VDM 11 l.408-418` **[sort·nouveau]** Régiment monstrueux de Merciw — NI 13 — ZdE alliée : +30 Force et Endurance (max 100) ; n'affecte pas le lanceur.
- `VDM 11 l.420-426` **[sort·modifie]** Serres d'ambre — NI 6 — VDM change la formule de Dégâts en DR + Bonus de Force + Bonus de Force Mentale (LDB : Bonus de Force Mentale seul) ; +1 Hémorragique conservé.
- `VDM 11 l.428-434` **[sort·nouveau]** Suivre le fumet — NI 4 — +20 Perception/Pistage à l'odorat (inclut Seconde vue pour sentir la magie) ; détecte Corruption et mutations.
- `VDM 11 l.436-448` **[sort·nouveau]** Transe ambrée — NI 4 — transforme une cible en statue d'ambre (Test de Calme Difficile) ; hibernation volontaire d'une saison possible.
- `VDM 11 l.451-467` **[sort·nouveau]** Transformation de Kadon — NI 14 — transformation en bête monstrueuse Grande/Énorme (listes selon type de sorcier) ; à +4 DR, Trait optionnel ou transformer autrui (Test opposé de FM).
- `VDM 11 l.469-475` **[sort·nouveau]** Traversée rapide — NI 4 — +1 Mouvement, Talents Grimpeur et Bon marcheur (terrain au choix), +10 pour éviter l'État Empêtré ; niveaux temporaires par +2 DR.
- `VDM 11 l.477-492` **[sort·nouveau]** Vaporisation de musc — NI 2 — au choix : marquer une cible (+2 DR pour la localiser) ou baliser un territoire repoussant les animaux sauvages.
- `VDM 11 l.494-509` **[sort·nouveau]** Ver frétillant — NI 4 — invoque un ver (Force 50) qui Empoigne et applique +1 Empêtré ; sur Test opposé gagné : +1 Empêtré ou dissout 1 PA de cuir.
- `VDM 11 l.511-521` **[sort·republie]** Vol du Destin — NI 8 — volée d'oiseaux en ZdE, +7 Dégâts/Round + État Aveuglé (sauf porteurs de Magie des Arcanes (Bête)) ; identique au LDB.
- `VDM 11 l.523-533` **[sort·nouveau]** Yeux de la meute — NI 3 — la cible voit par les yeux du lanceur sans limite de portée ; peut servir de Ligne de vue pour certains sorts (ex. Téléportation).

### VDM 12 — Artefacts magiques (58)

- `VDM 12 l.11` **[objet-equipement·nouveau]** Robe fonctionnelle — Robe de sorcier bon marché ; +1 DR à tout Test de Focalisation (Coût 1 CO, Enc 1, Rare).
- `VDM 12 l.11` **[objet-equipement·nouveau]** Robe ordinaire — Robe de sorcier ; +2 DR à tout Test de Focalisation (Coût 8 CO, Enc 2, Exotique).
- `VDM 12 l.11` **[objet-equipement·nouveau]** Robe élaborée — Robe de sorcier ostentatoire ; +3 DR à tout Test de Focalisation (Coût 30 CO, Enc 4, Exotique).
- `VDM 12 l.23` **[regle-mecanique·nouveau]** Malus de robe d'un Domaine non pratiqué — Un Sorcier portant une robe liée à un Domaine qu'il ne pratique pas subit −1 DR à tous ses Tests d'Incantation et de Focalisation.
- `VDM 12 l.40` **[objet-equipement·nouveau]** Bâton enchanté — Réduit de 1 le NI des Sorts du Domaine associé (min 0), y compris les Sorts d'Arcane ; utilisable comme bâton de combat ; bâton attirant Dhar = Exposition Mineure + Test contre Corruption/jour.
- `VDM 12 l.55` **[objet-equipement·nouveau]** Parchemin (magique) — Objet liant un sort ; le lire (Test Langue (Magick) Intermédiaire, ou Langue Difficile pour non-sorcier) lance le sort comme Action puis détruit le parchemin ; sorts toujours considérés lancés avec Composants.
- `VDM 12 l.71` **[activite·nouveau]** Écrire des parchemins — Procédé en jeu pour lier un sort à un parchemin : Talent Lire/Écrire + nécessaire d'écriture + Test étendu Savoir (Magie) Intermédiaire totalisant 20 DR, puis lancer le sort sans Incantation Imparfaite.
- `VDM 12 l.81` **[table-aleatoire·nouveau]** PARCHEMIN DE DOMAINE — Table d100 (2 jets) déterminant le Domaine et le NI maximum d'un sort de parchemin trouvé (Mineur→Magie du Chaos).
- `VDM 12 l.102` **[regle-mecanique·nouveau]** Lier un rituel à un parchemin — Procédé rare : Talent Lire/Écrire + Conditions/Composants + Test étendu Art (Écriture) Intermédiaire totalisant 40 DR ; le NI du rituel est doublé au lancement de gravure.
- `VDM 12 l.110` **[regle-mecanique·nouveau]** Potions magiques (caractéristiques et approches) — Système des potions : 4 approches (Magie/Alchimie/Herboristerie/Apothicairerie) et jeu de caractéristiques (Nom, Temps de réaction, Instabilité, Coûts, Difficulté, Temps de création, Effets).
- `VDM 12 l.157` **[regle-mecanique·nouveau]** Consommer des potions (détérioration) — À l'ingestion, jet sur le Risque de détérioration selon âge en saisons et DR de préparation ; potion complètement avariée vs gâtée mais efficace, résolu en un seul jet.
- `VDM 12 l.170` **[table-aleatoire·nouveau]** RISQUE DE DÉTÉRIORATION D'UNE POTION — Table croisant DR de préparation (0 à +6) × âge (1 à 17+ saisons) donnant % avariée/% gâtée ; −10 si Métier (Herboriste), +10 si Métier (Alchimiste).
- `VDM 12 l.185` **[table-aleatoire·nouveau]** EFFETS DE DÉTÉRIORATION D'UNE POTION — Table d100 par palier d'Instabilité (Mineure/Modérée/Majeure/Extrême) listant ~40 effets nommés (Fourmillements, Gale, Goitre, Hallucinations, Poison, Corruption, Mortel!, etc.), chacun avec ses propres règles.
- `VDM 12 l.322` **[table-aleatoire·nouveau]** TABLEAU DE PERTE SENSORIELLE — Table d10 déterminant le sens perdu (vue/ouïe/odorat/toucher/goût) pour l'effet de détérioration Perte sensorielle.
- `VDM 12 l.339` **[regle-mecanique·nouveau]** Préparer des potions (brassage) — Procédé : conditions (labo/ingrédients/compétence), recette, réunion d'ingrédients (achat ou Savoir (Herbes)), fenêtre de péremption, Test de brassage puis 1d10 doses (double sur Critique).
- `VDM 12 l.347` **[regle-mecanique·nouveau]** CONDITIONS POUR PRÉPARER DES POTIONS — Table des conditions par approche (labo/mortier+chaudron, ingrédients, Compétence Focalisation ou Métier Alchimiste/Herboriste/Apothicaire) ; coûts de laboratoire 50/100/200 CO et modificateurs de DR.
- `VDM 12 l.378` **[table-aleatoire·nouveau]** TEST DE BRASSAGE — Table croisant Compétence (Métier Alchimiste/Apothicaire/Herboriste ou Focalisation) × Instabilité, donnant la difficulté du Test de brassage.
- `VDM 12 l.374` **[regle-mecanique·nouveau]** Avantage de la Seconde vue au brassage — Un préparateur disposant du Talent Seconde vue bénéficie de +1 DR aux Tests de brassage.
- `VDM 12 l.423` **[table-aleatoire·nouveau]** CATASTROPHES DE BRASSAGE — Table 1d10+degrés d'échec (sur Maladresse) : de potion avariée à Grosse explosion (destruction du labo, 1d10+6 Dégâts) ; herboristes ignorent la destruction de labo.
- `VDM 12 l.411` **[talent·modifie]** Concocter — Nouvelles règles remplaçant la version existante : Maxi = Bonus d'Intelligence, Tests = Métier (Apothicaire) ou (Alchimiste) ; permet une Activité Artisanat/Brasser une potion GRATUITE sans atelier ni laboratoire.
- `VDM 12 l.421` **[activite·nouveau]** Brasser une potion — Activité dédiée à la préparation de potions (référencée par Concocter et le procédé de brassage).
- `VDM 12 l.399` **[objet-equipement·nouveau]** L'Ami débauché — Potion : réussite automatique de tout Test de Résistance à l'alcool pendant 1d10 heures (Instabilité Modérée).
- `VDM 12 l.438` **[objet-equipement·nouveau]** Concentré de pouvoir — Potion : réduit de moitié (arrondi sup.) le NI des Sorts et Rituels pendant 2d10 Rounds (Instabilité Extrême).
- `VDM 12 l.450` **[objet-equipement·nouveau]** Lotion capillaire — Potion : repousse abondante des cheveux sur une zone ; ingérée, cheveux dans la bouche = −2 DR aux Tests de Sociabilité (Instabilité Modérée).
- `VDM 12 l.464` **[objet-equipement·nouveau]** Musc de sanglier — Potion : perles d'huile nauséabonde = −2 DR aux Tests de Sociabilité et de Dextérité + gagne le Trait Perturbant (alliés et ennemis) pendant 1d10 heures (Instabilité Mineure).
- `VDM 12 l.478` **[objet-equipement·nouveau]** Nectar de beauté — Potion : corps/visage plus symétriques, disparition verrues/cicatrices ; +1 DR aux Tests de Sociabilité envers personnages attirés par sa race/genre, 3d10 heures (Instabilité Modérée).
- `VDM 12 l.490` **[objet-equipement·nouveau]** Nectar de véracité — Potion : besoin irrépressible de dire la vérité ; mentir exige un Test de Calme Difficile (−20), pendant 3d10 heures (Instabilité Modérée).
- `VDM 12 l.502` **[objet-equipement·nouveau]** Nectar de vitalité — Potion : confère le Trait de créature Régénération pendant 1d10 minutes (Instabilité Extrême).
- `VDM 12 l.516` **[objet-equipement·nouveau]** Panacea Universalis — Potion de soin : récupère 3× Bonus d'Endurance en PB, guérit États Hémorragique/Exténué, soigne certaines Blessures critiques et toute maladie (Test de Résistance) ; pas les Amputations.
- `VDM 12 l.528` **[table-aleatoire·nouveau]** GUÉRISON CRITIQUE DE LA PANACEA UNIVERSALIS — Table associant une Blessure critique (Fracture Mineure/Majeure, Déchirure musculaire Mineure/Majeure) à la difficulté du Test de Résistance qui la soigne.
- `VDM 12 l.542` **[objet-equipement·nouveau]** Potion d'invisibilité — Potion : invisibilité aux sens ordinaires 1d10 min ; Seconde vue à −2 DR ; attaque = cible Surprise puis Test Intelligence Complexe pour riposter à −3 DR CC/CT (Instabilité Extrême).
- `VDM 12 l.560` **[objet-equipement·nouveau]** Potion de divination — Potion : permet un Test d'Augure Facile (+40), à l'Intelligence si la Compétence est absente (Instabilité Extrême).
- `VDM 12 l.574` **[objet-equipement·nouveau]** Potion de focalisation — Potion : +2 DR à tous les Tests de Focalisation pendant 1d10 minutes (Instabilité Majeure).
- `VDM 12 l.586` **[objet-equipement·nouveau]** Potion de puissance — Potion : +2 aux Bonus de Force et d'Endurance et +2 DR aux Tests basés sur Force/Endurance pendant 1d10 heures (Instabilité Mineure).
- `VDM 12 l.598` **[objet-equipement·nouveau]** Potion de vol — Potion : confère le Trait de créature Vol (20) pendant 1d10 minutes (Instabilité Extrême).
- `VDM 12 l.612` **[objet-equipement·nouveau]** Tonifiant de lucidité — Potion : +1 DR aux Tests d'Intelligence/Force Mentale et immunité à l'État Exténué pendant 3d10 heures, après quoi 3 États Exténué (Instabilité Majeure).
- `VDM 12 l.627` **[regle-mecanique·nouveau]** Grimoires (utilisation) — Règles d'usage : lancer un sort non mémorisé double le NI ; grimoire = 4 Sorts ou 1 Rituel (NI ×2 sort / ×4 rituel), Lingua Praestantia, mains libres, retranscription via Lire/Écrire + Savoir (Magie).
- `VDM 12 l.658` **[table-aleatoire·nouveau]** TABLEAU D'INCANTATION IMPARFAITE DE GRIMOIRE — Table d100 s'ajoutant à l'Incantation Imparfaite normale sur Maladresse (mémorisation forcée + dégâts, dégâts, sort détruit, grimoire détruit).
- `VDM 12 l.702` **[table-aleatoire·nouveau]** Grimoires aléatoires — Table à 6 colonnes (Type, Nbre de Sorts, NI maxi, Domaine, Particularité 1, Particularité 2) pour générer un grimoire aléatoire.
- `VDM 12 l.673` **[objet-equipement·nouveau]** Les Écrits de Sedelmann — Grimoire nommé : une douzaine de Sorts du Domaine de la Vie ; chaque usage inflige une Exposition Mineure à la Corruption.
- `VDM 12 l.687` **[objet-equipement·nouveau]** Les Livres cachés de Chamon — Grimoire nommé, objet magique de plein droit : le texte n'est lisible que lorsque Chamon souffle fortement à proximité (encre réactive au vent).
- `VDM 12 l.695` **[objet-equipement·nouveau]** Le Tome de pouvoir de Krampi — Grimoire nommé : 13 Sorts très puissants dont certains sont des pièges ; Test de Savoir (Magie) Intermédiaire pour les repérer, échec = 1d10 + NI Dégâts à la tête (ignore PA).
- `VDM 12 l.721` **[objet-equipement·nouveau]** Pierres de pouvoir (propriétés) — Gemmes concentrant la magie : +3 DR au Test d'Incantation d'un Sort de la couleur associée (se désintègre) ; support de liaison d'élémentaires, de dispositifs magiques (sort stocké, +0 DR) et libération d'esprits liés.
- `VDM 12 l.729` **[table-aleatoire·nouveau]** Catalogue des pierres de pouvoir — Table données : 8 pierres nommées par Vent/Collège (Saphir véritable/Azyr, Mortegemme/Shyish, Ambrespectre/Ghur, Luminante/Hysh, Rubis igné/Aqshy, Pierre d'or/Chamon, Cristal de brume/Ulgu, Vitaellum/Ghyran).
- `VDM 12 l.786` **[qualite·nouveau]** Maudit (Atout) — Atout porté par tout objet maudit, qui le rend également Magique ; l'objet attire et est imprégné de Dhar (visible à la Seconde vue).
- `VDM 12 l.778` **[regle-mecanique·nouveau]** Objets maudits (Bienfait/Méfait/Déclencheur) — Cadre des objets maudits : chacun a un Bienfait (avantage), un Méfait (malédiction) et un Déclencheur (condition qui l'active).
- `VDM 12 l.796` **[objet-equipement·nouveau]** Arc d'empathie sanglante — Objet maudit : +20 Projectiles (Arc) ; sur attaque réussie à +2 DR ou moins, l'archer reçoit 1 État Hémorragique.
- `VDM 12 l.804` **[objet-equipement·nouveau]** Bottes du remords soudain — Objet maudit : pas silencieux et sans trace ; tout Test de Discrétion compte comme un Échec Stupéfiant (crissement), même bottes rangées/enlevées tant qu'on les transporte.
- `VDM 12 l.813` **[objet-equipement·nouveau]** Cotte de mailles de bravoure usurpée — Objet maudit : 3 PA (corps et bras) ; à chaque coup encaissé, Test de Calme de difficulté décroissante ; échec = fuir jusqu'à un Test de Force Mentale réussi, sans PA pendant la fuite.
- `VDM 12 l.827` **[objet-equipement·nouveau]** Dague voleuse de chance — Objet maudit : +20 Corps à corps (Base) ; retire 1 Point de Chance chaque fois qu'une frappe réussit avec +2 DR ou moins.
- `VDM 12 l.835` **[objet-equipement·nouveau]** Déchireur de sociabilité — Marteau maudit : +30 Corps à corps (Base) ; sur attaque réussie à +3 DR ou moins, bruit assourdissant = 1 Blessure à tous dans 6 m (Résistance Complexe ou Assourdi ; répétition = Hémorragique).
- `VDM 12 l.843` **[objet-equipement·nouveau]** Épée de retenue — Épée maudite : +20 Corps à corps (Base) et Atout Taille (détruit l'armure) ; sur attaque à +2 DR ou moins, l'épée se coince (Action + Test de Force Difficile pour la retirer).
- `VDM 12 l.857` **[objet-equipement·nouveau]** Fibule d'attraction non souhaitée — Objet maudit sans bienfait : inverse du Trait Protection ; sur coup raté, 1d10 = sur 7 le coup porte à +1 DR, +1 DR par point au-dessus de 7.
- `VDM 12 l.866` **[objet-equipement·nouveau]** Fléau d'attention non sollicitée — Fléau maudit : +10 Corps à corps (Fléau) ; les ennemis se liguent (2+ attaquants prioritaires avec bonus de surnombre) ; le porteur perd tous ses niveaux de Maîtrise du combat.
- `VDM 12 l.880` **[objet-equipement·nouveau]** Hache de fureur incessante — Hache maudite : confère le Talent Frénésie ; sur Blessures infligées, Test de Force Mentale (−10 cumulatif) ou Frénésie spéciale qui ne cesse pas (attaque l'être conscient le plus proche) tant que non désarmé/sonné/inconscient.
- `VDM 12 l.896` **[objet-equipement·nouveau]** Pistolet de solitude involontaire — Pistolet maudit : +20 Projectiles (Poudre noire) ; sur attaque à +2 DR ou moins, odeur infâme 24 h = −30 Sociabilité, PNJ évitants, Test de Résistance Difficile à 6 m ou vomir.
- `VDM 12 l.904` **[objet-equipement·nouveau]** Poings d'ignominie — Coups-de-poing maudits : Atout Empaleuse ; sur Coup critique, le porteur contracte automatiquement une maladie aléatoire (résorbée en 24 h après une interaction sociale gênante).
- `VDM 12 l.920` **[table-aleatoire·nouveau]** Maladie des coups-de-poing maudits — Table 1d10 associant le Coup critique des Poings d'ignominie à une maladie (Blessure Purulente, Vérole urticante, Courante galopante, Vérole du Tanneur, Flux sanglant).

### VDM 13 — Créatures magiques (17)

- `VDM 13 l.18-36` **[creature-pnj·nouveau]** Élémentaire incarné du Feu — Statblock complet (Énorme, Lanceur de sorts) avec règles propres : Descendre en cendres, Don du feu (poudre noire/En flammes), Lanceur de sorts décérébré (lance ses sorts avec la Force).
- `VDM 13 l.55-73` **[creature-pnj·nouveau]** Élémentaire incarné de la Mort — Statblock complet (serpentin bicéphale) avec règles propres : Dévoreur de vie, Brouillard d'Améthyste, Sablier de Shyish, Silencieux.
- `VDM 13 l.86-93` **[creature-pnj·nouveau]** Élémentaire incarné de la Bête — Statblock complet (Prédateur sanglant, Énorme) avec règle propre Hurlement de la Grande Bête (Attaque gratuite, Assourdi/Brisé).
- `VDM 13 l.172-180` **[creature-pnj·nouveau]** Bête des marais — Statblock de fabriqué (Increvable, Régénération, Instable) avec liste de Traits Facultatifs (Affamé, Frénésie, Parasité, Territorial).
- `VDM 13 l.246-258` **[creature-pnj·nouveau]** Familier de combat (statblock) — Bloc de PNJ pré-généré (Magique, Taille Petite) : Traits, Compétences, Talents, Possessions.
- `VDM 13 l.260-270` **[creature-pnj·nouveau]** Familier de pouvoir (statblock) — Bloc de PNJ pré-généré, doté du Talent Assistant magique, orienté soutien à l'incantation.
- `VDM 13 l.272-284` **[creature-pnj·nouveau]** Familier de sorts (statblock) — Bloc de PNJ pré-généré, lanceur de sorts (Focalisation, Magie mineure) ; jusqu'à 4 Sorts selon le Niveau de Carrière du maître.
- `VDM 13 l.461-485` **[talent·nouveau]** Empreint de (Vent) — Nouveau Talent (Maxi 1) : +1 DR aux sorts du Domaine associé dans 8 m, plus un effet spécifique par Vent (Frénésie via Aqshy, substitution de Focalisation à diverses Compétences selon le vent).
- `VDM 13 l.487-493` **[talent·nouveau]** Assistant magique — Nouveau Talent propre aux familiers de pouvoir : Soutien de +20 (au lieu de +10) aux Tests de Focalisation/Savoir (Magie)/Langue (Magick)/Recherche magique du maître.
- `VDM 13 l.557-595` **[carriere·nouveau]** Familier de combat (Carrière) — Nouvelle Carrière à 4 niveaux (Nouvellement créé, Familier de combat, Teigne en armure, Diablotin blindé) avec schéma de progression (CC/F/I) et listes de Compétences/Talents par niveau.
- `VDM 13 l.597-625` **[carriere·nouveau]** Familier de sorts (Carrière) — Nouvelle Carrière à 4 niveaux (Nouvellement invoqué, Familier de sorts, Diablotin énigmatique, Sorcelin) avec schéma de progression (Dex/Int/FM) ; les familiers de pouvoir suivent cette évolution sans apprendre de Sorts.
- `VDM 13 l.362-554` **[race-espece·nouveau]** Familier (Personnage jouable) — Cadre de création d'un familier-Joueur : tables de génération des Caractéristiques (combat/sorts), allocation Compétences/Talents, création via le Vent du créateur, langues, Classe/Statut, Possessions/Encombrement doublé, Corruption, Dégâts & soins, alimentation, Trait Magique — sous-espèce à part entière liée à un sorcier créateur.
- `VDM 13 l.203-210` **[table-aleatoire·nouveau]** Domaines et familiers — Table de correspondance Domaine → apparence habituelle + catégorie(s) de familier autorisées (combat/pouvoir/sorts).
- `VDM 13 l.231-243` **[table-aleatoire·nouveau]** Personnalité du familier — Table d10 × 8 Vents (Aqshy…Ulgu) donnant un trait de personnalité de familier par jet et par vent.
- `VDM 13 l.95-99` **[trait·republie]** Redoutable (Indice) — Encadré redonnant le fonctionnement du Trait Redoutable (regagne ses Avantages manquants en début de tour ; alimente la réserve adverse avec les règles Aux armes !).
- `VDM 13 l.508-514` **[regle-mecanique·modifie]** Les familiers et les États — Change l'application des États aux familiers : Empreint d'Aqshy annule En flammes (feu non magique + feu du Domaine du Feu) ; immunité à Empoisonné/Exténué/Hémorragique sauf source magique ; autres États normaux.
- `VDM 13 l.286-290` **[regle-mecanique·nouveau]** Améliorer un familier (familiers PNJ) — Le sorcier peut dépenser son PX pour améliorer les Caractéristiques/Compétences/Talents de son familier PNJ (pas deux fois le même point) ; les familiers de pouvoir empruntent l'évolution des familiers de sorts sans apprendre de Sorts.

### VDM 14 — Les Vents à l'œuvre (31)

- `VDM 14 l.13-26` **[regle-mecanique·nouveau]** Saturation environnementale — Nouveau système à 5 niveaux (Basse/Normale/Élevée/Extrême/Corrompue) modifiant les Tests d'Incantation/Focalisation (−1 à +2 DR selon Domaine dominant) et progressant d'1 niveau/an.
- `VDM 14 l.34` **[table-aleatoire·nouveau]** Effets de Saturation environnementale (par Vent) — Table de référence listant, pour les 8 Vents, les environnements sensibles, les Effets de Saturation (italique/gras=Extrême) et les surnoms populaires.
- `VDM 14 l.37-45` **[regle-mecanique·nouveau]** Corruption environnementale — Règle : une zone de Saturation Extrême a 10% d'être corrompue à Geheimnisnacht/Hexensnacht ; le MJ choisit corruption chaotique (+1 DR Magie du Chaos) ou nécromantique (+1 DR Magie noire).
- `VDM 14 l.47-58` **[table-aleatoire·nouveau]** Tableau de Corruption chaotique — Nouvelle table d100 (lancée deux fois) de manifestations de corruption chaotique du paysage.
- `VDM 14 l.64-75` **[table-aleatoire·nouveau]** Tableau de Corruption nécromantique — Nouvelle table d100 (lancée deux fois) de manifestations de corruption nécromantique du paysage.
- `VDM 14 l.86-116` **[regle-mecanique·nouveau]** Tempêtes de Magie — Nouvel événement : +2 DR aux Tests d'Incantation, Incantation Critique garantie sur le Domaine du Flux, +1 niveau de Saturation, et 2d10 d'effets de Surincantation par sort lancé.
- `VDM 14 l.96-107` **[table-aleatoire·nouveau]** Flux magique (Tempête de Magie) — Table 1d10 déterminant chaque Round le Domaine bénéficiant de l'Incantation Critique pendant une Tempête de Magie.
- `VDM 14 l.118-137` **[regle-mecanique·nouveau]** Lignes de force (naturelles / artificielles) — Définit les deux types de lignes telluriques : +1 DR Incantation à proximité ; naturelle = +1 niveau Saturation/an, artificielle = réduit la Saturation (Grand Vortex).
- `VDM 14 l.150-154` **[regle-mecanique·nouveau]** Pierre gardienne — Attraction — Propriété de pierre gardienne : chaque parement attire une ligne de force et crée une Jonction tellurique (saturée si l'écoulement est interrompu).
- `VDM 14 l.156-161` **[regle-mecanique·nouveau]** Pierre gardienne — Réfraction — Propriété : +1 DR Focalisation pour les Domaines des collèges impériaux, −1 DR aux autres (limité aux vents réfractés si direction précise).
- `VDM 14 l.163-167` **[regle-mecanique·nouveau]** Pierre gardienne — Atténuation — Propriété : −2 DR aux Tests d'Incantation à proximité mais +2 DR aux Tests de Dissipation ; empêche les Jonctions telluriques de saturer.
- `VDM 14 l.169-173` **[regle-mecanique·nouveau]** Pierre gardienne — Isolation — Propriété : la Saturation environnementale et la Corruption ne se propagent pas dans les lignes créées par des pierres d'isolation.
- `VDM 14 l.175-179` **[regle-mecanique·nouveau]** Pierre gardienne — Amplification — Propriété : +2 DR aux Tests d'Incantation à proximité ; hors ligne opérationnelle, +1 niveau de Saturation/an.
- `VDM 14 l.182-187` **[regle-mecanique·nouveau]** Cercle d'oghams (pierre d'ogham) — +1 DR Incantation/Focalisation pour le Domaine de la Vie et la Magie naturelle dans le cercle ; peut recevoir une propriété de pierre gardienne.
- `VDM 14 l.206-212` **[regle-mecanique·nouveau]** Grand Vortex — Règle : diminue la Saturation environnementale de −1 niveau/an dans toute région traversée par des lignes de force artificielles.
- `VDM 14 l.215-231` **[regle-mecanique·nouveau]** Corruption des lignes de force et pierres gardiennes — Règle : lignes de Dhar (+1 DR Sorcellerie/Magie noire/Chaos, Influence malveillante) et effet de la corruption sur chaque propriété de pierre (réserve de Dhar en 1 jour à 1 semaine).
- `VDM 14 l.233-243` **[regle-mecanique·nouveau]** Nexus de puissance / Jonction tellurique — Règle : bonus d'Incantation +1 à +3 DR selon le nombre de lignes entrantes (réduit par des pierres d'Atténuation) ; permet de créer des pierres de pouvoir.
- `VDM 14 l.245-249` **[regle-mecanique·nouveau]** Toile Géomantique (nexus géomantique) — Règle : maillage tellurique naturel invisible ; +2 DR aux Tests de Focalisation à un nexus géomantique.
- `VDM 14 l.252-260` **[regle-mecanique·nouveau]** Appui arcanique / Jonction saturée — Règle : +2 à +8 DR Incantation, Incantation Critique doublée (doubles ou finissant par 0), +1 niveau Saturation/mois, devient réserve de Dhar en 1 an.
- `VDM 14 l.262-266` **[regle-mecanique·nouveau]** Faille du Warp — Règle : bonus d'Incantation aléatoire +1 à +5 DR (1d10/2) par Round, Influence malfaisante, nombre de démons invoqués doublé, +1 niveau Saturation/mois.
- `VDM 14 l.268-272` **[regle-mecanique·nouveau]** Portail magique — Règle : traité comme une faille du Warp mais ne produit qu'une couleur de magie et n'est pas une Influence malfaisante.
- `VDM 14 l.274-279` **[regle-mecanique·nouveau]** Corruption des Nexus de puissance et Appuis arcaniques — Règle Morrslieb pleine : les jonctions saturées deviennent réserves de Dhar (annulent le Trait Instable, +2 DR Sorcellerie/Magie noire/Chaos, Influence malfaisante) ; les failles du Warp deviennent des portails du Chaos.
- `VDM 14 l.282-305` **[table-aleatoire·republie]** Résumé des phénomènes arcaniques — Tableau récapitulatif consolidant les modificateurs d'Incantation/Focalisation/Saturation de tous les phénomènes ci-dessus (aucune règle nouvelle).
- `VDM 14 l.324` **[regle-mecanique·nouveau]** La Forge de Henoth (chambre des travaux) — Site à Chamon déferlant : +2 DR Incantation mais −2 DR Focalisation pour le Domaine du Métal ; toute Incantation Imparfaite mineure passe sur le Tableau des Marques arcaniques de Chamon.
- `VDM 14 l.339` **[creature-pnj·nouveau]** Elsie (génisse de plomb) — PNJ statblocké : minotaure (WFJDR p.332) avec les Traits Champion, Peur (2) et Rage, plus 4 Points d'Armure à toutes les Localisations.
- `VDM 14 l.353` **[regle-mecanique·nouveau]** La Taverne d'Uli / Arène des Débats — Site à Aqshy : jusqu'à +3 DR aux Sorts du Domaine du Feu ; le NI du Sort L'Épée ardente de Rhuin est réduit de 2 sur les lames forgées ici.
- `VDM 14 l.408` **[regle-mecanique·nouveau]** Le Labyrinthe de l'Ombre (Pierres de Barbaneagra) — Site à Ulgu : +2 DR aux Tests d'Incantation et de Focalisation pour les Sorts du Domaine des Ombres.
- `VDM 14 l.437` **[regle-mecanique·nouveau]** La Haute Loge / L'Attache — Site à Ghur : jusqu'à +2 DR Domaine de la Bête ; dans la caverne NI réduit de moitié et Durée doublée ; à l'Attache, Forme bestiale et Incarnation de Wyssan peuvent cibler d'autres que le lanceur.
- `VDM 14 l.452-454` **[objet-equipement·nouveau]** Miroir de la nécromancienne — Artefact (autel d'obsidienne, outil de divination + portail magique) : permet le Sort Dernières paroles (WFJDR p.251) et un Test de Psychométrie Difficile (−20) pour voir à travers le temps (Intelligence à défaut de la compétence).
- `VDM 14 l.454` **[regle-mecanique·nouveau]** Le Val de la Nécromancienne — Site à Shyish+Dhar : chaque heure impose un Test de Force Mentale Intermédiaire (+0), un échec octroie l'État Exténué (retiré par 1 Point de Détermination ou une journée de repos hors du val).
- `VDM 14 l.489-491` **[regle-mecanique·nouveau]** Le Complexe Cairnapan — Site à Ghyran : NI des Rituels utilisant Ghyran réduit de moitié ; on peut y trouver comment lancer le Sort Racines de la colère (forme plus puissante du Sort Êtres du dessous).

