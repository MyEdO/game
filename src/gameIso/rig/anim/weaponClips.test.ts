import { rotOf, type Pose } from '../poses';
import type { BoneId } from '../bones';
import { describe, it, expect } from 'vitest';
import { weaponRest, weaponAttackClip, weaponParryClip, mountedAttackClip, mountedParryClip, seatedClip, isRangedFamily } from './weaponClips';
import { clipDuration, CLIPS } from './clips';
import { findTrappingById } from '../../../data';
import type { Weapon } from '../../../engine/types';

// Construit l'arme comme au SPAWN (id de Possession → shape) ; le maniement est ensuite routé PAR ID STABLE
// (`shape` manufacturé / `attackKind` naturel), jamais par le libellé.
const w = (id: string, type: 'melee' | 'ranged' = 'melee', extra: Partial<Weapon> = {}): Weapon =>
  ({ label: findTrappingById(id)?.label ?? id, type, damage: { plusBF: false, flat: 4 }, qualities: [], shape: findTrappingById(id)?.shape, ...extra } as Weapon);

const windUp = (clip: ReturnType<typeof weaponAttackClip>) => clip.steps[0].pose;
const anyStep = (clip: ReturnType<typeof weaponAttackClip>, pred: (p: Pose) => boolean) =>
  clip.steps.some((s) => pred(s.pose));
const r = (p: Pose, id: BoneId) => rotOf(p, id);

describe('weaponAttackClip — gestes distincts par CLASSE DE MANIEMENT', () => {
  it('lourde 2 mains (Grande hache) lève plus haut que la lame 1 main (Dague)', () => {
    expect(r(windUp(weaponAttackClip(w('grande-hache'))), 'epauleD'))
      .toBeLessThan(r(windUp(weaponAttackClip(w('dague'))), 'epauleD'));
  });

  it('hampe (Lance) perce : fente du buste/bassin vers l’avant, peu de lever de bras', () => {
    const lance = weaponAttackClip(w('lance'));
    expect(anyStep(lance, (p) => r(p, 'torse') >= 6 && r(p, 'bassin') >= 3)).toBe(true);
    expect(Math.abs(r(windUp(lance), 'epauleD'))).toBeLessThan(40);
  });

  it('hampe : la hampe se ramène pointe en avant (gros delta `arme` à l’apex)', () => {
    expect(anyStep(weaponAttackClip(w('lance')), (p) => r(p, 'arme') >= 90)).toBe(true);
  });

  it('Arc utilise le bras GAUCHE tendu en avant (pousse l’arc) et tire en arrière', () => {
    const arc = weaponAttackClip(w('arc-long', 'ranged'));
    expect(anyStep(arc, (p) => r(p, 'epauleG') > 20)).toBe(true);
    expect(anyStep(arc, (p) => r(p, 'epauleD') < -20)).toBe(true);
  });

  it('Escrime (Rapière) frappe plus vite qu’une lourde 2 mains', () => {
    expect(clipDuration(weaponAttackClip(w('rapiere'))))
      .toBeLessThan(clipDuration(weaponAttackClip(w('grande-hache'))));
  });

  it('Arme à feu (Pistolet) : recul vers le haut (tête/torse reculent)', () => {
    const pistol = weaponAttackClip(w('pistolet', 'ranged'));
    expect(anyStep(pistol, (p) => r(p, 'tete') <= -4 && r(p, 'torse') <= -6)).toBe(true);
  });

  it('la FORME prime : bec-de-corbin (Groupe Cavalerie) frappe comme une lame 1 main, pas comme une lance', () => {
    expect(weaponAttackClip(w('marteau-a-bec-de-corbin'))).toBe(weaponAttackClip(w('dague')));
  });

  it('fallback : arme non cataloguée → lame1m (mêlée) / arc (distance)', () => {
    expect(weaponAttackClip(w('truc-bizarre', 'melee'))).toBe(weaponAttackClip(w('dague')));
    expect(weaponAttackClip(w('engin-inconnu', 'ranged'))).toBe(weaponAttackClip(w('arc-long', 'ranged')));
  });
});

describe('weaponRest — l’arme est tenue/orientée selon la classe', () => {
  it('classes différentes → repos différents (Arc vs Dague)', () => {
    expect(weaponRest(w('arc-long', 'ranged'))).not.toEqual(weaponRest(w('dague')));
  });
  it('hampe (Pique) oriente l’arme et engage les deux mains', () => {
    const r = weaponRest(w('pique'));
    expect(r.arme).toBeDefined(); // hampe relevée (pas pointe-bas)
    expect(r.epauleG).toBeDefined(); // main gauche amenée sur la hampe
  });
  it('lame 1 main (Dague) = repos neutre (pointe-bas au côté)', () => {
    expect(weaponRest(w('dague'))).toEqual({});
  });
  it('toute arme à 2 mains engage la main gauche au repos', () => {
    for (const n of ['zweihander', 'hallebarde', 'arquebuse']) {
      const type = n === 'arquebuse' ? 'ranged' : 'melee';
      expect(weaponRest(w(n, type)).epauleG, n).toBeDefined();
    }
  });
  it('sans arme → pose neutre', () => {
    expect(weaponRest(undefined)).toEqual({});
  });
});

