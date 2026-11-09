/**
 * #2968 L16 — la créature de base d'un preset de PNJ (`narratif.presetsPnj[].base`) se désigne par `ref('creature')` :
 * `{ id }` refiné au parse contre l'index des ids. Fixtures : le projet réel, référence connue, inconnue, écrite en
 * id nu. Le porteur n'est pas une liste.
 */
import { describe, expect, it } from 'vitest';
import { presetPnjSchema } from './narratif';
import { projetSchema } from './projet';
import { mesureDuParse } from '../grammaire/ref';
import { versDisque } from '../grammaire/prose';
import diligenceProjet from '../../../scenes/diligence/diligence-projet.json';

const preset = (base: unknown) => ({ id: 'pnj', base });

describe('#2968 L16 — la base d’un preset de PNJ désignée par `ref(\'creature\')`', () => {
  it('le projet réel parse, et chaque base de preset est un slot `creature` au parse de mesure', () => {
    const doc = versDisque(diligenceProjet);
    expect(projetSchema.safeParse(doc).error).toBeUndefined();
    const bases = mesureDuParse(projetSchema, doc).reperes.filter((r) => r.path[1] === 'presetsPnj' && r.path[3] === 'base');
    expect(bases.map((r) => r.type)).toEqual(diligenceProjet.narratif.presetsPnj.filter((p) => 'base' in p).map(() => 'creature'));
    expect(bases.length).toBeGreaterThan(0);
  });

  it('une référence connue parse', () => {
    expect(presetPnjSchema.safeParse(preset({ id: 'humain' })).error).toBeUndefined();
  });

  it('une référence inconnue est refusée, son catalogue nommé', () => {
    const r = presetPnjSchema.safeParse(preset({ id: 'creature-inexistante' }));
    expect(r.error?.issues.map((i) => `${i.path.join('.')} ${i.message}`)).toEqual([
      'base.id « creature-inexistante » est absent du catalogue des créatures (creatures.json).',
    ]);
  });

  it('une référence écrite en id nu est refusée', () => {
    expect(presetPnjSchema.safeParse(preset('humain')).success).toBe(false);
  });
});
