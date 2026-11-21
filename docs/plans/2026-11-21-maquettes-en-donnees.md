# Maquettes Godot : primitives d'abord, écrans en données

Ticket: #4585, #4411

(#4585 : vérification du contenu entre états et restes de la revue des maquettes ; #4411 : cadres fixes des maquettes Godot.)

## Qualification

- **But réel** : chaque écran des maquettes (`hotes/godot/cibles/propositions/`) se construit à partir de données sémantiques, et un rendu générique les dessine avec les primitives du kit. Une même nature d'information a donc le même dessin partout, et un défaut corrigé une fois l'est sur tous les écrans. Doctrine `user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage` : « leur JSON porte les données dans la forme visée, et le rendu dessine le kit ».
- **Livrable** : le code des maquettes migré (`sources/`), le kit à jour (`kit.md`), une garde et des relevés qui empêchent la rechute, et la page de jugement republiée.
- **Fini** : les 9 gabarits ont 0 contenu hors primitive (relevé `primitive`, défini plus bas). Il ne reste plus aucune fonction de rendu propre à un écran ni aucune feuille de famille qui style une primitive, hors décors. La passe complète est verte depuis le dépôt.
- **Déjà tranché** :
  - les doctrines `boites-fixes-d-un-ecran-a-l-autre`, `icone-identifie-survol-detaille` et `le-jeu-envoie-des-donnees-pas-leur-affichage` ;
  - les données d'un état restent **sémantiques**. C'est le gabarit qui associe chaque nature à sa primitive et à sa place. On n'écrit ni place ni primitive dans les données d'un état ;
  - les relevés existants (cadres, places, contenu, masque, etc.) restent bloquants.
- **Irréversible** : rien. Tout passe par branche, PR et file de fusion.

## État mesuré (HEAD 3d2a59adcf, carte du 2026-11-21)

- **Données déjà sémantiques** : aucun HTML dans les 170 états. Les valeurs sont typées (`tour:{rang,sur}`, `cumul:{dr,vise}`…). Il reste environ 135 textes composés (valeur et mot mêlés), surtout dans `fenetre-du-bas` (68) et `lieu-et-voyage` (34).
- **Le rendu n'est pas générique** :
  - 228 fonctions de `rendu.js` dessinent, dont environ 150 propres à un seul écran ;
  - environ 1 230 balises écrites sur place, contre environ 600 appels de primitive ;
  - `rendu.js` compose lui-même des textes (« ≤ N », « tour r sur s », « Round n »).
- **Le style des primitives est dispersé** : 179 règles hors `gestes.css` stylent une primitive elle-même, et 156 de plus la stylent en contexte. On trouve des doublons contradictoires (`.apercu`, `.pas.petit`, `.dr`) et 58 identifiants comme sélecteurs.
- **Outillage** :
  - `rendre.mjs` sort en 1 sur tout relevé non vide ;
  - `contenus.mjs` agrège ;
  - `npm run godot:maquettes` (`passe.mjs`) arrive avec l'atterrissage de #4585 ;
  - playwright n'est pas déclaré dans `package.json` ;
  - aucun outil du dépôt ne compare les maquettes au pixel.

## Règles de la migration

1. **Pixel constant.** Un état migré se compare au pixel à son rendu d'avant la migration, avec la même tolérance d'anticrénelage que celle mesurée sur deux rendus identiques. Un écart, c'est une erreur de migration, jamais un choix.
2. **Une nature, une primitive.** Toute information visible passe par la primitive de sa nature. Une primitive porte sa classe racine, son style (dans `gestes.css` ou dans le fichier de la primitive) et sa marque `data-primitive`. Il n'y a pas de variante par écran : un deuxième cas réel se traite par un paramètre, jamais par une surcharge de famille.
3. **Le gabarit assemble.** Un gabarit déclare ses places (`PLACES`) et la nature qui remplit chacune. Le rendu d'un état se réduit à : gabarit, puis places, puis primitives nourries des données de l'état. Les décors SVG (peintres) restent à part, ce ne sont pas des éléments d'interface.
4. **Les mots à part.** Un texte composé quitte les données et le rendu : la donnée porte la valeur, la primitive pose le mot. Cette règle se traite dans la migration de chaque gabarit, sans changement visible.
5. **Rien d'autre dans un lot de migration.** Toute amélioration visible va dans un lot d'harmonisation à part (étape 5).

## Étapes

0. **Atterrir #4585** (en cours) :
   - commande de passe complète dans le dépôt, avec un code de sortie fiable ;
   - passe complète, gardes de texte de la file de fusion, `test:perimetre` ;
   - PR en auto-fusion et page de jugement republiée.

   *Preuve* : CI verte, PR fusionnée.
1. **Outillage de migration**, dans le dépôt :
   - **comparaison au pixel** : rendu de référence de tous les états à une tête donnée, puis comparaison état par état, avec un code de sortie non nul au-delà de la tolérance. La tolérance se mesure sur deux rendus successifs de la même tête ;
   - **relevé `primitive`** : chaque primitive marque sa racine (`data-primitive`). Le relevé compte, par gabarit, le contenu visible (texte, image, contrôle) qui n'est sous aucune racine de primitive ni dans un décor. En mode rapport d'abord : son compte par gabarit sur HEAD fixe le périmètre ;
   - **déclarer playwright** selon la voie canonique du dépôt, ou consigner l'écart si elle n'existe pas.

   *Preuve* : chaque outil est prouvé par mutation, et le rapport initial est produit.
2. **Pilote : `fenetre-du-bas`** (49 états, et 16 de plus via `lieu-et-voyage`) :
   - migrer jusqu'à un relevé `primitive` à 0 et une comparaison au pixel à 0, en sortant les textes composés du rendu et des données ;
   - montrer à l'utilisateur le fichier de données d'un état à côté de son écran ;
   - mesurer le coût réel : temps, fonctions supprimées, règles de famille retirées.

   *Preuve* : relevé et comparaison verts, `jet.css`, `rendu.css` et `combat.css` sans règle sur une primitive pour ce gabarit. **Point d'arrêt** : on ne passe à l'étape 3 qu'avec l'accord de l'utilisateur sur la forme des données.
3. **Gabarits suivants**, dans l'ordre de la carte, du plus petit au plus gros : `recit`, `ouverture`, `consultation`, `edition`, `combat`, `gestion`, `fiche`, `lieu-et-voyage`. Un gabarit fait un lot, avec la même preuve que le pilote. Le relevé `primitive` devient bloquant gabarit par gabarit, comme le relevé `contenu`.
4. **Garde finale.** Le relevé `primitive` devient bloquant partout. Une garde de dépôt refuse toute règle d'une feuille de famille dont le sélecteur le plus à droite est la classe racine d'une primitive, ainsi que tout HTML écrit sur place dans le rendu d'un gabarit.
5. **Harmonisation**, en lots visibles, après la migration de chaque nature :
   - pour chaque nature d'élément aux variantes dispersées (titres de cadre, rubriques, puces, filets, plaques, étiquettes, jauges, lignes libellé-valeur, notes), une seule forme ;
   - la forme est montrée d'abord sur un écran, puis appliquée par sa primitive à tous ;
   - « À valider » dans `kit.md` et dans les familles touchées.

   L'ordre suit le relevé des variantes, de la plus dispersée à la moins dispersée.
6. **Propagation des primitives nées pour un écran** : bourses, réserves, colonne, issue, aperçu, profil, registre (carte de propagation du 2026-11-21). Elle est absorbée par les étapes 3 et 5 : chaque site migre vers sa primitive dans le lot de son gabarit.

## Hypothèses

- Le pixel constant est atteignable malgré les textures à graine et les polices locales. L'étape 1 mesure la tolérance ; si elle ne suffit pas, la règle 1 se réécrit avant le pilote.
- Les identifiants `data-texte` et les clés du relevé `contenu` peuvent changer pendant la migration. Le relevé `contenu` se rejoue à chaque lot ; une clé renommée n'est pas un écart si le rect reste le même.

## Hors périmètre

- Le noyau et Godot : #4574 (projeter des données) et #4575 (Compendium). Les maquettes reprennent la forme visée, et le noyau s'adapte après validation.
- Les décors SVG et leurs peintres.
- Les choix ouverts des « À valider » existants : ils restent à l'utilisateur.
