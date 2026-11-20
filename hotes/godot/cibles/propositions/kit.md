# Kit visuel unique des maquettes : arbitrages (#4411)

Part de design seule : ce document tranche, il ne code rien. Il n'y a pas de troisième kit : la définition unique de
chaque pièce commune va dans `sources/gestes.js` et `sources/gestes.css`, que `sources/rendu.html` charge. Après
migration, `combat/socle.js`, `combat/combat.css`, `lieux-et-nuit/commun.js` et `lieux-et-nuit/commun.css` ne gardent
que ce qui est propre à leurs écrans (§ 5). Relevé de départ : `/mnt/project-files/kit-commun/inventaire.md`.

Abréviations : `S/` = `hotes/godot/cibles/propositions/sources/`. Aucune maquette de `propositions/` n'est validée
(`combat.md:5`, `lieux-et-nuit.md:4`…) ; les seules pages jugées sont `../maquettes/` (combat, lieu, voyage, fiche,
options), dont les deux socles dérivent chacun. En cas d'écart, la valeur retenue est donc celle qui sert le plus de
pages ou qui s'accorde avec la pièce voisine, et la raison le dit.

## 1. Teintes : les jetons de `:root`

Les dix jetons de `S/gestes.css:10-13` restent. Les couleurs en dur des deux socles se rangent sous les jetons
ci-dessous ; aucune autre couleur n'est écrite hors de `:root`. Les textures SVG (`gestes.js:12-13`, grain) gardent
leurs matrices telles quelles : ce sont des images, pas des teintes.

| Jeton | Valeur | Remplace (valeurs voisines fondues) | Emploi |
|---|---|---|---|
| `--ivoire` | `#f3e6c6` | `#f0e2c2`, `#f4e8ca`, `#f1e4c4`, `#f6ead0`, `#f3e6c6` | noms et libellés clairs sur bois |
| `--creme` (existant) | `#e9dcc0` | `#e6dabd`, `#eadfc4`, `#efe4c8`, `#e2d5b6` | texte courant sur bois |
| `--or-eclat` | `#f3dc93` | | haut du laiton armé, reflet |
| `--or-moyen` | `#c39c44` | `#b8923a`, `#c9a44c` | milieu du laiton armé |
| `--laiton` | `#a8842f` | `#9a7830` | laiton patiné |
| `--laiton-ombre` | `#4a3410` | `#5d4313` | bords de la matière laiton |
| `--encre` (existant) | `#2a1d12` | `#2a1a08` (texte sur laiton armé) | une seule encre |
| `--encre-2` (existant) | `#5a4530` | `#4a3420`, `#6b5a40` | encre secondaire, losanges sur parchemin |
| `--sepia` | `#3a1a10` | | titres gothiques sur parchemin |
| `--rouille` | `#5a2a12` | `#6b1c10` | rubriques sur parchemin |
| `--chene` | `#3b2718` | `#3a2517` | haut du bois, cœur des disques |
| `--bois` (existant) | `#2a1a10` | `#2b1b11`, `#24160d`, `#1f130b` | milieu du bois |
| `--chene-nuit` | `#1b100a` | `#1a0f08`, `#150c07` | bas du bois, bord des disques |
| `--lit` | `#0d0806` | `#120b07`, `#120a06`, `#150c07` (segments sur bois) | lit des jauges, champs et cases sur bois |
| `--fer-clair` | `#3a3833` | `#34322e` | matière fer |
| `--fer-eclat` | `#4a4740` | | reflet de la matière fer |
| `--fer-mat` | `#26231f` | `#2a2824` | haut d'une pièce fermée |
| `--fer-sombre` | `#131210` | `#141311`, `#17161a`, `#121114` | bas d'une pièce fermée |
| `--eteint` | `#8d8474` | `#7d7668` | texte ET pictogramme d'une pièce fermée |
| `--cire-sombre` | `#5a130b` | | bord du sceau |
| `--sang` | `#7c1f14` | | bas de la vie, plein du curseur, « échec » |
| `--encre-cire` | `#3a0c06` | | pictogramme gravé dans le sceau |
| `--lie`, `--lie-sombre` | `#5b1d14`, `#3c110b` | | ruban |
| `--vert-clair`, `--vert`, `--vert-sombre` | `#86a35a`, `#4c6a30`, `#22361a` | | sceau de réussite |
| `--parchemin-clair`, `--parchemin`, `--parchemin-sombre` | `#e6d5ad`, `#d6c196`, `#b89f6e` | `#d8c49a`, `#d3bf92`, `#cdb88a` | matière parchemin, pointes des bulles |
| `--toile-clair`, `--toile`, `--toile-sombre` | `#d9c69b`, `#a58d62`, `#6d5a3c` | | fond de portrait héros |
| `--ennemi-clair`, `--ennemi`, `--ennemi-sombre` | `#9a4030`, `#6a2015`, `#2e0c08` | | fond de portrait ennemi |
| `--pnj-clair`, `--pnj`, `--pnj-sombre` | `#8f8672`, `#5f5747`, `#37322a` | | fond de portrait PNJ |
| `--buste`, `--buste-ennemi`, `--buste-pnj` | `#2a1f17`, `#170a08`, `#14100c` | | silhouette du buste, par camp |
| `--chevelure` | `#1c1410` | `#15100c`, `#0c0605` | détails sombres d'un buste |
| `--contour` | `#150d04` | `#1a1005`, `#0c0705` | liseré sombre autour d'une pièce |
| `--filet-or` | `rgba(226,192,106,.35)` | `.3`, `.45` | liseré d'or (cadre, médaillon, lit des jauges, ruban) |
| `--filet-or-vif` | `rgba(226,192,106,.8)` | `.6` | liseré d'une pièce visée |
| `--filet-encre` | `rgba(60,40,20,.45)` | `.42`, `.4`, `.35`, `.5`, `.55`, `.6` | filets et séparations sur parchemin |
| `--trait-encre` | `rgba(60,40,20,.7)` | `.75` | contour d'un contrôle sur parchemin |
| `--filet-creme` | `rgba(201,185,149,.45)` | `.4`, `.6` | filets et cases vides sur bois |
| `--halo` | `rgba(255,214,140,.5)` | `.45`, `.55` | pièce armée |
| `--halo-vif` | `rgba(255,214,140,.75)` | `.7`, `.8`, `.9`, `.95` | pièce choisie, visée, outil ouvert |
| `--halo-ennemi` | `rgba(224,85,58,.6)` | | ennemi actif |
| `--reflet` | `rgba(255,220,160,.12)` | `.10`, `.07` | arête haute du bois |
| `--reflet-vif` | `rgba(255,245,200,.7)` | | arête haute du laiton armé |
| `--voile` | `rgba(255,245,215,.25)` | `.18`, `.2`, `.35` | fond d'un contrôle au repos sur parchemin |
| `--voile-fort` | `rgba(255,248,222,.55)` | `rgba(255,240,190,.5)` | champ de saisie sur parchemin |
| `--brou` | `rgba(70,40,10,.5)` | `rgba(90,60,20,.4)`, `rgba(60,35,5,.55)` | ombre intérieure du parchemin |
| `--ombre`, `--ombre-forte` | `rgba(0,0,0,.6)`, `rgba(0,0,0,.8)` | `.55`, `.65`, `.7`, `.75`, `.85` | ombres portées et intérieures |
| `--noir` | `#000` | | fonds, dégradés d'écran |

