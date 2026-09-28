/**
 * Le DESSIN d'un sujet de billboard est une fonction de ce que son identité hache, et de rien d'autre
 * (`DrawSnapshot`, `sceneMeshes.ts` ; #2097, #2113).
 *
 * Deux faces, indissociables :
 *  - un sujet déjà construit est une VALEUR : muter l'état vivant (arme déchargée ou retirée en place,
 *    catalogue édité) ne change pas un octet de ce qu'il dessine ;
 *  - le sujet RECONSTRUIT après la mutation change d'identité dès que son dessin change — l'acteur
 *    (identité de texture, `actorPoseKey`, `actorIdentityKey`) comme le figurant de scène.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { actorBillboards, actorIdentityKey, actorPoseKey, collectBillboards, type ActorPose, type BillboardSubject } from './sceneMeshes';
import { emptyScene, sceneMetresPerTile, type SceneEntity } from '../../../state/scene';
import type { SeatPose } from '../../../state/seating';
import type { TokenEl } from '../../builders/types';
import { createHero } from '../../../engine/character';
import { unloadWeapon } from '../../../engine/items';
import { loadRegister } from '../../../engine/weaponLoad';
import { setDataset } from '../../../data/overrides';
import { trappings } from '../../../data';
import { WEAPON_DEFS } from '../../rig/parts/weapons/_registry.generated';
import { rigIdleDef } from '../../rig/anim/actorAnimSelect';
import { VIEWS } from '../../rig/facing';
import type { Combatant, ItemInstance, Weapon } from '../../../engine/types';

const scene = emptyScene(8, 8);
const mpt = sceneMetresPerTile(scene);
const pose = (c: Combatant, seat?: SeatPose): ActorPose => ({ c, x: 1, y: 1, z: 0, facing: 'S', ...(seat ? { seat } : {}) });
const sujet = (p: ActorPose): BillboardSubject => actorBillboards([p], scene, mpt)[0];

/** Tous les couples (vue, sens) d'un sujet, repos ET frame de geste. */
const couples = VIEWS.flatMap((view) => [false, true].map((mirror) => ({ view, mirror })));
const dessins = (s: BillboardSubject): string[] =>
  couples.flatMap(({ view, mirror }) => [s.svg(view, mirror, 0), s.frameSvg?.(view, mirror, rigIdleDef(), 1, 8) ?? '']);

/** Arme dont la FORME vient du catalogue (`form` → `findTrappingById(...).shape`), et une autre forme connue. */
const slugs = new Set(WEAPON_DEFS.map((d) => d.slug));
const armeDeCatalogue = trappings.find((t) => t.shape && slugs.has(t.shape))!;
const autreForme = [...slugs].find((s) => s !== armeDeCatalogue.shape)!;
const catalogueDOrigine = trappings.slice();
afterEach(() => setDataset('trappings', catalogueDOrigine));

function arbalétrier(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
  h.id = 'h1';
  h.weapons = [{ uid: 'w-arb', label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], subType: 'Arbalète', reload: 1, shape: 'arbalete' } as unknown as Weapon];
  h.items = [...(h.items ?? []), { uid: 'am1', label: 'Carreau', kind: 'ammo', qualities: [], enc: 0, equipped: false, subType: 'Arbalète', qty: 2 } as ItemInstance];
  loadRegister(h, h.weapons[0]).loaded = true;
  h.pos = { x: 1, y: 1 };
  return h;
}

function porteurDeCatalogue(): Combatant {
  const h = arbalétrier();
  h.weapons = [{ label: 'x', type: 'melee', group: 'basic', damage: 4, form: armeDeCatalogue.id } as unknown as Weapon];
  return h;
}

const MUTATIONS: { nom: string; porteur: () => Combatant; muter: (c: Combatant) => void }[] = [
  { nom: 'unloadWeapon', porteur: arbalétrier, muter: (c) => unloadWeapon(c, c.weapons[0]) },
  { nom: 'arme retirée en place', porteur: arbalétrier, muter: (c) => void c.weapons.splice(0, 1) },
  {
    nom: 'setDataset (forme d’arme au catalogue)',
    porteur: porteurDeCatalogue,
    muter: () => setDataset('trappings', trappings.map((t) => (t.id === armeDeCatalogue.id ? { ...t, shape: autreForme } : t))),
  },
];

