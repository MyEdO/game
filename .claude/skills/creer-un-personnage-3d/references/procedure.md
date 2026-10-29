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
Elle utilise les fichiers UAL1, UAL2 et UBC acquis avec leurs licences, et nomme le texte de licence
de chaque pack, lu dans le pack (`License.txt` à la racine de `Universal Animation Library[Standard]`,
`License_Standard.txt` à la racine de `Universal Base Characters[Standard]`) :

```sh
node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py --ual1 "/atelier/sources/Universal Animation Library[Standard]/…/UAL1_Standard.glb" --licence-ual1 "/atelier/sources/Universal Animation Library[Standard]/License.txt" --ual2 "/atelier/sources/Universal Animation Library 2[Standard]/…/UAL2_Standard.glb" --licence-ual2 "/atelier/sources/Universal Animation Library 2[Standard]/License.txt" --corps "/atelier/sources/Universal Base Characters[Standard]/…/Superhero_Male_FullBody.gltf" --licence-corps "/atelier/sources/Universal Base Characters[Standard]/License_Standard.txt" --sortie /atelier/base/humanoide.glb
```

Les chemins `/atelier/…` des exemples désignent les fichiers locaux de production à choisir ;
ils ne sont pas fournis par le dépôt. Vérifier unités, axes, échelle et pose de liaison de la base,
sans les modifier dans l'élément. La construction exige `node` dans le `PATH` : avant Blender,
`scripts/personnage-3d/base/manifeste.mjs --verifier` refuse une sortie dans un arbre du dépôt (liens
et jonctions résolus), un dossier de sortie qui porte un autre fichier que le GLB, `manifest.json` et
les `LICENSE-<pack>.txt` qu'elle écrit, et un texte de licence `--licence-<pack>` absent, hors des
dossiers ancêtres de sa source, sans ligne `License:` ou dont la ligne manque à
`hotes/godot/asset/licences.json`. Après l'export, elle passe sa part du manifeste à `manifeste.mjs`, qui y ajoute la
déclaration du corps (`scripts/personnage-3d/base/humanoide.json` : `base`, porteur de référence,
clips de marche), les bornes de `st` tirées de `src/data/gabarits.json` et des surcharges de
`raceAppearance.json`, la vitesse au sol de chaque clip de marche mesurée par l'évaluateur, et
l'empreinte du GLB. Le manifeste refusé par `validerManifesteDeBase` fait échouer la construction.
Le dossier de la sortie devient le dossier de production de la base (`production.ts`) :
`manifest.json` (le manifeste complet sous `manifeste`, `model`, `model_sha256`,
`packs_sources`, `hors_release`) et `LICENSE-ual1.txt`, `LICENSE-ual2.txt`, `LICENSE-corps.txt`,
copies des textes de licence des packs ; `packs_sources.<pack>` porte le chemin, l'empreinte et la
copie de licence (`licence`) de chaque pack, que la provenance garde par pack sous le nom du texte
déposé. Il s'importe tel quel, sans publication (section 6) :

```sh
node hotes/godot/importer.mjs /atelier/base humanoide --destination /atelier/modeles --sans-publier
```

L'élément se valide et s'évalue ensuite contre `/atelier/modeles/humanoide.manifeste.json` et
`/atelier/modeles/humanoide.glb`, déposés par cet import.

## 2. Choisir catégorie, clé et contrat artistique

Lire la table exécutable des catégories avant d'écrire le manifeste :

| Catégorie | Champs exacts de clé | Liaison | Couleur |
|---|---|---|---|
| corps | partie, forme | squelette | palette |
| tete | tete | squelette | palette |
| pilosite | coiffure | squelette | palette |
| vetement | piece | squelette | palette |
| armure | piece | squelette | teinte |
| accessoire | piece | rigide ou surface | teinte |
| rigide | apparence | rigide | teinte |
| trait | trait | squelette | palette |
| decor | prop | rigide | teinte |
| vehicule | definition | rigide | teinte |

Choisir les ids sémantiques dans la donnée du jeu, jamais dans un libellé. Rechercher l'id et
les variantes du concept avant d'en créer un. Une clé de tête n'a pas de sexe ; une variation de
couleur n'ajoute aucun élément. Pour une pièce non encore définie, son id et son ensemble sont
une dépendance de donnée du lot T : ne pas déclarer sa résolution acquise. Un seul élément par
(base, clé) ; un nom local dérivé tel que `humanoide--rigide--epee` distingue les catégories,
et pour un corps il inclut partie et forme. Le manifeste ne porte pas d'id arbitraire.

