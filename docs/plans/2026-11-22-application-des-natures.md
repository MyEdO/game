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
| séparateur | `separateur('median')` : « · » entre deux espaces, sans boîte (`display:contents`) | `5754e8627b` (bascule des cartes), `298308183` (les « · » écrits dans `rendu.js`) | passe 0 rouge ; voir la preuve du lot 3 |
| filet | `filet({ fondu, losange, or })` ; sa marge est du placement | `25f3826e0f` | passe 0 rouge ; 69 états attendus, tous changés ; formats sans relevé neuf ; deux écarts hors attendu en `bureau` seulement, non expliqués : `dossier-du-navire-cargaison` (2 px), `mer-conseil-de-bord` (1 px) |
| jauge | `rangDePas({ pleins, total, taille, teinte, forme })` : losanges écart 8, `petit` 11, `cire` ; forme `clous` | `cc4f7cfeb` | passe 0 rouge ; voir la preuve du lot 3 |
| plaque | `plaque(libelle, { taille })` : `petite` 13, `moyenne` 15, `appel` 18, `geste` ; un nombre seul dans `prix` ; outil au kit ; `medaillon({ vise })` | `cfff50879` | idem |
| bulle | `raison(texte, { survolee })` : une ligne jusqu'à 320, puis à la ligne ; corps de l'`apercu` au kit ; `reserves` au kit, `compteur` supprimé ; 0 `title=` | `8e63cbab7` | idem |
| ligne libellé-valeur | `ligne({ libelle, valeur, variante, format, dessous, etat, cle })`, `.libelle-valeur` (`courante`, `empilee`, `mesure`, `tabulaire`) | lot 4a | voir la preuve du lot 4a |

Teintes d'étiquette hors des quatre prévues, choisies sans question (révisables, un argument chacune) :
- `pill.fermee`, `palier.ferme` et `attend.autre` → `fer` ;
- `palier.zero` et `palier.pris` → `or` ;
- `attend.sombre` et `.defaut` → au repos.

Le cartouche ouvert de la fiche du héros prend le cran `grand` du cartouche (22 px), et non le `moyen` de la simulation : une règle par primitive, sans paramètre pour un seul cas.

## Reste, dans l'ordre

1. **Lot 4b** : `ligneDeListe` (28 px, 44 avec une précision dessous ; puce losange ou coche). Elle se compose des primitives déjà posées et passe donc en dernier.
2. **Nettoyage des groupes `textes` et `listes-et-noms`**, une fois leurs natures posées (le groupe `pieces-et-jauges` est nettoyé) :
   - `sources/kit/proposition-<groupe>.js` et son CSS local partent ;
   - la planche montre les primitives et sa feuille passe dans `kit/planche.js`, sans contournement de `data-etat` ;
   - `kit.md` (catalogue et § 2) dit l'état après le lot ;
   - les citations `fichier:ligne` se recalent.
