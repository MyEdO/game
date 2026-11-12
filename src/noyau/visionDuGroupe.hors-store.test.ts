/**
 * CE QUE LE GROUPE CONNAÎT (#3950, `src/noyau/visionDuGroupe.ts`) : un combattant en vue, une entité connue, un nom, le
 * masque du monde et sa clé, et les effets d'un appel tels que le groupe les voit (`effetsDeLAppel`). Le scénario
 * `embuscade-fluviale` pose au départ ses ennemis sur des cases que le groupe ne voit pas.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { beforeEach, describe, expect, it } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios/index';
import { depuisBase64 } from '../lib/base64';
import { t } from '../i18n';
import { combattantEnVue, connaissanceDuGroupe, cleDeLaVision, entiteConnue, nomEnVue, visionDuMonde } from './visionDuGroupe';
import { effetsDeLAppel, type Effet } from './effetsDeLAppel';
import { lumiereDeLaScene } from './lumiereDeLaScene';
import type { AttackResult } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';
import type { SceneEntity } from './monde/scene';
import type { Evenement } from './partie';
import type { Jeu } from './etat';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  const scen = testScenarios.find((s) => s.id === 'embuscade-fluviale')!;
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(scen, idsDeTest));
});

const etat = (): Jeu => banc.getState() as unknown as Jeu;
const combattants = (): Combatant[] => etat().battle!.combatants;
const parId = (id: string): Combatant => combattants().find((c) => c.id === id)!;
const ennemis = (): Combatant[] => combattants().filter((c) => c.kind === 'ennemi');
const heros = (): Combatant[] => combattants().filter((c) => c.kind === 'heros');

const SOLDAT = 'soldat-de-test';
const SORCIER = 'sorcier-de-test';
const PIRATE = 'enemy-enc-fluvial-1';
const PIRATE_2 = 'enemy-enc-fluvial-2';
type Case = { x: number; y: number; z: number };
/** Des cases que le groupe voit au départ, libre (`VUE_LIBRE`) ou tenue par le sorcier (`VUE_DU_SORCIER`), une case
 *  qu'il ne voit pas, celle du pirate (`NON_VUE`), et une case loin de tout (`LOIN`). */
const VUE_LIBRE: Case = { x: 5, y: 7, z: 0 };
const VUE_DU_SORCIER: Case = { x: 4, y: 5, z: 0 };
const NON_VUE: Case = { x: 12, y: 5, z: 0 };
const LOIN: Case = { x: 15, y: 1, z: 0 };
const cle = (c: Case) => `${c.x},${c.y},${c.z}`;

/** Réécrit les combattants `remplaces` (par id) et ajoute `ajoutes` au combat du banc. */
function poserLesCombattants(remplaces: Record<string, Partial<Combatant>>, ajoutes: Combatant[] = []): void {
  const battle = etat().battle!;
  banc.setState({ battle: { ...battle, combatants: [...battle.combatants.map((c) => (remplaces[c.id] ? { ...c, ...remplaces[c.id] } : c)), ...ajoutes] } });
}

/** Pose `cases` en mémoire de carte de la scène du banc. */
function explorer(cases: Case[]): void {
  banc.setState({ explored: { ...etat().explored, [etat().scene!.id]: cases.map(cle) } });
}

const avecScene = () => ({ ...etat(), scene: etat().scene! });

/** L'octet du masque de la vision à la case `c` de la couche 0. */
function octet(c: { x: number; y: number }): number {
  const { masque, largeur } = visionDuMonde(avecScene());
  return depuisBase64(masque)[c.y * largeur + c.x];
}

describe('embuscade-fluviale — au départ, ses ennemis hors de la vue du groupe', () => {
  it('chacun de ses 5 ennemis est hors de vue, sans nom, son octet 0 ou 128 ; chaque héros est en vue, à son nom', () => {
    expect(ennemis()).toHaveLength(5);
    expect(ennemis().map((c) => [c.id, combattantEnVue(etat(), c), nomEnVue(etat(), c.id)])).toEqual(ennemis().map((c) => [c.id, false, t('vision.horsDeVue')]));
    for (const c of ennemis()) expect([0, 128], c.id).toContain(octet(c.pos!));
    expect(heros().map((c) => [combattantEnVue(etat(), c), nomEnVue(etat(), c.id)])).toEqual(heros().map((c) => [true, c.label]));
  });
});