Les catégories corps, tête, pilosité, vêtement, armure, accessoire et trait portent une couche :
peau < dessous < tenue < armure < manteau. L'armure impose armure. Les trois autres catégories
n'ont ni couche ni couverture. `couvre` est requis pour les éléments skinnés, optionnel pour un
accessoire ; ses ids viennent des zones de la base. Une couverture déclarée reste à mesurer.
Seul un vêtement peut ajouter/déplacer des emplacements ; chaînes et silhouettes optionnelles
doivent exister dans la base. La liaison de manifeste ne contient que son mode.

Une tête porte aussi la shape key visage_inverse pour le faceFlip résolu. Vérifier sa présence
dans le GLB ; ne la déclarer parmi les silhouettes qu'avec une base qui la connaît. Si la base
ne l'expose pas, remonter la dépendance à L1. Le validateur de forme seul n'impose pas cette
présence : son OK ne prouve pas cette exigence d'import L3.

Une **zone** est une région du corps ; un **emplacement**, un point d'accroche ; une
**localisation**, une localisation de règle d'armure ; une **prise**, main ou off.
La base humanoïde déclare 16 emplacements dans `scripts/personnage-3d/base/anatomie.py`.
Les prises se lisent dans son manifeste, main sur hand_r et off sur hand_l.
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
coutures et usure restent du détail. Palette mate limitée, ombrage flat/smooth intentionnel.

Un blason (emblème d'unité, de province ou de culte) n'appartient pas à l'élément : la pièce garde
un champ neutre (écu uni, lame nue, insigne vierge) et le contrat nomme chaque surface qui le
porte. #3111 (« Schéma 3 : blason posé au montage sur les surfaces déclarées d'un élément, jamais
peint ») en fait une déclaration du manifeste.

## 3. Bloquer l'ensemble, construire par dépendances

Faire un blocage de l'ensemble de référence sur la base, puis travailler **un seul élément**
avec son support, les éléments non repris masqués. Éprouver immédiatement prises, trous et
dégagements dans les poses utiles. Comparer au dessin au même angle, à échelle comparable,
puis à taille du jeu, avant textures et microdétail.

Ordre : corps/pose → vêtements porteurs → couches et accessoires → assemblage de contrôle.
Anatomie, coupe et raccords précèdent plis et matières. Conserver le donneur intact avant
simplification ; protéger frontières, articulations et doigts. Une triangulation aléatoire
ne crée pas un style. Pas de coque moulée pour robe, manteau ou cape de silhouette.

Écrire **un fichier Python de données par élément**, dans le dossier de production local :
identité base/catégorie/clé, paramètres de volumes, surfaces colorables et dépendances de base.
Séparer le fichier de données des preuves et du manifeste livré. Le kit fournit des primitives,
pas encore un format de données ni un constructeur universel d'éléments : l'auteur compose
un point d'entrée bpy local qui lit son fichier et appelle le kit. Ne pas annoncer un chargeur
par découverte AST disponible ; il appartient à la chaîne prévue par le design.

Réutiliser `scripts/personnage-3d/geometrie.py` pour mesh, shell, closed_shell, double_shell,
thick_grid ; surface_tree, surface_hit, section_points et opening interrogent le porteur.
Ces requêtes placent la géométrie ; elles ne valident rien. Dériver les placements des os et
surfaces réelles, sans coordonnées d'un ancien personnage. Emprunter les poids du porteur au
repos, puis ceux des chaînes requises ; transférer les silhouettes. Vérifier d'abord que les
helpers nécessaires existent : ne pas confondre une extension prévue du kit avec une API livrée.

Pour un personnage complet, trois agents à fichiers/sorties disjoints : tête et pilosité ;
corps, vêtements et armure ; rigides et accessoires. Chaque brief donne base hachée, éléments,
budget et fichiers possédés. Aucun agent ne modifie le kit partagé ni les voisins ; une adaptation
nécessaire revient à l'orchestrateur. Sérialiser les builds lourds, chacun borné à **moins de 270 s**.
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
Une pose utile absente relève de la base et de sa porte, pas d'un nouveau clip embarqué par l'arme.

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
   racine hors `decor`/`vehicule` (`hotes/godot/asset/element.ts` `REGLES_DES_CATEGORIES`).
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
Couleur de base en niveaux de gris ; surfaces reliées à palette ou teinte, sans couleur cuite, blason ni
illustration en texture. La cuisson de géométrie vers texture peut utiliser le kit.

Réutiliser une vue seulement si export et pose sont identiques. Après deux échecs du même défaut,
changer de construction, provenance ou méthode de mesure avant une troisième retouche ; lire le
diagnostic ciblé. Si l'utilisateur contredit un PASS, identifier cause et contrôle manqué,
revoir les interfaces de même classe et les tenues concernées dans le périmètre autorisé.

