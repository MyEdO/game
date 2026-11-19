# Cadres fixes : avis de Fable, 2026-11-19

Contexte : décision de Clément du 2026-11-19 : « Rien de pire que des boites qui bougent d un écran à l autre, ce n est pas acceptable ». Rects en px logiques 1280 × 720 (x, y, w, h), dérivés des mesures des 162 états et de 12 rendus regardés. Ce sont des calculs, à confirmer au rendu.

## Constats
- Plusieurs pièces « qui bougent » sont en réalité deux rôles sous un même nom (`fin`, `barre`, `gestes`, `carte`, `titre`). On donne d'abord un nom par rôle.
- Le journal, la page et la carte du monde suivent la hauteur du cadre du bas. Une hauteur unique supprime ces règles.
- Les panneaux à hauteur de contenu (arbitrage du 18/11) sont annulés : cadre fixe, action au pied, contenu en haut.

## Bas de l'écran
- **Socle `160, 560, 960, 152`** : bandeau de groupe et barre de l'actif (138 → 152). Toujours 4 cases de 240, y compris sur les écrans de héros.
- **Fenêtre du bas `160, 500, 960, 212`** : hauteur unique ; 170 et 266 disparaissent. Elle a le même x, la même largeur et le même bas que le socle ; seul le haut monte de 60 px, quand une fenêtre s'ouvre.
- Repli si deux rects sont refusés : socle à 212 partout (60 px de décor perdus en permanence).

## Débordement
Aucune troncature. La prose se pagine. Les colonnes et les pages défilent entre un ruban et une action au pied fixes, avec un fondu. Dans la fenêtre du bas, au-delà de 3 ou 4 cartes, on passe à une liste paginée « 1-3 sur 5 ». Le journal estompe ses lignes anciennes.

## Mobiles légitimes
Marqués `data-mobile` + `data-ancre` :
- `survol` : aperçu, bulle de refus ;
- `scene` : marques, pastilles d'entité, chose, postes, scènes ;
- `ancre` : liste déroulée, fiche d'un combattant.

Tout autre `data-piece` a le même rect dans tous les états. Structure : une table rôle → rect dans `rendu.js`, et plus aucune position par écran dans `rendu.css`.

## Écrans à problème
1. **Fenêtres à 266.**
   - Désengagement, poster un héros, dialogue, test d'équipage et chanson tiennent en 212.
   - Le butin ne tient pas : 2 lignes puis défilement, ou il devient un carton.
2. **Consignes à 170** : passent à 212.
3. **Cartouche de voyage (632)** : la cadence part au pied du panneau du navire.
4. **Postes de bord** : la station devient un onglet du panneau.
5. **Bivouac** : le corps du dortoir défile.
6. **Marchandage et départ de nuit** : la page garde son rect ; la fenêtre couvre son pied réservé.
7. **Port** : une seule colonne d'hôtes.
8. **Fiches** : bande de profil à 96 ; identité à 536 comme le héros.
9. **Issue de combat** : 560 × 150.
10. **Cartons** : `160, 222, 960, 328`, document paginé.
11. **Ouverture** : entrées fixes.
12. **Retour** : zone de libellé fixe de 124 × 2 lignes.

## Tableau rôle → rect
| Rôle | Rect |
|---|---|
| cartouche (météo en 3e ligne) | 24, 20, 372, 96 |
| titre-libre (ouverture) | ancre 84, 52 |
| entrees | 88, 236, 330, 433 |
| recit | 32, 136, 340, 112 |
| colonne-gauche | 24, 136, 372, 304 (gestion : 24, 136, 372, 560) |
| note (rumeur) | 24, 456, 372, 100 |
| hotes devant une page | 412, 20, 340, 536 |
| hotes devant une colonne | 412, 20, 468, 536 |
| colonne-droite pleine | 896, 20, 360, 420 |
| vignette | 896, 20, 360, 180 |
| colonne-droite basse | 896, 220, 360, 220 |
| page | 776, 20, 480, 536 |
| ouvrir-1, ouvrir-2 | 1076, 460, 180, 44 et 1076, 512, 180, 44 |
| journal | 956, 316, 300, 132 |
| socle | 160, 560, 960, 152 |
| fenetre | 160, 500, 960, 212 |
| carton | 160, 222, 960, 328 |
| issue | 360, 190, 560, 150 |
| retour | 30, 592, 124, 94 |
| coins | 1198, 579, 52, 118 |
| systeme (combat), fermer | 1214, 18, 44, 44 |
| action-de-coin | 1120, 603, 136, 89 |
| round | 22, 16, 214, 66 |
| ordre | 22, 96, 134, 616 |
| fin-du-tour | 1133, 582, 104, 116 |
| identite | 26, 20, 340, 536 |
| profil | 384, 20, 800, 96 |
| sections de fiche | 384, 136 → 1256, 556 |
| carte-du-monde | 24, 136, 852, 420 |
| signets | 1096, 66, 176, 626 |
| registre | x 420 → 1094, y 60 → 696 |
| création, éditeur | inchangés, déjà fixes |


---

# Brief du lot (tel que donné à l agent)

# Mission : un rectangle fixe par cadre récurrent dans les maquettes (#4411), et le contrôle qui l'impose

Dépôt : worktree `/tmp/claude-0/wt-cadres` (branche `chantier/4411-cadres`, partie de `chantier/4411-revue`). Travaille UNIQUEMENT là (chemins absolus). Ne committe pas, jamais `git add`, ne change pas de branche. L'orchestrateur relit et enregistre.