describe('connaissanceDuGroupe, visionDuMonde — vue, explorée, inconnue', () => {
  it('une case vue vaut 255, une case explorée hors de vue 128, une case inconnue 0', () => {
    explorer([NON_VUE]);
    const connue = connaissanceDuGroupe(etat());
    expect([connue(cle(VUE_LIBRE)), connue(cle(NON_VUE)), connue(cle(LOIN))]).toEqual(['visible', 'explored', 'unknown']);
    expect([octet(VUE_LIBRE), octet(NON_VUE), octet(LOIN)]).toEqual([255, 128, 0]);
    const scene = etat().scene!;
    const vision = visionDuMonde(avecScene());
    const { w, h } = scene.dimensions;
    expect([vision.largeur, vision.rangees, vision.rangeesParPlan, depuisBase64(vision.masque).length]).toEqual([w, h * scene.layers.length, h, w * h * scene.layers.length]);
  });

  it('la clé de la vision : la même sur une relecture du même état, une autre après le pas d’un héros', () => {
    const avant = cleDeLaVision(avecScene());
    banc.setState({ flags: { ...etat().flags, relue: true } });
    expect(cleDeLaVision(avecScene())).toBe(avant);
    poserLesCombattants({ [SOLDAT]: { pos: { ...parId(SOLDAT).pos!, x: 6, y: 7 } } });
    expect(cleDeLaVision(avecScene())).not.toBe(avant);
  });
});

describe('combattantEnVue — le couple monté, la structure de siège', () => {
  it('un ennemi hors de vue que monte un héros est en vue ; monté par un ennemi, non', () => {
    poserLesCombattants({ [PIRATE]: { riderId: SOLDAT }, [SOLDAT]: { mountId: PIRATE }, [PIRATE_2]: { riderId: 'enemy-enc-fluvial-3' } });
    expect([combattantEnVue(etat(), parId(PIRATE)), combattantEnVue(etat(), parId(PIRATE_2))]).toEqual([true, false]);
  });

  it('une structure ancrée sur une case non vue est en vue par la face vue de son arête', () => {
    const porte = (id: string, x: number, y: number) => ({ ...parId(PIRATE), id, bodyShape: 'structure', pos: { x: NON_VUE.x, y: NON_VUE.y }, structureEdge: { x, y, side: 'N' } }) as Combatant;
    poserLesCombattants({}, [porte('porte-vue', VUE_DU_SORCIER.x, VUE_DU_SORCIER.y), porte('porte-cachee', LOIN.x, LOIN.y)]);
    expect([combattantEnVue(etat(), parId('porte-vue')), combattantEnVue(etat(), parId('porte-cachee'))]).toEqual([true, false]);
  });
});

describe('entiteConnue — embusqué, personnage, décor', () => {
  it('un embusqué n’est jamais connu ; un personnage l’est sur une case vue, un décor sur une case vue ou explorée', () => {
    explorer([NON_VUE]);
    const ent = (kind: SceneEntity['kind'], c: Case, embusque = false) =>
      ({ id: 'e', kind, pos: { x: c.x, y: c.y }, ...(embusque ? { combat: { hiddenUntilCombat: true } } : {}) }) as SceneEntity;
    expect([
      entiteConnue(etat(), ent('personnage', VUE_LIBRE)),
      entiteConnue(etat(), ent('personnage', VUE_LIBRE, true)),
      entiteConnue(etat(), ent('personnage', NON_VUE)),
      entiteConnue(etat(), ent('prop', NON_VUE)),
      entiteConnue(etat(), ent('prop', LOIN)),
    ]).toEqual([true, false, false, true, false]);
  });
});

