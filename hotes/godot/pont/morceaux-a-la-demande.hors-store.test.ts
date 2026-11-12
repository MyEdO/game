/**
 * `morceaux` NE CALCULE QUE CE QU'ON LUI DEMANDE (#3993) : une liste de clés vide ne calcule pas sa famille, une clé
 * demandée la calcule.
 */
import { describe, expect, it, vi } from 'vitest';
import { mondeDe, table } from './pont.testkit';
import type { MorceauxDuPont } from './pont';
import * as volume from '../../../src/noyau/monde/volume/volume';

/** Compte les appels de `volumeDuMonde`, `toitsDuMonde` et `couronnesDuMonde`, chacun rendant ce que rend l'original. */
function compter(): Record<'volumeDuMonde' | 'toitsDuMonde' | 'couronnesDuMonde', number> {
  const ns = volume as unknown as Record<string, unknown>;
  const n = { volumeDuMonde: 0, toitsDuMonde: 0, couronnesDuMonde: 0 };
  for (const nom of Object.keys(n) as (keyof typeof n)[]) {
    const vrai = ns[nom] as (...a: unknown[]) => unknown;
    vi.spyOn(ns, nom, 'get').mockReturnValue((...a: unknown[]) => (n[nom]++, vrai(...a)));
  }
  return n;
}

describe('morceaux à la demande', () => {
  it('des listes vides ne calculent rien ; une clé de toit calcule les toits, seuls', () => {
    const { appel } = table();
    appel('demarrer', { scenario: 'diligence' });
    const toit = mondeDe(appel).toits[0].cle;
    const n = compter();

    const vide = appel('morceaux', { source: 'partie', volume: [], toits: [], couronnes: [] }) as unknown as MorceauxDuPont;
    expect([vide.volume, vide.toits, vide.couronnes]).toEqual([[], [], []]);
    expect(n).toEqual({ volumeDuMonde: 0, toitsDuMonde: 0, couronnesDuMonde: 0 });

    const unToit = appel('morceaux', { source: 'partie', volume: [], toits: [toit], couronnes: [] }) as unknown as MorceauxDuPont;
    expect(unToit.toits.map(({ cle }) => cle)).toEqual([toit]);
    expect(n).toEqual({ volumeDuMonde: 0, toitsDuMonde: 1, couronnesDuMonde: 0 });
    appel('quitter');
  });
});
