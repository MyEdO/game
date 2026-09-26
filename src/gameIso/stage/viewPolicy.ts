/**
 * POLITIQUE DE VUE de l'écran de jeu (#1176, P3-5) — module PUR : d'un REGARD (plateau iso, plateau
 * du dessus, première personne) il dérive les verdicts de STYLE que l'écran applique. Aucun DOM,
 * aucune scène, aucun store.
 *
 * FRONTIÈRE : style = ce qu'on choisit de MONTRER ; géométrie = ce que la projection rend POSSIBLE.
 * Les `isSquareView` de `authoring/detailSvg.ts` et `authoring/wallsSvg.ts` disent une vérité de
 * PROJECTION (une vue du dessus n'a aucune face verticale à peindre) : ils ne migrent pas ici, et
 * ce module n'a rien à leur dire. Ici ne vivent que des choix — un toit qu'on retire pour voir le
 * plancher, un soleil qu'on n'allume pas, une nappe qu'on ne monte pas.
 *
 * UN VERDICT DE PLUS = UNE LIGNE : c'est le point de ce module. Les verdicts de PION s'y posent de la
 * même façon (`montesDissocies`, `pionsEnDisques`), sans nouveau site de décision.
 *
 * LOI DE COMPOSITION DU DESSUS (#1176, P3-5b) — la vue du dessus de JEU et le PLAN DE STATION
 * (`gameIso/TopoScene`) n'ont qu'une seule loi : le monde volumique ne peint que les SOLS de l'étage
 * actif ; murs, grille, portes, escaliers, pions et marqueurs sont des surcouches SVG. C'est
 * exactement ce que dit `planKeepEl` (`stage/planSnapshot.ts`) depuis P3-4, et ce que les verdicts
 * `mursAuTrait`/`etageIsole`/`toitsVisibles` disent pour l'écran de jeu — les deux vues CONVERGENT,
 * elles ne se doublent pas. Le trait de mur est la MÊME couche des deux côtés
 * (`stage/layers.wallTraitObjs`), la matière le MÊME monde cuit.
 */
import { isSquareView, type ViewMode } from '../../geometry/iso';

/** Le REGARD porté sur le monde, réduit à ce dont le style dépend. `pov` prime : la première personne
 *  n'a pas de projection de plateau. */
export interface RegardVue {
  /** Première personne (`StageFrame` en mode `pov`). */
  pov?: boolean;
  /** Projection du regard de PLATEAU (`Dims.view`) — losange par défaut. Ignorée en POV. */
  view?: ViewMode;
}