## La règle (décision utilisateur)
Lis `.claude/memory/user-doctrine-boites-fixes-d-un-ecran-a-l-autre.md`. Clément, 2026-11-19 : « Rien de pire que des boites qui bougent d un écran à l autre, ce n est pas acceptable ». Il a choisi pour le bas de l'écran « Bandeau 152 + fenêtre 212 ».

## La grille
La grille à appliquer est `/mnt/project-files/4411/grille-cadres-fixes-avis-fable.md` (avis de Fable : tableau rôle → rect, débordements, mobiles, 12 écrans à problème). Applique-la telle quelle. Si un rect ne tient pas au rendu, ajuste au plus près et dis-le dans ton rendu, avec la raison.

Lis aussi :
- `docs/plans/2026-11-18-kit-maquettes-brief-famille.md` ;
- `hotes/godot/cibles/propositions/kit.md` et `dispositions.md` ;
- `sources/rendre.mjs`, `sources/rendu.js`, `sources/rendu.css`, `sources/gestes.js` et `sources/gestes.css`.

## Ce qu'il faut faire
1. **Un nom de `data-piece` par rôle.** Défais les homonymes (`fin`, `barre`, `gestes`, `carte`, `titre`, etc.) selon la grille.
2. **Une seule table rôle → rect dans `rendu.js`.** Toutes les positions et tailles des cadres récurrents en sortent. Plus aucun `top`, `left`, `width` ni `height` de cadre par écran, ni `:has()` de position dans `rendu.css` ou dans les feuilles de famille. Ce que le geste traverse et qui devient mort se supprime.
3. **Le contenu s'adapte au cadre :** défilement interne marqué `data-defile` avec un signal de suite, pagination, onglets, comme le dit la grille. Jamais de troncature.
4. **Les mobiles** (aperçu, bulle, marques de décor, liste déroulée, fiche d'un combattant…) portent la marque `data-mobile`. C'est la seule exception, jamais une liste de noms.
5. **Nouveau relevé dans `rendre.mjs`** (nom court, par ex. `bouge`). Il compare, pour une même maquette et entre tous les écrans rendus, le rect de chaque `[data-piece]` sans `data-mobile`.
   - Il signale tout rôle dont le rect diffère d'un état ou d'un écran à l'autre, que l'écart soit de taille ou de position.
   - Aujourd'hui, `rendre.mjs` rend un écran à la fois. Trouve le moyen le plus simple de comparer entre écrans : une référence unique tirée de la table de `rendu.js` suffit, chaque pièce étant comparée à SA ligne de la table. C'est même préférable, car la table devient la seule source de vérité.
   - Prouve qu'il attrape l'état actuel (colle un extrait des relevés avant), puis qu'il est vide après.
   - Mets à jour le commentaire d'en-tête.
6. **Restes de la revue à corriger dans le même geste :**
   - Les bulles de refus ne doivent couvrir AUCUN texte, pas même le libellé de l'élément refusé. Cas actuels :
     - `voyage-en-mer` · `mer-conseil-de-bord` : la bulle cache le titre de la carte refusée ;
     - `options` · `verrou` : elle cache toute la règle « Sur la Défensive » ;
     - `dossier` · `dossier-du-vehicule` : elle mord sur la rubrique « Abandonner la charrette ».

     Quand il n'y a de place ni au-dessus ni au-dessous, la raison du refus prend la place de la ligne secondaire de l'élément refusé. Ce n'est plus une bulle posée dessus. Étends le relevé `chevauche` pour que l'élément refusé ne soit plus exempté.
   - `le-bord` · `activites-en-mer` : « tenu par les PJ — aucun équipage PNJ » est du jargon de table. Cherche le libellé du jeu dans `src/i18n/messages/fr.ts` ; sinon, écris une phrase simple pour un joueur (vos héros, des marins).
7. **Docs vivantes :** réécris la grille de `dispositions.md` (le tableau rôle → rect devient la référence ; les hauteurs 170/266, le bandeau à 720/480 et les panneaux à hauteur de contenu disparaissent) et mets `kit.md` à jour s'il est touché.

## Preuve
- `cd /tmp/claude-0/wt-cadres && npm run typecheck:fast` : 0 erreur, sortie complète lue.
- Rendu de TOUS les états, un Chromium à la fois :
  `cd /tmp/claude-0/wt-cadres/hotes/godot/cibles/propositions/sources && for f in maquettes/*.ts; do n=$(basename $f .ts); grep -q "export default" $f || continue; node rendre.mjs $n /tmp/claude-0/rendus-cadres/$n.png --format 16:9; done`
  Tous les relevés vides (y compris le nouveau), `defile` false, `erreurs 0`.
- Mesure : relance `/tmp/claude-0/-home-user/bbee76cf-fb80-5c6b-a445-654e1dfbfe02/scratchpad/kit/bas.mjs` en l'adaptant au worktree (ou un équivalent), et donne le nombre de rôles partagés dont le rect varie (cible : 0 hors `data-mobile`).
- Regarde toi-même (Read) le png de CHAQUE état. Tous changent : fais des planches 2×2 avec `montage` pour aller vite, mais regarde-les toutes.
- `npm run test:perimetre`, en fin de travail, lancé seul. Note connue : 5 fichiers `node --test` (contrat-typescript, hooks) échouent dans un worktree à `node_modules` en lien symbolique et passent sur l'arbre principal. Ne t'y attarde pas, mais donne la liste exacte des rouges.

## Rendu attendu
- la table rôle → rect finale, avec les écarts à la grille de Fable et leur raison ;
- le relevé ajouté et la preuve qu'il attrapait l'état d'avant ;
- les corrections par écran et les choix de design non tranchés ;
- la sortie du typecheck et de `test:perimetre` ;
- le bilan du rendu et la mesure des rects ;
- les planches regardées ;
- `git status --short`.
