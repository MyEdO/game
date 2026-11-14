/**
 * #1667 B3a — les champs d'identité des documents de niche ne se dupliquent pas : le couple (`jeu`,
 * `localisation`) de `criticals.json`, clé de recherche de `critiqueDoc`, est unique au parse.
 */
import { describe, expect, it } from 'vitest';
import { schema as schemaCritiques } from './criticals';
import { schema as schemaMiscast } from './miscast';
import criticalsJson from '../../criticals.json';
import miscastJson from '../../miscast.json';

type Doc = { id: string; [k: string]: unknown };
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }): string =>
  r.success ? '' : r.error!.issues.map((i) => i.message).join(' ');

describe('identité des documents de niche (#1667 B3a)', () => {
  it('les documents réels parsent', () => {
    expect(messages(schemaMiscast.safeParse(miscastJson))).toBe('');
    expect(messages(schemaCritiques.safeParse(criticalsJson))).toBe('');
  });

  it('criticals.json : deux documents au même (`jeu`, `localisation`) sont refusés, les deux ids nommés', () => {
    const docs = structuredClone(criticalsJson) as Doc[];
    const [premier, second] = docs;
    second.localisation = premier.localisation;
    const r = schemaCritiques.safeParse(docs);
    expect(r.success).toBe(false);
    expect(messages(r)).toContain(`« ${premier.id} » et « ${second.id} »`);
  });
});
