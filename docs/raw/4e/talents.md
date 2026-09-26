# Atlas RAW — Talents

> Fichier de reference genere le 2026-06-20, complete le 2026-06-20. Source: `src/data/talents.json` (177 entrees) + textes sources lus et verifies.
> **Corrections apportees** : source `empreint-de-la-magie` = EDOC 13 p.79 (pas LDB) ; source `empreint-d-ulgu` = NADJ 15 p.88 (pas LDB) ; ajout Sang Neuf (ADE I) ; description Vice complete.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

---

## SECTION A --- LDB Talents (Livre de Base)

> Source : `Source/Warhammer v4 - Livre de base version corrigee/10 - Talents.md` + `11 - _3znysh7.md`
> Chapitres PDF p.134-150. 169 talents LDB dans talents.json.

### Presentation

Alors que les Caracteristiques representent votre potentiel brut, et les Competences votre entrainement et votre experience, les Talents regroupent toutes les astuces, particularites et capacites speciales apprises au cours de votre vie.

**Gagner des Talents** : Pendant la creation de votre Personnage, vous aurez automatiquement recu un ensemble de Talents. Par la suite, vous pouvez utiliser les Points d'Experience (PX) pour en acquerir de nouveaux, ou prendre plusieurs fois ceux que vous possedez deja, si cela est autorise, dans le Schema de progression de votre Carriere.

Si vous pouvez prendre plusieurs fois un meme Talent, une regle speciale en expliquant la raison peut etre indiquee dans sa description. Vous pouvez, en outre, y trouver une Competence associee indiquee, sous "Tests". Si c'est le cas, chaque fois que vous possedez ce Talent, vous gagnez +1 DR a chaque usage reussi d'une Competence liee a ce Talent.

---

### Acrobaties équestres
**Source :** LDB 10 p.132  
**Maxi :** Bonus d'Agilité  
**Tests :** Tests d'Esquive à cheval, Chevaucher (Cheval)  

Vous êtes capable de prouesses incroyables à cheval. Vous pouvez utiliser n'importe laquelle de vos Compétences Représentation, et Esquive non modifiée, quand vous êtes à cheval. De plus, quand vous êtes en selle, vous pouvez effectuer votre Mouvement au début du Round au lieu de votre Tour.

### Affable
**Source :** LDB 10 p.132  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique Sociabilité de départ (qui ne compte pas comme des Augmentations).

### Affinité avec les animaux
**Source :** LDB 10 p.132  
**Maxi :** Bonus de Force Mentale  
**Tests :** Emprise sur les animaux  

Les animaux sauvages se sentent en confiance en votre présence, et ont tendance à vous suivre. Toutes les créatures avec le Trait Bestial non dressées à être agressives seront automatiquement calmes en votre présence, à moins qu'elles n'aient une raison de ne pas l'être, comme la douleur, une attaque, une hyper agressivité naturelle ou un jeune à proximité.

### Ambidextre
**Source :** LDB 10 p.132  
**Maxi :** 2  

Vous pouvez utiliser votre main non directrice bien mieux que la plupart des gens, grâce à votre entraînement ou à un talent inné. Vous subissez seulement une pénalité de -10 aux Tests reposant uniquement sur votre main secondaire au lieu de -20. Si vous possédez deux fois ce Talent, vous ne subissez aucune pénalité.

### Âme pure
**Source :** LDB 10 p.132  
**Maxi :** Bonus de Force Mentale  

Votre âme est pure, très résistante aux déprédations du Chaos. Vous pouvez gagner un nombre de Points de Corruption supplémentaires égal à votre niveau d'Âme pure avant d'avoir à effectuer un Test pour savoir si vous êtes corrompu.

### Artilleur
**Source :** LDB 10 p.132  
**Maxi :** Bonus de Dextérité  

Vous pouvez recharger avec facilité les armes à Poudre noire. Ajoutez un DR égal à votre niveau d'Artilleur à n'importe quel Test étendu pour recharger une arme à Poudre noire.

### Artiste
**Source :** LDB 10 p.132  
**Maxi :** Bonus de Dextérité  
**Tests :** Art (Au choix)  

Vous possédez un talent naturel pour l'art, et vous pouvez produire des dessins précis avec un peu de temps et le support approprié. Cette capacité offre plusieurs usages dans le jeu, allant de la création d'avis de recherche à l'illustration de journaux spécialisés, et présente des Avantages spécifiques déterminés par le MJ. Ajoutez également Art (Au choix) à n'importe quelle Carrière que vous entamez ; si c'est déjà inclus dans la Carrière, vous pouvez à la place acheter la Compétence pour 5 PX de moins par Augmentation.

### Assaut féroce
**Source :** LDB 10 p.132  
**Maxi :** Bonus d'Agilité  
**Tests :** Corps à corps quand vous effectuez des attaques supplémentaires  

Vos coups se succèdent rapidement et pleuvent sur vos adversaires avec la fureur d'Ulric. Une fois par Round, si vous touchez un adversaire en combat rapproché, vous pouvez immédiatement dépenser un Avantage ou votre Mouvement pour effectuer une attaque supplémentaire (en supposant qu'il vous reste votre Mouvement).

### Attirant
**Source :** LDB 10 p.132  
**Maxi :** Bonus de Sociabilité  
**Tests :** Test de Charme pour influencer ceux qui vous trouvent attirant.  

Que ce soit votre regard perçant, votre corps musclé, ou peut- être l'éclat de vos dents parfaites, vous savez comment utiliser au mieux ce que les dieux vous ont offert. Quand vous réussissez à utiliser Charme pour influencer ceux qui vous trouvent Attirant, vous pouvez choisir d'utiliser soit le DR de votre lancer, soit le nombre des unités obtenu sur votre dé. Donc, une réussite de 63 peut être utilisée comme un DR de +3. 

### Baratiner
**Source :** LDB 10 p.133  
**Maxi :** Bonus de Sociabilité  
**Tests :** Charme pour Baratiner  

Appelé « parler à tort et à travers » dans le Nordland, ou simplement « raconter des âneries » au Ostland, Baratiner consiste à parler rapidement de façon incessante, ou parler longuement de façon volubile, en parlant de choses sans importance ou n'ayant aucun sens, pour embrouiller et déconcerter verbalement une cible. Vous utilisez votre Compétence Charme pour Baratiner. Tentez un Test opposé Charme/Intelligence. Un succès donne à votre adversaire un État Sonné. De plus, pour chaque niveau que vous possédez dans ce Talent, votre adversaire gagne un État Sonné supplémentaire. Les cibles Sonnées grâce à Baratiner ne peuvent rien faire d'autre que vous regarder, médusées et essayant de suivre ou de comprendre ce que vous racontez. Une fois que le dernier État Sonné touche à sa fin, la cible peut enfin placer un mot, et peut ne pas être très contente de vous. Après tout, vous avez parlé de choses sans importance ou n'ayant aucun sens pendant assez longtemps. Si vous arrêtez de parler, votre adversaire perd imm��diatement tout État Sonné causés par votre Talent Baratiner. En général, vous ne pouvez tenter de Baratiner un Personnage qu'une seule fois par scène, ou plus longtemps (le MJ détermine ce point), car la cible ne tarde pas à prendre conscience de vos simagrées.

### Battement
**Source :** LDB 10 p.133  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps pour effectuer une manœuvre de Battement  

Vous êtes entraîné à effectuer des frappes précises contrôlées sur l'arme de votre adversaire, créant une ouverture pour une attaque ou empêchant simplement une attaque de vous atteindre. Pour votre Action, vous pouvez choisir Battement avant de lancer les dés. Effectuez un Test de Corps à corps ; sur un succès, votre adversaire perd -1 Avantage et -1 de plus par DR que vous avez obtenu. Ce Test n'est pas opposé. Ce Talent est inutile si votre adversaire ne porte pas d'arme, ou est d'une Taille supérieure à la vôtre (voir page 342).

### Béni
**Source :** LDB 10 p.133  
**Maxi :** 1  

Vous êtes protégé par l'un des dieux et vous pouvez intensifier le pouvoir de simples Prières. Vous pouvez à présent utiliser les Bénédictions de votre divinité listées au Chapitre 7 : Religions et Croyances. Dans des conditions normales, vous ne pouvez connaître qu'un seul Savoir divin pour le Talent Béni.

### Bon marcheur
**Source :** LDB 10 p.133  
**Maxi :** Bonus d'Agilité  
**Tests :** Tests d'Athlétisme pour traverser le Terrain  

Vous êtes expérimenté dans la traversée de terrains difficiles. Vous ignorez toutes les pénalités de Mouvement lorsque vous traversez un terrain spécifique. Les spécialisations courantes incluent : Littoral, Déserts, Marécages, Rocailleux, Toundra, Régions boisées.

### Bonnes jambes
**Source :** LDB 10 p.133  
**Maxi :** Bonus de Force  

Vous avez des jambes solides capables de vous porter sur de grandes distances quand vous sautez. Ajoutez votre niveau de Bonnes jambes à votre DR à tous les Tests d'Athlétisme impliquant Saut (voir page 166).

### Bricoleur
**Source :** LDB 10 p.133  
**Maxi :** Bonus de Dextérité  
**Tests :** Tests de Métier pour réparer des objets cassés  

Vous êtes une sorte de touche-à-tout, capable de réparer presque n'importe quoi. Vous considérez toutes les Compétences Métier non magiques comme étant de Base lorsque vous réparez des objets cassés.

### Brouet
**Source :** LDB 10 p.133  
**Maxi :** Bonus d'Endurance  
**Tests :** Tests de Résistance pour résister à la faim  

Vous avez l'habitude de vous débrouiller avec peu, et savez comment survivre aux périodes de vache maigre. Vous pouvez subsister avec la moitié de la nourriture nécessaire sans pénalités négatives (vous empêchant d'avoir réellement faim), et vous avez seulement besoin d'effectuer un Test concernant la faim tous les 3 jours et pas 2 (voir page 181).

### Caïd
**Source :** LDB 10 p.134  
**Maxi :** 1  

Vous avez réussi à conserver une apparence respectable malgré vos méfaits. Vous pouvez ignorer le Statut perdu à cause du Talent Criminel.

### Cavalier émérite
**Source :** LDB 10 p.134  
**Maxi :** Bonus d'Agilité  
**Tests :** Chevaucher (Cheval) pendant les combats  

Vous êtes à l'aise en selle même dans les situations les plus difficiles, et savez comment tirer le meilleur de votre monture pendant les conflits. En supposant que vous possédez la Compétence Chevaucher, vous pouvez directement demander à votre monture d'effectuer une Action, pas seulement un Mouvement, sans Test de Chevaucher.

### Chanceux
**Source :** LDB 10 p.134  
**Maxi :** Bonus de Sociabilité  

On prétend que lorsque vous êtes né, Ranald a souri. Votre maximum de Points de Chance est à présent égal à votre nombre actuel de Points de Destin, plus le nombre de fois que vous avez pris Chanceux.

### Charge berserk
**Source :** LDB 10 p.134  
**Maxi :** Bonus de Force  
**Tests :** Corps à corps sur un Round lorsque vous effectuez une Charge berserk  

Vous vous précipitez sur vos ennemis avec une témérité sans bornes, utilisant la force de votre charge pour ajouter du poids à vos frappes. Lorsque vous effectuez une Charge berserk, vous infligez +1 point de Dégât par niveau dans ce Talent à toutes les attaques de Corps à corps.

### Chat de gouttière
**Source :** LDB 10 p.134  
**Maxi :** Bonus d'Initiative  
**Tests :** Discrétion (Urbaine)  

Vous êtes à l'aise dans les ruelles sombres. Quand vous utilisez Discrétion (Urbaine), vous pouvez inverser le lancer de n'importe quel Test raté si cela entraîne un Succès.

### Chirurgie
**Source :** LDB 10 p.134  
**Maxi :** Bonus d'Intelligence  
**Tests :** Tests de Guérison en dehors des Rounds de combat ; quand vous avez le temps de le faire correctement.  

Vous êtes un chirurgien, capable d'ouvrir et de refermer les chairs pour soigner. Vous pouvez traiter n'importe quelle Blessure Critique nécessitant de la Chirurgie. Vous pouvez aussi pratiquer une Chirurgie pour résoudre des problèmes internes avec un Test étendu de Guérison Intermédiaire (+0) dont le DR cible est déterminé par le MJ (en général 5-10) en fonction de la difficulté de la procédure en cours. Cela cause 1d10 Blessures et 1 État Hémorragique par Test, ce qui signifie que la Chirurgie a de fortes chances de tuer le patient si le praticien n'est pas rigoureux. Après la Chirurgie, le patient doit réussir un Test de Résistance Accessible (+20) ou gagner une Infection Mineure (voir page 187).

### Claquer le fouet
**Source :** LDB 10 p.134  
**Maxi :** Bonus de Dextérité  
**Tests :** Tests de Conduite d'attelage ou de Chevaucher quand vous Fuyez ou lors d'une Course.  

Vous savez comment tirer le meilleur parti de vos animaux. Lorsque l'un des animaux que vous contrôlez Fuit ou Court , il gagne +1 en Mouvement si vous utilisez un fouet.

### Cœur vaillant
**Source :** LDB 10 p.134  
**Maxi :** Bonus de Force Mentale  
**Tests :** Tests de Calme pour retirer les États Brisé  

Peu importe à quel point les choses vont mal, vous persévérez malgré tout. Vous pouvez tenter un Test de Calme pour retirer un État Brisé à la fin de chacun de vos Tours ainsi qu'à la fin du Round (voir page 168 pour plus de détails).

### Combat déloyal
**Source :** LDB 10 p.134  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps (Bagarre)  

Vous avez appris tous les coups bas du combat à mains nues. Vous pouvez choisir d'infliger +1 Dégât supplémentaire pour chaque niveau de Combat déloyal, pour tous les coups réussis avec Corps à corps (Bagarre).<br><br><b>Remarque:</b> utiliser ce Talent sera considéré comme une tricherie dans tout combat officiel.

### Combat instinctif
**Source :** LDB 10 p.134  
**Maxi :** Bonus d'Initiative  

Vous réagissez aussi vite que l'éclair. Votre Initiative est plus élevée de 10 pour déterminer l'Initiative de Combat pour chaque niveau que vous possédez dans ce Talent.

### Combattant au contact
**Source :** LDB 10 p.134  
**Maxi :** Bonus de Dextérité  
**Tests :** Corps à corps quand vous combattez au contact ou que vous allez au contact  

Vous êtes entraîné à vous placer très près d'un adversaire. Vous ne subissez aucune pénalité pour vous battre contre un adversaire avec une arme plus longue que la vôtre. De plus, si vous utilisez les règles optionnelles de Combat au contact (voir page 297), gagnez un bonus de +10 pour toucher votre adversaire. 

### Combattant en espace clos
**Source :** LDB 10 p.135  
**Maxi :** Bonus d'Agilité  
**Tests :** Esquive dans des environnements clos  

