/**
 * COUTURE MONTÉE (#1128 L4) — une monture PORTÉE est harnachée : le harnachement ne se dessine plus
 * en os synthétiques au call-site, il vient du canal DONNÉE (`appearance.harnais` du record, sinon le
 * set par DÉFAUT déclaré en donnée éditable, `src/data/renduMonte.json`).
 *
 * Ce défaut est une INFÉRENCE MAISON de rendu (#1128) : les listes de Possessions de carrière
 * donnent la monture « avec selle et harnais » (LDB 08 l.557, ADE I 07 l.48) ; aucune règle n'attache
 * la sellerie au fait d'être monté — d'où la donnée éditable, et le respect du nu explicite.
 *
 * Mesuré sur le chemin de PROD d'un record (`resolveById` + `mountedPlanOpts` + `plan.resolve`), et
 * sur les DEUX issues du set : servi, ou REFUSÉ visiblement (espèce dont l'art n'est pas cuit).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountedPlanOpts, mountedRest, riderBodyPose, seatedBodyPose, seatedRest, type SeatedBody } from './mountedRig';
import { baseSkeleton, groundSkeleton } from './skeletons';
import { gabaritById } from './gabarits';
import { xfOf } from './poses';
import { apply, worldTransforms } from './kinematics';
import type { BoneId } from './bones';
import { weaponRest } from './anim/weaponClips';
import { buildWeapon } from '../../engine/items';
import { resolveById, planById, planOptsForRecord } from './bodyPlan';
import { QUAD_HARNAIS, DEFAUT_HARNAIS_MONTE } from './quadruped/harnais';
import { QUAD_REST } from './quadruped/quadPose';
import { bonesToSvg } from './renderBones';
import { MISSING_TONE } from './viewArt';
import { findCreatureById } from '../../data';
import { VIEWS, type View } from './facing';

/** Rendu d'un record par le chemin de PROD, PORTÉ (couture montée) ou LIBRE (pion de bête). */
const svg = (id: string, porte: boolean, over?: Parameters<typeof planOptsForRecord>[1], vue: View = 'profile'): string => {
  const r = resolveById(id);
  const opts = porte ? mountedPlanOpts(id, over) : planOptsForRecord(id, over);
  return bonesToSvg(planById(r.plan).resolve(r.species, vue, QUAD_REST, opts));
};

describe('le set par défaut du monté est une DONNÉE, servie par le registre', () => {
  it('l\'id déclaré en donnée existe au registre et est cuit pour le cheval', () => {
    const set = QUAD_HARNAIS[DEFAUT_HARNAIS_MONTE];
    expect(set, `« ${DEFAUT_HARNAIS_MONTE} » (renduMonte.json) absent du registre des sets`).toBeTruthy();
    expect(set.especes).toContain('cheval');
  });

  it('monture SANS harnais déclaré : le défaut arrive ; avec harnais déclaré : la donnée PRIME', () => {
    expect(findCreatureById('cheval')?.appearance?.harnais, 'le record `cheval` doit rester NU (L3)').toBeUndefined();
    expect(mountedPlanOpts('cheval').harnais).toBe(DEFAUT_HARNAIS_MONTE);
    expect(planOptsForRecord('cheval').harnais, 'monture LIBRE : aucun set').toBeUndefined();
    expect(mountedPlanOpts('cheval-de-monte').harnais).toBe(findCreatureById('cheval-de-monte')!.appearance!.harnais);
  });

  it('`harnais: \'\'` (nu explicite d\'un override d\'instance) reste respecté, même monté', () => {
    expect(mountedPlanOpts('cheval', { harnais: '' }).harnais).toBe('');
  });
});