### Commandes utilisables

Depuis la racine du dépôt, après avoir écrit le constructeur local et son fichier de données :

```sh
node scripts/personnage-3d/environnement.mjs /atelier/construire.py --donnees /atelier/humanoide--rigide--epee.py --base /atelier/base/humanoide.glb --sortie /atelier/humanoide--rigide--epee.glb
```

Les options après le script sont **l'interface à écrire par l'auteur dans son constructeur local**,
pas une commande de construction fournie par le dépôt. Le lanceur transmet ces arguments.
Le constructeur importe le kit depuis la racine résolue du dépôt. Garder source éditable et
paramètres avec la sortie ; ne pas copier un kit privé en parallèle.

L'auteur écrit aujourd'hui le manifeste à la main, ou dans son constructeur local ; aucun écrivain
de manifeste d'élément schéma 3 n'est fourni. Exemple minimal d'élément rigide (choisir une clé
réellement définie ; remplacer empreinte et octets par ceux du GLB final) :

```json
{
  "schema": 3,
  "base": "humanoide",
  "categorie": "rigide",
  "cle": { "apparence": "epee" },
  "liaison": { "mode": "rigide" },
  "surfaces": [{ "nom": "metal", "teinte": true }],
  "glb": { "sha256": "REMPLACER_PAR_64_CARACTERES_HEXADECIMAUX", "octets": 1 }
}
```

Pour les autres catégories, appliquer la table et les champs de la section 2. Les noms de surfaces
doivent correspondre à ceux de l'export ; la validation de forme ne le prouve pas. Ne pas ajouter
provenance, captures, chemin du GLB ou décision utilisateur dans ce JSON fermé : fichier séparé.

La CLI canonique appelle validerElement avec les octets du GLB pour vérifier forme, références
à la base, empreinte SHA-256 et taille. Fournir manifeste d'élément, manifeste complet de base,
puis GLB d'élément, depuis la racine du dépôt :

```sh
npm run godot:valider -- /atelier/humanoide--rigide--epee.element.json /atelier/modeles/humanoide.manifeste.json /atelier/humanoide--rigide--epee.glb
```

Sorties : 0 si la validation passe ; 1 si refus ou erreur de lecture ; 2 si usage incorrect.
Une empreinte ou une taille différente reçoit le code glb-different du validateur canonique.
Cette validation ne remplace pas l'évaluation géométrique du GLB.

Évaluer ensuite le GLB final sur la base ; **--manifeste désigne ici le manifeste de BASE**, pas
celui d'élément. Le dossier du rapport doit déjà exister :

```sh
npm run godot:evaluer -- /atelier/humanoide--rigide--epee.glb --base /atelier/modeles/humanoide.glb --manifeste /atelier/modeles/humanoide.manifeste.json --json /atelier/mesures/neutre.json
npm run godot:evaluer -- /atelier/humanoide--rigide--epee.glb --base /atelier/modeles/humanoide.glb --manifeste /atelier/modeles/humanoide.manifeste.json --facteurs sl=1,legs=1,arms=1,head=1,st=1 --json /atelier/mesures/gabarit.json
npm run godot:evaluer -- /atelier/humanoide--rigide--epee.glb --base /atelier/modeles/humanoide.glb --manifeste /atelier/modeles/humanoide.manifeste.json --silhouettes feminin=1,corpulence=1,carrure_moins=0,carrure_plus=1 --json /atelier/mesures/silhouettes.json
```

La deuxième ligne montre la syntaxe des facteurs ; les remplacer par chaque ligne de
gabarit/surcharge requise. La troisième montre --silhouettes nom=poids,nom=poids : utiliser les
noms de la base et les extrêmes requis, en combinaison avec --facteurs pour couvrir la matrice.
Sans --clips, tous les clips de base sont échantillonnés. Ne pas valider une matrice entière
avec le seul cas neutre.

## 7. Deux validations distinctes

**Technique** : validerElement vérifie forme, références à la base et empreinte/taille du GLB
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
| base humanoïde | 6 000 | 1024² |
| tête | 2 500 | 512² |
| pilosité | 1 500 | 256² |
| vêtement par pièce | 2 500 | 512² |
| armure par pièce | 2 000 | 512² |
| rigide tenu | 1 200 | 256² |
| accessoire ou trait | 800 | 256² |
| prop d'art | 1 500 | 512² |
| personnage assemblé, base visible comprise | 16 000 | — |

Ne pas créer de plafond véhicule absent du contrat. La part de base masquée se mesure lors du
montage complet ; le budget de l'évaluateur présent ne remplace pas automatiquement ce calcul.

