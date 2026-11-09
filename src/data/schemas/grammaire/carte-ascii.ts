/**
 * GRAMMAIRE d'une carte ASCII (format `walled` du `MapSpec`) — les glyphes que la LECTURE d'un plan
 * s'est réservés, et qu'aucune DONNÉE ne peut donc réclamer.
 *
 * Une carte s'écrit en box-drawing : les lignes/colonnes IMPAIRES portent les CASES, les PAIRES les
 * ARÊTES. Chaque glyphe ci-dessous est un mot de cette grammaire — il vaut la même chose dans le
 * lecteur (`noyau/monde/asciiMap.ts`), dans l'exporteur (`noyau/monde/sceneToAscii.ts`) et au schéma, qui refuse
 * qu'un terrain déclare son glyphe d'authoring (`terrains.json › ascii`) dans ce vocabulaire.
 *
 * La table vit à la GRAMMAIRE (`src/data/schemas`) parce que c'est le SCHÉMA qui la VALIDE (il refuse
 * qu'un terrain réclame un mot du plan) : un schéma se lit sans le store — il vaut au parse d'un
 * dataset, dans un test de donnée comme dans l'éditeur. La poser au lecteur (`noyau/monde/asciiMap.ts`)
 * ferait dépendre la validation d'une donnée de la couche qui la consomme.
 */

/** Les mots de la grammaire, par RÔLE — plusieurs chars quand le rôle en accepte plusieurs. */
export const GRAMMAIRE_ASCII = {
  /** Fond de l'étage : la `base` de la couche (le `.` d'écriture, l'espace des grilles rognées). */
  base: '. ',
  /** Mur plein sur une arête N (rangée paire). */
  murHorizontal: '-',
  /** Mur plein sur une arête E (colonne paire). */
  murVertical: '|',
  /** Coin de grille (intersection de deux rangées d'arêtes) — jamais porteur de sens. */
  jonction: '+',
  /** PORTE d'arête : franchissable au jeu, mur pour la lecture du plan. */
  porte: ':',
  /** FENÊTRE d'arête : mur plein serti d'une vitre (décoratif). */
  fenetre: 'o',
  /** Cloison DIAGONALE posée sur une CASE (et non sur une arête). */
  diagonales: '/\\',
} as const;

/** Le char de fond ÉCRIT par l'exporteur et les remplissages : `base` en accepte DEUX à la lecture
 *  (le `.` d'écriture et l'espace des grilles rognées), l'écriture en choisit un — celui-ci. */
export const FOND_ECRIT = GRAMMAIRE_ASCII.base[0];

/** Tous les glyphes RÉSERVÉS par la grammaire — jamais réattribués à un terrain, un matériau ou une
 *  zone, ni par la donnée (schéma de `terrains.json`) ni par l'allocateur de `sceneToAscii`. */
export const GLYPHES_RESERVES: ReadonlySet<string> = new Set(
  Object.values(GRAMMAIRE_ASCII).flatMap((mot) => mot.split('')),
);

/** Les glyphes réservés, en clair, pour un message de refus (`« . », « - », …`). */
export const glyphesReservesEnClair = (): string =>
  [...GLYPHES_RESERVES].map((c) => (c === ' ' ? '« espace »' : `« ${c} »`)).join(', ');

/**
 * Les PONTS d'un véhicule (`vehicles.json › ponts`, #3686) : une carte BOX-DRAWING par pont, du plus bas au plus
 * haut, toutes de mêmes dimensions. Une case porte le glyphe de sa hauteur (second membre de `ponts`) ; une arête, un mot
 * de `GRAMMAIRE_ASCII` ou l'un des deux mots propres aux ponts ci-dessous. Le noyau (`noyau/planDeLaCaraque.ts`)
 * et la construction du modèle 3D (`scripts/personnage-3d/vehicule/caraque/plan_de_jeu.py`) lisent la même carte.
 */
export const MOTS_DES_PONTS = {
  /** ÉCHELLE d'arête : elle joint deux cases du même pont, l'une à la hauteur du pont du dessus (la trappe). */
  echelle: 'H',
  /** SABORD : arête de coque murée, que l'Amélioration Sabord (MDG 12 l.364) ouvre. */
  sabord: 'x',
} as const;