const epee = { label: 'épée', type: 'melee', subType: 'base', damage: { flat: 0 }, qualities: [] } as unknown as Weapon;
const touche = { hit: true, critical: false } as AttackResult;
const attaque = (from: string, to: string): Evenement => ({ type: 'emis', evt: 'anim_attack', payload: { kind: 'melee', from, to, defense: 'aucune', result: touche, weapon: epee } });
const sort = (from: string, to: string): Evenement =>
  ({ type: 'emis', evt: 'anim_attack', payload: { kind: 'spell', projectile: false, from, to, defense: 'aucune', result: { cast: true, roll: 10, target: 50, sl: 4, isCritical: false, isFumble: false, log: '' }, spell: 'drain' } }) as Evenement;
const effets = (...e: Evenement[]): Effet[] => effetsDeLAppel(etat(), e);

describe('effetsDeLAppel — ce que le groupe voit, lu sur l’état d’après l’appel', () => {
  it('un coup sur une cible hors de vue ne se rend pas ; d’un auteur hors de vue, il se rend sans auteur, sans départ ni trajet', () => {
    expect(effets(attaque(SOLDAT, PIRATE))).toEqual([]);
    expect(effets(attaque(PIRATE, SOLDAT))).toEqual([expect.objectContaining({ quoi: 'coup', de: null, vers: SOLDAT, depart: null, trajet: null })]);
    expect(effets(attaque(SORCIER, SOLDAT))).toEqual([expect.objectContaining({ quoi: 'coup', de: SORCIER, vers: SOLDAT })]);
  });

  it('une incantation sur une cible hors de vue ne se rend pas ; d’un lanceur hors de vue, sans lanceur ni départ', () => {
    expect(effets(sort(SORCIER, PIRATE))).toEqual([]);
    expect(effets(sort(PIRATE, SOLDAT))).toEqual([expect.objectContaining({ quoi: 'incantation', de: null, vers: SOLDAT, depart: null })]);
  });

  it('une zone garde ses cases vues ; d’un auteur hors de vue, sans auteur ni départ ni trajet ; sans case vue, rien', () => {
    const zone = (de: string, tiles: Case[]): Evenement => ({ type: 'emis', evt: 'anim_aoe', payload: { de, centre: tiles[0], tiles, rendu: 'souffle-de-feu' } });
    expect(effets(zone(PIRATE, [VUE_LIBRE, NON_VUE]))).toEqual([expect.objectContaining({ quoi: 'zone', de: null, depart: null, trajet: null, cases: [VUE_LIBRE] })]);
    expect(effets(zone(SORCIER, [VUE_LIBRE, NON_VUE]))).toEqual([expect.objectContaining({ quoi: 'zone', de: SORCIER, cases: [VUE_LIBRE] })]);
    expect(effets(zone(SORCIER, [NON_VUE]))).toEqual([]);
  });

  it('un flottant sur un combattant hors de vue ou sur une case non vue ne se rend pas', () => {
    const flotte = (payload: { to?: string; pos?: Case }): Evenement => ({ type: 'emis', evt: 'anim_float', payload: { ...payload, text: '+2', kind: 'soin' } });
    expect(effets(flotte({ to: PIRATE }), flotte({ pos: NON_VUE }))).toEqual([]);
    expect(effets(flotte({ to: SOLDAT }), flotte({ pos: VUE_LIBRE })).map((e) => e.quoi === 'flottant' && [e.sur, e.case])).toEqual([[SOLDAT, null], [null, VUE_LIBRE]]);
  });

  const marche = (id: string, path: Case[]): Evenement => ({ type: 'emis', evt: 'anim_move', payload: { id, path } });

  it('le déplacement d’un ennemi ne garde que la fin de son chemin vue case à case ; fini hors de vue, aucun ; ses pas sonnent', () => {
    poserLesCombattants({ [PIRATE]: { pos: { x: VUE_LIBRE.x, y: VUE_LIBRE.y } } });
    const [chemin, pas] = effets(marche(PIRATE, [NON_VUE, { x: 4, y: 4, z: 0 }, VUE_LIBRE]));
    expect(chemin).toMatchObject({ quoi: 'deplacement', qui: PIRATE, cases: [{ x: 4, y: 4, z: 0, metres: 0 }, { x: VUE_LIBRE.x, y: VUE_LIBRE.y, z: 0 }] });
    expect(pas).toMatchObject({ quoi: 'son' });
    expect(effets(marche(PIRATE, [NON_VUE, { x: 6, y: 7, z: 0 }, VUE_LIBRE])).map((e) => e.quoi), 'une seule case vue au bout : aucun chemin').toEqual(['son']);
    expect(effets(marche(PIRATE_2, [VUE_LIBRE, NON_VUE])).map((e) => e.quoi), 'fini hors de vue : aucun chemin').toEqual(['son']);
    expect(effets(marche(SOLDAT, [NON_VUE, VUE_LIBRE, { x: 3, y: 7, z: 0 }]))[0], 'un héros garde tout son chemin').toMatchObject({ cases: [NON_VUE, VUE_LIBRE, { x: 3, y: 7 }] });
  });

  it('le chemin d’une grande créature se juge par son corps à chaque case : un ancrage non vu dont l’empreinte l’est se garde', () => {
    const hors = { x: 2, y: 3, z: 0 };
    const [a, b] = [{ x: 3, y: 3, z: 0 }, { x: 3, y: 4, z: 0 }];
    poserLesCombattants({ [PIRATE]: { footprint: 2, pos: { x: b.x, y: b.y } } });
    const connue = connaissanceDuGroupe(etat());
    expect([hors, a, b].map((c) => connue(cle(c))), 'témoin : aucun ancrage du chemin n’est vu').not.toContain('visible');
    expect(combattantEnVue(etat(), parId(PIRATE)), 'témoin : son corps, ancré au bout, est en vue').toBe(true);
    expect(effets(marche(PIRATE, [hors, a, b]))[0]).toMatchObject({ quoi: 'deplacement', qui: PIRATE, cases: [{ ...a, metres: 0 }, b] });
  });
});

