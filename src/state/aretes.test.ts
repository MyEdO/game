import { describe, expect, it } from 'vitest';
import { edgeOf, emptyScene, type Scene } from './scene';
import type { RoomPortal } from './roomPortals';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';
import {
  aretesUtilisables,
  caseOpposee,
  libellePortail,
  LARGEUR_PRISE_ARETE,
  PRIORITE_ARETES,
  type AreteUtilisable,
  type ContexteAretes,
} from './aretes';

/**
 * PARITÉ DÉRIVEUR ⇄ PEINTRE (#1687, lot 1b-1) — chaque banc reprend la scène du banc de rendu
 * correspondant (`escalade-et-chute-par-l-arete.test.tsx`, `structure-par-l-arete.test.tsx`,
 * `AreteOverlay.test.tsx` : leurs fabriques sont locales, elles sont donc reconstruites ici à
 * l'identique) et exige du dériveur la MÊME sélection, sans aucune géométrie d'écran : aucun rendu
 * dans ce fichier.
 */

/** Escalade : une arête grimpable en (1,1,E) — la case d'en face (2,1) est 4 m plus
 *  haut — et une seconde en (3,3,E), que rien ne borde. */
function scèneGrimpable(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(5 * 4).fill(0) as number[];
  h[1 * 5 + 2] = 4;
  s.layers[0].height = h;
  s.walls = [
    { x: 1, y: 1, side: 'E', climb: { kind: 'surface' } },
    { x: 3, y: 3, side: 'E', climb: { kind: 'ladder' } },
  ];
  return s;
}

/** Chute : une CORNICHE — toute la rangée y=0 à 4 m, le reste au sol, sans arête
 *  `climb`. Depuis (2,0), seul le cardinal SUD descend. */
function scèneDeFalaise(): Scene {
  const s = emptyScene(4, 4);
  const h = new Array(4 * 4).fill(0) as number[];
  for (let x = 0; x < 4; x += 1) h[0 * 4 + x] = 4;
  s.layers[0].height = h;
  return s;
}

/** `structure-par-l-arete.test.tsx` : une fortification d'arête en (1,1,E). */
function scèneFortifiée(): Scene {
  const s = emptyScene(5, 4);
  s.walls = [{ x: 1, y: 1, side: 'E', structure: 'mur-a-ossature-en-bois' }];
  return s;
}

const ID_MUR = 'structure-1,1,E,0';
const mur = { id: ID_MUR, label: 'Mur à ossature en bois' } as unknown as Combatant;
const bataille = (combatants: Combatant[]): BattleState =>
  ({ combatants, order: [], turn: 0 } as unknown as BattleState);

/** Porte : un passage intérieur sur l'arête (1,1,E). */
const passage: RoomPortal = {
  id: '1,1,E,0:room-a:room-b',
  z: 0,
  edge: { x: 1, y: 1, side: 'E' },
  fromZoneId: 'room-a',
  toZoneId: 'room-b',
  kind: 'passage',
  exterior: false,
  from: { x: 1, y: 1 },
  to: { x: 2, y: 1 },
};

const VU_11 = new Set(['1,1,0', '2,1,0']);