describe('un sujet est une VALEUR : l’état vivant muté ne change rien à ce qu’il dessine', () => {
  for (const { nom, porteur, muter } of MUTATIONS)
    it(`${nom} : chaque couple (vue, sens) déjà composé rend le MÊME octet, et le sujet reconstruit change d’identité si son dessin change`, () => {
      const c = porteur();
      const s = sujet(pose(c));
      const avant = dessins(s);
      muter(c);
      expect(dessins(s)).toEqual(avant);
      const neuf = sujet(pose(c));
      const dessinChange = dessins(neuf).some((d, i) => d !== avant[i]);
      if (dessinChange) expect(neuf.identity).not.toBe(s.identity);
    });
});

describe('#2113 B1 — forme d’arme changée au catalogue : le dessin change, donc les TROIS clés de l’acteur', () => {
  it('identité de texture, actorPoseKey et actorIdentityKey suivent l’édition du catalogue', () => {
    const c = porteurDeCatalogue();
    const s = sujet(pose(c));
    const avant = s.svg('front', false, 0);
    const clés = [actorPoseKey(pose(c)), actorIdentityKey(pose(c))];
    setDataset('trappings', trappings.map((t) => (t.id === armeDeCatalogue.id ? { ...t, shape: autreForme } : t)));
    const neuf = sujet(pose(c));
    expect(neuf.svg('front', false, 0), 'la sonde mord : la forme éditée se dessine').not.toBe(avant);
    expect(neuf.identity).not.toBe(s.identity);
    expect(actorPoseKey(pose(c))).not.toBe(clés[0]);
    expect(actorIdentityKey(pose(c))).not.toBe(clés[1]);
  });
});

describe('#2113 B2 — figurant de scène : son identité hache ses entrées de dessin', () => {
  const figurant = (appearance: SceneEntity['appearance']): SceneEntity =>
    ({ id: 'f1', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, facing: 'S', appearance }) as SceneEntity;
  const jeton = (ent: SceneEntity): TokenEl =>
    ({ kind: 'token', key: `fig:${ent.id}`, id: ent.id, cell: { x: 2, y: 2, z: 0 }, subject: { kind: 'figurant', ent, enrolled: false, inBattle: false } }) as unknown as TokenEl;
  const sujetFigurant = (ent: SceneEntity) => collectBillboards(scene, mpt, { tokens: [jeton(ent)], props: [] })[0];
  const base = sujetFigurant(figurant({ species: 'humain' } as SceneEntity['appearance']));

  const VARIANTES: [string, SceneEntity['appearance']][] = [
    ['tenue', { species: 'humain', tenue: 'mendiant' } as SceneEntity['appearance']],
    ['espèce', { species: 'nain' } as SceneEntity['appearance']],
    ['graine (couleurs)', { species: 'humain', seed: 7 } as SceneEntity['appearance']],
  ];
  for (const [nom, appearance] of VARIANTES)
    it(`${nom} : le dessin change, l’identité aussi`, () => {
      const s = sujetFigurant(figurant(appearance));
      expect(s.svg('front', false, 0), 'la sonde mord').not.toBe(base.svg('front', false, 0));
      expect(s.identity).not.toBe(base.identity);
      expect(s.identity.startsWith('perso:f1')).toBe(true);
    });
});

describe('Q1bis — arme retirée EN PLACE : aucun dessin hybride sur un sujet déjà construit', () => {
  it('le sujet retenu rend l’arme qu’il a hachée ; le sujet reconstruit, lui, change d’identité', () => {
    const c = arbalétrier();
    const s = sujet(pose(c));
    const f0 = s.frameSvg!('front', false, rigIdleDef(), 1, 8);
    c.weapons.splice(0, 1);
    expect(s.frameSvg!('front', false, rigIdleDef(), 1, 8)).toBe(f0);
    const neuf = sujet(pose(c));
    expect(neuf.frameSvg!('front', false, rigIdleDef(), 1, 8), 'la sonde mord').not.toBe(f0);
    expect(neuf.identity).not.toBe(s.identity);
  });
});

describe('assise — la hauteur de la place dessine, donc elle entre dans l’identité', () => {
  const place = (h: number): SeatPose =>
    ({ propId: 'banc-1', slotId: 's0', anchor: { x: 1.5, y: 1.5, h }, ground: 0, facing: 'S', approach: { x: 1, y: 2 }, occupant: { kind: 'hero', rang: 1 } }) as unknown as SeatPose;
  it('deux hauteurs d’assise sur la même place : dessins différents, identités différentes', () => {
    const c = arbalétrier();
    const bas = sujet(pose(c, place(0.45)));
    const haut = sujet(pose(c, place(0.8)));
    expect(haut.svg('front', false, 0), 'la sonde mord').not.toBe(bas.svg('front', false, 0));
    expect(haut.identity).not.toBe(bas.identity);
    expect(actorIdentityKey(pose(c, place(0.8)))).not.toBe(actorIdentityKey(pose(c, place(0.45))));
  });
});