describe('lumiereDeLaScene — les foyers tels que le groupe les voit', () => {
  const sources = () => lumiereDeLaScene(avecScene(), 'tactique').sources;
  const torche = [{ light: { radiusM: 4 } }] as unknown as Combatant['activeEffects'];

  it('la source portée d’un porteur hors de vue n’est pas servie ; celle d’un héros l’est', () => {
    poserLesCombattants({ [PIRATE]: { activeEffects: torche }, [SOLDAT]: { activeEffects: torche } });
    expect(combattantEnVue(etat(), parId(PIRATE)), 'témoin : le pirate éclairé reste hors de vue').toBe(false);
    expect(sources().map((s) => s.cle).filter((c) => c.startsWith('portee/'))).toEqual([`portee/${SOLDAT}`]);
  });

  it('une source posée sur une case non vue garde sa lampe, sans flamme ni son ; sur une case vue, les deux', () => {
    const lampe = (id: string, c: Case): SceneEntity => ({ id, kind: 'prop', pos: { x: c.x, y: c.y }, light: { radiusM: 4 } }) as SceneEntity;
    const scene = etat().scene!;
    banc.setState({ scene: { ...scene, entities: [...scene.entities, lampe('lampe-vue', VUE_LIBRE), lampe('lampe-cachee', NON_VUE)] } });
    const connue = connaissanceDuGroupe(etat());
    expect([connue(cle(VUE_LIBRE)), connue(cle(NON_VUE))], 'témoin : la case de chaque lampe').toEqual(['visible', 'unknown']);
    const [vue, cachee] = ['posee/lampe-vue', 'posee/lampe-cachee'].map((k) => sources().find((s) => s.cle === k));
    expect(vue).toMatchObject({ visuel: 'feu', son: { id: 'crepitement' } });
    expect(cachee, 'sa lampe, sans flamme ni son').toMatchObject({ x: NON_VUE.x, y: NON_VUE.y, energie: vue!.energie, rayonCases: vue!.rayonCases, visuel: null, son: null });
  });
});
