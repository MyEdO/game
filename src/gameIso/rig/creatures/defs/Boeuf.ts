import type { CreatureDef } from '../types';
import type { QuadProps } from '../../quadruped/quadSkeleton';
import { artLine, quadInterfaces, recouvrementContracte, type QuadArtLine } from '../../quadruped/quadInterfaces';

/** Mémorise un art construit à la PREMIÈRE demande (cf. la lecture paresseuse des lignes). */
const memo = (f: () => string): (() => string) => { let v: string | null = null; return () => (v ??= f()); };

// Bœuf (EDOC 7 l.54, créature #611) — BÊTE DE TRAIT : masse basse et lourde portée sur des
// pattes-poteaux courtes, encolure COURTE et épaisse fondue dans un garrot bossu, tête large au
// mufle CARRÉ, fanon pendant, et surtout des CORNES en lyre largement écartées — l'identifiant
// n°1 à la vignette. Morphologie explicitement ≠ équine (ticket #630) : build 'ursine' (barillet
// profond, bosse d'épaule, arrière lourd) sur sabots, là où le Cheval est 'equine' haut sur
// pattes à longue encolure — les deux silhouettes se séparent à 40 px par la masse, le cou,
// la coiffe et la ligne de dos.
//
// LA TÊTE EST UNE PART (#1082 P1b) : `head: 'boeuf'` → `quadruped/heads/defs/boeuf.ts`, qui porte
// crâne / oreilles / cornes / mufle en FRAGMENTS et leur ordre du peintre (les cornes s'insèrent
// entre crâne et oreilles sur les trois vues), plus la largeur de masse vue de bout (`bodyWidth`
// 22/26 — le poitrail et la croupe de l'équin étaient trop étroits pour une bête de trait). Ce
// fichier ne décore donc plus l'os `tete` : il ne garde que ce qui appartient à la BÊTE, pas à sa
// tête — fanon d'encolure et modelé du tronc. Le slot natif `headgear: 'cornes'` reste NON posé
// (deux crochets de chèvre montant droit, ~16 u d'envergure : ce n'est pas la lyre bovine, et les
// deux coiffes se superposeraient).
//
// VOLUME : les ombres se construisent au jeton QUASI NOIR `@corpsO` (#140c06) posé à l'OPACITÉ,
// jamais par une teinte dérivée claire — le recoloriage joueur (#632) redérive la famille depuis
// la base choisie et les creux survivent. Les surfaces éclairées sont de vraies PLAGES `@corpsH`
// qui SUIVENT le contour (ligne de dos, épaule, croupe), jamais des dalles à bord droit : sans
// surface éclairée un écart de luminance ne prouve rien (ancrage du contrat d'art #635), et une
// dalle rectangulaire lit « patch collé » (verdict de la ronde 1). Sur cette robe, la mi-distance
// base↔lumière vaut L≈45,9 (`@corps` L≈29,3, `@corpsH` L≈62,5) : une plage à 0,5 la FRÔLE — toute
// surface qui doit COMPTER comme éclairée est posée à ≥ 0,6. Les hachures sont GROUPÉES et
// COURTES dans le sens du poil (épaule, flanc, cuisse), jamais semées.
//
// PLANS : chaque fragment de `deco` déclare son `plan` RELATIF au plan de son os (#1082 Lot 2).
// Ici tous valent 0 : ce sont des calques de MODELÉ, peints avec l'art de leur os, dans l'ordre
// d'apposition — ils ne s'intercalent devant/derrière aucun autre os.
// GABARIT de la bête — déclaré AVANT l'art, parce que l'art en dépend : les lignes d'interface
// ci-dessous sont des FONCTIONS de ces scalaires, lues sur le squelette réel (`quadInterfaces`).
const QUAD: QuadProps = {
  sl: 1.06,
  build: 'bovin', // garrot bossu, creux de rein, croupe haute et charnue, ventre plein (quadParts)
  // ENCOLURE : courte (0,42) mais portée en AVANT — l'angle stocké négatif est penché de +40° par
  // le socle, ce qui sort la tête DEVANT le poitrail au lieu de la poser SUR le garrot (« moignon
  // soudé »). L'angle est ignoré de face/dos (`quadSkeletonForView` y refige 0) : ces deux vues
  // restent au pixel près celles de l'étalon, ce que `neckLen` — lu par les trois vues — aurait
  // déplacé.
  girth: 1.2, bodyLen: 1.04, neckLen: 0.42, neckAngle: -40, legLen: 0.8,
  // POSTURE de repos, PROFIL seulement (`quadSkeletonForView` refige les angles de face/dos, donc
  // ces deltas n'y entrent pas) : une bête de trait au repos est d'APLOMB. Le socle donne à tout
  // quadrupède un arrière angulé (cuisse en avant, jarret cassé) — juste pour un canidé, mais le
  // bœuf y « fléchissait du postérieur », et l'antérieur penché portait le pied sous la gorge.
  // Les deltas redressent les quatre membres sans toucher au socle.
  stance: {
    hautAvD: 1, basAvD: -6, piedAvD: 5, hautAvG: -3, basAvG: -4, piedAvG: 4,
    hautArD: 5, basArD: -9, piedArD: 4, hautArG: 4, basArG: -8, piedArG: 4,
  },
  head: 'boeuf', headScale: 1.2, tail: 'touffe-basse', tailLen: 1.05, mane: 'sans',
  ears: 'courtes', foot: 'sabot',
  stored: {
    corps: '#6b4526', corpsO: '#140c06', corpsH: '#c99a5c', // robe brune, ombre QUASI NOIRE, lumière franche
    cheveux: '#33210f', cheveuxO: '#0f0904', // touffe de queue + toupet frontal sombres
    cuir: '#241a12', // sabots
    corne: '#cfc0a0', corneO: '#2a2013', corneH: '#efe6cd', // corne crème à pointe sombre
  },
};
// Les coordonnées du décor de TRONC s'écrivent dans le repère de l'OS, comme les lignes
// d'interface : plus aucun facteur `bodyLen` recopié à la main dans l'art (`barrel()` cuit déjà
// l'étirement dans le sien, et une part qui le re-multipliait vivait à une autre unité que sa
// propre ligne d'épaule).
const U = (n: number): string => n.toFixed(1);