Police des chiffres : une seule classe `.chiffres` (`"Chiffres"` = Open Sans SemiBold, celle du jeu Godot, lue à
`../../projet/polices/OpenSans-SemiBold.ttf`) ; Grenze pour le chiffre d'un disque ou d'un sceau. Écartées : `.lin`
(la même police sous un second nom) et `.lineale` (Inter). Voir § 6, point 1.

## 2. Pièces : valeur retenue, valeurs écartées, raison

| Pièce | Valeur retenue | Valeurs écartées (fichier:ligne) | Raison |
|---|---|---|---|
| **Cadre** (`.cadre`, `.fond`, ferrures, clou) | `S/gestes.css:25-34` tel quel ; liseré du fond = `--filet-or`, y compris sur `.fond.bois` | `commun.css:4` (liseré `.3`, ombre intérieure `30px` noire) | une seule règle de fond ; l'écart `.3`/`.35` ne se voit pas |
| **Cadre : fonction** | `cadre(id, x, y, w, h, matiere, contenu, { ruban, classe, tete })` de `S/heros/heros.js:46`, montée dans `gestes.js` | assemblages à la main de `titre`, `bandeau`, `rail` (`commun.js:120-135`), `meuble` (`socle.js:76`), `bandeauDuJet` (`jet.js:14`) | seule fonction existante, déjà la plus générale |
| **Clous d'un meuble** | `clouer(cases)` : sans `cases`, le rythme du meuble (haut .0593 .2797 .7203 .9407, bas + .5 ; y = 3) ; avec `cases`, celui d'un bandeau de `cases` héros (.05, chaque séparation, .945, haut et bas : .05 .25 .5 .75 .945 pour quatre) | positions en pixels du bandeau (`commun.js:144`) ; `clouer` logé dans `jet.js:19` | les clous `quarts` tombent sur les séparations des quatre héros : deux rythmes réels, pas un. **Clous et ruban** : le ruban se dessine au-dessus de tout son cadre, clous compris, et aucun clou du haut ne reste à moins de 12 px d'un bord du ruban (queues comprises) : `cadre(…, { ruban })` retire ce clou, il ne le déplace pas. Les clous du bas ne sont jamais touchés |
| **Grain** | opacité `.2`, posée par `#grain` en CSS ; `monter(pieces)` unique = pose des pièces + grain, sans clou | `.3` en ligne (`socle.js:100`) ; `monter` à clous (`socle.js:97-101`, `commun.js:141-146`) | `.2` sert 97 pages et laisse les petits corps italiques nets ; les clous relèvent du gabarit, qui appelle `clouer` |
| **Dégradé `vignette`** | `#000` 0 à .5, .4 à .82, **.8** à 1 ; centre .5/.44, rayon .74 | .82 (`commun.js:9`) | écart invisible ; valeur du socle le plus ancien |
| **Dégradé `haut`** | `#000` **.6** → 0 | `#080a14` .78 (`socle.js:10`) | le bleu nuit est le ciel de la cour, pas une matière : il assombrirait les 97 scènes de jour ; la cour le repose dans `cour.js` si elle le veut |
| **Dégradé `bas`** | `#000` 0 → **.85** | .82 (`socle.js:11`) | le bas porte les meubles : le plus sombre des deux |
| **`flou(id, σ)`** | région `-40%` / `180%` ; jeu unique `f1` .8, `f2` 2, `f4` 4, `f6` 6, `f8` 8, `f18` 18 | région `-30%` / `160%` (`socle.js:7`) ; jeux partiels (`socle.js:8`, `commun.js:6`) | la région large ne coupe aucun halo ; l'union des sigma |
| `gauche`, `lueur`, `coeur`, `rims` | restent dans leur socle (un seul emploi chacun) | | propres à un écran |
| **Plaque : gabarit** | hauteur **40**, marge 2, rayon 3/2, Fell SC **15 px**, interlettrage 1, contenu `0 10px`, écart 9, pictogramme **19** trait 1.7 ; dans la rangée des gestes de la fenêtre du bas, la plaque prend la largeur de son emplacement (`PLACES`, `rendu.js`) et son libellé, centré, passe à **13/12 px** sur trois lignes au plus | h 44, 15.5 px, marge de contenu 0, pictogramme 21 (`combat.css:63-64`, `socle.js:52`) | 40/15 sert 97 pages et déjà les suites du jet en combat (`jet.css:24-26`) |
| **Plaque : échelle** | `moyenne` 40 / 15 px (défaut) ; `petite` 28 / 13 px (options du jet) ; `appel` 52 / 18 px, interlettrage 1.4, écart 12 (l'appel à l'action d'un écran : « Commencer », « Clore », « Terminer », entrées de l'accueil et du menu, issue du combat). Aucune hauteur de plaque ne se surcharge en page : 24 à 34 → `petite`, 36 à 46 → `moyenne`, 48 à 52 → `appel` | 44 (`combat.css:63`), 38 (`commun.css:101`), 34 (`combat.css:119`) → `moyenne` ; 28 (`jet.css:48`) = `petite` | deux hauteurs réelles ; 34, 38 et 44 sont la même plaque à 2-6 px près |
| **Plaque : repos** | radial `120% 140% at 50% 0%`, `--chene` → `--chene-nuit` 75 %, texte `--or`, arête `--reflet` | (identiques) | |
| **Plaque : survol** | repos + texte `--or-eclat`, liseré intérieur `--filet-or-vif`, halo `0 0 8px var(--halo)` | aucun état dessiné dans les maquettes ; Godot a `bouton-survol` | l'état manquait : il annonce l'armé sans le plagier, avec les jetons existants |
| **Plaque : armée** | linéaire `--or-eclat` / `--or-moyen` 55 % / `--or-sombre`, texte `--encre`, intérieur `inset 0 0 0 1px` + arête `inset 0 1px 0 var(--reflet-vif)`, extérieur `0 2px 4px` + halo `0 0 14px var(--halo)` | creux `inset 0 2px 5px rgba(60,35,5,.55)`, portée `0 1px 2px` (`combat.css:65-66`) ; halo .45 (`commun.css:32`) ; sans halo (`jet.css:27`) | l'arête claire dit « laiton plein » ; le creux la faisait lire comme enfoncée, et `jet.css:28` le défaisait déjà |
| **Plaque : fermée** | radial `--fer-mat` → `--fer-sombre`, texte et pictogramme `--eteint`, sans arête | `#2a2824` / `#141311` (`commun.css:34`) ; pictogramme `#7d7668` (`socle.js:52`) | mêmes teintes que le bouton rond fermé (`gestes.css:84`) ; libellé et pictogramme d'une même teinte |
| **Plaque : prix** | `.prix` à droite (`margin-left:auto`), `.chiffres` 12.5 px | `.lineale` (Inter) ; `font-family` écrite en ligne (`commun.css:35`) | police de chiffres unique (§ 1) |
| **Plaque : carte** | hauteur fixe **92**, largeur de son emplacement (`PLACES`, `rendu.js`) dans la fenêtre du bas, élastique de **200 à 262** dans une rangée ailleurs, à parts égales, écart 9 ; contenu à gauche, écart 13, portrait `moyen`, nom gothique **16/19** sur deux lignes au plus et sous-titre Spectral **13/16** sur trois (sa plus longue ligne passe à la ligne quand la carte est étroite), avec ou sans portrait. Sous 200 de large, ou à partir de quatre cartes, la rangée n'existe plus : les choix se lisent en liste (lignes de 36 à l'écart 5 ; 44 quand le détail d'une carte ne tient pas sur sa ligne et passe en deux, `ranger`), paginée par trois à la page de la carte choisie, « 1-3 sur 5 » (`cartesDu`, `rendu.js`) | largeur fixe 262 et nom 20/23 sur une ligne (`jet.css:66-74`) ; portrait `54 × 66` (`jet.css:68`) → `moyen` 48 × 58 ; tailles de texte reposées par le rendu (`rendu.css:28-29`) | trois cartes de 262 ne tiennent pas entre les deux camps d'une fenêtre de 960 ; une seule taille de texte, lisible à 200 comme à 262. C'est la seule pièce du kit qui s'étire, et seulement en largeur |
| **Plaque : variantes** | `.gauche` (contenu à gauche) gardée ; `plaque(libelle, { armee, fermee, survol, icone, numero, prix, taille, classe, style })` ; `numero` : la touche en tête, rond `--lit` de 19 px liseré `--filet-or-vif` (réponses du dialogue, sorts rapides) | signature sans `prix`/`style` (`socle.js:52`) | l'union des deux signatures, compatibles |
| **Bouton rond : gabarit** | `gestes.css:80-84` tel quel ; pictogramme `--or` ; fermé = fer, pictogramme `--eteint` ; armé (outil ouvert) = laiton plein, pictogramme `--encre`, halo `0 0 14px var(--halo-vif)` ; survol = halo `0 0 8px var(--halo)` | fermé `#7d7668` (`socle.js:51`, `commun.js:113`, `gestes.js:27`) | une teinte d'éteint ; l'armé reprend `combat.css:112-114` |
| **Bouton rond : échelle** | `menu` **20** (marge 2, picto 11 trait 3) · `petit` **34** (marge 3, picto 18) · `moyen` **44** (marge 4, picto 20) · `grand` **52** (marge 4, picto 24) · `maitre` **92** (marge 5, picto 44) | 16 (`jet.css:59`), 24 → `menu` ; 30 (`combat.css:85`), 32, 36, 38 (`combat.css:77`) → `petit` ; 40 (`gestes.css:57`) → `moyen` ; 50 (`commun.css:63`) → `grand` | treize tailles pour cinq rôles : réglage, outil, coin de panneau, sortie de lieu, fin du tour |
| **Croix** | `moyen` 44, droite 22, haut 18 (`gestes.css:46-47`) | `top:76px` (`combat.css:80`) reste une règle de l'écran de combat (la croix y passe sous `#systeme`) | inchangée |
| **Retour** | `grand` 52, libellé rubrique 14.5 px `--ivoire`, écart 13 (`gestes.css:49-51`) | | inchangée |
| **Ouvrir** | `moyen` **44**, libellé 13.5 px, écart 11 | 40 (`gestes.css:57`) | même rôle que la croix : un écran posé ; 40 était seul de sa taille |
| **Coins** (journal, système) | `grand` 52 | 50 (`commun.css:63`) ; `#systeme` 44 (`combat.css:79`) reste `moyen` | 50 et 52 ne se distinguent pas |
| **Outil à libellé** | `outil(nom, libelle, { ouvert, ferme })` : rond `petit` 34 + libellé Fell SC 11.5 px, interlettrage .7, `--creme-2`, largeur 88, écart 3 ; ouvert = rond armé, libellé `--ivoire` | montage en ligne avec `.replace` (`socle.js:83`) ; `#tour-outils` 38 (`combat.css:77`) → `petit` | la pièce existait sans fonction |
| **Pastille de jet** (`.pst`) | supprimée : c'est `rond(nom, 'menu', { arme: true })`, 20 px | `.pst` 26 (`commun.css:20-21`), 22 (`commun.css:136`), 20, 23, 24 par page ; `pastille()` (`commun.js:116`) | même disque de laiton plein que l'outil ouvert ; elle voisine le sceau `menu` de 20 |
| **Médaillon** (rond à pictogramme) | radial `--chene` → `--chene-nuit` 72 %, liseré `--filet-or`, ombre `0 3px 6px` ; états : repos (laiton, picto `--or`), fermé (fer, picto `--eteint`), inerte (fer, picto `--creme` : celui du cartouche de titre, qui ne se presse pas) | radial vers `#150c07` (`commun.css:43`) ; fer + crème écrit à la main (`commun.js:119`) | le même disque que le bouton rond ; l'inerte devient un état nommé |
| **Médaillon : échelle** | `grand` **54** (marge 4, picto 27) · `moyen` **40** (marge 3, picto 20) · `petit` **30** (marge 3, picto 15) | 46, 44 (`commun.css:69`), 42, 38 (`commun.css:44`) → `moyen` ; 34, 32, 30 (`commun.css:71`) → `petit` ; pictos libres 17, 19, 21 | huit tailles pour trois rôles : titre, poste ou bourse, tenant |
| **Disque numéroté** (ex-`medaillon` du combat) | `.disque` : fer, cœur radial `--chene` → `--chene-nuit` 70 %, chiffre **Grenze Gotisch 600** `--ivoire` ; vide = `--fer-mat` → `--fer-sombre`, chiffre `--eteint` | Lineale 18 px (`combat.css:225`) ; couleurs `#f1e4c4` (`combat.css:35`), `#f3e6c6` | le chiffre gravé dans un disque est un ornement, comme `.chiffre`, `#round .n` et le sceau du résultat, tous en Grenze |
| **Disque : échelle** | `grand` **42** (marge 3, 20 px) · `moyen` **32** (marge 3, 16 px) · `petit` **28** (marge 2, 16 px) | 46 → `grand` ; `.anneau` (`combat.css:224`) = `grand` | trois rôles : réserve de la fiche, borne du round, réserve du jet |
| **Compteur** (disque + libellé) | `compteur(n, libelle)` : disque `grand` + libellé rubrique 14.5 px, écart 13 | nom `medaillon(n, t)` (`socle.js:63`, `combat.css:223`) | deux pièces portaient le même nom : le médaillon garde le pictogramme |
| **Sceau** | radial `circle at 38% 30%`, `--cire-clair` → `--cire` 50 % → `--cire-sombre`, rayon `48% 52% 55% 45% / 52% 46% 54% 48%`, ombre et reliefs de `commun.css:19` ; contenu : pictogramme `--encre-cire` trait 1.9, ou chiffre Grenze 600 ; états `reussite` (verts) et `vide` (empreinte, `jet.css:30`) | `#d2553a` → `--cire-clair` ; deux règles identiques (`combat.css:57`, `commun.css:19`) ; `.resultat` à part (`jet.css:19`) | le résultat du jet est le même sceau, plus grand |
| **Sceau : échelle** | `menu` **20** (picto 12) · `petit` **28** (picto 15) · `moyen` **38** (picto 20) · `grand` **50** (picto 26, chiffre 27 px) · `maitre` **62** (picto 32) | 19 (`.etat-porte`), 22, 24 → `menu` ; 26 (`commun.css:19`), 30 (`combat.css:57`) → `petit` ; 58 (`recit.css:110`) → `maitre` ; pictos libres 11 à 17 | 26 et 30 tranchés au milieu : aucun des deux ne l'emporte, 28 existe déjà (`sauvegardes.css:17`) |
| **Ruban** | marge `2px 26px 4px`, **14.5 px**, `--ivoire`, `--lie` → `--lie-sombre`, liseré `--filet-or`, queues 9 px ; centré sur son cadre (`left:50%`, `top:-9px`, `translateX(-50%)`) ; variante `gothique` **18 px**, marge `1px 34px 4px`, interlettrage .6 ; `ruban(texte, { gothique, style })` | marge 22, 14 px, non centré (`combat.css:5`) ; 19 px, `top:-6px` (`jet.css:29`) | centré est le cas de tous les cadres sauf un ; 18 et 19 ne se distinguent pas |
| **Cartouche** | une pièce, deux tailles : `cartouche({ icone, nom, sous, marque, taille, largeur })`. `titre` : posé dans un cadre bois h 96 (104 avec la ligne de météo), médaillon `grand` inerte, nom gothique 31/44 `--ivoire`, sous-titre rubrique 12.5 px `--creme-2`, écart 14 ; `ligne` (défaut) : sans cadre, médaillon `moyen`, nom gothique 22/30, sous-titre rubrique 11.5 px, écart 11 ; sur parchemin `--sepia` / `--rouille` | la fonction `titre()` à part (`commun.css:38-46`, `commun.js:119`) ; `#round` (`combat.css:12-15`, 66 de haut, 30 px) reste propre au combat | même dessin (médaillon, nom gothique, sous-titre) à deux échelles : comme le portrait ou le sceau, une pièce et une échelle nommée |
| **Signets** | `signets(sections, ouverte)` : colonne de fanions, chacun **160 × 38**, écart 4, pointe rentrante de 10 px à droite, `--lie` → `--lie-sombre`, liseré `--filet-or` ; libellé rubrique 13 px `--ivoire`, interlettrage .6 ; compte à droite en `.chiffres` 10.5 px ; marque de section modifiée : point de cire de 8 px après le libellé. Ouvert : **176** de large (il dépasse de 16 px), laiton armé, texte `--encre`, libellé 14.5 px. Quinze signets au plus à l'écran, puis la colonne défile | définition de page (`accueil-et-systeme/options.css:48-55`), montage dans `rendu.js:171` | c'est la forme verticale des onglets (`dispositions.md`, arbitrage 21) : pièce commune aux options et au compendium |
| **Aperçu au survol** | `apercu({ nom, sous, corps, vers })` : parchemin, largeur **300**, la hauteur suit le texte, marge `11px 14px`, rayon 2, ombre portée `0 10px 22px var(--ombre)` ; tête : nom gothique 22/24 `--sepia`, à droite rubrique 12 px `--rouille` ; corps Spectral 14/19 ; pointe : losange de 16 px `--parchemin` sur le bord tourné vers l'élément survolé (`vers` : `gauche`, `droite`, `haut`, `bas`), à 12 px de lui | trois définitions et trois largeurs : `#apercu` (`combat.css:60-65`, 300), `.apercu` de `commun.css` (236), fiche d'un sort (322) | une largeur pour un rôle (`dispositions.md`, arbitrage 23) |
| **Bannière d'issue** | `issue(texte)` : ruban large **560 × 150**, queues en pointe rentrante, `--lie` → `--lie-sombre`, deux liserés `--filet-or` (bord, et un cadre intérieur à 10 px), titre gothique **60 px** `--ivoire` centré ; une plaque `appel` centrée 28 px dessous | carton de 960 pour un simple verdict | « Victoire », « Défaite », « Repli » sont une annonce, pas un texte à lire : la bannière est le ruban à l'échelle de l'écran. Place : `dispositions.md`, gabarit 7 |
| **Filets : famille** | une classe `.filet` : deux traits de 1 px (`::before`, `::after`) à opacité .5, teinte héritée : `--creme-2` sur bois, `--encre-2` sur parchemin, `--or` avec `.or`. Paramètres : `.fondu` (les traits s'éteignent vers les bords), `<i class="losange">` au milieu (écart 10). Marge par défaut `11px 0`. `filet({ fondu, losange, or })` | trois copies du dégradé crème (`voyage.css:21`, `interlude-en-ville.css:40`, `nuit-a-l-auberge.css:18`) ; `.page .filet` (`commun.css:111`, .42) ; `#feuille .filet` (`recit.css:103-105`, .6) ; `.orne` (`combat.css:219-221`, .45) ; `.filet-l` (`systeme.css:18-20`, .55) | quatre dessins = deux paramètres et une teinte de contexte |
| **Losange** | `.losange` : plein, **7 px**, teinte du filet | 8 px (`systeme.css:20`) ; 6 px évidé, bord 1.2 px (`heros.css:45`) | plein partout ailleurs ; l'évidé de 6 px ne se lit pas à l'échelle 1 |
| **Segments** | `.segments` : Fell SC 13 px, interlettrage **.8**, marge `3px 11px 4px`, rayon 3, contour `--trait-encre`, repos `--voile` + `--encre-2`, tenu = `--or-eclat` / `--or-moyen` 60 % / `--laiton` + `--encre`, séparation `--filet-encre` ; sur bois : repos `--lit` + `#a8997a` → `--creme-2`, contour `--contour` + `--filet-or` (`commun.css:157-164`) | `#a8997a` (`commun.css:153,162`) | `--creme-2` existe et se lit mieux sur le lit sombre |
| **Oui / Non** | `ouiNon(v)` = `segments(['Non', 'Oui'], …)` avec `.egaux` (cases de 46 px, marge horizontale 0) | règle `.oui-non` recopiée (`commun.css:144-149`), interlettrage 1 | même CSS, seule la largeur diffère (inventaire, doublon 5) |
| **Curseur** | `.reglette` de `commun.css:150-156` : hauteur 18, piste 3 px, plein `--sang` (sur bois : `--cire-clair` → `--sang`), poignée losange 12 px `--or-eclat` → `--laiton` ; `reglette(part, largeur = 118)` | `curseur(v, min, max, texte, l)` (`rendu.js:311`) reste le gabarit d'options (réglette + valeur) et appelle `reglette` | une seule définition existait |
| **Moins / plus** | `moinsPlus` de `gestes.js:27-28` ; ronds `menu` 20 | 16 px (`jet.css:59`) ; fermé `#7d7668` | 16 px est sous la taille d'un clic ; la colonne des dés gagne 8 px de haut |
| **Champ** | `gestes.css:70-78` tel quel, en jetons : libellé `--rouille`, valeur `--encre`, fond `--voile-fort` ; sur bois `--lit`, valeur `--ivoire`, vide `--eteint` | vide sur bois `#8d7f66` | une teinte d'éteint |
| **Bulle de refus** | `raison(texte)`, `.bulle-refus` (`gestes.css`) ; pointe `--parchemin` ; mobile `survol`, `data-dessus`. `poserLesBulles` la pose sans couvrir aucun texte (règle : `dispositions.md`, « Bulle de refus ») ; faute de place, la raison remplace la ligne `data-secondaire` de l'élément refusé, en `.raison-de-refus`. Elle porte aussi les influences d'un jet au survol du seuil d'un camp (`camp`, `combat/jet.js`), une ligne par modificateur | pointe `#cdb88a` | inchangée |
| **Défilement** | `defile(contenu, classe)` : `data-defile`, sans barre, le défilement vertical seul ; `suites` pose le fondu de pied (`.suite`) et de tête (`.avant`), haut de `--fondu` ; `au-pied` : il montre sa fin, sinon sa dernière action principale (plaque armée, `.en-cours`) vient au-dessus du fondu du pied ; `pages` : `paginer` règle sa hauteur sur un nombre entier de lignes et écrit « Page 1 sur N » au `.folio` de son cadre, caché sous deux pages | hauteur de contenu des panneaux | le cadre garde son rect (`dispositions.md`, « Débordement ») |
| **Mobile** | `mobile(ancre)` : `data-mobile data-ancre="survol \| scene \| ancre"` sur ce qui suit ce qu'il désigne, hors de la table des cadres | liste de noms exemptés | une marque dans le DOM, jamais une liste |
| **Portrait : gabarit** | `gestes.css:37-39` ; camps : `heros` (laiton, fond toile, buste `--buste`), `ennemi` (fer, contour `--noir`, fond ennemi, buste `--buste-ennemi`), `pnj` (fer, fond pnj, buste `--buste-pnj`) ; état `choisi` : halo `0 0 18px var(--halo-vif)` (ennemi : `--halo-ennemi`) | halo .55 (`combat.css:27`), .7 (`commun.css:17`), .8 (`combat.css:139`), .95 (`jet.css:46`) ; `.ennemi` seul côté combat (`combat.css:8-9`), `.pnj` / `.choisi` seuls côté commun (`commun.css:16-17`) | un portrait choisi, actif ou lu est le même état |
| **Portrait : échelle** | `menu` **26 × 32** (marge 2) · `petit` **38 × 46** (marge 3) · `moyen` **48 × 58** (marge 3) · `grand` **74 × 92** (marge 4) · `maitre` **96 × 118** (marge 4) · `affiche` **136 × 168** (marge 5) | 22×25, 26×26, 26×30, 28×34 → `menu` ; 32×38, 32×40, 34×40, 40×50, 42×50, 42×52 → `petit` ; 46×56, 50×62, 52×62, 54×66, 56×68 → `moyen` ; 62×76, 66×80, 74×90, 74×94, 78×96 → `grand` ; 88×108 → `maitre` ; 118×146 → `affiche` | 26 tailles pour six rôles : testeur, onglet, rang, bandeau, actif, fiche ; rapport constant ≈ .82 |
| **Vie et jauge** | une classe `.jauge` : lit `--lit`, liseré `--filet-or` (sur parchemin `--trait-encre`), rayon 1 ; teintes `cire` (`--cire-clair` → `--sang`, la vie) et `or` (`--or-eclat` → `--laiton`) ; ajout prévu `<u>` hachuré (`commerce.css:23`) ; `jauge(part, { teinte = 'cire', taille, ajout })`, `vie(pv, max)` = `jauge(pv / max)` | `.vie` (`gestes.css:40-42`) et `.jauge` (`commun.css:139-141`) à mêmes valeurs ; `jauge()` de `commerce.js:32` et `voyage.js:211` ; `#b9412c` → `--cire-clair` ; or `#e2c06a` → `#8a6a26` (`commerce.css:22`) | une pièce, deux teintes |
| **Jauge : échelle** | `fine` **6** (défaut) · `forte` **8** | 5 (`combat.css:24`) → `fine` ; 7 (`combat.css:97`, `commerce.css:21`) → `forte` | deux épaisseurs : dans un rang, en tête d'une mesure |
| **Pas en losanges** | `rangDePas(pleins, total, classe)` de `socle.js:71` ; losange 15 px, écart 7, plein `--ivoire` → `--creme-2`, vide `--lit` + `--filet-creme` (`combat.css:50-53`) | `#f0e4c6` → `#b9a57b` | une seule définition existait ; elle monte en jetons |
| **`PICTOS`** | union des deux tables (63 noms) ; les quatre clés communes sont identiques. Doublons de tracé fondus : `course` = `botte` → **`botte`** ; `fin` (sablier à sable) et `sablier` gardés distincts ; `defensive` (bouclier écartelé) et `bouclier` gardés distincts ; `hemorragique` et `goutte` (tracés voisins) → **`goutte`** ; `quitter` et `sortie` → **`sortie`** | `course` (`socle.js:29`), `hemorragique` (`socle.js:50`), `quitter` (`socle.js:48`) | trois dessins en double sous deux noms |
| **`BUSTES`** | union : `ilyanwe`, `berta`, `gobelin`, `orc`, `cheval` (`socle.js:19-25`), `bjorn`, `mira`, `aldric`, `greta` (`bustes.js:5-8`), `hote`, `docteur`, `brasseur`, `batelier`, `cocher` (`commun.js:60-64`) ; détails sombres en classe `.s` (`--chevelure`), clairs en `.c` (`--creme`) au lieu de `fill` en dur | `#15100c`, `#0c0605`, `#e6d6b0` | les clés sont disjointes ; `bustes.js` ne garde que `HEROS`. Second passage : `astrid` et `esquisse` y entrent ; les `ilyanwe` et `berta` redessinés de `heros.js` cèdent à ceux du kit. `drapier`, le négociant du Marchandage, et `gustav`, l'aubergiste de La Diligence, y entrent en PNJ (`CAMP`). Les voyageurs à recruter de la nouvelle partie y entrent : `kirsten`, `harbull`, `sigrid`, `malmir`, et `wanda`, qui porte le buste de `mira` |
| **Rond chiffré** | `rond(contenu, taille)` : un nom de pictogramme, sinon le chiffre en Grenze 600 18 px `--ivoire` | rond de 30 px monté à la main (`combat/socle.js:30`) | même pièce que tout rond, seul le contenu change |
| **Sceau de dé** | `sceau(jet, taille, { de })` : le chiffre (Grenze 700 28/26) et, 5 px dessous, le dé en Fell SC 10 px | deux sceaux montés à la main (`evenement.js:22`, `mer.js:56`) | même sceau, le dé en plus |
| **Jeton de réserve** | `reserves(r, taille)` (`combat/jet.js`) : par entrée `{ valeur, icone, nom, survol }`, une case de largeur fixe (**50**, **66** en `grand`), l'icône (pictogramme 20, trait 1,8, de `PICTO_DE_LA_RESERVE`, `rendu.js` ; ou portrait `menu` de qui la porte) à 4 px à gauche du `disque` ; `nom : valeur` dans la bulle au survol, aucun nom écrit | disque et nom en rubrique dessous, largeur selon le nom | l'icône identifie, le survol détaille (fiche `user-doctrine-icone-identifie-survol-detaille`) ; la case fixe ne bouge pas d'un nom à l'autre |

## 3. Correspondance des signatures, pour le migrateur

**`picto`**. Retenue : `picto(nom, taille = 22, couleur, trait = 1.6)`, celle de `commun.js:67`. Sans `couleur`, le
tracé prend la teinte de la pièce qui le porte (`stroke="currentColor"` : `--or` au repos, `--encre` armé, `--eteint`
fermé, `--encre-cire` dans un sceau) ; `couleur` ne se passe que hors pièce.

| Avant (socle combat) | Après |
|---|---|
| `picto(PICTOS.x, t, c, tr)` | `picto('x', t, c, tr)` |
| `picto(PICTOS[id], …)` | `picto(id, …)` |
| `PICTOS.course`, `PICTOS.hemorragique`, `PICTOS.quitter` | `'botte'`, `'goutte'`, `'sortie'` |
| `PICTOS.coque`, `PICTOS.barre` (ajoutés par `voyage/navale.js`) | s'ajoutent à l'union dans `gestes.js` |
| couleur d'état passée à la main (`'#2a1a08'`, `'#7d7668'`, `'#8d8474'`, `'#3a0c06'`, `'#e2c06a'`) | argument retiré |

**`portrait`**. Retenue : `portrait(genre, { camp, taille, choisi, classe, style })`. `camp` vaut `'pnj'` par défaut
pour `hote`, `docteur`, `brasseur`, `batelier`, `cocher` (la table `CAMP`), `'esquisse'` pour le héros qui se dessine
(trait de sanguine sur toile claire), `'heros'` sinon ; `'ennemi'` se passe toujours. Sans `genre`, la place est
libre : fer, fond sombre, pictogramme `plus` `--creme-2`.

| Avant | Après |
|---|---|
| socle : `portrait(g, 'ennemi')` | `portrait(g, { camp: 'ennemi' })` |
| socle : `portrait(g, 'heros')`, `portrait(g, camp, '')` | `portrait(g)`, `portrait(g, { camp })` |
| socle : `portrait(g, camp, style)` | `portrait(g, { camp, style })` |
| commun : `portrait(g, { classe: 'choisi' })` | `portrait(g, { choisi: true })` |
| commun : `portrait(g)`, `portrait(g, { classe, style })` | inchangé |
| taille posée par le contexte (`.rang .portrait{46×56}`…) | `taille` de l'échelle, règle de contexte retirée |
| `.replace('class="portrait', 'id="actif-portrait" …')` (`socle.js:85`) | `portrait(g, { camp, taille: 'maitre', classe })` dans un hôte `#actif-portrait` |

**`medaillon` et disque numéroté**. `medaillon` garde le pictogramme ; le disque prend deux noms neufs.

| Avant | Après |
|---|---|
| commun : `medaillon(nom)` | `medaillon(nom)` (`grand`) |
| commun : `medaillon(nom, { petit: true })`, `{ petit: true, taille: 17 }` | `medaillon(nom, { taille: 'moyen' })` |
| commun : `medaillon(nom, { ferme, taille: 21 })` (poste, 44 px) | `medaillon(nom, { taille: 'moyen', ferme })` |
| `.poste .tenants .medaillon` (30 px) | `medaillon('plus', { taille: 'petit' })` |
| `<div class="medaillon fer"><div>${picto(icone, 27, '#e9dcc0')}…` (`commun.js:119`) | `medaillon(icone, { inerte: true })` |
| socle : `medaillon(n, t)` (`socle.js:63`) | `compteur(n, t)` ; classe `.medaillon` → `.compteur` |
| `<div class="disque fer"><div>${n}</div></div>` (`socle.js:61`, `jet.js:34`) | `disque(n, { taille, vide })` : `moyen` pour la borne, `petit` pour les réserves |
| `.anneau` (`combat.css:224`) | `disque(n, { taille: 'grand' })` |
| `bourse()` (`gestes.js:33`) | appelle `medaillon('bourse', { taille: 'moyen' })` : marche enfin sur les 162 pages |

**Autres signatures qui changent.**

| Avant | Après |
|---|---|
| `rond(nom, 13…44, { ferme, couleur })` (taille du pictogramme en px) | `rond(nom, taille = 'moyen', { ferme, arme, survol })` : la taille est un nom de l'échelle, le pictogramme suit. Table de contexte : `.moins-plus`, `.des.regles` → `menu` ; `#journal .tete`, `#tour-outils`, `.outil` → `petit` ; `.croix`, `#systeme`, `.ouvrir` → `moyen` ; `.retour`, `#coins` → `grand` ; `#fin` → `maitre` |
| `pastille(nom)` | `rond(nom, 'menu', { arme: true })` |
| `sceau(nom, t)` (taille du pictogramme) | `sceau(contenu, taille = 'petit', { etat, bulle })` ; `contenu` = nom de `PICTOS` ou chiffre ; `etat` `reussite`, `reussite critique` (cerclé d'or) ou `vide` ; `bulle` : ce que dit le sceau survolé |
| `<div class="resultat reussite">37</div>` | `sceau(37, 'grand', { etat: 'reussite' })` ; `.resultat.vide` → `etat: 'vide'` |
| `<i class="sceau">${picto(…13…)}</i>` (`etatPorte`, `socle.js:68`) | `sceau(id, 'menu')` |
| `carte(nom, sous, { armee, fermee, portrait, classe })` (`jet.js:31`) | inchangée, montée dans `gestes.js` à côté de `plaque` |
| `<div class="ruban rubrique">…</div>` écrit à la main | `ruban(texte)` ; `ruban(texte, { gothique: true })` pour `#jet` et `cadre(…, { ruban })` |
| `<div class="ruban rubrique" style="left:880px;top:-9px">` (`socle.js:84`) | `ruban('Action', { style: 'left:930px' })` : le ruban est centré sur son `left` |
| `<div class="vie"><i style="width:…%">` | `vie(pv, max)` ; `.mesure .vie`, `#apercu .pv .vie` → `jauge(part, { taille: 'forte' })` |
| `jauge(pris, total, ajout)` (`commerce.js:32`) | `jauge(pris / total, { teinte: 'or', taille: 'forte', ajout: ajout / total })` |
| `jauge(part, classe)` (`voyage.js:211`) | `jauge(part, { teinte: classe === 'cire' ? 'cire' : 'or', taille: 'forte' })` |
| `<div class="filet">` (bois, 4 feuilles) | `filet({ fondu: true })` |
| `.page .filet` | `filet()` |
| `.orne`, `#feuille .filet` (`i` + `b`) | `filet({ losange: true })` |
| `.filet-l` (+ `i`) | `filet({ losange: true })`, `filet({ losange: true, or: true })` à l'accueil ; le `::before` court de `accueil-et-systeme/ouverture.css:5` reste une règle de l'ouverture |
| `.losange` (`heros.css:45`) | `<i class="losange">` du kit, marge de page gardée |
| `class="lin"`, `class="lineale"` | `class="chiffres"` |
| `clouer(b)` | `clouer()` ; bandeau des héros : `clouer(cases)` |
| `monter(ui)` | `monter(pieces)` puis, dans le gabarit, `clouer` de son meuble |

## 4. Pages dont le rendu changera visiblement, par dossier

Compte de pages : `inventaire.md`, en-tête. Un écart de teinte fondue dans un jeton (§ 1) n'est pas listé : il ne se
voit pas à l'échelle 1.

| Dossier | Pages touchées | Ce qui change |
|---|---|---|
| `combat/` (33) | toutes | plaques du meuble 44 → 40 et 15.5 → 15 px ; plaque armée à arête claire au lieu du creux ; haut de l'écran noir .6 au lieu de bleu nuit .78 ; grain .3 → .2 ; sceaux 30 → 28 ; outils du tour 38 → 34 ; ruban « Action » 14 → 14.5 px ; rangs : portraits 46×56 → 48×58, actif 66×80 → 74×92, fantôme inchangé (38×46), vie 5 → 6. Fiche (`fiche-*.html`) : chiffres des compteurs en Grenze au lieu d'Inter ; toutes les autres valeurs d'Inter (`.lineale`) en Open Sans (`.chiffres`) ; listes ouvertes : plaques 34 → 40 (`#liste` à rehausser de 18 px) |
| `combat-suite/` (36) | les 24 du socle combat : comme `combat/` ; les 12 du socle commun : comme `lieux-et-nuit/` | en plus, bandeau du jet (toutes celles qui lancent) : ronds de réglage des dés 16 → 20, ruban 19 → 18 px, portraits des testeurs 26×30 → 26×32, cartes : portrait 54×66 → 48×58 |
| `voyage/` (21) | les 8 du socle combat : comme `combat/` ; les 13 du socle commun | pastille « ouvrir » 40 → 44 ; jauges 8 inchangées ; sceau du dé 62 inchangé ; chiffres `.lin` → `.chiffres` |
| `lieux-et-nuit/` (5) | toutes | pastilles de jet 26 → 20 ; sceaux 26 → 28 (soins : 22 → 20) ; coins 50 → 52 ; médaillons 38 → 40, postes 44 → 40 ; rail : plaques 38 → 40 (rail + 14 px) ; chiffres `.lin` → `.chiffres` ; portraits du bandeau 74×94 → 74×92 |
| `commerce/` (10) | toutes | comme `lieux-et-nuit/` ; prix des plaques en `.chiffres` ; jauge de charge 7 → 8 ; sceau des refus 22 → 20 |
| `exploration-et-recit/` (14) | toutes | comme `lieux-et-nuit/` ; cachet de la feuille 58 → 62 ; filet à losange .6 → .5 |
| `heros/` (21) | toutes | comme `lieux-et-nuit/` ; losanges de séparation évidés 6 → pleins 7 ; portraits de fiche 118×146 → 136×168 et 88×108 → 96×118 là où ils existent ; sceaux des possessions 20 inchangés |
| `accueil-et-systeme/` (13) | toutes | coins 50 → 52 ; losange des filets 8 → 7 ; cachet de l'affiche 38 inchangé ; sceau de l'avis 28 inchangé ; chiffres en `.chiffres` |
| `outils/` (9) | toutes | comme `lieux-et-nuit/` ; sceau des refus 24 → 20 |

Le changement le plus large est la classe des chiffres : `.lin` (84 emplois sur le socle commun) change de nom sans
changer de police, `.lineale` (socle combat) passe d'Inter à Open Sans ; le plus visible à
l'œil, la plaque du meuble de combat et le haut d'écran sans bleu.

## 5. Ce que le migrateur retire de chaque socle

Entre l'écriture de `gestes.*` et la migration, les socles masquent le kit : leurs `const` de premier niveau
l'emportent sur les fonctions que `gestes.js` pose sur `globalThis`, et leurs feuilles, importées après `gestes.css`,
l'emportent à spécificité égale. `gestes.js` doit donc publier ses pièces par `Object.assign(globalThis, …)` depuis un
bloc, jamais par un `const` de premier niveau du même nom (erreur de redéclaration sur les 162 pages), et `croix`,
`retour`, `ouvrir`, `moinsPlus`, `bourse` doivent appeler le `rond` et le `medaillon` du bloc. Seule casse de
transition attendue : la fiche de combat, dont `.medaillon` (`combat.css:223`) reçoit les cotes du médaillon à
pictogramme tant que la classe n'est pas renommée `.compteur`.

- **`combat/socle.js`** : retirer `flou` et ses appels (l.7-8), `vignette`, `haut`, `bas` (l.9-11), `BUSTES` (l.18-24),
  `portrait` (l.25), `picto` (l.26), `PICTOS` (l.27-51), `rond` (l.51), `plaque` (l.52), `medaillon` (l.63),
  `rangDePas` (l.71), le grain et le `clouer` de `monter` (l.97-101). Restent : `gauche`, la grille (`A`, `B`, `P`,
  `losange`), `rang`, `borne`, `vieux` / `neuf` / `borneJ`, `SYSTEME`, `mesure`, `ETATS`, `etatPorte`, `JETONS`,
  `jetons`, `pas`, `meuble`, `vise`, `RESERVES`, réécrits sur les pièces du kit.
- **`combat/combat.css`** : retirer `.ruban` (l.5), `.portrait.ennemi` (l.8-9), `.borne .disque` (l.34-35), `.pas`
  (l.50-53), `.sceau` (l.57), `.plaque` et ses états (l.63-66, 141-142), `.outil` (l.68-69, 112-115), les tailles de
  `.bouton-rond` (l.73, 77, 79, 85), `@font-face Lineale` et `.lineale` (l.133-134), `.orne` (l.219-221), `.medaillon`
  et `.anneau` (l.223-225), les tailles de portrait des rangs (l.20, 27, 32) et leurs halos (l.27, 137, 139). Restent
  les placements (`#round`, `#ordre`, `#barre`, `#etat`, `#gestes`, `#fin`, `#journal`, `#apercu`, `#liste`,
  `#rapides`…), `.rang`, `.borne` hors disque, `.mesure`, `.jeton`, `.chiffre`, la fiche.
- **`combat/jet.js`, `jet.css`** : retirer `clouer` (`jet.js:19`), `carte` (`jet.js:31`), le disque de `reserves`
  (`jet.js:34`) ; `.resultat` et ses états (`jet.css:19,30-31`), `#jet>.ruban` (l.29), `.en-reserve .res .disque`
  (l.38-39, 41), les tailles de plaque (l.24-28, 48-49), de portrait (l.9, 43, 68), de rond (l.59), `.plaque.carte`
  (l.66-74).
- **`lieux-et-nuit/commun.js`** : retirer `flou` et ses appels (l.6-7), `vignette`, `bas`, `haut` (l.10-12), `BUSTES`,
  `portrait`, `BUSTES_PNJ`, `picto`, `PICTOS` (l.58-112), `rond`, `plaque`, `medaillon`, `pastille`, `sceau`
  (l.113-117), `titre` (l.119), `segments`, `ouiNon` (l.137-138), le grain de `monter` (l.141-146). Restent : `radial`,
  `lueur`, `coeur`, `rims`, `sapin`, `perso`, `flammes`, `fermer`, `bandeau`, `rail`, `coins`, `poste`.
- **`lieux-et-nuit/bustes.js`** : retirer `BASE` et `COMPAGNIE` ; reste `HEROS`.
- **`lieux-et-nuit/commun.css`** : retirer `#grain` (l.2), `.cadre>.fond.bois` (l.4), `.lin` (l.5), `.ruban` (l.6-7),
  `.portrait.pnj`, `.portrait.choisi` (l.16-17), `.sceau` (l.19), `.pst` (l.20-21), `.plaque` et ses états (l.24-31),
  `#titre` et `.medaillon` (l.34-41), les tailles contextuelles de portrait, de médaillon et de rond (`.heros`,
  `#coins`, `.poste`, `.onglet`, `.jouera .pst`), `.page .filet` (l.111), `.jauge` (l.139-141), `.oui-non`,
  `.reglette`, `.segments` (l.144-164). Restent `#recit`, `#bandeau`, `.heros`, `#coins` (placement), `.poste`,
  `.apercu`, `.hote`, `.pointe`, `#rail`, `.page`, `.onglets`, `.soin`, `.compte`, `.jouera`.
- **Feuilles et scripts de page** : le `.filet` en dégradé de `voyage.css:21-22`, `#feuille .filet` (`recit.css:103-105`), `.filet-l`
  (`systeme.css:18-20`), `.losange` (`heros.css:45`), `.jauge` de `commerce.css:21-23` et `voyage.css:18-20`, `jauge()`
  de `commerce.js:32` et `voyage.js:211`, `cadre()` de `heros.js:46`, toutes les tailles locales de `.sceau`,
  `.portrait`, `.medaillon`, `.bouton-rond`, `.pst`.
- **`gestes.css`** : la classe `.vie` (l.40-42) disparaît avec la dernière page migrée ; d'ici là elle partage la
  règle de `.jauge.cire`.

## 6. Ce qui n'a pas pu être tranché seul

1. **Police des chiffres : tranché.** Open Sans SemiBold, classe `.chiffres`, pour toute valeur ; Grenze pour le
   chiffre d'un disque ou d'un sceau. Inter (`.lineale`) et le nom `.lin` sortent des 162 pages. *Raison :* c'est la
   police du jeu Godot (`police.tres`), et la planche doit ressembler au jeu.
2. **Chiffre des compteurs de la fiche.** La fiche validée (`../maquettes/fiche-du-heros.jpg`) les porte en linéale
   18 px (Inter) ; je les passe en Grenze pour n'avoir qu'un disque. C'est le seul arbitrage qui s'écarte d'une page jugée.
3. **Haut d'écran du combat.** Le bleu nuit `#080a14` .78 figure sur les maquettes de combat validées. Je le sors du
   kit comme une lumière de scène ; s'il doit rester sur tous les combats, il revient à `cour.js`, pas au kit.
4. **Hauteur de plaque.** 40 l'emporte au nombre ; le meuble de combat validé est à 44. Le kit Godot est à 42 / 46 :
   aucune des trois valeurs ne coïncide, et le choix de 40 fixe aussi la cote à construire dans Godot.
5. **Survol.** Aucune maquette ne dessine l'état de survol d'une plaque ou d'un rond : celui du § 2 est une
   proposition, à juger sur la planche.
6. **Doublons 7 et 8 de l'inventaire, tranchés au second passage** : un `cartouche({ icone, nom, sous, marque })` au
   kit, à sa taille `ligne` (§ 2 : la taille `titre` est l'ancien `titre()`), que
   portent l'hôte posé dans la scène (`hote()` de `commun.js`, avec sa pointe), la ligne ouverte de la fiche et l'objet
   pris de la création ; un `rang(genre, { nom, gothique, sous, corps, fin })` au kit (nom rubrique 13.5 px, `gothique`
   19 px pour celui qui agit), que portent l'ordre du combat (`combattant()`), l'attribution du salon et les activités
   de l'interlude ; un seul `bandeau(dits, { groupe })` de `commun.js` pour toute rangée de héros (création, fiche,
   compagnie), une place sans `id` y étant libre ; `onglets(noms, active)` au kit, à `top:-9px` comme un ruban.