Vous avez appris à tirer le meilleur parti des combats en espace clos. Vous ignorez les pénalités de Corps à corps causées par les espaces confinés, comme les tunnels, les lignes de front, les petites fosses de combat et endroits similaires, et vous pouvez utiliser la Compétence Esquive, même si c'est normalement impossible à cause du manque d'espace.

### Concocter
**Source :** LDB 10 p.135  
**Maxi :** Bonus d'Intelligence  
**Tests :** Savoir (Apothicaire)  

Vous êtes doué pour la fabrication de potions, de philtres et de décoctions. Vous pouvez effectuer gratuitement une Activité Artisanat pour utiliser Savoir (Apothicaire) sans avoir besoin d'Atelier. Les autres Activités Artisanat suivent les règles normales.

### Contorsionniste
**Source :** LDB 10 p.135  
**Maxi :** Bonus d'Agilité  
**Tests :** Représentation et Agilité quand vous vous aidez de Contorsionniste  

Vous pouvez plier votre corps en une myriade de positions apparemment anormales. Cela vous permet de vous glisser dans des espaces improbables et de manipuler votre corps de façon incroyable, vous offrant des Avantages accordés par le MJ, avec éventuellement un Test d'Agilité réussi.

### Contrôle de la Frénésie
**Source :** LDB 10 p.135  
**Maxi :** Bonus de Force Mentale  
**Tests :** Tests de Corps à corps quand vous êtes en Frénésie  

Vous êtes davantage en mesure de contrôler votre Frénésie en combat. Vous pouvez y mettre fin avec un Test de Calme réussi à la fin du Round.

### Coopératif
**Source :** LDB 10 p.135  
**Maxi :** Bonus de Sociabilité  
**Tests :** Tests sociaux pour influencer un supérieur  

Vous savez ce qu'il faut dire et à quel moment pour avoir le plus d'impact sur vos supérieurs. Quand vous utilisez avec succès une Compétence sociale pour influencer ceux qui possèdent un plus haut Statut, vous pouvez choisir d'utiliser soit le DR, soit le chiffre des Unités du dé. Donc, un succès de 46 peut être utilisé comme un DR de +6.

### Costaud
**Source :** LDB 10 p.135  
**Maxi :** Bonus de Force  
**Tests :** Tests de Force quand vous soulevez  

Vous êtes musclé et habitué à porter des charges lourdes. Augmentez les Points d'Encombrement d'un nombre égal à votre niveau de Costaud x 2.

### Coude-à-coude
**Source :** LDB 10 p.135  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps quand vous vous trouvez à côté d'un allié avec Coude-à-coude  

Vous avez été formé à combattre côte à côte avec d'autres soldats. Si un ennemi vous fait perdre des Avantages alors qu'il se tient à côté d'un allié actif possédant le Talent Coude-à- coude, vous pouvez conserver 1 Avantage perdu pour chaque fois que vous avez pris le Talent Coude-à-coude. 

### Coup puissant
**Source :** LDB 10 p.135  
**Maxi :** Bonus de Force  

Vous savez comment frapper fort ! Vous infligez votre niveau de Coup puissant en Dégâts supplémentaires avec des armes de Corps à corps.

### Criminel
**Source :** LDB 10 p.135  
**Maxi :** Aucun  

Vous êtes un criminel actif qui gagne de l'argent grâce à des sources illégales, et vous n'êtes pas toujours discret à ce sujet. Pour calculer vos revenus, que ce soit quand vous Gagnez de l'argent ou quand vous effectuez une Activité Revenus, référez- vous au tableau suivant :<br><br><table><tr><td>Standing de Carrière</td><td>Bonus d'argent par fois où le Talent est pris</td></tr><tr><td>1</td><td>+2d10 sous de cuivre</td></tr><tr><td>2</td><td>+1d10 pistoles d'argent</td></tr><tr><td>3</td><td>+2d10 pistoles d'argent</td></tr><tr><td>4</td><td>+1 couronne d'or</td></tr></table><br><br>À cause de votre nature criminelle évidente, les autres vous considèrent d'un Statut inférieur, à moins qu'ils ne possèdent également le Talent Criminel. Dans ce cas, le Statut est comparé normalement – vous possédez peut-être des tatouages de gang, avez l'air louche, ou êtes juste un peu brute, vous avez le choix. À cause de cela, les forces de l'ordre locales se montrent toujours méfiantes et doutent de vos motivations. Plus vous prenez ce Talent, plus cela empire, les répercussions exactes étant déterminées par le MJ. Ceux qui transgressent la loi sans posséder le Talent Criminel gagnent bien moins d'argent, mais comme ce n'est pas notoire, ils conservent donc leur Statut. Avec l'accord du MJ, vous pouvez retirer des niveaux du Talent Criminel pour le même montant de PX que leur coût d'achat.

### Désarmer
**Source :** LDB 10 p.135  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests de Corps à corps concernant ce Talent  

Vous êtes capable de désarmer un adversaire d'un coup de poignet judicieux ou grâce à une frappe bien ciblée à la main. Pour une Action, vous pouvez tenter un Test opposé Corps à corps/Corps à corps. Sur un succès, votre adversaire perd une arme tenue, qui atterrit à 1d10 x 30 cm dans une direction aléatoire (avec des effets supplémentaires déterminés par le MJ). Si vous réussissez de 2 DR, vous pouvez déterminer à quelle distance l'arme est projetée au lieu d'effectuer un lancer ; si vous gagnez de 4 DR, vous pouvez également choisir la direction dans laquelle est projetée l'arme ; si vous gagnez de 6 DR ou plus, vous pouvez prendre l'arme de votre adversaire si vous avez une main libre, l'attrapant en l'air avec panache. Ce Talent est inutile si votre adversaire n'a pas d'arme, ou s'il est d'une Taille supérieure à la vôtre (voir page 342).

### Destinée
**Source :** LDB 10 p.136  
**Maxi :** 1  

À l'âge de 10 ans, un Prêtre de Morr aussi appelé Augure, vous a pris à part pour prédire votre mort lors d'un rituel de passage à l'âge adulte, lourd d'encens, appelé la Destinée. En accord avec votre MJ, proposez une Destinée appropriée. Si votre Personnage meurt d'une façon y correspondant, votre prochain Personnage gagnera un bonus égal à la moitié du total de PX accumulés par votre Personnage mort pendant la partie.

### Détection d'artefact
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests d'Intuition pour détecter des artefacts magiques  

Vous êtes capable de déceler quand la magie réside dans un artefact. Vous pouvez tenter un Test d'Intuition pour n'importe quel artefact magique touché. Sur un succès, vous sentez que l'objet est magique ; de plus, chaque DR apprend également une règle spéciale spécifique concernant l'objet, s'il en possède. En principe, vous ne pouvez tenter ce Test qu'une seule fois par artefact touché.

### Déterminé
**Source :** LDB 10 p.136  
**Maxi :** Bonus de Force  

Vous lancez des attaques avec une détermination acharnée. Ajoutez votre niveau de Talent Déterminé à votre Bonus de Force quand vous Chargez.

### Diction instinctive
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Initiative  
**Tests :** Langue (Magick) quand vous faites une Incantation  

Vous comprenez instinctivement la langue Magick et êtes capable d'articuler rapidement les phrases les plus complexes sans erreur. Vous ne subissez pas d'Incantation Imparfaite si vous obtenez un double à un Test réussi de Langue (Magick).

### Discret
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Agilité  
**Tests :** N'importe quel Test impliquant Filature  

Vous êtes doué pour suivre les gens sans vous faire remarquer. Vous pouvez utiliser les règles de Filature à la page 121 sans effectuer de Test combiné. Au lieu de cela, vous effectuez simplement un Test de Perception ou de Discrétion, en fonction du plus élevé.

### Distraire
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Agilité  
**Tests :** Athlétisme pour Distraire  

Vous êtes formé à effectuer des mouvements simples pour distraire ou surprendre votre adversaire, détournant les regards de votre véritable intention. Vous pouvez utiliser votre Mouvement pour Distraire. Ceci se résout par un Test opposé d'Athlétisme/Calme. Sur un succès, votre adversaire ne gagne pas d'Avantage jusqu'à la fin du prochain Round.

### Doigts de fée
**Source :** LDB 10 p.136  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Dextérité de départ (ne compte pas comme des Augmentations).

### Doué en calcul
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Intelligence  
**Tests :** Évaluation, Pari  

Vous avez un don pour calculer et trouvez facilement la solution de la plupart des problèmes mathématiques. Vous pouvez utiliser une simple calculatrice pour simuler ce que votre PJ est capable de compter mentalement.

### Dur à cuire
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Endurance  

Vous gagnez autant de Points de Blessure supplémentaires que votre Bonus d'Endurance. Si ce dernier augmente, le nombre de Points de Blessure conféré par Dur à cuire augmente également.

### Effraction
**Source :** LDB 10 p.136  
**Maxi :** Bonus de Force  
**Tests :** Corps à corps quand vous forcez ou brisez des objets inanimés  

Vous êtes expert pour défoncer rapidement les portes et effectuer des effractions. Vous pouvez ajouter +1 Dégât pour chaque niveau dans ce Talent quand vous déterminez les Dégâts infligés à des objets inanimés, tels que des fenêtres, des coffres, des portes et objets similaires.

### Effrayant
**Source :** LDB 10 p.136  
**Maxi :** Bonus de Force  

Toute personne saine d'esprit réfléchit à deux fois avant de vous approcher. Si vous le souhaitez, vous avez un Indice de Peur de 1 (voir page 190). Ajoutez +1 à cet Indice par nombre de fois supplémentaires que vous avez pris ce Talent.

### Endurci
**Source :** LDB 10 p.136  
**Maxi :** Bonus d'Endurance  

Il en faut beaucoup pour vous achever. Vous pouvez ignorer le Point de Blessure perdu à cause d'un État Hémorragique. Chaque niveau dans ce Talent vous permet d'ignorer le Point de Blessure perdu à cause d'un État Hémorragique supplémentaire.

> ⚠️ **Empreint d'Ulgu** et **Empreint de la Magie** ne sont PAS des talents LDB — leurs fiches
> vivent en SECTION B — Talents des Extensions (`NADJ 15 l.47` / `EDOC 13 l.254-256`), pas ici.
> Ne pas les dédoubler dans SECTION A (LDB uniquement).

### Ergoteur
**Source :** LDB 10 p.137  
**Maxi :** Bonus de Sociabilité  
**Tests :** Tests de Charme quand vous argumentez ou débattez  

Vous êtes habitué à faire valoir vos opinions et à les imposer. Si vous réussissez un Test de Charme pour débattre avec un adversaire, vous pouvez choisir soit d'utiliser le DR de votre lancer, soit le chiffre des unités obtenu sur votre dé. Donc, un lancer réussi de 24 peut être utilisé comme un DR de +4.

### Escroquer
**Source :** LDB 10 p.137  
**Maxi :** Bonus d'Intelligence  
**Tests :** Intelligence (Escroquerie)  

Vous êtes doué pour détourner l'argent de vos employeurs sans vous faire prendre. Chaque fois que vous Gagnez de l'argent (pendant le jeu ou en effectuant une Activité Revenus), vous pouvez tenter un Test opposé d'Intelligence avec votre employeur (en partant du principe que vous en avez un). Si vous gagnez, vous détournez 2d10 + DR sous de cuivre, 1d10 + DR pistoles d'argent, ou 1 + DR couronnes d'or (en fonction de la taille de la transaction en question, déterminée par le MJ) sans vous faire prendre. Si votre employeur gagne de +6 DR, vous gagnez votre argent, mais votre Escroquerie est repérée ; ce qui arrive ensuite est laissé à l'appréciation du MJ. Tout autre résultat signifie que vous avez échoué à escroquer de l'argent.

### Exaltant
**Source :** LDB 10 p.137  
**Maxi :** Bonus de Sociabilité  
**Tests :** Commandement pendant la guerre  

Vos appels exaltants peuvent renverser le cours d'une bataille. Référez-vous au tableau suivant pour voir combien de personnes vous pouvez à présent influencer avec votre Compétence Commandement (voir page 120) lors d'une guerre.<br><br><table><tr><th>Talent pris</th><th>Nombre de soldats influencés</th></tr><tr><td>1</td><td>Normal x 5</td></tr><tr><td>2</td><td>Normal x 10</td></tr><tr><td>3</td><td>Normal x 20</td></tr><tr><td>4</td><td>Normal x 50</td></tr><tr><td>5</td><td>Normal x 100</td></tr><tr><td>6</td><td>Normal x 200</td></tr><tr><td>7</td><td>Normal x 500</td></tr><tr><td>8</td><td>Normal x 1000</td></tr><tr><td>9</td><td>Tous ceux qui peuvent entendre votre voix inspirante</td></tr></table><br><br><b>Exemple:</b> le monastère de l'abbesse Brigitte van der Hoogenband est pris d'assaut par les peaux-vertes, et les choses vont mal. De fait, elle décide de renforcer l'esprit de ses soldats avec un Test de Commandement, leur octroyant +10 à tous les Tests de Psychologie. Elle obtient 3 DR à son Test de Commandement. Étant donné qu'elle possède un Bonus de Sociabilité de 6, et qu'elle peut influencer un nombre de soldats, égal à son Bonus de Sociabilité + DR en utilisant Commandement, elle renforce 9 soldats. Cependant, comme elle possède Exaltant 3, ce nombre est multiplié par 20, ce qui signifie que 180 de ses soldats sont inspirés par ses cris d'encouragement « MAINTENEZ LES RANGS ! »

### Faire la manche
**Source :** LDB 10 p.137  
**Maxi :** Bonus de Sociabilité  
**Tests :** Charme (Mendicité)  

Vous êtes un mendiant expérimenté, capable de faire mettre la main à la poche même aux individus les plus cyniques. Vous pouvez effectuer un Test de Charme toutes les demi-heures quand vous Mendiez, et non toutes les heures (voir page 119).

### Feinte
**Source :** LDB 10 p.137  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps (Escrime) pour les Feintes  

Vous avez appris comment faire de fausses attaques en combat rapproché pour duper votre adversaire. Vous pouvez à présent faire une Feinte pour votre Action contre tout adversaire utilisant une arme. Cela est résolu avec un Test opposé de Corps à corps (Escrime)/Corps à corps. Si vous gagnez et que vous attaquez le même adversaire avant la fin du prochain Round, vous pourrez ajouter le DR de votre Feinte au résultat de votre jet.

### Ferveur ardente
**Source :** LDB 10 p.137  
**Maxi :** Bonus de Sociabilité  
**Tests :** Charme quand vous parlez pour défendre votre cause  

Quand vous parlez pour défendre votre cause, votre situation ou votre religion, vos mots vibrent de passion et d'ardente ferveur. Vous pouvez doubler votre Sociabilité pour calculer le nombre de personnes que vous influencez avec votre Talent Orateur (voir page 142) quand vous défendez votre cause.

