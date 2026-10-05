import { rotOf, type BonePose } from '../poses';
import { describe, it, expect } from 'vitest';
import {
  COLLAPSE_MS,
  PLAN_ATTACK_IMPACT_MS,
  PLAN_ATTACK_MS,
  PLAN_ATTACK_TAIL_MS,
  PLAN_FLINCH_MS,
  PLAN_IDLE_MS,
  clipTotalMs,
  planAttackDef,
  planDyingDef,
  planFlinchDef,
  planPoseAt,
  planRenderPose,
  planRestDef,
  planWalkDef,
  rigAttackDef,
  rigCollapsePoseAt,
  rigDefenseDef,
  rigHitDef,
  rigWalkDef,
  type RigSelectCtx,
} from './actorAnimSelect';
import { CLIPS } from './clips';
import { mountedAttackClip, mountedParryClip, seatedClip, weaponAttackClip, weaponParryClip } from './weaponClips';
import { spellCastClip } from './spellClips';
import { CORPSE_POSE, PRONE_POSE, planGroundPose } from '../../groundPose';
import { planById } from '../bodyPlan';
import { STEP_MS } from '../../../geometry/walk';
import { armeDeDessin } from '../parts/equipment';
import type { Weapon } from '../../../engine/types';

const w = (label: string, type: Weapon['type'], extra: Partial<Weapon> = {}): Weapon =>
  ({ label, type, damage: { plusBF: true, flat: 4 }, qualities: [], ...extra }) as Weapon;
/** Projection d'une arme : forme RÉSOLUE par son id de Possession. */
const P = armeDeDessin;

// Le maniement se route par ID STABLE (forme résolue de `trappingId`/`attackKind`, cf. `handling.ts`), jamais par libellé.
const HACHE_2M = w('Hache à deux mains', 'melee', { trappingId: 'grande-hache', hands: 2 });
const EPEE = w('Épée', 'melee', { trappingId: 'dague' });
const A_PIED: RigSelectCtx = { seated: false, mainWeapon: P(EPEE), shield: false };