3. **Hors des natures**, à lister en tête de la page de jugement ou à donner à un lot :
   - chiffres en gothique (sceaux, disques, seuils : 538 sites) ;
   - mot d'issue et verdict ;
   - cartes de choix ; saisie ; prose ;
   - `regleMaison` et `pref` des options ;
   - `.carac`, `.case-bourse` ;
   - sous-titres de `bataille-de-masse-issue` (même émission que l'état sans issue).
4. Étapes 4 à 6 du plan (tables, dictionnaire, gardes finales) : 0 px, rien de visible.

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

Le lot 3 a repris ainsi les états qui ne tenaient pas. Ce sont des choix d'ingénierie, révisables :
- **la bulle s'arrête à 320 px**, et non à 300 : le plus long refus du noyau, « Dernière panoplie — un héros en garde toujours une. » (301 px), tient alors sur une ligne au-dessus de la croix de la panoplie. Cela vaut pour la prothèse, le-bord et le Compendium ;
- **la raison en ligne garde la taille de la ligne secondaire qu'elle remplace**, en Spectral italique, au lieu du 13/16 prévu. À 13/16, elle débordait le chemin du changement de carrière et coupait l'aide des options ;
- nuit (bivouac) : la nourriture met son libellé au-dessus de ses plaques ;
- fenêtre du jet :
  - les lignes de réglage sans figure sont pleines (`pleine-1` sur deux bandes, son libellé au-dessus des options) ;
  - « Au hasard » est un rond `menu`.

Preuve du lot 3 (jauge, plaque, bulle, séparateur), contre la référence `0636a6206` :
- passe : 57 écrans, 170 états, 8 planches, 0 rouge ;
- pixels : 130 états changés, aucun hors attendu, aucun relevé neuf ; six états attendus restent inchangés (`creation-talents`, les trois fins de combat, `fuite-seuil-survole`, `tour-adverse`) ;
- l'attendu du séparateur compte 40 états : tout « · » écrit déplace le calage du texte qui l'entoure, et ses voisins portent aussi les pas des jauges ;
- typecheck complet, `oxlint`, `docs:check` et `test:perimetre` au vert.

Autres choix du lot 3, révisables :
- les prix écrits en mots (« sans PX », « sans achat ») passent en Chiffres avec le reste de `prix` ;
- les infobulles natives deviennent des raisons cachées ;
- le compteur cède la place aux réserves, et la fiche du combat montre la bulle de Destin survolée ;
- le séparateur prend des espaces ordinaires plutôt que fines, parce que Fell et Chiffres n'ont pas l'espace fine et que Grenze la dessine à 0,6 em ;
- les règles de famille qui stylaient tout `span` descendant visent désormais leur cible.
- dans la barre des éditeurs, la plaque à pictogramme seul garde sa marge de 9 : la barre est une disposition dense, et la marge du kit la rognait en bureau.

Preuve du lot 4a (ligne libellé-valeur), contre la référence `0f1c7705f` :
- passe : 57 écrans, 170 états, 8 planches, 0 rouge ;
- pixels : 82 états changés, aucun hors attendu ; l'attendu compte les 81 états à site de ligne ; les trois états de l'arrivée, changés hors attendu à la première comparaison, y sont ajoutés : leur hôte prend la hauteur des offres (disposition du gabarit) ; `options` et `verrou` restent inchangés, leurs lignes étant la préférence et la règle maison, hors de la ligne ;
- un relevé neuf en 16:10 (`bataille-de-masse`) : l'aperçu d'une Scène et le billet d'un poste se plaçaient par `bottom` sur une hauteur de 720 et couvraient en 16:10 les portraits de leur Scène. Ils se placent désormais par `top`, à 0 relevé ;
- typecheck complet, `oxlint`, `docs:check` et `test:perimetre` au vert.

Choix du lot 4a, révisables :
- la ligne émet `.libelle-valeur` : `.ligne` porte déjà la ligne de liste ;
- l'hôte du commerce passe de 196 à 204 de haut, 170 pour un porteur (156) : la table de l'offre et la jauge du porteur tiennent sans masque ;
- la colonne basse de droite des poursuites : `plein` sur 120, le geste à 140 ; la page du lieu : corps 256, pied à 328 ;
- dans la fenêtre du jet, le libellé d'une ligne de réglage passe à la ligne serré (13 d'interligne), et les plaques d'options ont une marge de 6 ;
- l'effet d'une issue (enjeu de la Focalisation) passe à la ligne serré, sur 17 ;
- le libellé d'un acquis de la création passe à la ligne au séparateur, son étiquette de PX avec lui ; le physique est en lignes `empilee` ;
- la rangée de total d'un compte devient `somme` (filet au-dessus, gras) ; la valeur en chiffres d'une rangée a 20 d'interligne, pour que la rangée garde 24 ;
- l'entrée d'une rangée ne passe jamais à la ligne ; seule la valeur des aperçus (sort, Scène, poste) et de l'enjeu le peut.

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