### Flagellant
**Source :** LDB 10 p.137  
**Maxi :** Bonus d'Endurance  
**Tests :** Tout Test pour résister aux Puissances de la Ruine  

Vous avez voué votre douleur au service de votre Dieu. Chaque jour, vous devez passer une demi-cloche (une demi-heure) à prier en continuant à vous infliger un nombre de Blessures égal à votre Niveau de Flagellant. Jusqu'à votre prochain repos, si vous possédez le Talent Frénésie, vous pouvez entrer en Frénésie immédiatement sans effectuer de Test.<br><br>Le Talent Frénésie est ajouté à la liste des Talents de n'importe laquelle de vos Carrière. Si vous ne réussissez pas à vous flageller un jour donné, ou si vous permettez à votre chair meurtrie de guérir, vous ne pouvez dépenser aucune Résilience et aucune Détermination jusqu'à une nouvelle flagellation.

### Flairer les ennuis
**Source :** LDB 10 p.137  
**Maxi :** Bonus d'Initiative  
**Tests :** N'importe quel Test pour repérer les perturbateurs  

Vous avez l'habitude de vous retrouver dans de mauvaises situations, et de préférence à vous en sortir. Vous pouvez tenter un Test d'Intuition pour repérer ceux qui cherchent à créer des problèmes ou à vous faire du mal, même si vous n'y avez normalement pas droit, à cause de Talents ou d'un Sort par exemple. Ce Test sera probablement opposé si les autres sont dissimulés, et le MJ peut préférer effectuer ce Test en votre nom pour que vous ne connaissiez pas le résultat en cas d'échec. Si les perturbateurs repérés engagent le combat, vous pouvez ignorer n'importe quel État Surpris qu'ils auraient en principe infligé.

### Frappe assommante
**Source :** LDB 10 p.137  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Tests de Corps à corps lorsque vous effectuez une Frappe assommante  

Vous savez où frapper un adversaire pour le faire tomber rapidement. Vous ignorez la pénalité due à la désignation d'une Localisation pour frapper à la Tête quand vous utilisez une arme de Corps à corps avec l'Atout Assommante (voir page 297). De plus, vous considérez toutes les armes improvisées comme ayant l'Atout Assommante.

### Frappe blessante
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Initiative  

Vous êtes un expert pour frapper vos ennemis aux endroits les plus vulnérables. Vous infligez votre niveau de Frappe blessante en Blessures supplémentaires quand vous causez une Blessure Critique.

### Frappe précise
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Initiative  

Vous êtes doué pour frapper votre ennemi exactement là où vous le voulez, que ce soit à Distance ou au Corps à corps. Vous pouvez modifier votre résultat de la Localisation jusqu'à +/-10 par nombre de fois où vous avez pris ce Talent. Donc, si vous avez pris deux fois ce Talent et obtenez la Localisation 34, Bras droit, vous pouvez le modifier en 14, Bras gauche, ou en 54, Corps (voir page 159).

### Frappe réactive
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests d'Initiative pour tout ce qui concerne ce Talent  

Vos réactions rapides vous ont permis de faire tomber de nombreux ennemis avant même qu'ils aient eu le temps de dégainer. Quand vous êtes Chargé, vous pouvez tenter un Test d'Initiative Intermédiaire (+0) pour gagner immédiatement une Attaque gratuite en dehors de la séquence de tours normale. Cette attaque est résolue avec n'importe quelle arme que vous tenez dans votre main principale. Vous pouvez effectuer autant de Frappes réactives pendant un Round que vous possédez de Niveaux dans ce Talent, mais pouvez seulement attaquer chaque individu Chargeant une seule fois.

### Frénésie
**Source :** LDB 10 p.138  
**Maxi :** 1  

Vous pouvez entrer en Frénésie comme décrit à la page 190.

### Fuite !
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Agilité  
**Tests :** Athlétisme quand vous Fuyez  

Quand votre vie est en jeu, vous êtes capable de courir à une vitesse impressionnante. Votre Attribut de Mouvement compte comme s'il était augmenté de 1 quand vous fuyez (voir page 165).

### Grand orateur
**Source :** LDB 10 p.138  
**Maxi :** Bonus de Sociabilité  

Vous êtes doué pour enflammer les foules. Vous gagnez un bonus de DR égal à vos niveaux de Grand orateur à n'importe quel Test de Charme quand vous parlez en public devant une foule.

### Grimpeur
**Source :** LDB 10 p.138  
**Maxi :** Bonus de Force  
**Tests :** Escalade  

Vous êtes un exceptionnel grimpeur. Vous pouvez tenter de grimper même sur des surfaces paraissant trop lisses, telles que des fortifications à pic, des plateformes glacées, des murs enduits de plâtre, etc. et vous ignorez toutes les pénalités aux Tests d'Escalade résultant de la difficulté de la surface escaladée. 

### Guerrier né
**Source :** LDB 10 p.138  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique CC de départ (ne compte pas comme des Augmentations).

### Guide fluvial
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Initiative  
**Tests :** N'importe quel Test de Savoir concernant les questions fluviales  

Vous connaissez toutes les astuces pour naviguer sur les rivières dangereuses. Vous n'avez pas besoin de Test pour traverser les étendues d'eau perfide jusqu'à ce que la Difficulté soit de -10 ou moins – vous réussissez automatiquement tous les Tests plus faciles. De plus, si vous possédez la Compétence Savoir (Région) appropriée, vous n'avez jamais besoin d'effectuer de Test pour naviguer sur les eaux dangereuses – car on considère que vous connaissez les itinéraires à emprunter.

### Haine
**Source :** LDB 10 p.138  
**Maxi :** Bonus de Force Mentale  
**Tests :** Force Mentale (Groupe à combattre)  

Vous êtes consumé par la Haine pour quelque chose dans le Vieux Monde, comme décrit à la page 190. Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers un nouveau groupe. Voici quelques exemples de groupes que vous pouvez haïr : hommes-bêtes, peaux-vertes, monstres, hors-la-loi, sigmarites, morts-vivants, Sorciers dissidents.

### Haine sacrée
**Source :** LDB 10 p.138  
**Maxi :** Bonus de Sociabilité  

Vos Prières exhalent la haine que vous éprouvez pour vos ennemis blasphématoires. Vous infligez +1 Dégâts avec des Miracles pour chaque niveau dans ce Talent.

### Harmonisation aethyrique
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Initiative  
**Tests :** Focalisation (Au choix)  

Votre expérience, Talent ou entraînement vous permet de manipuler de façon plus sûre les Vents de la Magie. Vous ne subissez pas d'Incantation Imparfaite si vous obtenez un double à un Test de Focalisation réussi.

### Identité secrète
**Source :** LDB 10 p.138  
**Maxi :** Bonus d'Intelligence  
**Tests :** Tests de Divertissement (Interprétation) pour appuyer vos identités secrètes  

Vous entretenez une identité secrète qui vous permet de paraître plus riche, ou peut-être plus pauvre, que vous ne l'êtes actuellement. Avec l'accord du MJ, choisissez une Carrière. Tant que vous êtes habillé de façon appropriée, vous pouvez utiliser le Statut Social de la Carrière d'emprunt choisie plutôt que celui de la vôtre, pour modifier les Tests de Sociabilité. Vous pouvez même ignorer le Talent Criminel. Cependant, conserver cette identité nécessitera des Tests de Divertissement (Interprétation) quand vous rencontrez ceux qui pourraient déceler votre supercherie. Vous pouvez créer une nouvelle Identité secrète pour chaque Niveau que vous possédez dans ce Talent.

### Imitation
**Source :** LDB 10 p.139  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests de Divertissement (Interprétation) où les accents sont importants  

Vous avez une bonne oreille pour les accents et dialectes et pour les reproduire avec exactitude. Vous pouvez copier n'importe quel accent auquel vous êtes exposé pendant au moins une journée grâce à un Test d'Initiative ; ce Test peut être tenté une fois par jour. Une fois réussi, vous pouvez toujours imiter l'accent, et les autochtones croiront que vous êtes l'un des leurs.

### Imperturbable
**Source :** LDB 10 p.139  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique FM de départ (cela ne compte pas comme des Augmentations).

### Impitoyable
**Source :** LDB 10 p.139  
**Maxi :** Bonus d'Agilité  

Quand votre esprit est rivé sur une cible, personne ne peut vous empêcher de l'atteindre. Si vous utilisez des Avantages quand vous vous Désengagez, vous pouvez garder un nombre d'Avantages égal à votre Niveau d'Impitoyable. De plus, vous pouvez utiliser des Avantages pour vous Désengager même si vous avez moins d'Avantages que vos adversaires.

### Inébranlable
**Source :** LDB 10 p.139  
**Maxi :** Bonus de Force Mentale  
**Tests :** Tests de Calme pour résister à la panique de la Poudre noire  

Vous êtes un vétéran blasé qui a survécu à plus d'une rafale de tirs d'armes à Poudre noire. Vous avez besoin d'effectuer un Test de Calme pour résister à un État Brisé, uniquement si vous êtes blessé avec succès par une arme à Poudre noire, et pas juste ciblé (voir page 297).

### Infatigable
**Source :** LDB 10 p.139  
**Maxi :** Bonus de Force  
**Tests :** Ramer et Natation  

Vous avez l'échine solide, rompue au dur labeur. Vous pouvez ajouter vos Niveaux d'Infatigable à votre DR dans tous les Tests opposés de Force et vous pouvez porter un nombre de Points supplémentaires d'Encombrement (voir p293) équivalent à votre Niveau d'Infatigable.

### Insignifiant
**Source :** LDB 10 p.139  
**Maxi :** Bonus de Sociabilité  
**Tests :** Discrétion quand vous êtes à la vue de tous  

Les grands et puissants ne prêtent pas attention à votre présence, sachant que vous n'êtes pas digne d'être remarqué. En supposant que vous êtes correctement vêtu et pas dans une position incongrue, les personnes d'un Échelon de Statut plus haut vous ignorent, à moins que votre présence ne soit déplacée, ce qui peut rendre très facile l'écoute de conversations que vous n'êtes peut-être pas censé entendre. De plus, les Personnages d'un Échelon de Statut plus élevé que vous ne gagnent pas d'Avantage lorsqu'ils vous battent en combat, car il n'y a aucun mérite à battre un si pauvre hère.

### Intrigant
**Source :** LDB 10 p.139  
**Maxi :** Bonus d'Intelligence  
**Tests :** Tests d'Intelligence pour tout ce qui concerne ce Talent  

Vous êtes un maître en politique et vous dénichez les conspirations partout où elles se cachent. Une fois par session, vous pouvez poser une question au MJ concernant une situation politique ou une organisation sociale complexe ; le MJ effectuera un Test d'Intelligence secret et vous fournira certaines observations sur la situation en se basant sur votre DR.

### Invocation
**Source :** LDB 10 p.139  
**Maxi :** 1  

Vous êtes béni par l'un des dieux, et pouvez donc effectuer l'un des Miracles de votre culte. De plus, vous pouvez acheter des Miracles supplémentaires pour 100 PX par Miracle que vous connaissez actuellement. Donc, si vous connaissez déjà 3 Miracles, votre prochain Miracle vous coûtera 300 PX. Les règles complètes sur l'apprentissage de nouveaux Miracles se trouvent au Chapitre 7 : Religions et Croyances. Dans des conditions normales, vous ne pouvez pas apprendre plus d'un Talent Invocation (Savoir divin). De plus, vous ne pouvez pas apprendre les Talents Magie mineure ou Magie des Arcanes quand vous possédez le Talent Invocation. Vous pouvez désapprendre ce Talent pour 100 PX, mais vous perdrez tous vos Miracles si vous le faites, et vous encourrez l'extrême défaveur de votre Dieu, dont les effets sont déterminés par le MJ.

### Lecture rapide
**Source :** LDB 10 p.139  
**Maxi :** Bonus d'Intelligence  
**Tests :** Recherche et Langue si la vitesse de lecture est importante Vous lisez les livres à une cadence effrénée.  

Vous pouvez inverser un Test de Recherche raté si cela permet de le réussir. Si la vitesse à laquelle vous lisez est importante pendant un combat, un Test de Langue réussi vous permet de lire et de bien comprendre un nombre de pages par Round égal à votre DR plus votre niveau de Lecture rapide (minimum 1, même si vous avez raté le Test).

### Linguistique
**Source :** LDB 10 p.140  
**Maxi :** Bonus d'Intelligence  
**Tests :** Langue (toutes)  

Vous avez une affinité naturelle pour les langues. Après un mois passé à écouter n'importe quelle Langue, vous considérez la Compétence Langue associée comme une Compétence de Base grâce à un Test d'Intelligence réussi (qui peut être tenté une fois par mois).<br><br><b>Remarque:</b> le Talent Linguistique fonctionne uniquement pour les langues utilisées pour communiquer avec les autres, il ne fonctionne donc pas avec Langue (Magick).

### Lire/Écrire
**Source :** LDB 10 p.140  
**Maxi :** 1  

Vous êtes l'un des rares individus lettrés du Vieux Monde. On considère que vous pouvez lire et écrire (si nécessaire) toutes les Langues que vous parlez.

### Lire sur les lèvres
**Source :** LDB 10 p.140  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests de Perception pour tout ce qui concerne ce Talent  

Vous pouvez comprendre ce que les gens disent en fixant simplement leurs lèvres ; vous n'avez pas besoin d'entendre ce qu'ils disent. Si vous disposez d'un point de vue dégagé sur le bas du visage du locuteur, vous pouvez tenter un Test de Perception pour comprendre ce qu'il dit.

### Loup de mer
**Source :** LDB 10 p.140  
**Maxi :** Bonus d'Agilité  
**Tests :** Voile (tout vaisseau capable de naviguer en mer)  

Vous êtes un marin expérimenté, et vous êtes parfaitement habitué à la vie en mer. Vous pouvez ignorer tous les modificateurs négatifs aux Tests en mer résultant de conditions météorologiques défavorables, du roulis des bateaux, et situations similaires. De plus, vous comptez comme deux marins pour le nombre minimum de membres d'équipage nécessaire pour piloter un navire de haute mer.

### Mâchoires d'acier
**Source :** LDB 10 p.140  
**Maxi :** Bonus d'Endurance  
**Tests :** Tests de Résistance pour résister à l'État Sonné  

Vous êtes de constitution robuste et pouvez résister aux frappes les plus fortes. Chaque fois que vous gagnez un État Sonné ou plus, vous pouvez immédiatement effectuer un Test de Résistance Intermédiaire (+0) pour en ignorer un, chaque DR supprimant un État Sonné supplémentaire.

### Mage de guerre
**Source :** LDB 10 p.140  
**Maxi :** 1  