describe('weaponParryClip — garde adaptée à la classe', () => {
  it('avec bouclier → garde du bras gauche', () => {
    const p = weaponParryClip(w('rapiere'), true).steps[0].pose;
    expect(p.epauleG).toBeDefined();
  });
  it('escrime sans bouclier → opposition du bras d’arme (droit)', () => {
    const p = weaponParryClip(w('rapiere'), false).steps[0].pose;
    expect(p.epauleD).toBeDefined();
  });
  it('mêlée à deux mains (Bâton de combat) → blocage des deux bras, coudes fléchis', () => {
    const p = weaponParryClip(w('baton-de-combat'), false).steps[0].pose;
    expect(p.epauleG).toBeDefined();
    expect(p.epauleD).toBeDefined();
    // hampe relevée en travers : les DEUX avant-bras plient (coudes), pas juste les épaules.
    expect(r(p, 'avantBrasG')).toBeLessThan(0);
    expect(r(p, 'avantBrasD')).toBeLessThan(0);
  });
  it('un tireur (Arc) esquive au lieu de parer', () => {
    const p = weaponParryClip(w('arc-long', 'ranged'), false).steps[0].pose;
    expect(p.bassin).toBeDefined();
  });
});

describe('clips MONTÉS — gestes en selle (deltas sur mountedRest, jamais bassin/jambes)', () => {
  const SEATED_LOCKED = /^(bassin|cuisse|tibia|pied)/;
  const touchesSeat = (clip: ReturnType<typeof mountedAttackClip>) =>
    clip.steps.some((s) => Object.keys(s.pose).some((k) => SEATED_LOCKED.test(k)));

  it('aucun clip d’attaque monté ne touche le bassin ni les jambes (dédiés ET replis assis)', () => {
    for (const n of ['lance-de-cavalerie', 'dague', 'rapiere', 'grande-hache', 'hallebarde', 'fouet', 'javelot', 'fleau']) {
      expect(touchesSeat(mountedAttackClip(w(n))), n).toBe(false);
    }
    for (const n of ['arc-long', 'arbalete', 'pistolet']) {
      expect(touchesSeat(mountedAttackClip(w(n, 'ranged'))), n).toBe(false);
    }
  });

  // Angle MONDE de l'arme (delta) = arme + epauleD + avantBrasD — l'os `arme` suit la main.
  const worldArme = (p: Pose) => r(p, 'arme') + r(p, 'epauleD') + r(p, 'avantBrasD');

  it('charge lance couchée ≠ clip à pied : l’épaule projette mais la lance RESTE en arrêt (angle monde quasi constant)', () => {
    const lance = w('lance-de-cavalerie');
    const monte = mountedAttackClip(lance);
    expect(monte).not.toEqual(weaponAttackClip(lance)); // le clip à pied abaisse la lance (arme +125)
    expect(monte.steps.every((s) => Math.abs(worldArme(s.pose)) <= 12)).toBe(true);
    // l'épaule PROJETTE le poing en AVANT (profil natif : négatif = avant, sonde FK).
    expect(monte.steps.some((s) => r(s.pose, 'epauleD') <= -20)).toBe(true);
  });

  it('taille à cheval (1 main) : la pointe BALAIE un grand arc monde (armé arrière → fauche avant)', () => {
    const worlds = mountedAttackClip(w('dague')).steps.map((s) => worldArme(s.pose));
    expect(Math.max(...worlds) - Math.min(...worlds)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...worlds)).toBeLessThanOrEqual(140); // jamais pointe vers l’ARRIÈRE (> 180 monde)
  });

  it('recul monté d’une arme à feu : le bras d’arme plie au coude (avantBrasD)', () => {
    const clip = mountedAttackClip(w('pistolet', 'ranged'));
    expect(clip.steps.some((s) => r(s.pose, 'avantBrasD') < 0)).toBe(true);
  });

  it('le geste monté se joue sur le bras qui tient l’arme : tentacule → miroir gauche', () => {
    const t = mountedAttackClip(w('tentacule', 'melee', { attackKind: 'tentacules' }));
    expect(t.steps.some((s) => 'epauleG' in s.pose)).toBe(true);
    expect(t.steps.every((s) => !('arme' in s.pose))).toBe(true); // miroir = sans delta arme (ancrée à droite)
  });

  it('parade montée : un tireur (Arc) se dérobe SANS basculer le bassin (vs la version à pied)', () => {
    const arc = w('arc-long', 'ranged');
    expect(weaponParryClip(arc, false).steps[0].pose.bassin).toBeDefined();
    expect(touchesSeat(mountedParryClip(arc, false))).toBe(false);
  });

  it('seatedClip purge bassin/jambes des clips de base (dodge/hit/walk) en gardant le buste', () => {
    for (const name of ['dodge', 'hit', 'walk'] as const) {
      expect(seatedClip(CLIPS[name]).steps.some((s) => Object.keys(s.pose).some((k) => SEATED_LOCKED.test(k))), name).toBe(false);
    }
    expect(seatedClip(CLIPS.dodge).steps[0].pose.torse).toBeDefined();
  });
});

describe('isRangedFamily (via classe de maniement)', () => {
  it('classe les familles à distance', () => {
    expect(isRangedFamily(w('arc-long', 'ranged'))).toBe(true);
    expect(isRangedFamily(w('pistolet', 'ranged'))).toBe(true);
    expect(isRangedFamily(w('dague'))).toBe(false);
  });
});
