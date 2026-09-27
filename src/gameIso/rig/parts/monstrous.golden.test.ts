import { VIEWS } from '../facing';
import { describe, it, expect } from 'vitest';
import {
  monsterInjection,
  MONSTER_HEAD_OPTIONS,
  MONSTER_ARM_OPTIONS,
  MONSTER_LEG_OPTIONS,
} from './monstrous';

// GOLDEN MASTER : fige le SVG résolu de monsterInjection AVANT la bascule vers le registre
// monster/defs/. Le refactor (extraction des parts en fichiers) doit préserver à l'octet
// près chaque part (front/back/profile) + chaque branche d'overlay. Si un snapshot bouge,
// c'est une régression — surtout PAS `-u` à l'aveugle.
const BOOL_OVERLAYS = ['griffes', 'verrues', 'plaie', 'cape', 'membresRouges'] as const;

describe('monsterInjection — golden master', () => {
  it('toutes les têtes × 3 vues', () => {
    const out: Record<string, unknown> = {};
    for (const o of MONSTER_HEAD_OPTIONS) {
      if (!o.key) continue;
      for (const v of VIEWS) out[`${o.key}.${v}`] = monsterInjection({ tete: o.key }, v);
    }
    expect(out).toMatchSnapshot();
  });

  it('tous les bras (G/D) + jambes', () => {
    const out: Record<string, unknown> = {};
    for (const o of MONSTER_ARM_OPTIONS) {
      if (!o.key) continue;
      out[`brasG.${o.key}`] = monsterInjection({ brasG: o.key });
      out[`brasD.${o.key}`] = monsterInjection({ brasD: o.key });
    }
    for (const o of MONSTER_LEG_OPTIONS) {
      if (!o.key) continue;
      out[`jambes.${o.key}`] = monsterInjection({ jambes: o.key });
    }
    expect(out).toMatchSnapshot();
  });

  it('cornes/queue × toutes les têtes (branches dépendantes de la tête)', () => {
    const out: Record<string, unknown> = {};
    for (const o of MONSTER_HEAD_OPTIONS) {
      const tete = o.key || undefined;
      out[`cornes.${o.key || 'none'}`] = monsterInjection({ cornes: true, tete });
      out[`queue.${o.key || 'none'}`] = monsterInjection({ queue: true, tete });
    }
    expect(out).toMatchSnapshot();
  });

  it('overlays booléens × 3 vues (cape = vue de face seulement)', () => {
    const out: Record<string, unknown> = {};
    for (const ov of BOOL_OVERLAYS) {
      for (const v of VIEWS) out[`${ov}.${v}`] = monsterInjection({ [ov]: true }, v);
    }
    expect(out).toMatchSnapshot();
  });

  it('catalogues d’options (clés + libellés + ordre)', () => {
    expect({
      heads: MONSTER_HEAD_OPTIONS,
      arms: MONSTER_ARM_OPTIONS,
      legs: MONSTER_LEG_OPTIONS,
    }).toMatchSnapshot();
  });
});