describe('sélection BIPÈDE — le geste rendu est celui que les résolveurs d’arme/sort produisent', () => {
  it('arme à DEUX MAINS employée : le clip de sa classe de maniement, pas celui de l’arme principale', () => {
    const def = rigAttackDef({ kind: 'melee', weapon: HACHE_2M }, A_PIED);
    expect(def.clip).toBe(weaponAttackClip(P(HACHE_2M)));
    expect(def.clip).not.toBe(weaponAttackClip(P(EPEE)));
    expect(def.impactMs).toBe(def.clip.onImpact);
  });

  it('sans arme dans l’événement : repli sur l’arme principale du contexte', () => {
    expect(rigAttackDef({ kind: 'melee' }, A_PIED).clip).toBe(weaponAttackClip(P(EPEE)));
  });

  it('sort sur un ENNEMI (kinds distincts) : geste `bolt`', () => {
    const def = rigAttackDef({ kind: 'spell', casterKind: 'hero', targetKind: 'enemy' }, A_PIED);
    expect(def.clip).toBe(spellCastClip('bolt'));
    expect(def.key).toBe('rig:cast:bolt:pied');
  });

  it('sort sur un ALLIÉ ou sur soi : geste `blessing`', () => {
    expect(rigAttackDef({ kind: 'spell', casterKind: 'hero', targetKind: 'hero' }, A_PIED).clip).toBe(spellCastClip('blessing'));
    expect(rigAttackDef({ kind: 'spell', isSelf: true }, A_PIED).clip).toBe(spellCastClip('blessing'));
  });

  it('EN SELLE : le geste monté (attaque) et la variante assise (sort, esquive, touché)', () => {
    const selle: RigSelectCtx = { seated: true, mainWeapon: P(EPEE) };
    expect(rigAttackDef({ kind: 'melee', weapon: HACHE_2M }, selle).clip).toEqual(mountedAttackClip(P(HACHE_2M)));
    expect(rigAttackDef({ kind: 'spell', casterKind: 'hero', targetKind: 'enemy' }, selle).clip)
      .toEqual(seatedClip(spellCastClip('bolt')));
    expect(rigDefenseDef({ defense: 'esquive' }, selle)!.clip).toEqual(seatedClip(CLIPS.dodge));
    expect(rigDefenseDef({ defense: 'parade', parryWeapon: HACHE_2M }, selle)!.clip).toEqual(mountedParryClip(P(HACHE_2M), false));
    expect(rigHitDef(selle).clip).toEqual(seatedClip(CLIPS.hit));
    expect(rigWalkDef(selle)).toBeNull(); // la MONTURE marche, pas le cavalier
  });

  it('parade : l’arme QUI A PARÉ prime, sinon l’arme principale (+ bouclier du contexte)', () => {
    expect(rigDefenseDef({ defense: 'parade', parryWeapon: HACHE_2M }, A_PIED)!.clip).toBe(weaponParryClip(P(HACHE_2M), false));
    expect(rigDefenseDef({ defense: 'parade' }, { ...A_PIED, shield: true })!.clip).toBe(weaponParryClip(P(EPEE), true));
    expect(rigDefenseDef({ defense: 'parade' }, A_PIED)!.clip).toBe(weaponParryClip(P(EPEE), false));
  });

  it('pas de parade parée → esquive ; incantation de SOUTIEN reçue → aucune réaction', () => {
    expect(rigDefenseDef({}, A_PIED)!.clip).toBe(CLIPS.dodge);
    expect(rigDefenseDef({ kind: 'spell', casterKind: 'hero', targetKind: 'hero' }, A_PIED)).toBeNull();
    expect(rigDefenseDef({ kind: 'spell', casterKind: 'enemy', targetKind: 'hero' }, A_PIED)!.clip).toBe(CLIPS.dodge);
  });

  it('deux gestes identiques portent la MÊME clé, deux gestes distincts des clés distinctes', () => {
    const k = (weapon: Weapon, ctx: RigSelectCtx) => rigAttackDef({ kind: 'melee', weapon }, ctx).key;
    const couteau = w('Couteau', 'melee', { trappingId: 'couteau' }); // même classe de maniement que la dague
    expect(rigAttackDef({ kind: 'melee', weapon: couteau }, A_PIED).clip).toBe(rigAttackDef({ kind: 'melee', weapon: EPEE }, A_PIED).clip);
    expect(k(EPEE, A_PIED)).toBe(k(couteau, A_PIED));
    expect(k(EPEE, A_PIED)).not.toBe(k(HACHE_2M, A_PIED));
    expect(k(EPEE, A_PIED)).not.toBe(k(EPEE, { ...A_PIED, seated: true }));
    expect(k(EPEE, A_PIED)).not.toBe(k(w('Dague', 'melee', { trappingId: 'dague', hand: 'off' }), A_PIED)); // miroir main gauche
  });

  it('EFFONDREMENT bipède : part du repos, ARRIVE sur la pose au sol partagée (jamais un saut)', () => {
    expect(rigCollapsePoseAt(null, 0)).toBeNull();
    const debut = rigCollapsePoseAt('corpse', 0)!;
    expect(Object.keys(debut.pose).every((os) => rotOf(debut.pose, os) === 0)).toBe(true);
    expect(debut.done).toBe(false);
    const fin = rigCollapsePoseAt('corpse', COLLAPSE_MS)!;
    for (const os of Object.keys(CORPSE_POSE)) expect(rotOf(fin.pose, os)).toBeCloseTo(rotOf(CORPSE_POSE, os), 10);
    expect(rotOf(rigCollapsePoseAt('prone', COLLAPSE_MS)!.pose, 'tete')).toBeCloseTo(rotOf(PRONE_POSE, 'tete'), 10);
    expect(rigCollapsePoseAt('corpse', COLLAPSE_MS + 1)!.done).toBe(true);
  });
});