Vous êtes entraîné à faire appel à la magie au milieu du combat. À votre Tour, vous pouvez lancer gratuitement un Sort avec un Niveau d'Incantation de 5 ou moins, sans utiliser votre Action. Cependant, si vous le faites, vous ne pouvez lancer aucun autre Sort ce Tour.

### Magie des Arcanes
**Source :** LDB 10 p.140  
**Maxi :** 1  

Vous connaissez l'un des huit Domaines de Magie – Bête, Cieux, Mort, Feu, Métal, Ombres, Lumière ou Vie –, ou pratiquez un Savoir moins connu, comme la Magie naturelle ou la Nécromancie. Vous pouvez à présent mémoriser des Sorts du Domaine choisi pour le prix en PX suivant.<br><br><table><tr><th>Nbre de Sorts actuellement connus</th><th>Coût en PX pour un nouveau sort</th></tr><tr><td>Bonus d'Intelligence x 1</td><td>100 PX</td></tr><tr><td>Bonus d'Intelligence x 2</td><td>200 PX</td></tr><tr><td>Bonus d'Intelligence x 3</td><td>300 PX</td></tr><tr><td>Bonus d'Intelligence x 4</td><td>400 PX</td></tr><tr><td>... et ainsi de suite.</td><td></td></tr></table><br><br>Donc, si votre Bonus d'Intelligence est de 4, les 4 premiers Sorts vous coûteront 100 PX chacun, puis 200 PX pour les 4 suivants, et ainsi de suite. Les règles complètes sur l'apprentissage de nouveaux Sorts se trouvent dans le Chapitre 8 : Magie. Dans des conditions normales, vous ne pouvez pas apprendre plus d'un Talent Magie des Arcanes (Domaine). De plus, vous ne pouvez pas apprendre les Talents Béni ou Invocation quand vous possédez le Talent Magie des Arcanes. Vous pouvez désapprendre ce Talent pour 100 PX, mais si vous le faites, vous perdez immédiatement tous vos Sorts.

### Magie du Chaos
**Source :** LDB 10 p.140  
**Maxi :** 1  

Par accident ou à dessein, vous avez cédé une partie de votre âme à l'un des Dieux Sombres, et pouvez à présent pratiquer les infâmes magies du Chaos. Votre chef de la Ruine vous confère immédiatement l'accès à un seul Sort du Domaine choisi (le plus souvent les Domaines de Nurgle, Slaanesh ou Tzeentch) et vous gagnez un Point de Corruption lorsque le Sort s'insinue dans votre esprit, pour ne plus jamais en sortir.<br><br>Lorsque vous prenez ce Talent, qui coûte à chaque fois 100 PX, vous apprenez un autre Sort du Domaine choisi et gagnez un Point de Corruption. Pour plus d'informations sur les Sorts disponibles, voir le Chapitre 8 : Magie. Dans des conditions normales, vous ne pouvez connaître qu'un seul Savoir de Magie chaotique.<br><br>Les Personnages avec un Talent Magie du Chaos peuvent choisir n'importe quelle combinaison de Sorts d'Arcane, de Sorts du Chaos, et de Sorts de leur propre Domaine du Chaos. Un Personnage ayant Magie du Chaos (Tzeentch) peut sélectionner des Sorts dans la liste des Sorts d'Arcanes, la liste des Sorts d'Arcanes du Chaos et la liste des Sorts du Domaine de Tzeentch. Un Personnage avec le Talent Magie du Chaos (Indivisible) peut sélectionner des Sorts dans la liste des Arcanes et dans celle des Arcanes du Chaos. 

### Magie mineure
**Source :** LDB 10 p.140  
**Maxi :** 1  

Vous portez en vous l'étincelle de la magie et maîtrisez les techniques pour la contrôler au niveau le plus élémentaire. Quand vous prenez ce Talent, vous pratiquez, et mémorisez de façon permanente, un nombre de Sorts égal à votre Bonus de Force Mentale. Vous pouvez apprendre des Sorts de Magie mineure supplémentaires pour le prix en PX suivant.<br><br><table><tr><th>Nombre de Sorts connus actuels</th><th>Coût en PX pour un nouveau sort supplémentaire</th></tr><tr><td>Jusqu'à Bonus FM x 1</td><td>50 PX</td></tr><tr><td>Jusqu'à Bonus FM x 2</td><td>100 PX</td></tr><tr><td>Jusqu'à Bonus FM x 3</td><td>150 PX</td></tr><tr><td>Jusqu'à Bonus FM x 4</td><td>200 PX</td></tr><tr><td>... et ainsi de suite.</td><td></td></tr></table><br><br>Donc, si votre Bonus de Force Mentale est de 3 et que vous disposez déjà de 3 Sorts mineurs, il vous en coûtera 50 PX pour le premier, puis 100 PX pour les 3 suivants, et ainsi de suite. Les règles complètes pour l'apprentissage de nouveaux Sorts se trouvent au Chapitre 8 : Magie.

### Magnum Opus
**Source :** LDB 10 p.141  
**Maxi :** Aucun  

Vous êtes un maître incontesté dans votre domaine, capable de créer des œuvres d'une telle complexité que les autres ne peuvent que rester cois et s'émerveiller devant votre génie. Chaque fois que vous prenez ce Talent, vous pouvez créer une œuvre d'art exceptionnelle avec l'une de vos Compétences Métier. Cette œuvre est inégalable dans votre domaine, une pièce unique qui impressionnera toujours, vous octroyant des bonus, déterminés par le MJ, le plus souvent à vos Tests de Sociabilité envers ceux qui connaissent votre œuvre stupéfiante. Vendre cette pièce vous rapportera au moins dix fois sa valeur normale, et parfois bien plus.

### Mains agiles
**Source :** LDB 10 p.141  
**Maxi :** Bonus de Dextérité  
**Tests :** Escamotage, Corps à corps (Bagarre) pour toucher un adversaire  

Vous pouvez mouvoir vos mains avec une dextérité incroyable. Les passants ne bénéficient d'aucun Test de Perception passif pour remarquer que vous utilisez la Compétence Escamotage. Au lieu de cela, ils ne peuvent s'opposer à vos Tests d'Escamotage que s'ils vous suspectent activement ou sont à l'affût de vos mouvements. De plus, les tentatives pour utiliser Corps à corps (Bagarre) pour simplement toucher un adversaire gagnent un bonus de +10 x votre Niveau de Mains agiles.

### Maître artisan
**Source :** LDB 10 p.141  
**Maxi :** Bonus de Dextérité  
**Tests :** Métier (Au choix)  

Vous possédez un vrai talent créatif. Ajoutez la Compétence Métier associée à n'importe quelle Carrière que vous entamez. Si la Compétence Métier est déjà incluse dans votre Carrière, vous pouvez à la place acheter la Compétence pour 5 PX de moins par Augmentation.

### Maître en déguisement
**Source :** LDB 10 p.141  
**Maxi :** Bonus de Sociabilité  
**Tests :** Divertissement (Interprétation) lorsque vous êtes quelqu'un d'autre  

Vous excellez à prendre l'apparence et les manières des autres. Avec rien d'autre que des changements de posture, une torsion du visage et l'utilisation judicieuse de vêtements appropriés, vous ne vous ressemblez plus sans avoir besoin d'utiliser de nécessaire de déguisement, même en vous faisant passer pour quelqu'un de sexe différent.

### Maîtrise des dés
**Source :** LDB 10 p.141  
**Maxi :** Bonus d'Intelligence  
**Tests :** Pari et Escamotage quand vous jouez à un jeu de dés  

Vous êtes un maître des jeux de dés, et tous ceux qui affirment que vous trichez ont clairement tort. Quand vous utilisez Pari ou Escamotage de façon réussie avec des dés, vous pouvez choisir soit d'utiliser le DR obtenu, soit le chiffre des unités du dé. Donc, un lancer réussi de 06 peut être utilisé comme un DR de +6. Si vous jouez à des jeux de dés réels pour représenter celui en jeu, lancez toujours un nombre de dés supplémentaires égal à votre niveau de Maîtrise des dés et choisissez les meilleurs résultats.

### Maîtrise du combat
**Source :** LDB 10 p.141  
**Maxi :** Bonus d'Agilité  

Vous avez accumulé des années d'expérience au combat, ce qui vous permet de tenir facilement les combattants les plus faibles à distance. Pour chaque fois que vous avez ce Talent, vous comptez comme une personne supplémentaire lors du calcul pour déterminer si l'un des camps dépasse l'autre en nombre. Ce Talent n'entre en jeu que lorsque vous êtes dépassé en nombre. Voir page 162 pour les règles concernant ce cas.

### Maniement de deux armes
**Source :** LDB 10 p.141  
**Maxi :** Bonus d'Agilité  
**Tests :** Corps à corps ou Projectiles si vous attaquez avec deux armes  

Quand vous êtes équipé de deux armes, vous pouvez attaquer avec les deux pour votre Action. Effectuez un lancer pour toucher avec l'arme tenue par votre main principale. Si vous touchez, déterminez les Dégâts normalement, mais rappelez- vous de conserver votre lancer de dés, car vous l'utiliserez de nouveau. Si la première frappe est réussie, une fois résolue, l'arme dans votre main secondaire peut ensuite viser un adversaire disponible de votre choix en utilisant le même lancer de dés que celui de la première frappe, mais inversé. Donc, si vous avez obtenu 34 pour toucher avec la première arme, vous obtenez 43 pour toucher avec la seconde. Rappelez- vous de modifier ce second lancer avec la pénalité de votre mauvaise main (-20 à moins que vous ne possédiez le Talent Ambidextre). Cette seconde attaque est opposée à un nouveau lancer de défense et les Dégâts pour cette seconde frappe sont calculés normalement. Une exception à cela : si vous obtenez un Critique pour votre première frappe. Si cela se produit, utilisez le lancer du tableau des Critiques pour servir de lancer à la seconde attaque. Donc, si vous infligez un Critique à la tête et lancez un 56 sur le tableau des Critiques et obtenez une Blessure majeure à l'œil, votre seconde attaque aurait donc une valeur de 56. Si vous choisissez d'attaquer avec les deux armes, tous vos lancers défensifs subissent une pénalité de -10 jusqu'au début de votre prochain Tour. Vous ne gagnez pas d'Avantage quand vous réussissez à frapper ou à infliger une Blessure à un adversaire avec le Maniement de deux armes sauf si les deux attaques touchent.

### Marinier
**Source :** LDB 10 p.141  
**Maxi :** Bonus d'Agilité  
**Tests :** Tests de Voile pour les navires fluviaux.  

Vous êtes un navigateur expérimenté en eaux douces, habitué aux navires fluviaux. Vous pouvez ignorer toutes les pénalités à vos Tests quand vous vous trouvez à bord d'une barque qui dérive à cause de tourbillons, de navires qui tanguent, lorsque vous êtes déséquilibré, et autres situations similaires. De plus, vous comptez comme deux bateliers pour le nombre minimum de membres d'équipage nécessaires pour diriger un navire fluvial.

### Menaçant
**Source :** LDB 10 p.141  
**Maxi :** Bonus de Force  
**Tests :** Intimidation  

Vous bénéficiez d'une stature imposante. Quand vous utilisez la Compétence Intimidation, gagnez un bonus de DR égal à vos Niveaux de Menaçant.

### Menteur
**Source :** LDB 10 p.142  
**Maxi :** Bonus de Sociabilité  
**Tests :** Charme quand vous mentez  

Tel Ranald le dieu de la Duperie, vous mélangez vérité et mensonges comme s'il n'y avait aucune différence. Quand vous utilisez Charme pour mentir, les auditeurs ne peuvent pas s'y opposer avec leur Intuition pour détecter s'il y a quelque chose de douteux dans vos propos.

### Nageur endurant
**Source :** LDB 10 p.142  
**Maxi :** Bonus de Force  
**Tests :** Natation  

Vous êtes un nageur particulièrement endurant et habitué à retenir votre souffle pendant une longue période sous l'eau. Gagnez un bonus à votre Bonus d'Endurance égal à votre Niveau de Nageur endurant pour calculer le temps pendant lequel vous retenez votre souffle.

### Nanti
**Source :** LDB 10 p.142  
**Maxi :** Aucun  

Vous êtes fabuleusement riche, et rarement à court d'argent. Quand vous Gagnez de l'argent (y compris avec des Activités Revenus), vous gagnez +1 CO par nombre de fois où vous avez pris ce Talent.

### Négociateur
**Source :** LDB 10 p.142  
**Maxi :** Bonus de Sociabilité  
**Tests :** Marchandage  

Vous êtes un homme d'affaires expérimenté qui sait comment conclure un marché. Quand vous utilisez la Compétence Marchandage, vous réduisez ou augmentez le prix des produits de 10 % supplémentaires.<br><br><b>Remarque:</b> le MJ peut imposer une réduction inférieure des prix pour montrer qu'un vendeur refuse de vendre à perte.

### Noblesse
**Source :** LDB 10 p.142  
**Maxi :** 1  
**Tests :** N'importe quel Test influencé par votre Statut  

Vous êtes issu de la noblesse, ou des événements durant le jeu vous ont permis de vous y élever. En partant du principe que vous êtes habillé de façon appropriée, vous êtes toujours considéré d'un plus haut Statut que les autres, à moins qu'ils ne possèdent le Talent Noblesse. Dans ce cas, les Statuts sont comparés normalement.

### Noctambule
**Source :** LDB 10 p.142  
**Maxi :** Bonus d'Endurance  
**Tests :** Charme et Ragot lors des fêtes, Résistance à l'alcool  

Vous êtes un fêtard chevronné et vous savez comment vous amuser. Vous pouvez inverser le résultat de n'importe quel Test de Résistance à l'alcool raté si cela entraîne un succès.

### Nomade
**Source :** LDB 10 p.142  
**Maxi :** Bonus d'Agilité  
**Tests :** Tests de Discrétion en environnement Rural  

Vous êtes à l'aise quand vous arpentez les espaces sauvages. Quand vous utilisez Discrétion en environnement rural, ceux qui croisent votre route n'obtiennent pas de Test de Perception passif pour vous détecter ; ils peuvent vous détecter uniquement s'ils sont spécifiquement à l'affût ou à la recherche de personnes cachées.

### Numismate
**Source :** LDB 10 p.142  
**Maxi :** Bonus d'Initiative  
**Tests :** Évaluation pour établir la valeur de pièces  

Vous connaissez bien les monnaies du Vieux Monde, et vous êtes un expert pour déterminer leur valeur. Vous pouvez juger de la valeur réelle d'une pièce par votre seule expérience, sans que cela ne nécessite jamais de Test. De plus, vous pouvez identifier des pièces contrefaites avec un simple Test d'Évaluation ; il n'est jamais opposé par le DR du faussaire.

### Obstiné
**Source :** LDB 10 p.142  
**Maxi :** Bonus de Force Mentale  

Vous êtes la quintessence de la détermination et de la résolution. Ajoutez votre niveau d'Obstiné au maximum de votre réserve de Détermination.