**Artistique** : identité, silhouette, proportions, pose, coupe, contacts et lisibilité. Un défaut
dominant renvoie à la construction ; un petit pli acceptable permet d'avancer. Gros trou, pièce
flottante, peau traversante, couture ouverte ou poing illisible ne passent pas sous une capture
distante. Éclairage/caméra/pose fixes ; une sonde différentielle temporaire peut isoler une cause,
puis restaurer le réglage de revue. Changer la lumière ne corrige pas la forme.

Pour chaque signe identitaire : vignette recadrée identiquement source/GLB, poses et clips utiles,
un **juge neuf rend un verdict OK/KO par signe**, avec preuve. Gros plans mains et jupes aux images clés ;
lineup face, trois-quarts et dos, taille de jeu et gros plan, à côté de l'illustration. Recette au visionneur par contrôles réels, deux faces et transitions,
retraits/remises de toutes les interfaces nommées. Une zone cachée reste NON VÉRIFIÉ.

Présenter ensuite les preuves à l'utilisateur ; consigner sa réponse **verbatim et datée** dans la
provenance avant d'entériner. Aucun des prototypes historiques n'est un précédent approuvé.
Un rendu Blender ne prouve pas Godot ; garder ce dernier contrôle ouvert jusqu'à sa recette.

## 8. Livrer et définir le fini

Livrer fichier de données, constructeur local et source éditable, GLB unique de l'élément,
manifeste schéma 3, provenance/licences et rapport lié aux empreintes exactes. Garder hors dépôt
illustration, contrat, captures et fiches de mesures ; ne pas réattribuer d'anciennes preuves à
un nouvel export. Les voisins restent identiques, signatures à l'appui.

Un élément est entériné après technique complète, porte artistique par signe et revue utilisateur
consignée. Le montage et le retrait dans la cible se prouvent ensuite par L3/L4. Un intermédiaire
se livre comme tel avec ses contrôles NON VÉRIFIÉS. Ne pas annoncer la porte finale L5 sur une
procédure seule : elle demande, depuis une illustration neuve, une instance neuve produisant tête,
vêtement et rigide, évalués, revus par l'utilisateur, puis montés dans le scénario L4.

## Disponibilité à sonder avant chaque production

Ces dépendances se vérifient dans le checkout utilisé, sans déduire leur livraison du design :

| Besoin | Source à sonder | Lot si absent |
|---|---|---|
| base hachée et porte complète, chaînes/silhouettes et matrice | constructeur humanoïde, manifeste livré, rapports et revue | L1 |
| garde-robe, pièces et ensembles résolvant la clé | données du jeu et identité publiée par le noyau | T |
| constructeur par données, découverte AST et extensions du kit | kit personnage-3d, point d'entrée de construction | chaîne L1/L2, méthode L5 |
| couverture, liaison et autres gardes complètes | appels de gardes de l'évaluateur Node | L1 |
| import contrôlé schéma 3, unicité, rapport de couverture | importeur d'assets et ses tests | L3 |
| montage par ids, couches et emplacements, contrôles de retrait | pont et hôte Godot | L4 |

## Importer une base et ses éléments

Chaque dossier de production contient `manifest.json`, le GLB qu'il nomme, au plus un `.blend`
et ses `LICENSE*.txt` (ligne `License:` obligatoire). Pour une base ou un élément au schéma 3,
`manifest.json` est une enveloppe de production séparée du manifeste fermé :

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

Importer la base avant ses éléments, dans la même destination :

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
écart. Deux bases de même identité reçoivent `base-en-doublon` ; deux éléments de même
`(base, cle)` reçoivent `cle-en-doublon`, même avec un autre nom de fichier ou une autre catégorie.

Tous les refus précèdent publication et écriture ; la CLI sort en 1 (usage incorrect : 2).
Un succès sort en 0, dépose `<id>.manifeste.json`, `<id>.provenance.json`, les licences et, au
schéma 3, `<id>.glb` local. `--sans-publier` conserve ces dépôts locaux sans appeler la Release.
Sans ce drapeau, le GLB et l'éventuel `.blend` sont versés sous leur empreinte dans la Release
`modeles-3d` avant les écritures locales. La destination par défaut est `hotes/godot/projet/modeles`.
Une production dont `manifest.json` porte `hors_release` (une raison non vide, ainsi la base
construite de packs Quaternius) est refusée `[hors-release]` sans `--sans-publier`. Un élément dont la
base déposée est hors Release en hérite : même refus, et sa provenance porte `hors_release` (`base <id> : <raison>`).

Ce contrôle d'import ne prouve pas le montage L4 ni les mesures géométriques de l'évaluateur.
La validation des clés par le noyau et le rapport de couverture appartiennent à L3b, après T3.