describe('la monture PORTÉE rend le set au pixel (chemin de prod)', () => {
  it('un cheval nu monté rend la bête + la sellerie — exactement ce que rend une monture harnachée par sa donnée', () => {
    const libre = svg('cheval', false);
    const porte = svg('cheval', true);
    expect(porte, 'le set n\'atteint pas le rendu : la monture porterait un cavalier À CRU').not.toBe(libre);
    expect(porte).toBe(svg('cheval-de-monte', false)); // le record sellé par sa donnée, à l'octet
    expect(porte).not.toContain(MISSING_TONE);
    expect(svg('cheval', true, { harnais: '' }), 'nu explicite').toBe(libre);
  });

  // Couverture PAR VUE : le set est cuit pour les trois vues jouées. Un art de bout manquant
  // (front/back) rendrait la monture à cru de face ou de dos sans que le profil ne bronche.
  it('aux TROIS vues, la monture portée rend autre chose que la même monture nue', () => {
    for (const vue of VIEWS) {
      const libre = svg('cheval', false, undefined, vue);
      const porte = svg('cheval', true, undefined, vue);
      expect(porte, `vue ${vue} : le set n'atteint pas le rendu, la monture porterait à cru`).not.toBe(libre);
      expect(porte, `vue ${vue} : set refusé (espèce non cuite)`).not.toContain(MISSING_TONE);
    }
  });
});

describe('une monture dont l\'espèce n\'est pas cuite pour le set : ALARME visible, jamais un nu silencieux', () => {
  afterEach(() => vi.restoreAllMocks());

  it('le blaireau monté (ADE I 07 l.48) rend la caisse d\'alarme et nomme set + espèce', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveById('blaireau').species).toBe('blaireau'); // hors des `especes` du set
    const porte = svg('blaireau', true);
    expect(porte).toContain(MISSING_TONE);
    expect(svg('blaireau', false)).not.toContain(MISSING_TONE);
    const msg = warn.mock.calls.flat().join(' ');
    expect(msg).toContain(DEFAUT_HARNAIS_MONTE);
    expect(msg).toContain('blaireau');
  });
});

/**
 * CORPS ASSIS SANS MONTURE (figurant attablé) : une CHAISE N'EST PAS UNE SELLE — le corps n'enfourche
 * rien, il pose son bassin à la hauteur d'assise et sa cuisse sur le PLAN d'assise ; son pied touche
 * terre SI la jambe atteint le sol depuis ce siège, sinon il PEND (`seatedBodyPose`, résolue sur le
 * squelette, même règle que `mountedRig.ts` § CORPS ASSIS SUR UN SIÈGE) — et il porte la tenue d'arme
 * AU REPOS du fantassin, jamais une tenue montée ni un geste.
 */
