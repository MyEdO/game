import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { RING_A_PX } from './dynamicMarks';
import { HALO_RX_PX, haloRadiusK, interactionHalos, NO_INTERACTION_HALOS, type HaloRegime } from './interactHalos';
import { cleActionJouee } from '../../state/usable';
import type { BillboardPropEl, TokenEl } from './types';

/**
 * DÉRIVATION des halos d'interaction (#1176, P3-0g ; régime de révélation #1687) : c'est ELLE qui
 * décide QUI est un utilisable et CE QU'ON EN MONTRE. Le rendu la consomme sans rien re-décider ; ce
 * qu'il ne pourrait pas rattraper, c'est un halo dérivé pour un objet déjà fouillé, ou un décor
 * annoncé sous le brouillard.
 */
function décor(
  id: string,
  x: number,
  y: number,
  { span = { w: 1, h: 1 }, ...extra }: Partial<Pick<BillboardPropEl, 'ref' | 'cell' | 'span' | 'foot'>> = {},
): BillboardPropEl {
  return {
    kind: 'prop',
    key: `prop:${id}`,
    cell: { x, y, z: 0 },
    source: 'entity',
    entId: id,
    ref: 'tonneau',
    foot: { offX: 0, offY: 0, scale: 1 },
    states: { visible: true },
    span,
    ...extra,
  };
}

/** L'ENTITÉ derrière l'élément de décor : l'élément de rendu ne porte plus AUCUNE offre, le halo la
 *  dérive de la scène (`estUtilisable`). Un geste authoré non épuisé est tout ce qu'il demande. */
const fouillable = (id: string, x = 0, y = 0, label?: string): SceneEntity => ({
  id, kind: 'prop', pos: { x, y }, ref: 'tonneau',
  ...(label ? { label } : {}),
  usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
});

/** Le JETON d'un figurant posté — l'autre corps qu'une entité de scène reçoit du champ. Un jeton ÉMIS
 *  est en vue par construction (`buildTokens` coupe les hors-vue) : `visible` y est vrai. */
function jeton(ent: SceneEntity, visible = true): TokenEl {
  return {
    kind: 'token',
    key: `fig:${ent.id}`,
    id: ent.id,
    cell: { x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 },
    subject: { kind: 'figurant', ent, enrolled: false, inBattle: false },
    states: { visible },
  };
}

/** Un PNJ à qui PARLER : sa capacité d'instance vient de son dialogue, comme pour le curseur et le
 *  clic — aucune déclaration propre au halo. */
const interlocuteur = (id: string, x = 5, y = 5, label?: string): SceneEntity => ({
  id, kind: 'personnage', ref: 'villageois', pos: { x, y }, ...(label ? { label } : {}), dialogueId: 'dlg-aubergiste',
});

function scèneAvec(...entities: SceneEntity[]): Scene {
  const s = emptyScene(10, 10);
  return { ...s, entities: [...s.entities, ...entities] };
}

/** RÉGIMES de la frame : rien de montré, la révélation tenue, un survol. */
const RIEN: HaloRegime = { survol: null, reveler: false };
const REVELE: HaloRegime = { survol: null, reveler: true };
const survolant = (id: string, reveler = false): HaloRegime => ({ survol: id, reveler });

