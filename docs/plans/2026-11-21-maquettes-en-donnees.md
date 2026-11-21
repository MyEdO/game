# Maquettes Godot : primitives d'abord, écrans en données

Ticket: #4585, #4411

(#4585 : vérification du contenu entre états et restes de la revue des maquettes ; #4411 : cadres fixes des maquettes Godot.)

## Qualification

- **But réel** : chaque écran des maquettes (`hotes/godot/cibles/propositions/`) se construit à partir de données sémantiques. Un gabarit déclaratif les range dans ses places, et des primitives du kit les dessinent. Une nature d'information a le même dessin partout ; changer l'interface revient à toucher une primitive, pas à « partir à la chasse de tous les écrans ».
- **Livrable** :
  - le code des maquettes migré (`sources/`) ;
  - le catalogue des primitives (`kit.md`) ;
  - des gardes et des relevés qui rendent la rechute impossible ;
  - la page de jugement régénérée depuis le dépôt.
- **Fini** :
  - les 170 états sont dessinés exclusivement par des primitives du catalogue, par des gabarits sans corps de fonction et par des décors limités à `#scene` ;
  - les feuilles hors kit ne déclarent que du placement ;
  - la passe complète est verte depuis le dépôt, avec la comparaison au pixel à 0 sur les lots de migration.
- **Doctrines** :
  - `user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage` : « leur JSON porte les données dans la forme visée, et le rendu dessine le kit » ; mots keyés par id, aucun mot en dur ;
  - `user-doctrine-ui-coherente-par-primitives-comme-les-donnees` : un concept, une primitive ; pas de classe mono-écran. A1 : un module CSS d'écran ne déclare que du placement. A2 : `style=` ne porte que des variables CSS ;
  - `user-doctrine-boites-fixes-d-un-ecran-a-l-autre` ;
  - `user-doctrine-icone-identifie-survol-detaille` ;
  - `user-doctrine-maquettes-en-16-9`.
- **Déjà tranché** :
  - les données d'un état restent **sémantiques** : aucune place ni primitive n'est écrite dans un état ;
  - les relevés existants restent bloquants.
- **Irréversible** : rien. Tout passe par branche, PR et file de fusion.

## État mesuré (HEAD 4c4f190253, carte et jugement du 2026-11-21)

- **Données** :
  - aucun HTML dans les 170 états ; les valeurs sont typées ;
  - 30 types de premier niveau, un par écran (`maquette.ts:14-15`) ;
  - environ 135 textes composés, surtout dans `fenetre-du-bas` (68) et `lieu-et-voyage` (34).
- **Rendu** :
  - 228 fonctions qui dessinent, dont environ 150 propres à un écran ;
  - environ 1 230 balises écrites sur place, contre environ 600 appels de primitive ;
  - les gabarits choisissent leur dessin par écran (`DECORS[etat.decor]`, `'actes' in e`, `rendu.js:1748-1786`) ;
  - le rendu compose des textes (« ≤ N », « tour r sur s ») et des primitives écrivent des mots en dur (`bourse`, `gestes.js:398-400`).
- **Primitives** :
  - plusieurs sont des enveloppes à HTML libre (`cadre`, `places`, `colonne`, `defile`, `apercu`, `plaque`, `carte`) ;
  - des primitives vivent dans des fichiers de famille (`combat/jet.js`, `lieux-et-nuit/commun.js`, `outils/outils.js`) ;
  - `classe` et `style` sont ouverts en paramètre ;
  - il n'existe aucune primitive pour six natures : ligne libellé-valeur, rubrique, sous-titre, note, étiquette, puce (carte § 9).
- **Style** :
  - 179 règles hors `gestes.css` stylent une primitive, et 156 la stylent en contexte ;
  - des surcharges d'identité ont un sélecteur dont le dernier terme n'est pas la racine (`#lieu .plaque.envoyer>div`, `#verdict .dr`) ;
  - 58 identifiants servent de sélecteurs.
- **Interface hors `#ui`** : l'éditeur et la frise dessinent des libellés en SVG dans `#ui` (`outils/editeur.js:46-72`, `rendu.js:905-914`).
- **Outillage** :
  - `rendre.mjs` sort en 1 sur tout relevé non vide ;
  - `contenus.mjs` agrège ;
  - `npm run godot:maquettes` arrive avec l'atterrissage, en 16:9 seulement ;
  - `hotes/godot/etalons.mjs:35-49` compare des PNG (`ecart`, `decodePng`) ;
  - le navigateur est épinglé dans `planches.mjs:33` ;
  - playwright s'installe hors dépendances (`npm i --no-save playwright`, `images.md:250-252`).
- **Preuve que le premier relevé envisagé ne mesurait rien** : en marquant seulement `cadre` et `places`, 21 états de `fiche` sur 25 et toute la fenêtre du pilote passent déjà à 0 « hors primitive », sans aucune migration (sonde du juge). Le relevé doit donc porter sur l'émission, pas sur l'enveloppe.

## Règles

1. **Catalogue fermé.** `kit.md` liste chaque nature, sa primitive, sa signature et ses variantes nommées. Les primitives vivent seulement dans le kit (`gestes.js`, `gestes.css`, ou un dossier `kit/`).
   - Une variante hors catalogue lève une erreur.
   - `classe` et `style` disparaissent des signatures, ou ne prennent que des valeurs du catalogue.
   - `style=` ne porte que des variables CSS (A2).
2. **L'émission, pas l'enveloppe.**
   - Une primitive échappe elle-même ses paramètres de texte.
   - Ses paramètres d'emplacement n'acceptent que des sorties de primitive (valeur marquée) ; tout autre contenu lève une erreur.
   - Chaque nœud émis porte la marque de sa primitive.
   - Le HTML brut devient impossible par construction.
3. **Le gabarit est une table.** Un gabarit déclare `{ place : [champ de l'état, nature] }`, sans corps de fonction. Un écran qui demande une disposition propre a sa table propre, déclarée, sans code.
4. **Les mots à part.** La donnée porte la valeur et l'id du libellé. La primitive place les deux et n'écrit aucun mot.
5. **Décor = `#scene`.** Tout ce qui est sous `#ui`, SVG compris, est de l'interface et passe par une primitive.
6. **Feuilles hors kit = placement seul** (A1), quel que soit le sélecteur : grille, gap, largeur, position. Aucune couleur, bordure, police, taille de police, rayon ni ombre.
7. **Pixel constant dans un lot de migration.**
   - Les 170 états sont comparés dans les 4 formats (`rendre.mjs:42-47`), sous le navigateur épinglé, par `ecart`, avec la tolérance mesurée sur deux passes de la même tête.
   - Un écart est une erreur de migration.
   - Pour garder le pixel, une variante existante devient une variante nommée du catalogue, jamais une surcharge de famille.
8. **Harmonisation à part.** Réduire des variantes est un changement visible : il se fait dans un lot d'harmonisation, montré d'abord sur un écran, avec ses « À valider ».

## Étapes

0. **Atterrir #4585** (en cours).
   - Commande de passe dans le dépôt, avec un code de sortie fiable.
   - Passe complète, gardes de texte de la file de fusion, `test:perimetre`.
   - PR en auto-fusion.
   - *Preuve* : CI verte, PR fusionnée.
1. **Outillage.**
   - **Comparaison au pixel** :
     - rendu de référence des 170 états × 4 formats, à une tête donnée, sous le navigateur épinglé ;
     - comparaison par `ecart` (`etalons.mjs`), avec code non nul au-delà de la tolérance ;
     - tolérance mesurée sur deux passes successives.
   - **Passe complète** : elle rend aussi les planches du kit (`kit/planche-*.html`).
   - **Page de jugement** : elle se génère depuis un script du dépôt. Sa source vivait dans la session (`docs/plans/2026-11-18-kit-maquettes-reprise-4411.md:34`).
   - **Relevé `brut`** :
     - il compte, par gabarit, les nœuds sous `#ui` qui ne portent aucune marque d'émission de primitive (règle 2) ;
     - il reste hors du rapport bloquant de `rendre.mjs` tant qu'il n'est pas promu ; son compte sur HEAD fixe le périmètre.
   - *Preuve* : une mutation par outil, le rapport initial et la tolérance mesurée.
2. **Catalogue.**
   - `kit.md` devient le catalogue fermé (règle 1), construit depuis l'inventaire des variantes (carte § 9) et la carte de propagation : chaque nature, sa primitive, sa signature, ses variantes nommées, dont les six natures sans primitive.
   - Chaque variante cite les écrans qui la portent aujourd'hui.
   - **Point d'arrêt utilisateur** sur le catalogue (« primitives d'abord »).