describe('seatedRest — un attablé n’est pas un cavalier', () => {
  const HAMPE = buildWeapon({ label: 'Hallebarde', hands: 2, reach: 'Longue', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'empalement' }] });
  const SK: SeatedBody = { sk: groundSkeleton(baseSkeleton(gabaritById('humain'), 'M')), speciesPose: {}, viewPose: {}, };
  const ASSISE = 32; // unités de boîte — un tabouret, cf. `boxUnitsPerM`

  it('le corps assis vient de la primitive NEUTRE (jambes résolues), pas de la tenue d’arme', () => {
    const corps = seatedBodyPose('profile', SK, ASSISE);
    const pose = seatedRest('profile', SK, ASSISE, HAMPE);
    for (const os of ['bassin', 'cuisseG', 'cuisseD', 'tibiaG', 'tibiaD', 'piedG', 'piedD'] as const) {
      expect(corps[os], `l'assise doit poser ${os}`).toBeDefined();
      expect(pose[os], `${os} appartient à l'assise`).toEqual(corps[os]);
    }
  });

  it('l’assise n’est PAS la pose du cavalier : le bassin descend, aucun straddle', () => {
    const assis = seatedBodyPose('profile', SK, ASSISE);
    const cavalier = riderBodyPose('profile');
    expect(cavalier.bassin).toBeUndefined();          // en selle, le bassin est ancré par le composite
    expect(xfOf(assis, 'bassin').ty).toBeGreaterThan(20); // assis, il DESCEND à la hauteur du siège
    expect(assis.cuisseG).not.toEqual(cavalier.cuisseG);
  });

  it('la tenue est celle du REPOS à pied, PAS la tenue montée', () => {
    const repos = weaponRest(HAMPE);
    expect(seatedRest('profile', SK, ASSISE, HAMPE).arme).toBe(repos.arme);
    expect(mountedRest('profile', HAMPE).arme).not.toBe(repos.arme); // la hampe montée est AU PORT
  });

  /** Repères de jambe du corps de contrôle, MESURÉS sur son squelette : ce sont EXACTEMENT ceux dont
   *  le solveur d'assise tire ses deux bornes — le test ne repose sur aucun nombre posé à la main. */
  const R = (() => {
    const w = worldTransforms(SK.sk, {});
    const y = (id: BoneId, dy = 0) => apply(w[id], { x: 0, y: dy }).y;
    const cheville = y('piedD');
    return {
      solY: Math.max(y('piedG', SK.sk.piedG.length), y('piedD', SK.sk.piedD.length)),
      tibia: cheville - y('tibiaD'),                        // ce que le TIBIA seul descend sous le genou
      semelle: y('piedD', SK.sk.piedD.length) - cheville,   // hauteur du PIED sous la cheville
      jambe: cheville - y('cuisseD'),                       // descente hanche → cheville, corps debout
    };
  })();

  /** Jeu laissé à la projection de la semelle par le repli de la jambe (résidu mesuré ≤ 0,15 unité sur
   *  toute la plage) : la tolérance absorbe cela, jamais un enfoncement d'une hauteur de pied. */
  const JEU = 0.25;

  /** `anchor.h` d'un siège est ÉDITABLE : toute la plage doit rendre une jambe, pas une dégénérescence
   *  — et une jambe QUI TIENT SES BORNES. En haut, la descente hanche→cheville ne dépasse pas ce que
   *  le TIBIA seul permet (cuisse posée sur le plan d'assise) : la borne vaut tibia/jambe ≈ 0,48, pas
   *  1. En bas, le repli s'arrête à la hauteur du PIED, plancher de rendabilité de la compensation ;
   *  sous un siège plus bas que deux semelles, la semelle s'enfonce alors — d'au plus ce que ce
   *  plancher lui coûte (`2 × semelle − drop`), jamais davantage. */
  it('toute hauteur d’assise authorée rend une jambe : bornes tenues, semelle jamais plus bas que le repli minimal', () => {
    for (const drop of [0, 1, 5, 10, 20, 32, 60, 200]) {
      const p = seatedBodyPose('front', SK, drop);
      for (const os of ['cuisseG', 'cuisseD', 'piedG', 'piedD'] as const) {
        const { sy } = xfOf(p, os);
        expect(Number.isFinite(sy), `${os} @drop=${drop}`).toBe(true);
        expect(sy, `${os} @drop=${drop}`).toBeGreaterThan(0);
      }
      // Le PIED garde sa taille : son échelle compense EXACTEMENT celle héritée de la cuisse.
      expect(xfOf(p, 'cuisseD').sy * xfOf(p, 'piedD').sy).toBeCloseTo(1, 6);
      expect(xfOf(p, 'cuisseD').sy, `étirement @drop=${drop}`).toBeLessThanOrEqual(1);
      // BORNE HAUTE — la VRAIE : la descente de la jambe assise n'excède pas celle du tibia seul.
      expect(xfOf(p, 'cuisseD').sy * R.jambe, `descente @drop=${drop}`).toBeLessThanOrEqual(R.tibia + JEU);
      // BORNE BASSE — la semelle ne descend sous le sol que de ce que le repli minimal lui coûte.
      const w = worldTransforms(SK.sk, p);
      const semelleY = Math.max(apply(w.piedG, { x: 0, y: SK.sk.piedG.length }).y, apply(w.piedD, { x: 0, y: SK.sk.piedD.length }).y);
      const irreductible = Math.max(0, 2 * R.semelle - drop);
      expect(semelleY - R.solY, `enfoncement @drop=${drop}`).toBeLessThanOrEqual(irreductible + JEU);
    }
  });

  it('sans arme, il ne reste que l’assise', () => {
    expect(seatedRest('profile', SK, ASSISE)).toEqual(seatedBodyPose('profile', SK, ASSISE));
  });
});
