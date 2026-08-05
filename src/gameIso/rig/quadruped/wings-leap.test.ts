import { describe, it, expect } from 'vitest';
import { resolveWing, wingedPlan } from '../winged/composeWing';
import { quadrupedPlan, resolveQuadFromProps } from './composeQuad';
import { quadLeapPose, quadWalkPose } from './quadPose';
import { EYE_OPTIONS, eyesArtFromKeys } from '../parts/eyes';
import type { View } from '../facing';

const svgOf = (wings?: 'folded' | 'spread') =>
  resolveWing('Dragon', 'profile', {}, undefined, wings).map((b) => b.parts.map((p) => p.svg).join('')).join('');

describe('ailes pliées/déployées (WingState)', () => {
  it("au REPOS (défaut) les ailes sont PLIÉES le long du dos (marqueur data-wing='folded')", () => {
    expect(svgOf()).toContain('data-wing="folded"');
    expect(svgOf('folded')).toContain('data-wing="folded"');
  });
  it('DÉPLOYÉES sur demande (vol/attaque) : art différent, plus de marqueur plié', () => {
    const spread = svgOf('spread');
    expect(spread).not.toContain('data-wing="folded"');
    expect(spread).not.toBe(svgOf('folded'));
  });
  it('le plan ailé route ResolveOpts.wings (parité resolve direct)', () => {
    const viaPlan = wingedPlan.resolve('Dragon', 'profile', {}, { wings: 'spread' }).map((b) => b.parts.map((p) => p.svg).join('')).join('');
    expect(viaPlan).toBe(svgOf('spread'));
  });
});

describe('props de finesse (ridge / markings / headScale / tailLen)', () => {
  const base = { sl: 1, build: 'equine', girth: 1, bodyLen: 1, neckLen: 1, neckAngle: -40, legLen: 1, head: 'cheval', tail: 'crin', mane: 'crin', ears: 'courtes', foot: 'sabot', stored: {} } as never;
  const osQuad = (props: Record<string, unknown>, view: View = 'profile') =>
    resolveQuadFromProps({ ...(base as object), ...props } as never, view);
  const svgQuad = (props: Record<string, unknown>) =>
    osQuad(props).map((b) => b.parts.map((p) => p.svg).join('')).join('');
  /** Échelle portée par l'OS `tete` (les deux axes sont égaux : la tête s'échelonne uniformément). */
  const echelleTete = (props: Record<string, unknown>, view: View = 'profile') =>
    osQuad(props, view).find((b) => b.id === 'tete')!.scale;
  it('ridge : épines par DÉFAUT pour draconic, paramétrable (crête/plaques), sans pour les autres', () => {
    expect(svgQuad({ build: 'draconic' })).toContain('data-ridge="epines"');
    expect(svgQuad({ build: 'draconic', ridge: 'crete' })).toContain('data-ridge="crete"');
    expect(svgQuad({ ridge: 'plaques' })).toContain('data-ridge="plaques"');
    expect(svgQuad({})).not.toContain('data-ridge');
  });
  it('markings : taches/rayures sur le flanc, balzanes sur les MEMBRES', () => {
    expect(svgQuad({ markings: 'taches' })).toContain('data-marking="taches"');
    expect(svgQuad({ markings: 'rayures' })).toContain('data-marking="rayures"');
    expect(svgQuad({ markings: 'balzanes' })).toContain('data-marking="balzanes"');
    expect(svgQuad({})).not.toContain('data-marking');
  });
  it('headScale : échelle de l’OS tête (×1,3 de profil) ; tailLen : enveloppe d’échelle sur la queue', () => {
    // La tête s'échelonne par l'OS (comme un membre ou la carrure) : `headScale` ne paraît PLUS
    // dans l'art, il paraît dans `ResolvedBone.scale`. De profil, le socle l'agrandit de 1,3.
    expect(echelleTete({ headScale: 1.3 })[0]).toBeCloseTo(1.69, 6);
    expect(echelleTete({ headScale: 1.3 })[1]).toBeCloseTo(1.69, 6);
    expect(echelleTete({ headScale: 1.3 }, 'front')[0]).toBeCloseTo(1.3, 6);
    expect(echelleTete({})[0]).toBeCloseTo(1.3, 6); // sans headScale : le 1,3 du profil seul
    expect(echelleTete({}, 'front')[0]).toBeCloseTo(1, 6);
    expect(svgQuad({ headScale: 1.3 })).not.toContain('scale(1.3)'); // l'art de tête n'en porte plus
    expect(svgQuad({ tailLen: 1.4 })).toContain('scale(1.4)');
  });
  it('yeux des têtes quad ANCRÉS (data-eye) — prêts pour le catalogue d’yeux', () => {
    expect(svgQuad({})).toContain('data-eye="D"');
  });
});

describe('yeux du catalogue sur les têtes de gabarit (ancres data-eye)', () => {
  const svgQuadEyes = (eyes?: { G?: string; D?: string }) =>
    quadrupedPlan.resolve('Loup', 'profile', {}, { eyes }).map((b) => b.parts.map((p) => p.svg).join('')).join('');
  it("l'art du catalogue remplace l'œil ancré (profil = œil D)", () => {
    expect(svgQuadEyes({ D: EYE_OPTIONS.rouge.art })).toContain('data-eye-art="rouge"');
    expect(svgQuadEyes()).not.toContain('data-eye-art');
  });
  it('eyesArtFromKeys : clés éditeur → arts (clé inconnue/vide ignorée)', () => {
    expect(eyesArtFromKeys({ D: 'chat' })?.D).toBe(EYE_OPTIONS.chat.art);
    expect(eyesArtFromKeys({ D: 'inconnu' })).toBeUndefined();
    expect(eyesArtFromKeys(undefined)).toBeUndefined();
  });
});

describe('Bond (trait LDB 85) — démarche bondissante', () => {
  it('les plans quadrupède ET ailé exposent leapPose', () => {
    expect(quadrupedPlan.leapPose).toBeDefined();
    expect(wingedPlan.leapPose).toBeDefined();
  });
  it('détente (phase 0.25) : avants jetés en AVANT, arrières étendus — distinct du trot', () => {
    const leap = quadLeapPose(0.25);
    expect(leap.hautAvD!).toBeLessThan(-30);
    expect(leap.hautArD!).toBeGreaterThan(25);
    expect(leap).not.toEqual(quadWalkPose(0.25));
  });
  it('ramassé (phase 0.75) : pattes repliées sous le corps, dos arqué', () => {
    const leap = quadLeapPose(0.75);
    expect(leap.basAvD!).toBeLessThan(-20); // avant replié
    expect(leap.croupe!).toBeLessThan(0); // dos arqué
  });
});