describe('aretesUtilisables — le dériveur d’arêtes rend ce que les overlays peignent', () => {
  it('ESCALADE : la seule arête grimpable que le contrôleur BORDE, ancrée sur sa case', () => {
    const aretes = aretesUtilisables({
      scene: scèneGrimpable(),
      visible: new Set(['1,1,0', '2,1,0', '3,3,0', '4,3,0']),
      controleur: { x: 1, y: 1, z: 0 },
      activeZ: 0,
    });

    expect(aretes, 'l’arête (3,3,E) est grimpable mais aucun mobile ne la borde').toHaveLength(1);
    expect(aretes[0]).toEqual({
      cle: '1,1,E,0',
      x: 1, y: 1, side: 'E', z: 0,
      capacite: 'escalade',
      ancrage: { x: 1, y: 1, z: 0 },
      largeurPrise: 9,
      libelle: 'Escalader',
    });
  });

  it('ESCALADE : depuis la case HAUTE, le même geste descend — et le libellé le dit', () => {
    // Le haut de la paroi borde le vide de trois côtés : ces cardinaux descendants offrent une CHUTE
    // (le quatrième, vers (1,1), porte l'arête grimpable — `planFall` s'y refuse). Gestes distincts
    // sur arêtes distinctes : la priorité n'a rien à départager ici.
    const aretes = aretesUtilisables({
      scene: scèneGrimpable(),
      visible: VU_11,
      controleur: { x: 2, y: 1, z: 0 },
      activeZ: 0,
    });
    const arete = aretes.find((a) => a.capacite === 'escalade')!;

    expect(arete.libelle).toBe('Descendre en escalade');
    expect(arete.ancrage).toEqual({ x: 2, y: 1, z: 0 });
    expect(aretes.filter((a) => a.capacite === 'chute').map((a) => a.cle))
      .toEqual(['2,1,E,0', '2,2,N,0', '2,1,N,0']);
  });

  it('ESCALADE : un contrôleur qui ne borde aucune arête grimpable n’offre rien', () => {
    expect(aretesUtilisables({
      scene: scèneGrimpable(),
      visible: new Set(['1,1,0', '2,1,0', '3,3,0', '4,3,0']),
      controleur: { x: 0, y: 3, z: 0 },
      activeZ: 0,
    })).toEqual([]);
  });

  it('CHUTE : le seul cardinal qui descend, avec sa hauteur au libellé', () => {
    const aretes = aretesUtilisables({
      scene: scèneDeFalaise(),
      visible: new Set(['2,0,0', '2,1,0']),
      controleur: { x: 2, y: 0, z: 0 },
      activeZ: 0,
    });

    expect(aretes, 'est et ouest longent la corniche à plat, le nord sort de la carte').toHaveLength(1);
    expect(aretes[0]).toEqual({
      cle: '2,1,N,0',
      x: 2, y: 1, side: 'N', z: 0,
      capacite: 'chute',
      ancrage: { x: 2, y: 0, z: 0 },
      largeurPrise: 9,
      libelle: 'Sauter en bas (4 m)',
    });
  });

  it('STRUCTURE : l’arête fortifiée ENRÔLÉE en combat, nommée par son Combattant et ancrée sur la case du MUR', () => {
    const aretes = aretesUtilisables({
      scene: scèneFortifiée(),
      visible: VU_11,
      controleur: { x: 0, y: 1, z: 0 },
      activeZ: 0,
      battle: bataille([mur]),
    });

    expect(aretes).toEqual([{
      cle: '1,1,E,0',
      x: 1, y: 1, side: 'E', z: 0,
      capacite: 'structure',
      // La case du mur (`Combatant.pos` de la Structure), jamais celle du frappeur en (0,1) : le geste
      // est le clic du jeton, et la prise se projette au lift du mur.
      ancrage: { x: 1, y: 1, z: 0 },
      largeurPrise: 16,
      libelle: 'Mur à ossature en bois',
      cid: ID_MUR,
    }]);
  });

  it('STRUCTURE : aucune arête sans Combattant qui la tienne, hors combat, ou hors de mon tour', () => {
    const ctx = { scene: scèneFortifiée(), visible: VU_11, controleur: { x: 0, y: 1, z: 0 }, activeZ: 0 };
    expect(aretesUtilisables({ ...ctx, battle: bataille([]) })).toEqual([]);
    expect(aretesUtilisables(ctx), 'hors combat, la structure n’est pas une cible').toEqual([]);
    expect(
      aretesUtilisables({ ...ctx, controleur: null, battle: bataille([mur]) }),
      'sans héros en main (hors de mon tour), une enceinte ne se frappe pas',
    ).toEqual([]);
  });

  it('PORTE : l’accès de la couche active, ancré sur la case de départ', () => {
    const aretes = aretesUtilisables({
      scene: scèneFortifiée(),
      visible: VU_11,
      controleur: { x: 1, y: 1, z: 0 },
      activeZ: 0,
      portails: [passage],
    });

    expect(aretes).toEqual([{
      cle: '1,1,E,0',
      x: 1, y: 1, side: 'E', z: 0,
      capacite: 'porte',
      ancrage: { x: 1, y: 1, z: 0 },
      largeurPrise: 28,
      libelle: 'Passage vers une autre pièce',
      portail: passage,
    }]);
  });

  it('PORTE : un accès d’une AUTRE couche ne sort pas de la couche active', () => {
    expect(aretesUtilisables({
      scene: scèneFortifiée(),
      visible: new Set(['1,1,1', '2,1,1']),
      controleur: null,
      activeZ: 0,
      portails: [{ ...passage, z: 1 }],
    })).toEqual([]);
  });

  it('les six libellés d’accès, un par nature de portail', () => {
    expect(libellePortail({ ...passage, kind: 'door-closed', exterior: true })).toBe('Porte extérieure fermée');
    expect(libellePortail({ ...passage, kind: 'door-closed' })).toBe('Porte fermée');
    expect(libellePortail({ ...passage, exterior: true, fromZoneId: null })).toBe('Entrée intérieure');
    expect(libellePortail({ ...passage, exterior: true })).toBe('Sortie extérieure');
    expect(libellePortail({ ...passage, kind: 'door-open' })).toBe('Porte ouverte');
    expect(libellePortail(passage)).toBe('Passage vers une autre pièce');
  });

  it('PRIORITÉ : une arête à la fois porte et fortification enrôlée sort UNE fois, en structure', () => {
    const aretes = aretesUtilisables({
      scene: scèneFortifiée(),
      visible: VU_11,
      controleur: { x: 1, y: 1, z: 0 },
      activeZ: 0,
      battle: bataille([mur]),
      portails: [passage],
    });

    expect(aretes, 'la même arête ne peut offrir qu’un geste').toHaveLength(1);
    expect(aretes[0].capacite).toBe('structure');
    expect(aretes[0].cid).toBe(ID_MUR);
  });

  it('PRIORITÉ : deux arêtes DISTINCTES sortent dans l’ordre déclaré, la plus forte d’abord', () => {
    const scene = scèneGrimpable();
    scene.walls = [...scene.walls!, { x: 1, y: 1, side: 'N', structure: 'mur-a-ossature-en-bois' }];

    const aretes = aretesUtilisables({
      scene,
      visible: new Set(['1,1,0', '2,1,0', '1,0,0']),
      controleur: { x: 1, y: 1, z: 0 },
      activeZ: 0,
      battle: bataille([{ id: 'structure-1,1,N,0', label: 'Mur à ossature en bois' } as unknown as Combatant]),
    });

    expect(aretes.map((a) => a.capacite)).toEqual(['structure', 'escalade']);
    expect(PRIORITE_ARETES.indexOf('structure')).toBeLessThan(PRIORITE_ARETES.indexOf('escalade'));
  });

  it('BROUILLARD : une arête dont aucune extrémité n’est éclaircie n’existe pas', () => {
    const rien = new Set<string>();
    expect(aretesUtilisables({ scene: scèneGrimpable(), visible: rien, controleur: { x: 1, y: 1, z: 0 }, activeZ: 0 })).toEqual([]);
    expect(aretesUtilisables({ scene: scèneDeFalaise(), visible: rien, controleur: { x: 2, y: 0, z: 0 }, activeZ: 0 })).toEqual([]);
    expect(aretesUtilisables({ scene: scèneFortifiée(), visible: rien, controleur: null, activeZ: 0, battle: bataille([mur]) })).toEqual([]);
    expect(aretesUtilisables({ scene: scèneFortifiée(), visible: rien, controleur: null, activeZ: 0, portails: [passage] })).toEqual([]);
  });

  it('la largeur de prise est PAR capacité — jamais un trait uniforme', () => {
    expect(LARGEUR_PRISE_ARETE).toEqual({ structure: 16, chute: 9, escalade: 9, porte: 28 });
    expect(new Set(Object.values(LARGEUR_PRISE_ARETE)).size, 'trois largeurs distinctes').toBe(3);
  });
});