### Œil du chasseur
**Source :** LDB 10 p.142  
**Maxi :** Bonus d'Initiative  
**Tests :** N'importe quel Test pour traquer ou capturer du gibier  

Vous êtes un chasseur expérimenté et connaissez toutes les meilleures techniques pour trouver du gibier.<br><br>Quand vous voyagez à travers des régions giboyeuses, vous êtes automatiquement capable de chasser suffisamment de gibier pour vous nourrir vous et un nombre de personnes égal à votre niveau d'Œil du chasseur, tant que vous avez le temps et l'équipement approprié. Vous pouvez fournir plus de nourriture encore en utilisant les règles normales de Recherche de nourriture (voir page 131).

### Orateur
**Source :** LDB 10 p.142  
**Maxi :** Bonus de Sociabilité  

Vous êtes un orateur de talent et savez comment galvaniser d'importants groupes de personnes. Référez-vous au tableau suivant pour voir combien de personnes vous pouvez influencer avec votre Compétence Charme (voir page 119) quand vous parlez en public.<br><br><table><tr><th>Talent pris</th><th>Nombre de personnes influencées</th></tr><tr><td>1</td><td>Normal x 5</td></tr><tr><td>2</td><td>Normal x 10</td></tr><tr><td>3</td><td>Normal x 20</td></tr><tr><td>4</td><td>Normal x 50</td></tr><tr><td>5</td><td>Normal x 100</td></tr><tr><td>6</td><td>Normal x 200</td></tr><tr><td>7</td><td>Normal x 500</td></tr><tr><td>8</td><td>Normal x 1000</td></tr><tr><td>9</td><td>Toutes celles qui peuvent entendre votre voix d'or</td></tr></table>