describe('Halos d’interaction — QUI est un utilisable (#1176 P3-0g)', () => {
  it('un décor à geste authoré porte un halo ; le drapeau d’épuisement l’éteint', () => {
    const els = [décor('coffre', 3, 4)];
    const sc = scèneAvec(fouillable('coffre', 3, 4));
    expect(interactionHalos([], els, sc, {}, RIEN).map((h) => h.id)).toEqual(['coffre']);
    expect(interactionHalos([], els, sc, { [cleActionJouee('coffre', 'fouiller')]: true }, RIEN)).toHaveLength(0);
    // et le drapeau d'un AUTRE décor n'éteint pas celui-ci
    expect(interactionHalos([], els, sc, { [cleActionJouee('tonneau', 'fouiller')]: true }, RIEN)).toHaveLength(1);
  });

  it('UNE action épuisée sur DEUX n’éteint rien : le halo s’éteint quand il ne reste PLUS RIEN à jouer', () => {
    const deux: SceneEntity = {
      id: 'coffre', kind: 'prop', pos: { x: 3, y: 4 }, ref: 'tonneau',
      usable: { actions: [
        { id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true },
        { id: 'ouvrir', flow: { kind: 'seq', steps: [] }, unique: true },
      ] },
    };
    const els = [décor('coffre', 3, 4)];
    const sc = scèneAvec(deux);
    const une = { [cleActionJouee('coffre', 'fouiller')]: true };
    expect(interactionHalos([], els, sc, une, RIEN)).toHaveLength(1);
    expect(interactionHalos([], els, sc, { ...une, [cleActionJouee('coffre', 'ouvrir')]: true }, RIEN)).toHaveLength(0);
  });

  it('ni un décor SANS offre ni un overlay de TERRAIN n’appellent le joueur', () => {
    const nu: SceneEntity = { id: 'mort', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'tonneau' };
    const els = [
      décor('mort', 1, 1),
      { ...décor('arbre', 2, 2), source: 'terrain' as const, entId: undefined, span: undefined },
    ];
    expect(interactionHalos([], els, scèneAvec(nu), {}, REVELE)).toHaveLength(0);
  });

  it('un MEUBLE À PLACES appelle le joueur SANS aucune action authorée', () => {
    const table: SceneEntity = { id: 'table-1', kind: 'prop', pos: { x: 3, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } };
    const el = décor('table-1', 3, 3, { ref: 'table-ronde-4-tabourets' });
    expect(interactionHalos([], [el], scèneAvec(table), {}, RIEN).map((h) => h.id)).toEqual(['table-1']);
    // Un drapeau d'ÉPUISEMENT n'a aucune prise sur une place : ce n'est pas une ressource qui s'épuise.
    const flags = { [cleActionJouee('table-1', 'fouiller')]: true, [cleActionJouee('table-1', 'sasseoir')]: true };
    expect(interactionHalos([], [el], scèneAvec(table), flags, RIEN)).toHaveLength(1);
  });
});

describe('Halos d’interaction — CE QU’ON EN MONTRE (#1687)', () => {
  const els = [décor('coffre', 3, 4), décor('tonneau', 7, 7)];
  const scène = scèneAvec(fouillable('coffre', 3, 4, 'Coffre bardé de fer'), fouillable('tonneau', 7, 7));
  const statique: SceneEntity = { id: 'poutre', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'tonneau' };

  it('RIEN n’est allumé en permanence : sans survol ni révélation, tout utilisable est MUET', () => {
    const halos = interactionHalos([], [...els, décor('poutre', 1, 1)], scèneAvec(...scène.entities, statique), {}, RIEN);
    expect(halos.map((h) => h.id), 'le décor STATIQUE n’entre même pas dans la liste').toEqual(['coffre', 'tonneau']);
    expect(halos.map((h) => h.etat)).toEqual(['muet', 'muet']);
  });

  it('la RÉVÉLATION allume TOUS les utilisables visibles, et rien sous le brouillard', () => {
    expect(interactionHalos([], els, scène, {}, REVELE).map((h) => h.etat)).toEqual(['revele', 'revele']);
    const cachés = els.map((e) => ({ ...e, states: { visible: false } }));
    expect(interactionHalos([], cachés, scène, {}, REVELE).map((h) => h.etat), 'ce qu’on ne voit pas ne se révèle pas').toEqual(['muet', 'muet']);
  });

  it('le SURVOLÉ porte la variante renforcée — seul, et encore sous la révélation', () => {
    expect(interactionHalos([], els, scène, {}, survolant('tonneau')).map((h) => h.etat)).toEqual(['muet', 'survole']);
    expect(interactionHalos([], els, scène, {}, survolant('tonneau', true)).map((h) => h.etat)).toEqual(['revele', 'survole']);
    const cachés = els.map((e) => ({ ...e, states: { visible: false } }));
    expect(interactionHalos([], cachés, scène, {}, survolant('tonneau')).map((h) => h.etat), 'même survolé, sous le voile il se tait').toEqual(['muet', 'muet']);
  });

  it('le halo porte le NOM de son entité — celui de la donnée, jamais l’id', () => {
    const [coffre, tonneau] = interactionHalos([], els, scène, {}, REVELE);
    expect(coffre.label).toBe('Coffre bardé de fer');
    expect(tonneau.label, 'une entité sans libellé n’en invente pas').toBeUndefined();
  });

  it('AUCUN mode n’entre dans la décision : le combat montre exactement ce que l’exploration montre', () => {
    // La dérivation ne reçoit plus aucun contexte de mode — même entrées, mêmes états, partout.
    expect(interactionHalos([], els, scène, {}, REVELE).map((h) => h.etat)).toEqual(['revele', 'revele']);
  });
});

