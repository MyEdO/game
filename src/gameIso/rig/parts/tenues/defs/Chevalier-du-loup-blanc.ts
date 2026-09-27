import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Chevalier du Loup Blanc (AA 03 l.234-266) — templier d'Ulric, tête nue.
//
// ÉTALON DE FACTURE. Cinq idiomes réutilisables, à recopier pour tout le vestiaire :
//  · LAMELLE  : path fill=url(#g_steelD) (le gradient suit la bbox → clair en HAUT de chaque
//               bande) + nappe @metalO qui enfonce la masse + arête spéculaire @metalH TRACÉE
//               PAR-DESSUS la nappe + ombre portée @metalO sous le bord. Jamais un aplat+liseré.
//  · LUMIÈRE  : deux lames voisines ne captent JAMAIS le même reflet. `g_steelD` étant en
//               objectBoundingBox, il sert la MÊME rampe à toute bande → c'est la nappe @metalO
//               (0.3→0.55) et l'arête @metalH (largeur 0.3→0.7, opacité 0.5→1, parfois PARTIELLE
//               sur la longueur) qui décident quelle lame est au soleil et laquelle est à l'ombre.
//               Point SPÉCULAIRE (ellipse @metalH) sur les surfaces bombées : spallière, genou.
//  · MÈCHE    : une fourrure est majoritairement LISSE — c'est une ENVELOPPE, pas un bord denté.
//               Denter TOUT le contour ne corrige pas « la serviette », ça la remplace par un
//               cristal de glace (les deux ont été rendus et refusés à l'œil). La dentelure est un
//               ACCENT LOCAL : si un bord entier est denté, c'est faux. Géométrie réellement tracée
//               ici (contours mesurables par les 3 `d` ci-dessous) : ~62 % du périmètre en plages
//               lisses (ondulation basse fréquence ±0,85 u, deux sinus déphasés — un bruit
//               sous-pixel y laisserait une DROITE, un bruit haute fréquence une scie), puis par
//               masse 3 mèches LONGUES (4,8-6,9 u) isolées et 5 à 9 COURTES (1,6-3,3 u), toutes
//               espacées par ABSCISSE CURVILIGNE (un pas d'INDICE constant fait un peigne sur un
//               bord à sommets serrés) et toutes en GOUTTE : flancs Q concaves => pointe fine.
//               La BASE fait le matériau : mèche COURTE = base LARGE (~1× sa hauteur), une simple
//               ondulation à pointe tirée — une base étroite y ferait une aiguille à 45°, une
//               ronce. Mèche LONGUE = base étroite (~0,3×), mais ISOLÉE et en BAS (la densité suit
//               `t` = hauteur dans la masse) + biais `droop` vers +y : le poil PEND sous son poids.
//               Angle ±0,8 rad : une mèche tombe, sa voisine s'écarte — jamais un éventail.
//               PIÈGE : le `Z` d'un path ferme AU CORDEAU — cette arête n'est dans aucune liste de
//               points et échappe à tout générateur. Ici les 3 contours sont explicitement fermés
//               sur un sommet de l'enveloppe (segment Z mesuré = 0 u).
//               PIÈGE : une mèche posée sur le sommet 0 se dessine EN TRAVERS (sa pointe sert de
//               point de départ au tracé) => éperon en aiguille. Premier et dernier sommet lisses.
//  · HACHURE  : une hachure est un ACCENT posé sur une structure qui tient DÉJÀ sans elle, jamais
//               ce qui fait le poil. SEMÉE uniformément sur la masse elle ne lit pas « fourrure »
//               mais SALISSURE (grief des juges, 3 tours). Elle se GROUPE dans la bande de
//               transition ombre/lumière de sa vue et LAISSE DES PLAGES NUES : une hachure isolée
//               au milieu d'une plage claire est une tache. Densité réelle après tri (dos 122→24,
//               profil 135→26, face 131→19 ; les 2 lambeaux n'en portent plus). Plancher DUR :
//               stroke-width ≥ 0.2 u — en dessous c'est 0,06 px à 40px, ça n'existe pas, ça salit.
//  · VOLUME   : un poil se lit par sa STRUCTURE DE VALEUR (un côté franchement à l'ombre, un côté
//               éclairé), JAMAIS par sa texture. Test : en niveaux de gris, la masse doit tenir
//               SANS ses hachures. Trois tours ont été perdus à ajouter de la texture sur un plat.
//               La VALEUR se mesure, elle ne se déclare pas — Contrat de valeur : verdict du
//               harnais canonique `scripts/qc/mesure-volume.mts` (#635) (mesuré ici : 20,8 →
//               41,6 points, P90 93,6 % vs P10 52,0 %).
//               `fourrureO` est un token d'OMBRE, pas « la couleur de l'ombre » : à la valeur de
//               `metalO` face à `metal`, il sert toute la rampe par son OPACITÉ (comme l'acier).
//               Ordre EXACT : base → FACE OMBRÉE @fourrureO 0.58 (~50 % de la masse, du côté opposé
//               à la lumière = le BAS, convention de l'acier où toute arête haute est @metalH) →
//               PLIS verticaux (creux @fourrureO 0.22 + lèvre @fourrureH 0.3 — au-delà, la lèvre
//               CRÈVE la face d'ombre et rend le patchwork) → touffes @fourrureO 0.26/0.14 (bords
//               DURS à la valeur de la face = des TROUS, pas du poil : elles restent un accent) →
//               PUIS SEULEMENT, en DERNIER (une ombre posée après les mange) : CRÊTE @fourrureO
//               0.35 offset ~3 u sous l'arête haute, et BORD ÉCLAIRÉ @fourrureH width 3 TRACÉ SUR
//               l'arête haute de l'enveloppe — le clip n'en garde que la moitié intérieure, d'où
//               un liseré franc sans débord. Crête + bord = l'ÉPAISSEUR de la pelisse sur l'épaule.
//               L'arbitrage « garder crème » (2026-07-16) porte sur la teinte DOMINANTE de la masse
//               (elle doit trancher sur l'armure à 40px) — PAS sur la plage de valeurs INTERNE :
//               une masse qui a du volume tranche MIEUX qu'une tache plate. Médiane ~80 % = crème.
//               Ombre et plis se taillent par CLIP de la silhouette (`<clipPath id="wwfur-*">`,
//               patron `authoring/roofsSvg.ts`) → débord impossible, et l'enveloppe reste libre d'évoluer
//               sans retoucher chaque couche. Les couches qui SUIVENT le bord sont tracées sur
//               l'enveloppe LISSE, jamais sur les mèches : une pointe noyée dans @fourrureO relit
//               comme un éclat de glace DÉTACHÉ de la masse — la pointe doit rester en couleur de
//               base et accrocher la lumière.
//  · CUIR     : une sangle est un CYLINDRE aplati, jamais un ruban. base @vet2 + cerne → NAPPE
//               @vet2O sur toute la sangle → bord BAS ombré @vet2O → PUIS SEULEMENT bande haute
//               @vet2H + arête spéculaire → COUTURE (pointillé @vet2O). Sans la nappe et le bord
//               bas, c'est « un trait plat ».
//  · PLAQUE   : une pièce d'orfèvrerie = N plaques DISTINCTES, chacune avec sa bande haute
//               éclairée @orH, sa bande basse ombrée @orO, son cerne, son rivet + éclat, son
//               POINT SPÉCULAIRE (@orH, posé APRÈS les bandes — sans lui la plaque lit comme du
//               carton peint) — et une ombre PORTÉE sous l'ensemble. Un aplat + liseré ne fait
//               jamais du métal.
//  · ANCRAGE  : une part accessoire ne repose JAMAIS sur le vide — l'ancrage est une OMBRE PORTÉE
//               posée AVANT le crâne, dans la matière de ce qu'il écrase. Sur les TROIS vues le
//               crâne pèse sur la PELISSE (une seule dépouille, #644 it3 : l'acier rapporté de
//               face a suivi celui d'it1 — l'épaule réelle porte déjà sa spallière au slot
//               `bras`) : l'ombre est @poilO (0.55/0.38) dans la fourrure. Celle de PROFIL est au
//               plan `avant` : au plan `fond` la masse de fourrure du torse (z=5) l'occulte à
//               100 %, et le crâne redevient posé sur le vide — un support invisible n'ancre rien.
//  · SÉPARER  : deux masses claires ADJACENTES exigent une séparation SOMBRE, vérifiée À 40 px —
//               sinon elles fusionnent en UNE tache (crâne d'ivoire ↔ pelisse crème : à 40px on ne
//               voyait plus de crâne du tout). Un cerne de 0.9 u = 0.27 px à 40px : il n'existe
//               pas. La séparation qui TIENT est un HALO : le path du crâne tracé DEUX FOIS, une
//               1re fois en @poilO plein + stroke 2.2 (soit 1,1 u de halo extérieur = 0,33 px),
//               puis le crâne par-dessus avec son cerne 0.9. Toute finesse se mesure en PX À 40,
//               jamais en unités SVG.
//  · RIVET    : point @metalO + éclat @metalH décalé d'un quart de pixel.
//  · CHAIR    : la chair (peau nue à un poignet, une gorge, un visage) appartient au PERSONNAGE,
//               jamais à la tenue — `@peau`/`@peauO`/`@peauH` ou `url(#dg-v-@peauH-@peauO)`, jamais
//               un littéral hex (`PART-CONTRACT.md`, « Gradients partagés »). Un littéral
//               hex n'est légitime QUE pour une matière propre à CETTE tenue (son cuir, son acier
//               — une couleur qui lui appartient, à elle) — jamais pour recopier une valeur déjà
//               déclarée dans `palette` (#583, garde `parts/tenues/palette-literal.test.ts`).
//               Corollaire, gardé au type (`PaletteDeCouchePortee`, `palette.ts`) :
//               la `palette` du def elle-même ne DÉCLARE JAMAIS `peau`/`peauO`/`peauH` — 16 tenues
//               le faisaient tout en peignant l'art avec les bons jetons, et cette valeur de
//               PALETTE (prioritaire sur l'espèce dans l'empilage `couchesDuRig`) écrasait
//               quand même la peau du porteur. Une tenue déclare cuir/tissu/métal, jamais chair.
//  · CHEVEUX   : même contrat que CHAIR, flanc jumeau (#599) — les cheveux appartiennent au
//               PERSONNAGE, jamais à la tenue. Un slot `tete` qui peint une VRAIE chevelure (mèche,
//               crâne dégarni, mohawk…) le fait TOUJOURS en `@cheveux`/`@cheveuxO`/`@cheveuxH`,
//               jamais un littéral hex, et la `palette` du def ne DÉCLARE JAMAIS ces 3 clés (même
//               garde que CHAIR ci-dessus). Ce fichier n'en a pas besoin (tête nue, cf. l.3) mais
//               `Contrebandier.ts`/`Juriste.ts`/`Artiste.ts`/`Flagellant.ts` en sont l'exemple : art
//               inchangé, seule la `palette` perd ses 3 clés `cheveux*`. Piège inverse rencontré
//               (`Nonne.ts`) : un jeton `@cheveux*` peut peindre une AUTRE matière (guimpe, capuche)
//               qui RESSEMBLE à des cheveux sans en être — dans ce cas c'est le NOM du jeton qui est
//               faux, pas la palette : renommer vers un jeton de vêtement dédié (`@voile*`), hex
//               INCHANGÉ, jamais suivre l'espèce pour une matière qui n'est pas la chevelure.
//
// À NE PAS COPIER — condition posée par le juge d'art à l'acceptation de cet étalon
// (verdict « BON AVEC RÉSERVES », 2026-07-17). Ce fichier est fait pour être recopié : ce qui
// suit est ce qui NE doit PAS l'être, sous peine de dupliquer un défaut 117 fois.
//  · La DENTURE comme langage de bord, et SURTOUT sa réutilisation d'une matière à l'autre :
//    l'ourlet de fourrure et le lambeau d'entrejambe portent ici la MÊME dent (même pas, même
//    amplitude) — « deux matières différentes qui portent la même dent, ça se voit comme un
//    outil, pas comme une déchirure ». Une déchirure de tissu et un ourlet de fourrure n'ont pas
//    le même bord. Copiée telle quelle : 117 pièces à scie circulaire.
//  · Les PLAQUES À BORDS DURS dans le dedans de la fourrure (les touffes restent des polygones).
//    Toléré ICI parce que le contraste de masse porte la lecture — érigé en méthode, c'est la
//    signature « polygone » du vestiaire entier.
//  · Le LAMBEAU CENTRAL pendant entre les jambes : exception FIDÈLE à cette illustration précise
//    (donc gardé — la source prime), jamais un motif. Aucune tenue ne doit en ajouter un « parce
//    que l'étalon en a un ». À 40px il lit comme une fente de lumière qui coupe la figure en deux.
//  · La MICRO-RAYURE haute fréquence du torse : elle fond en gris uni dès 40px. Coût de dessin
//    non nul, gain de lecture NUL. Règle générale qui en découle : un détail qui ne survit pas au
//    test 40px ne se dessine pas.
//
// Lecture à 40px : elle est portée par le CONTRASTE DE VALEUR entre matières adjacentes —
// acier anthracite ↔ pelisse crème ↔ crâne d'ivoire ↔ ceinture de laiton bruni. Pas par la
// teinte. Ce qui doit survivre à 40px est AGRANDI et SIMPLIFIÉ exprès : le crâne fait ~15 unités
// (≈ la tête du gabarit), il MORD la ligne d'épaule au lieu de pendre en breloque à l'intérieur.
//
// Repères (contrat de part, torse : origine = taille, -y = haut) mesurés au rendu :
//  · la TÊTE couvre x -8..+8 jusqu'à y≈-22 → rien d'utile au centre au-dessus de -22 ;
//  · le bras VUE-GAUCHE (epauleG, z=4) est DERRIÈRE le torse → l'art déborde dessus (crâne ET
//    pelisse de face : la masse de fourrure vit dans le slot, miroitée par `scale(-1 1)`) ;
//  · le bras VUE-DROITE (epauleD, z=8) est DEVANT → l'art au-delà de x≈+11 y est masqué : ce qui
//    doit y vivre passe par `overlays` (crâne de dos — voir en bas de fichier) ;
//  · l'écart des jambes ne laisse que x -4.5..+4.5 (la jambe vue-droite, z=6, passe devant) ;
//  · la main droite (`mainD`, os `arme` z=9) tient l'arme vers x≈21, y≈+6 : la pelisse vivant à
//    x NÉGATIF de face, elle ne la touche plus — c'est la pelisse qui céderait, jamais l'arme.
// D'où la composition (#644 it3, verdict du juge-vision : UNE seule dépouille, jamais « deux
// trophées ») : crâne ET pelisse sur l'épaule DROITE du personnage (= vue-gauche de face, côté
// qui déborde), le pelage drapant depuis l'épaule qui porte le crâne ; de DOS les côtés
// s'inversent → crâne + monticule d'épaule côté vue-droite (overlay), la cape suit dans le slot.
//
// Proportions RELEVÉES sur l'illustration (grille de mesure sur `art-ref/aa-carrieres/
// page035_img3`), puis ADAPTÉES : l'illustration est un homme de ~7,5 têtes, le rig un gabarit
// de ~5 têtes à grosse tête → les repères se transposent en FRACTION de la largeur du torse,
// jamais en décalque. Crâne = 84x94 px source, soit la taille de la tête de l'homme ; masse de
// fourrure = bord extérieur à ~2,08x la demi-largeur du torse (d'où x≈25 ici, franchement
// au-delà du bras à x≈20 : c'est ce débord qui CASSE le contour).
export const tenue: TenueDef = {
  label: 'Chevalier du Loup Blanc',
  id: "chevalier-du-loup-blanc",
  palette: {
    // acier lamellaire ANTHRACITE à ruptures spéculaires fortes (relevé au zoom : la masse est
    // sombre, ce sont les arêtes qui brillent — l'inverse d'un gris moyen uniforme).
    metal: '#4c5663', metalO: '#0f1216', metalH: '#ccd6e2',
    // pelisse : crème chaud, ombres BLEU-GRIS (teinte relevée sur l'illustration, non gris neutre)
    // mais à la VALEUR de l'acier, pas à la sienne : `fourrureO` est un token d'OMBRE (comme
    // `metalO` #0f1216 face à `metal` #4c5663), pas « la couleur de l'ombre ». Un #9ca9b4 posé à
    // 0.5 sur le crème compose à 78 % de luminance contre 94 % pour la plage éclairée : 15 points
    // d'écart, mesurés — l'œil n'y voit AUCUN volume, seulement une salissure. Trois tours ont été
    // perdus à ajouter de la texture par-dessus ce plat. Valeur seule : voir § VOLUME.
    fourrure: '#f2efe4', fourrureO: '#48535f', fourrureH: '#fdfcf6',
    // hachures du poil : brun-violacé très sombre (le trait d'encre de l'illustration).
    poil: '#3f3540', poilO: '#221d23', 
    // crâne : ivoire à patine ocre.
    os: '#ece2c6', osO: '#a08a58', osH: '#faf6e8',
    // orbite et cavités : olive sombre (et non noir — relevé au zoom).
    orbite: '#4b4b36',
    // baudrier de cuir rouge (sangle d'épée).
    vet2: '#9c4442', vet2O: '#5a2224', vet2H: '#bd6b60',
    // ceinture de laiton BRUNI : le plus clair de l'illustration est #c7b081 — un tan chaud à 35 %
    // de saturation, pas un jaune. Plus saturé que ça, la seule pièce d'or de la tenue jure contre
    // l'acier mat (23 %). Ce qui porte la lecture à 40px est sa VALEUR (66 % contre 39 % pour
    // l'acier), jamais sa teinte.
    or: '#a8956a', orO: '#4a3f22', orH: '#ddd2ab',
    cuir: '#5b4229', cuirO: '#231a10', cuirH: '#8c6c46',
  },
  set: {
    pied: BOTTE_CUIR,
    // Pas de slot `tete` : le chevalier est tête nue dans l'illustration. Cheveux/barbe/visage
    // viennent de la couche PERSONNAGE — une tenue n'en dessine JAMAIS. La fourrure de col se
    // dessine dans l'art de torse (`set.torse`), qui ne couvre que le devant/profil/dos du buste.
    torse: {
      front: `<g stroke="@metalO" stroke-width="0.5" stroke-linejoin="round">
<path d="M-11.8 -30 Q0 -33.6 11.8 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="url(#g_steelD)"/>
<path d="M-11.8 -30 Q0 -33.6 11.8 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M-9.4 -27.6 Q-10.1 -14 -9.1 -1.4" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M-8.5 -27.8 Q-9.2 -14 -8.2 -1.4" stroke="@metalH" stroke-width="0.34" opacity="0.3"/>
<path d="M-6.3 -28.8 Q-6.9 -14 -6.1 -1.2" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M-5.4 -29 Q-6 -14 -5.2 -1.2" stroke="@metalH" stroke-width="0.38" opacity="0.52"/>
<path d="M-3.1 -29.6 Q-3.5 -14 -3 -1.1" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M-2.2 -29.8 Q-2.6 -14 -2.1 -1.1" stroke="@metalH" stroke-width="0.3" opacity="0.34"/>
<path d="M0.1 -29.9 Q0.1 -14 0.1 -1" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M1 -29.9 Q1 -14 1 -1" stroke="@metalH" stroke-width="0.42" opacity="0.6"/>
<path d="M3.3 -29.6 Q3.7 -14 3.2 -1.1" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M4.2 -29.4 Q4.6 -14 4.1 -1.1" stroke="@metalH" stroke-width="0.28" opacity="0.3"/>
<path d="M6.5 -28.8 Q7.1 -14 6.3 -1.2" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
<path d="M7.4 -28.5 Q8 -14 7.2 -1.2" stroke="@metalH" stroke-width="0.36" opacity="0.46"/>
<path d="M9.6 -27.6 Q10.3 -14 9.3 -1.4" stroke="@metalO" stroke-width="0.85" opacity="0.95"/>
</g>
<path d="M-11.9 -29.6 Q0 -33.2 11.9 -29.6 Q0 -31.4 -11.9 -29.6 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<ellipse cx="-4.6" cy="-22.4" rx="2.1" ry="4.6" fill="@metalH" opacity="0.13" stroke="none" transform="rotate(-9 -4.6 -22.4)"/>
<path d="M-12.3 -8.6 Q0 -5.2 12.3 -8.6 L12.2 -3.8 Q0 -0.4 -12.2 -3.8 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.3 -8.6 Q0 -5.2 12.3 -8.6 L12.2 -3.8 Q0 -0.4 -12.2 -3.8 Z" fill="@metalO" opacity="0.33" stroke="none"/>
<path d="M-12.3 -8.6 Q0 -5.2 12.3 -8.6" stroke="@metalH" stroke-width="0.62" fill="none" opacity="1"/>
<path d="M-12.2 -3.8 Q0 -0.4 12.2 -3.8" stroke="@metalO" stroke-width="0.7" fill="none" opacity="0.9"/>
<path d="M-12.2 -3.9 Q0 -0.5 12.2 -3.9 L12 0.4 Q0 3.8 -12 0.4 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.2 -3.9 Q0 -0.5 12.2 -3.9 L12 0.4 Q0 3.8 -12 0.4 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M1.4 -2.4 Q7 -1 12.15 -3.7" stroke="@metalH" stroke-width="0.34" fill="none" opacity="0.5"/>
<g fill="@metalO" stroke="none"><circle cx="-9.6" cy="-6.1" r="0.52"/><circle cx="0" cy="-4.3" r="0.52"/><circle cx="9.6" cy="-6.1" r="0.52"/></g>
<g fill="@metalH" stroke="none" opacity="0.7"><circle cx="-9.75" cy="-6.3" r="0.2"/><circle cx="-0.15" cy="-4.5" r="0.2"/><circle cx="9.45" cy="-6.3" r="0.2"/></g>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="url(#g_steelD)"/>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="@metalO" opacity="0.3" stroke="none"/>
<path d="M-11.6 6.8 Q0 10 11.6 6.8" stroke="@metalH" stroke-width="0.7" fill="none" opacity="1"/>
<ellipse cx="-6.2" cy="9.6" rx="2.6" ry="0.8" fill="@metalH" opacity="0.3" stroke="none" transform="rotate(9 -6.2 9.6)"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="url(#g_steelD)"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M2.2 14.5 Q7 13.8 11.2 11.6" stroke="@metalH" stroke-width="0.34" fill="none" opacity="0.55"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="url(#g_steelD)"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="@metalO" opacity="0.36" stroke="none"/>
<path d="M-10.6 16 Q0 19.4 10.6 16" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="@metalO" opacity="0.55" stroke="none"/>
<path d="M-9.8 20.2 Q-5.6 21.9 -2.4 22.5" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-9.2 24.4 Q0 27.6 9.2 24.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.75"/>
<g stroke="none">
<path d="M-6.6 10.4 L-4.6 10.8 L-4.9 17.6 L-6.9 17.2 Z" fill="@cuir"/>
<path d="M-6.6 10.4 L-5.9 10.55 L-6.2 17.35 L-6.9 17.2 Z" fill="@cuirH" opacity="0.5"/>
<rect x="-6.7" y="16.6" width="2.2" height="1.7" rx="0.3" fill="@or" stroke="@orO" stroke-width="0.35"/>
<path d="M4.6 10.8 L6.6 10.4 L6.9 17.2 L4.9 17.6 Z" fill="@cuir"/>
<path d="M4.6 10.8 L5.3 10.65 L5.6 17.45 L4.9 17.6 Z" fill="@cuirH" opacity="0.5"/>
<rect x="4.5" y="16.6" width="2.2" height="1.7" rx="0.3" fill="@or" stroke="@orO" stroke-width="0.35"/>
</g>
<path d="M-11.4 7.8 Q0 9.2 11.4 7.8 L11.3 9.1 Q0 10.5 -11.3 9.1 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-11.08 2.5 L-8.32 3.07 L-8.32 8.47 L-11.08 7.9 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-11.08 2.62 L-8.32 3.19 L-8.32 4.77 L-11.08 4.2 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-11.08 4.2 L-8.32 4.77 L-8.32 5.57 L-11.08 5 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-11.08 6.4 L-8.32 6.97 L-8.32 8.37 L-11.08 7.8 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-10.28" cy="3.93" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -10.28 3.93)"/><circle cx="-9.7" cy="5.74" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-9.87" cy="5.55" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-7.88 3.15 L-5.12 3.54 L-5.12 8.94 L-7.88 8.55 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-7.88 3.27 L-5.12 3.66 L-5.12 5.24 L-7.88 4.85 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-7.88 4.85 L-5.12 5.24 L-5.12 6.04 L-7.88 5.65 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-7.88 7.05 L-5.12 7.44 L-5.12 8.84 L-7.88 8.45 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-7.08" cy="4.54" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -7.08 4.54)"/><circle cx="-6.5" cy="6.29" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-6.67" cy="6.1" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-4.68 3.58 L-1.92 3.78 L-1.92 9.18 L-4.68 8.98 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-4.68 3.7 L-1.92 3.9 L-1.92 5.48 L-4.68 5.28 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-4.68 5.28 L-1.92 5.48 L-1.92 6.28 L-4.68 6.08 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-4.68 7.48 L-1.92 7.68 L-1.92 9.08 L-4.68 8.88 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-3.88" cy="4.92" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -3.88 4.92)"/><circle cx="-3.3" cy="6.63" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-3.47" cy="6.44" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-1.38 3.8 L1.38 3.8 L1.38 9.2 L-1.38 9.2 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-1.38 3.92 L1.38 3.92 L1.38 5.5 L-1.38 5.5 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-1.38 5.5 L1.38 5.5 L1.38 6.3 L-1.38 6.3 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-1.38 7.7 L1.38 7.7 L1.38 9.1 L-1.38 9.1 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-0.58" cy="5.1" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -0.58 5.1)"/><circle cx="0" cy="6.75" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-0.17" cy="6.56" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M1.92 3.78 L4.68 3.58 L4.68 8.98 L1.92 9.18 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M1.92 3.9 L4.68 3.7 L4.68 5.28 L1.92 5.48 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M1.92 5.48 L4.68 5.28 L4.68 6.08 L1.92 6.28 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M1.92 7.68 L4.68 7.48 L4.68 8.88 L1.92 9.08 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="2.72" cy="5.03" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 2.72 5.03)"/><circle cx="3.3" cy="6.63" r="0.52" fill="@orO" stroke="none"/>
<circle cx="3.13" cy="6.44" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M5.12 3.54 L7.88 3.15 L7.88 8.55 L5.12 8.94 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M5.12 3.66 L7.88 3.27 L7.88 4.85 L5.12 5.24 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M5.12 5.24 L7.88 4.85 L7.88 5.65 L5.12 6.04 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M5.12 7.44 L7.88 7.05 L7.88 8.45 L5.12 8.84 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="5.92" cy="4.74" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 5.92 4.74)"/><circle cx="6.5" cy="6.29" r="0.52" fill="@orO" stroke="none"/>
<circle cx="6.33" cy="6.1" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M8.32 3.07 L11.08 2.5 L11.08 7.9 L8.32 8.47 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M8.32 3.19 L11.08 2.62 L11.08 4.2 L8.32 4.77 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M8.32 4.77 L11.08 4.2 L11.08 5 L8.32 5.57 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M8.32 6.97 L11.08 6.4 L11.08 7.8 L8.32 8.37 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="9.12" cy="4.23" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 9.12 4.23)"/><circle cx="9.7" cy="5.74" r="0.52" fill="@orO" stroke="none"/>
<circle cx="9.53" cy="5.55" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-11 4.6 L-2.6 8.9 L-3.4 11 L-11.4 6.6 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-11 4.6 L-2.6 8.9 L-3.4 11 L-11.4 6.6 Z" fill="@vet2O" opacity="0.32" stroke="none"/>
<path d="M-11.28 6 L-2.88 10.3 L-3.4 11 L-11.4 6.6 Z" fill="@vet2O" opacity="0.6" stroke="none"/>
<path d="M-11.06 4.88 L-2.66 9.18 L-2.77 9.74 L-11.17 5.44 Z" fill="@vet2H" opacity="0.55" stroke="none"/>
<path d="M-11.07 4.96 L-2.67 9.26" stroke="@vet2H" stroke-width="0.28" opacity="0.85" fill="none" stroke-linecap="round"/>
<path d="M-11.1 5.08 L-2.7 9.38" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<path d="M-11.32 6.2 L-2.92 10.5" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<path d="M-2.6 8.9 L6.4 12.4 L5.8 14.6 L-3.4 11 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-2.6 8.9 L6.4 12.4 L5.8 14.6 L-3.4 11 Z" fill="@vet2O" opacity="0.32" stroke="none"/>
<path d="M-3.16 10.37 L5.84 13.87 L5.8 14.6 L-3.4 11 Z" fill="@vet2O" opacity="0.6" stroke="none"/>
<path d="M-2.71 9.19 L6.29 12.69 L6.06 13.28 L-2.94 9.78 Z" fill="@vet2H" opacity="0.55" stroke="none"/>
<path d="M-2.74 9.28 L6.26 12.78" stroke="@vet2H" stroke-width="0.28" opacity="0.85" fill="none" stroke-linecap="round"/>
<path d="M-2.79 9.4 L6.21 12.9" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<path d="M-3.24 10.58 L5.76 14.08" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<path d="M-3.6 10.4 L-1.4 11.3 L-2.8 17.4 L-4.6 16.6 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-3.6 10.4 L-1.4 11.3 L-2.8 17.4 L-4.6 16.6 Z" fill="@vet2O" opacity="0.32" stroke="none"/>
<path d="M-4.3 14.74 L-2.1 15.64 L-2.8 17.4 L-4.6 16.6 Z" fill="@vet2O" opacity="0.6" stroke="none"/>
<path d="M-3.74 11.27 L-1.54 12.17 L-1.82 13.9 L-4.02 13 Z" fill="@vet2H" opacity="0.55" stroke="none"/>
<path d="M-3.78 11.52 L-1.58 12.42" stroke="@vet2H" stroke-width="0.28" opacity="0.85" fill="none" stroke-linecap="round"/>
<path d="M-3.84 11.89 L-1.64 12.79" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<path d="M-4.4 15.36 L-2.2 16.26" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<ellipse cx="-2.9" cy="9.9" rx="1.5" ry="1.15" fill="none" stroke="@or" stroke-width="0.65"/>
<ellipse cx="-2.9" cy="9.9" rx="1.5" ry="1.15" fill="none" stroke="@orH" stroke-width="0.25" opacity="0.6"/>
<path d="M-3.5 17.1 L-1.9 16.4 Q-0.9 17.6 -2 18.5 Q-3.4 18.4 -3.5 17.1 Z" fill="@or" stroke="@orO" stroke-width="0.4"/>
<g fill="@vet2O" stroke="none"><circle cx="-8.2" cy="6.1" r="0.4"/><circle cx="-5.4" cy="7.6" r="0.4"/><circle cx="1.4" cy="11.1" r="0.4"/><circle cx="4.2" cy="12.6" r="0.4"/></g>
<g transform="scale(-1 1)">
<path d="M4.4 8 L9.9 9 L9.2 19.6 L8.4 23.2 L7.9 26.6 L6.6 25 L6.2 28.6 L5.1 26.1 L4.3 29.3 L3.4 25.7 L2.2 27.7 L2.6 23.6 L1.1 21.8 L3 19.3 L2 17.4 L3.6 13.1 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M2.4 21.6 L8.9 20.9 L8.4 23.2 L7.9 26.6 L6.6 25 L6.2 28.6 L5.1 26.1 L4.3 29.3 L3.4 25.7 L2.2 27.7 L2.6 23.6 L1.1 21.8 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M3.5 14.6 L5.1 15 L4.2 23.4 L3.1 22.9 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<g stroke="@poilO" fill="none" opacity="0.42" stroke-linecap="round">
<path d="M6.8 17.4 Q6.4 19 6.6 20.4" stroke-width="0.28"/><path d="M8.4 18.2 Q8.1 19.4 8.3 20.6" stroke-width="0.22"/><path d="M4.6 18.8 Q4.4 20.2 4.7 21.4" stroke-width="0.25"/>
</g>
<path d="M16.8 -32.6 L18.5 -32 L19.9 -30.9 L20.9 -29.4 L21.8 -27.8 L22.6 -26.4 L23.2 -25 L23.6 -23.7 L23.7 -22.3 L23.7 -20.9 L23.9 -21 L23.9 -21 Q26.2 -19.9 27.7 -19.9 Q26.7 -18.2 25.8 -15.3 L25.6 -15.1 L26.2 -13.8 L26.5 -12.3 L26.6 -10.9 L26.7 -9.2 L27 -7.2 L27 -4.7 L25.8 -2.1 L24 0.1 L22.9 2.2 L22 4.1 L21 5.5 L20.2 6.4 L19.6 7.1 L19.1 7.7 L18.9 7.8 L18.9 7.8 Q18.7 9.5 18.7 10.5 Q18.1 10.2 17 10.3 L16.4 11.1 L16.4 11.1 Q16.4 14.5 16.6 17 Q15.9 15.2 14.9 13.5 L13.8 15.5 L12.8 16.2 L12 17.4 L11.4 18.4 L11.6 19 L11.6 19 Q9.2 22.1 7.7 24.8 Q8.4 21.9 8.7 18.2 L9.3 18.9 Q7.6 18.5 6.5 18.7 Q7.1 17.1 7.5 14.4 L7.5 14.7 Q6.4 13.8 5.5 13.7 Q6.5 12.3 7.8 9.7 L8.1 8.4 L9.1 5.5 L9.9 3.3 L9.9 0.7 L10 -2.2 L10.1 -6.2 L10.1 -6.2 Q9 -7.6 8 -8.1 Q9 -8.9 10.2 -10.7 L10 -14.4 L10.3 -16.6 L9.7 -19 L9.1 -21.3 L8.9 -23.6 L8.7 -25.9 L8.5 -28.2 L8.8 -30.4 L9.8 -30.5 L9.8 -30.5 Q9.5 -31.7 8.6 -32.3 Q10.8 -32.6 14.1 -33.5 L13.9 -33 L15.3 -32.8 L16.8 -32.6 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4" stroke-linejoin="round"/>
<clipPath id="wwfur-face"><path d="M16.8 -32.6 L18.5 -32 L19.9 -30.9 L20.9 -29.4 L21.8 -27.8 L22.6 -26.4 L23.2 -25 L23.6 -23.7 L23.7 -22.3 L23.7 -20.9 L23.9 -21 L23.9 -21 Q26.2 -19.9 27.7 -19.9 Q26.7 -18.2 25.8 -15.3 L25.6 -15.1 L26.2 -13.8 L26.5 -12.3 L26.6 -10.9 L26.7 -9.2 L27 -7.2 L27 -4.7 L25.8 -2.1 L24 0.1 L22.9 2.2 L22 4.1 L21 5.5 L20.2 6.4 L19.6 7.1 L19.1 7.7 L18.9 7.8 L18.9 7.8 Q18.7 9.5 18.7 10.5 Q18.1 10.2 17 10.3 L16.4 11.1 L16.4 11.1 Q16.4 14.5 16.6 17 Q15.9 15.2 14.9 13.5 L13.8 15.5 L12.8 16.2 L12 17.4 L11.4 18.4 L11.6 19 L11.6 19 Q9.2 22.1 7.7 24.8 Q8.4 21.9 8.7 18.2 L9.3 18.9 Q7.6 18.5 6.5 18.7 Q7.1 17.1 7.5 14.4 L7.5 14.7 Q6.4 13.8 5.5 13.7 Q6.5 12.3 7.8 9.7 L8.1 8.4 L9.1 5.5 L9.9 3.3 L9.9 0.7 L10 -2.2 L10.1 -6.2 L10.1 -6.2 Q9 -7.6 8 -8.1 Q9 -8.9 10.2 -10.7 L10 -14.4 L10.3 -16.6 L9.7 -19 L9.1 -21.3 L8.9 -23.6 L8.7 -25.9 L8.5 -28.2 L8.8 -30.4 L9.8 -30.5 L9.8 -30.5 Q9.5 -31.7 8.6 -32.3 Q10.8 -32.6 14.1 -33.5 L13.9 -33 L15.3 -32.8 L16.8 -32.6 Z"/></clipPath>
<g clip-path="url(#wwfur-face)">
<path d="M26.2 -12 L26.4 -12.3 L26.6 -10.9 L26.7 -9.2 L26.7 -7.2 L26.4 -4.8 L25.8 -2.1 L24.8 0.5 L23.5 2.7 L22.2 4.3 L21 5.5 L20.2 6.4 L19.6 7.1 L19.1 7.7 L18.6 8.4 L18 9.1 L17.3 10 L16.5 11.1 L15.7 12.3 L14.9 13.6 L14.1 15 L13.4 16.5 L12.7 17.8 L11.9 18.9 L11 19.6 L9.9 19.5 L8.8 18.5 L7.9 16.9 L7.4 14.6 L7.4 12.2 L7.7 9.8 L8.2 7.6 L8.7 5.4 L9.1 3.2 L9.5 0.7 L9.8 -2.2 L10 -5.3 L10.8 -9.2 L13 -9.3 L15.2 -8.5 L16.7 -9.5 L19.3 -9.9 L20.9 -10.4 L23.2 -9.1 L25.1 -10.8 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M15.2 12.6 L14.9 13.6 L14.1 15 L13.4 16.5 L13.1 16.3 L10.5 -7.5 L10.1 -8.4 L10.1 -11.4 L10 -14 L9.6 -16.5 L9.2 -18.9 L8.8 -21.2 L8.6 -23.6 L8.6 -25.4 L8.6 -26.2 L8.8 -28.1 L9.4 -30.1 L9.8 -30.7 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M12.6 17.4 L12.7 17.8 L11.9 18.9 L11.3 19.6 L9.5 4.6 L9.1 3.2 L9.5 0.7 L10.2 0.4 L10.1 -3.2 L10 -5.3 L10.5 -6.5 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<path d="M20.9 4.9 L21 5.5 L20.2 6.4 L18.8 6.6 L18.8 6.6 L19.1 7.7 L18.6 7.8 L18.4 8.3 L18 9.1 L18.2 8.9 L13.2 -32.9 L15.7 -33.5 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M18.3 7.9 L18.6 8.4 L18.3 8.2 L18.4 9.1 L17.3 10 L11.3 -32.4 L12.5 -32.7 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<path d="M18.5 -32.2 L18.4 -31.9 L18.9 -31.7 L19.5 -30.5 L20.9 -29.1 L21.3 -28.1 L21.6 -27.8 L22.3 -26.3 L22.8 -24.9 L23.1 -23.7 L23.2 -22.9 L23.6 -22.3 L23.4 -21.5 L25.9 -3.9 L25.8 -2.1 L24.7 0.6 L23.4 2.8 L23.3 2.9 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M16.8 -32.8 L18 -32.4 L18.7 -31.5 L19.7 -30.7 L18.8 -30.7 L23.2 3 L22.2 2.9 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<g stroke="@poilO" fill="none" opacity="0.42" stroke-linecap="round"><path d="M17.1 -32.3 Q16.6 -31.9 15.5 -31.3" stroke-width="0.3"/><path d="M19.4 -29.1 Q19 -28.7 18.1 -27.9" stroke-width="0.3"/><path d="M25.2 -6 Q24.7 -5.8 24.1 -6" stroke-width="0.3"/><path d="M22.9 -0.2 Q21.9 -0.7 20.8 -1.7" stroke-width="0.3"/></g>
<g fill="@fourrureO" opacity="0.14" stroke="none">
<path d="M22.6 -5 Q22.4 -1.4 22 3 Q23.1 -1.3 23.6 -4.8 Q23.4 -5.9 22.6 -5 Z"/>
<path d="M12.8 8.4 Q11 11.4 11.2 16 Q12.6 12 15 9.2 Q14.6 8 12.8 8.4 Z"/>
<path d="M22.3 -16.3 Q22.4 -14.1 24.6 -11.9 Q24.1 -14.5 24.6 -16.8 Q23.5 -17.6 22.3 -16.3 Z"/>
<path d="M20.3 -1.2 Q20 0.7 18.9 2.6 Q20.7 1 21.2 -0.7 Q21.3 -1.8 20.3 -1.2 Z"/>
<path d="M12.4 9.4 Q11.1 13.1 10.1 18 Q12.4 13.7 14.2 10.1 Q14 8.9 12.4 9.4 Z"/>
<path d="M21.9 -1.6 Q20.2 1.7 19.2 6.4 Q21.4 2.2 23.4 -1 Q23.3 -2.1 21.9 -1.6 Z"/>
<path d="M13.1 11.3 Q11.8 13.5 12 17.1 Q13.5 14.3 15.5 12.2 Q15 11 13.1 11.3 Z"/>
<path d="M21.2 -5.2 Q21.7 -3.3 21.4 -1.1 Q22.9 -3.1 22.8 -5 Q22.4 -6.1 21.2 -5.2 Z"/>
<path d="M22.8 -6.8 Q22.1 -4.9 23.5 -2.4 Q24 -4.7 25.4 -6.4 Q24.6 -7.5 22.8 -6.8 Z"/>
<path d="M13.3 10.2 Q12.1 14.6 10.2 19.8 Q13.2 15.1 14.8 10.8 Q14.6 9.6 13.3 10.2 Z"/>
<path d="M15.2 -28.3 Q15.9 -26.9 17.2 -25.2 Q17.4 -27.3 17.2 -28.9 Q16.2 -29.7 15.2 -28.3 Z"/>
<path d="M19 -18.7 Q19.5 -14.5 22.3 -9.9 Q21.1 -14.9 21.2 -19.2 Q20.2 -20 19 -18.7 Z"/>
<path d="M16.9 4.4 Q16.5 8.9 14.8 13.9 Q18.4 9.6 19.5 5.3 Q18.9 4.1 16.9 4.4 Z"/>
<path d="M20.4 -5.2 Q20.9 -0.1 20.1 5.8 Q22.7 0.1 22.9 -4.8 Q22.2 -5.9 20.4 -5.2 Z"/>
<path d="M12.6 -30.2 Q13.4 -26.1 15.8 -21.4 Q15.2 -26.5 14.9 -30.8 Q13.9 -31.6 12.6 -30.2 Z"/>
<path d="M14.8 4.5 Q12.4 8.7 12 14.8 Q14.1 9.3 17.1 5.3 Q16.6 4.1 14.8 4.5 Z"/>
<path d="M18.5 -22 Q19.3 -20.5 20.4 -18.9 Q20.6 -20.9 20.3 -22.5 Q19.4 -23.3 18.5 -22 Z"/>
</g>
<g fill="@fourrureO" opacity="0.1" stroke="none">
<path d="M14.2 -11.3 Q15.3 -7.5 15.3 -2.7 Q16.3 -7.5 15.5 -11.3 Q15 -12.3 14.2 -11.3 Z"/>
<path d="M12.9 9 Q12.1 13.2 9.9 17.8 Q12.6 13.4 13.6 9.3 Q13.7 8.2 12.9 9 Z"/>
<path d="M10.8 12.4 Q9.9 15.4 8.9 19.1 Q11.1 15.9 12.3 13 Q12.2 11.8 10.8 12.4 Z"/>
<path d="M11.2 -30.1 Q11.7 -28.6 12.6 -26.8 Q12.6 -28.8 12.4 -30.4 Q11.7 -31.3 11.2 -30.1 Z"/>
<path d="M10.2 13.9 Q10.1 16.5 8.8 19.1 Q10.8 16.7 11.1 14.3 Q11.1 13.2 10.2 13.9 Z"/>
<path d="M12.7 -22.2 Q13.3 -20.9 14.4 -19.5 Q14.6 -21.2 14.4 -22.6 Q13.6 -23.4 12.7 -22.2 Z"/>
<path d="M17.5 -8.7 Q17.5 -6.3 18.1 -3.3 Q18.3 -6.3 18.6 -8.7 Q18.2 -9.7 17.5 -8.7 Z"/>
<path d="M16.4 -18.8 Q17.1 -15.9 18.7 -12.6 Q18.2 -16.2 17.9 -19.1 Q17.1 -20 16.4 -18.8 Z"/>
<path d="M14.5 -12.6 Q15.8 -10.2 15.5 -7.2 Q16.8 -10.2 15.9 -12.7 Q15.3 -13.6 14.5 -12.6 Z"/>
<path d="M12.1 9.3 Q9.9 13.4 8.8 19 Q10.8 13.8 13.3 9.8 Q13.3 8.7 12.1 9.3 Z"/>
</g>
<g fill="@fourrureH" opacity="0.5" stroke="none">
<path d="M8.4 -25.4 Q9.8 -22.8 10.6 -19.5 Q10.4 -23 9.3 -25.6 Q8.7 -26.5 8.4 -25.4 Z"/>
<path d="M10.6 -18.5 Q10.5 -16 12.9 -13.4 Q12 -16.3 12.6 -19 Q11.6 -19.8 10.6 -18.5 Z"/>
<path d="M13.5 -16.8 Q15.3 -13.4 15.9 -8.9 Q16 -13.6 14.4 -17 Q13.9 -17.9 13.5 -16.8 Z"/>
<path d="M11.8 -22.2 Q12 -19.1 14.1 -15.9 Q12.7 -19.3 12.7 -22.5 Q12.1 -23.3 11.8 -22.2 Z"/>
<path d="M13.3 -1.1 Q11.9 1.3 11 4.5 Q12.6 1.6 14.2 -0.6 Q14.3 -1.7 13.3 -1.1 Z"/>
<path d="M12.3 -5.1 Q12.2 -0.8 11.5 4.4 Q13 -0.7 13.3 -4.9 Q13.1 -6 12.3 -5.1 Z"/>
</g>
<g stroke="@poil" fill="none" opacity="0.5" stroke-linecap="round">
<path d="M21 -15.8 Q20.8 -15.2 21 -14.5" stroke-width="0.42"/>
<path d="M17.8 -13.7 Q18.1 -13.1 17.9 -12.4" stroke-width="0.52"/>
<path d="M17.5 -13 Q17.5 -12.2 18 -11.4" stroke-width="0.42"/>
<path d="M18.8 -15.4 Q18.8 -14.9 18.6 -14.4" stroke-width="0.52"/>
<path d="M14.4 -7.1 Q14.4 -6.1 14.8 -5.2" stroke-width="0.42"/>
<path d="M14.7 -8.9 Q14.9 -8.1 14.4 -7.5" stroke-width="0.52"/>
<path d="M20.1 -13.3 Q20.6 -12.6 20.8 -11.6" stroke-width="0.42"/>
<path d="M19.7 -10.8 Q20 -9.8 20.6 -8.9" stroke-width="0.42"/>
<path d="M18.3 -12.7 Q18.6 -11.9 18.8 -11.2" stroke-width="0.52"/>
<path d="M20 -12.9 Q19.6 -12.4 19.7 -11.7" stroke-width="0.42"/>
<path d="M17 -16 Q16.9 -15.1 17.4 -14.3" stroke-width="0.42"/>
<path d="M17.1 -6.5 Q17 -5.8 17.1 -5.1" stroke-width="0.42"/>
<path d="M17.8 -5 Q17.6 -3.9 17.8 -2.9" stroke-width="0.42"/>
<path d="M20.5 -14.3 Q20.3 -13.7 20.5 -13.2" stroke-width="0.42"/>
<path d="M12.2 -11.8 Q11.6 -10.8 11.5 -9.7" stroke-width="0.52"/>
<path d="M13.5 -13.7 Q14 -13.1 13.7 -12.3" stroke-width="0.42"/>
<path d="M21.7 -7.8 Q21.3 -6.9 21.2 -6" stroke-width="0.42"/>
<path d="M19.6 -8.7 Q19.6 -7.5 20.1 -6.4" stroke-width="0.52"/>
<path d="M15.7 -15.4 Q15.9 -14.6 15.7 -13.8" stroke-width="0.52"/>
</g>
<path d="M8.9 -29.3 Q10.9 -29.6 14.2 -30.5 L15.4 -29.8 L16.9 -29.6 L18.6 -29 L20 -27.9 L21 -26.4 L21.9 -24.8 L22.7 -23.4" fill="none" stroke="@fourrureO" stroke-width="2.6" opacity="0.35" stroke-linecap="round"/>
<path d="M8.6 -32.3 Q10.8 -32.6 14.1 -33.5 L15.3 -32.8 L16.8 -32.6 L18.5 -32 L19.9 -30.9 L20.9 -29.4 L21.8 -27.8 L22.6 -26.4" fill="none" stroke="@fourrureH" stroke-width="3" opacity="1" stroke-linecap="round"/>
</g>
</g>
<ellipse cx="-18.2" cy="-21.6" rx="4.8" ry="1.7" fill="@poilO" opacity="0.38" stroke="none" transform="rotate(-14 -18.2 -21.6)"/>
<ellipse cx="-18.9" cy="-22" rx="3.4" ry="1.1" fill="@poilO" opacity="0.55" stroke="none" transform="rotate(-14 -18.9 -22)"/>
<g transform="translate(-2.6,0.6)">
<path d="M-9.8 -33.6 Q-12.8 -36.8 -16.4 -34.8 Q-18.2 -33.6 -18.6 -31.2 L-23.6 -23.2 Q-25 -21.2 -23.4 -20.4 Q-21.9 -19.8 -21 -21.2 L-16.4 -26.2 Q-14.4 -24.6 -12 -24.8 Q-9 -25.6 -8.8 -28.8 Q-8.6 -31.8 -9.8 -33.6 Z" fill="@poilO" stroke="@poilO" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M-9.8 -33.6 Q-12.8 -36.8 -16.4 -34.8 Q-18.2 -33.6 -18.6 -31.2 L-23.6 -23.2 Q-25 -21.2 -23.4 -20.4 Q-21.9 -19.8 -21 -21.2 L-16.4 -26.2 Q-14.4 -24.6 -12 -24.8 Q-9 -25.6 -8.8 -28.8 Q-8.6 -31.8 -9.8 -33.6 Z" fill="@os" stroke="@poilO" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M-15.8 -34.6 Q-17.8 -33.4 -18.2 -31.2 L-23 -23.6" fill="none" stroke="@osH" stroke-width="1.15" opacity="0.9"/>
<path d="M-11.4 -34.6 Q-8.8 -32 -9.4 -28.6 Q-9.8 -26.2 -12.2 -25.2" fill="none" stroke="@osO" stroke-width="0.65" opacity="0.5"/>
<path d="M-13.2 -33.8 Q-14.4 -30.6 -15.8 -28.2" fill="none" stroke="@osO" stroke-width="0.4" opacity="0.3"/>
<path d="M-17.4 -28.8 L-21.6 -22.2 L-20.7 -21.5 L-16.5 -27.9 Z" fill="@osO" opacity="0.4" stroke="none"/>
<path d="M-17.4 -28.8 L-21.6 -22.2" fill="none" stroke="@osO" stroke-width="0.8" opacity="0.85"/>
<path d="M-18.9 -32 Q-16.4 -33.2 -14.8 -31.4 Q-14.9 -28.9 -16.9 -28.4 Q-18.9 -28.8 -19.3 -30.4 Q-19.3 -31.5 -18.9 -32 Z" fill="@orbite" stroke="@poilO" stroke-width="0.5"/>
<ellipse cx="-17" cy="-30.3" rx="1.35" ry="1.05" fill="@poilO" opacity="0.9" stroke="none" transform="rotate(-14 -17 -30.3)"/>
<path d="M-19.1 -32.3 Q-17 -33.3 -14.7 -32.2" fill="none" stroke="@osH" stroke-width="0.42" opacity="0.7"/>
<path d="M-18.6 -31.5 Q-17.2 -32.3 -15.4 -31.7" fill="none" stroke="@osH" stroke-width="0.32" opacity="0.5"/>
<path d="M-17.2 -25.6 Q-19 -24.1 -20.9 -22.1" fill="none" stroke="@osO" stroke-width="0.55" opacity="0.85"/>
<g fill="@os" stroke="@poilO" stroke-width="0.24" stroke-linejoin="round">
<path d="M-17.6 -25.2 L-16.5 -24.1 L-17 -25.8 Z"/>
<path d="M-18.9 -23.9 L-17.8 -22.7 L-18.2 -24.5 Z"/>
<path d="M-20.2 -22.6 L-19.3 -21.5 L-19.6 -23.2 Z"/>
</g>
<path d="M-21.4 -21.7 L-20.2 -19.6 L-19.7 -22 Z" fill="@osH" stroke="@poilO" stroke-width="0.24" stroke-linejoin="round"/>
<ellipse cx="-23.2" cy="-21.5" rx="1" ry="0.68" fill="@orbite" stroke="none" opacity="0.95" transform="rotate(-52 -23.2 -21.5)"/>
<path d="M-12.4 -25 Q-14 -26.8 -16.2 -26.4" fill="none" stroke="@poilO" stroke-width="0.28" opacity="0.5"/>
</g>
<path d="M1.9 21.6 L5 23.4 L3 23.6 L4.9 26 L3.7 25.8 L4.7 27 L3.9 28.1 L4.9 29.7 L3.9 30.4 L4.9 32.5 L3.8 32.7 L4.6 34.8 L3.7 35 L5.7 35.7 L3.7 37.3 L4.2 38.6 L3.7 39.6 L4.3 41.3 L3.4 41.9 L6.8 45 L1.2 44.8 L-1 45 L-0.5 43.3 L-1.5 43.5 L-1.8 41.5 L-2.7 41.3 L-2.3 39.2 L-3.2 38.1 L-2.4 36.9 L-3.8 36.8 L-2.4 34.6 L-2.9 33.5 L-2.2 32.3 L-5.4 31.1 L-1.6 27.8 L-4.5 26.6 L-1.2 25.5 L-2.5 25.4 L-0.5 23.3 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M1.2 22 Q3 23.6 3.2 27 Q3.4 31 2.6 35 Q2 39 1.8 42.6 L0.4 42.4 Q0.8 38 1 34 Q1.2 29 0.6 25.4 Q0.2 23 1.2 22 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M-0.6 22.6 Q-1.4 26 -1.2 30 Q-1 34 -1.6 38 L-2.2 40.4 L-1.4 40.6 Q-0.6 36 -0.4 31 Q-0.2 26 0.4 22.8 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>
<path d="M0.4 21.4 Q3.8 22.2 5.4 25.2 Q3.4 28 0.8 28.8 Q-0.8 25.2 0.4 21.4 Z" fill="@fourrureO" opacity="0.5" stroke="none"/>
</g>`,
      back: `<g stroke="@metalO" stroke-width="0.5" stroke-linejoin="round">
<path d="M-12 -30 Q0 -33.6 12 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="url(#g_steelD)"/>
<path d="M-12 -30 Q0 -33.6 12 -30 L12.6 -13 Q12.2 -4.5 10.9 3 L-10.9 3 Q-12.2 -4.5 -12.6 -13 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-11.9 -29.6 Q0 -33.2 11.9 -29.6 Q0 -31.4 -11.9 -29.6 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<path d="M-1.5 -29.6 Q0 -30 1.5 -29.6 L1.9 -6 Q0 -4.6 -1.9 -6 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-1.5 -29.6 Q0 -30 1.5 -29.6 L1.9 -6 Q0 -4.6 -1.9 -6 Z" fill="@metalO" opacity="0.3" stroke="none"/>
<path d="M-0.9 -29.4 Q0 -29.7 0.9 -29.4 L1.1 -6.4 Q0 -5.6 -1.1 -6.4 Z" fill="@metalH" opacity="0.4" stroke="none"/>
<path d="M-1.9 -29.6 L-2.3 -6" stroke="@metalO" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M1.9 -29.6 L2.3 -6" stroke="@metalO" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M-12.4 -20 Q0 -16.4 12.4 -20 L12.5 -14.6 Q0 -11 -12.5 -14.6 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.4 -20 Q0 -16.4 12.4 -20 L12.5 -14.6 Q0 -11 -12.5 -14.6 Z" fill="@metalO" opacity="0.32" stroke="none"/>
<path d="M-12.4 -19.8 Q0 -16.2 12.4 -19.8" stroke="@metalH" stroke-width="0.66" fill="none" opacity="1"/>
<path d="M-12.5 -14.7 Q0 -11.1 12.5 -14.7 L12.4 -9.2 Q0 -5.6 -12.4 -9.2 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.5 -14.7 Q0 -11.1 12.5 -14.7 L12.4 -9.2 Q0 -5.6 -12.4 -9.2 Z" fill="@metalO" opacity="0.54" stroke="none"/>
<path d="M2.6 -12.2 Q7.6 -12.6 12.5 -14.5" stroke="@metalH" stroke-width="0.34" fill="none" opacity="0.5"/>
<path d="M-12.4 -9.3 Q0 -5.7 12.4 -9.3 L12.2 -3.8 Q0 -0.2 -12.2 -3.8 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.4 -9.3 Q0 -5.7 12.4 -9.3 L12.2 -3.8 Q0 -0.2 -12.2 -3.8 Z" fill="@metalO" opacity="0.38" stroke="none"/>
<path d="M-12.4 -9.1 Q0 -5.5 12.4 -9.1" stroke="@metalH" stroke-width="0.58" fill="none" opacity="0.88"/>
<path d="M-12.2 -3.9 Q0 -0.3 12.2 -3.9 L12 1.4 Q0 5 -12 1.4 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-12.2 -3.9 Q0 -0.3 12.2 -3.9 L12 1.4 Q0 5 -12 1.4 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M-12.2 -3.7 Q-7 -2.2 -3 -1.6" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<g fill="@metalO" stroke="none"><circle cx="-9.8" cy="-17.6" r="0.5"/><circle cx="9.8" cy="-17.6" r="0.5"/><circle cx="-10" cy="-12.2" r="0.5"/><circle cx="10" cy="-12.2" r="0.5"/><circle cx="-9.9" cy="-6.8" r="0.5"/><circle cx="9.9" cy="-6.8" r="0.5"/></g>
<g fill="@metalH" stroke="none" opacity="0.65"><circle cx="-9.95" cy="-17.8" r="0.19"/><circle cx="9.65" cy="-17.8" r="0.19"/><circle cx="-10.15" cy="-12.4" r="0.19"/><circle cx="9.85" cy="-12.4" r="0.19"/><circle cx="-10.05" cy="-7" r="0.19"/><circle cx="9.75" cy="-7" r="0.19"/></g>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="url(#g_steelD)"/>
<path d="M-11.6 6.6 Q0 9.8 11.6 6.6 L11.4 12 Q0 15.4 -11.4 12 Z" fill="@metalO" opacity="0.3" stroke="none"/>
<path d="M-11.6 6.8 Q0 10 11.6 6.8" stroke="@metalH" stroke-width="0.7" fill="none" opacity="1"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="url(#g_steelD)"/>
<path d="M-11.2 11.4 Q0 14.8 11.2 11.4 L11 16.4 Q0 19.8 -11 16.4 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M2.2 14.5 Q7 13.8 11.2 11.6" stroke="@metalH" stroke-width="0.34" fill="none" opacity="0.55"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="url(#g_steelD)"/>
<path d="M-10.6 15.8 Q0 19.2 10.6 15.8 L10.2 20.6 Q0 24 -10.2 20.6 Z" fill="@metalO" opacity="0.36" stroke="none"/>
<path d="M-10.6 16 Q0 19.4 10.6 16" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.8 20 Q0 23.4 9.8 20 L9.2 24.6 Q0 27.8 -9.2 24.6 Z" fill="@metalO" opacity="0.55" stroke="none"/>
<path d="M-9.8 20.2 Q-5.6 21.9 -2.4 22.5" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="url(#g_steelD)"/>
<path d="M-9.2 24.2 Q0 27.4 9.2 24.2 L8.4 27.6 Q0 30.6 -8.4 27.6 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-9.2 24.4 Q0 27.6 9.2 24.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.75"/>
<path d="M-11.4 7.8 Q0 9.2 11.4 7.8 L11.3 9.1 Q0 10.5 -11.3 9.1 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-11.08 2.5 L-8.32 3.07 L-8.32 8.47 L-11.08 7.9 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-11.08 2.62 L-8.32 3.19 L-8.32 4.77 L-11.08 4.2 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-11.08 4.2 L-8.32 4.77 L-8.32 5.57 L-11.08 5 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-11.08 6.4 L-8.32 6.97 L-8.32 8.37 L-11.08 7.8 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-10.28" cy="3.93" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -10.28 3.93)"/><circle cx="-9.7" cy="5.74" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-9.87" cy="5.55" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-7.88 3.15 L-5.12 3.54 L-5.12 8.94 L-7.88 8.55 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-7.88 3.27 L-5.12 3.66 L-5.12 5.24 L-7.88 4.85 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-7.88 4.85 L-5.12 5.24 L-5.12 6.04 L-7.88 5.65 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-7.88 7.05 L-5.12 7.44 L-5.12 8.84 L-7.88 8.45 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-7.08" cy="4.54" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -7.08 4.54)"/><circle cx="-6.5" cy="6.29" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-6.67" cy="6.1" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-4.68 3.58 L-1.92 3.78 L-1.92 9.18 L-4.68 8.98 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-4.68 3.7 L-1.92 3.9 L-1.92 5.48 L-4.68 5.28 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-4.68 5.28 L-1.92 5.48 L-1.92 6.28 L-4.68 6.08 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-4.68 7.48 L-1.92 7.68 L-1.92 9.08 L-4.68 8.88 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-3.88" cy="4.92" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -3.88 4.92)"/><circle cx="-3.3" cy="6.63" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-3.47" cy="6.44" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-1.38 3.8 L1.38 3.8 L1.38 9.2 L-1.38 9.2 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-1.38 3.92 L1.38 3.92 L1.38 5.5 L-1.38 5.5 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-1.38 5.5 L1.38 5.5 L1.38 6.3 L-1.38 6.3 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-1.38 7.7 L1.38 7.7 L1.38 9.1 L-1.38 9.1 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-0.58" cy="5.1" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -0.58 5.1)"/><circle cx="0" cy="6.75" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-0.17" cy="6.56" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M1.92 3.78 L4.68 3.58 L4.68 8.98 L1.92 9.18 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M1.92 3.9 L4.68 3.7 L4.68 5.28 L1.92 5.48 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M1.92 5.48 L4.68 5.28 L4.68 6.08 L1.92 6.28 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M1.92 7.68 L4.68 7.48 L4.68 8.88 L1.92 9.08 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="2.72" cy="5.03" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 2.72 5.03)"/><circle cx="3.3" cy="6.63" r="0.52" fill="@orO" stroke="none"/>
<circle cx="3.13" cy="6.44" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M5.12 3.54 L7.88 3.15 L7.88 8.55 L5.12 8.94 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M5.12 3.66 L7.88 3.27 L7.88 4.85 L5.12 5.24 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M5.12 5.24 L7.88 4.85 L7.88 5.65 L5.12 6.04 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M5.12 7.44 L7.88 7.05 L7.88 8.45 L5.12 8.84 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="5.92" cy="4.74" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 5.92 4.74)"/><circle cx="6.5" cy="6.29" r="0.52" fill="@orO" stroke="none"/>
<circle cx="6.33" cy="6.1" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M8.32 3.07 L11.08 2.5 L11.08 7.9 L8.32 8.47 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M8.32 3.19 L11.08 2.62 L11.08 4.2 L8.32 4.77 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M8.32 4.77 L11.08 4.2 L11.08 5 L8.32 5.57 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M8.32 6.97 L11.08 6.4 L11.08 7.8 L8.32 8.37 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="9.12" cy="4.23" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 9.12 4.23)"/><circle cx="9.7" cy="5.74" r="0.52" fill="@orO" stroke="none"/>
<circle cx="9.53" cy="5.55" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-14.8 -34.1 L-16.5 -33.4 L-18.1 -32.2 L-19.1 -30.7 L-19.9 -29.2 L-20.4 -28 L-20.9 -27.1 L-21.2 -26.1 L-21.3 -25.1 L-21.1 -23.8 L-20.6 -22.5 L-19.9 -21.2 L-19.3 -19.7 L-19 -18.2 L-18.8 -17.5 L-18.8 -17.5 Q-19.3 -14.9 -19.9 -13.5 Q-19.1 -13.6 -18 -12.9 L-18.5 -12.3 L-17.9 -12.4 L-17.9 -12.4 Q-18.8 -10 -19.6 -8.7 Q-18.4 -8.5 -16.8 -7.5 L-16.5 -7.9 L-16.4 -6.9 L-16.4 -5.6 L-16.3 -4.1 L-16.1 -2.3 L-16 -0.3 L-16.1 1.6 L-16.3 3.4 L-16.1 4.8 L-15.8 5.8 L-15.5 6.6 L-15.2 7.2 L-14.9 8 L-14.6 8.8 L-14.3 9.7 L-14.2 10.7 L-14.2 10.7 Q-15.9 14.6 -17.2 17.4 Q-15.8 15.7 -13.9 14.2 L-13.1 16.6 L-12.3 18.7 L-11.5 20.9 L-8.8 22.7 L-8.8 22.7 Q-7.1 26 -6.2 28.6 Q-6.1 26 -5.4 22.8 L-0.8 21.2 L1.8 19.3 L3.6 17 L5.3 15 L6.3 11.9 L6.3 11.9 Q10.3 10.2 13.5 9.3 Q10.5 9.1 6.9 8.4 L7.1 5.5 L7.3 3.5 L7.3 1.6 L7.1 -0.3 L7.1 -2.2 L7.6 -4.1 L8.5 -6.6 L8.5 -6.6 Q9.4 -7.2 10.1 -7.2 Q9.6 -8.2 9.1 -10.1 L9.7 -13.4 L10.1 -16.4 L10 -19.7 L9.8 -23.1 L10.7 -26.4 L10.3 -28.1 L10.3 -28.1 Q11.4 -30 12.8 -30.9 Q10.6 -31.5 7.6 -33.1 L8.2 -33 L7.3 -33.3 L6.5 -33.4 L5.7 -33.5 L4.9 -33.6 L4.1 -33.6 L3.2 -33.5 L2.3 -33.4 L1.4 -33.2 L0.6 -33 L-0.2 -32.9 L-1.1 -32.9 L-2 -33 L-3 -33.3 L-3.9 -33.6 L-4.8 -33.9 L-5.7 -34.2 L-6.5 -34.4 L-7.3 -34.6 L-8.2 -34.8 L-9 -34.9 L-10 -35 L-11 -35 L-12 -35 L-13.3 -34.6 L-14.8 -34.1 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4" stroke-linejoin="round"/>
<clipPath id="wwfur-dos"><path d="M-14.8 -34.1 L-16.5 -33.4 L-18.1 -32.2 L-19.1 -30.7 L-19.9 -29.2 L-20.4 -28 L-20.9 -27.1 L-21.2 -26.1 L-21.3 -25.1 L-21.1 -23.8 L-20.6 -22.5 L-19.9 -21.2 L-19.3 -19.7 L-19 -18.2 L-18.8 -17.5 L-18.8 -17.5 Q-19.3 -14.9 -19.9 -13.5 Q-19.1 -13.6 -18 -12.9 L-18.5 -12.3 L-17.9 -12.4 L-17.9 -12.4 Q-18.8 -10 -19.6 -8.7 Q-18.4 -8.5 -16.8 -7.5 L-16.5 -7.9 L-16.4 -6.9 L-16.4 -5.6 L-16.3 -4.1 L-16.1 -2.3 L-16 -0.3 L-16.1 1.6 L-16.3 3.4 L-16.1 4.8 L-15.8 5.8 L-15.5 6.6 L-15.2 7.2 L-14.9 8 L-14.6 8.8 L-14.3 9.7 L-14.2 10.7 L-14.2 10.7 Q-15.9 14.6 -17.2 17.4 Q-15.8 15.7 -13.9 14.2 L-13.1 16.6 L-12.3 18.7 L-11.5 20.9 L-8.8 22.7 L-8.8 22.7 Q-7.1 26 -6.2 28.6 Q-6.1 26 -5.4 22.8 L-0.8 21.2 L1.8 19.3 L3.6 17 L5.3 15 L6.3 11.9 L6.3 11.9 Q10.3 10.2 13.5 9.3 Q10.5 9.1 6.9 8.4 L7.1 5.5 L7.3 3.5 L7.3 1.6 L7.1 -0.3 L7.1 -2.2 L7.6 -4.1 L8.5 -6.6 L8.5 -6.6 Q9.4 -7.2 10.1 -7.2 Q9.6 -8.2 9.1 -10.1 L9.7 -13.4 L10.1 -16.4 L10 -19.7 L9.8 -23.1 L10.7 -26.4 L10.3 -28.1 L10.3 -28.1 Q11.4 -30 12.8 -30.9 Q10.6 -31.5 7.6 -33.1 L8.2 -33 L7.3 -33.3 L6.5 -33.4 L5.7 -33.5 L4.9 -33.6 L4.1 -33.6 L3.2 -33.5 L2.3 -33.4 L1.4 -33.2 L0.6 -33 L-0.2 -32.9 L-1.1 -32.9 L-2 -33 L-3 -33.3 L-3.9 -33.6 L-4.8 -33.9 L-5.7 -34.2 L-6.5 -34.4 L-7.3 -34.6 L-8.2 -34.8 L-9 -34.9 L-10 -35 L-11 -35 L-12 -35 L-13.3 -34.6 L-14.8 -34.1 Z"/></clipPath>
<g clip-path="url(#wwfur-dos)">
<path d="M-16.7 -4.1 L-16.7 -2.3 L-16.6 -0.3 L-16.4 1.6 L-16 3.3 L-15.5 4.5 L-15.1 5.5 L-14.8 6.4 L-14.7 7.2 L-14.6 7.9 L-14.5 8.7 L-14.4 9.7 L-14.3 10.9 L-14.2 12.5 L-14 14.4 L-13.6 16.7 L-12.9 19 L-11.7 21.1 L-9.8 22.5 L-7.1 23.1 L-3.9 22.7 L-0.7 21.4 L2.1 19.6 L4.2 17.4 L5.5 15.1 L6.3 12.6 L6.8 10.2 L7 7.8 L7.2 5.5 L7.4 3.5 L7.6 1.6 L7.7 -0.3 L7.9 -2.1 L8.2 -4 L8.5 -6.1 L9.1 -10.1 L9.7 -13.4 L10.1 -16.4 L10 -19.7 L9.8 -23.1 L10.7 -26.4 L10.3 -28.1 L12.8 -30.9 L13.6 -31.9 L5.2 -32.5 L5.9 -28.3 L5.2 -24.7 L6 -20.9 L5.4 -17.1 L5.9 -13.3 L5.1 -9.9 L4.6 -7.2 L4.2 -5.5 L1.6 -6.7 L0.5 -3.4 L-2.5 -6.2 L-4.4 -4.7 L-6 -5 L-8.1 -3.7 L-10.4 -4.5 L-11.9 -1.6 L-14.2 -3.5 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M-16.2 -32.4 L-17.7 -31.7 L-19 -30.5 L-14.5 2 L-16 3.3 L-14.4 2.1 L-14 5 L-15.1 5.5 L-14 5.2 L-13.8 6.7 L-14.7 7.2 L-13.8 6.7 L-13.6 8.2 L-14.5 8.7 L-13.6 8.3 L-13.4 9.8 L-14.3 10.9 L-14.3 10.9 L-13.1 11.3 L-14 14.4 L-13.1 11.8 L-12.4 16.5 L-12.9 19 L-12.3 17.2 L-11.7 21.8 L-9.8 22.5 L-7.8 27.6 L-7.7 28.2 L-8.4 26.6 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M-19.7 -30.2 L-19 -30.5 L-20.1 -29.4 L-20.8 -28.6 L-19.6 -19.9 L-19.7 -19.6 L-19.1 -18.1 L-18.7 -16.7 L-17.6 -15.5 L-17.4 -13.7 L-18.6 -13 L-17.5 -11.4 L-17 -10.8 L-16.9 -10.5 L-17.5 -9.9 L-16.8 -9.4 L-16.6 -8.5 L-17 -7.9 L-16.5 -7.3 L-16.4 -7.1 L-16.7 -5.6 L-16.3 -6 L-16.1 -5 L-16.7 -2.3 L-15.8 -2.8 L-15.7 -1.9 L-16.7 0.3 L-15.8 3.6 L-15.1 2.6 L-14.9 3.6 L-15.5 4.5 L-14.7 4.8 L-14.5 6.5 L-14.8 6.4 L-14.4 7.4 L-14.4 7 L-14.6 7.9 L-14.6 7.9 L-14.3 8 L-14.2 9 L-15.3 10.3 L-15.3 10.4 L-14 10 L-14 10.4 L-14.2 12.5 L-13.8 11.2 L-13.5 13.3 L-13.7 16.1 L-13.3 18.3 L-13 17.2 L-12.8 18.8 L-12.2 21.3 L-12.2 21.4 L-11.9 21.6 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<path d="M-4.6 9.2 L-2.4 8.7 L-8.1 -27.9 L-10.4 -27.7 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M-6.1 9.5 L-4.9 9.3 L-11.6 -28.1 L-12.9 -28 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<path d="M2.9 12.1 L4.2 11.4 L0.8 -23.9 L-1.5 -23.4 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M1.6 12.6 L2.7 12.2 L-2 -24.1 L-3.3 -23.8 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<path d="M9.8 -26.6 Q3 -14.2 -2.6 0.6 Q-6.9 12.4 -8.9 20.2" stroke="@fourrureO" stroke-width="2.2" opacity="0.22" fill="none"/>
<path d="M10.7 -25.9 Q4.1 -13.6 -1.4 1.1 Q-5.7 12.8 -7.7 20.6" stroke="@fourrureH" stroke-width="0.9" opacity="0.3" fill="none"/>
<g stroke="@poilO" fill="none" opacity="0.42" stroke-linecap="round"><path d="M-16 -32.3 Q-15.9 -31.7 -15.4 -30.9" stroke-width="0.3"/><path d="M-16.8 -12.3 Q-16.3 -12.5 -15.8 -12.4" stroke-width="0.4"/><path d="M-14.8 -0.5 Q-13.3 -1.1 -11.7 -1.1" stroke-width="0.2"/><path d="M-12.4 13.7 Q-12.2 13.7 -11.3 13.4" stroke-width="0.4"/><path d="M-11.2 18.3 Q-10.5 18.3 -10.1 18.1" stroke-width="0.3"/><path d="M-8.6 22.1 Q-7.7 21 -6.3 19.8" stroke-width="0.3"/></g>
<g fill="@fourrureO" opacity="0.14" stroke="none">
<path d="M-12.8 -3.9 Q-11.5 0.6 -11.3 6.1 Q-9.8 0.5 -10.6 -4 Q-11.4 -5 -12.8 -3.9 Z"/>
<path d="M-14.5 -22.3 Q-14.1 -19.5 -13.2 -16 Q-12.9 -19.6 -12.9 -22.4 Q-13.5 -23.4 -14.5 -22.3 Z"/>
<path d="M-10.4 8.8 Q-10.6 12.8 -9.6 17.7 Q-9.4 12.8 -8.8 8.8 Q-9.3 7.8 -10.4 8.8 Z"/>
<path d="M-15.2 -10.6 Q-15.6 -7.5 -14.1 -3.8 Q-14.2 -7.6 -13.5 -10.7 Q-14.1 -11.7 -15.2 -10.6 Z"/>
<path d="M-9 16.7 Q-7.6 21.5 -7.9 27.4 Q-6.7 21.5 -7.7 16.7 Q-8.2 15.7 -9 16.7 Z"/>
<path d="M-19.9 -25.8 Q-18.8 -21.6 -18.4 -16.5 Q-17.3 -21.7 -17.8 -25.9 Q-18.6 -26.8 -19.9 -25.8 Z"/>
<path d="M-12.9 5.2 Q-13.4 7.2 -12.3 9.8 Q-12.5 7.2 -11.7 5.2 Q-12.1 4.2 -12.9 5.2 Z"/>
<path d="M-12.1 -8.2 Q-10.9 -4.9 -10.9 -0.8 Q-9.6 -5 -10.3 -8.3 Q-11 -9.2 -12.1 -8.2 Z"/>
<path d="M-16.9 -21.5 Q-17.1 -18.1 -15.7 -14 Q-16.3 -18.1 -15.9 -21.6 Q-16.4 -22.6 -16.9 -21.5 Z"/>
<path d="M-13.1 -19.4 Q-12.9 -15.1 -11.5 -10 Q-12.2 -15.2 -12.2 -19.5 Q-12.6 -20.4 -13.1 -19.4 Z"/>
<path d="M-18.6 -27.6 Q-19 -23.1 -19.5 -17.7 Q-17.1 -22.7 -15.9 -27 Q-16.6 -28.2 -18.6 -27.6 Z"/>
<path d="M-16 -19.3 Q-15.9 -14.7 -14.1 -9.3 Q-15 -14.8 -14.8 -19.5 Q-15.3 -20.4 -16 -19.3 Z"/>
<path d="M-8.3 6.2 Q-8.9 8.7 -7.2 11.7 Q-7.2 8.7 -6.1 6.2 Q-6.8 5.2 -8.3 6.2 Z"/>
<path d="M-5.4 -10 Q-5.7 -6.8 -3.7 -2.9 Q-3.7 -6.8 -2.7 -10.1 Q-3.7 -11.1 -5.4 -10 Z"/>
<path d="M-18.2 -25.7 Q-17.7 -21.6 -16.8 -16.6 Q-16.3 -21.7 -16.4 -25.8 Q-17.1 -26.7 -18.2 -25.7 Z"/>
<path d="M-17.4 -21.8 Q-16.5 -19.8 -16.2 -17.1 Q-15.3 -19.9 -15.8 -22 Q-16.4 -22.9 -17.4 -21.8 Z"/>
<path d="M-13.5 -1.7 Q-12.9 0.6 -12.6 3.5 Q-11.7 0.6 -12 -1.8 Q-12.5 -2.8 -13.5 -1.7 Z"/>
</g>
<g fill="@fourrureO" opacity="0.1" stroke="none">
<path d="M-4.1 11.4 Q-3.6 14.2 -3.2 17.6 Q-2.7 14.2 -2.9 11.4 Q-3.3 10.4 -4.1 11.4 Z"/>
<path d="M-3.6 -23.1 Q-3 -20.5 -2.8 -17.3 Q-2.2 -20.6 -2.7 -23.2 Q-3.1 -24.2 -3.6 -23.1 Z"/>
<path d="M-9.1 -27 Q-9.9 -24.3 -9.4 -20.8 Q-8.9 -24.2 -7.9 -26.8 Q-8.2 -27.9 -9.1 -27 Z"/>
<path d="M-2.2 -0.2 Q-1.5 2.9 -1.6 6.8 Q-1 2.9 -1.5 -0.2 Q-1.8 -1.2 -2.2 -0.2 Z"/>
<path d="M-9.1 -27.8 Q-10.1 -26.3 -9.6 -24 Q-9.3 -26.1 -8.1 -27.5 Q-8.2 -28.6 -9.1 -27.8 Z"/>
<path d="M-6 -33.1 Q-7.3 -29.5 -7.3 -24.9 Q-6.5 -29.4 -5 -32.9 Q-5.1 -33.9 -6 -33.1 Z"/>
<path d="M-2 5.4 Q-1.5 10 -1.4 15.7 Q-0.6 10 -0.8 5.4 Q-1.2 4.4 -2 5.4 Z"/>
<path d="M-2.5 14.5 Q-1.7 17.5 -1.7 21.1 Q-0.9 17.4 -1.4 14.5 Q-1.8 13.5 -2.5 14.5 Z"/>
<path d="M-7.1 -24.4 Q-6.1 -20 -6 -14.6 Q-5.2 -20.1 -5.9 -24.5 Q-6.4 -25.4 -7.1 -24.4 Z"/>
<path d="M-5.3 -14.8 Q-4.7 -10.3 -4 -4.9 Q-3.5 -10.4 -3.6 -14.9 Q-4.2 -15.9 -5.3 -14.8 Z"/>
</g>
<g fill="@fourrureH" opacity="0.5" stroke="none">
<path d="M3.7 -15.8 Q3.5 -12.6 5.1 -8.7 Q4.7 -12.6 5.3 -16 Q4.6 -16.9 3.7 -15.8 Z"/>
<path d="M2.6 -26.9 Q2.3 -23.6 3.4 -19.6 Q3.2 -23.6 3.9 -27 Q3.3 -27.9 2.6 -26.9 Z"/>
</g>
<g stroke="@poil" fill="none" opacity="0.5" stroke-linecap="round">
<path d="M5 -10.3 Q5.2 -9.4 5.2 -8.6" stroke-width="0.42"/>
<path d="M-1.7 -8.4 Q-1.7 -7.8 -1.5 -7.1" stroke-width="0.52"/>
<path d="M-1.9 -9 Q-1.7 -8.5 -1.9 -7.9" stroke-width="0.42"/>
<path d="M-0.5 -8.7 Q-0.4 -7.7 0 -6.7" stroke-width="0.42"/>
<path d="M-11.5 -1.3 Q-11.4 -0.4 -10.8 0.3" stroke-width="0.42"/>
<path d="M4 -7.5 Q3.8 -6.6 3.5 -5.7" stroke-width="0.52"/>
<path d="M-8.1 -0.7 Q-8 -0.1 -8.3 0.5" stroke-width="0.42"/>
<path d="M-8.4 -1.8 Q-8.7 -0.9 -8.5 0.1" stroke-width="0.52"/>
<path d="M-0.4 -5.7 Q-0.7 -4.8 -0.7 -3.9" stroke-width="0.42"/>
<path d="M-0.6 -5.7 Q-0.6 -4.9 -0.3 -4.2" stroke-width="0.52"/>
<path d="M-14.9 -10.9 Q-14.4 -9.9 -14.3 -8.8" stroke-width="0.42"/>
<path d="M-14.6 -9.4 Q-14.6 -8.7 -14.4 -8.1" stroke-width="0.52"/>
<path d="M-12.5 -9.4 Q-12.4 -8.5 -11.9 -7.9" stroke-width="0.52"/>
<path d="M-14.5 -10.6 Q-14.1 -9.6 -14.3 -8.5" stroke-width="0.42"/>
<path d="M-5.6 -5.2 Q-5.8 -4.3 -5.6 -3.3" stroke-width="0.42"/>
<path d="M-6.3 -4.8 Q-5.8 -4.3 -5.9 -3.6" stroke-width="0.42"/>
<path d="M-9.5 -1.8 Q-9.5 -1 -9.4 -0.1" stroke-width="0.42"/>
<path d="M-9.6 -0.3 Q-8.9 0.5 -8.6 1.6" stroke-width="0.42"/>
<path d="M-7.9 -0.6 Q-8.3 -0.1 -7.9 0.4" stroke-width="0.52"/>
<path d="M-11.7 -9.8 Q-11.7 -8.8 -11.6 -7.8" stroke-width="0.42"/>
<path d="M2.5 -5.2 Q2.1 -4.7 2.3 -4.1" stroke-width="0.52"/>
<path d="M3 -4.8 Q2.9 -4 2.6 -3.3" stroke-width="0.42"/>
<path d="M2.2 -3.8 Q2.4 -2.8 2.1 -1.8" stroke-width="0.52"/>
<path d="M3.1 -4.6 Q3.3 -3.5 3.6 -2.4" stroke-width="0.52"/>
</g>
<path d="M-18.4 -29.4 L-16.4 -30.6 L-14.7 -31.2 L-12 -32 L-9 -31.9 L-5.7 -31.2 L-3 -30.3 L-0.2 -29.9 L2.3 -30.4 L4.9 -30.6 L7.3 -30.3 L8.4 -30 Q10.6 -28.6 12.6 -28" fill="none" stroke="@fourrureO" stroke-width="2.6" opacity="0.35" stroke-linecap="round"/>
<path d="M-18.1 -32.2 L-16.5 -33.4 L-14.8 -34.1 L-12 -35 L-9 -34.9 L-5.7 -34.2 L-3 -33.3 L-0.2 -32.9 L2.3 -33.4 L4.9 -33.6 L7.3 -33.3 L8.2 -33 Q10.6 -31.5 12.8 -30.9" fill="none" stroke="@fourrureH" stroke-width="3" opacity="1" stroke-linecap="round"/>
</g>
<path d="M-0.2 25.4 L0.9 27.4 L1.6 29.6 L1.9 31.9 L1.9 34.2 L1.8 36.5 L1.7 38.8 L1.7 41.1 L3.1 41.8 L1.7 43.4 L2.5 45 L1.4 45.6 L2.3 48.2 L0.9 47.8 L2.4 52.1 L-1.1 48 L-2.8 46.5 L-4 44.5 L-4.4 42.3 L-5.2 40.9 L-4.4 40 L-5.2 39.2 L-4.4 37.7 L-5.5 37.9 L-4.2 35.4 L-5.6 32.6 L-3.6 30.8 L-3.1 28.6 L-2.4 26.4 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-1 25.8 Q0.8 27.4 1 30.8 Q1.2 34.8 0.4 38.8 Q-0.2 42.8 -0.4 46.4 L-1.8 46.2 Q-1.4 41.8 -1.2 37.8 Q-1 32.8 -1.6 29.2 Q-2 26.8 -1 25.8 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M-2.6 26.4 Q-3.4 29.8 -3.2 33.8 Q-3 37.8 -3.6 41.8 L-4.2 44.2 L-3.4 44.4 Q-2.6 39.8 -2.4 34.8 Q-2.2 29.8 -1.6 26.6 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>

<path d="M-4.2 45.2 Q-2.6 44.2 -1.6 45.8 L-0.8 43.6 Q0.6 43.2 1 45.2 L1.8 43.4 Q3.2 43.6 3 45.6 Q2.8 47.8 1.2 49.4 Q-0.8 51.2 -2.8 50.2 Q-4.6 49 -4.6 46.8 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-3.6 46.4 Q-2 45.6 -1.4 47.2 Q-1.2 49.2 -2.4 49.8 Q-3.8 49.4 -4 47.8 Z" fill="@fourrureO" opacity="0.5" stroke="none"/>
<g stroke="@poilO" stroke-width="0.42" fill="none" stroke-linecap="round">
<path d="M-1.8 46 Q-2 48.2 -2.8 50"/><path d="M0 45.4 Q0 47.6 -0.6 49.6"/><path d="M1.8 45.2 Q2 47.2 1.2 49"/>
</g>
</g>`,
      profile: `<g stroke="@metalO" stroke-width="0.5" stroke-linejoin="round">
<path d="M-7.6 -29.4 Q1 -32.6 8.4 -28.6 L9 -12 Q8.6 -4 7.4 3 L-6.4 3 Q-7.4 -4 -7.8 -12 Z" fill="url(#g_steelD)"/>
<path d="M-7.6 -29.4 Q1 -32.6 8.4 -28.6 L9 -12 Q8.6 -4 7.4 3 L-6.4 3 Q-7.4 -4 -7.8 -12 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M2 -29 Q2.8 -14 2.2 -1.4" stroke="@metalO" stroke-width="0.8" opacity="0.95"/>
<path d="M2.9 -29.2 Q3.7 -14 3.1 -1.4" stroke="@metalH" stroke-width="0.42" opacity="0.6"/>
<path d="M5.4 -28.2 Q6.4 -14 5.6 -1.2" stroke="@metalO" stroke-width="0.8" opacity="0.95"/>
<path d="M6.3 -28 Q7.3 -14 6.5 -1.2" stroke="@metalH" stroke-width="0.28" opacity="0.32"/>
<path d="M-1 -29.4 Q-0.6 -14 -1 -1.6" stroke="@metalO" stroke-width="0.8" opacity="0.95"/>
<path d="M-0.1 -29.5 Q0.3 -14 -0.1 -1.6" stroke="@metalH" stroke-width="0.34" opacity="0.44"/>
</g>
<path d="M-7.5 -29 Q1 -32.2 8.3 -28.2 Q1 -30.4 -7.5 -29 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<ellipse cx="4.4" cy="-22" rx="1.7" ry="4.2" fill="@metalH" opacity="0.14" stroke="none" transform="rotate(4 4.4 -22)"/>
<path d="M-7.6 -8.4 Q1 -4.8 8.8 -8.4 L8.7 -3.6 Q1 0 -7.5 -3.6 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-7.6 -8.4 Q1 -4.8 8.8 -8.4 L8.7 -3.6 Q1 0 -7.5 -3.6 Z" fill="@metalO" opacity="0.34" stroke="none"/>
<path d="M-7.6 -8.4 Q1 -4.8 8.8 -8.4" stroke="@metalH" stroke-width="0.62" fill="none" opacity="1"/>
<path d="M-7.5 -3.7 Q1 -0.1 8.7 -3.7 L8.5 1.2 Q1 4.8 -7.3 1.2 Z" fill="url(#g_steelD)" stroke="none"/>
<path d="M-7.5 -3.7 Q1 -0.1 8.7 -3.7 L8.5 1.2 Q1 4.8 -7.3 1.2 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M3 -0.6 Q6.4 -1.6 8.7 -3.5" stroke="@metalH" stroke-width="0.32" fill="none" opacity="0.5"/>
<g fill="@metalO" stroke="none"><circle cx="6.4" cy="-6" r="0.5"/><circle cx="-5.2" cy="-6" r="0.5"/></g>
<path d="M-7 6.6 Q1 9.8 8.2 6.6 L8 12 Q1 15.4 -6.8 12 Z" fill="url(#g_steelD)"/>
<path d="M-7 6.6 Q1 9.8 8.2 6.6 L8 12 Q1 15.4 -6.8 12 Z" fill="@metalO" opacity="0.3" stroke="none"/>
<path d="M-7 6.8 Q1 10 8.2 6.8" stroke="@metalH" stroke-width="0.7" fill="none" opacity="1"/>
<path d="M-6.8 11.4 Q1 14.8 8 11.4 L7.8 16.4 Q1 19.8 -6.6 16.4 Z" fill="url(#g_steelD)"/>
<path d="M-6.8 11.4 Q1 14.8 8 11.4 L7.8 16.4 Q1 19.8 -6.6 16.4 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M2.8 14.6 Q6 13.9 8 11.6" stroke="@metalH" stroke-width="0.32" fill="none" opacity="0.55"/>
<path d="M-6.4 15.8 Q1 19.2 7.6 15.8 L7.2 20.6 Q1 24 -6 20.6 Z" fill="url(#g_steelD)"/>
<path d="M-6.4 15.8 Q1 19.2 7.6 15.8 L7.2 20.6 Q1 24 -6 20.6 Z" fill="@metalO" opacity="0.36" stroke="none"/>
<path d="M-6.4 16 Q1 19.4 7.6 16" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.9"/>
<path d="M-5.8 20 Q1 23.4 7 20 L6.4 24.6 Q1 27.8 -5.2 24.6 Z" fill="url(#g_steelD)"/>
<path d="M-5.8 20 Q1 23.4 7 20 L6.4 24.6 Q1 27.8 -5.2 24.6 Z" fill="@metalO" opacity="0.55" stroke="none"/>
<path d="M-5.8 20.2 Q-2.6 21.8 0.4 22.4" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<path d="M-5.2 24.2 Q1 27.4 6.4 24.2 L5.6 27.6 Q1 30.6 -4.4 27.6 Z" fill="url(#g_steelD)"/>
<path d="M-5.2 24.2 Q1 27.4 6.4 24.2 L5.6 27.6 Q1 30.6 -4.4 27.6 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-5.2 24.4 Q1 27.6 6.4 24.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M3.6 10.6 L5.6 10.4 L5.8 17.2 L3.8 17.4 Z" fill="@cuir" stroke="none"/>
<path d="M3.6 10.6 L4.3 10.55 L4.5 17.35 L3.8 17.4 Z" fill="@cuirH" opacity="0.5" stroke="none"/>
<rect x="3.6" y="16.6" width="2.2" height="1.7" rx="0.3" fill="@or" stroke="@orO" stroke-width="0.35"/>
<g transform="translate(0.8,0)"><path d="M-7.7 8 Q0 9.4 7.7 8 L7.6 9.3 Q0 10.7 -7.6 9.3 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-6.73 2.99 L-3.67 3.74 L-3.67 9.14 L-6.73 8.39 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-6.73 3.11 L-3.67 3.86 L-3.67 5.44 L-6.73 4.69 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-6.73 4.69 L-3.67 5.44 L-3.67 6.24 L-6.73 5.49 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-6.73 6.89 L-3.67 7.64 L-3.67 9.04 L-6.73 8.29 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-5.84" cy="4.47" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -5.84 4.47)"/><circle cx="-5.2" cy="6.31" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-5.37" cy="6.12" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M-3.23 3.81 L-0.17 4.05 L-0.17 9.45 L-3.23 9.21 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-3.23 3.93 L-0.17 4.17 L-0.17 5.75 L-3.23 5.51 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M-3.23 5.51 L-0.17 5.75 L-0.17 6.55 L-3.23 6.31 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M-3.23 7.71 L-0.17 7.95 L-0.17 9.35 L-3.23 9.11 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="-2.34" cy="5.16" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 -2.34 5.16)"/><circle cx="-1.7" cy="6.88" r="0.52" fill="@orO" stroke="none"/>
<circle cx="-1.87" cy="6.69" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M0.27 4.05 L3.33 3.79 L3.33 9.19 L0.27 9.45 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M0.27 4.17 L3.33 3.91 L3.33 5.49 L0.27 5.75 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M0.27 5.75 L3.33 5.49 L3.33 6.29 L0.27 6.55 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M0.27 7.95 L3.33 7.69 L3.33 9.09 L0.27 9.35 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="1.16" cy="5.28" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 1.16 5.28)"/><circle cx="1.8" cy="6.87" r="0.52" fill="@orO" stroke="none"/>
<circle cx="1.63" cy="6.68" r="0.2" fill="@orH" stroke="none" opacity="0.85"/>
<path d="M3.77 3.72 L6.83 2.95 L6.83 8.35 L3.77 9.12 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M3.77 3.84 L6.83 3.07 L6.83 4.65 L3.77 5.42 Z" fill="@orH" opacity="0.9" stroke="none"/>
<path d="M3.77 5.42 L6.83 4.65 L6.83 5.45 L3.77 6.22 Z" fill="@orH" opacity="0.35" stroke="none"/>
<path d="M3.77 7.62 L6.83 6.85 L6.83 8.25 L3.77 9.02 Z" fill="@orO" opacity="0.72" stroke="none"/>
<ellipse cx="4.66" cy="4.83" rx="0.62" ry="0.38" fill="@orH" opacity="0.95" stroke="none" transform="rotate(-18 4.66 4.83)"/><circle cx="5.3" cy="6.29" r="0.52" fill="@orO" stroke="none"/>
<circle cx="5.13" cy="6.1" r="0.2" fill="@orH" stroke="none" opacity="0.85"/></g>
<path d="M-6.4 4.8 L1.6 8.6 L0.8 10.8 L-6.8 6.8 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4" stroke-linejoin="round"/>
<path d="M-6.4 4.8 L1.6 8.6 L0.8 10.8 L-6.8 6.8 Z" fill="@vet2O" opacity="0.32" stroke="none"/>
<path d="M-6.68 6.2 L1.32 10 L0.8 10.8 L-6.8 6.8 Z" fill="@vet2O" opacity="0.6" stroke="none"/>
<path d="M-6.46 5.08 L1.54 8.88 L1.43 9.44 L-6.57 5.64 Z" fill="@vet2H" opacity="0.55" stroke="none"/>
<path d="M-6.47 5.16 L1.53 8.96" stroke="@vet2H" stroke-width="0.28" opacity="0.85" fill="none" stroke-linecap="round"/>
<path d="M-6.5 5.28 L1.5 9.08" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<path d="M-6.72 6.4 L1.28 10.2" stroke="@vet2O" stroke-width="0.22" stroke-dasharray="0.75 0.65" opacity="0.75" fill="none"/>
<ellipse cx="1.4" cy="9.6" rx="1.4" ry="1.1" fill="none" stroke="@or" stroke-width="0.6"/>
<path d="M0.6 10.2 L2.4 11 L1 17.2 L-0.8 16.4 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.4"/>
<path d="M-10.4 -29.8 L-11.6 -29.7 L-11.6 -29.7 Q-14.4 -28.6 -16.2 -28.3 Q-15.4 -27.2 -14.8 -25 L-15.2 -24.1 L-15.7 -22.4 L-16.4 -20.9 L-17 -19.4 L-17.5 -18 L-17.7 -16.6 L-17.6 -15.3 L-17.3 -14.1 L-17 -12.9 L-16.8 -11.6 L-16.8 -10.2 L-17.5 -9.6 L-17.5 -9.6 Q-18.9 -7.8 -20.1 -7 Q-18.8 -6.2 -17.3 -4.4 L-17.3 -4.4 L-17.3 -4.4 Q-18.3 -1.8 -19.3 -0.4 Q-17.8 -0.1 -15.7 1.2 L-16.3 1.8 L-15.9 3.3 L-15.1 4.8 L-14.2 6.1 L-13.9 7.7 L-13.9 7.7 Q-15.5 11 -16.9 13.2 Q-15.2 11.9 -13 10.8 L-12.4 12.2 L-12.1 13.8 L-11.7 15.3 L-11.3 16.9 L-11.2 18.4 L-11.1 20 L-10.9 21.4 L-10 21.2 L-10 21.2 Q-9.3 22.6 -9 23.6 Q-8.5 22.6 -7.4 21.4 L-6.7 20.9 L-6.7 20.9 Q-5.2 20.3 -4.3 20.1 Q-4.7 19.4 -5.1 18.2 L-4.6 16.3 L-4.6 16.3 Q-1.5 15.3 1 14.9 Q-1.4 14.3 -4.2 13.1 L-4.3 10.7 L-3.9 9.2 L-3.9 9.2 Q-2 7.3 -0.5 6.5 Q-1.8 5.5 -3.1 3.2 L-3.1 2.9 Q-1.9 1.8 -1 1.5 Q-1.8 0.6 -2.7 -1.1 L-2.8 -5 L-2.7 -7.9 L-2.4 -10.8 L-1.3 -13.6 L-1.5 -17.8 L-1.5 -17.8 Q-0.3 -19.2 0.6 -19.8 Q-0.2 -20.4 -1.2 -21.7 L-1.2 -23.6 Q-0.5 -24.3 0.1 -24.3 Q-0.6 -25.4 -1.5 -27.4 L-2.4 -29.3 L-2.9 -30.5 L-3.6 -31.4 L-4.8 -32.1 L-6.2 -32.6 L-7.9 -32.5 L-9.4 -31.7 L-10.4 -29.8 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4" stroke-linejoin="round"/>
<clipPath id="wwfur-profil"><path d="M-10.4 -29.8 L-11.6 -29.7 L-11.6 -29.7 Q-14.4 -28.6 -16.2 -28.3 Q-15.4 -27.2 -14.8 -25 L-15.2 -24.1 L-15.7 -22.4 L-16.4 -20.9 L-17 -19.4 L-17.5 -18 L-17.7 -16.6 L-17.6 -15.3 L-17.3 -14.1 L-17 -12.9 L-16.8 -11.6 L-16.8 -10.2 L-17.5 -9.6 L-17.5 -9.6 Q-18.9 -7.8 -20.1 -7 Q-18.8 -6.2 -17.3 -4.4 L-17.3 -4.4 L-17.3 -4.4 Q-18.3 -1.8 -19.3 -0.4 Q-17.8 -0.1 -15.7 1.2 L-16.3 1.8 L-15.9 3.3 L-15.1 4.8 L-14.2 6.1 L-13.9 7.7 L-13.9 7.7 Q-15.5 11 -16.9 13.2 Q-15.2 11.9 -13 10.8 L-12.4 12.2 L-12.1 13.8 L-11.7 15.3 L-11.3 16.9 L-11.2 18.4 L-11.1 20 L-10.9 21.4 L-10 21.2 L-10 21.2 Q-9.3 22.6 -9 23.6 Q-8.5 22.6 -7.4 21.4 L-6.7 20.9 L-6.7 20.9 Q-5.2 20.3 -4.3 20.1 Q-4.7 19.4 -5.1 18.2 L-4.6 16.3 L-4.6 16.3 Q-1.5 15.3 1 14.9 Q-1.4 14.3 -4.2 13.1 L-4.3 10.7 L-3.9 9.2 L-3.9 9.2 Q-2 7.3 -0.5 6.5 Q-1.8 5.5 -3.1 3.2 L-3.1 2.9 Q-1.9 1.8 -1 1.5 Q-1.8 0.6 -2.7 -1.1 L-2.8 -5 L-2.7 -7.9 L-2.4 -10.8 L-1.3 -13.6 L-1.5 -17.8 L-1.5 -17.8 Q-0.3 -19.2 0.6 -19.8 Q-0.2 -20.4 -1.2 -21.7 L-1.2 -23.6 Q-0.5 -24.3 0.1 -24.3 Q-0.6 -25.4 -1.5 -27.4 L-2.4 -29.3 L-2.9 -30.5 L-3.6 -31.4 L-4.8 -32.1 L-6.2 -32.6 L-7.9 -32.5 L-9.4 -31.7 L-10.4 -29.8 Z"/></clipPath>
<g clip-path="url(#wwfur-profil)">
<path d="M-14.9 -26.2 L-15.7 -22.4 L-17 -19.4 L-17.7 -16.6 L-17.5 -14.1 L-16.8 -11.6 L-17.5 -9.6 L-18.9 -7.8 L-17.4 -6.5 L-17.5 -5.1 L-17.2 -3.3 L-16.7 -1.5 L-16.2 0.1 L-15.7 1.6 L-15.3 3.2 L-14.9 4.7 L-14.4 6.2 L-14 7.7 L-13.6 9.3 L-13.1 10.8 L-12.7 12.3 L-12.4 13.8 L-12 15.4 L-11.6 16.9 L-11.1 18.4 L-10.7 19.8 L-10.3 21.1 L-9.7 21.9 L-8.8 22.2 L-7.8 21.8 L-6.7 20.9 L-5.7 19.7 L-5 18.2 L-4.5 16.5 L-4.3 14.7 L-4.1 12.8 L-3.9 10.8 L-3.7 8.6 L-3.4 6.2 L-3.1 3.7 L-2.8 0.9 L-2.6 -2 L-2.4 -5 L-2.3 -7.9 L-2.7 -9.3 L-4.5 -8.7 L-5.9 -4.8 L-8.8 -7.7 L-10.4 -5.9 L-12.2 -6.6 L-14 -3.3 L-14.5 -6.8 L-13.8 -10.4 L-14.4 -14 L-13.9 -17.6 L-14.6 -21.1 L-13.9 -24.5 L-14.9 -26.2 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M-12.5 -8.9 L-13.7 -7.6 L-9.9 21.8 L-9.7 21.9 L-9.2 21.9 L-8.9 21.9 L-7.8 21.8 L-7.3 22.1 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M-11.4 -29.3 L-10.4 -29.8 L-7.4 -6.3 L-8.6 -6 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M-10.4 -29.8 L-9.5 -30.1 L-6.4 -6.6 L-7.4 -6.3 Z" fill="@fourrureH" opacity="0.3" stroke="none"/>
<g stroke="@poilO" fill="none" opacity="0.42" stroke-linecap="round"><path d="M-12 -29.2 Q-11.4 -28.8 -10.9 -28.3" stroke-width="0.3"/><path d="M-16.1 -5.7 Q-15.4 -5.6 -14.3 -5.8" stroke-width="0.2"/></g>
<g fill="@fourrureO" opacity="0.14" stroke="none">
<path d="M-11.2 -16.4 Q-10.3 -12.9 -10.2 -8.7 Q-8.3 -12.8 -8.6 -16.3 Q-9.4 -17.3 -11.2 -16.4 Z"/>
<path d="M-10.2 -30.7 Q-11.9 -27.4 -12.6 -22.9 Q-10.6 -26.9 -8.5 -29.9 Q-8.7 -31.1 -10.2 -30.7 Z"/>
<path d="M-12 -29.8 Q-13.3 -27.6 -13.4 -24.3 Q-12 -27.1 -10.4 -29.1 Q-10.5 -30.3 -12 -29.8 Z"/>
<path d="M-13.4 2.3 Q-12.4 6.5 -11.7 11.7 Q-10.4 6.4 -10.7 2.2 Q-11.7 1.3 -13.4 2.3 Z"/>
<path d="M-16.6 -15.5 Q-15.9 -12.7 -16 -9.4 Q-14.7 -12.7 -14.9 -15.4 Q-15.4 -16.4 -16.6 -15.5 Z"/>
<path d="M-11.9 -24.4 Q-11.7 -22.8 -12 -20.9 Q-10.6 -22.6 -10.5 -24.1 Q-10.7 -25.2 -11.9 -24.4 Z"/>
<path d="M-11.6 -14.5 Q-11.1 -11 -10.9 -6.6 Q-9.6 -10.9 -9.6 -14.4 Q-10.3 -15.5 -11.6 -14.5 Z"/>
<path d="M-12.4 -3.9 Q-12.6 -1.6 -11.4 1 Q-11.4 -1.7 -10.8 -3.9 Q-11.4 -4.9 -12.4 -3.9 Z"/>
<path d="M-9.7 -22.4 Q-9.2 -18.9 -9.8 -14.8 Q-7.9 -18.7 -7.9 -22.2 Q-8.4 -23.2 -9.7 -22.4 Z"/>
<path d="M-13 -26 Q-13.5 -23.3 -14.3 -20.1 Q-12.6 -23 -11.9 -25.7 Q-12 -26.7 -13 -26 Z"/>
<path d="M-16.4 -10 Q-15.9 -8.4 -15.3 -6.4 Q-14.3 -8.4 -14.2 -10 Q-15 -11 -16.4 -10 Z"/>
<path d="M-13.2 -19.7 Q-12.1 -18 -12.5 -16.1 Q-10.4 -17.8 -10.9 -19.4 Q-11.6 -20.5 -13.2 -19.7 Z"/>
<path d="M-10.3 -29.8 Q-11.3 -26.7 -12.4 -22.9 Q-10.1 -26.2 -8.7 -29.1 Q-8.9 -30.3 -10.3 -29.8 Z"/>
<path d="M-10.1 -21.6 Q-11.1 -18.4 -10 -14.2 Q-9.7 -18.2 -8.2 -21.3 Q-8.7 -22.4 -10.1 -21.6 Z"/>
<path d="M-11.3 7.5 Q-10.3 10.9 -9.4 15.1 Q-8.5 10.8 -8.9 7.3 Q-9.8 6.3 -11.3 7.5 Z"/>
<path d="M-8.7 12.6 Q-8.9 17.1 -7.2 22.5 Q-8.1 17.1 -7.6 12.5 Q-8.1 11.5 -8.7 12.6 Z"/>
<path d="M-9.5 -27.8 Q-11 -23.1 -12.4 -17.4 Q-10 -22.8 -8.3 -27.3 Q-8.4 -28.4 -9.5 -27.8 Z"/>
</g>
<g fill="@fourrureO" opacity="0.1" stroke="none">
<path d="M-10.3 -0.2 Q-9.5 2.2 -9.1 5.1 Q-8.1 2.2 -8.3 -0.2 Q-9.1 -1.2 -10.3 -0.2 Z"/>
<path d="M-8.6 16.9 Q-8.6 19.5 -7.2 22.5 Q-7.4 19.4 -6.9 16.7 Q-7.6 15.8 -8.6 16.9 Z"/>
<path d="M-8.8 11.8 Q-9.1 16.7 -7.2 22.5 Q-8.3 16.6 -7.7 11.7 Q-8.2 10.7 -8.8 11.8 Z"/>
<path d="M-6.3 -29.8 Q-8 -27.7 -7.9 -24.1 Q-6.9 -27.2 -4.9 -29.2 Q-5 -30.3 -6.3 -29.8 Z"/>
<path d="M-7.5 -0.5 Q-7.2 3.4 -6.3 8.2 Q-6 3.4 -5.9 -0.5 Q-6.5 -1.5 -7.5 -0.5 Z"/>
<path d="M-8.3 -24.4 Q-8.6 -19.9 -9.7 -14.6 Q-7.3 -19.6 -6.6 -24 Q-7 -25.1 -8.3 -24.4 Z"/>
<path d="M-8 3.8 Q-7 6.1 -7.3 8.9 Q-6.4 6 -7.1 3.8 Q-7.4 2.8 -8 3.8 Z"/>
<path d="M-10.5 3.7 Q-9.9 5.9 -9.5 8.6 Q-8.7 5.9 -8.9 3.6 Q-9.5 2.7 -10.5 3.7 Z"/>
<path d="M-7.6 2.8 Q-7.3 5.1 -6.5 7.8 Q-6 5 -5.8 2.8 Q-6.5 1.8 -7.6 2.8 Z"/>
<path d="M-5.7 -22.9 Q-5.1 -20.3 -5.8 -17.2 Q-4.2 -20.2 -4.5 -22.8 Q-4.8 -23.8 -5.7 -22.9 Z"/>
</g>
<g fill="@fourrureH" opacity="0.5" stroke="none">
<path d="M-7.2 5.8 Q-7.5 7.4 -6 9.3 Q-6 7.3 -5.2 5.7 Q-6 4.7 -7.2 5.8 Z"/>
<path d="M-5.1 -13.6 Q-4.5 -11.7 -4.2 -9.3 Q-2.9 -11.6 -2.9 -13.6 Q-3.6 -14.6 -5.1 -13.6 Z"/>
<path d="M-4.2 -4.5 Q-3.9 -0.7 -3.2 3.9 Q-2.8 -0.7 -2.8 -4.6 Q-3.4 -5.5 -4.2 -4.5 Z"/>
<path d="M-6.5 11.9 Q-6.1 15.7 -4.7 20.2 Q-4.5 15.5 -4.3 11.8 Q-5.2 10.8 -6.5 11.9 Z"/>
<path d="M-7.7 15.8 Q-7.3 18.1 -6.4 20.8 Q-6 17.9 -6 15.6 Q-6.7 14.7 -7.7 15.8 Z"/>
<path d="M-5.1 -6.3 Q-5.5 -2.4 -3.9 2.4 Q-3.9 -2.4 -2.9 -6.4 Q-3.7 -7.3 -5.1 -6.3 Z"/>
</g>
<g stroke="@poil" fill="none" opacity="0.5" stroke-linecap="round">
<path d="M-7.2 -9.8 Q-7.7 -8.9 -7.8 -7.9" stroke-width="0.42"/>
<path d="M-6.5 -8.4 Q-6.6 -7.6 -6.8 -6.8" stroke-width="0.42"/>
<path d="M-8.5 -9.6 Q-8.6 -8.9 -9.1 -8.3" stroke-width="0.52"/>
<path d="M-8.5 -9.6 Q-8.3 -8.9 -7.9 -8.2" stroke-width="0.52"/>
<path d="M-10 -11.3 Q-10.3 -10.3 -10.3 -9.2" stroke-width="0.52"/>
<path d="M-9.6 -12.3 Q-9.8 -11.3 -9.8 -10.4" stroke-width="0.42"/>
<path d="M-5 -8.7 Q-5 -8 -4.7 -7.3" stroke-width="0.42"/>
<path d="M-5.4 -10.6 Q-5.7 -9.9 -5.8 -9.2" stroke-width="0.42"/>
<path d="M-11.5 -12.8 Q-11.9 -12.4 -11.8 -11.9" stroke-width="0.52"/>
<path d="M-12 -12.9 Q-11.6 -12 -11.4 -11" stroke-width="0.42"/>
<path d="M-8.7 -6.4 Q-8.5 -5.3 -8.9 -4.2" stroke-width="0.52"/>
<path d="M-9.6 -4.3 Q-9.6 -3.3 -9.3 -2.3" stroke-width="0.52"/>
<path d="M-11.9 -4.1 Q-12.3 -3.3 -12.2 -2.3" stroke-width="0.42"/>
<path d="M-13.6 -4.8 Q-13.7 -3.9 -13.3 -3.1" stroke-width="0.42"/>
<path d="M-13.8 -12 Q-14.1 -11.5 -14.1 -11" stroke-width="0.42"/>
<path d="M-13.4 -12.8 Q-13.1 -12.4 -13.1 -11.9" stroke-width="0.42"/>
<path d="M-13.4 -13.5 Q-12.9 -12.4 -12.7 -11.2" stroke-width="0.42"/>
<path d="M-9.3 -6.1 Q-9.6 -5.6 -9.2 -5.1" stroke-width="0.52"/>
<path d="M-9.5 -4.9 Q-9.5 -4 -9.8 -3.2" stroke-width="0.52"/>
<path d="M-9.7 -4.6 Q-9.7 -3.9 -9.2 -3.4" stroke-width="0.42"/>
<path d="M-9.5 -5.9 Q-9.6 -5.4 -9.2 -5.1" stroke-width="0.42"/>
<path d="M-12.8 -16 Q-12.7 -15.4 -12.8 -14.8" stroke-width="0.52"/>
<path d="M-12.4 -15.4 Q-12.3 -14.2 -12.7 -13.1" stroke-width="0.42"/>
<path d="M-3.8 -13.8 Q-3.5 -13.5 -3.6 -12.9" stroke-width="0.52"/>
<path d="M-14 -11.5 Q-13.7 -10.9 -13.8 -10.3" stroke-width="0.42"/>
<path d="M-15.9 -8.6 Q-16.3 -8 -16.3 -7.2" stroke-width="0.52"/>
</g>
<path d="M-16.5 -25.3 Q-14.4 -25.6 -11.6 -26.7 L-10.4 -26.8 L-9.4 -28.7 L-7.9 -29.5 L-6.2 -29.6 L-4.8 -29.1 L-3.6 -28.4 L-2.9 -27.5" fill="none" stroke="@fourrureO" stroke-width="2.6" opacity="0.35" stroke-linecap="round"/>
<path d="M-16.2 -28.3 Q-14.4 -28.6 -11.6 -29.7 L-10.4 -29.8 L-9.4 -31.7 L-7.9 -32.5 L-6.2 -32.6 L-4.8 -32.1 L-3.6 -31.4 L-2.9 -30.5" fill="none" stroke="@fourrureH" stroke-width="3" opacity="1" stroke-linecap="round"/>
</g>
<path d="M-3.5 21.6 L-2.6 22.1 L-2.4 23.6 L-0.9 24.9 L-1.7 25.8 L-1.5 28.1 L-0.9 29.9 L-1.5 30.4 L-0.8 31.8 L-1.6 32.7 L-0.4 34.4 L-1.7 35 L-0.8 36 L-1.7 37.3 L-0.7 39.5 L-1.7 39.6 L-2 41.9 L-2.3 44.1 L-4.2 44.8 L-5.9 43.3 L-7.2 41.5 L-7.7 39.2 L-7.8 36.9 L-7.8 34.6 L-7.6 32.3 L-7.3 30 L-7 27.8 L-6.6 25.5 L-5.9 23.3 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-4.2 22 Q-2.4 23.6 -2.2 27 Q-2 31 -2.8 35 Q-3.4 39 -3.6 42.6 L-5 42.4 Q-4.6 38 -4.4 34 Q-4.2 29 -4.8 25.4 Q-5.2 23 -4.2 22 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M-6 22.6 Q-6.8 26 -6.6 30 Q-6.4 34 -7 38 L-7.6 40.4 L-6.8 40.6 Q-6 36 -5.8 31 Q-5.6 26 -5 22.8 Z" fill="@fourrureH" opacity="0.8" stroke="none"/>

<path d="M-7.4 41.4 Q-5.8 40.4 -4.8 42 L-4 39.8 Q-2.6 39.4 -2.2 41.4 L-1.4 39.6 Q0 39.8 -0.2 41.8 Q-0.4 44 -2 45.6 Q-4 47.4 -6 46.4 Q-7.8 45.2 -7.8 43 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4"/>
<path d="M-6.8 42.6 Q-5.2 41.8 -4.6 43.4 Q-4.4 45.4 -5.6 46 Q-7 45.6 -7.2 44 Z" fill="@fourrureO" opacity="0.5" stroke="none"/>
<g stroke="@poilO" stroke-width="0.42" fill="none" stroke-linecap="round">
<path d="M-5 42.2 Q-5.2 44.4 -6 46.2"/><path d="M-3.2 41.6 Q-3.2 43.8 -3.8 45.8"/><path d="M-1.4 41.4 Q-1.2 43.4 -2 45.2"/>
</g>
</g>`,
    },
    jambes: {
      front: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M-2.6 0.6 Q-3.1 7 -2.6 12.6" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
<path d="M-1.9 0.5 Q-2.4 7 -1.9 12.6" stroke="@metalH" stroke-width="0.34" opacity="0.55"/>
<path d="M0.1 0.5 Q0.1 7 0.1 12.7" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
<path d="M0.8 0.5 Q0.8 7 0.8 12.7" stroke="@metalH" stroke-width="0.26" opacity="0.32"/>
<path d="M2.8 0.6 Q3.3 7 2.8 12.6" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
</g>
<path d="M-4.75 0.4 L4.75 0.4 Q4.9 1.8 4.85 2.6 L-4.85 2.6 Q-4.9 1.8 -4.75 0.4 Z" fill="@metalH" opacity="0.5" stroke="none"/>
<path d="M-4.6 12.6 Q0 10.4 4.6 12.6 Q5.6 16.4 4.3 20.2 Q0 22.2 -4.3 20.2 Q-5.6 16.4 -4.6 12.6 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-4.6 12.6 Q0 10.4 4.6 12.6 Q5.6 16.4 4.3 20.2 Q0 22.2 -4.3 20.2 Q-5.6 16.4 -4.6 12.6 Z" fill="@metalO" opacity="0.38" stroke="none"/>
<path d="M-4.2 13.4 Q0 11.2 4.2 13.4 Q4.6 14.6 4.5 15.4 Q0 13.4 -4.5 15.4 Q-4.6 14.6 -4.2 13.4 Z" fill="@metalH" opacity="0.85" stroke="none"/>
<ellipse cx="-1.5" cy="16.4" rx="1.5" ry="1.9" fill="@metalH" opacity="0.3" stroke="none" transform="rotate(-12 -1.5 16.4)"/>
<ellipse cx="-1.9" cy="15.6" rx="0.6" ry="0.85" fill="@metalH" opacity="0.85" stroke="none" transform="rotate(-12 -1.9 15.6)"/>
<path d="M-3.4 18.6 Q0 20.4 3.4 18.6" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.8"/>
<g fill="@metalO" stroke="none"><circle cx="-3.4" cy="16.4" r="0.42"/><circle cx="3.4" cy="16.4" r="0.42"/></g>
<path d="M-4.2 19.8 Q0 21.8 4.2 19.8 L4.5 26 Q0 27.6 -4.5 26 Z" fill="url(#g_steelD)"/>
<path d="M-4.2 19.8 Q0 21.8 4.2 19.8 L4.5 26 Q0 27.6 -4.5 26 Z" fill="@metalO" opacity="0.32" stroke="none"/>
<path d="M-4.2 20 Q0 22 4.2 20" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.95"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="url(#g_steelD)"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M0.6 27.1 Q2.8 26.8 4.5 26" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.5"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="url(#g_steelD)"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.7 32 Q0 33.6 4.7 32" stroke="@metalH" stroke-width="0.48" fill="none" opacity="0.8"/>
<path d="M-1.7 21 Q-2.1 30 -1.7 37.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.5"/>
<path d="M2.4 21 Q2.8 30 2.4 37.6" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.55"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.65"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.75 37.6 Q0 39.6 4.75 37.6 Q4.8 38.4 4.85 38.8 Q0 40.8 -4.85 38.8 Q-4.8 38.4 -4.75 37.6 Z" fill="@metalH" opacity="0.75" stroke="none"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L5 44 Q0 46 -5 44 Z" fill="url(#g_steelD)"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L5 44 Q0 46 -5 44 Z" fill="@metalO" opacity="0.34" stroke="none"/>
<path d="M-5 40.8 Q0 42.8 5 40.8" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.9"/>
<path d="M-5 43.6 Q0 45.6 5 43.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="url(#g_steelD)"/>
<path d="M-5 43.6 Q0 45.6 5 43.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-4.4 44 Q-2 45 0.4 45.4" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="url(#g_steelD)"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.9 46.6 Q0 48.6 4.9 46.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
</g>`,
      back: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 0 L4.8 0 Q5.4 7 4.3 13.2 L-4.3 13.2 Q-5.4 7 -4.8 0 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M-2.4 0.6 Q-2.9 7 -2.4 12.6" stroke="@metalO" stroke-width="0.6" opacity="0.9"/>
<path d="M2.4 0.6 Q2.9 7 2.4 12.6" stroke="@metalO" stroke-width="0.6" opacity="0.9"/>
</g>
<path d="M-4.75 0.4 L4.75 0.4 Q4.9 1.6 4.85 2.4 L-4.85 2.4 Q-4.9 1.6 -4.75 0.4 Z" fill="@metalH" opacity="0.42" stroke="none"/>
<path d="M-4.4 12.6 Q0 11 4.4 12.6 Q5.2 16.2 4.1 19.8 Q0 21.2 -4.1 19.8 Q-5.2 16.2 -4.4 12.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-4.4 12.6 Q0 11 4.4 12.6 Q5.2 16.2 4.1 19.8 Q0 21.2 -4.1 19.8 Q-5.2 16.2 -4.4 12.6 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-4.1 13.2 Q0 11.6 4.1 13.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.75"/>
<path d="M-3.6 15.6 Q0 14.6 3.6 15.6" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-3.8 17.8 Q0 16.8 3.8 17.8" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.8"/>
<path d="M-4.1 19.4 Q0 20.8 4.1 19.4 L4.5 26 Q0 27.6 -4.5 26 Z" fill="url(#g_steelD)"/>
<path d="M-4.1 19.4 Q0 20.8 4.1 19.4 L4.5 26 Q0 27.6 -4.5 26 Z" fill="@metalO" opacity="0.34" stroke="none"/>
<path d="M-4.1 19.6 Q0 21 4.1 19.6" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="url(#g_steelD)"/>
<path d="M-4.5 25.8 Q0 27.4 4.5 25.8 L4.7 32 Q0 33.6 -4.7 32 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M0.6 27.1 Q2.8 26.8 4.5 26" stroke="@metalH" stroke-width="0.28" fill="none" opacity="0.45"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="url(#g_steelD)"/>
<path d="M-4.7 31.8 Q0 33.4 4.7 31.8 L4.8 38 L-4.8 38 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.7 32 Q0 33.6 4.7 32" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-2.8 21 Q-3.2 30 -2.8 37.6" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.4"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.65"/>
<path d="M-4.8 37.2 Q0 39.2 4.8 37.2 L5 41 Q0 43 -5 41 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4.8 37.6 Q0 39.6 4.8 37.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.7"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="url(#g_steelD)"/>
<path d="M-5 40.6 Q0 42.6 5 40.6 L4.9 46.8 Q0 48.8 -4.9 46.8 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-5 40.8 Q0 42.8 5 40.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="url(#g_steelD)"/>
<path d="M-4.9 46.4 Q0 48.4 4.9 46.4 L4.6 49.4 Q0 51.2 -4.6 49.4 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-4.9 46.6 Q0 48.6 4.9 46.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.7"/>
</g>`,
      profile: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-3.6 0 Q-4.4 7 -3.7 13.2 L3.7 13.2 Q4.6 7 3.8 0 Z" fill="url(#g_steelD)"/>
<path d="M-3.6 0 Q-4.4 7 -3.7 13.2 L3.7 13.2 Q4.6 7 3.8 0 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<g fill="none" stroke-linecap="round">
<path d="M0.2 0.6 Q-0.2 7 0.2 12.6" stroke="@metalO" stroke-width="0.65" opacity="0.95"/>
<path d="M0.9 0.6 Q0.5 7 0.9 12.6" stroke="@metalH" stroke-width="0.34" opacity="0.55"/>
<path d="M2.4 0.6 Q2.1 7 2.4 12.6" stroke="@metalO" stroke-width="0.6" opacity="0.9"/>
</g>
<path d="M-3.55 0.4 L3.75 0.4 Q3.9 1.8 3.85 2.6 L-3.75 2.6 Q-3.9 1.8 -3.55 0.4 Z" fill="@metalH" opacity="0.5" stroke="none"/>
<path d="M-3.3 12.6 Q1 10.4 4.7 13 Q5.9 16.6 4.7 20.2 Q0.8 22.2 -2.9 20.2 Q-4.1 16.6 -3.3 12.6 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-3.3 12.6 Q1 10.4 4.7 13 Q5.9 16.6 4.7 20.2 Q0.8 22.2 -2.9 20.2 Q-4.1 16.6 -3.3 12.6 Z" fill="@metalO" opacity="0.38" stroke="none"/>
<path d="M-2.9 13.4 Q1 11.2 4.3 13.6 Q4.7 14.8 4.7 15.6 Q1 13.2 -3.2 15.4 Q-3.3 14.6 -2.9 13.4 Z" fill="@metalH" opacity="0.85" stroke="none"/>
<ellipse cx="-0.4" cy="16.6" rx="1.4" ry="1.9" fill="@metalH" opacity="0.3" stroke="none" transform="rotate(-10 -0.4 16.6)"/>
<ellipse cx="-0.8" cy="15.8" rx="0.55" ry="0.85" fill="@metalH" opacity="0.85" stroke="none" transform="rotate(-10 -0.8 15.8)"/>
<path d="M-2.2 18.8 Q0.8 20.4 4 18.8" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.8"/>
<circle cx="3.8" cy="16.4" r="0.42" fill="@metalO" stroke="none"/>
<path d="M-3 19.8 Q0.8 21.8 4.4 19.8 L4.5 26 Q0.6 27.6 -3.3 26 Z" fill="url(#g_steelD)"/>
<path d="M-3 19.8 Q0.8 21.8 4.4 19.8 L4.5 26 Q0.6 27.6 -3.3 26 Z" fill="@metalO" opacity="0.32" stroke="none"/>
<path d="M-3 20 Q0.8 22 4.4 20" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.95"/>
<path d="M-3.3 25.8 Q0.6 27.4 4.5 25.8 L4.6 32 Q0.6 33.6 -3.5 32 Z" fill="url(#g_steelD)"/>
<path d="M-3.3 25.8 Q0.6 27.4 4.5 25.8 L4.6 32 Q0.6 33.6 -3.5 32 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M1.2 27.1 Q3 26.8 4.5 26" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.5"/>
<path d="M-3.5 31.8 Q0.6 33.4 4.6 31.8 L4.6 38 L-3.6 38 Z" fill="url(#g_steelD)"/>
<path d="M-3.5 31.8 Q0.6 33.4 4.6 31.8 L4.6 38 L-3.6 38 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.5 32 Q0.6 33.6 4.6 32" stroke="@metalH" stroke-width="0.48" fill="none" opacity="0.8"/>
<path d="M0.4 21 Q0 30 0.4 37.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.5"/>
<path d="M3 21 Q3.4 30 3 37.6" stroke="@metalO" stroke-width="0.45" fill="none" opacity="0.55"/>
<path d="M-3.6 37.2 Q0.6 39.2 4.6 37.2 L4.8 41 Q0.6 43 -3.8 41 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.65"/>
<path d="M-3.6 37.2 Q0.6 39.2 4.6 37.2 L4.8 41 Q0.6 43 -3.8 41 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-3.55 37.6 Q0.6 39.6 4.55 37.6 Q4.6 38.4 4.65 38.8 Q0.6 40.8 -3.65 38.8 Q-3.6 38.4 -3.55 37.6 Z" fill="@metalH" opacity="0.75" stroke="none"/>
<path d="M-3.8 40.6 Q0.6 42.6 4.8 40.6 L4.9 44 Q0.6 46 -4 44 Z" fill="url(#g_steelD)"/>
<path d="M-3.8 40.6 Q0.6 42.6 4.8 40.6 L4.9 44 Q0.6 46 -4 44 Z" fill="@metalO" opacity="0.34" stroke="none"/>
<path d="M-3.8 40.8 Q0.6 42.8 4.8 40.8" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.9"/>
<path d="M-4 43.6 Q0.6 45.6 4.9 43.6 L4.9 46.8 Q0.6 48.8 -4 46.8 Z" fill="url(#g_steelD)"/>
<path d="M-4 43.6 Q0.6 45.6 4.9 43.6 L4.9 46.8 Q0.6 48.8 -4 46.8 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-3.4 44 Q-1.2 45 1 45.4" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<path d="M-4 46.4 Q0.6 48.4 4.9 46.4 L4.6 49.4 Q0.6 51.2 -3.8 49.4 Z" fill="url(#g_steelD)"/>
<path d="M-4 46.4 Q0.6 48.4 4.9 46.4 L4.6 49.4 Q0.6 51.2 -3.8 49.4 Z" fill="@metalO" opacity="0.42" stroke="none"/>
<path d="M-4 46.6 Q0.6 48.6 4.9 46.6" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.75"/>
<path d="M-3.9 44.2 L-6.4 45.4 L-3.7 46.8" fill="none" stroke="@orO" stroke-width="0.9"/>
<path d="M-3.9 43.9 L-6.4 45.1 L-3.7 46.5" fill="none" stroke="@or" stroke-width="0.7"/>
<path d="M-6.5 43.2 L-5.9 44.6 L-4.4 44.9 L-5.6 45.7 L-5.3 47.2 L-6.5 46.3 L-7.7 47.2 L-7.4 45.7 L-8.6 44.9 L-7.1 44.6 Z" fill="@or" stroke="@orO" stroke-width="0.4" stroke-linejoin="round"/>
<circle cx="-6.5" cy="45.4" r="0.5" fill="@orH" stroke="none" opacity="0.8"/>
</g>`,
    },
    bras: {
      front: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-5.2 -3.4 Q0 -8 5.2 -3.4 Q6.2 0.6 4.8 4 Q0 6.2 -4.8 4 Q-6.2 0.6 -5.2 -3.4 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.75"/>
<path d="M-5.2 -3.4 Q0 -8 5.2 -3.4 Q6.2 0.6 4.8 4 Q0 6.2 -4.8 4 Q-6.2 0.6 -5.2 -3.4 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-4.9 -3 Q0 -7.4 4.9 -3 Q5.2 -1.8 5.15 -1 Q0 -5.6 -5.15 -1 Q-5.2 -1.8 -4.9 -3 Z" fill="@metalH" opacity="0.9" stroke="none"/>
<ellipse cx="-2.2" cy="-1.6" rx="1.7" ry="2.3" fill="@metalH" opacity="0.28" stroke="none" transform="rotate(-16 -2.2 -1.6)"/>
<ellipse cx="-2.6" cy="-2.6" rx="0.62" ry="0.95" fill="@metalH" opacity="0.9" stroke="none" transform="rotate(-16 -2.6 -2.6)"/>
<g fill="none" stroke="@metalO" stroke-width="0.4" opacity="0.7" stroke-linecap="round">
<path d="M-3.4 -4.2 Q-3.8 -0.6 -3.4 3.4"/><path d="M-1.2 -5.6 Q-1.4 -1 -1.2 4.4"/><path d="M1.2 -5.6 Q1.4 -1 1.2 4.4"/><path d="M3.4 -4.2 Q3.8 -0.6 3.4 3.4"/>
</g>
<path d="M-4.8 4 Q0 6.2 4.8 4 L4.4 8.2 Q0 10.4 -4.4 8.2 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 4 Q0 6.2 4.8 4 L4.4 8.2 Q0 10.4 -4.4 8.2 Z" fill="@metalO" opacity="0.32" stroke="none"/>
<path d="M-4.8 4.2 Q0 6.4 4.8 4.2" stroke="@metalH" stroke-width="0.6" fill="none" opacity="1"/>
<path d="M-4.4 8.2 Q0 10.4 4.4 8.2 L4.1 12 Q0 14 -4.1 12 Z" fill="url(#g_steelD)"/>
<path d="M-4.4 8.2 Q0 10.4 4.4 8.2 L4.1 12 Q0 14 -4.1 12 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M0.8 9.9 Q2.8 9.4 4.4 8.4" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.5"/>
<path d="M-4.1 12 Q0 14 4.1 12 L3.8 15.8 Q0 17.6 -3.8 15.8 Z" fill="url(#g_steelD)"/>
<path d="M-4.1 12 Q0 14 4.1 12 L3.8 15.8 Q0 17.6 -3.8 15.8 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-4.1 12.2 Q0 14.2 4.1 12.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.88"/>
<g fill="@metalO" stroke="none"><circle cx="-3.5" cy="6.4" r="0.4"/><circle cx="3.5" cy="6.4" r="0.4"/><circle cx="-3.3" cy="10.4" r="0.4"/><circle cx="3.3" cy="10.4" r="0.4"/></g>
<path d="M-3.9 15.4 Q0 13.6 3.9 15.4 Q4.7 18 3.7 20.2 Q0 21.8 -3.7 20.2 Q-4.7 18 -3.9 15.4 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-3.9 15.4 Q0 13.6 3.9 15.4 Q4.7 18 3.7 20.2 Q0 21.8 -3.7 20.2 Q-4.7 18 -3.9 15.4 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-3.6 16 Q0 14.4 3.6 16 Q3.9 16.9 3.85 17.5 Q0 15.8 -3.85 17.5 Q-3.9 16.9 -3.6 16 Z" fill="@metalH" opacity="0.85" stroke="none"/>
<ellipse cx="-1.5" cy="18.3" rx="0.5" ry="0.7" fill="@metalH" opacity="0.7" stroke="none"/>
<path d="M-3.7 20 Q0 21.6 3.7 20 L3.9 24.2 Q0 26 -3.9 24.2 Z" fill="url(#g_steelD)"/>
<path d="M-3.7 20 Q0 21.6 3.7 20 L3.9 24.2 Q0 26 -3.9 24.2 Z" fill="@metalO" opacity="0.34" stroke="none"/>
<path d="M-3.7 20.2 Q0 21.8 3.7 20.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.9"/>
<path d="M-3.9 24 Q0 25.8 3.9 24 L4 28.2 Q0 30 -4 28.2 Z" fill="url(#g_steelD)"/>
<path d="M-3.9 24 Q0 25.8 3.9 24 L4 28.2 Q0 30 -4 28.2 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-3.4 24.4 Q-1.4 25.4 0.6 25.8" stroke="@metalH" stroke-width="0.28" fill="none" opacity="0.45"/>
<path d="M-1.6 21 Q-1.9 25 -1.6 29" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.45"/>
<path d="M-4 28 Q0 29.8 4 28 L4.2 31.2 Q0 33 -4.2 31.2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>
<path d="M-4 28 Q0 29.8 4 28 L4.2 31.2 Q0 33 -4.2 31.2 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M-4 28.2 Q0 30 4 28.2" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.8"/>
</g>`,
      profile: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-4 -3.2 Q0 -7.8 4 -3.2 Q4.8 0.6 3.6 4 Q0 5.8 -3.6 4 Q-4.8 0.6 -4 -3.2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.75"/>
<path d="M-4 -3.2 Q0 -7.8 4 -3.2 Q4.8 0.6 3.6 4 Q0 5.8 -3.6 4 Q-4.8 0.6 -4 -3.2 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M0.5 -7.1 Q3.6 -3.5 4.2 0.3 Q3.1 0.7 2.6 0.1 Q2.1 -2.9 -0.5 -5.8 Z" fill="@metalH" opacity="0.9" stroke="none"/>
<path d="M-0.5 -5.8 Q2.1 -2.9 2.6 0.1 Q1.9 1.7 0.6 2.2 Q0.9 -1.6 -1.6 -4.6 Z" fill="@metalH" opacity="0.45" stroke="none"/>
<ellipse cx="2" cy="-2.2" rx="1.5" ry="2.6" fill="@metalH" opacity="0.4" stroke="none" transform="rotate(18 2 -2.2)"/>
<path d="M-3.6 4 Q0 5.8 3.6 4 L3.5 8.2 Q0 9.9 -3.5 8.2 Z" fill="url(#g_steelD)"/>
<path d="M-3.6 4 Q0 5.8 3.6 4 L3.5 8.2 Q0 9.9 -3.5 8.2 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-1.5 4.95 Q1.1 5.6 3.55 4.15 L3.5 5.55 Q1 6.95 -1.4 6.35 Z" fill="@metalH" opacity="0.72" stroke="none"/>
<path d="M0.4 5.75 Q2.2 5.3 3.6 4.2" stroke="@metalH" stroke-width="0.55" fill="none" opacity="0.95"/>
<path d="M-3.5 8.2 Q0 9.9 3.5 8.2 L3.4 12 Q0 13.6 -3.4 12 Z" fill="url(#g_steelD)"/>
<path d="M-3.5 8.2 Q0 9.9 3.5 8.2 L3.4 12 Q0 13.6 -3.4 12 Z" fill="@metalO" opacity="0.56" stroke="none"/>
<path d="M0.6 9.85 Q2.2 9.4 3.5 8.4" stroke="@metalH" stroke-width="0.42" fill="none" opacity="0.7"/>
<path d="M-3.4 12 Q0 13.6 3.4 12 L3.3 15.6 Q0 17.2 -3.3 15.6 Z" fill="url(#g_steelD)"/>
<path d="M-3.4 12 Q0 13.6 3.4 12 L3.3 15.6 Q0 17.2 -3.3 15.6 Z" fill="@metalO" opacity="0.44" stroke="none"/>
<path d="M0.3 13.5 Q1.9 13.3 3.38 12.15 L3.33 13.4 Q1.8 14.35 0.4 14.6 Z" fill="@metalH" opacity="0.7" stroke="none"/>
<path d="M0.4 13.55 Q2.1 13.1 3.4 12.2" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.85"/>
<path d="M-3.4 15.4 Q0 13.8 3.4 15.4 Q4.2 18 3.2 20.4 Q0 22 -4.8 20.6 Q-5.6 18 -3.4 15.4 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-3.4 15.4 Q0 13.8 3.4 15.4 Q4.2 18 3.2 20.4 Q0 22 -4.8 20.6 Q-5.6 18 -3.4 15.4 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M0.4 14.2 Q2.9 15.6 3.5 17.4 Q2.6 17.8 2.1 17.3 Q1.6 16.2 -0.2 15.5 Z" fill="@metalH" opacity="0.8" stroke="none"/>
<path d="M-0.2 15.5 Q1.6 16.2 2.1 17.3 Q1.5 18.3 0.4 18.5 Q0.2 16.8 -1.3 15.9 Z" fill="@metalH" opacity="0.42" stroke="none"/>
<ellipse cx="1.4" cy="18.4" rx="0.85" ry="1.15" fill="@metalH" opacity="0.75" stroke="none"/>
<path d="M-4.6 20.4 Q0 21.8 3.2 20.4 L3.2 21.7 Q0 23.1 -4.4 21.7 Z" fill="@metalO" opacity="0.5" stroke="none"/>
<path d="M-3.6 20.6 Q0 22 3.2 20.6 L3.3 24.4 Q0 26 -3.6 24.4 Z" fill="url(#g_steelD)"/>
<path d="M-3.6 20.6 Q0 22 3.2 20.6 L3.3 24.4 Q0 26 -3.6 24.4 Z" fill="@metalO" opacity="0.4" stroke="none"/>
<path d="M-0.8 21.75 Q1.2 21.9 3.2 20.75 L3.25 22.05 Q1.1 23.2 -0.7 23.05 Z" fill="@metalH" opacity="0.7" stroke="none"/>
<path d="M0.4 21.95 Q2 21.6 3.2 20.8" stroke="@metalH" stroke-width="0.45" fill="none" opacity="0.85"/>
<path d="M-3.6 24.4 Q0 26 3.3 24.4 L3.4 28.2 Q0 29.8 -3.6 28.2 Z" fill="url(#g_steelD)"/>
<path d="M-3.6 24.4 Q0 26 3.3 24.4 L3.4 28.2 Q0 29.8 -3.6 28.2 Z" fill="@metalO" opacity="0.56" stroke="none"/>
<path d="M0.5 25.85 Q2 25.5 3.3 24.6" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.65"/>
<path d="M-3.6 28.2 Q0 29.8 3.4 28.2 L3.5 31.2 Q0 32.8 -3.6 31.2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>
<path d="M-3.6 28.2 Q0 29.8 3.4 28.2 L3.5 31.2 Q0 32.8 -3.6 31.2 Z" fill="@metalO" opacity="0.48" stroke="none"/>
<path d="M-0.6 29.75 Q1.6 29.55 3.38 28.35 L3.42 29.55 Q1.5 30.6 -0.5 30.85 Z" fill="@metalH" opacity="0.5" stroke="none"/>
<path d="M0.4 29.65 Q2 29.3 3.4 28.4" stroke="@metalH" stroke-width="0.42" fill="none" opacity="0.75"/>
<g fill="@metalO" stroke="none"><circle cx="2.6" cy="6.4" r="0.4"/><circle cx="2.5" cy="10.3" r="0.4"/></g>
<g fill="@metalH" stroke="none" opacity="0.7"><circle cx="2.45" cy="6.2" r="0.16"/><circle cx="2.35" cy="10.1" r="0.16"/></g>
</g>`,
      back: `<g stroke="@metalO" stroke-width="0.55" stroke-linejoin="round">
<path d="M-5.4 -3.2 Q0 -7.6 5.4 -3.2 Q6.2 0.8 4.8 4.2 Q0 6.2 -4.8 4.2 Q-6.2 0.8 -5.4 -3.2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.75"/>
<path d="M-5.4 -3.2 Q0 -7.6 5.4 -3.2 Q6.2 0.8 4.8 4.2 Q0 6.2 -4.8 4.2 Q-6.2 0.8 -5.4 -3.2 Z" fill="@metalO" opacity="0.62" stroke="none"/>
<path d="M-5.1 -2.8 Q0 -6.9 5.1 -2.8 Q5.3 -1.7 5.25 -0.9 Q0 -5.1 -5.25 -0.9 Q-5.3 -1.7 -5.1 -2.8 Z" fill="@metalH" opacity="0.62" stroke="none"/>
<ellipse cx="-2.6" cy="-1.2" rx="1.5" ry="2.1" fill="@metalH" opacity="0.16" stroke="none" transform="rotate(-16 -2.6 -1.2)"/>
<path d="M-4.4 1.8 Q0 3.6 4.4 1.8" stroke="@cuir" stroke-width="1.2" fill="none" opacity="0.95"/>
<path d="M-4.4 2.4 Q0 4.2 4.4 2.4" stroke="@cuirO" stroke-width="0.45" fill="none" opacity="0.85"/>
<path d="M-4.8 4.2 Q0 6.2 4.8 4.2 L4.4 8.4 Q0 10.4 -4.4 8.4 Z" fill="url(#g_steelD)"/>
<path d="M-4.8 4.2 Q0 6.2 4.8 4.2 L4.4 8.4 Q0 10.4 -4.4 8.4 Z" fill="@metalO" opacity="0.52" stroke="none"/>
<path d="M-4.8 4.4 Q-2.4 5.5 -0.6 5.9" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.8"/>
<path d="M-4.4 8.4 Q0 10.4 4.4 8.4 L4.1 12.2 Q0 14.1 -4.1 12.2 Z" fill="url(#g_steelD)"/>
<path d="M-4.4 8.4 Q0 10.4 4.4 8.4 L4.1 12.2 Q0 14.1 -4.1 12.2 Z" fill="@metalO" opacity="0.66" stroke="none"/>
<path d="M-4.4 8.6 Q-2.2 9.6 -0.8 10" stroke="@metalH" stroke-width="0.36" fill="none" opacity="0.5"/>
<path d="M-4.1 12.2 Q0 14.1 4.1 12.2 L3.8 15.8 Q0 17.6 -3.8 15.8 Z" fill="url(#g_steelD)"/>
<path d="M-4.1 12.2 Q0 14.1 4.1 12.2 L3.8 15.8 Q0 17.6 -3.8 15.8 Z" fill="@metalO" opacity="0.54" stroke="none"/>
<path d="M-4.1 12.4 Q-2 13.4 -0.6 13.8" stroke="@metalH" stroke-width="0.44" fill="none" opacity="0.7"/>
<g fill="@metalO" stroke="none"><circle cx="-3.5" cy="6.6" r="0.4"/><circle cx="3.5" cy="6.6" r="0.4"/><circle cx="-3.3" cy="10.6" r="0.4"/><circle cx="3.3" cy="10.6" r="0.4"/></g>
<path d="M-3.8 15.6 Q0 14 3.8 15.6 Q4.6 18.2 3.6 20.4 Q0 22 -3.6 20.4 Q-4.6 18.2 -3.8 15.6 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>
<path d="M-3.8 15.6 Q0 14 3.8 15.6 Q4.6 18.2 3.6 20.4 Q0 22 -3.6 20.4 Q-4.6 18.2 -3.8 15.6 Z" fill="@metalO" opacity="0.58" stroke="none"/>
<path d="M-3.5 16.2 Q0 14.8 3.5 16.2 Q3.7 17 3.65 17.6 Q0 16.1 -3.65 17.6 Q-3.7 17 -3.5 16.2 Z" fill="@metalH" opacity="0.6" stroke="none"/>
<path d="M-3.6 20.2 Q0 21.8 3.6 20.2 L3.8 24.4 Q0 26.2 -3.8 24.4 Z" fill="url(#g_steelD)"/>
<path d="M-3.6 20.2 Q0 21.8 3.6 20.2 L3.8 24.4 Q0 26.2 -3.8 24.4 Z" fill="@metalO" opacity="0.46" stroke="none"/>
<path d="M-3.6 20.4 Q-1.8 21.3 -0.4 21.6" stroke="@metalH" stroke-width="0.42" fill="none" opacity="0.72"/>
<path d="M-3.8 24.2 Q0 26 3.8 24.2 L3.9 28.4 Q0 30.2 -3.9 28.4 Z" fill="url(#g_steelD)"/>
<path d="M-3.8 24.2 Q0 26 3.8 24.2 L3.9 28.4 Q0 30.2 -3.9 28.4 Z" fill="@metalO" opacity="0.62" stroke="none"/>
<path d="M-3.8 24.4 Q-1.9 25.3 -0.6 25.6" stroke="@metalH" stroke-width="0.3" fill="none" opacity="0.45"/>
<path d="M-3.9 28.2 Q0 30 3.9 28.2 L4.1 31.4 Q0 33.2 -4.1 31.4 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>
<path d="M-3.9 28.2 Q0 30 3.9 28.2 L4.1 31.4 Q0 33.2 -4.1 31.4 Z" fill="@metalO" opacity="0.56" stroke="none"/>
<path d="M-3.9 28.4 Q-2 29.3 -0.6 29.6" stroke="@metalH" stroke-width="0.38" fill="none" opacity="0.6"/>
</g>`,
    },
  },
  // Calques ASYMÉTRIQUES (canal RigOverlay, `parts/tenues/types.ts`) — un overlay n'est jamais
  // miroité et peut sortir du z de son os, ce qu'un slot ne sait pas faire. Deux emplois, chacun
  // parce qu'AUCUN slot ne pouvait le porter (la pelisse de FACE, elle, n'en a plus besoin :
  // réunie avec le crâne sur l'épaule DROITE — x NÉGATIF de face — elle vit dans le slot torse,
  // qui couvre déjà `epauleG` z=4 ; même raison pour la cape de DOS à x négatif) :
  //  1. crâne + monticule de pelisse de DOS : de dos les côtés s'inversent (l'épaule DROITE du
  //     personnage revient à x POSITIF), or x positif = `epauleD` z=8, DEVANT le torse. Un crâne
  //     dessiné sur la part de torse y était donc mangé par le bras — vérifié au rendu. Le
  //     monticule (#644 it3) RELIE la cape du slot au crâne : une seule dépouille, jamais un
  //     crâne posé sur l'acier du bras.
  //  2. crâne de PROFIL sur `torse`, plan `avant` : porté par l'épaule DROITE, soit la far-shoulder
  //     de ce profil (qui regarde le chevalier par sa gauche). Calé DERRIÈRE la nuque (x < -6.8,
  //     là où s'arrête la chevelure), descendu au NIVEAU DE L'ÉPAULE (#644 it3, translate +6.5 :
  //     même hauteur que face et dos — le juge-vision a réfuté l'ancrage « à hauteur de tempe ») ;
  //     il émerge de derrière l'épaule, posé sur la pelisse. Le plan `avant` est le seul
  //     possible : au plan `fond`, la masse de fourrure du torse (z=5) l'occulte INTÉGRALEMENT
  //     (idiome ANCRAGE).
  overlays: [
    {
      // Crâne + monticule de DOS. Repère LOCAL de epauleD = torse · T(14,-26) · R(-8°)
      // (`skeletons.ts`) → l'art, écrit en repère TORSE comme le reste de la tenue, se recale par
      // l'INVERSE : rotate(8) puis translate(-14,26). Exact tant que l'échelle de l'os est
      // uniforme. Plus aucun acier rapporté (#644 it1 : lamelles orphelines + rondelle retirées —
      // la spallière réelle vit au slot `bras`) : l'ancrage est l'ombre @poilO portée sous le
      // crâne, dans le monticule (idiome ANCRAGE).
      bone: 'epauleD',
      view: 'back',
      plane: 'avant',
      svg: `<g transform="rotate(8) translate(-14,26)">
<path d="M8.2 -33.2 Q11.5 -34.3 14.6 -33.7 Q18.2 -32.9 20.6 -30.7 Q22.4 -28.9 23.1 -26.6 Q23.4 -25.8 23.4 -25 Q23.6 -22.2 23.9 -19.6 Q23 -22.4 22.2 -23.1 Q21.8 -20.9 21.1 -18.9 Q20.9 -20.8 20.2 -21.4 Q18.9 -20.3 17.6 -20.7 Q17.2 -19.2 16.5 -18.1 Q16.2 -19.9 15.5 -20.8 Q13.9 -20.2 12.4 -20.5 Q12 -19 11.2 -18 Q10.9 -19.8 10.2 -20.7 Q9.1 -20.9 8.4 -21.6 Q7.5 -24.5 7.5 -27.8 Q7.6 -31.2 8.2 -33.2 Z" fill="@fourrure" stroke="@poilO" stroke-width="0.4" stroke-linejoin="round"/>
<clipPath id="wwfur-epD"><path d="M8.2 -33.2 Q11.5 -34.3 14.6 -33.7 Q18.2 -32.9 20.6 -30.7 Q22.4 -28.9 23.1 -26.6 Q23.4 -25.8 23.4 -25 Q23.6 -22.2 23.9 -19.6 Q23 -22.4 22.2 -23.1 Q21.8 -20.9 21.1 -18.9 Q20.9 -20.8 20.2 -21.4 Q18.9 -20.3 17.6 -20.7 Q17.2 -19.2 16.5 -18.1 Q16.2 -19.9 15.5 -20.8 Q13.9 -20.2 12.4 -20.5 Q12 -19 11.2 -18 Q10.9 -19.8 10.2 -20.7 Q9.1 -20.9 8.4 -21.6 Q7.5 -24.5 7.5 -27.8 Q7.6 -31.2 8.2 -33.2 Z"/></clipPath>
<g clip-path="url(#wwfur-epD)">
<path d="M7 -25.2 L10.5 -25.9 L13.5 -24.9 L16.5 -25.7 L19.5 -24.8 L22.3 -25.7 L24 -24.9 L24.6 -16.4 L6.8 -16.4 Z" fill="@fourrureO" opacity="0.58" stroke="none"/>
<path d="M8 -27.2 Q7.8 -25 8.3 -22.6 L9.2 -22.4 Q8.7 -25 8.9 -27.3 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M9.8 -27.6 Q9.6 -25.2 10 -22.6" stroke="@fourrureH" stroke-width="0.3" opacity="0.5" fill="none"/>
<path d="M14.2 -24.6 Q14 -23 14.3 -21.3 L15.2 -21.2 Q14.9 -23 15.1 -24.4 Z" fill="@fourrureO" opacity="0.22" stroke="none"/>
<path d="M16 -24.2 Q15.8 -22.8 16.1 -21.2" stroke="@fourrureH" stroke-width="0.3" opacity="0.5" fill="none"/>
<path d="M8.8 -30.4 Q12.2 -31.4 15.4 -30.7 Q18.2 -30 20 -28.2" stroke="@fourrureO" stroke-width="1.6" opacity="0.35" fill="none"/>
<g stroke="@poilO" fill="none" opacity="0.42" stroke-linecap="round">
<path d="M12.2 -24.9 Q12.1 -24.1 12.3 -23.3" stroke-width="0.28"/>
<path d="M17.8 -24.2 Q17.7 -23.5 17.9 -22.8" stroke-width="0.25"/>
<path d="M20.6 -23.6 Q20.5 -22.9 20.7 -22.2" stroke-width="0.22"/>
</g>
<path d="M8.2 -33.2 Q11.5 -34.3 14.6 -33.7 Q18.2 -32.9 20.6 -30.7 Q22.4 -28.9 23.1 -26.6" stroke="@fourrureH" stroke-width="3" opacity="1" fill="none"/>
</g>
<ellipse cx="15.6" cy="-20.6" rx="5.6" ry="2.1" fill="@poilO" opacity="0.38" stroke="none" transform="rotate(14 15.6 -20.6)"/>
<ellipse cx="14.8" cy="-21" rx="4" ry="1.4" fill="@poilO" opacity="0.55" stroke="none" transform="rotate(14 14.8 -21)"/>
<path d="M21.8 -28.6 Q23.2 -31.8 20.9 -33.9 Q18.4 -35.6 15.8 -34.2 Q14.2 -33.3 13.7 -31.6 L10.9 -24.2 Q10.2 -22.6 10.8 -21.6 L12.9 -20.9 L13.5 -22.1 Q15.3 -21.8 16.5 -23.2 Q19.3 -24.2 20.8 -26.2 Q21.6 -27.3 21.8 -28.6 Z" fill="@poilO" stroke="@poilO" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M21.8 -28.6 Q23.2 -31.8 20.9 -33.9 Q18.4 -35.6 15.8 -34.2 Q14.2 -33.3 13.7 -31.6 L10.9 -24.2 Q10.2 -22.6 10.8 -21.6 L12.9 -20.9 L13.5 -22.1 Q15.3 -21.8 16.5 -23.2 Q19.3 -24.2 20.8 -26.2 Q21.6 -27.3 21.8 -28.6 Z" fill="@os" stroke="@poilO" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M15.8 -34.2 Q14.3 -33.2 13.9 -31.7 L11.1 -24.4" fill="none" stroke="@osH" stroke-width="1.2" opacity="0.85"/>
<path d="M20.9 -33.9 Q22.6 -31.2 21.4 -28.4 Q20.4 -26.4 18.4 -25.2" fill="none" stroke="@osO" stroke-width="0.65" opacity="0.5"/>
<path d="M13.6 -31.2 Q14.9 -31.9 16.5 -31.1" fill="none" stroke="@osH" stroke-width="0.42" opacity="0.65"/>
<path d="M14.8 -28.7 L11.7 -22.8 L12.7 -22.1 L15.7 -27.9 Z" fill="@osO" opacity="0.35" stroke="none"/>
<path d="M14.8 -28.7 L11.7 -22.8" fill="none" stroke="@osO" stroke-width="0.75" opacity="0.85"/>
<ellipse cx="15.1" cy="-29.9" rx="2.05" ry="1.6" fill="@orbite" stroke="@poilO" stroke-width="0.5" transform="rotate(-25 15.1 -29.9)"/>
<ellipse cx="15" cy="-29.8" rx="1.3" ry="1" fill="@poilO" opacity="0.9" stroke="none" transform="rotate(-25 15 -29.8)"/>
<path d="M16.4 -28.7 Q18.2 -27.6 19.9 -27.9" fill="none" stroke="@osO" stroke-width="0.45" opacity="0.5"/>
<ellipse cx="19.2" cy="-28.6" rx="1.5" ry="2.4" fill="@osO" opacity="0.24" stroke="none" transform="rotate(18 19.2 -28.6)"/>
<ellipse cx="11" cy="-22.6" rx="0.9" ry="0.6" fill="@orbite" opacity="0.95" stroke="none" transform="rotate(-55 11 -22.6)"/>
<path d="M11.5 -21.2 Q13.6 -21.9 15.9 -22.4" fill="none" stroke="@osO" stroke-width="0.5" opacity="0.8"/>
<path d="M11.6 -21.3 L12.5 -18.9 L13.2 -21.2 Z" fill="@osH" stroke="@poilO" stroke-width="0.24" stroke-linejoin="round"/>
<g fill="@os" stroke="@poilO" stroke-width="0.24" stroke-linejoin="round">
<path d="M13.5 -21.8 L14 -20.5 L14.6 -21.8 Z"/>
<path d="M15 -22.4 L15.4 -21.2 L16 -22.5 Z"/>
</g>
</g>`,
    },
    {
      bone: 'torse',
      view: 'profile',
      plane: 'avant',
      svg: `<g transform="translate(0,6.5) rotate(-8 -12 -36)">
<ellipse cx="-13.2" cy="-27.6" rx="5" ry="1.9" fill="@poilO" opacity="0.38" stroke="none" transform="rotate(-10 -13.2 -27.6)"/>
<ellipse cx="-13.8" cy="-28" rx="3.6" ry="1.25" fill="@poilO" opacity="0.55" stroke="none" transform="rotate(-10 -13.8 -28)"/>
<path d="M-7.2 -36.8 Q-6.8 -40.4 -9.6 -42.2 Q-12.6 -43.8 -15.2 -42.2 Q-16.6 -41.2 -16.9 -39.5 L-20.7 -33.9 Q-21.5 -32.6 -20.7 -31.8 L-18.3 -31.2 L-17.8 -32.5 Q-15.9 -32 -14.5 -33.2 Q-11.4 -33.4 -9.3 -34.6 Q-7.5 -35.5 -7.2 -36.8 Z" fill="@poilO" stroke="@poilO" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M-7.2 -36.8 Q-6.8 -40.4 -9.6 -42.2 Q-12.6 -43.8 -15.2 -42.2 Q-16.6 -41.2 -16.9 -39.5 L-20.7 -33.9 Q-21.5 -32.6 -20.7 -31.8 L-18.3 -31.2 L-17.8 -32.5 Q-15.9 -32 -14.5 -33.2 Q-11.4 -33.4 -9.3 -34.6 Q-7.5 -35.5 -7.2 -36.8 Z" fill="@os" stroke="@poilO" stroke-width="0.9" stroke-linejoin="round"/>
<path d="M-15.2 -42.2 Q-16.5 -41.1 -16.8 -39.6 L-20.5 -34.1" fill="none" stroke="@osH" stroke-width="1.15" opacity="0.85"/>
<path d="M-9.6 -42.2 Q-7.4 -40 -7.7 -37.2 Q-8 -35.3 -9.6 -34.5" fill="none" stroke="@osO" stroke-width="0.6" opacity="0.5"/>
<path d="M-17 -39.3 Q-15.8 -39.9 -14.3 -39.1" fill="none" stroke="@osH" stroke-width="0.42" opacity="0.65"/>
<ellipse cx="-15.4" cy="-37.9" rx="1.55" ry="1.2" fill="@orbite" stroke="@poilO" stroke-width="0.3" transform="rotate(30 -15.4 -37.9)"/>
<path d="M-14.1 -36.3 Q-12 -35.3 -10.1 -35.8" fill="none" stroke="@osO" stroke-width="0.45" opacity="0.5"/>
<ellipse cx="-9.9" cy="-36.6" rx="1.4" ry="2.2" fill="@osO" opacity="0.24" stroke="none" transform="rotate(-16 -9.9 -36.6)"/>
<ellipse cx="-20.4" cy="-32.6" rx="0.5" ry="0.36" fill="@osO" opacity="0.6" stroke="none" transform="rotate(55 -20.4 -32.6)"/>
<path d="M-17.9 -31.8 L-17.3 -30.2 L-16.8 -31.9 Z" fill="@osH" stroke="@poilO" stroke-width="0.2" stroke-linejoin="round"/>
<g fill="@os" stroke="@poilO" stroke-width="0.2" stroke-linejoin="round">
<path d="M-16.3 -32.3 L-15.9 -31.3 L-15.4 -32.4 Z"/>
<path d="M-15 -32.9 L-14.7 -31.9 L-14.3 -33 Z"/>
</g>
</g>`,
    },
  ],
};