/** Une case de pont : sa colonne, son rang, son pont et son glyphe. */
export interface CaseDePont { x: number; y: number; z: number; glyphe: string }
/** Une arête de pont : `t` entre les cases (x-1, y) et (x, y), `l` entre (x, y-1) et (x, y) ; son pont et son mot. */
export interface AreteDePont { sens: 't' | 'l'; x: number; y: number; z: number; glyphe: string }

/** La grille des ponts : dimensions en cases, cases et arêtes non vides. PURE. */
export function grilleDesPonts(ponts: readonly string[]): { w: number; h: number; cases: CaseDePont[]; aretes: AreteDePont[] } {
  const lignes = ponts.map((p) => p.split('\n'));
  const h = (Math.max(...lignes.map((l) => l.length)) - 1) >> 1;
  const w = (Math.max(...lignes.flat().map((l) => l.length)) - 1) >> 1;
  const a = (z: number, l: number, c: number) => lignes[z][l]?.[c] ?? ' ';
  const vide = (g: string) => GRAMMAIRE_ASCII.base.includes(g);
  const cases: CaseDePont[] = [];
  const aretes: AreteDePont[] = [];
  lignes.forEach((_, z) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!vide(a(z, 2 * y + 1, 2 * x + 1))) cases.push({ x, y, z, glyphe: a(z, 2 * y + 1, 2 * x + 1) });
    for (let y = 0; y < h; y++) for (let x = 0; x <= w; x++) if (!vide(a(z, 2 * y + 1, 2 * x))) aretes.push({ sens: 't', x, y, z, glyphe: a(z, 2 * y + 1, 2 * x) });
    for (let y = 0; y <= h; y++) for (let x = 0; x < w; x++) if (!vide(a(z, 2 * y, 2 * x + 1))) aretes.push({ sens: 'l', x, y, z, glyphe: a(z, 2 * y, 2 * x + 1) });
  });
  return { w, h, cases, aretes };
}

/** Les deux cases qu'une arête de pont sépare. */
export const casesDeLAreteDePont = (e: AreteDePont): [{ x: number; y: number }, { x: number; y: number }] =>
  e.sens === 't' ? [{ x: e.x - 1, y: e.y }, { x: e.x, y: e.y }] : [{ x: e.x, y: e.y - 1 }, { x: e.x, y: e.y }];

/** Les défauts des ponts `ponts` aux hauteurs `hauteurs`, en clair ; vide s'ils sont bien formés. PURE. */
export function defautsDesPonts(ponts: readonly string[], hauteurs: Readonly<Record<string, number>>): string[] {
  const { w, h, cases, aretes } = grilleDesPonts(ponts);
  const defauts: string[] = [];
  const lignes = ponts.map((p) => p.split('\n'));
  lignes.forEach((l, z) => { if (l.length !== 2 * h + 1) defauts.push(`pont ${z} : ${l.length} lignes, ${2 * h + 1} attendues`); });
  for (const c of cases) if (hauteurs[c.glyphe] === undefined) defauts.push(`pont ${c.z} (${c.x}, ${c.y}) : glyphe « ${c.glyphe} » sans hauteur`);
  const mots = new Set<string>([GRAMMAIRE_ASCII.murHorizontal, GRAMMAIRE_ASCII.murVertical, GRAMMAIRE_ASCII.porte, GRAMMAIRE_ASCII.fenetre, ...Object.values(MOTS_DES_PONTS)]);
  const hauteur = (z: number, p: { x: number; y: number }) => {
    const c = cases.find((q) => q.z === z && q.x === p.x && q.y === p.y);
    return c ? hauteurs[c.glyphe] : undefined;
  };
  for (const e of aretes) {
    if (e.x > w || e.y > h) continue;
    if (!mots.has(e.glyphe)) defauts.push(`pont ${e.z} arête ${e.sens} (${e.x}, ${e.y}) : mot « ${e.glyphe} » inconnu`);
    if (e.glyphe === MOTS_DES_PONTS.echelle) {
      const [ha, hb] = casesDeLAreteDePont(e).map((p) => hauteur(e.z, p));
      if (ha === undefined || hb === undefined || ha === hb) defauts.push(`pont ${e.z} échelle (${e.x}, ${e.y}) : ni entre deux cases, ni vers une trappe plus haute`);
    }
  }
  return defauts;
}