describe('Halos d’interaction — les DEUX corps d’un utilisable (#1687)', () => {
  const aubergiste = interlocuteur('aubergiste', 5, 5, 'Ludwig, aubergiste');

  it('un PNJ à dialogue est un utilisable comme un coffre : même liste, mêmes états', () => {
    const sc = scèneAvec(aubergiste, fouillable('coffre', 3, 4));
    const els = [décor('coffre', 3, 4)];
    expect(interactionHalos([jeton(aubergiste)], els, sc, {}, RIEN).map((h) => h.etat)).toEqual(['muet', 'muet']);
    const révélés = interactionHalos([jeton(aubergiste)], els, sc, {}, REVELE);
    expect(révélés.map((h) => h.id)).toEqual(['aubergiste', 'coffre']);
    expect(révélés.map((h) => h.etat)).toEqual(['revele', 'revele']);
    expect(révélés[0].label, 'la plaque de nom y prend son texte').toBe('Ludwig, aubergiste');
  });

  it('le survol d’un PNJ le renforce, lui seul', () => {
    const sc = scèneAvec(aubergiste, fouillable('coffre', 3, 4));
    const halos = interactionHalos([jeton(aubergiste)], [décor('coffre', 3, 4)], sc, {}, survolant('aubergiste'));
    expect(halos.map((h) => h.etat)).toEqual(['survole', 'muet']);
  });

  it('un PNJ hors de la liste postée n’a aucun halo — sous le voile, il n’est pas peint', () => {
    const sc = scèneAvec(aubergiste);
    expect(interactionHalos([], [], sc, {}, REVELE), 'coupé en amont par `buildTokens`').toHaveLength(0);
    expect(interactionHalos([jeton(aubergiste, false)], [], sc, {}, REVELE).map((h) => h.etat)).toEqual(['muet']);
  });

  it('un PNJ SANS offre reste du décor vivant, et un jeton de COMBATTANT n’entre jamais dans la liste', () => {
    const muet: SceneEntity = { id: 'badaud', kind: 'personnage', ref: 'villageois', pos: { x: 6, y: 6 } };
    expect(interactionHalos([jeton(muet)], [], scèneAvec(muet), {}, REVELE)).toHaveLength(0);
    const combattant: TokenEl = {
      kind: 'token', key: 'cbt:aubergiste', id: 'aubergiste', cell: { x: 5, y: 5, z: 0 },
      subject: { kind: 'combatant', c: { id: 'aubergiste', pos: { x: 5, y: 5 } } as never, overhang: false },
      states: { visible: true },
    };
    expect(interactionHalos([combattant], [], scèneAvec(aubergiste), {}, REVELE)).toHaveLength(0);
  });

  it('le halo d’un PNJ se pose à SON ancrage — celui de sa pastille de gestes, jamais un second calcul', () => {
    const [h] = interactionHalos([jeton(aubergiste)], [], scèneAvec(aubergiste), {}, REVELE);
    expect(h.cell).toEqual({ x: 5, y: 5, z: 0 });
    expect(h.centre).toEqual({ x: 5, y: 5 });
    expect(h.n, 'l’empreinte de l’espèce (`ancrageDuJeton`)').toBe(1);
    expect(h.echelle).toEqual({ x: 1, y: 1 });
  });
});