/** Un contexte par capacité, bâti des MÊMES fabriques que les bancs ci-dessus : la population
 *  mesurée est celle des quatre dériveurs réels, jamais une arête forgée à la main. */
const CONTEXTES: ReadonlyArray<readonly [string, ContexteAretes]> = [
  ['escalade', { scene: scèneGrimpable(), visible: VU_11, controleur: { x: 1, y: 1, z: 0 }, activeZ: 0 }],
  ['chute', { scene: scèneDeFalaise(), visible: new Set(['2,0,0', '2,1,0']), controleur: { x: 2, y: 0, z: 0 }, activeZ: 0 }],
  ['structure', { scene: scèneFortifiée(), visible: VU_11, controleur: { x: 0, y: 1, z: 0 }, activeZ: 0, battle: bataille([mur]) }],
  ['porte', { scene: scèneFortifiée(), visible: VU_11, controleur: { x: 1, y: 1, z: 0 }, activeZ: 0, portails: [passage] }],
];

describe('caseOpposee — l’ancrage BORDE l’arête, sur les quatre dériveurs', () => {
  it.each(CONTEXTES)('%s : l’ancrage et la case d’en face sont les deux cases que l’arête sépare', (capacite, ctx) => {
    const aretes = aretesUtilisables(ctx).filter((a) => a.capacite === capacite);
    expect(aretes, 'le contexte offre bien cette capacité').toHaveLength(1);

    const [arete] = aretes;
    const vers = caseOpposee(arete);
    expect(vers.z, 'la case d’en face reste sur la couche de l’arête').toBe(arete.z);
    expect(
      edgeOf(arete.ancrage.x, arete.ancrage.y, vers.x, vers.y),
      'ancrage et case d’en face se séparent EXACTEMENT par cette arête',
    ).toEqual({ x: arete.x, y: arete.y, side: arete.side });
  });

  it('un ancrage qui ne borde pas l’arête LÈVE en se nommant — jamais un `null` muet', () => {
    const horsSujet = {
      cle: '1,1,E,0', x: 1, y: 1, side: 'E', z: 0,
      capacite: 'escalade',
      ancrage: { x: 4, y: 3, z: 0 },
      largeurPrise: LARGEUR_PRISE_ARETE.escalade,
      libelle: 'Escalader',
    } as AreteUtilisable;
    expect(() => caseOpposee(horsSujet)).toThrow(/\(4,3\).*1,1,E,0/);
  });
});
