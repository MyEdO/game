import { describe, it, expect } from 'vitest';
import { CLIPS, clipDuration, sampleClip } from './clips';
import { ROLES_DE_COMBAT } from '../../../noyau/animation';

const NAMES = ROLES_DE_COMBAT;

describe('CLIPS', () => {
  it('chaque clip existe et a une durée > 0', () => {
    for (const n of NAMES) {
      expect(CLIPS[n]).toBeTruthy();
      expect(clipDuration(CLIPS[n])).toBeGreaterThan(0);
    }
  });
  it('le registre ne porte QUE ces clips (l’énumération du test ne peut pas dériver)', () => {
    expect(Object.keys(CLIPS).sort()).toEqual([...NAMES].sort());
  });
  it('onImpact (si présent) ≤ durée totale', () => {
    for (const n of NAMES) {
      const c = CLIPS[n];
      if (c.onImpact != null) expect(c.onImpact).toBeLessThanOrEqual(clipDuration(c));
    }
  });
  it('melee/ranged/cast déclenchent un impact ; idle/walk bouclent', () => {
    expect(CLIPS.melee.onImpact).toBeGreaterThan(0);
    expect(CLIPS.ranged.onImpact).toBeGreaterThan(0);
    expect(CLIPS.cast.onImpact).toBeGreaterThan(0);
    expect(CLIPS.idle.loop).toBe(true);
    expect(CLIPS.walk.loop).toBe(true);
    expect(CLIPS.melee.loop).toBeFalsy();
  });
});

describe('sampleClip', () => {
  it('déterministe et borné', () => {
    expect(JSON.stringify(sampleClip(CLIPS.melee, 50))).toBe(JSON.stringify(sampleClip(CLIPS.melee, 50)));
  });
  it('clip non-bouclé : done=true après la durée', () => {
    expect(sampleClip(CLIPS.melee, clipDuration(CLIPS.melee) + 10).done).toBe(true);
  });
  it('clip bouclé : jamais done', () => {
    expect(sampleClip(CLIPS.idle, clipDuration(CLIPS.idle) * 3 + 5).done).toBe(false);
  });
  it('renvoie une Pose (objet) à mi-clip', () => {
    const { pose } = sampleClip(CLIPS.melee, 50);
    expect(typeof pose).toBe('object');
  });
});