describe('Halos d’interaction — la GÉOMÉTRIE du halo (#1176 P3-0g)', () => {
  it('le halo est aux PIEDS du décor : le centre de l’empreinte, et son étage', () => {
    const [h] = interactionHalos(
      [],
      [décor('epave', 4, 6, { cell: { x: 4, y: 6, z: 2 }, span: { w: 2, h: 2 }, foot: { offX: 0.5, offY: 0.5, scale: 2 } })],
      scèneAvec(fouillable('epave')),
      {},
      REVELE,
    );
    expect(h.cell).toEqual({ x: 4, y: 6, z: 2 });
    expect(h.centre).toEqual({ x: 4.5, y: 6.5 });
    expect(h.span).toEqual({ w: 2, h: 2 });
    expect(h.echelle, 'un grand décor porte un grand halo').toEqual({ x: 2, y: 2 });
    expect(h.n, 'et il EST un ancrage : la plaque de nom s’y pose à la hauteur de la pastille').toBe(2);
  });

  /**
   * LE HALO ÉPOUSE L'EMPREINTE, AXE PAR AXE (#1509 L9′). Un facteur ISOTROPE (le côté max) faisait
   * déborder le halo d'une demi-case sur l'axe COURT : sur les tables murales de la Diligence (1×2,
   * dos au mur est), l'anneau doré passait à travers la cloison, dans la pièce voisine. Ce que ce
   * contrat tient, c'est la CONTENANCE : le halo tient dans le bloc de cases du décor, et rien d'autre
   * ne change pour les décors d'une case.
   */
  it('l’échelle du halo suit CHAQUE axe de l’empreinte, et le halo tient dans son bloc de cases', () => {
    const murale = décor('murale', 14, 11, { span: { w: 1, h: 2 }, foot: { offX: 0, offY: 0.5, scale: 2 } });
    const [h] = interactionHalos([], [murale], scèneAvec(fouillable('murale')), {}, REVELE);
    expect(h.echelle, 'un 1×2 ne grandit que sur y').toEqual({ x: 1, y: 2 });
    // CONTENANCE, en cases : demi-axes du halo (rayon monde × échelle) contre le demi-bloc (w/2, h/2).
    const demi = { x: haloRadiusK(HALO_RX_PX) * h.echelle.x, y: haloRadiusK(HALO_RX_PX) * h.echelle.y };
    expect(demi.x, 'axe court : le halo reste dans la case, jamais dans le mur').toBeLessThanOrEqual(h.span.w / 2);
    expect(demi.y, 'axe long : le halo reste dans les deux cases').toBeLessThanOrEqual(h.span.h / 2);
  });

  /** Les décors d'UNE case ne bougent pas d'un flottant : leur halo reste le cercle qu'il était. */
  it('un décor 1×1 garde un halo ISOTROPE (contrat de non-régression)', () => {
    const [h] = interactionHalos([], [décor('coffre', 3, 4)], scèneAvec(fouillable('coffre')), {}, REVELE);
    expect(h.echelle).toEqual({ x: 1, y: 1 });
    expect(h.centre).toEqual({ x: 3, y: 4 });
  });

  it('le RAYON monde du halo est la projection de l’ellipse affine — la même loi que l’anneau d’équipe', () => {
    // l'affine trace `rx = 17·échelle` px ; `RING_A_PX` px valent UNE case de rayon monde.
    expect(haloRadiusK(HALO_RX_PX)).toBeCloseTo(HALO_RX_PX / RING_A_PX, 12);
    expect(haloRadiusK(HALO_RX_PX) * RING_A_PX).toBeCloseTo(HALO_RX_PX, 12);
  });

  it('la valeur VIDE est gelée — une voie ne peut pas la salir pour l’autre', () => {
    expect(Object.isFrozen(NO_INTERACTION_HALOS)).toBe(true);
    expect(NO_INTERACTION_HALOS).toHaveLength(0);
  });
});
