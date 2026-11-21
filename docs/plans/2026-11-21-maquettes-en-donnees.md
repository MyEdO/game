# Maquettes Godot : primitives d'abord, écrans en données

Ticket: #4585, #4411

(#4585 : vérification du contenu entre états et restes de la revue des maquettes ; #4411 : cadres fixes des maquettes Godot.)

Carte mesurée qui fonde ce plan : `docs/plans/2026-11-21-carte-maquettes.md`.

## Qualification

- **But réel** : chaque écran des maquettes (`hotes/godot/cibles/propositions/`) se construit à partir de données sémantiques. Un gabarit déclaratif les range dans ses places, et des primitives du kit les dessinent. Une même nature d'information a donc le même dessin partout : changer l'interface revient à toucher une primitive, sans « partir à la chasse de tous les écrans ».
- **Livrable** :
  - le code des maquettes migré (`sources/`) ;
  - le catalogue des primitives (`kit.md`) ;
  - des gardes et des relevés qui rendent la rechute impossible ;
  - la page de jugement régénérée depuis le dépôt.
- **Fini** :
  - hors du kit et des peintres de décor, `sources/` ne contient plus aucune fonction qui émet ou compose une primitive ;
  - `rendu.js` ne garde que le moteur générique : charger, monter, interpréter la table du gabarit ;
  - les 170 états sont dessinés par des primitives du catalogue, rangées par des tables de gabarit ;
  - les feuilles hors kit ne déclarent que du placement ;
  - la passe complète est verte depuis le dépôt, avec la comparaison au pixel à 0 sur chaque lot de migration.
- **Doctrines** :
  - `user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage` : « leur JSON porte les données dans la forme visée, et le rendu dessine le kit » ; les mots sont keyés par id, aucun mot n'est écrit en dur ;
  - `user-doctrine-ui-coherente-par-primitives-comme-les-donnees` : un concept, une primitive ; pas de classe mono-écran ; A1 : un module CSS d'écran ne déclare que du placement ; A2 : `style=` ne porte que des variables CSS ;
  - `user-doctrine-boites-fixes-d-un-ecran-a-l-autre` ;
  - `user-doctrine-icone-identifie-survol-detaille` ;
  - `user-doctrine-maquettes-en-16-9`.
- **Déjà tranché** :
  - les données d'un état restent **sémantiques** : aucune place ni primitive n'y est écrite ;
  - les relevés existants restent bloquants.
- **Irréversible** : rien. Tout passe par branche, PR et file de fusion.

## État mesuré (HEAD 2bfe012607)

Le détail et les sources sont dans la carte.

- **Données** :
  - aucun HTML dans les 170 états ;
  - les valeurs sont typées ;
  - 30 types de premier niveau, un par écran ; plusieurs n'ont aucun discriminant littéral, le rendu les reconnaît à leur forme (`'etapes' in e`, `'actes' in e`…) ;
  - environ 135 textes composés.
- **Rendu** :
  - 228 fonctions qui dessinent, dont environ 150 propres à un écran ;
  - environ 1 230 balises écrites sur place, contre environ 600 appels de primitive ;
  - environ 570 ternaires, 266 `.map(`, 231 `join('')` et 35 résolutions `qui(id)` dans `rendu.js` ;
  - des mots fixes écrits en dur (« Fin du tour », « Journal », « Libre ») ;
  - des primitives qui écrivent des mots (`bourse`).
- **Primitives** :
  - plusieurs sont des enveloppes à HTML libre (`cadre`, `places`, `colonne`, `defile`, `apercu`, `plaque`, `carte`) ;
  - `plaque` reçoit du HTML composé à 12 sites ;
  - des primitives vivent hors du kit (`combat/jet.js`, `lieux-et-nuit/commun.js`, `outils/outils.js`) ;
  - `classe` et `style` sont ouverts ;
  - six natures n'ont aucune primitive : ligne libellé-valeur, rubrique, sous-titre, note, étiquette, puce.
- **Style** :
  - 179 règles hors `gestes.css` stylent une primitive, et 156 la stylent en contexte ;
  - des surcharges d'identité passent par un sélecteur de contexte (`#lieu .plaque.envoyer>div`, `#verdict .dr`) ;
  - le DOM écrit aussi du style (`rendu.js:1821`, `n.style.fontSize`).
- **Peintres sous `#ui`** : `#plan` de l'éditeur, `#carte` de la ville, `#reikland`, `#trajet`, `#frise`. Ce sont des centaines de nœuds SVG, avec des mots en dur.
- **Outillage** :
  - `rendre.mjs` sort en 1 sur tout relevé non vide et lance le playwright nu ;
  - `npm run godot:maquettes` arrive avec l'atterrissage, en 16:9 seulement ;
  - `ecart` et `decodePng` existent dans `hotes/godot/etalons.mjs` sans être exportés, et ce script lève une erreur au chargement sans `--web` ;
  - le navigateur est épinglé dans `planches.mjs:33` (`EPINGLE`) ;
  - playwright s'installe hors dépendances (`npm i --no-save playwright`, `images.md:250-252`).
- **Le premier relevé envisagé ne mesurait rien** : en marquant seulement les racines de `cadre` et de `places`, la fenêtre du pilote et 21 états de `fiche` sur 25 passent à 0 sans migration. Le relevé doit porter sur l'émission.

## Règles

1. **Catalogue fermé.** `kit.md` liste chaque nature, avec sa primitive, sa signature et ses variantes nommées. Les primitives vivent seulement dans le kit (`gestes.js`, `gestes.css`, ou un dossier `kit/`). Une variante hors catalogue est refusée. `classe` et `style` ne prennent que des valeurs du catalogue ; `style` ne porte que des variables CSS (A2).
2. **L'émission, pas l'enveloppe.**
   - La marque est l'attribut `data-primitive` de la racine émise par une primitive. Une garde de dépôt refuse `data-primitive` écrit hors du kit.
   - Une primitive qui a un emplacement (corps, contenu, places) inscrit au relevé `brut` tout enfant de premier niveau non marqué. Ce relevé bloque pour chaque gabarit migré.
   - Pour une illustration (règle 5), le relevé compte les nœuds de texte et les contrôles hors racine marquée.
   - L'échappement des paramètres de texte entre dans une primitive avec le lot qui migre son dernier appelant brut.
   - Le refus par erreur (« impossible par construction ») vient à l'étape 5, quand plus aucun appelant brut ne reste.
3. **Le gabarit est une table, en grammaire fermée.** Une table de gabarit est faite de déclarations :
   - champ de l'état → nature ;
   - optionnel ;
   - liste ;
   - alternative selon un discriminant littéral de l'état ;
   - référence par id, résolue par une table déclarée (héros, PNJ, lieux).

   Elle n'a aucun corps de fonction. Chaque type d'état reçoit un discriminant littéral. Une disposition que la grammaire n'exprime pas se traite en enrichissant la grammaire par une déclaration, jamais par une fonction d'écran.
4. **Les mots à part.**
   - La donnée porte la valeur et l'id du libellé.
   - Les libellés vivent dans un seul dictionnaire des maquettes, keyé par id : les mots fixes d'interface y vont aussi.
   - La primitive place la valeur et le libellé, et n'écrit aucun mot.
5. **Décor et illustration.**
   - Le décor, c'est `#scene`.
   - Sous `#ui`, un dessin tracé (carte, plan, frise, trajet) est une **illustration** : une primitive dont l'intérieur est tracé par un peintre de module décor. Ses textes et ses contrôles passent par des primitives, avec des mots keyés.
   - Tout le reste sous `#ui` est de l'interface.
6. **Feuilles hors kit = placement seul** (A1), quel que soit le sélecteur : grille, gap, largeur, position. Aucune couleur, bordure, police, taille de police, rayon ni ombre. Le style écrit par le DOM (`.style.`, `style.setProperty`) suit la même règle.
7. **Pixel constant dans un lot de migration.**
   - Les 170 états sont comparés dans les 4 formats (`rendre.mjs:42-47`), sous le navigateur épinglé, par `ecart`, avec la tolérance mesurée sur deux passes de la même tête.
   - Un écart est une erreur de migration.
   - Une variante actuelle devient une variante nommée du catalogue, jamais une surcharge de famille.
8. **Harmonisation à part.** Réduire des variantes change ce qu'on voit : ce travail se fait dans un lot d'harmonisation, montré d'abord sur un écran, avec ses « À valider ».

## Étapes

0. **Atterrir #4585** (en cours).
   - Commande de passe dans le dépôt, avec un code de sortie fiable.
   - Passe complète, gardes de texte de la file de fusion, `test:perimetre`.
   - PR en auto-fusion.
   - *Preuve* : CI verte et PR fusionnée.
1. **Outillage.**
   - **Comparaison au pixel** :
     - `ecart` et `decodePng` sont extraits dans un module partagé, que `etalons.mjs` réutilise ;
     - `rendre.mjs` lance le navigateur épinglé (`EPINGLE`) ;
     - rendu de référence des 170 états × 4 formats, puis comparaison avec un code non nul au-delà de la tolérance ;
     - la tolérance se mesure sur deux passes successives.
   - **Passe complète** : elle rend aussi les planches du kit (`kit/planche-*.html`).
   - **Page de jugement** : elle se génère depuis un script du dépôt.
   - **Relevé `brut`** (règle 2) : il est hors du rapport bloquant tant qu'il n'est pas promu. Son compte par gabarit sur la tête fixe le périmètre.
   - *Preuve* : une mutation par outil, le rapport initial et la tolérance mesurée.
2. **Catalogue et grammaire.**
   - `kit.md` devient le catalogue fermé (règle 1), construit depuis l'inventaire des variantes de la carte. Chaque nature a sa primitive, sa signature et ses variantes nommées, chacune avec les écrans qui la portent. Les six natures sans primitive en font partie.
   - On compte le nombre de variantes par nature que la règle 7 impose.
   - La grammaire de table (règle 3) est écrite. Sa preuve se fait **sur papier** : tables de `voyage` (`lieu-et-voyage`) et de `fiche`, écrites sans fonction.
   - Le dictionnaire des libellés (règle 4) est défini.
   - **Point d'arrêt utilisateur** sur trois choses : le catalogue, le nombre de variantes propres à un écran admises jusqu'à l'harmonisation, et la grammaire avec ses deux tables d'essai.
3. **Pilote : `fenetre-du-bas` (49 états) et `edition` (4 états, deux types, illustration `#plan`).**
   - Les primitives utilisées passent à l'émission marquée (règle 2).
   - Les gabarits deviennent des tables (règle 3), les mots sont keyés (règle 4), l'illustration suit la règle 5.
   - Le relevé `brut` est à 0 sur ces deux gabarits. Les 16 fenêtres de `lieu-et-voyage` migreront avec leur gabarit.
   - Comparaison au pixel à 0 sur les 170 états × 4 formats.
   - Les feuilles touchées sont ramenées au placement.
   - Coût mesuré : temps, fonctions supprimées, règles retirées.
   - **Point d'arrêt utilisateur** : le catalogue appliqué, la table d'un gabarit, et le fichier de données d'un état à côté de son écran.
4. **Gabarits suivants**, du plus petit au plus gros : `recit`, `ouverture`, `consultation`, `combat`, `gestion`, `fiche`, `lieu-et-voyage`. Un lot par gabarit, avec la preuve du pilote.
   - Le relevé `brut` devient bloquant pour un gabarit dès qu'il est à 0.
   - Chaque lot met à jour les références vivantes qui citent ce qu'il déplace : `hotes/godot/projet/art/ferme.gdshader:2`, `art/grain.gdshader:2`, `scripts/bulle.gd`, `cibles/ecrites/*.md`, `cibles/images.md:248-260`, `src/data/icons/defs/interface.ts:68`, `src/data/paysages/defs/accueil.ts:6`, `src/data/paysages/defs/table.ts:4-5`, `scripts/guards/lib/couches.mjs:60`.
5. **Gardes finales.**
   - Le relevé `brut` devient bloquant partout.
   - Les primitives refusent par erreur tout emplacement non marqué.
   - Gardes de dépôt :
     - aucune fonction qui émet ou compose une primitive hors du kit et des peintres de décor ;
     - aucun corps de fonction dans une table de gabarit ;
     - aucune propriété d'identité dans une feuille hors kit (A1) ni dans le style écrit par le DOM ;
     - aucun `style=` hors variables CSS (A2) ;
     - aucun `data-primitive` hors du kit.
6. **Harmonisation** (règle 8), nature par nature, de la plus dispersée à la moins dispersée (carte, § variantes) :
   - ordre : lignes libellé-valeur, titres, sous-titres et rubriques, notes, étiquettes, puces et listes, filets, bulles, plaques, jauges ;
   - la forme se montre d'abord sur un écran ; ensuite le catalogue est réduit et appliqué partout ;
   - « À valider » dans `kit.md`.

## Hypothèses

- **Le pixel constant est atteignable** malgré les textures à graine, les polices locales et les mesures après montage. L'étape 1 le mesure. Si deux passes du même arbre diffèrent au-delà d'un bruit d'anticrénelage, la règle 7 se réécrit avant le catalogue.
- **Renommer les clés du relevé `contenu` est sans danger.** `data-texte` et les classes peuvent changer, et la comparaison au pixel prouve qu'un rect n'a pas bougé.
- **La grammaire de table couvre tous les gabarits.** L'étape 2 le vérifie sur papier pour `voyage` et `fiche`, les deux cas les plus durs. Si elle n'y suffit pas, le plan se révise avant le pilote.

## Hors périmètre

- Le noyau et Godot : #4574 (projeter des données) et #4575 (Compendium). Le noyau s'adapte après validation des maquettes.
- Les décors de `#scene` et l'intérieur tracé des illustrations.
- Les choix ouverts des « À valider » existants.