3. **Pilote : `fenetre-du-bas` (65 états) et `ouverture` (3 types, 4 états).**
   - Primitives du catalogue utilisées par ces gabarits : émission marquée et paramètres d'emplacement contrôlés (règle 2).
   - Gabarits en tables (règle 3), mots keyés (règle 4).
   - Relevé `brut` à 0 sur ces gabarits ; comparaison au pixel à 0 sur les 170 états × 4 formats.
   - Feuilles touchées ramenées au placement.
   - Coût mesuré : temps, fonctions supprimées, règles retirées.
   - **Point d'arrêt utilisateur** sur trois choses : le catalogue appliqué, la table d'un gabarit, et le fichier de données d'un état à côté de son écran.
4. **Gabarits suivants**, du plus petit au plus gros : `recit`, `consultation`, `edition`, `combat`, `gestion`, `fiche`, `lieu-et-voyage`. Un lot par gabarit, avec la preuve du pilote.
   - Le relevé `brut` devient bloquant pour un gabarit dès qu'il est à 0.
   - Chaque lot met à jour les références vivantes qui citent ce qu'il déplace : `hotes/godot/projet/art/ferme.gdshader:2`, `scripts/bulle.gd`, `cibles/ecrites/*.md`, `src/data/paysages/defs/accueil.ts:6`.
5. **Gardes finales.**
   - Relevé `brut` bloquant partout.
   - Garde de dépôt :
     - aucun corps de fonction dans un module de gabarit ;
     - aucune propriété d'identité dans une feuille hors kit (A1) ;
     - aucun `style=` hors variables CSS (A2) ;
     - aucune primitive hors du kit.
6. **Harmonisation** (règle 8), nature par nature, de la plus dispersée à la moins dispersée (carte § 9) :
   - lignes libellé-valeur, titres, sous-titres et rubriques, notes, étiquettes, puces et listes, filets, bulles, plaques, jauges ;
   - la forme est montrée sur un écran, puis le catalogue est réduit et appliqué partout ;
   - « À valider » dans `kit.md`.

## Hypothèses

- **Le pixel constant est atteignable** malgré les textures à graine, les polices locales et les mesures après montage. L'étape 1 le mesure. Si deux passes du même arbre diffèrent au-delà d'un bruit d'anticrénelage, la règle 7 se réécrit avant le catalogue.
- **Renommer les clés du relevé `contenu` est sans danger** : `data-texte` et les classes peuvent changer, et c'est la comparaison au pixel qui prouve qu'un rect n'a pas bougé.

## Hors périmètre

- Le noyau et Godot : #4574 (projeter des données) et #4575 (Compendium). Le noyau s'adapte après la validation des maquettes.
- Les décors de `#scene` et leurs peintres.
- Les choix ouverts des « À valider » existants.