/** Ce que l'écran CHOISIT de montrer sous ce regard. */
export interface StyleVue {
  /** Les toitures se dessinent-elles ? En vue du DESSUS, le découvert est PERMANENT : on regarde un
   *  plancher à la verticale, une nappe posée dessus ne montrerait que sa propre tuile. La loi de
   *  dégagement (`clearedSpace`) continue de vivre entière sur le plateau iso. */
  toitsVisibles: boolean;
  /** Un seul ÉTAGE rendu (l'actif), au lieu de l'actif plus le contrebas : superposer le rez à
   *  l'étage rend le plan illisible. Verdict des ÉLÉMENTS de scène comme de la masse cuite — les deux
   *  sites en dépendent ensemble (couche des builders, masque du monde). */
  etageIsole: boolean;
  /** Les NAPPES de brume authorée (#1247) se montent-elles dans le volume ? Raison PROPRE, sans
   *  rapport avec les toitures : à 90° de tangage les nappes se projettent l'une sur l'autre et
   *  l'empilement dégénère en voile plein écran ; la première personne, elle, a sa brume de distance.
   *  Ce verdict coïncide avec `toitsVisibles` par ACCIDENT sur le plateau du dessus, jamais par
   *  dérivation. */
  nappesMonde: boolean;
  /** Le SEMIS d'intempéries (pluie, neige) se monte-t-il ? À 90° de tangage, une particule de pluie
   *  est un segment VERTICAL vu dans son axe : un point immobile, rien à lire — le semis coûte sa
   *  géométrie et sa passe de frame pour zéro information. La météo continue de peser sur cette vue
   *  par ses canaux NON particulaires (teinte des lampes, fond de canevas, palier d'exposition —
   *  `weatherLightScalars`), qu'aucun regard ne gate. Corollaire : sans pluie, plus rien à écrêter
   *  sous un toit retiré (#1247) — l'écrêtage n'a pas de cas à traiter en vue du dessus. */
  precipitations: boolean;
  /** Le RÉGIME SOLAIRE est-il allumé ? Verdict passé à la décision de lumière (`stageLights`), qui
   *  l'applique sur le FONDU : la vue du dessus rend donc le régime SANS SOLEIL complet — aucune
   *  ombre portée en travers du plateau (elle couche la silhouette des masses sur les cases et
   *  brouille la lecture), modelé de forme PLEIN (`shadeSousSoleil` à `fade = 0`), exposition du
   *  monde et des pions appariée PAR CONSTRUCTION. Le socle de figurine, lui, ne dépend PAS de ce
   *  verdict sous la vue du dessus : le pion y est un disque SVG qui porte son propre socle
   *  (`pionsEnDisques`) — et comme le disque d'ombre de contact n'est monté que pour un billboard
   *  `kind:'personnage'` (`sceneMeshes.wantsContactShadow`), dont il ne reste AUCUN sous ce verdict,
   *  la vue du dessus n'en peint plus un seul. L'ambiante, donc le palier jour/nuit, ne dépend
   *  d'aucun regard : la nuit reste la nuit. */
  ombreSoleil: boolean;
  /** Les MURS se rendent-ils au TRAIT symbolique SVG (`stage/layers.wallTraitObjs`) au lieu d'être
   *  peints par le monde volumique ? Vu à la verticale, un mur ne montre que sa COIFFE — quelques
   *  dixièmes de pixel de large à l'échelle d'un plateau (mesure au JSDoc de `stage/planSnapshot.ts`),
   *  là où le trait est invariant d'échelle. Verdict EXCLUSIF : le monde cuit RETIRE ses murs quand il
   *  est vrai (`keepEl`), aucune double peinture — garder une coiffe sous-pixel sous un trait, c'est
   *  payer du triangle pour du bruit. */
  mursAuTrait: boolean;
  /** La GRILLE de cases se montre-t-elle en permanence ? Le monde volumique fusionne les faces
   *  coplanaires de même matériau : deux cases voisines de même terrain n'ont plus aucune limite
   *  visible, et une vue tactique se joue sur des cases. La grille est donc une surcouche explicite
   *  (`geometry/grid.gridLines`), la même que celle de l'éditeur — plus discrète en jeu, où elle est
   *  un fond et non un outil. */
  grilleTactique: boolean;
  /** Un couple MONTÉ se rend-il en deux pions distincts (`buildTokens`, paramètre `top`) ? Vu à la
   *  verticale, le cavalier se peint SUR sa monture et le composite montre seulement un corps ; deux
   *  disques côte à côte gardent les deux unités lisibles et cliquables. */
  montesDissocies: boolean;
  /** Les PIONS (combattants, meneur de groupe, figurants) se rendent-ils en DISQUES-PORTRAITS de la
   *  surcouche SVG (`stage/TokenChromeOverlay`) au lieu de billboards du monde volumique ? Verdict
   *  EXCLUSIF, et c'est le point : sous lui le monde ne monte AUCUN sujet `kind:'personnage'`
   *  (`collectBillboards`/`actorBillboards`), donc plus de jumeau de silhouette, plus d'ombre de
   *  contact, plus de quad à percer et plus de cible de rayon — le clic retombe sur la CASE, où le
   *  disque est centré. Le DÉCOR, lui, n'est jamais un pion : vu du dessus il montre sa vraie emprise,
   *  là où un personnage ne montrerait que le sommet de son crâne — celui qui se dessine en billboard
   *  le reste, celui qui porte une recette volumique reste dans la masse cuite du monde
   *  (`builders/propVolumes.ts`).
   *
   *  C'est aussi ce qui referme l'écart d'ORDRE de la composition du dessus : grille, murs au trait,
   *  affordances et pions vivent alors dans le MÊME arbre SVG, où le rang de calque se décide
   *  (`SurcoucheIso`), au lieu de deux arbres dont l'un couvre l'autre en entier.
   *
   *  La CLASSIFICATION du pion n'est PAS rejouée ici : `tokenBodyKind(subject, 'top')` la porte déjà
   *  (`flat` + `portraitBox`), et reste sa source unique. */
  pionsEnDisques: boolean;
}

/** Les verdicts de style de ce regard. */
export function viewPolicy(regard: RegardVue): StyleVue {
  const pov = regard.pov === true;
  const dessus = !pov && isSquareView(regard.view);
  return {
    toitsVisibles: !dessus,
    etageIsole: dessus,
    nappesMonde: !pov && !dessus,
    precipitations: !dessus,
    ombreSoleil: !dessus,
    mursAuTrait: dessus,
    grilleTactique: dessus,
    montesDissocies: dessus,
    pionsEnDisques: dessus,
  };
}
