# Application des natures aux maquettes : état et reprise

Ticket: #4585

(#4585 : Maquettes Godot, vérification du contenu entre états, puis restes de la revue du 2026-11-20.)

Ce document porte l'application des natures d'interface aux maquettes. Il sert de reprise pour le fil qui continue le chantier. Le cadre vient de `docs/plans/2026-11-21-maquettes-en-donnees.md`, étape 3 et règle 7. Chaque nature a une primitive au kit, une forme par rôle et par fond, et s'applique en une passe.

## Ce que l'utilisateur a tranché

- **Titres** : réponses du 2026-11-22, `docs/plans/2026-11-21-lot-titres.md`. Appliqués et prouvés : `c77ebcb454`, `2a0e16a601`.
- **Les neuf autres natures et l'échelle des noms** passent par un seul point d'arrêt. Choix du 2026-11-22 : « Un seul arrêt (Recommandé) ».
- **Les 13 questions des trois groupes** ont reçu le 2026-11-22 la réponse « Tout accepter (Recommandé) ». Chaque doc de groupe porte la liste acceptée :
  - `docs/plans/2026-11-22-lot-textes.md` ;
  - `docs/plans/2026-11-22-lot-listes-et-noms.md` ;
  - `docs/plans/2026-11-22-lot-pieces-et-jauges.md`.
- **Après l'application**, l'utilisateur juge les maquettes finales écran par écran. Ce n'est pas un nouveau point d'arrêt par nature.

## État par nature

| Nature | Primitive, classe | Commit | Preuve |
|---|---|---|---|
| sous-titre | `sousTitre({ texte, cle })`, `.sous-titre` | `e1a149e34b` | passe 0 rouge ; 165 états changés = attendu ; formats sans relevé neuf |
| rubrique | `rubrique({ texte, note, fin })`, `.rub` | `e1a149e34b` | idem |
| note | `glose({ texte, variante, cle, secondaire })`, `.glose` (`courante`, `consigne`, `avertissement`) | `e1a149e34b` | idem |
| nom | `nom({ texte, taille, cle })`, `.nom-propre` (`grand` 22/30, `moyen` 18/24, `petit` 16/22) | `35e4297dab` | 149 états = attendu ; `bureau` : profil du changement de carrière débordait, repris dans `25f3826e0f` |
| étiquette | `etiquette({ texte, variante, teinte, valeur })` (rectangle, pastille, compte ; or, cire, fer) | `5754e8627b` | pas d'état changé hors attendu ; l'étiquette rognée du début du round est reprise dans `25f3826e0f` |
| puce | `puce('losange' \| 'coche')`, `.losange`, `.coche` | `5754e8627b` | idem |
| séparateur | `separateur('median')`, `.separateur.median` | `5754e8627b` pour la bascule des cartes seulement | les « · » écrits en texte restent à faire (voir Reste) |
| filet | `filet({ fondu, losange, or })` ; sa marge est du placement | `25f3826e0f` | passe 0 rouge ; 69 états attendus, tous changés ; formats sans relevé neuf ; deux écarts hors attendu en `bureau` seulement, non expliqués : `dossier-du-navire-cargaison` (2 px), `mer-conseil-de-bord` (1 px) |

Teintes d'étiquette hors des quatre prévues, choisies sans question (révisables, un argument chacune) :
- `pill.fermee`, `palier.ferme` et `attend.autre` → `fer` ;
- `palier.zero` et `palier.pris` → `or` ;
- `attend.sombre` et `.defaut` → au repos.

Le cartouche ouvert de la fiche du héros prend le cran `grand` du cartouche (22 px), et non le `moyen` de la simulation : une règle par primitive, sans paramètre pour un seul cas.

## Reste, dans l'ordre

1. **Lot 3, groupe `pieces-et-jauges`** (doc du groupe), une nature à la fois :
   - jauges (pas 15 et 11, écart 8, teinte cire ; forme `clous` à part) ;
   - plaques et boutons (petite 13, moyenne 15, appel 18, `geste` 13/12 ; un nombre seul va dans `prix` en Chiffres 12,5 ; outil 11,5 ; médaillon `vise`) ;
   - bulles (`raison` sur une ligne jusqu'à 300 px puis à la ligne ; raison en ligne en Spectral italique 13/16). Par doctrine `user-doctrine-icone-identifie-survol-detaille` :
     - les 113 infobulles natives (`title=`) deviennent une `raison` au survol, jusqu'à 0 `title=` ;
     - le compteur devient icône et nom au survol. Chaque réserve garde son picto, et au moins un état montre la bulle : sinon le libellé devient une information cachée.
2. **Séparateur écrit en texte** : 91 « · » dans `sources/rendu.js`, une passe à part, après les bulles. Converti trop tôt, il cassait le HTML partout où la chaîne finit dans un attribut ou est découpée par un consommateur :
   - `title="${bulle}"` (`combat/jet.js`, nourri par `rendu.js`) ;
   - le `title` des issues ;
   - les bornes de `frise` ;
   - le marchandage.

   Le contrôle se fait producteur par producteur. `&nbsp;·&nbsp;` est un médian insécable.
3. **Lot 4** : `ligne` (libellé-valeur : `courante`, `empilee`, `mesure`, `tabulaire` ; libellé = `rubrique()`, sauf la ligne de tableau en Spectral 13,5) et `ligneDeListe` (28 px, 44 avec une précision dessous ; puce losange ou coche). Elles se composent des primitives déjà posées et passent donc en dernier.
4. **Nettoyage de chaque groupe**, une fois toutes ses natures posées :
   - `sources/kit/proposition-<groupe>.js` et son CSS local partent ;
   - la planche montre les primitives et sa feuille passe dans `kit/planche.js`, sans contournement de `data-etat` ;
   - `kit.md` (catalogue et § 2) dit l'état après le lot ;
   - les citations `fichier:ligne` se recalent.
5. **Hors des natures**, à lister en tête de la page de jugement ou à donner à un lot :
   - chiffres en gothique (sceaux, disques, seuils : 538 sites) ;
   - mot d'issue et verdict ;
   - cartes de choix ; saisie ; prose ;
   - `regleMaison` et `pref` des options ;
   - `.carac`, `.case-bourse` ;
   - sous-titres de `bataille-de-masse-issue` (même émission que l'état sans issue).
6. Étapes 4 à 6 du plan (tables, dictionnaire, gardes finales) : 0 px, rien de visible.

## Méthode d'un lot de nature

Elle a servi aux lots ci-dessus et s'applique telle quelle au lot suivant.

1. **Attendu avant toute édition.** On écrit la liste des états qui portent au moins un site de la nature dont la forme diffère de la cible, plus tous les états d'un gabarit dont la disposition change. On ne la retouche pas après coup.
2. **Collision de classe.** La classe émise ne porte aucun autre sens (`git grep`). Exemples :
   - `.titre` a coûté une reprise (l'en-tête de l'aperçu, renommé `entete`) ;
   - `nom`, `note` et `ligne` avaient déjà d'autres sens.
3. **Primitive au kit** (`sources/gestes.js`, `sources/gestes.css`), forme lue au fond (`.bois`, `.parchemin`), jamais une couleur en paramètre.
4. **Application en une passe.** Chaque surcharge de famille qui changeait la forme part, après un inventaire par `git grep`.
5. **Un site qui ne tient pas se reprend par sa disposition** : feuille de famille, ou table de rects de `sources/rendu.js`. Jamais par une taille propre au site. Aucun texte ne se coupe ni ne se masque.
6. **Preuve** :
   - passe sans rouge ;
   - pixels : états changés = attendu, sans état hors attendu ;
   - écart de style relu (rien ne change hors de la nature) ;
   - formats 21:9, 16:10 et `bureau` sans relevé neuf ;
   - `typecheck:fast`, `oxlint`, `test:perimetre`.
7. **Commit par nature.** Une limite d'usage n'arrête alors jamais l'arbre à moitié appliqué.

La simulation combinée des trois groupes, faite avant l'application avec les seules options validées, a mesuré 35 états qui ne tiennent pas. Elle a aussi tranché les éléments que deux groupes stylaient :
- `span.jeton` et `span.modif` sont des étiquettes ;
- `p.aide.raison-de-refus` est une raison en ligne (lot 3) ;
- `p.prose.pied` n'appartient à aucune nature.

Restent du lot 3 :
- fiche du héros (prothèse) : la bulle couvre « Possessions » ;
- le-bord et Compendium : `retrecit` à 300 px ;
- changement de carrière : `retrecit` `pt` ;
- nuit (bivouac) : « Rien » × portrait ;
- fenêtre du jet : plaques des options.

## Outils

- `npm run godot:maquettes` : la passe (16:9, relevés bloquants, planches).
- `npm run godot:maquettes:reference [-- --ecran <écran>…]` pose `dist/maquettes-reference` : les PNG des 170 états × 4 formats, le relevé de chaque état par format (`<format>/releves.json`) et le style calculé de chaque texte en 16:9 (`styles/`, capturé par `rendre.mjs` sous `RELEVE_STYLES`, sans second rendu). Une référence d'avant cet outil est refusée : la première commande d'une reprise est donc de poser la référence sur la tête.
- `npm run godot:maquettes:comparer -- [--ecran <écran>…] [--attendu <attendu.json>…] [--style-bloquant]` rend l'arbre et rapporte :
  - les PNG qui diffèrent ;
  - les états attendus restés inchangés et les états changés hors attendu ;
  - les relevés neufs de chaque format ;
  - l'écart de style (`<sortie>/style-ecart.json`, résumé sur la sortie standard).

  Il sort en 1 dans quatre cas : un état changé hors attendu, un PNG sans pendant, un relevé neuf, ou un écart de style sous `--style-bloquant`. Le calcul est dans `scripts/maquettes/ecarts.mjs`, son test dans `ecarts.test.mjs`. L'usage complet est au commentaire de tête de `scripts/maquettes/pixels.mjs`.
- Un lot se vérifie ainsi :
  1. sur la tête de départ, `godot:maquettes:reference` ;
  2. l'agent écrit l'attendu, puis applique ;
  3. `godot:maquettes` et `godot:maquettes:comparer -- --attendu <attendu-*.json>` ;
  4. relire `style-ecart.json`.

  Chacune des deux commandes longues dure environ 25 min ; elle se lance en tâche de fond ou dans une copie du dépôt (`git worktree add`, avec une copie de `node_modules/playwright` et `playwright-core`, jamais un lien), pendant que le lot suivant avance dans l'arbre principal.
- Les sondes d'un groupe (relevé DOM des sites d'une nature, feuille cible injectée par préchargement) ne sont pas versionnées. Elles se refont depuis le doc du groupe, qui donne la méthode.