describe('gestes de GABARIT — durées nommées et échantillonnage pur', () => {
  const plan = planById('quadruped'); // pattes + morsure, sans idle
  const aile = planById('winged'); // le seul à porter un idle (frémissement d'ailes)
  /** Poses égales OS PAR OS (`lerpPose` réunit les os des deux poses : un os absent y vaut 0). */
  const memePose = (a: BonePose, b: BonePose) => {
    for (const os of new Set([...Object.keys(a), ...Object.keys(b)])) expect(rotOf(a, os), os).toBeCloseTo(rotOf(b, os), 10);
  };

  it('les durées jadis en dur de `usePlanAnim` sont ces constantes', () => {
    expect(planRestDef().durationMs).toBe(PLAN_IDLE_MS);
    expect(PLAN_IDLE_MS).toBe(1600);
    expect(planFlinchDef().durationMs).toBe(PLAN_FLINCH_MS);
    expect(PLAN_FLINCH_MS).toBe(240);
    expect(PLAN_ATTACK_MS).toBe(280);
    expect(clipTotalMs(planAttackDef())).toBe(PLAN_ATTACK_MS + PLAN_ATTACK_TAIL_MS);
    expect(clipTotalMs(planAttackDef())).toBe(360); // durée de vie du mode d'attaque
    expect(planDyingDef('corpse').durationMs).toBe(COLLAPSE_MS);
    expect(COLLAPSE_MS).toBe(420);
  });

  it('une attaque de gabarit porte son instant de CONTACT (fin de la rampe d’extension)', () => {
    expect(planAttackDef('morsure').impactMs).toBe(PLAN_ATTACK_IMPACT_MS);
    expect(PLAN_ATTACK_IMPACT_MS).toBe(PLAN_ATTACK_MS);
  });

  it('MORSURE : la pose dédiée du plan quand il en déclare une, sinon son attaque générique', () => {
    const t = PLAN_ATTACK_MS / 2;
    const morsure = planPoseAt(plan, planAttackDef('morsure'), t).pose;
    expect(morsure).toEqual(plan.attackKindPose?.('morsure', 0.5) ?? plan.attackPose(0.5));
    expect(planPoseAt(plan, planAttackDef(), t).pose).toEqual(plan.attackPose(0.5));
    expect(planPoseAt(plan, planAttackDef('morsure'), 10_000).pose).toEqual(
      plan.attackKindPose?.('morsure', 1) ?? plan.attackPose(1),
    ); // l'enveloppe est plafonnée : jamais au-delà de l'extension maximale
  });

  it('marche : cycle de `STEP_MS`×2, bond si le plan le porte', () => {
    const def = planWalkDef(false);
    expect(def.loop).toBe(true);
    expect(planPoseAt(plan, def, 0).pose).toEqual(plan.walkPose(0));
    expect(planPoseAt(plan, def, STEP_MS * 2).pose).toEqual(plan.walkPose(0)); // boucle
    expect(planPoseAt(plan, def, 10 * STEP_MS * 2).done).toBe(false); // une boucle ne finit pas
    if (plan.leapPose) expect(planPoseAt(plan, planWalkDef(true), 0).pose).toEqual(plan.leapPose(0));
  });

  it('recul : amplitude en cloche (nulle aux bords, maximale au milieu)', () => {
    const def = planFlinchDef();
    const amp = (ms: number) => { const p = planPoseAt(plan, def, ms).pose; return Math.max(...Object.keys(p).map((os) => Math.abs(rotOf(p, os)))); };
    expect(amp(0)).toBeCloseTo(0, 10);
    expect(amp(PLAN_FLINCH_MS)).toBeCloseTo(0, 10);
    expect(amp(PLAN_FLINCH_MS / 2)).toBeGreaterThan(0);
    expect(planPoseAt(plan, def, PLAN_FLINCH_MS + 1).done).toBe(true);
  });

  it('effondrement : du repos vers la pose au sol PARTAGÉE, ailes étalées', () => {
    const def = planDyingDef('corpse');
    memePose(planPoseAt(plan, def, 0).pose, plan.restPose());
    const fin = planPoseAt(plan, def, COLLAPSE_MS);
    memePose(fin.pose, planGroundPose(plan, 'corpse')!);
    expect(fin.wings).toBe('spread');
    memePose(planPoseAt(plan, planDyingDef('prone'), COLLAPSE_MS).pose, planGroundPose(plan, 'prone')!);
  });

  it('AILES : déployées en marche/attaque/effondrement, pliées au repos et au recul', () => {
    const wingsOf = (def: ReturnType<typeof planRestDef>) => planPoseAt(plan, def, 0).wings;
    expect(wingsOf(planRestDef())).toBe('folded');
    expect(wingsOf(planFlinchDef())).toBe('folded');
    expect(wingsOf(planWalkDef())).toBe('spread');
    expect(wingsOf(planAttackDef())).toBe('spread');
    expect(wingsOf(planDyingDef('corpse'))).toBe('spread');
  });

  it('repos : idle en boucle sur sa période ; pose de repos fixe si le plan n’a pas d’idle', () => {
    const def = planRestDef();
    expect(aile.idlePose).toBeTruthy();
    memePose(planPoseAt(aile, def, PLAN_IDLE_MS).pose, planPoseAt(aile, def, 0).pose); // une période plus tard
    expect(planPoseAt(aile, def, PLAN_IDLE_MS / 4).pose).not.toEqual(planPoseAt(aile, def, 0).pose); // et ça bouge entre-temps
    expect(planPoseAt(plan, def, PLAN_IDLE_MS * 3).pose).toEqual(plan.restPose()); // sans idle : la pose de repos
    expect(planPoseAt(plan, def, PLAN_IDLE_MS * 3).done).toBe(false);
  });

  /** Écart maximal os par os entre deux poses (degrés) — mesure la DISTANCE de deux gestes. */
  const ecartMax = (a: BonePose, b: BonePose) =>
    Math.max(...[...new Set([...Object.keys(a), ...Object.keys(b)])].map((os) => Math.abs(rotOf(a, os) - rotOf(b, os))));

  it('DEBOUT pendant la fenêtre d’effondrement (acteur relevé en vol) : la pose rendue est le REPOS', () => {
    const def = planDyingDef('prone'); // mode posé à la mise À Terre, encore vivant dans la fenêtre
    const t = COLLAPSE_MS / 2;
    // le gabarit à idle rend son repos EN PHASE (horloge globale), pas un affaissement joué debout
    memePose(planRenderPose(aile, def, null, t, 0), planPoseAt(aile, planRestDef(), t).pose);
    // sans idle : la pose de repos fixe — et l'affaissement échantillonné debout en est LOIN
    memePose(planRenderPose(plan, def, null, t, 0), plan.restPose());
    expect(ecartMax(planRenderPose(plan, def, null, t, 0), planPoseAt(plan, def, t).pose)).toBeGreaterThan(1);
  });

  it('la cible d’effondrement suit l’état AU RENDU : un À Terre qui MEURT en vol finit sur la pose de cadavre', () => {
    const def = planDyingDef('prone'); // état capté à l'ÉVÈNEMENT : mise À Terre
    const mort = planRenderPose(plan, def, 'corpse', COLLAPSE_MS, 0); // la mort survient pendant la fenêtre
    memePose(mort, planGroundPose(plan, 'corpse')!);
    expect(ecartMax(mort, planGroundPose(plan, 'prone')!)).toBeGreaterThan(1); // pas la cible figée à l'évènement
    // état inchangé : la cible reste celle de l'À Terre
    memePose(planRenderPose(plan, def, 'prone', COLLAPSE_MS, 0), planGroundPose(plan, 'prone')!);
    // hors effondrement, un acteur au sol tient sa pose couchée de l'instant
    memePose(planRenderPose(plan, planRestDef(), 'corpse', 1234, 0), planGroundPose(plan, 'corpse')!);
  });
});