// ── LIGNES D'ART (contrat d'emboîtement, #1082 B1) ────────────────────────────────────────────
// Une ligne d'ART n'est pas une articulation : c'est un repère de DESSIN, déclaré en décalage
// explicite depuis un pivot du squelette (`artLine`), dans le repère de l'os qui possède ce pivot.
// Ce qui est littéral ici, c'est le DÉCALAGE de l'artiste ; le point d'appui, lui, suit le
// squelette — changez `neckLen` ou `legLen` et les trois lignes suivent, sans retoucher un chiffre.
//
// LECTURE PARESSEUSE, et c'est structurel : `quadSkeleton` ré-exporte le registre des espèces
// (`QUAD_SPECIES`), donc lire une interface depuis une DEF D'ESPÈCE au chargement du module
// refermerait le cercle registre → def → interfaces → squelette → registre. Les lignes sont donc
// calculées à la PREMIÈRE demande d'art, quand tous les modules sont debout, et mémorisées.
interface LignesBoeuf { ganache: QuadArtLine; garrot: QuadArtLine; areteOmoplate: QuadArtLine }
let _lignes: LignesBoeuf | null = null;
const lignes = (): LignesBoeuf => {
  if (_lignes) return _lignes;
  const I = quadInterfaces(QUAD, 'profile');
  return (_lignes = {
    // GANACHE (repère de l'ENCOLURE) — la hauteur, sur le cou, où la tête vient poser sa ganache.
    // Au-dessus, la tête recouvre (plan 9 contre 8) et tout ce qu'on y peindrait est perdu : c'est
    // donc là que naît la crête éclairée du cou, et là que le fanon se suspend.
    ganache: artLine(I.garrot, 7, -11.4),
    // GARROT (repère de l'ENCOLURE) — le pivot lui-même, plus le RECOUVREMENT CONTRACTÉ que le
    // module déduit de l'épaisseur d'encolure (2,9 u sur cette bête, cible 3 u du juge de design).
    // En dessous de cette ligne, l'encolure n'a plus le droit à une LIGNE : seulement à de la robe,
    // le temps de mordre sur le tonneau. C'est ce qui interdit à son contour de courir en travers
    // de l'épaule.
    garrot: artLine(I.garrot, 0, recouvrementContracte(I.garrot)),
    // ARÊTE D'OMOPLATE (repère du TRONC) — l'arête de FORME de l'avant-main : la crête de
    // l'omoplate, un peu au-dessus et en arrière du pivot d'épaule. C'est la ligne où le plan
    // éclairé de l'épaule et le plan d'ombre du flanc se RENCONTRENT ; aucun ne la franchit.
    areteOmoplate: artLine(I.epaule, -8, -16),
  });
};