### Oreille absolue
**Source :** LDB 10 p.143  
**Maxi :** Bonus d'Initiative  
**Tests :** Divertissement (Chant), Langue (Langues tonales, telles que l'elthárin, le cathayan, le Magick)  

Vous avez l'oreille absolue, capable de reproduire parfaitement les notes et de les identifier sans jamais avoir besoin d'effectuer de Test. De plus, ajoutez Divertissement (Chant) à n'importe quelle Carrière que vous entamez ; si la Compétence est déjà dans votre Carrière, vous pouvez à la place acheter la Compétence pour 5 PX de moins par Augmentation.

### Pansement de fortune
**Source :** LDB 10 p.143  
**Maxi :** Bonus d'Intelligence  
**Tests :** Guérison pendant les Rounds de combat  

Vous êtes habitué à traiter rapidement les blessures. Si vous ratez un Test de Guérison quand vous utilisez des Bandages, vous pouvez inverser le résultat si cela entraîne un succès ; cependant, si vous le faites, vous ne pouvez pas obtenir plus de +1 DR, car vous vous concentrez sur la vitesse plutôt que sur la précision.

### Pas de côté
**Source :** LDB 10 p.143  
**Maxi :** Bonus d'Agilité  
**Tests :** Tests d'Esquive pour activer ce Talent  

Vous êtes doué pour être là où les armes ennemies ne se trouvent pas. Si vous utilisez Esquive pour vous défendre contre une attaque et gagnez le Test opposé, vous pouvez vous déplacer jusqu'à 2 mètres alors que vous plongez hors de portée, ce qui signifie que vous n'êtes plus Engagé. Aucun de vos adversaires ne gagnera d'Attaque gratuite quand vous faites ce Pas de côté.

### Pêcheur
**Source :** LDB 10 p.143  
**Maxi :** Bonus d'Initiative  
**Tests :** Tout Test concernant la pêche  

Vous êtes un pêcheur très habile et connaissez les meilleures façons d'attraper du poisson. En supposant qu'une étendue d'eau suffisamment grande soit disponible, vous êtes automatiquement considéré comme capable de pêcher suffisamment de poisson pour vous nourrir vous et un nombre de personnes égal à votre niveau de Pêcheur, en partant du principe que vous choisissez de passer au moins une heure ou deux avec une ligne et des appâts. Vous pouvez fournir plus de poisson en utilisant les règles normales pour la Recherche de nourriture (voir page 131).

### Perception de la magie
**Source :** LDB 10 p.143  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests d'Intuition pour détecter les Sorciers  

Vous êtes capable de sentir les Vents de la Magie chez les autres. Vous pouvez tenter un Test d'Intuition Accessible (+20) chaque fois que vous rencontrez un lanceur de Sorts. Sur un succès, vous sentez que la cible est un sorcier. De plus, si vous obtenez un Succès Stupéfiant (+6), vous pouvez aussi déterminer la Spécialisation de Focalisation la plus élevée de la cible.

### Persévérant
**Source :** LDB 10 p.143  
**Maxi :** Bonus d'Endurance  
**Tests :** Tests de Résistance pour supporter les difficultés  

Vous n'abandonnez jamais, même si les tâches paraissent impossibles. Vous pouvez doubler le temps que les Tests de Résistance réussis vous accordent pour supporter une difficulté. Cela inclut endurer une chevauchée prolongée, une exposition, des rituels et autres problèmes similaires.

### Perspicace
**Source :** LDB 10 p.143  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique Intelligence de départ (ne compte pas comme Augmentation).

### Petit
**Source :** LDB 10 p.143  
**Maxi :** 1  

Vous êtes bien plus petit que la plupart des gens dans le Vieux Monde. Les règles complètes concernant les différentes Tailles se trouvent au Chapitre 12 : Bestiaire à la page 342.

### Pharmacologie
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Intelligence  
**Tests :** Métier (Apothicaire)  

Vous êtes hautement qualifié en pharmacie, à même de fabriquer des pilules, des baumes, des onguents, des huiles, des crèmes, etc. Vous pouvez inverser n'importe quel Test de Métier (Apothicaire) raté si cela permet d'obtenir un succès.

### Pied marin
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Endurance  
**Tests :** Tout Tests pour résister au mal de mer  

Vous êtes habitué aux roulis des océans, et il est très improbable que vous ayez le mal de mer, même dans les pires des tempêtes. Dans des conditions normales en mer, vous n'avez jamais besoin de Test pour savoir si vous avez le mal de mer. Dans d'autres cas (tels qu'une tempête ou un mal de mer causé par la magie), vous pouvez ignorer toutes les pénalités des Tests pour éviter ces nausées.

### Pilote
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests de Ramer ou de Voile pendant que vous naviguez sur des eaux peu sûres  

Vous êtes doué pour diriger des vaisseaux à travers les eaux dangereuses. Si vous ratez un Test pour les traverser, vous pouvez inverser le résultat si cela entraîne un succès ; cependant, si vous le faites, vous ne pouvez pas obtenir plus de +1 DR, car vous repérez le danger imminent au dernier moment.

### Porte-Bouclier
**Source :** LDB 10 p.144  
**Maxi :** Bonus de Force  
**Tests :** N'importe quel Test pour vous défendre avec un bouclier  

Vous êtes habile dans le maniement de votre bouclier pour manœuvrer en combat afin de pouvoir tirer le meilleur parti d'une situation désespérée. Quand vous utilisez un Bouclier pour vous défendre, vous gagnez un nombre d'Avantages égal au nombre de Niveaux que vous possédez en Porte-Bouclier si vous perdez le Test opposé.

### Présence imposante
**Source :** LDB 10 p.144  
**Maxi :** Bonus de Sociabilité  
**Tests :** Commandement  

Votre présence emplit les autres de crainte et d'admiration. Votre aura d'autorité est telle que ceux possédant un Statut inférieur ne peuvent pas résister à vos Tests de Commandement avec leur Force Mentale. Évidemment, les ennemis ne sont toujours pas plus enclins à vous respecter ou à vous obéir, mais le commun des mortels se dresse rarement contre vous.

### Prévoyant
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Initiative  

Vous êtes habitué à anticiper les besoins des autres comme les vôtres. Un nombre de fois par séance égal à votre niveau de Prévoyant, vous pouvez sortir de votre sac à dos (ou similaire) l'équipement nécessaire à la situation actuelle, tant que son Encombrement est de 0, qu'il est crédible que vous l'ayez acheté récemment, et qu'il ne soit pas trop invraisemblable. Cela peut être n'importe quoi, de la flasque d'alcool pour fortifier un camarade blessé au sifflet bon marché, absolument nécessaire pour un saltimbanque de passage. Chaque fois que vous le faites, vous devez déduire le coût de l'objet sorti de votre sac pour compenser l'argent dépensé plus tôt. 

### Rat d'égout
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Agilité  
**Tests :** Tests de Discrétion dans les souterrains  

Vous êtes à l'aise dans les tunnels, les égouts et tout autre environnement souterrain. Quand vous y utilisez Discrétion, ceux qui croisent votre chemin n'obtiennent pas de Tests de Perception passifs pour vous détecter ; ils ne peuvent vous remarquer que s'ils sont spécifiquement à l'affût ou à la recherche de personnes cachées.

### Rechargement rapide
**Source :** LDB 10 p.144  
**Maxi :** Bonus de Dextérité  

Vous pouvez recharger les armes à distance avec facilité. Vous ajoutez un DR égal à votre niveau de Rechargement rapide à n'importe quel Test pour recharger une arme à distance.

### Réflexes foudroyants
**Source :** LDB 10 p.144  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique Agilité de départ (ne compte pas comme des Augmentations).

### Renversement
**Source :** LDB 10 p.144  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps quand vous vous défendez  

Vous êtes habitué aux combats désespérés, capable de retourner même les situations les plus désastreuses à votre Avantage. Si vous gagnez le Test opposé de Corps à corps, au lieu de gagner +1 Avantage, vous prenez tous les Avantages actuels de votre adversaire. Dans ce cas, vous ne pouvez infliger aucun Dégât, même si c'était votre Tour dans le Round.

### Résistance
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Endurance  
**Tests :** Tous ceux pour résister à la Menace associée  

Votre forte constitution vous permet de survivre plus facilement à une menace spécifique. Vous pouvez réussir automatiquement le premier Test pour résister à la menace spécifiée, telle que Magie, Poison, Maladie, Mutation, à chaque séance de jeu. Si le DR requis est important, utilisez votre Bonus d'Endurance comme DR pour le Test.

### Résistance à la Magie
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Endurance  

Vous êtes très résistant à la magie. Le DR de tout Sort vous affectant est réduit de 2 par point que vous possédez dans ce Talent. Le DR d'un Sort est uniquement modifié par le plus haut score du Talent Résistance à la Magie dans la zone de sa cible. De plus, vous ne pourrez jamais apprendre les Talents Béni, Invocation, Magie des Arcanes, Magie mineure et Sorcier !.

### Riposte
**Source :** LDB 10 p.144  
**Maxi :** Bonus d'Agilité  
**Tests :** Corps à corps quand vous vous défendez  

La meilleure défense c'est l'attaque, donc vous répondez à une attaque par une contre-attaque rapide comme l'éclair. Si votre arme possède l'Atout Rapide, vous pouvez infliger des Dégâts quand vous êtes attaqué, comme si c'était votre Action. Vous pouvez Riposter à un nombre d'attaques par Round égal à votre Niveau de Riposte. 

### Robuste
**Source :** LDB 10 l.1039-1043  
**Maxi :** Bonus d'Endurance  

Vous êtes un dur à cuire et vous encaissez les Dégâts. Vous réduisez tous les Dégâts subis de 1 par nombre de fois où vous avez pris le Talent Robuste, même si les Dégâts ne peuvent normalement pas être réduits. Mais vous subissez toujours un minimum de 1 Blessure de n'importe quelle source de Dégâts.

### Sans peur
**Source :** LDB 10 l.1045-1051  
**Maxi :** Bonus de Force Mentale  
**Tests :** Calme pour vous opposer à l'Intimidation, la Peur et la Terreur de votre Ennemi  

Vous êtes suffisamment courageux ou fou pour que la peur de certains ennemis ne soit qu'un lointain souvenir. Avec un seul Test de Calme Accessible (+20), vous pouvez ignorer les effets d'Intimidation, de Peur ou de Terreur de l'ennemi spécifié quand vous le rencontrez. Les ennemis courants comprennent les hommes-bêtes, les peaux-vertes, les hors-la-loi, les vampires, les gardes et les Sorciers dissidents.

### Saut carpé
**Source :** LDB 10 l.1053-1057  
**Maxi :** 1  

Il est difficile de vous mettre à terre. Vous pouvez effectuer un Test d'Athlétisme Intermédiaire (+0) pour atterrir immédiatement sur vos pieds chaque fois que vous gagnez un État À Terre. Ce Test d'Athlétisme est souvent modifié par la Force du coup qui vous renverse : pour chaque tranche de +10 en Force que possède le coup au-delà de votre Endurance, vous subissez une pénalité de -10 au Test d'Athlétisme, et vice versa.

### Savant
**Source :** LDB 10 l.1059-1063  
**Maxi :** Bonus d'Intelligence  
**Tests :** Savoir (Savoir choisi)  

Vous êtes exceptionnellement instruit, et vous possédez un niveau important de connaissances avancées dans un domaine d'études. Vous connaissez automatiquement un nombre d'informations correctes égal à votre Niveau de Savant (Savoir), au sujet d'une question pertinente sans avoir besoin de Test de Compétence Savoir. Les Tests, comme toujours, vous fourniront plus d'informations, déterminées par le MJ. 

### Savoir-vivre
**Source :** LDB 10 l.1065-1071  
**Maxi :** Bonus de Sociabilité  
**Tests :** Charme et Ragot (Groupe Social)  

Vous pouvez vous intégrer socialement au groupe choisi, tant que vous vous habillez et vous comportez de façon appropriée. Voici des exemples de groupes sociaux pour ce Talent : Criminels, Cultistes, Guildes, Nobles, Érudits, Serviteurs et Soldats. Si vous ne possédez pas le Talent, ceux qui le possèdent remarquent votre gêne dans un environnement non familier. Cela concerne principalement l'interprétation du Personnage, mais peut conférer un bonus aux Tests de Sociabilité à la discrétion du MJ.

### Seconde vue
**Source :** LDB 10 l.1073-1077  
**Maxi :** Bonus d'Initiative  
**Tests :** N'importe quel Test pour détecter les Vents de Magie  

Vous pouvez percevoir les Vents changeants de la Magie, qui soufflent depuis les Portes du Chaos jusqu'aux pôles du monde. Vous possédez à présent Seconde vue (voir page 233).

### Seigneur de guerre
**Source :** LDB 10 l.1079-1085  
**Maxi :** Bonus de Sociabilité  
**Tests :** Tests de Commandement pendant la guerre  

Votre regard sévère et vos mots exaltants incitent vos soldats à se battre jusqu'au bout. Tous les subalternes capables de vous voir peuvent ajouter votre Niveau de Seigneur de guerre au DR d'un Test de Force Mentale par Round. Ce bonus n'est pas cumulatif.

### Sens aiguisé
**Source :** LDB 10 l.1087-1091  
**Maxi :** Bonus d'Initiative  
**Tests :** Perception (Sens)  

L'un de vos cinq sens principaux est particulièrement développé, vous permettant de repérer ce qui échappe à d'autres. Vous pouvez effectuer des Tests de Perception pour détecter des détails normalement imperceptibles grâce au sens associé, déterminés par le MJ. Cela peut être : voir un aigle au-delà du champ visuel de tout le monde, sentir un poison presque inodore, entendre la respiration d'une souris immobile dans un mur, percevoir une lettre effacée dans une gravure, ou déceler que deux bières d'un même brasseur ont été tirées de deux tonneaux différents.

### Sens de l'orientation
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Initiative  
**Tests :** Orientation  

Vous avez un sens instinctif de l'orientation. Vous savez automatiquement où se trouve le nord en regardant les étoiles, les arbres ou n'importe quels autres signes familiers.

### Sixième sens
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Initiative  
**Tests :** Test d'Intuition impliquant votre Sixième sens  

Vous avez une impression étrange quand vous êtes en danger, et pouvez réagir en conséquence. Le MJ peut vous prévenir que vous êtes observé, ou que vous êtes en danger ; cela arrivera normalement après un Test d'Intuition secret en votre nom. De plus, vous pouvez ignorer la Surprise si vous réussissez un Test d'Intuition.

### Sociable
**Source :** LDB 11 p.146  
**Maxi :** Bonus de Sociabilité  
**Tests :** Tests de Ragot avec les voyageurs  

Vous aimez parler avec les autres et on dirait bien qu'ils aiment discuter avec vous. Vous pouvez inverser n'importe quel Test de Ragot si cela permet au Test de réussir.

### Sorcier !
**Source :** LDB 11 p.146  
**Maxi :** Bonus de Force Mentale  

Vous êtes un lanceur de Sorts autodidacte qui a compris peu à peu comment utiliser la magie, par tâtonnements. Ajoutez Langue (Magick) à n'importe quelle Carrière que vous entamez ; si elle est déjà comprise dans votre Carrière, vous pouvez, à la place, acheter la Compétence pour 5 PX de moins par Augmentation. De plus, vous pouvez dépenser un Point de Résilience pour lancer (et mémoriser) un Sort provenant de n'importe quel Domaine de Magie, pour 0 PX. Vous pouvez le faire un nombre de fois égal à votre Niveau dans ce Talent.

### Souplesse féline
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Agilité  
**Tests :** Athlétisme quand vous tombez  

Vous êtes agile comme un chat, et capable de tomber de plus grandes hauteurs que les autres sans vous blesser. Chaque fois que vous tombez, effectuez un Test d'Athlétisme. Sur un succès, réduisez la distance de chute de 1 mètre, +1 mètre supplémentaire par +1 DR obtenu, pour calculer les Dégâts.

### Sprinter
**Source :** LDB 11 p.146  
**Maxi :** Bonus de Force  
**Tests :** Tests d'Athlétisme pour Courir  

Vous êtes un coureur très rapide. Votre Attribut de Mouvement compte comme plus élevé de 1 lorsque vous Courez.

### Studieux
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Intelligence  
**Tests :** Recherche  

Vous êtes un vrai rat de bibliothèque. Quand vous utilisez Recherche, vous pouvez inverser le résultat de n'importe quel Test raté si cela entraîne un succès.

### Suborneur
**Source :** LDB 11 p.146  
**Maxi :** Bonus de Sociabilité  
**Tests :** Subornation  

Vous êtes un corrupteur hautement qualifié. Le MJ peut réduire le coût de base de n'importe quel pot-de-vin requis de 10 % par niveau que vous possédez en Suborneur, jusqu'à un minimum de 10 % du montant d'origine. 

### Tireur d'élite
**Source :** LDB 11 p.146  
**Maxi :** 1  

Vous pouvez effectuer des tirs ciblés d'une précision chirurgicale. Vous ignorez les modificateurs de Difficulté des Tests de Projectiles dus à la taille de votre cible.

### Tireur de précision
**Source :** LDB 11 p.146  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Capacité de Tir de départ (ne compte pas comme des Augmentations).

### Tireur embusqué
**Source :** LDB 11 p.146  
**Maxi :** 4  
**Tests :** Portée (Longue – Extrême)  

La distance n'est pas un obstacle pour vos Compétences de tir, et vous êtes expert dans l'art de repérer des cibles aussi bien éloignées qu'à proximité. Vous ne subissez aucune pénalité lors d'un tir à Longue distance, et la moitié des pénalités à Portée extrême.

### Tir mortel
**Source :** LDB 11 p.146  
**Maxi :** 1  

Vous touchez toujours un adversaire juste entre les deux yeux... ou à l'endroit que vous aviez l'intention d'atteindre. Au lieu d'inverser le dé pour déterminer quelle Localisation est touchée avec votre arme à distance, vous pouvez la choisir.

### Tir précis
**Source :** LDB 11 p.146  
**Maxi :** Bonus de Capacité de Tir  

Vous êtes un tireur exceptionnel et savez où atteindre un ennemi pour lui causer un maximum de Dégâts. Votre niveau de Tir précis équivaut à des dégâts supplémentaires pour toutes les armes à distance.

### Tir rapide
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Agilité  
**Tests :** Projectiles quand vous effectuez un Tir rapide  

Si vous avez une arme à distance chargée, vous pouvez faire feu en dehors de l'ordre d'Initiative normal avant que tout autre combattant ne réagisse dans le Round suivant. Vous effectuez un lancer pour toucher en utilisant les modificateurs normaux. Utiliser Tir rapide nécessite à la fois votre Action et votre Mouvement pour votre tour à venir, qui compteront comme ayant été dépensés pendant le prochain tour. Si deux Personnages ou plus utilisent Tir rapide, celui qui a pris ce Talent le plus de fois tire en premier. En cas d'égalité, ils font feu simultanément et devraient être gérés en même temps.

### Tir sûr
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Initiative  

Vous savez comment trouver les points faibles de l'armure d'une cible. Quand vous la touchez, vous pouvez ignorer un nombre de PA égal à votre Niveau de Tir sûr.

### Tour des souvenirs
**Source :** LDB 11 p.146  
**Maxi :** Bonus d'Intelligence  

Une technique de mémorisation initiée par le Culte de Verena, d'après ce que l'on prétend, tirée des pratiques elfiques enseignées par les Maîtres du savoir de Hoeth, Tour des souvenirs vous permet de vous rappeler parfaitement une série d'événements en les mémorisant dans une tour imaginaire. Vous pouvez vous souvenir d'une série d'événements d'une longueur égale à votre Intelligence sans avoir besoin d'effectuer de Test. Pour chaque tranche de 10 éléments supplémentaires que vous tentez de mémoriser, vous devez effectuer un Test d'Intelligence dont la Difficulté augmente pour vous en souvenir correctement, en partant de Très facile (+60) pour 10+, Facile (+40) pour 20+, Accessible (+20) pour 30+, etc. Au-delà de son utilité évidente pour le Pari, car ce Talent ajoute un Bonus de +20 à +60, selon l'utilité de la mémorisation lors du jeu en cours, le MJ peut, si nécessaire, appliquer des Bonus aux autres Tests. Chaque fois que vous prenez ce Talent, vous pouvez vous rappeler une série supplémentaire d'événements, sans avoir à en oublier une précédemment mémorisée. 

### Trappeur
**Source :** LDB 11 p.147  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests de Perception pour repérer des pièges, Piégeage  

Vous êtes doué pour repérer et utiliser des pièges. Vous pouvez effectuer un Test de Perception pour en repérer automatiquement, sans avoir à prévenir le MJ de votre intention ; le MJ peut préférer effectuer ces Tests secrètement, à votre place.

### Travailleur qualifié
**Source :** LDB 11 p.147  
**Maxi :** Bonus de Dextérité  
**Tests :** Tous les Tests étendus appropriés de Métier.  

Votre maîtrise d'un Métier spécifique est exceptionnelle. Vous ôtez le niveau de votre Talent Travailleur qualifié du DR exigé pour tout Test étendu utilisant votre Compétence de Métier.

### Très fort
**Source :** LDB 11 p.147  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique Force de départ (ne compte pas comme des Augmentations).

### Très résistant
**Source :** LDB 11 p.147  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique Endurance de départ (ne compte pas comme des Augmentations).

### Tricheur
**Source :** LDB 11 p.147  
**Maxi :** Bonus d'Intelligence  
**Tests :** Pari et Escamotage quand vous jouez à un jeu de cartes  

Vous êtes doué pour jouer et gagner aux cartes, bien que vos méthodes puissent impliquer un peu de triche. Quand vous utilisez Pari ou Escamotage avec succès en jouant aux cartes, vous pouvez choisir, soit d'utiliser le DR obtenu, soit le chiffre des unités de votre dé. Donc, un succès de 28 peut être utilisé comme un DR de +8. Si vous jouez avec un jeu de cartes réel pour représenter ce qui se passe en jeu, vous pouvez recevoir un nombre suppl��mentaire de cartes par distribution égal à votre niveau de Tricheur, puis en défausser pour revenir à la taille de main appropriée avant chaque tour de jeu.

### Tueur
**Source :** LDB 11 p.147  
**Maxi :** 1  

Quand vous déterminez les Dégâts, utilisez le Bonus d'Endurance de votre adversaire comme votre Bonus de Force s'il est plus élevé ; déterminez toujours ce point avant toute autre règle modifiant votre Force ou Bonus de Force. De plus, si votre cible est plus grande que vous, et que vous obtenez un Critique (voir page 159), multipliez tous les Dégâts de Corps à corps que vous infligez par le nombre de catégories de Taille de votre cible, supérieures à la vôtre (donc, 2 catégories = x2, 3 = x3, et ainsi de suite) ; cette multiplication est calculée une fois tous les modificateurs appliqués. Voir page 342 pour plus d'informations au sujet de la Taille. 

### Véloce
**Source :** LDB 11 p.147  
**Maxi :** 1  

Vous gagnez +1 à votre Attribut de Mouvement.

### Vigilance
**Source :** LDB 11 p.147  
**Maxi :** Bonus d'Initiative  
**Tests :** Perception pendant les combats au Corps à corps  

Vous avez l'habitude d'analyser le champ de bataille pour prendre des décisions rapides, éclairées par les vagues changeantes du conflit. Vous pouvez effectuer un Test de Perception Intermédiaire (+0) pour ignorer la Surprise, modifié normalement par la situation.

### Vision nocturne
**Source :** LDB 11 p.147  
**Maxi :** Bonus d'Initiative  
**Tests :** Tests de Perception dans des conditions de faible luminosité  

Vous pouvez voir parfaitement dans les ténèbres naturelles. En présumant que vous possédez au moins une faible source de lumière (telle que la lumière des étoiles, le clair de lune, la bioluminescence), vous pouvez voir clairement jusqu'à 20 mètres par Niveau de Vision nocturne. De plus, vous pouvez étendre la distance d'illumination effective de toutes les sources de lumière de 20 mètres par niveau de Vision nocturne.

**Sources RAW :** `LDB 11 l.176`

**Voir aussi :** `vision.md` — brouillard de guerre, zones éclairées, états lumineux par case ; `equipement.md` § Éclairage — rayons de Bougie (10 m) et Lanterne (20 m), étendus de +20 m / niveau par ce Talent.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 10` (l.1039-1043, l.1045-1051, l.1053-1057, l.1059-1063, l.1065-1071, l.1073-1077, l.1079-1085, l.1087-1091) → `fearImmuneVs`, `fearSourceFor`, `CombatFeature`, `resolvePsychAI`, `sansPeurVs`, `resolvePeurTest`, `resolveTerreurTest`, `CascadeStepMeta`, `pharmacologie`, `pied-marin`, +21 — `src/data/talents.json`, `src/engine/combatFeatures/dispatch.ts`, `src/engine/combatFeatures/types.ts`, `src/engine/psychology.ts`, `src/state/combat/turnHooks.ts`, `src/state/combatFlow.ts`, +1 fichiers
- `LDB 11` (l.176) → `ambush-vigilance`, `TraitCapabilities`, `trappeur`, `travailleur-qualifie`, `tres-fort`, `tres-resistant`, `tricheur`, `tueur`, `veloce`, `vigilance`, +5 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/talents.json`, `src/state/vision.ts`
- `EDOC 13` (l.254-256) → `chaosDomainOf`, `allure-demoniaque-nurgle`, `allure-demoniaque-slaanesh`, `allure-demoniaque-tzeentch`, `allure-demoniaque-indivisible`, `GameOp`, `OpsCtx`, `empreint-de-la-magie`, `allure-demoniaque`, `aspect-sublime` — `src/data/spells.json`, `src/data/tables.json`, `src/data/talents.json`, `src/engine/combatFeatures/dispatch.ts`, `src/engine/ops.ts`
- `NADJ 15` (l.47) → `empreint-d-ulgu` — `src/data/talents.json`

### Visions sacrées
**Source :** LDB 11 p.147  
**Maxi :** Bonus d'Initiative  
**Tests :** Test d'Intuition quand vous vous trouvez sur un sol sacré  

Vous discernez clairement les grandes œuvres des dieux tout autour de vous. Vous savez automatiquement quand vous entrez sur un sol sacré, et pouvez effectuer un Test d'Intuition pour recevoir des visions (souvent obscures et interprétées via le paradigme de votre culte ou de votre système individuel de croyance) concernant la localité si des événements importants ont eu lieu ici par le passé.

### Vivacité
**Source :** LDB 11 p.147  
**Maxi :** 1  

Vous gagnez un bonus permanent de +5 à votre Caractéristique Initiative de départ (ne compte pas comme des Augmentations).

### Volonté de fer
**Source :** LDB 11 p.147  
**Maxi :** Bonus de Force Mentale  
**Tests :** Tests de Calme pour s'opposer à Intimidation  

Vous êtes indomptable, et vous ne vous inclinerez jamais volontairement devant autrui. L'utilisation de la Compétence Intimidation ne provoque pas la Peur chez vous et ne vous empêchera pas de vous opposer à un interlocuteur intimidant.

### Voyageur aguerri
**Source :** LDB 11 p.147  
**Maxi :** Bonus d'Intelligence  
**Tests :** N'importe quel Test concernant les particularités locales  

Vous êtes une âme curieuse qui a voyagé partout, et appris toutes sortes d'informations locales. Ajoutez Savoir (Région) à n'importe quelle Carrière que vous entamez. Si elle est déjà incluse dans la Carrière, vous pouvez acheter la Compétence deux fois – avec une Spécialisation différente chaque fois, telle qu'Altdorf, Vorbergland ou Ubersreik – pour 5 PX de moins par Augmentation.

---

## SECTION B --- Talents des Extensions

### EDO Compagnon --- L'Ennemi dans l'Ombre Compagnon (EDOC)

> Source : `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/13 - CHAPITRE 9 - La Main pourpre - Guide du Meneur.md`

#### Bénédiction de Tzeentch
**Source :** EDOC 13 l.85-89  
**id app :** `benediction-de-tzeentch`  
**Maxi :** 1 (noté « — p.1 » dans le texte source)  

Tzeentch, le Dieu du Chaos de la Magie, vous a béni d'un parasite enfoui dans votre esprit. Lorsque vous achetez ce Talent, un Sort unique se faufile dans votre tête où il s'installe, murmurant de temps en temps pendant votre sommeil. Ce Sort peut être choisi dans n'importe quel savoir de Magie des Couleurs. De plus, vous pouvez acheter un Sort de Magie des Couleurs supplémentaire pour 100 XP pour chaque Sort que vous avez mémorisé provenant du Savoir de Tzeentch.

#### Disciple du changement
**Source :** EDOC 13 l.91-95  
**id app :** `disciple-du-changement`  
**Maxi :** 1  

Lorsque vous obtenez une Mutation, lancez deux fois les dés et choisissez l'un des deux résultats.

#### Double vie
**Source :** EDOC 13 l.97-101  
**id app :** `double-vie`  
**Maxi :** 1 (noté « — p.1 »)  

Vous êtes tellement habile à maintenir votre identité secrète que vous êtes capable de mener deux vies complètement séparées. Lorsque vous prenez ce Talent, vous pouvez entamer une deuxième Carrière parallèlement à votre Carrière du Chaos. Vous comptez maintenant comme appartenant aux deux Carrières, et vous pouvez acheter des Compétences avancées et des Talents dans l'une ou l'autre, ainsi que prendre et abandonner de nouvelles Carrières dans l'une ou l'autre. Comme toujours, tout changement de Carrière doit être approuvé par votre MJ afin de s'adapter au mieux aux plans de campagne et de refléter correctement votre Double vie.

#### Empreint de la Magie
**Source :** EDOC 13 l.254-256  
**id app :** `empreint-de-la-magie`  
**Maxi :** 1  

> Source réelle : EDOC 13 (Nouveaux Talents, section « Influence Maléfique de Tzeentch », l.248-258). Accordé comme effet d'Incantation imparfaite dans une zone influencée par Tzeentch — contenu de campagne, tagué `codexOnly` dans talents.json (#326).

Tous les Sorts lancés à votre Bonus de Force Mentale en mètres autour de vous gagnent +1 DR au lancé. Ce Bonus ne peut être appliqué qu'une fois par lancement, quel que soit le nombre de Personnages à proximité possédant ce Talent.

Si vous obtenez un 9 à un Test d'Incantation ou de Focalisation effectué dans une zone influencée par Tzeentch (comme 09, 19, 29, 90, 92, etc.), vous subissez : 1 Incantation imparfaite mineure, et vous gagnez le Talent Empreint de la Magie jusqu'au début de votre prochain tour. Si vous obtenez 99, vous subissez une Incantation imparfaite majeure et une Horreur rose de Tzeentch se manifeste à 1d10 mètres de votre position.

---

### NADJ --- Nuits Agitées & Dures Journées

> Source : `Source/Warhammer v4 - Nuits agitees & dures journees/15 - _GoBack.md` (section Gnomes, Nouveau Talent)

#### Empreint d'Ulgu
**Source :** NADJ 15 p.88 l.47 (section Peuple des Landes / Sorciers Gnomes)  
**id app :** `empreint-d-ulgu`  
**Maxi :** 1  
**Tests :** Tout Test faisant appel à Discrétion  

Vous portez l'empreinte du Vent de Magie gris, que les personnes dotées de Seconde vue perçoivent comme une brume ténébreuse et changeante qui enveloppe votre corps. Vous pouvez utiliser votre Compétence Focalisation (Ulgu) à la place de Discrétion pour tous les Tests qui y font appel. De plus, toute tentative réussie pour jeter des sorts du Domaine des Ombres à moins de 8 mètres gagne +1 DR. Ce bonus ne peut être obtenu qu'une seule fois, quel que soit le nombre de Personnages avec Empreint d'Ulgu dans le voisinage du lanceur de sorts.

---

### AA --- Aux Armes (VF disponible)

> Source VF : `Game/Source/WH - V4 - Aux Armes/01 - WH - V4 - Aux Armes.md` (fichier unique, 4750+ lignes)
> Annexe III (l.4456-4523) : « Nouveaux Talents et Talents Mis À Jour ».
> Note : une partie des données dans `talents.json` est taguée `source: "frenchy.bzh"` (homebrew Guide v4.5).

#### Artilleur (mise à jour AA)
**Source :** AA Annexe III l.4457-4460  
**Maxi :** Bonus de Dextérité  
**Règle LDB inchangée :** DR au Test étendu de rechargement à Poudre noire.  
**Ajout AA :** Recharger une arme à Poudre noire en combat = Action Évaluer ; +1 Avantage supplémentaire lors de ce Test.

#### Battement (mise à jour AA)
**Source :** AA Annexe III l.4462-4467  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps pour une manœuvre de Battement  
**Changement AA :** Sur un succès, la réserve d'Avantages adverse perd -1 Avantage et -1 de plus **si vous avez obtenu 6 DR** (vs LDB : -1 par DR obtenu).

#### Cavalier émérite (mise à jour AA)
**Source :** AA Annexe III l.4469-4472  
**Maxi :** Bonus d'Agilité  
**Tests :** Chevaucher pendant les combats  
**Ajout AA :** Vous considérez votre Taille comme égale à celle de votre monture pour résister à la Peur et à la Terreur causées uniquement par la Taille de votre adversaire.

#### Commandant d'équipe (NOUVEAU AA)
**Source :** AA Annexe III l.4474-4478  
**id app :** `commandant-d-equipe`  
**Maxi :** Bonus d'Initiative  
**Tests :** Projectiles pour les tirs avec une arme dotée du Défaut Arme d'équipe  

Un Personnage doté de ce Talent a l'habitude de gérer des équipes maniant des armes de siège et des pièces d'artillerie. Le Personnage peut effectuer un Test de Commandement Intermédiaire (+0) pour aider une équipe qui utilise une arme possédant le Défaut Arme d'équipe à portée de voix. Si le Personnage réussit le Test, les membres de l'équipe peuvent ensuite utiliser le score de Compétence Projectiles du Personnage quand ils tirent avec l'arme.

#### Coude-à-coude (mise à jour AA)
**Source :** AA Annexe III l.4480-4485  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps quand vous vous trouvez à côté d'un allié avec Coude-à-coude  
**Changement AA :** Chaque Personnage possédant Coude-à-coude compte comme **deux combattants** pour ce qui est de perdre un Avantage (vs LDB : conserver 1 Avantage perdu par niveau).

#### Distraire (mise à jour AA)
**Source :** AA Annexe III l.4487-4490  
**Maxi :** Bonus d'Agilité  
**Tests :** Athlétisme pour Distraire  
**Changement AA :** Sur un succès, l'adversaire ne gagne pas d'Avantage pour **sa réserve** jusqu'à la fin du prochain Round (vs LDB : ne gagne pas d'Avantage — formulation plus précise).

#### Frappe blessante (mise à jour AA)
**Source :** AA Annexe III l.4492-4494  
**Maxi :** 1  
**Changement AA :** Quand vous effectuez un lancer dans un tableau de Blessures Critiques, **lancez les dés deux fois** et choisissez le résultat que vous préférez (vs LDB : infliger +Blessures supplémentaires sur Critique).

#### Fuite ! (mise à jour AA)
**Source :** AA Annexe III l.4500-4504  
**Maxi :** Bonus d'Agilité  
**Ajout AA :** Test d'Athlétisme aussi **quand vous êtes la Cible d'une Poursuite** (en plus de quand vous Fuyez).

#### Impitoyable (mise à jour AA)
**Source :** AA Annexe III l.4506-4509  
**Maxi :** 1  
**Changement AA :** La dépense d'Avantages pour une Retraite stratégique tombe à **1** pour vous (vs LDB : formulation différente concernant l'adversaire et les dépenses d'Avantages).

#### Officier de Siège (NOUVEAU AA)
**Source :** AA Annexe III (mentionné dans talents.json, absent du MD AA disponible)  
**id app :** `officier-de-siege`  
**Maxi :** inconnu (talents.json : null)  
**Description :** non trouvée dans le MD AA VF disponible. Stub à compléter.

#### Porte-Bouclier (mise à jour AA)
**Source :** AA Annexe III l.4511-4514  
**Maxi :** Bonus de Force  
**Tests :** n'importe quel Test pour vous défendre avec un bouclier  
**Changement AA :** Quand vous utilisez un bouclier pour vous défendre, une fois par Round, vous pouvez dépenser **2 Avantages** soit pour **causer des Dégâts** comme si c'était votre Action, soit pour **pousser votre adversaire sur 2 mètres** et ne plus être Engagé (vs LDB : dépenser des Avantages pour des effets).

#### Rechargement rapide (mise à jour AA)
**Source :** AA Annexe III l.4516-4519  
**Maxi :** Bonus de Dextérité  
**Ajout AA :** Recharger une arme à distance en combat = Action Évaluer ; +1 Avantage supplémentaire lors de ce Test.

#### Renversement (mise à jour AA)
**Source :** AA Annexe III l.4521-4522  
**Maxi :** Bonus de Capacité de Combat  
**Tests :** Corps à corps quand vous vous défendez  
**Changement AA :** Si vous gagnez le Test opposé, au lieu de +1 Avantage, vous pouvez **prendre 1 Avantage dans la réserve du camp opposé** et l'ajouter à la vôtre (vs LDB : prendre TOUS les Avantages adverses).

---

### ADE II --- Les Archives de l'Empire Vol.2

> Source : `Source/Warhammer v4 - Les archives de l'Empire volume 2/02 - Les ogres.md` l.226-233 (section Nouveaux Talents)

#### Massif
**Source :** ADE II ch. Les Ogres l.227-230  
**id app :** `massif`  
**Maxi :** 1  

Vous êtes bien plus massif que la plupart des habitants du Vieux Monde. Les règles complètes à propos des différentes Tailles se trouvent à la page 342 de WFJDR.

#### Vice (Cible)
**Source :** ADE II ch. Les Ogres l.232-233  
**id app :** `vice`  
**Maxi :** Bonus de Force Mentale  
**Tests :** Force Mentale (Résister à la cible)  

Vous êtes consumé par le besoin de vous adonner à un vice particulier et souffrez du Trait Psychologique Vice. Chaque fois que vous choisissez ce Talent, vous développez un nouveau vice. Exemples : alcool, nourriture, stupéfiants, plaisir.

Trait Psychologique Vice associé : Vous éprouvez le besoin constant de vous adonner à votre Vice. Chaque fois que vous êtes confronté à la Cible de votre Vice, vous devez vous soumettre à un Test de Psychologie. En cas d'échec, vous devez immédiatement vous laisser aller à votre Vice. Vous ne serez satisfait qu'une fois que vous aurez perdu connaissance (État Exténué). Pour chaque jour complet sans vous adonner au Vice, vous gagnez -20 cumulatif à tous les Tests de Psychologie.

---

### ADE I --- Les Archives de l'Empire Vol.1

> Source : `Source/Warhammer v4 - Les archives de l'Empire volume 1/06 - Guide de la Laurelorn.md` l.165-170

#### Sang Neuf
**Source :** ADE I 6 Guide de la Laurelorn l.167-170  
**id app :** `sang-neuf` (tagué `codexOnly` : l'espèce Éonir n'est pas jouable dans l'app, #326)  
**Maxi :** 1  
**Tests :** Tous les Tests de Sociabilité avec un autre Éonir  

Votre famille est vue comme une nouvelle venue dans la Laurelorn, et est traitée avec condescendance par les Éonirs des autres lignages. Votre Statut est toujours considéré comme plus bas que celui des autres Éonirs, à moins qu'ils aient, eux aussi, le Talent Sang neuf. Un membre du jeune lignage de deuxième génération peut perdre ce Talent s'il réussit une série d'épreuves pour rejoindre la lignée des Enfants de la forêt.

> Note : talent négatif/particulier (lignage Harioth des Éonirs) — présent dans talents.json en contenu de référence (`codexOnly`).

---

### Middenheim --- La Cité du Loup Blanc

> Scan complet effectué (Annexes I, II, III + Bestiaire + tous chapitres). Aucun talent nouveau défini avec champ Maxi. L'Enfant d'Ulric est une créature (profil modifié), pas un talent. Les origines nordiques (Middenheimer/Middenlander/Nordlander) ajustent les tables de carrière mais n'introduisent pas de nouveaux talents.

### ZI --- Zoo Impérial (The Imperial Zoo)

> Disponible en PDF VO uniquement (pas de dossier .md VF). Le trait Redoutable (*Grim*) est un TRAIT de créature (pas un talent). Aucun talent VF trouvé.

---

## SECTION C --- Refs LDB dans talentEffects.ts

> Fichier : `src/engine/talentEffects.ts` (127 lignes totales)

Le fichier ne contient pas de refs `LDB N l.N` en annotation inline. Les regles sourcees apparaissent dans les commentaires JSDoc descriptifs. Extrait des refs LDB mentionnees :

```
// LDB 10/41 : « recoit les SIX Benedictions de son culte » -> octroi AUTOMATIQUE
//   a l'acquisition (creation + achat PX), pas un achat a 0 PX par clic.
//   Signal : registre (grantsCultBlessings), plus de name-match.
//
// LDB 10 : semantique addCharacteristic (cle STABLE, != libelle) :
//   - CharKey (F, Soc...) : +5 carac de depart (Guerrier ne, Tireur de precision,
//     Tres fort, Tres resistant, Vivacite, Reflexes foudroyants, Doigts de fee,
//     Perspicace, Imperturbable, Affable)
//   - wounds (Dur a cuire) : « autant de Points de Blessure supplementaires que le BE »
//   - fortune (Chanceux) : « maximum Points de Chance = Points de Destin + niveaux »
//   - resolve (Obstine) : « Ajoutez votre niveau au maximum de votre reserve »
//   - move (Veloce) : « Vous gagnez +1 a votre Attribut de Mouvement »
//   - corruption (Ame pure) : seuil +niveau -> cable dans corruption.ts
//
// LDB 10 : addSkill : « Ajoutez la Competence X a n'importe quelle Carriere »
//   (Maitre artisan/Oreille absolue/Sorcier!/Voyageur aguerri/Artiste)
```

---

## SECTION D --- talents.json : liste complete (177 entrees)

> Fichier : `src/data/talents.json` --- SOURCE app-owned (commitee, editee dans le Compendium)
> 177 entrees dont 1 meta (talent-aleatoire), 169 LDB, 3 EDO, 2 AA, 2 ADE II

| # | id | label | source | page |
|---|---|---|---|---|
| 1 | `talent-aleatoire` | Talent aléatoire | LDB | 132 |
| 2 | `acrobaties-equestres` | Acrobaties équestres | LDB | 132 |
| 3 | `affable` | Affable | LDB | 132 |
| 4 | `affinite-avec-les-animaux` | Affinité avec les animaux | LDB | 132 |
| 5 | `ambidextre` | Ambidextre | LDB | 132 |
| 6 | `ame-pure` | Âme pure | LDB | 132 |
| 7 | `artilleur` | Artilleur | LDB | 132 |
| 8 | `artiste` | Artiste | LDB | 132 |
| 9 | `assaut-feroce` | Assaut féroce | LDB | 132 |
| 10 | `attirant` | Attirant | LDB | 132 |
| 11 | `baratiner` | Baratiner | LDB | 133 |
| 12 | `battement` | Battement | LDB | 133 |
| 13 | `benediction-de-tzeentch` | Bénédiction de Tzeentch | EDO | 75 |
| 14 | `beni` | Béni | LDB | 133 |
| 15 | `bon-marcheur` | Bon marcheur | LDB | 133 |
| 16 | `bonnes-jambes` | Bonnes jambes | LDB | 133 |
| 17 | `bricoleur` | Bricoleur | LDB | 133 |
| 18 | `brouet` | Brouet | LDB | 133 |
| 19 | `caid` | Caïd | LDB | 134 |
| 20 | `cavalier-emerite` | Cavalier émérite | LDB | 134 |
| 21 | `chanceux` | Chanceux | LDB | 134 |
| 22 | `charge-berserk` | Charge berserk | LDB | 134 |
| 23 | `chat-de-gouttiere` | Chat de gouttière | LDB | 134 |
| 24 | `chirurgie` | Chirurgie | LDB | 134 |
| 25 | `claquer-le-fouet` | Claquer le fouet | LDB | 134 |
| 26 | `coeur-vaillant` | Cœur vaillant | LDB | 134 |
| 27 | `combat-deloyal` | Combat déloyal | LDB | 134 |
| 28 | `combat-instinctif` | Combat instinctif | LDB | 134 |
| 29 | `combattant-au-contact` | Combattant au contact | LDB | 134 |
| 30 | `combattant-en-espace-clos` | Combattant en espace clos | LDB | 135 |
| 31 | `concocter` | Concocter | LDB | 135 |
| 32 | `contorsionniste` | Contorsionniste | LDB | 135 |
| 33 | `controle-de-la-frenesie` | Contrôle de la Frénésie | LDB | 135 |
| 34 | `cooperatif` | Coopératif | LDB | 135 |
| 35 | `commandant-d-equipe` | Commandant d'équipe | AA | 140 |
| 36 | `costaud` | Costaud | LDB | 135 |
| 37 | `coude-a-coude` | Coude-à-coude | LDB | 135 |
| 38 | `coup-puissant` | Coup puissant | LDB | 135 |
| 39 | `criminel` | Criminel | LDB | 135 |
| 40 | `desarmer` | Désarmer | LDB | 135 |
| 41 | `destinee` | Destinée | LDB | 136 |
| 42 | `detection-d-artefact` | Détection d'artefact | LDB | 136 |
| 43 | `determine` | Déterminé | LDB | 136 |
| 44 | `diction-instinctive` | Diction instinctive | LDB | 136 |
| 45 | `discret` | Discret | LDB | 136 |
| 46 | `distraire` | Distraire | LDB | 136 |
| 47 | `disciple-du-changement` | Disciple du changement | EDO | 75 |
| 48 | `doigts-de-fee` | Doigts de fée | LDB | 136 |
| 49 | `double-vie` | Double vie | EDO | 75 |
| 50 | `doue-en-calcul` | Doué en calcul | LDB | 136 |
| 51 | `dur-a-cuire` | Dur à cuire | LDB | 136 |
| 52 | `effraction` | Effraction | LDB | 136 |
| 53 | `effrayant` | Effrayant | LDB | 136 |
| 54 | `endurci` | Endurci | LDB | 136 |
| 55 | `empreint-d-ulgu` | Empreint d'Ulgu | NADJ | 88 | — |
| 56 | `empreint-de-la-magie` | Empreint de la Magie | EDOC | 79 | — |
| 57 | `ergoteur` | Ergoteur | LDB | 137 |
| 58 | `escroquer` | Escroquer | LDB | 137 |
| 59 | `exaltant` | Exaltant | LDB | 137 |
| 60 | `faire-la-manche` | Faire la manche | LDB | 137 |
| 61 | `feinte` | Feinte | LDB | 137 |
| 62 | `ferveur-ardente` | Ferveur ardente | LDB | 137 |
| 63 | `flagellant` | Flagellant | LDB | 137 |
| 64 | `flairer-les-ennuis` | Flairer les ennuis | LDB | 137 |
| 65 | `frappe-assommante` | Frappe assommante | LDB | 137 |
| 66 | `frappe-blessante` | Frappe blessante | LDB | 138 |
| 67 | `frappe-precise` | Frappe précise | LDB | 138 |
| 68 | `frappe-reactive` | Frappe réactive | LDB | 138 |
| 69 | `frenesie` | Frénésie | LDB | 138 |
| 70 | `fuite` | Fuite ! | LDB | 138 |
| 71 | `grand-orateur` | Grand orateur | LDB | 138 |
| 72 | `grimpeur` | Grimpeur | LDB | 138 |
| 73 | `guerrier-ne` | Guerrier né | LDB | 138 |
| 74 | `guide-fluvial` | Guide fluvial | LDB | 138 |
| 75 | `haine` | Haine | LDB | 138 |
| 76 | `haine-sacree` | Haine sacrée | LDB | 138 |
| 77 | `harmonisation-aethyrique` | Harmonisation aethyrique | LDB | 138 |
| 78 | `identite-secrete` | Identité secrète | LDB | 138 |
| 79 | `imitation` | Imitation | LDB | 139 |
| 80 | `imperturbable` | Imperturbable | LDB | 139 |
| 81 | `impitoyable` | Impitoyable | LDB | 139 |
| 82 | `inebranlable` | Inébranlable | LDB | 139 |
| 83 | `infatigable` | Infatigable | LDB | 139 |
| 84 | `insignifiant` | Insignifiant | LDB | 139 |
| 85 | `intrigant` | Intrigant | LDB | 139 |
| 86 | `invocation` | Invocation | LDB | 139 |
| 87 | `lecture-rapide` | Lecture rapide | LDB | 139 |
| 88 | `linguistique` | Linguistique | LDB | 140 |
| 89 | `lire-ecrire` | Lire/Écrire | LDB | 140 |
| 90 | `lire-sur-les-levres` | Lire sur les lèvres | LDB | 140 |
| 91 | `loup-de-mer` | Loup de mer | LDB | 140 |
| 92 | `machoires-d-acier` | Mâchoires d'acier | LDB | 140 |
| 93 | `mage-de-guerre` | Mage de guerre | LDB | 140 |
| 94 | `magie-des-arcanes` | Magie des Arcanes | LDB | 140 |
| 95 | `magie-du-chaos` | Magie du Chaos | LDB | 140 |
| 96 | `magie-mineure` | Magie mineure | LDB | 140 |
| 97 | `magnum-opus` | Magnum Opus | LDB | 141 |
| 98 | `mains-agiles` | Mains agiles | LDB | 141 |
| 99 | `maitre-artisan` | Maître artisan | LDB | 141 |
| 100 | `maitre-en-deguisement` | Maître en déguisement | LDB | 141 |
| 101 | `maitrise-des-des` | Maîtrise des dés | LDB | 141 |
| 102 | `maitrise-du-combat` | Maîtrise du combat | LDB | 141 |
| 103 | `maniement-de-deux-armes` | Maniement de deux armes | LDB | 141 |
| 104 | `marinier` | Marinier | LDB | 141 |
| 105 | `menacant` | Menaçant | LDB | 141 |
| 106 | `menteur` | Menteur | LDB | 142 |
| 107 | `nageur-endurant` | Nageur endurant | LDB | 142 |
| 108 | `nanti` | Nanti | LDB | 142 |
| 109 | `negociateur` | Négociateur | LDB | 142 |
| 110 | `noblesse` | Noblesse | LDB | 142 |
| 111 | `noctambule` | Noctambule | LDB | 142 |
| 112 | `nomade` | Nomade | LDB | 142 |
| 113 | `numismate` | Numismate | LDB | 142 |
| 114 | `obstine` | Obstiné | LDB | 142 |
| 115 | `oeil-du-chasseur` | Œil du chasseur | LDB | 142 |
| 116 | `orateur` | Orateur | LDB | 142 |
| 117 | `oreille-absolue` | Oreille absolue | LDB | 143 |
| 118 | `pansement-de-fortune` | Pansement de fortune | LDB | 143 |
| 119 | `pas-de-cote` | Pas de côté | LDB | 143 |
| 120 | `pecheur` | Pêcheur | LDB | 143 |
| 121 | `perception-de-la-magie` | Perception de la magie | LDB | 143 |
| 122 | `perseverant` | Persévérant | LDB | 143 |
| 123 | `perspicace` | Perspicace | LDB | 143 |
| 124 | `petit` | Petit | LDB | 143 |
| 125 | `pharmacologie` | Pharmacologie | LDB | 144 |
| 126 | `pied-marin` | Pied marin | LDB | 144 |
| 127 | `pilote` | Pilote | LDB | 144 |
| 128 | `porte-bouclier` | Porte-Bouclier | LDB | 144 |
| 129 | `presence-imposante` | Présence imposante | LDB | 144 |
| 130 | `prevoyant` | Prévoyant | LDB | 144 |
| 131 | `rat-d-egout` | Rat d'égout | LDB | 144 |
| 132 | `rechargement-rapide` | Rechargement rapide | LDB | 144 |
| 133 | `reflexes-foudroyants` | Réflexes foudroyants | LDB | 144 |
| 134 | `renversement` | Renversement | LDB | 144 |
| 135 | `resistance` | Résistance | LDB | 144 |
| 136 | `resistance-a-la-magie` | Résistance à la Magie | LDB | 144 |
| 137 | `riposte` | Riposte | LDB | 144 |
| 138 | `robuste` | Robuste | LDB | 145 |
| 139 | `sans-peur` | Sans peur | LDB | 145 |
| 140 | `saut-carpe` | Saut carpé | LDB | 145 |
| 141 | `savant` | Savant | LDB | 145 |
| 142 | `savoir-vivre` | Savoir-vivre | LDB | 145 |
| 143 | `seconde-vue` | Seconde vue | LDB | 145 |
| 144 | `seigneur-de-guerre` | Seigneur de guerre | LDB | 145 |
| 145 | `sens-aiguise` | Sens aiguisé | LDB | 145 |
| 146 | `sens-de-l-orientation` | Sens de l'orientation | LDB | 146 |
| 147 | `sixieme-sens` | Sixième sens | LDB | 146 |
| 148 | `sociable` | Sociable | LDB | 146 |
| 149 | `sorcier` | Sorcier ! | LDB | 146 |
| 150 | `souplesse-feline` | Souplesse féline | LDB | 146 |
| 151 | `sprinter` | Sprinter | LDB | 146 |
| 152 | `studieux` | Studieux | LDB | 146 |
| 153 | `suborneur` | Suborneur | LDB | 146 |
| 154 | `tireur-d-elite` | Tireur d'élite | LDB | 146 |
| 155 | `tireur-de-precision` | Tireur de précision | LDB | 146 |
| 156 | `tireur-embusque` | Tireur embusqué | LDB | 146 |
| 157 | `tir-mortel` | Tir mortel | LDB | 146 |
| 158 | `tir-precis` | Tir précis | LDB | 146 |
| 159 | `tir-rapide` | Tir rapide | LDB | 146 |
| 160 | `tir-sur` | Tir sûr | LDB | 146 |
| 161 | `tour-des-souvenirs` | Tour des souvenirs | LDB | 146 |
| 162 | `trappeur` | Trappeur | LDB | 147 |
| 163 | `travailleur-qualifie` | Travailleur qualifié | LDB | 147 |
| 164 | `tres-fort` | Très fort | LDB | 147 |
| 165 | `tres-resistant` | Très résistant | LDB | 147 |
| 166 | `tricheur` | Tricheur | LDB | 147 |
| 167 | `tueur` | Tueur | LDB | 147 |
| 168 | `veloce` | Véloce | LDB | 147 |
| 169 | `vigilance` | Vigilance | LDB | 147 |
| 170 | `vision-nocturne` | Vision nocturne | LDB | 147 |
| 171 | `visions-sacrees` | Visions sacrées | LDB | 147 |
| 172 | `vivacite` | Vivacité | LDB | 147 |
| 173 | `volonte-de-fer` | Volonté de fer | LDB | 147 |
| 174 | `voyageur-aguerri` | Voyageur aguerri | LDB | 147 |
| 175 | `massif` | Massif | ADE II | 20 |
| 176 | `vice` | Vice | ADE II | 20 |
| 177 | `officier-de-siege` | Officier de Siège | AA | ? |

---

## SECTION E --- Voir aussi

- `docs/raw/4e/competences.md` — compétences liées aux Tests des Talents
- `docs/raw/4e/combat.md` — talents de combat (Assaut féroce, Frappe blessante, Renversement…)
- `docs/raw/4e/tests.md` — mécanique des Tests et Degrés de Réussite (DR)
- `docs/raw/4e/destin.md` — Destin/Résilience/Détermination (Chanceux, Obstiné)
- `docs/raw/4e/traumatisme.md` — Endurci, Chirurgie, Pansement de fortune en contexte
- `docs/raw/4e/etats.md` — États déclenchés par certains talents (Sonné, Brisé…)

---

## SECTION F --- Implémente

| Fichier | Rôle |
|---|---|
| `src/data/talents.json` | SOURCE app-owned : 177 entrées (id, label, max, test, desc, addSkill, addTalent, addCharacteristic, specs, rand, source) |
| `src/engine/talentEffects.ts` | Acquisition (applyTalentAcquisition) : +5 carac de départ (CharKey), +1 Mouvement (Véloce), Béni → 6 Bénédictions auto ; calculs Blessures/Chance/Détermination (extraWounds, heroMaxWounds, fortuneMax, resolveMax) ; addSkill → careerSkillAdditions ; passifs (talentPassiveMods → collecteur passiveMods) |
| `src/data/index.ts` | findTalent / findTalentById — lookup par libellé ou id stable |
| `src/engine/careerSlots.ts` | splitLabel / concreteLabel — résolution spec « (Au choix) » pour addSkill |
| `src/engine/characteristics.ts` | bonus / maxWounds — dépendances de heroMaxWounds |
| `src/engine/trauma.ts` | passiveMods(c) — collecteur UNIQUE (talents + traits + mutations + maladies…) |

**Points à vérifier :**
- `officier-de-siege` (AA) : description inconnue, stub dans talents.json

---

*Fin du fichier — 177 talents référencés (1 meta + 169 LDB + 4 EDOC/NADJ + 2 AA + 2 ADE II — voir Section D).*
