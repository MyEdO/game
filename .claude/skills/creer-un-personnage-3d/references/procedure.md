# Produire un élément 3D depuis une illustration

Procédure du skill `creer-un-personnage-3d`. Contrat d'élément :
`hotes/godot/asset/element.ts` ; contrat de base :
`hotes/godot/asset/manifesteDeBase.ts` ; mesures :
`hotes/godot/asset/evaluateur/evaluer.ts`. Design : #2972 « Base 3D commune et éléments indépendants », commentaires
[v4, catégories et couches](https://github.com/MyEdO/game/issues/2972#issuecomment-6389032417),
[chaîne et L5](https://github.com/MyEdO/game/issues/2972#issuecomment-6389032799),
[amendement par corps](https://github.com/MyEdO/game/issues/2972#issuecomment-6395825088).

## 1. Reconnaître la référence et vérifier la base

Ouvrir réellement l'illustration ; décrire ce qui est visible. Si elle manque ou reste illisible,
obtenir la référence avant de prétendre la reproduire. Illustration, contrat, captures et fiches
de mesures restent hors dépôt. Garder provenance et licences des donneurs.

La provenance cite chaque illustration par sa ligne de l'`INDEX.md` du recueil de référence (id
de `src/data`, fichier, livre et page), jamais par une copie : les images restent hors dépôt,
droits de l'éditeur. Chaque mesure se lit sur une illustration ou une donnée du jeu nommée (une
longueur de `vehicles.json`, une échelle en pixels par mètre relevée sur le profil) ; une mesure
qu'aucune ne donne est une **hypothèse**, listée comme telle avec sa valeur et sa raison, pour que
la revue la tranche. Citations et hypothèses vivent dans le `donnees.py` de l'élément, à côté de la
dimension qu'elles fondent : l'import n'en recopie rien.

Un élément est construit pour **une base identifiée**, avec son GLB, son manifeste complet haché
et les preuves de sa porte d'animation L1. Sur l'humanoïde : squelette UAL, corps UBC compatible,
chaînes et pistes cuites, zones, emplacements, prises, silhouettes et table de gabarit.
Lire ces noms dans le manifeste livré ; aucun nombre d'os personnel ni chemin absolu imposé.
Une autre forme de corps reçoit sa propre base ; un élément ne greffe pas un sous-squelette.

Avant de commencer, vérifier la porte sur tous les clips, les 13 gabarits, les six surcharges de
race et les extrêmes de silhouettes : mesure Node, témoin de jupe animé dans Godot, juge neuf,
puis revue utilisateur. Sans cette preuve, préparer le contrat ; la construction
compatible et sa validation restent **bloquées par L1**, jamais déduites d'un export réussi.

Le lanceur du kit installe/vérifie son environnement CPython épinglé (version et hashes dans
`scripts/personnage-3d/requirements.txt`) :

```sh
node scripts/personnage-3d/environnement.mjs
```

La commande de construction de base existe, mais relève de L1, pas de l'auteur d'un élément.
Elle utilise les fichiers UAL1, UAL2 et UBC (corps masculin et féminin) acquis avec leurs licences, le dossier `data`
de MPFB (donneur de la silhouette `corpulence`), et nomme le texte de licence
de chaque pack, lu dans le pack (`License.txt` à la racine de `Universal Animation Library[Standard]`,
`License_Standard.txt` à la racine de `Universal Base Characters[Standard]`, et pour MPFB, qui n'en
livre aucun, `LICENSE.ASSETS.md` de la racine de `makehumancommunity/mpfb2` au tag de la version
installée, déposé tel quel dans le dossier de l'extension, parent de `data`) :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py --ual1 "/atelier/sources/Universal Animation Library[Standard]/…/UAL1_Standard.glb" --licence-ual1 "/atelier/sources/Universal Animation Library[Standard]/License.txt" --ual2 "/atelier/sources/Universal Animation Library 2[Standard]/…/UAL2_Standard.glb" --licence-ual2 "/atelier/sources/Universal Animation Library 2[Standard]/License.txt" --corps "/atelier/sources/Universal Base Characters[Standard]/…/Superhero_Male_FullBody.gltf" --licence-corps "/atelier/sources/Universal Base Characters[Standard]/License_Standard.txt" --corps-feminin "/atelier/sources/Universal Base Characters[Standard]/…/Superhero_Female_FullBody.gltf" --licence-corps-feminin "/atelier/sources/Universal Base Characters[Standard]/License_Standard.txt" --mpfb /atelier/sources/mpfb/data --licence-mpfb /atelier/sources/mpfb/LICENSE.ASSETS.md --sortie /atelier/base/humanoide.glb
```

Les chemins `/atelier/…` des exemples désignent les fichiers locaux de production à choisir ;
ils ne sont pas fournis par le dépôt. Les packs de la base publiée vivent dans la Release `sources-3d`, une archive par
somme SHA-256 : `scripts/personnage-3d/base/sources.mjs` les tire dans `~/.cache/wfrp-sources-3d`, vérifie chaque
archive par sa somme et chaque source par l'empreinte de `packs_sources` de `humanoide.provenance.json`, refuse au
moindre écart, puis écrit les options `--<pack>` et `--licence-<pack>` :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py $(node scripts/personnage-3d/base/sources.mjs) --sortie /atelier/base/humanoide.glb
``` Vérifier unités, axes, échelle et pose de liaison de la base,
sans les modifier dans l'élément. Une coupure ne coûte qu'une passe : chaque passe du point fixe des poids écrit une
reprise (`reprises.py`) dans `<git-common-dir>/reprises-3d/<empreinte>`, l'empreinte de la révision, de ses écarts
suivis et des arguments ; relancer la même commande repart de la dernière, et `reprises-3d` s'efface une fois la sortie écrite.
La passe des membres (`membres.py`) imprime une ligne `MEMBRES` par clip du pack et ne refuse jamais : lire ces lignes
pour savoir quel clip est gardé ou rendu à sa source ; un clip dérivé (`deux_mains.py`) refusé arrête la construction.
La construction juge les clips dérivés comme la garde `membres` sur chaque état du gabarit (`verdict_du_tronc.py`) et
redérive un clip fautif sous sa visée accrue des états où sa peau entre dans le tronc, trois dérivations au plus
(`deux_mains.deriver_sur_les_etats`) : lire les lignes `VERDICT <clip> tour <k> cellules <n>` ; un clip encore fautif
arrête la construction en nommant son état, son image et sa profondeur.

Une retouche de la pose des bras d'un clip (clés de geste de `deux_mains.py`, passe de `membres.py`) s'itère au banc
avant de cuire la base. Le banc importe la base publiée, `~/.cache/wfrp-modeles-3d/<glb.sha256 du manifeste>.glb` que
`npm run godot:sonde` y tire, rejoue les clips nommés avec le code de l'arbre (`--deux-mains` : dérivés de
`deux_mains.CLIPS` et jugés sur les états du gabarit comme dans la construction ; `--pack` : passe de `membres.py`, `tous` pour le pack entier), réécrit les rotations des bras, des
clavicules et du dos de ces clips dans une copie du GLB, écrit à côté le manifeste à son empreinte et imprime la
commande `npm run godot:evaluer` à lancer sur cette copie :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/banc.py ~/.cache/wfrp-modeles-3d/<empreinte>.glb hotes/godot/projet/modeles/humanoide.manifeste.json --sortie /atelier/banc --deux-mains Hampe_Touche
```

Le banc prouve la garde Node sur la base publiée rechargée, clips rejoués. Il ne prouve pas la base cuite : la peau de
la scène rechargée s'écarte de celle de la construction (#3810), et les chaînes des clips rejoués restent celles de la
base publiée. Le banc ne réécrit que les clés existantes du GLB publié, quand la construction écrit ses clés aux instants
du clip : lire la sortie du banc comme une interpolation, entre deux clés, de poses que la passe n'a pas mesurées. Avant de publier, cuire la base et jouer `npm run godot:evaluer -- <base.glb> --manifeste
<manifeste> --etats-gabarit` sur sa sortie.

La construction exige `node` dans le `PATH` : avant Blender,
`scripts/personnage-3d/base/manifeste.mjs --verifier` refuse une sortie dans un arbre du dépôt (liens
et jonctions résolus), un dossier de sortie qui porte un autre fichier que le GLB, `manifest.json` et
les `LICENSE-<pack>.txt` qu'elle écrit, un pack sans `--licence-<pack>`, et un texte de licence
absent, hors des dossiers ancêtres de sa source, vide, ou dont la licence déclarée (ligne
`License:`, sinon titre) manque à `hotes/godot/asset/licences.json`. Après l'export, elle passe sa part du manifeste à `manifeste.mjs`, qui y ajoute la
déclaration du corps (`scripts/personnage-3d/base/humanoide.json` : `base`, porteur de référence,
`bornesArticulaires`, `clips`, la table rôle d'animation → clip dont le rôle `marche` est la marche plantée, `clipsDeuxMains`
(#3319), `prisesOccupees` (#3806), et `surfaces`, les matériaux du corps
et leur emplacement de palette, sans `blason`, chacun avec, en option, `parSexe` : par sexe, le matériau d'un corps
donneur que la construction recouche sur les UV de la surface et exporte en variante `KHR_materials_variants` du nom du
sexe, #3188), la vitesse au sol du clip du rôle `marche` mesurée par l'évaluateur, et
l'empreinte du GLB. Le manifeste refusé par `validerModele` (`hotes/godot/asset/modeles.ts`) fait échouer la construction.
Le dossier de la sortie devient le dossier de production de la base (`production.ts`) :
`manifest.json` (le manifeste complet sous `manifeste`, `model`, `model_sha256`,
`packs_sources`) et `LICENSE-ual1.txt`, `LICENSE-ual2.txt`, `LICENSE-corps.txt`,
`LICENSE-corps-feminin.txt`, `LICENSE-mpfb.txt`, copies des textes de licence des packs ; `packs_sources.<pack>` porte le
chemin, l'empreinte (d'un fichier, ses octets ; d'un dossier comme `data` de MPFB, la liste triée « chemin relatif,
SHA-256 » de ses fichiers) et la
copie de licence (`licence`) de chaque pack, que la provenance garde par pack sous le nom du texte
déposé. La base s'importe et se publie telle quelle (section 6) :

```sh
node hotes/godot/importer.mjs /atelier/base humanoide --destination /atelier/modeles
```

L'élément se valide et s'évalue ensuite contre `/atelier/modeles/humanoide.manifeste.json` et
`/atelier/modeles/humanoide.glb`, déposés par cet import.

## 2. Choisir catégorie, clé et contrat artistique

Lire la table exécutable des catégories avant d'écrire le manifeste :

| Catégorie | Champs exacts de clé | Résolution à l'import | Liaison |
|---|---|---|---|
| corps | partie, forme | non résolu à l'import | squelette |
| tete | tete | tête de `src/data/garde-robe.json` | squelette |
| pilosite | coiffure | coiffure de `src/data/garde-robe.json` | squelette |
| vetement | piece | pièce `vetement` de `src/data/garde-robe.json` | squelette |
| armure | piece | pièce `armure` de `src/data/garde-robe.json` | squelette |
| accessoire | piece | pièce `accessoire` de `src/data/garde-robe.json` | rigide ou surface |
| rigide | apparence | `src/data/apparences.json` | rigide |
| trait | trait | non résolu à l'import | squelette |
| decor | prop | non résolu à l'import ; design : `src/data/props.json` | rigide |
| vehicule | definition | coque de `src/data/vehicles.json` ou engin `armes-de-siege` de `src/data/trappings.json` | rigide |
| amelioration | amelioration | Amélioration de `src/data/naval-traits.json` | rigide |

Chaque surface, quelle que soit la catégorie, nomme le matériau du GLB et l'emplacement de palette
dont il prend la couleur (`{ "nom", "palette" }`, `SLOTS` de `src/lib/palette.ts`, `hotes/godot/asset/surfaces.ts`) ;
la palette d'une composition donne à chaque emplacement une couleur du nuancier.

Un élément sans base (`decor`, `vehicule`, `amelioration`) se construit dans un repère fixe : en glTF, son avant
vers +Z, sa gauche vers +X (bâbord d'un navire), son origine au sol ou, pour un navire, à la ligne
de flottaison, son emprise recentrée en x et z, sauf un décor, dont l'origine reste l'ancre de sa recette (chapitre 10) ; l'hôte le pose sur son empreinte et le tourne vers
son cap sans lire d'autre repère. Il se construit en mètres réels : l'hôte le réduit à son empreinte.
Ce qui se monte, s'équipe ou s'améliore (arme, pièce d'artillerie, Amélioration de navire) n'est
jamais modelé dans l'élément qui le porte : il est son propre élément, monté à un emplacement, ou à
un poste d'un véhicule ; le porteur garde au plus son logement vide (sabord ouvert, fût de mât).

Un champ de clé qui a sa ligne dans `CHAMPS` (`ecartsDeCleDElement`,
`src/noyau/apparence/cleDElement.ts`) est résolu à l'import contre le fichier que nomme la colonne : absent, l'import le refuse `cle-inconnue` ; une pièce
d'une autre catégorie que l'élément, `piece-hors-categorie`. Exemples : `{ "tete": "humain" }` (tete),
`{ "coiffure": "crane-rase" }` (pilosite), `{ "piece": "pourpoint" }`
(vetement), `{ "piece": "plastron" }` (armure), `{ "piece": "baudrier" }` (accessoire),
`{ "apparence": "epee" }` (rigide).

Choisir les ids sémantiques dans la donnée du jeu, jamais dans un libellé. Rechercher l'id et
les variantes du concept avant d'en créer un. Une clé de tête ou de coiffure n'a pas de sexe ; une variation de
couleur n'ajoute aucun élément. Une tête, une coiffure ou une pièce absente de la garde-robe s'y
ajoute d'abord (skill `ajouter-une-donnee`) : l'import refuse son élément tant qu'elle manque. Une
tête porte l'id de sa race de rendu (`src/data/raceAppearance.json`), espèce jouable comme race
monstrueuse : `{ "tete": "skaven" }`. Un seul élément par
(base, clé) ; un nom local dérivé tel que `humanoide--rigide--epee` distingue les catégories,
et pour un corps il inclut partie et forme. Le manifeste ne porte pas d'id arbitraire.

Les catégories corps, tête, pilosité, vêtement, armure, accessoire et trait portent une couche :
peau < dessous < tenue < armure < manteau. L'armure impose armure. Les quatre autres catégories
(rigide, decor, vehicule, amelioration) n'ont ni couche ni couverture. `couvre` est requis pour les éléments skinnés, optionnel pour un
accessoire ; ses ids viennent des zones de la base. Une couverture déclarée reste à mesurer. L'hôte cache la zone
couverte du corps et des couches dessous : une pièce ne couvre une zone que si elle la cache sous tout angle du jeu.
Sous un ourlet ouvert, évasé ou effiloché, pieds écartés, le mollet se voit ; la robe du Sorcier ne couvre donc pas
`mollet_*`, et le preset habille les jambes d'une pièce (`bas`) (#3743).
Un vêtement, une armure ou un accessoire peut ajouter/déplacer des emplacements, ids d'emplacement de
`src/data/garde-robe.json` (`emplacement-inconnu` sinon), ou `<emplacement>#<rang>` pour la case du rang-ième objet rangé
à cet emplacement (une bandoulière offre une case par parchemin, #3844). Une pièce skinnée les offre par `Base.offrir`
(`element/tissu.py`), avec les poids de la pièce sous le point : l'emplacement suit le mélange de ces os, comme la pièce.
Ce qu'une pièce porte et qu'un joueur peut changer (rouleaux, fioles, dagues) est un rigide à part, rangé sur ses cases,
jamais cuit dans la pièce. Un accessoire dont l'emplacement n'est
offert ni par sa base ni par une pièce de cette base va au rapport de l'index (`emplacement-non-offert`,
`hotes/godot/asset/modeles.ts`) : il s'importe et se publie, mais l'atelier ne le sert à aucun point. Seul un véhicule
offre des `postes` : par bord (`proue`, `tribord`, `poupe`, `babord`, `FIRE_ARCS`), les positions `[x, y, z]` de sa scène, en
mètres glTF, sa proue vers +Z et tribord vers -X, où se montent dans l'ordre les pièces des postes de ce bord, chacune
tournée vers lui (`bord-inconnu` sinon). Chaînes et silhouettes optionnelles doivent exister dans la base. La liaison de manifeste ne contient que son mode.

**Clés de forme propres (`formesDeTete`, #4413)** : une pièce skinnée peut porter des shape keys qui ne sont
ni une silhouette de la base ni une clé `gabarit_*`. Ce sont les siennes, pas celles de la base : elles ne se
déclarent pas parmi les silhouettes (`silhouette-absente`) mais dans le champ `formesDeTete` de son manifeste, que
`element/construire.py` écrit depuis les clés réellement posées sur la pièce exportée ; un élément sans clé
propre n'a pas ce champ. Chaque tête porte `visage_inverse` (`faceFlip`, mutation « Visage inversé ») : une tête
de `element/tete.py` par le retournement des volumes de son visage, une tête de `element/tete_makehuman.py` par
la visée de sa peau dans la direction reflétée. Les têtes de `element/tete_makehuman.py` portent en plus les
traits du visage partagés, `nez_fort`, `arcades_marquees`, `joues_creuses` et `visage_long` (`TRAITS`, des
cibles de MakeHuman lues sommet à sommet), et leur clé `feminin` ajoute à celle du corps l'écart de MakeHuman
entre ses deux sexes. Les noms admis sont la liste fermée
`NOMS_DES_FORMES_DE_TETE` (`src/lib/formesDeTete.ts`), que la construction lit par `base/noms_formes_de_tete.py` :
un autre nom est refusé (`forme-de-tete-inconnue`). L'évaluateur pose une forme de la tête par son nom. Le
validateur (`hotes/godot/asset/element.ts`, `godot:valider` et l'import) exige que les shape keys du GLB soient
exactement les silhouettes et les `formesDeTete` déclarées, plus, hors liaison `rigide`, les clés `gabarit_*` du GLB de
la base (`shape-key-non-declaree`, `shape-key-absente`). L'hôte pose leurs poids : le preset
(`formesDeTete`) ou les Mutations du combattant (`formesDeTete` de `mutations.json`) les donnent, le pont les
verse dans `morphes` (`hotes/godot/pont/composition.ts`).

Une **zone** est une région du corps ; un **emplacement**, un point d'accroche ; une
**localisation**, une localisation de règle d'armure ; une **prise**, main ou secondaire.
La base humanoïde déclare 16 emplacements dans `scripts/personnage-3d/base/anatomie.py`.
Les prises se lisent dans son manifeste, main sur hand_r et secondaire sur hand_l.
La donnée de pièce vise l'emplacement ; l'élément ne répète ni prise ni rangement.
Un vêtement a coupe, volume et épaisseur ; un accessoire s'accroche. Une armure recouvre les
couches inférieures. L'exclusion à couche égale et le montage après couverture relèvent de L3/L4.

Pour chaque pièce d'armure, la projection de couvre sur les localisations doit être incluse
dans les loc de **chaque objet dont l'ensemble cite cette pièce**. Préparer cette correspondance
depuis les données de règle ; ne jamais ajouter une zone protégée pour embellir la silhouette.
L3 doit rejouer l'inclusion à l'import et l'égalité sur les ensembles complets ; L4 rejoue
l'égalité après exclusion. Ces contrôles ne sont pas assurés par validerElement : les garder
NON VÉRIFIÉS tant que leurs gardes et le montage ne sont pas livrés.

Écrire un contrat lié à l'image : silhouette et proportions ; trois à cinq signes identitaires
lisibles à taille de jeu ; éléments indépendants et dépendances ; interfaces risquées avec leur
support, leur contact/dégagement, souplesse et poses ; grandes surfaces ; tri CONSERVER /
SIMPLIFIER / OMETTRE. Distinguer volume, motif peint et ombre. Tracer les hypothèses du dos.
Le modèle se compare à l'illustration directrice. Un grand revers et un foulard sont des formes ;
coutures et usure restent du détail. Chaque surface nomme sa matière (drap, laine, toile, cuir, acier, mailles,
fourrure, bois : section 3), jamais un aplat ; ombrage flat/smooth intentionnel.

Un emblème (d'unité, de province ou de culte) n'appartient pas à l'élément : la pièce garde un champ
neutre (écu uni, lame nue, insigne vierge), dont la couleur reste celle de son emplacement de palette, et le manifeste
déclare `blason: true` sur chaque surface qui reçoit l'emblème, dite surface `blason` ; l'emblème
vient de la donnée du porteur, `embleme` de son apparence ou de sa composition (#3155), et se pose
au montage (#3111). Un insigne d'uniforme est la pièce `insigne` (accessoire) à surface
`blason` ; un signe peint sur une armure (tassette, brassard) est un emblème, reçu par une surface
`blason` de la pièce. Un symbole religieux porté (`symbole-religieux`) a la forme de son dieu : il se modèle, une
apparence de l'objet par dieu (`symbole_de_sigmar`, forme `symbole_religieux`) ; l'emblème du culte se pose sur la
surface `blason` d'un autre objet, la couverture du livre de prières (#3867).

Le matériau d'une surface `blason` ne couvre que la face porteuse : toute face de ce matériau reçoit
l'emblème. Son îlot UV de `TEXCOORD_0` remplit le carré [0,1]², à l'échelle uniforme, sans miroir,
rien hors du carré ; l'emblème, un SVG à `viewBox` carré (`refusDeSvg`,
`src/data/schemas/defs/garde-robe.ts`), occupe ce carré entier. L'export glTF retourne v et Godot le
lit sans retournement ; u n'est pas retourné. Contrôler avant l'export dans la vue 3D de Blender, une
image asymétrique appliquée au matériau, la surface vue côté normale extérieure : l'image s'y lit à
l'endroit, sans miroir ni rotation.

## 3. Bloquer l'ensemble, construire par dépendances

Faire un blocage de l'ensemble de référence sur la base, puis travailler **un seul élément**
avec son support, les éléments non repris masqués. Éprouver immédiatement prises, trous et
dégagements dans les poses utiles. Comparer au dessin au même angle, à échelle comparable,
puis à taille du jeu, avant textures et microdétail.

Ordre : corps/pose → vêtements porteurs → couches et accessoires → assemblage de contrôle.
Anatomie, coupe et raccords précèdent plis et matières. Conserver le donneur intact avant
simplification ; protéger frontières, articulations et doigts. Une triangulation aléatoire
ne crée pas un style. Pas de coque moulée pour robe, manteau ou cape de silhouette.

Un élément sur base se construit **dans le dépôt**, comme un véhicule (#3743) : un dossier
`scripts/personnage-3d/element/<base>/<categorie>--<valeur de clé>/` et deux fichiers.

- `donnees.py` : `MANIFESTE`, les champs publiés propres à l'élément (`categorie`, `cle`, `liaison`, et pour une pièce
  skinnée `couche`, `couvre`, `chaines`) ; `MATERIAUX`, `{nom: (emplacement de palette, matière)}` (`habillage.py`,
  section 9) : la matière est l'id d'une matière du domaine `prop` de `src/data/materials.json` dont le catalogue
  `hotes/godot/projet/textures/` porte la texture, sa texture neutre (`.neutre.jpg`, que teint la palette) et son relief ;
  à défaut de matière au catalogue (peau), un gris de construction `(couleur, métal, rugosité)`.
  Une matière qui manque s'ajoute au catalogue (texture CC0, provenance, entrée `prop`) avant la pièce (#4313) : sa
  provenance (`provenance.json`) porte la `source` et le `traitement` ImageMagick que `npm run godot:textures` rejoue et
  compare aux sommes épinglées ; une texture sans image source (un bruit, un grain) a pour `source`
  « fabriquée par ImageMagick, sans image source » et son générateur, graine `-seed` comprise, en tête du traitement
  (`origineDe`, `hotes/godot/asset/texture.ts`). `npm run godot:textures -- --epingler <fichier>.jpg ...` dépose les
  textures d'un traitement modifié, inscrit leurs sommes et imprime la commande de leur transfert. Une texture couvre 2 m (`MiseEnPage.METRES_PAR_MOTIF`), soit 2 mm par
  pixel à 1024 px : une trame réelle tombe sous le pixel. Elle se réduit puis se tuile dans son traitement jusqu'à la
  plus petite période encore lisible, environ 4 px de la texture finale, soit environ 8 mm (#4527). Un relief fait
  512 px ; celui d'une trame que 512 px effacent (`toile-ecrue`, `corde`) en fait 1024. Une couverture de toit
  (`roof--<id>`, domaine `roof`) ne porte que sa neutre et son relief : une nappe de toit ou une couronne lit la neutre,
  projetée sur le plan de chaque face, ses rangs le long de l'égout, et teinte par la couleur de ses sommets, celle de
  `materials.json` (`VolumeDeScene._matiere`, `nappe` de `art/monde.gdshader`, recette `recettes/nappe-texturee.gd`).
  Le bardage d'un pignon (`structure--<apparence>` du mur qu'il prolonge, face de sa nappe) ne porte de même que sa
  neutre et son relief, ses planches le long de l'horizontale de la face, teinte par la couleur du mur : sans `.jpg`,
  un morceau de cette apparence garde la couleur de ses sommets (#4471).
  Ses rangs se lisent sur une ligne horizontale de la source, au pas de `detail.courses.hM` : une source au pas plus fin
  se recadre sur un nombre entier de rangs, d'un joint au suivant, là où ses bords se raccordent (`-crop`).
  `BLASONS`, s'il y en a, les matériaux qui reçoivent l'emblème (surfaces `blason`, section 2), qui gardent leurs UV ;
  tout autre matériau reçoit du constructeur ses UV en mètres au repos (`maille.poser_les_uv_en_metres`) ; `BUDGET_TRIANGLES` (section 7) ; pour un rigide,
  `PRISE` (une prise de la base) ou `EMPLACEMENT` (un emplacement de l'élément `OFFRANT`, importé avant lui) ; chaque dimension en mètres, nommée, avec sa source (illustration, base, donnée du jeu ou HYPOTHÈSE
  à trancher en revue), jamais enfouie dans `modele.py`. Un élément qui en contourne un publié (capuche sur la tête et
  la coiffure) nomme ses ids.
- `modele.py` : la construction seule. Un rigide : `construire(D, materiaux)` rend ses objets, bâtis dans le repère de
  sa prise. Une pièce skinnée : `construire(D, materiaux, base)` rend la pièce jointe, ses clés transférées.
- Une pièce skinnée publiée dont l'atelier est perdu se reprend de son GLB épinglé (#3761) : `modele.py` tient en
  `from publie import reprendre`, et `donnees.py` ne porte que `MANIFESTE` (les champs publiés, `emplacements` compris),
  `MATERIAUX` (valeurs des matériaux du GLB publié) et `BUDGET_TRIANGLES` (son compte de triangles). `element/publie.py`
  garde du publié le repos, les poids, les normales, la découpe en meshes et les clés propres (`visage_inverse`), et
  retransfère de la base courante les silhouettes et les clés `gabarit_*`. Une pièce neuve ne passe jamais par là.

Le constructeur commun `element/construire.py` ouvre la base épinglée, appelle le modèle, contrôle le budget, pend le
rigide à l'os de sa prise ou découpe la pièce par zone, exporte l'élément seul et écrit son dossier de production
(section 6). Les communs ne se forkent pas et ne se recopient pas dans un atelier : un besoin commun (deuxième cas réel)
revient à l'orchestrateur, qui l'ajoute au kit. Les preuves (rendus, mesures, contrat, illustration) restent hors dépôt.

Le kit : `element/tissu.py` pour une pièce skinnée (`Base` : repères d'os, surfaces porteuses, coupes des zones,
éléments publiés contournés, transfert des clés, découpe par zone ; `anneau`, `Maillage`, `emprunter`, `lisser`,
`joindre`, `joindre_les_surfaces`, `direction_spatiale`, `selon` pour une cote par azimut, `unitaire`, `lambeaux` pour
un ourlet effiloché ; `Base.nappe` pour une double nappe, `Base.nappe_simple` pour une nappe simple, à plusieurs
matériaux par `teintes` ; `porteur_de` et son `arbre_de` pour une surface porteuse, visée par `viser` (résultat brut),
`toucher` (point et normale sortante, `None` sans surface) ou `sur_le_porteur` (erreur sans surface) ;
`Base.offrir_sur` pour offrir un emplacement sur une surface), `maille.py` pour un solide rigide (cylindre, tour à
sections rondes ou elliptiques, boîte, tube, tore…) et pour l'aléa semé d'un id (`tirage`), `element/lame.py` pour une
arme à lame et son fourreau (épée,
dague : un dossier ne porte que son `donnees.py` et `from lame import construire`), de même `element/robe.py` pour une
robe longue fermée sur le filet `jupe` (bure, jupe, pourpoint matelassé) ; un vêtement d'une autre coupe (robe du
Sorcier, chemise, pourpoint) compose ses pièces dans son `modele.py` : `Nappe`, `ancres_du_corps`, `sur_le_tronc`,
`anneaux`, `rangee`, `bras_de`, `dents_de_manche`, `fermer_a_l_epaule`, `manches`, `piece_de` ; `element/taille.py` pour
ce qui ceint la taille sur une robe publiée (cordelière, ceinture à boucle : `axe_du_corps`, `ceindre`),
`element/tete.py` pour une tête de race bâtie de volumes sur la couture du cou (orc, gobelin : un dossier ne porte que
son `donnees.py` et `from tete import construire`), `element/tete_makehuman.py` pour une tête humanoïde tirée de la
tête de MakeHuman, cousue au cou par `element/tete.py`, sans ses faces cachées (humain, nain, haut-elfe, halfling : le
dossier ne porte que son `donnees.py`, dont `CUITES` nomme les cibles qui font la race, et
`from tete_makehuman import construire` ; le pack `mpfb` de la base se tire seul, `production.pack_source`),
`element/sangle.py` pour une sangle en bandoulière posée sur la pièce
qu'elle contourne (bandoulière à parchemins, baudrier sur robe), `formes.py` pour les
clés. Ces requêtes placent la géométrie ; elles ne valident rien. Dériver les placements des os et surfaces réelles,
sans coordonnées d'un ancien personnage. Emprunter les poids du porteur au repos, puis ceux des chaînes requises. Un
élément skinné reçoit les silhouettes déclarées ET toutes les clés `gabarit_*` de la base, celles-ci non déclarées au
manifeste, par `Base.transferer(piece, zones)` depuis la copie jointe des zones que la pièce traverse, au point du corps
le plus proche (une liaison de surface tourne l'écart au corps avec sa normale) ; une pièce longue
dont le corps se tasse sous une clé (robe jusqu'aux chevilles sous `gabarit_legs_moins`) passe ses `bornes`. Une arête
que la clé retourne est lissée comme une arête hors bornes ; la nappe intérieure d'une double nappe porte les clés de
sa jumelle extérieure (liées chacune au plus près, elles divergeaient et le lissage gagnait toute la pièce).
Sous une silhouette à os (`gabarit.osDesSilhouettes` du manifeste de base : la carrure écarte les épaules et les
hanches), les hôtes déplacent les os et compensent les liaisons : au repos, une pièce skinnée vaut son bind plus ses
clés quels que soient ses poids, et une pièce rigide suit son os. L'élément ne déclare rien : ses clés transférées
portent le déplacement entier. L'évaluateur et `rendu.py` déplacent les os de la même table.

Une pièce ne se pondère jamais contre une autre pièce : ses poids sont ceux de son porteur, le corps. Le montage résout
la pile des couches de la tenue réellement portée (`resoudreLaPile`, `hotes/godot/asset/pile.ts`), par les mêmes règles
pour toute pièce : la couche du dessous reprend les poids de celle qui la couvre, recule à 3 mm sous elle, et ses
triangles entièrement couverts ne se dessinent plus. La pièce lui doit trois choses, et rien d'autre :

- sa `couche` déclarée, qui dit ce qui la couvre ; à couche égale, un `accessoire` se porte par-dessus ;
- au repos et sous chaque silhouette, rester derrière ce qui la couvre : le montage laisse dehors ce qui le perce de
  plus de 1 cm, et la porte nomme (`couche-percee-au-repos`) l'arête qui traverse l'endroit de sa couverture et en sort
  de plus de 5 mm devant un triangle qui lui fait face ; longer sa couverture sans la traverser, comme un col sous une
  écharpe, n'est pas la percer, ni sortir par le chant d'une pièce épaisse, comme la joue au-delà d'une barbe ;
- les mêmes poids, sommet pour sommet, sur les deux faces d'une épaisseur : le montage garde rigide ce que son auteur
  a lié pareil.

Une pièce posée sur un autre vêtement (pan de capuche sur la robe) se place sur lui (`Base.matieres_publiees`) et n'en
reprend les clés (un `masques` de `Base.transferer`, ses zones et les meshes publiés qu'il couvre) que si, transférées
du seul corps, les deux couches s'écartent de plus de 1 cm sous une silhouette. Le vêtement de dessous s'importe alors
avant, et l'élément qui le recouvre le nomme dans son `CONTOURNE`.

 De même, une
partie qui ne suit qu'une région du corps prend ses clés de ses seules zones : liée aussi au cou, qui monte sous
`carrure_plus` quand la tête publiée ne bouge pas, le bas d'un capuchon se replie et la tête passe devant.
`npm run godot:evaluer` (garde `suiviDuCorps`) refuse par `cle-inerte` une pièce qui ne suit pas un corps qui bouge
sous elle, clé absente comprise, et par `cle-non-suivie` une pièce dont l'écart au corps dépasse son jeu.

Pièges mesurés au Sorcier (#3743) : la nappe intérieure d'une double nappe est en retrait de l'épaisseur, le jeu au
corps se vise sur elle ; une pièce qui couvre `cou` cache le cou sous l'hôte et doit couvrir la couture cou/torse de la
base, en dents de scie ; sous le menton, des anneaux trop proches s'étirent en clip (écart vertical minimal entre
anneaux) ; un vêtement de tête se pose par une marche du dehors vers le centre en distance aux surfaces contournées, les
rayons depuis un centre glissant par les coutures ouvertes du cou. Un tissu qui pend ne se pondère ni aux cuisses ni au
dos : il se pose sur un filet de la base (`base/filets.py`), `jupe` (seize brins de trois os autour du bassin) ou `cape`
(sept brins de quatre os dans le dos, par-dessus la jupe). La base drape ces filets image par image dans chaque clip
(`base/tente.py`) : le brin passe par-dessus ce que le vêtement laisse voir et sous la main, cède à la main sur ce qu'il
cache, et cède à tout plutôt que de s'étirer : dans une roulade, un pied traverse l'ourlet avant qu'une arête ne
s'allonge. Une pièce lit le filet au repos par `Base.filet(nom)` (`tissu.Filet`) : elle pose sa nappe au jeu sur le
rayon du filet (`Filet.point`) et la pondère aux os de ses deux brins voisins (`Filet.poids`), fondue du corps au filet
sous ses racines (`Filet.part`). Elle ne dépasse pas le brin de bord d'un filet ouvert, au-delà duquel rien ne la
porte, et déclare le filet dans `chaines`. Aucun réglage de pli ni d'évasement par pièce : la forme au repos et le
mouvement viennent du filet. Une doublure reprend les colonnes et les poids de la nappe
qu'elle double, sans lissage propre, sinon elle la traverse. Une traversée peut n'apparaître qu'à une silhouette :
la porte est la matrice des cinq passes, jamais la passe neutre seule.

Un rigide rangé (`rangement` de son trapping ou `rangementsObjets` du preset) ne s'écarte ni ne se bascule lui-même :
il se bâtit dans le repère de sa prise, et l'hôte le pose sur ce qui est porté au repos, corps et éléments skinnés
montés, à 5 mm, pivoté si le bas touche, à plat ; plusieurs objets au même point se posent côte à côte autour de
l'os, dans l'ordre des `objets` du preset, sauf sur les cases qu'une pièce offre (`MontageDeComposition._ranger`,
section « Atelier 3D » du contrat du pont). Un objet glissé en travers d'une sangle se centre sur son origine ; une
arme pend par le haut de son fourreau, poignée au-dessus. Un fourreau est un objet du même GLB qui porte la propriété
`fourreau` : l'hôte ne le montre que l'arme rangée. Un écart cuit dans l'élément le ferait flotter sur un autre porteur
(#3743, #3844). Cette pose ne vit que dans Godot : `rendu.py --preset <id>` et `npm run godot:evaluer -- … --preset <id>`
la lui demandent (`hotes/godot/asset/posesDesRanges.mjs`, un lancement de l'éditeur épinglé par appel, sous le verrou
de l'appelant), au repos et à chaque instant rendu ou échantillonné, et posent chaque rigide rangé où le jeu le pose ;
la garde `rigideRange` de l'évaluateur le mesure alors contre ce qui est porté (`objet-dans-un-vetement`), hors de la
pièce qui offre sa case, au repos sous les facteurs et silhouettes de la passe : la profondeur où il s'enfonce derrière
un vêtement qu'il traverse, quelle que soit la longueur qui ressort devant ; tout entier derrière, comme sous une cape,
il ne le traverse pas. Une pose isolée se demande à
`node hotes/godot/asset/posesDesRanges.mjs`, dont l'entrée porte aussi `facteurs`. Un élément que le preset porte plusieurs fois (quatre parchemins) se donne autant de fois :
chaque GLB monte à son tour la ligne suivante du preset, et une ligne sans GLB se dit sur la sortie d'erreur (#4351).

Pour un personnage complet, trois agents `modeleur` à fichiers/sorties disjoints : tête et pilosité ;
corps, vêtements et armure ; rigides et accessoires. Chaque brief donne base hachée, éléments,
budget et dossiers `element/<base>/<id>/` possédés. Aucun agent ne modifie le kit partagé ni les voisins ; une
adaptation nécessaire revient à l'orchestrateur. Sérialiser les builds lourds, chacun borné à **moins de 270 s** ; la porte `--porte` occupe déjà tous les cœurs : une à la fois.
Le lanceur d'environnement n'impose pas cette borne : le processus appelant doit l'imposer.

## 4. Construire une modularité réelle

Garder composants séparés avec ids et noms stables, sur la base commune. Préserver géométrie,
transformations, matériaux, poids et animations des voisins ; `scripts/personnage-3d/signatures.py`
permet leurs signatures. Une adaptation voisine nécessaire se nomme et se contrôle en assemblage.

Aux coutures, positions **et poids** correspondent des deux côtés, intérieur/extérieur cohérents.
Double couche : épaisseur réelle, poids identiques pour les sommets jumeaux, normales et
triangulation contrôlées. Maximum quatre influences normalisées ; aucun sommet déformable sans os.
Conserver une inspection progressive : corps support + pièces retenues + pièce en cours,
avec assemblage complet réactivable.

Le manifeste utilise couche et couvre ; ne pas porter hiddenBy, incompatibilities ou masques
personnels dans le schéma 3. Une couverture ne répare pas une couture : inspecter les couches
retirées et les surfaces révélées. L'emplacement effectif vient du vêtement monté le plus extérieur
qui le déclare, sinon de la base. Une liaison surface emprunte les poids du support réel ; une
liaison rigide suit son repère. Ne pas recalculer le mouvement des chaînes dans l'hôte.

## 5. Main, gant et arme : vérifier les surfaces

Partir de la main anatomique de la base ; pouce opposé, poing compact, poignet continu. Pas de
doigts en boudins/boucles ni boule au poignet. `scripts/personnage-3d/mains.py` fournit
apply_hand_grip ; vérifier sa compatibilité avec les os de la base avant usage.
Ne pas réparer les clips ou déplacer les os de base dans l'élément.

Placer la poignée dans le passage des **surfaces évaluées** de paume et doigts fermés, via la prise
de la base. Parentage et centres articulaires prouvent le déplacement, pas le contact. Contrôler
garde, pommeau et orientation de lame dans la silhouette entière, avec diamètre crédible.
Le tranchant d'une arme tenue suit le +Z de sa prise, du poignet vers les jointures, comme une lame dans le poing.
Une pose utile absente relève de la base et de sa porte, pas d'un nouveau clip embarqué par l'arme.
Une arme à deux mains déclare `liaison.secondePrise`, le repère de prise de la main libre dans celui
de sa prise, le long du manche : au-dessus sur le +Y (vers le fer) pour une hampe, au-dessous vers le talon pour une
arme lourde (`hotes/godot/asset/element.ts`) ; tenue à la prise
`main`, Godot y pose la main `secondaire` (`hotes/godot/projet/scripts/seconde_prise.gd`, #3319). Son côté
et son roulis sont ceux du maniement de l'arme dans les clips dérivés (`SECONDES` de
`scripts/personnage-3d/base/deux_mains.py`, test `SecondesPrises`). La vérifier au rendu Godot sur
repos, attaque et marche : poing fermé sur le manche, bras sans torsion. Un rendu Blender des clips montre la main
gauche ouverte à la cote du clip : seul Godot la ferme et la ramène sur la seconde prise (`seconde_prise.gd`). Le poing
fermé de la base r24 ne laisse qu'un passage d'environ 7 mm de rayon, et l'origine de la prise `main` est sur la paume :
centrer le manche au meilleur passage (`AXE_DANS_LA_PRISE`, `scripts/personnage-3d/base/anatomie.py`) et consigner l'écart restant.

Peau et gant restent distincts. Enveloppe fine, épaisseur bornée par courbure/arêtes, pas de
gonflement global ; examiner paume, dos, dessous et creux. Pour une prise plate, regarder les deux
faces et l'opposition pouce/doigts ; une arme voisine peut cacher le défaut.
Lire au besoin la référence diagnostics du skill.

## 6. Construire, exporter, valider et décider

1. Nommer l'élément, les commandes à préserver et deux ou trois défauts dominants observables.
2. Construire grands volumes et raccords, puis articuler ; préserver les voisins.
3. Exporter **seulement cet élément** en GLB avec ses matériaux, morphs et liaison compatibles.
   L'armature nécessaire au skin peut être exportée, sans dupliquer les meshes du corps ni les
   clips de base ; les animations viennent de la base. Un rigide tenu pend à un os de la
   base : l'import refuse un élément rigide sans mesh, un mesh sur un os absent de la base, ou à la
   racine hors `decor`/`vehicule`/`amelioration` (`hotes/godot/asset/element.ts` `REGLES_DES_CATEGORIES`).
   Réimporter le GLB réellement livré.
4. Écrire le manifeste schéma 3, valider sa forme contre la base, vérifier son empreinte et
   évaluer le GLB monté sur cette base (commandes ci-dessous).
5. Comparer source ↔ GLB sous même caméra/pose/lumière, à taille du jeu et en gros plans exposant
   le défaut et les deux faces utiles ; vérifier l'orientation réelle de caméra.
6. Retirer/remettre couches et voisins ; regarder dessous, coutures et contacts.
7. Jouer repos, marche, attaques, parades et transitions pertinentes avec les vrais contrôles
   du visionneur. Une pose figée ne prouve pas une transition. Restaurer la tenue complète.
8. Consigner élément/interface → statut, capture, pose/clip/image et SHA-256 exact.
   Angle manquant ou zone masquée = **NON VÉRIFIÉ**, jamais PASS déduit.

Exporter en interpolation LINEAR et garder les pistes cuites de la base. Graines déterministes
tirées des codes de caractères de l'identité, jamais du hash Python variable entre processus.
Reconstruire un échantillon et comparer les octets ; une signature égale ne remplace pas cette preuve.
Chaque surface reliée à son emplacement de palette et à sa matière du catalogue, sans couleur cuite ni
illustration en texture ; aucun emblème n'est cuit, il se pose au montage sur une surface `blason`
(section 2). La cuisson de géométrie vers texture peut utiliser le kit.

Réutiliser une vue seulement si export et pose sont identiques. Après deux échecs du même défaut,
changer de construction, provenance ou méthode de mesure avant une troisième retouche ; lire le
diagnostic ciblé. Si l'utilisateur contredit un PASS, identifier cause et contrôle manqué,
revoir les interfaces de même classe et les tenues concernées dans le périmètre autorisé.

### Commandes utilisables

Depuis la racine du dépôt, exécuter `node hotes/godot/asset/recuperer-modeles.mjs` pour alimenter le
cache avec les GLB publiés que le checkout épingle. Lancer ensuite le constructeur vers un dossier
neuf hors du dépôt (refusé sinon).

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/element/construire.py humanoide/rigide--baton --sortie /atelier/baton
```

Le constructeur lit les GLB dans le cache des modèles (`~/.cache/wfrp-modeles-3d/`, `--cache` pour un autre), chacun
sous l'empreinte que le dépôt épingle dans `hotes/godot/projet/modeles/<id>.manifeste.json` : la base et les éléments
contournés. Il écrit `/atelier/baton/<id>/` : `<id>.glb`,
`<id>.element.json` (le manifeste schéma 3, empreinte et taille du GLB comprises), `manifest.json` (l'enveloppe de
l'import) et les licences des packs de la base, et imprime l'empreinte et les triangles. Deux constructions donnent les
mêmes octets. `--local <id>=<glb>` (répétable) lit une voisine du lot pas encore importée, que l'élément contourne, à son
GLB local : la sortie le dit (`LOCAL`), cette construction ne s'importe pas. Exemple du manifeste qu'il écrit pour un rigide :

```json
{
  "schema": 3,
  "base": "humanoide",
  "categorie": "rigide",
  "cle": { "apparence": "epee" },
  "liaison": { "mode": "rigide" },
  "surfaces": [{ "nom": "metal", "palette": "metal" }, { "nom": "plat", "palette": "metal", "blason": true }],
  "glb": { "sha256": "<64 caractères hexadécimaux>", "octets": 1 }
}
```

Pour les autres catégories, appliquer la table et les champs de la section 2. Chaque nom de surface
est le nom d'un matériau de l'export ; `blason`, s'il est présent, vaut `true` ; `matiere`, s'il est
présent, nomme la matière de décor du monde dont la surface s'habille (`prop--<id>`, `matiere-inconnue`) : sa
texture vient du catalogue unique `hotes/godot/projet/textures/`, jamais du GLB. Ne pas ajouter
provenance, captures, chemin du GLB ou décision utilisateur dans ce JSON fermé : fichier séparé.

La CLI canonique appelle validerElement avec les octets du GLB pour vérifier forme, ids de clé
contre la donnée du jeu, références à la base, noms de surfaces contre les matériaux du GLB
(`surface-absente`), `TEXCOORD_0` sur chaque primitive d'une surface `blason`, et d'une surface à `matiere` d'un
élément sur base, que le jeu habille aux UV (`uv-absente`),
empreinte SHA-256 et taille. Fournir manifeste d'élément, manifeste complet de base,
puis GLB d'élément, depuis la racine du dépôt :

```sh
npm run godot:valider -- /atelier/epee/humanoide--rigide--epee/humanoide--rigide--epee.element.json hotes/godot/projet/modeles/humanoide.manifeste.json /atelier/epee/humanoide--rigide--epee/humanoide--rigide--epee.glb
```

Sorties : 0 si la validation passe ; 1 si refus ou erreur de lecture ; 2 si usage incorrect.
Une empreinte ou une taille différente reçoit le code glb-different du validateur canonique.
Cette validation ne remplace pas l'évaluation géométrique du GLB.

Évaluer ensuite le GLB final sur la base ; **--manifeste désigne ici le manifeste de BASE**, pas
celui d'élément. Chaque GLB d'élément porte son manifeste voisin (`<id>.element.json` du dossier de production, ou
`<id>.manifeste.json` d'un import), d'où l'évaluateur lit sa couche et ses zones ; plusieurs GLB s'évaluent ensemble,
et c'est ainsi que la traversée des couches se mesure : évaluer la tenue (tête, coiffure, vêtements, rigides), pas la
pièce seule. Depuis la racine du dépôt, `node hotes/godot/asset/recuperer-modeles.mjs` dépose les GLB
publiés du checkout sous `hotes/godot/projet/modeles/`. Le dossier du rapport doit déjà exister :

```sh
npm run godot:evaluer -- /atelier/robe/humanoide--vetement--robe/humanoide--vetement--robe.glb <tête.glb> --base <base.glb> --manifeste hotes/godot/projet/modeles/humanoide.manifeste.json --json /atelier/mesures/neutre.json
npm run godot:evaluer -- <mêmes GLB> --base <base.glb> --manifeste <base.manifeste.json> --facteurs sl=1,legs=1,arms=1,head=1,st=1 --json /atelier/mesures/gabarit.json
npm run godot:evaluer -- <mêmes GLB> --base <base.glb> --manifeste <base.manifeste.json> --porte --json /atelier/mesures/porte.json > /atelier/mesures/porte.txt
```

La deuxième ligne montre la syntaxe des facteurs ; les remplacer par chaque ligne de
gabarit/surcharge requise. La troisième est la porte d'un élément : le corps neutre puis chaque silhouette
déclarée de la base seule à 1, une passe par processus, en parallèle sur les cœurs (tenue complète du Sorcier :
moins de 4 min, contre 30 en série) ; chaque passe s'ouvre par `PASSE <nom> : code <n>` et écrit son rapport
(`porte.neutre.json`, `porte.feminin.json`…). Après une retouche, `--porte --temoin /atelier/mesures/porte.json` relit
le rapport de chaque passe et ne sort que ses écarts neufs. Une passe isolée se
rejoue par `--silhouettes nom=poids`, et `--clips` borne un essai aux clips fautifs avant la porte entière.
Ne pas valider une matrice entière avec le seul cas neutre.
`--temoin <rapport.json>`, le rapport `--json` d'un run antérieur (la tenue publiée), ne liste que les écarts neufs : la
retouche se juge sur eux. Le témoin se mesure sur les mêmes `<glb>` dans le même ordre, les éléments neufs à la fin : le
libellé `élément k` d'un mesh est sa position.
La porte mesure la tenue telle que le montage la pose : elle résout d'abord la pile des couches (section 3), et son
rapport en donne le bilan (`mesures.pile` : points retenus, suiveurs, reculés, triangles masqués).
La porte nomme trois écarts de couches. `couche-traversee` : en clip, une couche passe devant la surface de celle qui
la couvre ; un triangle de la couverture qui se couche seul en pose ne fait rien passer devant lui.
`couche-percee-au-repos` : au repos neutre, une arête d'une couche traverse l'endroit de celle qui la couvre et en
sort devant un triangle qui lui fait face ; sortir par le chant d'une pièce épaisse, comme la joue au-delà d'une
barbe, n'est pas la percer. `membre-dans-un-vetement` : en clip, un membre du corps passe à travers un vêtement d'une zone ni la sienne ni voisine, comme la main à travers la
manche de l'autre bras. Le tissu pincé n'en est pas : là où le vêtement repose sur le corps d'une autre zone,
le membre qui l'y presse ne le traverse pas. D'un vêtement à doublure, seul compte l'endroit : la main posée devant
lui est derrière sa doublure sans l'avoir traversé.
Ce qu'une tenue de preset garde de `membre-dans-un-vetement` après correction s'admet à sa mesure, par passe et par
clip, dans `hotes/godot/asset/plafonds/<preset>.json`, et sa porte se joue avec `--plafonds <ce fichier>` : au-delà du
plafond d'un clip elle rend tous ses écarts, en deçà elle demande de le baisser (`plafond-a-baisser`). Un plafond ne
monte pas (#3842).

## 7. Deux validations distinctes

**Technique** : validerElement vérifie forme, ids de clé contre la donnée, références à la base et empreinte/taille du GLB
d'élément. La CLI expose ce verdict ; l'évaluateur vérifie le manifeste de base contre son GLB.
Les mesures Node disponibles se lisent dans les appels de gardes de son implémentation.
Elles comprennent poids, enroulement, budget assemblé, pistes, échelle des rigides, pieds, appuis
et étirement. Ne pas réimplémenter de mesures en Python ni utiliser les anciens PASS Python
comme porte. Les requêtes de construction Blender restent autorisées.

La porte complète exige aussi couverture rejouée, liaison, interpénétration, prises/doigts,
textures et budgets par catégorie, noms/silhouettes/emplacements réels, unicité des clés et
reconstruction déterministe. Si une garde manque, conserver son statut NON VÉRIFIÉ et nommer
le lot qui doit la livrer. Zéro écart des gardes présentes n'est pas une conformité à toute la porte.

Budgets de construction du design (à confirmer par les portes L2/L4) :

| Élément | Triangles maximum | Atlas maximum |
|---|---|---|
| base humanoïde | 14 500 | 1024² |
| tête | 2 500 | 512² |
| tête humanoïde MakeHuman (`element/tete_makehuman.py`) | 6 600 | 512² |
| pilosité | 1 500 | 256² |
| vêtement par pièce | 2 500 | 512² |
| armure par pièce | 2 000 | 512² |
| rigide tenu | 1 200 | 256² |
| accessoire ou trait | 800 | 256² |
| prop d'art | 1 500 | 512² |
| personnage assemblé, base visible comprise, au niveau de détail 0 | 24 000 | — |

Base à 14 500 : décision utilisateur du 2026-11-13 (#3287), la base mesurée à 14 318 triangles.

La tête humanoïde MakeHuman garde le maillage `body` de MakeHuman (#4413) : ses cibles fines (joues, oreilles, bouche)
ne s'expriment que sur lui, et sa pleine définition sert aux portraits ; ce n'est pas une décimation ni une retopologie
à la construction. Plafond assemblé à 24 000 au niveau de détail 0 : décision utilisateur du 2026-11-19 (#4413). Les
modèles de `modeles/` se lisent à l'exécution (`GLTFDocument`), sans import (`export_presets.cfg` exclut `modeles/*`) :
Godot n'en tire aucun niveau de détail ; il les génère à l'exécution, par `MontageDeComposition.poser_les_niveaux`
(`ImporterMesh.generate_lods`, `hotes/godot/projet/scripts/montage_de_composition.gd`), sur chaque mesh d'un GLB lu, sur
chaque mesh cuit et sur le mesh fondu du personnage ; le rendu simplifie le personnage qui s'éloigne.

Ne pas créer de plafond véhicule absent du contrat. Le budget assemblé de l'évaluateur ne compte pas
les meshes que la pile des couches masque (`hotes/godot/asset/evaluateur/evaluer.ts`, `masques`).

**Artistique** : identité, silhouette, proportions, pose, coupe, contacts et lisibilité. Un défaut
dominant renvoie à la construction ; un petit pli acceptable permet d'avancer. Gros trou, pièce
flottante, peau traversante, couture ouverte ou poing illisible ne passent pas sous une capture
distante. Éclairage/caméra/pose fixes ; une sonde différentielle temporaire peut isoler une cause,
puis restaurer le réglage de revue. Changer la lumière ne corrige pas la forme.

Pour chaque signe identitaire : vignette recadrée identiquement source/GLB, poses et clips utiles,
un **juge neuf rend un verdict OK/KO par signe**, avec preuve. Gros plans mains et jupes aux images clés ;
lineup face, trois-quarts et dos, taille de jeu et gros plan, à côté de l'illustration : `rendu.py` monte la tenue
(`--input <base.glb> --element <a.glb> --element <b.glb>`, un `--element` par GLB), la colore au `--preset` et y range ses rigides comme le jeu, la pose au `--clip`, et sa `planche.png` porte
`--illustration` à gauche ; `--cadre x,y,z,étendue` (mètres, repère de `bounds` de `render-report.json`) en fait des gros
plans. Aucun rendu ne se montre à l'utilisateur sans l'illustration à côté. Recette au visionneur par contrôles réels, deux faces et transitions,
retraits/remises de toutes les interfaces nommées. Une zone cachée reste NON VÉRIFIÉ.

Présenter ensuite les preuves à l’utilisateur ; consigner sa réponse **verbatim et datée** au ticket
ou dans une fiche `.claude/memory/user-*.md`, et son pointeur dans la provenance, avant d’entériner. Aucun des prototypes historiques n'est un précédent approuvé.
Un rendu Blender ne prouve pas Godot ; garder ce dernier contrôle ouvert jusqu'à sa recette : la capture du preset
dans l'atelier, en natif, `npm run godot:regarder -- preset:<id>` (face, trois-quarts, profil, dos, puis `gros-plan` : le visage de face, au zoom
minimal de la molette, sous `dist/godot-regards/preset-<id>/`), ou posé au clip `<clip>` à l'instant `<s>` par `preset:<id>:<clip>:<s>`, montrées à
côté de l'illustration comme tout rendu. La capture attend que chaque élément de la
composition soit monté dans la scène : un objet absent d'une seule vue se cherche dans sa pose, pas dans le délai.

Un modèle sans base (véhicule, décor, arête) se regarde dans Godot par les mêmes outils, une fois importé au dossier
des modèles du projet (`--sans-publier`). L'atelier le montre tel que le jeu le sert : un véhicule à sa liste de tête,
un décor et un mur dans la scène d'échantillon de leur famille (`src/noyau/monde/echantillons.ts`), le mur d'une
apparence en un enclos qui porte chacune de ses pièces ; la recette `atelier-du-decor.gd` (`npm run godot:sonde`)
pose un mur de chaque famille dont le modèle d'arête est servi. Posé dans une scène, il se capture au regard d'un
joueur, sans export, par le parcours des cadrages d'un scénario de test qui le pose :

```sh
node hotes/godot/recette.mjs --natif --rendu gl_compatibility --parcours cadrages --scenario <id> \
  --vues /atelier/vues.json --captures /atelier/cadrages
```

`vues.json` est un tableau de vues nommées, `{ "nom", "regard": "immersion", "case": { "x", "y" }, "etage"?, "lacet",
"tangage" }` (l'œil sur la case, en exploration, tangage dans ±80°) ou `{ "nom", "regard": "tactique" | "plateau",
"case", "etage"?, "lacet", "zoom" }` (la caméra regarde la case depuis `zoom` mètres, de 6 à 40) ; le lacet est un
azimut en degrés, 90 vers l'est ; le plateau regarde à la verticale, l'immersion et la tactique montrent la face d'un
mur. Chaque vue se capture en `<nom>.png`, et le journal imprime le plan de sa couche, l'œil marqué : il donne les
cases. Exemple : `hotes/godot/cadrages/a-bord-de-la-caraque.json`. Les arêtes d'un scénario se comptent par famille
de kit par `aretesDeLaScene` (`src/noyau/monde/aretes.ts`) sur sa scène (`construire` de
`src/scenes/test-scenarios/`) ; une famille qu'aucun scénario ne pose se regarde à l'atelier, ou dans un scénario
qu'on lui écrit (skill `creer-un-scenario-de-test`).

## 8. Livrer et définir le fini

Livrer, dans le même commit, le dossier `element/<base>/<id>/` (données et modèle), les manifeste, provenance et
licences que dépose l'import sous `hotes/godot/projet/modeles/`, puis le GLB à la Release (section « Importer une base et
ses éléments ») ; `npm run personnage-3d:tests` (`test_element.py`) reconstruit chaque élément d'`element/` et compare son
manifeste, empreinte comprise, au publié, et l'import refuse `[construction-absente]` un élément sur base dont le dossier
manque. Le même test exige d'une peau qui remplace des zones de la base (couche `peau`, `couvre` non vide : une tête)
qu'elle suive la base à leur couture, au repos et sous chaque silhouette et chaque clé `gabarit_*`, la reconstruite comme
la publiée à chaque course : une base republiée se livre avec ses têtes reconstruites et republiées (#4413). Garder un
rapport lié aux empreintes exactes. Garder hors dépôt
illustration, contrat, captures et fiches de mesures ; ne pas réattribuer d'anciennes preuves à
un nouvel export. Les voisins restent identiques, signatures à l'appui.

Un élément est entériné après technique complète, porte artistique par signe et revue utilisateur
consignée. Le montage et le retrait dans la cible se prouvent ensuite par L3/L4. Un intermédiaire
se livre comme tel avec ses contrôles NON VÉRIFIÉS. Ne pas annoncer la porte finale L5 sur une
procédure seule : elle demande, depuis une illustration neuve, une instance neuve produisant tête,
vêtement et rigide, évalués, revus par l'utilisateur, puis montés dans le scénario L4.

## 9. Véhicule : navire ou engin de siège

Un véhicule (catégorie `vehicule`) et les pièces de ses Améliorations (catégorie `amelioration`) se construisent
depuis le dépôt, sans base, par le constructeur commun des éléments sans base, `scripts/personnage-3d/construire.py`
(export et manifestes, d'un véhicule comme d'un décor), et `scripts/personnage-3d/vehicule/` : sa partie commune
(`plan_de_jeu.py` : les ponts d'un navire, lus dans la source unique `ponts` de sa fiche ; `navire.py` : les pièces communes des navires bâtis sur leurs ponts, coque, espars, cloisons, portes, échelles, pièces creusées et emprise
libre des cases ; `revue.py` : configurations rendues dans le studio de `rendu.py` ; `cote_a_cote.py` : l'illustration
au-dessus du rendu orthographique, à la même échelle, de profil et pont par pont), celle qu'il partage avec les éléments
sur base (section 3) dans `scripts/personnage-3d/` (`production.py` : dossiers de production ; `maille.py` : maille,
solides (révolution, cylindre, boîte, plaque, poutre, tube, tore, roue, treuil), bascule autour d'un axe, recentrage de
l'emprise, objet ; `habillage.py` : matériaux, `surfaces` et éléments d'un modèle à plusieurs pièces), et un dossier
par modèle, `<modele>/donnees.py` (ses dimensions, nommées) et `<modele>/modele.py` (sa construction). Modèles livrés :
`caraque` (coque bâtie sur ses ponts, la source unique `ponts` de sa fiche dans `src/data/vehicles.json` que lit
aussi le noyau, seize pièces d'Améliorations dans `ameliorations.py`), `barge-fluviale` (le Bérébéli, bâti de même sur
les ponts de sa fiche, ses postes d'armes lourdes sur ses plates-formes de proue et de poupe et, aux deux bords, sur
le toit de son rouf) ; les engins `armes-de-siege`, une clé par engin, les doublons d'ADE II (`-ade2`) sur le GLB de leur
engin : `affut` (l'affût de campagne et ses roues sous le canon, le mortier, le canon à répétition feu d'enfer, la
batterie tonnerre de feu et le canon à flammes nain), `trepied` (pierrier, canon à répétition), `baliste`, `catapulte`
(catapultes et mangonneau ; onagre), `trebuchet` et `belier`. Une référence trouvée hors du corpus (photographie de
figurine) se range hors dépôt avec sa source (`vehicules-3d/references-armes-de-siege/SOURCES.md` du dossier du
projet) et se cite dans la docstring des données ; sans référence, la docstring dit les proportions d'adaptation.

**Décomposer l'illustration** avant de construire : un véhicule s'assemble de parties comme un personnage d'un corps, d'une tête, de tenues et d'équipements (fiche `user-doctrine-vehicule-assemblage-de-parties`). La docstring de `donnees.py` range chaque chose dessinée dans sa partie : le bateau, modelé par `modele.py` (coque, ponts, superstructures, mâts et gréement, barre, garde-corps, ouvertures) ; les Améliorations, pièces à part sur ses `ancrages` ; l'armement, pièces de siège à ses `postes` ; le décor (lanternes, tonneaux, cargaison, mobilier), décors du catalogue `src/data/props.json` que pose le plan du navire au noyau (`src/noyau/planDe*.ts`), jamais modelés dans son GLB ; le pavillon, surface `blason`. Une fenêtre ou un hublot dessinés sont une ouverture creusée dans le mur, jamais un cadre plaqué sur un mur plein.

**Créer un type.** Le dossier `vehicule/<type>/` porte deux fichiers :

- `donnees.py` : les ids de clé (`definition` d'une coque de `src/data/vehicles.json` ou d'un engin `armes-de-siege` de
  `src/data/trappings.json`, ajoutée d'abord si elle manque) ; `MATERIAUX`, `{nom: (emplacement, matière)}`, l'emplacement
  pris aux `SLOTS` de `src/lib/palette.ts`, la matière un id du domaine `prop` de `src/data/materials.json` (sa texture
  vient du catalogue `hotes/godot/projet/textures/`), à défaut `(couleur linéaire, métal, rugosité)` ; `BLASONS`, les
  matériaux qui reçoivent l'emblème ; pour un navire, `ILLUSTRATION`, le calage de son illustration directrice ; chaque dimension en mètres, nommée, lue sur une illustration ou une donnée du jeu
  (section 1), jamais enfouie dans `modele.py` ;
- `modele.py` : `elements(D)`, qui produit un dict par GLB : `glb` (nom de la scène), `cles` (`[(categorie, cle)]`, une
  clé par élément qui partage ce GLB), `materiaux`, `blasons`, et `construire`, qui bâtit la scène vide avec
  `habillage.materiaux(...)` et les primitives de `maille.py`, puis rend les champs propres au manifeste : `postes` par
  bord (`FIRE_ARCS`), `selon`, `ancrages`, `montage`, `clips`, la table rôle → clip que rend `clips.animer`, et, pour un
  navire à ponts, `cases`, l'emprise libre de chaque case que le modèle rogne, mesurée sur la scène bâtie (#3767).

Un engin est une unité : il s'anime comme une créature (`clips.py`). Chaque pièce mobile est son propre nœud, à son
pivot (roue à son essieu, bras à son axe, fût à ses tourillons, chaîne à son attache), et `clips.animer` clé ses clips :
`repos`, `marche` (déplacement en boucle : `rouler` tourne les roues à la vitesse d'une case par pas du plateau,
`cahoter` secoue un engin sans roues que ses servants portent ou traînent) et son attaque, `tir` (`tirer` : recul,
ressaut, barillet qui tourne ; ou la course d'un bras, d'une verge) ou `melee` (le bélier). Les durées et amplitudes
sont des données nommées de `donnees.py`.

Le repère est celui de la section 2 : en Blender, l'avant vers -y, bâbord vers +x, l'origine au sol ou à la flottaison,
l'emprise recentrée en x et y ; l'export place l'avant vers +z glTF. Ce qui se monte au véhicule (pièce d'artillerie,
Amélioration) est son propre élément. Une primitive d'un autre modèle dont le type a besoin passe dans `maille.py`, une
pièce de navire dans `navire.py` (deuxième cas réel), sans changer un octet des GLB publiés.

**Construire**, depuis la racine du dépôt, vers un dossier neuf hors du dépôt (refusé sinon) :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/construire.py vehicule/<type> --sortie /atelier/<type>
```

Chaque clé reçoit son dossier de production `/atelier/<type>/<id>/` (`<id>` = `<categorie>--<valeur de clé>`) :
`<id>.glb`, `<id>.element.json`, `manifest.json` et `LICENSE-CC0-1.0.txt`. La sortie imprime l'empreinte, les triangles
et les nœuds de chaque GLB ; deux constructions donnent les mêmes octets.

**Valider.** `npm run godot:valider -- /atelier/<type>/<id>/<id>.element.json /atelier/<type>/<id>/<id>.glb` pour chaque
id ; `npm run personnage-3d:tests`, dont `test_vehicule.py` reconstruit chaque modèle et compare chaque manifeste, son
empreinte comprise, à celui publié sous `hotes/godot/projet/modeles/` (`reconstruction.py`, commun aux décors) ; un véhicule ou une Amélioration publiés sans
modèle y échouent ; sur chaque navire, toute case des ponts s'atteint, l'emprise libre de chacune tient un occupant
debout, et la coque est close (`closes` : aucun rayon ne sort du navire depuis une case, sabords bouchés, et aucune fosse
sans plancher sous une case). Au noyau, le test du plan du navire (`src/noyau/planDe*.test.ts`) garde ses postes : la
pièce montée et son servant ne recouvrent ni meuble, ni fût de mât, ni trappe, ni échelle, ni la pièce d'un autre poste,
ne franchissent ni mur ni porte, et reposent sur un plancher. Une garde qui refuse un poste se passe en décalant la pièce
d'une case ou en la tournant, jamais en la retirant ni en vidant une cabine dessinée : le nombre de pièces par bord est
celui de l'illustration qui les place (MDG 12 pour la caraque). Dans le jeu, la route à bord
(`hotes/godot/recettes/route-a-bord.hors-store.test.ts`, une par scénario `a-bord-de-*`) prouve que chaque case
s'atteint depuis le départ par les échelles et qu'au regard `plateau` chacune est la plus haute que le monde montre à
la verticale de son point (aucun décor du pont du dessous ne la traverse : `src/noyau/planDeNavire.test.ts`), et la
rejoue au clic dans l'export Web, au regard `plateau` :

```sh
ROUTE=/atelier/routes npx vitest run --config vitest.noyau.config.ts hotes/godot/recettes/route-a-bord.hors-store.test.ts
node hotes/godot/construire.mjs --export --sortie /atelier/web
node hotes/godot/recette.mjs --web /atelier/web --captures /atelier/bord --parcours bord --scenario a-bord-de-la-caraque --route /atelier/routes/a-bord-de-la-caraque.json
``` Rendre un GLB seul par `rendu.py --input` ; ses configurations par `revue.py`, d'après la `REVUE` des
données (le véhicule, la pièce des postes, les configurations et les vues de l'intérieur), avec les textures que
`npm run godot:sonde` dépose sous `hotes/godot/projet/textures/` :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/vehicule/revue.py caraque --modeles /atelier/caraque --modeles /atelier/affut --sortie /atelier/revue [--seules 01-nue] [--gros-plans]
```

Puis la porte artistique et la revue utilisateur de la section 7, consignée avant d'entériner. Avant de montrer un
véhicule à l'utilisateur, un juge neuf (`.claude/agents/juge.md`) statue partie par partie (bateau, Améliorations, armement, décor, pavillon), signe identitaire par signe identitaire, sur
le côte à côte de son illustration et de son rendu orthographique, de profil puis pont par pont : pour chaque plan de
pont de l'illustration, le plan dessiné, le rendu de dessus coupé au-dessus du sol de ce pont et le plan de jeu
(`ponts`, postes d'arme du manifeste), à la même échelle, cloisons, portes, écoutilles, échelles, mobilier et postes
d'arme ; de profil, il compte les ouvertures (sabords, fenêtres, hublots) de l'illustration et du rendu, une à une, et
rattache chacune à sa case. Son brief porte les points déjà tranchés aux rondes précédentes (ce que l'illustration
arbitre, ce que l'utilisateur a choisi) pour qu'il ne les rouvre pas ; un motif qu'il réfute se reprend à sa
place, jamais en retirant ce qu'il visait. Tout rendu montré à l'utilisateur porte son illustration à côté. Hors du dépôt, avec le recueil
d'illustrations extrait :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/vehicule/cote_a_cote.py <type> --glb /atelier/<type>/<id>/<id>.glb --illustrations <recueil> --sortie /atelier/<type>-cote-a-cote
```

**Publier.** Chaque dossier de production s'importe (section « Importer une base et ses éléments ») :
`node hotes/godot/importer.mjs /atelier/<type>/<id> <id> --sans-publier`, `--remplacer` pour un élément déjà importé.
Les manifestes, provenances et licences déposés sous `hotes/godot/projet/modeles/` se committent avec la source ; les
GLB vont à la Release `modeles-3d` par une branche `transfert/<nom>` partie de la branche de travail, qui porte les
provenances neuves qui les épinglent, fabriquée par `npm run godot:transfert -- <nom> <fichier>...`, que
`.github/workflows/transfert.yml` vérifie, verse et efface.

## 10. Décor

Un décor (catégorie `decor`, clé `{ "prop": <id> }` d'un décor de `src/data/props.json`) se construit depuis le dépôt,
sans base, par le constructeur commun `scripts/personnage-3d/construire.py`, un dossier par modèle,
`scripts/personnage-3d/decor/<modele>/` : `donnees.py` (`MATERIAUX` par décor : chacun de ses matériaux, un
emplacement de palette et une matière du domaine `prop` de `src/data/materials.json`, choisie pour ce qu'elle rend, qui
peut différer de celle que nomme la recette, la docstring disant pourquoi ; `BUDGET_TRIANGLES` ; chaque proportion nommée, en fraction de la primitive qui la porte, et la docstring qui dit les
proportions d'adaptation sans illustration) et `modele.py` (`elements(D)`, un élément par décor : `cles`
`[("decor", {"prop": id})]`, un GLB par clé). Des décors qui partagent leur construction partagent le dossier (`arbre` :
`arbre`, `hetre`, `orme`, `pin`, `arbre-mort`, `souche`, `buisson`).

**Saisons.** Un décor change selon la saison du jeu (ids de `src/data/weather.json`, `SAISONS` de
`hotes/godot/asset/element.ts`) par deux moyens, que `donnees.py` déclare dans `SELON`, par décor et par saison, et que
`modele.py` porte au `selon` du manifeste :

- une couleur, `{ "palette": { <emplacement d'une de ses surfaces>: "#rrggbb" } }` : elle teint la texture neutre de la
  matière (`.neutre.jpg`), plus claire que sa texture, si bien que la teinte se règle au rendu (`revue.py --saison`),
  jamais sur la couleur visée ; une saison sans entrée laisse le décor tel que bâti ;
- des nœuds du GLB : `sans-<saison>`, caché en cette saison, et `avec-<saison>`, montré en elle seule. Une saison qui ne
  change que des nœuds se déclare `{}` : l'hôte ne cache que les nœuds des saisons que `selon` nomme, et le manifeste
  dont le GLB porte un tel nœud sans la nommer est refusé (`selon-absent`).

Le feuillage d'un décor caduc (`CADUCS` de `decor/arbre/donnees.py`) est son nœud `sans-hiver`, et sa ramure nue son
nœud `avec-hiver` : des brindilles en éventail là où chaque masse de feuillage se tient (`ramure`), tirées d'un aléa à
part, pour que le feuillage ne change pas quand la ramure change. Le budget de triangles compte ce qui se montre à la
fois, la plus lourde des deux tenues.

**Ce qui luit.** Le GLB d'un décor a un nœud `emet` (`NOEUD_EMISSIF` de `decor/gabarit.py`) si et seulement si sa
recette a une primitive `emet` (`test_decor.py`) : il porte ce qui luit à l'aplomb du centre de cette primitive, que l'hôte
allume sur une pose qui éclaire (`MontageDesModeles._allumer`).

**Gabarit.** Les primitives de la recette (`volume.primitives`) restent la seule source du gabarit de jeu (empreinte,
dessus, assise, foyer, rayon du pointeur) : le modèle les lit par `decor/gabarit.py`, jamais une copie de leurs cotes ni
de leur géométrie, que `decor/polygones.mjs` tire de `polygonesDePrimitive` (`src/data/props.types.ts`), et se bâtit
dans leur enveloppe convexe (`gabarit.enveloppe`), dont il garde l'encombrement sans recopier les primitives ;
`Gabarit.rentrer` y ramène le sommet qui en sortirait. Le modèle ne
passe par aucune rotation de `mathutils` (`rotation_difference`, `Quaternion`, `Euler`, `Matrix.Rotation`), dont la
trigonométrie en simple précision change d'une libm à l'autre et déplace les sommets : un repère se transporte par
produits vectoriels (`transporter` de `decor/arbre/modele.py`). `test_decor.py` refuse un sommet du GLB publié (lu dans le cache
des modèles à l'empreinte de son manifeste) hors de cette enveloppe, sol compris, à 1 mm près. Une enveloppe qui empêche un modèle correct se rapporte, avec la cote qui gêne ; le modèle ne
change pas la recette. Chaque pièce est une coque close aux faces vers le dehors : `test_decor.py` refuse un nœud du GLB publié qui a une arête non appariée ou une coque soudée de volume négatif ou nul (`glb.coques_en_defaut`).

**Repère et cap.** La recette est en mètres, origine à l'ancre, `xM` à l'est, `yM` vers son front au cap d'identité
(`CAP_IDENTITE_PROP`, `src/data/props.types.ts`), `hM` vers le haut. En Blender, (x, y, z) = (xM, -yM, hM) : le front vers
-y comme l'avant d'un véhicule ; l'export glTF le place en (X, Y, Z) = (xM, hM, yM), le front vers +Z. L'origine reste
l'ancre, jamais recentrée : un décor au cap d'identité sort orienté et posé comme sa recette.

**Construire, valider, importer**, depuis la racine du dépôt, vers un dossier neuf hors du dépôt :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/construire.py decor/<modele> --sortie /atelier/<modele>
npm run godot:valider -- /atelier/<modele>/decor--<id>/decor--<id>.element.json /atelier/<modele>/decor--<id>/decor--<id>.glb
node hotes/godot/importer.mjs /atelier/<modele>/decor--<id> decor--<id> --sans-publier
```

Deux constructions donnent les mêmes octets (aléa semé des codes de caractères de l'id). `npm run personnage-3d:tests`
(`test_decor.py`) reconstruit chaque modèle dont une entrée a changé (tous sous `WFRP_3D_TOUT=1`), compare chaque
manifeste au publié, exige un modèle pour chaque `decor--*` publié et passe la garde du gabarit sur chaque GLB publié,
sans le reconstruire. Publier comme un véhicule (chapitre 9, « Publier »).

**Revue.** `decor/revue.py` rend AVANT (les primitives de la recette) et APRÈS (le GLB), habillés comme le jeu, dans le
studio de `rendu.py`, de face, de trois-quarts et de dessus, dans une `planche.png` :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/decor/revue.py <id> --modeles /atelier/<modele> --sortie /atelier/revue-<id> [--saison <saison>]
```

`--saison` montre APRÈS comme le jeu en cette saison (nœuds cachés, palette du `selon`) ; sans elle, le décor tel que
bâti. Un décor saisonnier se regarde en chacune de ses saisons. La recette rendue
`hotes/godot/projet/recettes/saisons-du-decor.gd` (`npm run godot:rendus`) lit aux pixels le chêne en chaque saison.

Puis la porte artistique et la revue utilisateur de la section 7, consignée avant d'entériner.

## 11. Arête

Les pièces qu'un hôte pose sur les arêtes d'une scène (catégorie `arete`, clé `{ "kit": <famille> }`, le `kit` d'une
apparence de `src/data/structureAppearance.json`) se construisent depuis le dépôt, sans base, par le constructeur commun
`scripts/personnage-3d/construire.py`, un dossier par kit, `scripts/personnage-3d/arete/<kit>/` : `donnees.py`
(`MATERIAUX`, `BUDGET_TRIANGLES` par pièce, chaque cote nommée, les illustrations directrices) et `modele.py`
(`elements(D)`, par `arete/geometrie.py`). Un kit est un GLB, `arete--<kit>`, un nœud racine à mesh par pièce
(`PIECES_D_ARETE`, `src/noyau/monde/piecesDArete.ts`).

**Repère et taille.** Chaque pièce est à l'origine de l'arête, à sa taille réelle : X le long d'elle, centrée, sur la
longueur d'une case ; Y depuis son pied, sur la hauteur de l'apparence ; Z son épaisseur, centrée, le dehors vers +Z
(`arete/geometrie.py`). Un demi-poteau ou une chaîne de pierres à chaque bout se complète de celui de la pièce voisine.
L'hôte porte la boîte du kit à la longueur de chaque arête et à la hauteur de son mur, l'épaisseur à l'échelle du
plateau (`MiseEnPage.echelle_d_arete_servie`).

**Échelle.** La pièce `echelle` habille une arête qu'on franchit par une échelle : deux montants et des barreaux de
bois (`menuiserie.echelle`, ses cotes dans `ECHELLE_DE_MEUNIER`), du pied à la `HAUTEUR` du kit, centrés sur l'arête,
le dos sur son plan (Z = 0), vers le dehors. Elle ne tient ni la longueur ni l'épaisseur de l'arête, et reste dans la
boîte du kit, dont l'hôte tire l'étirement de toute pièce : il l'étire en Y au dénivelé qu'elle franchit, ses barreaux
avec elle. Chaque kit la pose dans son `BATIR`, avec son matériau `echelle` et son budget (`test_arete.py`).

**Ouverture de plusieurs arêtes.** Une suite d'arêtes adjacentes et alignées de même couche, de même nature (porte,
porte de ville) et de même apparence est une seule ouverture (`ouverturesDeLaScene`, `src/noyau/monde/aretes.ts`). Chaque arête y reçoit le nœud `<pièce>--<position>`, de position `gauche`, `milieu` ou
`droite` ; l'hôte se replie sur `<pièce>`, qui est aussi le nœud d'une ouverture d'une seule arête. `gauche` est
l'arête au bout -X de l'ouverture dans le repère de la pièce (X le long du sens de l'arête, +Z vers le dehors),
`droite` celle du bout +X. Un vantail se gonde au bout extérieur de l'ouverture : côté -X pour `gauche`, côté +X pour
`droite` ; celui de `milieu`, brisé sur son voisin de gauche, clôt sa baie fermé et la laisse libre ouvert. L'état
d'un vantail reste celui de son arête. Un kit ne bâtit que les positions qu'une scène
pose (`geometrie.noeud`) : le budget d'un nœud est celui de sa pièce, et `arete/revue.py` montre chaque ouverture
d'un seul tenant, ses nœuds bout à bout. Une porte posée dans un mur prend le kit, la hauteur et les teintes de
mur (`corps`, `bois`, `joint`, `gravats`) de son mur porteur, celui du bout -X sinon du bout +X, et garde les teintes
de menuiserie (`accent`, `planche`, `vet1`, `vitre`, `metal`, `barreau`, `traverse`) de sa propre apparence
(`paletteDeLApparence`) : chaque kit bâtit donc ses portes.

**Famille neuve.** Ajouter d'abord la famille au `kitSchema` (`src/data/schemas/defs/structureAppearance.ts`), puis
une apparence de `structureAppearance.json` qui la porte (le jeu de données s'édite au fichier). L'hôte pose une
arête par le modèle `arete--<kit>` s'il est servi, sinon par une boîte, comme une arête dont le modèle est
illisible ou n'a pas la pièce (`VolumeDeScene._groupe`). Un kit bâtit donc les pièces de `PIECES_D_ARETE`
(`src/noyau/monde/piecesDArete.ts`, `test_arete.py`) : une pièce sans objet pour lui reprend la forme d'une autre (le talus
plein pour la fenêtre d'un terrassement, la grille baissée pour la porte d'une herse).

**Forme et couleur.** `donnees.py` lit dans `structureAppearance.json` les seuls champs de forme des apparences qu'il
nomme ; aucune couleur n'y entre (`test_arete.py`) : chaque surface nomme l'emplacement de palette que l'hôte teint de
la couleur de l'apparence posée (`paletteDeLApparence`, par `wallPartColor`), et `MATERIAUX` ne déclare que les
matériaux que les pièces du kit posent. Une partie qu'une apparence teint à part a son emplacement, qui prend la
couleur d'une partie de mur (`PARTIES_DU_MUR`, `PARTIES_DE_LA_MENUISERIE`, `src/noyau/monde/aretes.ts`) ; le champ de
l'apparence qui la donne et ses replis se lisent dans `wallPartColor` (`src/noyau/monde/volume/structures.ts`) :

| Emplacement | Ce qu'il porte | Partie de mur |
|---|---|---|
| `corps` | le parement du mur : pierres, torchis, claie, terre | `face` |
| `bois` | le bois du mur : ossature, pieux, clayonnage, boisage | `poteau` |
| `joint` | l'âme d'un mur de pierre, vue dans ses joints et dans sa brèche | `joint` |
| `gravats` | les gravats au pied d'une brèche (`geometrie.eboulis`) | `gravats` |
| `accent` | les planches d'un vantail, porte ou volet ; les montants et les barreaux d'une échelle | `vantail` |
| `planche` | les barres et l'écharpe au dos d'un vantail | `vantail-planche` |
| `vet1` | les bois d'une croisée | `meneau` |
| `vitre` | la vitre d'une croisée | `vitre` |
| `metal` | pentures, poignée, loquet, rivets et pointes | `poignee` |
| `barreau` | les barreaux et les montants d'une herse | `herse-barreau` |
| `traverse` | les traverses d'une herse | `herse-traverse` |

Une baie est percée de part en part ; sa croisée porte sa vitre (`menuiserie.vitre`), que la garde de jour ôte
(`test_arete.py`) : les volets d'une `fenetre-close` ferment seuls la baie.

**Communs de la famille**, sous `scripts/personnage-3d/arete/` : `apparences.py` lit une apparence et sa hauteur ;
`menuiserie.py` porte le vantail de planches, la croisée, sa vitre, les volets et l'échelle, avec leurs cotes ; `maconnerie.py` l'appareil
des kits de pierre (assises, chaînes, couronnement, porche voûté, porte cintrée sous son porche, brèche). Un kit les pose, il ne les recopie pas.
La forme d'un kit se lit d'une apparence de référence, nommée dans son `donnees.py` ; les autres apparences du kit
reçoivent cette forme, étirée par l'hôte à la hauteur de leur mur. Un mur plein ne laisse passer aucun jour
(`test_arete.py`). Un kit qu'on voit à travers (la grille d'une herse) le déclare dans son `donnees.py` par
`CLAIRE_VOIE = True` : la garde de jour le saute.

**Construire, valider, importer, regarder**, depuis la racine du dépôt, vers un dossier neuf hors du dépôt :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/construire.py arete/<kit> --sortie /atelier/<kit>
npm run godot:valider -- /atelier/<kit>/arete--<kit>/arete--<kit>.element.json \
  /atelier/<kit>/arete--<kit>/arete--<kit>.glb
node hotes/godot/importer.mjs /atelier/<kit>/arete--<kit> arete--<kit> --sans-publier
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/arete/revue.py <kit> --apparence <id> \
  --modeles /atelier/<kit> --sortie /atelier/revue-<kit>
```

`arete/revue.py` rend chaque pièce seule, teinte de la palette que le jeu donne à l'apparence (`paletteDeLApparence`),
de face, de trois-quarts et de dessus, dans une `planche.png`. `npm run personnage-3d:tests` (`test_arete.py`) bâtit
chaque kit deux fois aux mêmes octets et mesure ses pièces (nœuds, repère, budget, coques closes, jour ; les gardes
communes aux kits d'escalier vivent dans `banc_des_kits.py`),
reconstruit chaque kit dont une entrée a changé, compare chaque manifeste au publié, exige un kit pour chaque
`arete--*` publié et un modèle pour chaque famille qu'une apparence porte. Les pièces qu'il exige sont celles de `PIECES_D_ARETE`, lues
du noyau par `arete/pieces.mjs`.
Regarder le kit dans Godot comme tout modèle sans base (chapitre 7) : l'atelier en montre chaque pièce par
l'échantillon « Mur et ouverture », et la capture `cadrages` le montre posé dans une scène, au regard d'un joueur.
Une illustration de façade se compare à cette capture, jamais à une pièce seule. Recettes Godot des arêtes
(`godot:sonde`) : `arete-au-pied.gd` (pied, échelle, nœuds par position), `aretes-en-instances.gd`,
`atelier-du-decor.gd`. Publier comme un véhicule (chapitre 9, « Publier »).

## 12. Escalier

Les pièces qu'un hôte pose sur les côtés d'une case de marches (catégorie `escalier`, clé `{ "kit": <famille> }`, le
`kitDEscalier` d'un terrain bâti de `src/data/terrains.json`) se construisent comme un kit d'arête (chapitre 11), par
`scripts/personnage-3d/construire.py`, un dossier par famille, `scripts/personnage-3d/escalier/<famille>/`
(`donnees.py`, `modele.py`), et leurs communs dans `escalier/volee.py`, qui met ceux des arêtes au chemin
(`geometrie.py`, `menuiserie.py`, `maconnerie.py`). Un kit est un GLB, `escalier--<famille>`, un nœud racine à mesh par
pièce de `PIECES_D_ESCALIER` (`src/noyau/monde/piecesDArete.ts`) : `limon`, sur un côté que borde une
case rejointe à pied ou le vide, et `rampe`, sur un côté que borde le vide (`cotesDeMarchesDeLaScene`,
`src/noyau/monde/cotesDeMarches.ts`), plus un nœud `rampe--<position>` par bout d'une suite de rampes (`volee.BOUTS`),
et aucun autre : `rampe--gauche` termine la suite d'un poteau à son bout -X, `rampe--droite` à son bout +X,
`rampe--seule` aux deux ; `rampe` est la pièce du milieu, que l'hôte pose aussi faute du nœud de la position. Les
marches restent celles du noyau. Familles livrées : `bois` (limon de planche à chapeau, balustres tournés sous une main
courante, éclisses de fer, poteau tourné coiffé d'une pointe) et `pierre` (assise de pierres de taille, mur d'échiffre
à chaperon de dalles, pilier de pierres de taille couronné). Chaque famille qu'un terrain nomme a son kit :
`test_chaque_kit_d_escalier_d_un_terrain_a_son_modele` (`test_escalier.py`) lit le `kitDEscalier` de chaque terrain de
`src/data/terrains.json`.

**Repère, à plat.** X le long de l'axe montant, de -L/2 à +L/2 (une case, 2 m) ; Y depuis le pied de la pièce ; Z vers
le dehors, 0 au plan du bord de la case, que rien ne passe. Une pièce se modèle sans pente : l'hôte la cisaille, Y
selon X, de la cote lisse du bord à son entrée à celle de sa sortie ; ce qui est d'aplomb le reste. Les deux pièces
partagent leur pied, la cote lisse du bord (`CoteDeMarches.pied`) : le limon y pose son pied (Y = 0), le parement du
dedans au plan du bord (Z = 0) ; la rampe, qui ne se pose qu'avec lui, se dresse sur son dessus, sans rien sous lui,
pour qu'aucune de leurs faces ne se double au bout d'une volée.

**Raccord.** Deux cases voisines se raccordent bout à bout, quelle que soit la pente de chacune : la section d'une
pièce est la même à ses deux bouts, et celle d'une rampe de bout est celle de `rampe` au bout qu'elle raccorde ; rien n'y est tiré au sort (les pierres des bouts sont des pierres de taille de
façon constante, `maconnerie.Appareil.rang`) ; ce qui se répète (balustres, dalles du chaperon) va à un pas qui divise
la case, à un demi-pas des bouts, ou par moitiés que la case voisine complète (demi-dalle, demi-éclisse). Un poteau tient dans sa case, au bout, d'aplomb comme le reste : l'hôte cisaille son
couronnement avec la pièce. `test_escalier.py` le mesure : section de chaque bout raccordé, même poteau à chaque
position, vides de même largeur d'une case à l'autre hors celui que borde un poteau, rampe sur le dessus du limon.

**Couleur.** Chaque surface nomme un emplacement de palette et sa matière du domaine `prop` ; l'hôte ne lui impose
aucune couleur : elle garde la texture de sa matière.

**Construire, valider, importer, regarder**, depuis la racine du dépôt, vers un dossier neuf hors du dépôt :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/construire.py escalier/<famille> --sortie /atelier/<famille>
npm run godot:valider -- /atelier/<famille>/escalier--<famille>/escalier--<famille>.element.json \
  /atelier/<famille>/escalier--<famille>/escalier--<famille>.glb
npm run personnage-3d:integrer -- escalier/<famille>
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/escalier/revue.py <famille> \
  --modeles /atelier/<famille> --sortie /atelier/revue-<famille>
```

`escalier/revue.py` rend chaque nœud seul, à plat, de face, de trois-quarts et de dessus, puis la ligne `volee` : trois
cases bout à bout, chacune son limon et sa rampe à sa position (`gauche`, milieu, `droite`), cisaillée à sa pente, pour
voir le raccord et les poteaux. `npm run
personnage-3d:tests` (`test_escalier.py`) bâtit chaque kit deux fois aux mêmes octets, mesure ses pièces (nœuds, repère,
budget, coques closes, raccord) et compare chaque manifeste au publié. Une famille neuve entre d'abord au
`kitDEscalierSchema` (`src/data/schemas/defs/structureAppearance.ts`). Publier comme un véhicule (chapitre 9,
« Publier »).

## 13. Toit

La faîtière qu'un hôte pose sur le faîte d'un toit (catégorie `toit`, clé `{ "kit": <couverture> }`, le `kit` d'une
couverture de `src/data/materials.json`) se construit comme
un kit d'escalier (chapitre 12), par `scripts/personnage-3d/construire.py`, un dossier par couverture,
`scripts/personnage-3d/toit/<couverture>/` (`donnees.py`, `modele.py`), et ses communs dans `toit/faitage.py`, qui met
ceux des escaliers et des arêtes au chemin (`volee.py`, `geometrie.py`). Un kit est un GLB, `toit--<couverture>`, un
nœud racine à mesh par pièce de `PIECES_DE_TOIT` (`src/noyau/monde/piecesDArete.ts`, lues du noyau par
`toit/pieces.mjs`) : la seule `faitiere`. Les pans restent ceux du noyau. Couvertures livrées : `ardoise` (une ardoise par
bras, chaque paire recouvrant la suivante, coins de queue abattus, crochets de fer), `tuile` (tuiles demi-rondes à
bourrelet, scellées d'un solin de mortier de chaque côté) et `chaume` (selle de paille épaisse au bord en dents, tresse
à trois brins sur son dos, baguettes de noisetier filées et croisées).

**Repère, sur le toit d'école.** X le long du faîte, de -L/2 à +L/2 (une case, 2 m) ; Y la hauteur, 0 sur l'arête du
faîte ; Z en travers. La pièce se modèle sur deux pans qui descendent du faîte d'une pente de 1 (`faitage.pan`) : l'hôte
étire Y, sans la cisailler, à la pente des deux pans qu'elle coiffe. Rien n'y suppose donc une pente : le dessous
de la pièce suit les pans, rien ne descend sous eux, et une épaisseur se porte en hauteur (`faitage.plaque`, par sa
levée au-dessus du pan), jamais d'équerre au pan.

**Raccord.** Deux cases voisines se raccordent bout à bout : rien ne passe les bouts, et la section de la pièce est la
même aux deux. Ce qui se recouvre le long du faîte (ardoises, tuiles) va à un pas qui divise la case, qui coupe un
élément en son milieu à chaque bout (`faitage.recouvrants`) : la moitié de queue d'un bout se complète de la moitié de
tête de la case voisine, sans joint ni élément doublé. Ce qui se file (solin, selle, brins, baguettes) va à une période
qui divise la case, ses sections dans des plans d'abscisse constante (`faitage.file`, `volee.profil`). Rien n'y est tiré
au sort. Un lissage (`ANGLE_LISSE`) reste sous l'angle droit : lissés, les bouts d'une pièce marquent le joint de deux
cases.

**Couleur.** La surface principale nomme l'emplacement `corps`, que l'hôte teint de la couleur de faîtière de la
couverture (`ridgeCap`, `src/data/materials.json`) ; les autres (`metal`, `joint`, `accent`, `bois`) gardent la texture
de leur matière du domaine `prop`, sans couleur imposée.

**Construire, valider, importer, regarder**, depuis la racine du dépôt, vers un dossier neuf hors du dépôt :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/construire.py toit/<couverture> --sortie /atelier/<couverture>
npm run godot:valider -- /atelier/<couverture>/toit--<couverture>/toit--<couverture>.element.json \
  /atelier/<couverture>/toit--<couverture>/toit--<couverture>.glb
npm run personnage-3d:integrer -- toit/<couverture>
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/toit/revue.py <couverture> --couverture <id> \
  --modeles /atelier/<couverture> --sortie /atelier/revue-<couverture>
```

`toit/revue.py` rend la faîtière seule sur le toit d'école, teinte du `ridgeCap` de la couverture `--couverture` dont
elle est le kit (`tuile`, `chaume`, `toit-ardoise`), de face, de trois-quarts et de dessus, puis une ligne par faîte de `revue.FAITES` :
trois cases bout à bout sur deux pans de même pente, un toit raide puis un toit plat, la pièce étirée en hauteur
comme l'hôte la pose, pour voir son raccord et son assise. `npm run personnage-3d:tests` (`test_toit.py`) bâtit chaque
kit deux fois aux mêmes octets, mesure sa pièce (nœud, repère, budget, coques closes, assise sur les pans, raccord) et
compare chaque manifeste au publié ; chaque kit qu'une couverture nomme y a son modèle. Une couverture neuve entre
d'abord au `kitDeToitSchema` (`src/data/schemas/defs/structureAppearance.ts`). Publier comme un véhicule (chapitre 9,
« Publier »).

## Disponibilité à sonder avant chaque production

Ces dépendances se vérifient dans le checkout utilisé, sans déduire leur livraison du design :

| Besoin | Source à sonder | Lot si absent |
|---|---|---|
| base hachée et porte complète, chaînes/silhouettes et matrice | constructeur humanoïde, manifeste livré, rapports et revue | L1 |
| garde-robe (têtes, coiffures, pièces, ensembles) résolvant la clé | données du jeu et identité publiée par le noyau | T |
| constructeur de l'élément (rigide, skinné, tête) | `scripts/personnage-3d/element/` (`construire.py`, `tissu.py`, `tete.py`) | #3743, migration des éléments publiés |
| couverture, liaison et autres gardes complètes | appels de gardes de l'évaluateur Node | L1 |
| import contrôlé schéma 3, unicité, rapport de couverture | importeur d'assets et ses tests | L3 |
| montage par ids, couches et emplacements, contrôles de retrait | pont et hôte Godot | L4 |

## Importer une base et ses éléments

Chaque dossier de production contient `manifest.json`, le GLB qu'il nomme, au plus un `.blend`
et ses `LICENSE*.txt` (licence déclarée par la ligne `License:`, sinon par le titre). Pour une base (schéma 6, `VERSION_DU_SCHEMA_DE_BASE`) ou un élément (schéma 3),
`manifest.json` est une enveloppe de production séparée du manifeste fermé, ici celle d'un élément :

```json
{
  "model": "element.glb",
  "model_sha256": "REMPLACER_PAR_LE_SHA256_DU_GLB",
  "manifeste": { "schema": 3, "base": "humanoide" }
}
```

Remplacer `manifeste` par le manifeste COMPLET de base ou d'élément. Les métadonnées de licences
des composants restent dans `components.<id>.asset` de l'enveloppe (`license_basis`,
`explicit_header`, `packs[].announced_license`), les packs sources (clips, corps) dans
`packs_sources.<pack>` (`path`, `sha256`, `licence` : le nom d'un `LICENSE*.txt` du dossier).
L'import refuse `[pack-source-mal-forme]` un `packs_sources` ou une entrée qui n'est pas un objet, un `path` ou une
`licence` qui n'est pas une chaîne, un `sha256` qui n'est pas un SHA-256 hexadécimal minuscule ;
`[licence-de-pack-absente]` une `licence` qui ne nomme aucun texte `LICENSE*.txt` du dossier ;
`[packs-sources-absents]` une base qui ne déclare aucun pack.
Elles alimentent la provenance ; elles n'entrent pas dans le manifeste déposé. Une production sans
composant licencié ni `LICENSE*.txt` est refusée `[licence-absente]`.

Importer la base avant ses éléments, dans la même destination : publier un élément verse aussi le GLB de sa base épinglée ; `--sans-publier` reste le régime du poste (atelier, essais). Une session cloud, sans `gh release`, importe aussi en `--sans-publier`, puis pousse une branche `transfert/<nom>` partie de sa branche de travail, qui porte la provenance neuve et les fichiers épinglés ajoutés de force (GLB, textures du catalogue, sons) : `npm run godot:transfert -- <nom> <fichier>...` fabrique son commit sans toucher l'index et imprime le `git push` (`hotes/godot/asset/transfert.ts`) ; `.github/workflows/transfert.yml` vérifie chaque empreinte, verse sans écraser (`npm run godot:epingles`) et efface la branche, que le proxy du cloud ne peut pas supprimer lui-même.

Un lot se construit, s'importe et entre au cache des modèles en une commande, chaque élément après ceux du lot qu'il
contourne ; `--transfert <nom>` fabrique le commit de transfert, GLB, manifestes et provenances importés du lot, et
imprime le `git push` à lancer. Chaque élément se nomme `<base>/<dossier>`, `<base>` l'une de `CONSTRUCTEURS`
(`scripts/personnage-3d/integrer.mjs`) : `humanoide`, ou `vehicule`, `decor` et `arete` pour un modèle sans base
(`arete/moellons`) :

```sh
npm run personnage-3d:integrer -- humanoide/armure--plastron humanoide/accessoire--baudrier-sur-armure [--transfert soldat]
```

```sh
node hotes/godot/importer.mjs /atelier/base humanoide --destination /atelier/modeles --sans-publier
node hotes/godot/importer.mjs /atelier/epee humanoide--epee --destination /atelier/modeles --sans-publier
npm run godot:valider -- /atelier/epee/element.json /atelier/modeles/humanoide.manifeste.json /atelier/epee/element.glb
```

La validation cherche le GLB voisin du manifeste de base (`humanoide.manifeste.json` →
`humanoide.glb` ; `base.json` → `base.glb`). Pour un autre nom, ajouter
`--glb-base /atelier/base/corps.glb`. La base et son GLB sont validés avant l'élément.

Une base réexportée remplace la base déposée sans retirer ses éléments :
`node hotes/godot/importer.mjs /atelier/base humanoide --destination /atelier/modeles --sans-publier --remplacer`.
Chaque élément qui la référence se revalide contre elle ; un seul refusé (`[remplacement-casse]`,
ou `[base-absente]` si le nom de base change) et rien n'est écrit. Sans `--remplacer`, l'import
refuse `[id-deja-present]`.

L'import retrouve la base par son champ `base` dans les `*.manifeste.json` de la destination,
indépendamment du nom de fichier. Il exige son GLB local et sa provenance épinglée :
`base-absente`, `glb-de-base-absent` ou `provenance-de-base-differente` nomment un manque ou un
écart ; `base-hors-release` refuse une base épinglée dont la provenance porte `hors_release`
(dépôt d'avant #3184) : réimporter la base avec `--remplacer`. Deux bases de même identité reçoivent `base-en-doublon` ; deux éléments de même
`(base, cle)` reçoivent `cle-en-doublon`, même avec un autre nom de fichier ou une autre catégorie.

Tous les refus précèdent publication et écriture ; la CLI sort en 1 (usage incorrect : 2).
Un succès sort en 0, dépose `<id>.manifeste.json`, `<id>.provenance.json`, les licences et, au
schéma 3, `<id>.glb` local. `--sans-publier` conserve ces dépôts locaux sans appeler la Release.
Sans ce drapeau, le GLB et l'éventuel `.blend` sont versés sous leur empreinte dans la Release
`modeles-3d` avant les écritures locales. La destination par défaut est `hotes/godot/projet/modeles`.
Une base est publiable : la clé `hors_release` dans son `manifest.json` est refusée
`[base-hors-release]`, avec ou sans `--sans-publier`. Seul un élément d'essai dont le propre
`manifest.json` porte `hors_release` (une raison non vide) est hors Release : il est refusé
`[hors-release]` sans `--sans-publier`, et sa provenance porte sa raison déclarée.

Ce contrôle d'import ne prouve pas le montage L4 ni les mesures géométriques de l'évaluateur.
La validation des clés par le noyau et le rapport de couverture appartiennent à L3b, après T3.