// ── FANON (encolure, PROFIL) ──────────────────────────────────────────────────────────────────
// L = 30 × neckLen = 12,6 : encolure COURTE. Le fanon pend de la gorge au poitrail en festons
// larges — le tell bovin de profil. L'os encolure n'a d'art qu'en profil : les vues de bout
// retombent proprement sur le nu (le fanon de face vit dans le deco de tronc).
// L'os porte DEUX natures d'art et elles ne se transforment pas pareil (cf. commentaires en place).
const FANON = memo(() =>
  `<g data-deco="fanon">` +
  // SOUS LA LIGNE DE GARROT, PAS DE LIGNE. Le socle (`quadParts.neck`) fait plonger la base de
  // l'encolure profondément dans le corps et trace, sur tout son pourtour bas, la crête et le pli
  // de gorge. L'encolure étant peinte APRÈS le tronc (plan 6 > 5), ces traits couraient en
  // DIAGONALE en travers de l'épaule : une balafre claire-sombre au milieu du dos. Cette robe
  // pleine part de la ligne de GARROT — le recouvrement contracté, la profondeur exacte à laquelle
  // cou a le droit de mordre sur le tonneau — et les éteint en dessous. Ce n'est pas une pièce de
  // raccord posée entre deux voisins : c'est l'encolure qui va CHERCHER sa ligne, dans son repère.
  `<path d="M-13.4 ${U(lignes().garrot.y)} Q-15.4 9 -15 20 L15 20 Q13.4 9 12.4 ${U(lignes().garrot.y)} ` +
  `Q0 6.4 -13.4 ${U(lignes().garrot.y)} Z" fill="@corps"/>` +
  // CE QUI APPARTIENT À L'OS suit l'os : crête d'encolure éclairée (dessus du cou, côté −x) et
  // hachures du sens du poil. La crête NAÎT à la ganache — au-dessus, la tête recouvre le cou et
  // tout ce qui y serait peint est perdu — et meurt bien avant le garrot : prolongée, elle
  // traversait l'épaule en diagonale (COURROIE DE HARNAIS), et même écourtée elle dépassait du
  // crâne en CROCHET clair (deux lectures d'image successives).
  `<path d="M-8.2 ${U(lignes().ganache.y)} Q-9.8 -8.4 -10.4 -4.4" fill="none" stroke="@corpsH" stroke-width="2.2" opacity="0.62" stroke-linecap="round"/>` +
  `<path d="M-5.6 -8.4 q1.8 2.2 1.6 5 M-2.8 -9.6 q1.8 2.4 1.6 5.2 M0 -10 q1.6 2.2 1.4 4.8" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.32" stroke-linecap="round"/>` + // hachures groupées (sens du poil)
  // CE QUI PEND ne suit pas l'os : le `rotate(-32)` dé-tourne le fanon du surcroît de pente de
  // l'encolure (−8° → −40° stockés, soit +8° → +40° au monde) — un fanon PEND sous la gorge. Sans
  // cette contre-rotation la nappe part en biais vers l'avant et referme la gorge en COLLIER.
  // Il se SUSPEND à la ganache : c'est de là que la peau du bovin décroche, jamais du haut du cou.
  `<g transform="rotate(-32)">` +
  `<path d="M${U(lignes().ganache.x + 1.8)} ${U(lignes().ganache.y - 1)} Q13.6 -9.6 14.2 -4 Q17.8 -1.4 16.6 2.2 Q20.2 4.6 18.4 8.4 Q21 11.4 18.6 15.2 Q13.6 19.4 8 16.6 Q7.2 3.4 ${U(lignes().ganache.x + 1)} ${U(lignes().ganache.y + 0.4)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
  `<path d="M10.4 -9.6 Q11.2 2.4 11.6 13.8" fill="none" stroke="@corpsO" stroke-width="1.6" opacity="0.5"/>` + // creux du pli
  `<path d="M13.6 -6.6 Q15.4 2.4 16 11.4" fill="none" stroke="@corpsH" stroke-width="2.2" opacity="0.72" stroke-linecap="round"/>` + // arête éclairée du fanon
  `</g>` +
  `</g>`);

// ── TRONC ─────────────────────────────────────────────────────────────────────────────────────
// PROFIL — LE CORPS EST FAIT DE PLANS, PAS D'ACCENTS. La CARRURE (`quadParts.barrel`) donne la
// silhouette, la lentille de dos et la nappe ventrale ; ce calque pose les GRANDES SURFACES qui
// font tourner le reste du tonneau. La règle qui les gouverne, apprise du dos — la seule zone que
// l'utilisateur n'a jamais rejetée : un plan CLAIR large, un plan d'OMBRE large, et c'est leur
// RENCONTRE sur une arête de forme qui fait le volume. Un accent (croissant, lèvre, hachure) posé
// sur une plage uniforme la décore ; il ne la fait pas tourner.
// Deux arêtes de forme portent le profil bovin, et une seule est déclarée en repère de squelette :
//  · l'ARÊTE D'OMOPLATE (`lignes().areteOmoplate`, dérivée du pivot d'épaule) sépare l'avant-main
//    éclairée du creux post-scapulaire. Aucun des deux plans ne la franchit, et ils laissent entre
//    eux une bande de robe de BASE de ~4,5 u : le mi-ton du cylindre, qui interdit à la transition
//    de redevenir une plaque ;
//  · la LIGNE DE CÔTE, oblique, qui descend du dos vers le coude — c'est elle qui donne au flanc
//    ses deux valeurs. Elle n'est pas une articulation et ne s'appuie sur aucun pivot : c'est un
//    trait d'anatomie assumé, écrit dans le repère du tronc.
// La nappe ventrale de la carrure et le plan d'épaule PARTAGENT leur bord au passage du coude : ils
// se rencontrent, ils ne se superposent pas — deux taches voisines de même valeur font une
// salissure, deux plans qui se touchent font un volume.

// RAMPE DE FLANC — le dégradé du cylindre, peint à l'aplat. Une seule LIGNE DE FLANC (la même
// courbe que la lentille de dos, en plus tendue), descendue d'une passe à l'autre ; chaque passe
// couvre TOUT ce qui est en dessous d'elle jusqu'au ventre (ou tout ce qui est au-dessus jusqu'au
// dos, pour les passes claires). Les recouvrements s'additionnent : la valeur descend alors d'un
// cran à chaque ligne franchie, sans jamais former de palier — c'est la seule façon d'obtenir un
// vrai dégradé quand la matière est un jeton et l'opacité le seul outil.
// Le PAS (3,5 u) et le NOMBRE de passes sont la donnée du dégradé, pas un accident : c'est le pas
// qui fixe la pente (0,2 d'opacité par cran ≈ 1,4 pt de luminance par unité).
// Quatre autres écritures ont été essayées puis écartées, mesure de platitude locale à l'appui
// (fenêtre 11 u, seuil 12 pts, masque `tronc` de profil, harnais `scripts/qc/mesure-volume.mts`) :
//  · des voiles à 0,16-0,2 ne déplacent la valeur que de 4 à 7 pts — sous le seuil, donc la MÊME
//    surface pour la mesure comme pour l'œil : 373 fenêtres plates, le gros amas intact ;
//  · trois bandes franches à 0,45/0,5 cassent la plaque (180 fenêtres) mais la bête porte une
//    CEINTURE — des valeurs empilées à bords parallèles se lisent en rayures sur un tube ;
//  · les mêmes bandes adoucies en opacité ramènent la plaque (311 fenêtres) : la douceur d'un
//    dégradé tient à son PAS, jamais à l'affaiblissement de ses valeurs ;
//  · des LENTILLES (fermées aux deux bords) empilées donnent une belle bête mais un PALIER : là où
//    toutes se recouvrent, la valeur ne bouge plus (330 fenêtres, amas de 284 sous le ventre).
/** Une LENTILLE de flanc (pointue aux deux bouts) : `dy` la descend, `e` l'épaissit. */
const lentilleFlanc = (dy: number, e: number, teinte: string, op: number): string =>
  `<path d="M${U(-41.4 - e * 0.4)} ${U(-7.4 + dy)} Q-30 ${U(-16.4 + dy - e)} -12 ${U(-17.6 + dy - e)} ` +
  `Q1 ${U(-18.2 + dy - e)} ${U(13.4 + e * 0.3)} ${U(-20 + dy - e)} ` +
  `Q5 ${U(-12.6 + dy + e)} -8 ${U(-9.4 + dy + e)} Q-24 ${U(-5.6 + dy + e)} -35 ${U(-4.6 + dy + e)} ` +
  `Q-40 ${U(-4.4 + dy + e)} ${U(-41.4 - e * 0.4)} ${U(-7.4 + dy)} Z" fill="${teinte}" opacity="${op}"/>`;
const RAMPE_FLANC =
  // PLAN DE CÔTE — la dernière surface du flanc qui regarde encore la lumière, sous la seconde
  // passe de la lentille de dos. Passe feutrée d'abord, cœur ensuite.
  lentilleFlanc(0, 1.6, '@corpsH', 0.18) + lentilleFlanc(0, 0, '@corpsH', 0.45) +
  // OMBRE DE BARILLET — le tonneau qui fuit vers le sol, même traitement.
  lentilleFlanc(15, 2, '@corpsO', 0.2) + lentilleFlanc(15, 0, '@corpsO', 0.5) +
  // REFLET DE SOL — le ventre d'un bovin n'est pas un trou noir : il reçoit le rebond du sol, et
  // cette bande claire posée SUR la nappe ventrale est ce qui décolle la bête de son ombre.
  lentilleFlanc(31, 0, '@corpsH', 0.34) +
  // ANGLE MORT ASSUMÉ — il reste au VENTRE un amas de 85 fenêtres plates (seuil de sortie : 40).
  // Une bande oblique qui traverse le flanc le casse (24 fenêtres) : c'est mesuré, et c'est aussi
  // ce qui a été REGARDÉ puis refusé. Écrite en clair, elle croise la bande d'ombre du barillet et
  // le bas du corps se lit en VITRES superposées ; écrite en ombre, elle se fond dans le ventre et
  // la platitude remonte à 115. Sur un ventre de 23 u de creux, la seule valeur qui casserait
  // l'amas sans croiser la rampe serait un troisième plan à ≥ 12 pts, et il n'y a plus de place
  // pour lui entre la nappe ventrale et le reflet de sol. Le geste s'arrête ici et le dit : c'est
  // le tripwire T1 du juge de design (#1082), donc un procès du modèle d'assemblage, pas un
  // pinceau de plus.
  // LES DEUX ATTACHES DE MEMBRE — là où le bras et la cuisse quittent le tonneau, le corps se
  // creuse. Ce sont les seules ombres VERTICALES du flanc, et elles ferment le plan d'épaule et la
  // cuisse par le bas comme le creux post-scapulaire les ferme par l'arrière.
  `<path d="M13.4 4.4 Q18 12.4 17.8 21.4 Q13 22.6 11 17.4 Q9.8 11.4 11 4.4 Z" fill="@corpsO" opacity="0.42"/>` + // derrière l'olécrane
  `<path d="M-23.4 2.4 Q-19.4 10.4 -20.4 20.4 Q-25.4 21.6 -27.4 15.4 Q-28.4 8.4 -27 2.4 Z" fill="@corpsO" opacity="0.4"/>`; // devant le grasset
const TRONC_PROFIL = memo(() =>
  `<g data-deco="dos">` +
  // 1. PLAN ÉCLAIRÉ DE L'AVANT-MAIN — omoplate, bras et poitrail en UNE seule surface, de la bosse
  // de garrot jusque sur le coude, arrêtée en arrière par l'arête d'omoplate. Le « bombé du
  // poitrail » y est fondu : deux nappes claires voisines faisaient un raccord de plus, jamais un
  // volume de plus.
  `<path d="M13.6 -23.4 Q${U(lignes().areteOmoplate.x)} ${U(lignes().areteOmoplate.y)} 21.4 12.4 Q23.6 22.4 26.6 26.4 ` +
  `Q31.4 24.4 32.8 15.4 Q34 2 32.4 -10.4 Q30 -20.4 24 -24.4 Q18 -25.8 13.6 -23.4 Z" fill="@corpsH" opacity="0.6"/>` +
  // 2. CREUX POST-SCAPULAIRE — le plan d'ombre qui répond au précédent, DERRIÈRE l'arête, en deux
  // passes : une large et feutrée, puis une resserrée contre l'arête. Le patron de la lentille de
  // dos, retourné en ombre.
  `<path d="M8.4 -21.4 Q10.4 -6 15.2 12.4 Q13 18.4 8.4 18.4 Q4 12.4 3.4 -3.4 Q3.6 -14.4 8.4 -21.4 Z" fill="@corpsO" opacity="0.18"/>` +
  `<path d="M9.6 -19.4 Q11.6 -6 15.6 11.4 Q14.4 15.4 11.8 15.4 Q8.4 9.4 7.6 -3.4 Q7.8 -13.4 9.6 -19.4 Z" fill="@corpsO" opacity="0.26"/>` +
  // 3. LE FLANC EST UN CYLINDRE : ce qu'il lui faut n'est pas une bande, c'est un DÉGRADÉ — cf.
  // `RAMPE_FLANC` ci-dessus, qui porte la mesure des quatre écritures écartées.
  RAMPE_FLANC +
  // 4. CREUX DU FLANC — la fosse devant la hanche, le seul creux VRAIMENT local du profil bovin.
  // Il mord sur le plan de côte : deux ombres qui se recouvrent font une profondeur, deux ombres
  // côte à côte font des griffures (défaut nommé aux hachures de flanc, ronde 3).
  `<path d="M-24.4 -14.4 Q-28.4 -4.4 -26.4 8.4 Q-30.4 4.4 -31.4 -4.4 Q-30.4 -12.4 -24.4 -14.4 Z" fill="@corpsO" opacity="0.34"/>` +
  // 5. HANCHE ÉCLAIRÉE — la lumière SUIT le rond de la croupe et s'éteint en pointes aux deux
  // bouts. L'ellipse qui tenait ce rôle lisait, au gros plan, comme un ŒUF beige posé sur la
  // croupe : une ellipse pure n'a aucun bord commun avec l'anatomie, donc aucun plan. Elle s'arrête
  // AVANT la ligne de dos (pointe haute à y = −15) : poussée jusqu'au contour, elle y faisait un
  // BEC clair.
  `<path d="M-30.6 -15 Q-39.9 -12.4 -43.1 -1.4 Q-42.6 7.4 -39.1 13.4 ` +
  `Q-38.1 4.4 -36.8 -2.6 Q-35 -10.4 -30.6 -15 Z" fill="@corpsH" opacity="0.62"/>` +
  // GARROT : AUCUN calque ici. La bosse est déjà dite par la CARRURE — le contour la porte et la
  // lentille de dos y monte. Un dôme clair de plus, posé en travers de cette lentille, ne se lisait
  // pas comme un relief mais comme une TRAÎNÉE diagonale sur la robe (deux lectures d'image
  // successives). Idem pour l'ombre de rein qui l'accompagnait.
  // Les deux PLIS qui disent le poids : l'aine et l'arrière du coude. Ce sont les seuls accents du
  // profil, et ils arrivent APRÈS les plans — jamais à leur place.
  `<path d="M-20.4 3 Q-17.9 9.4 -19.8 14.4" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.45" stroke-linecap="round"/>` + // pli de l'aine
  `<path d="M15 9.4 Q17.1 13.4 16 17.4" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.42" stroke-linecap="round"/>` + // pli d'arrière-coude
  // Le PROFIL ne porte AUCUNE hachure : posées sur la cuisse, les trois traits groupés lisaient
  // « griffures sur un bandeau » à la lecture d'image (rondes 3 et 4) — sur un flanc de 78 u de
  // long vu à 40 px, seule la VALEUR dit le poil. Les hachures restent là où elles décrivent une
  // vraie arête serrée : la joue de la tête, le fanon, les vues de bout.
  `</g>`);

// FACE : le poitrail est désormais LARGE au socle (`bodyWidth.front = 22`, déclaré par la def de
// tête) — ce calque ne le REDESSINE plus, il le MODÈLE : ligne d'épaule éclairée qui suit le haut
// de la masse, sternum bombé, flancs enroulés dans l'ombre profonde, et le FANON pendant sous la
// gorge (le tell bovin de face, LARGE et COURT à festons ronds — étroit, long et à pointes il
// lisait « barbe/gland » pendu au menton, ronde 2).
const TRONC_FACE =
  `<g data-deco="poitrail">` +
  `<path d="M-13.6 -25.4 Q-6.4 -29.6 0 -30.2 Q6.4 -29.6 13.6 -25.4 L12 -21.4 Q6 -25.4 0 -26 Q-6 -25.4 -12 -21.4 Z" fill="@corpsH" opacity="0.78"/>` + // ligne d'épaule ÉCLAIRÉE
  `<path d="M-22 -6 Q-23.4 -22 -10.4 -28.6 L-11.4 -23 Q-18.4 -18 -19.4 -6 Q-19.4 8 -12.6 17.4 L-11 19 Q-21 10.4 -22 -6 Z" fill="@corpsO" opacity="0.5"/>` + // flanc gauche enroulé
  `<path d="M22 -6 Q23.4 -22 10.4 -28.6 L11.4 -23 Q18.4 -18 19.4 -6 Q19.4 8 12.6 17.4 L11 19 Q21 10.4 22 -6 Z" fill="@corpsO" opacity="0.68"/>` + // flanc droit, plus creusé
  `<ellipse cx="-1.4" cy="-6" rx="8.4" ry="15.6" fill="@corpsH" opacity="0.4"/>` + // sternum bombé (modelé)
  `<path d="M-13 -11.6 Q0 -14.6 13 -11.6 Q14.2 -3 12.4 4.6 Q12.8 9.4 9 12.4 Q4.6 14.6 0 14.8 Q-4.6 14.6 -9 12.4 Q-12.8 9.4 -12.4 4.6 Q-14.2 -3 -13 -11.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // FANON
  `<path d="M-7.4 -11.4 Q0 -13.4 7.4 -11.4 Q8.4 -3 7 4.4 Q7.2 8.4 4.4 10.6 Q0 12.2 -4.4 10.6 Q-7.2 8.4 -7 4.4 Q-8.4 -3 -7.4 -11.4 Z" fill="@corpsH" opacity="0.66"/>` + // arête éclairée du fanon
  `<path d="M-10.4 -10.4 Q-11.4 0 -9.6 9 M10.4 -10.4 Q11.4 0 9.6 9" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5"/>` +
  `<path d="M-8.6 12 Q-4.4 14.4 0 14.8 Q4.4 14.4 8.6 12" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.45"/>` + // ourlet bas du pli
  `<path d="M-16.4 -14 q-0.8 3.6 -0.4 6.8 M-17 -6.6 q-0.6 3.6 -0.2 6.8 M15.4 -14 q0.8 3.6 0.4 6.8" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.3" stroke-linecap="round"/>` + // hachures groupées
  `</g>`;

// ── CANON PROCHE (bas de patte, PROFIL) ───────────────────────────────────────────────────────
// Repère de l'OS `bas*` : y = 0 au genou/jarret, y = 22 × legLen ≈ 17,6 au boulet ; le canon fait
// ≈ 11,4 u de large en haut et 8,9 en bas (LEG_BUILD.bovin), l'échelle d'épaisseur de l'os
// s'appliquant par-dessus. Deux valeurs seulement : l'ARÊTE éclairée du devant du canon (0,62 —
// au-dessus du seuil de surface éclairée L≈45,9) et l'ombre du tendon derrière. Aucun contour :
// le canon a déjà le sien au socle. Sans ce calque, sous un corps entièrement modelé, les quatre
// membres restaient des aplats de robe — « poteaux de carton » au gros plan.
const CANON_PROCHE =
  `<g data-deco="canon">` +
  `<path d="M2 1.4 Q4.2 5.4 3.8 11.4 Q3.4 15 2.6 17.2 Q1.4 13.4 1.4 8.4 Q1.4 4 2 1.4 Z" fill="@corpsH" opacity="0.62"/>` +
  `<path d="M-3.8 2.4 Q-4.6 8.4 -4 15.4 Q-2.8 12.4 -2.6 7.4 Q-2.6 4.4 -3.8 2.4 Z" fill="@corpsO" opacity="0.34"/>` +
  `</g>`;
// DOS : la croupe est LARGE au socle (`bodyWidth.back = 26`) — ce calque la MODÈLE : dessus
// éclairé qui suit le dôme et se referme en pointes sur les hanches (des bouts coupés droit
// lisaient « épaulettes » posées sur les angles, ronde 2), sillon creusé, dessous dans l'ombre.
const TRONC_DOS =
  `<g data-deco="croupe">` +
  `<path d="M-21.6 -8.6 Q-19.4 -19.4 0 -23.4 Q19.4 -19.4 21.6 -8.6 Q17.4 -16.4 0 -19.4 Q-17.4 -16.4 -21.6 -8.6 Z" fill="@corpsH" opacity="0.84"/>` +
  `<path d="M-20.4 -4.4 Q-17.6 -15.4 0 -19 Q17.6 -15.4 20.4 -4.4 Q15.6 -12.4 0 -15 Q-15.6 -12.4 -20.4 -4.4 Z" fill="@corpsH" opacity="0.34"/>` + // seconde passe feutrée
  `<ellipse cx="-13.4" cy="-1" rx="10.4" ry="15.6" fill="@corpsH" opacity="0.62"/>` + // hanche gauche (surface éclairée)
  `<ellipse cx="13.4" cy="-1" rx="10.4" ry="15.6" fill="@corpsH" opacity="0.34"/>` + // hanche droite (modelé)
  // SILLON central creusé d'un ton : c'est lui qui sépare les DEUX masses de croupe en gris à
  // 40 px — à 0,45 les deux hanches se refermaient en une seule bosse.
  `<path d="M0 -20 Q3 0 0 22 Q-3 0 0 -20 Z" fill="@corpsO" opacity="0.62"/>` +
  `<path d="M0 -19 Q1.5 1 0 21" fill="none" stroke="@corpsO" stroke-width="1.6" opacity="0.8"/>` +
  `<path d="M-26 -4 Q-26 12.6 -13 23 L-14.6 19.4 Q-23.4 10.4 -23.6 -3 Z" fill="@corpsO" opacity="0.5"/>` + // flancs enroulés
  `<path d="M26 -4 Q26 12.6 13 23 L14.6 19.4 Q23.4 10.4 23.6 -3 Z" fill="@corpsO" opacity="0.7"/>` +
  `<ellipse cx="0" cy="21.4" rx="16.4" ry="5.6" fill="@corpsO" opacity="0.45"/>` + // dessous de croupe
  `<path d="M-17 -7 q-1.2 4.4 -0.8 8.4 M-11.6 -5 q-0.8 4.6 -0.4 8.6 M11.6 -5 q0.8 4.6 0.4 8.6 M17 -7 q1.2 4.4 0.8 8.4" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.3" stroke-linecap="round"/>` +
  `</g>`;

export const creature: CreatureDef = {
  label: 'Bœuf',
  id: 'boeuf',
  plan: 'quadruped',
  // Le GABARIT est déclaré plus haut (`QUAD`) : l'art en dépend par les lignes d'interface, donc il
  // ne peut pas attendre la fin du fichier. Ici on ne fait que lui adjoindre son décor.
  quad: {
    ...QUAD,
    deco: {
      // GETTERS : ces deux arts lisent les lignes d'interface, donc le squelette, donc un module
      // qui ré-exporte ce registre. Ils se construisent à la première DEMANDE, pas au chargement.
      get encolure() { return [{ svg: FANON(), plan: 0 }]; },
      // CANONS PROCHES : le socle les rend en aplat de robe. Sous un corps entièrement modelé, ils
      // lisaient « poteaux de carton » au gros plan. Ce calque leur donne l'arête éclairée du
      // devant du canon et l'ombre du tendon derrière — le repère est celui de l'OS (aucune ancre
      // sur un membre), donc il suit la patte en animation. Plan 0 : peint avec l'art de son os.
      'basAvD#profile': [{ svg: CANON_PROCHE, plan: 0 }],
      'basArD#profile': [{ svg: CANON_PROCHE, plan: 0 }],
      get 'tronc#profile'() { return [{ svg: TRONC_PROFIL(), plan: 0 }]; },
      'tronc#front': [{ svg: TRONC_FACE, plan: 0 }],
      'tronc#back': [{ svg: TRONC_DOS, plan: 0 }],
      // AUCUN décor sur `tete` : la tête bovine porte son propre emboîtement (son remplissage va
      // chercher la ganache, `heads/defs/boeuf.ts`). Un décor de raccord y serait une TROISIÈME
      // pièce sur une couture de deux.
    },
  },
};
