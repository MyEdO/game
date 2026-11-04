/**
 * CÂBLAGE de l'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`), part de la FICHE : les rubriques de
 * `SpellData.ritual` atteignent la fiche Codex des Sorts (`registry.ts`). Débrancher `ritualSection`
 * ou le fait `NI`/`PX` le rend rouge. La donnée et le grimoire : `src/data/rituel-anatomie.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { spells } from '../../data/index';
import { CODEX } from './registry';
import type { CodexItem } from './registry';

const RITUELS = spells.filter((s) => s.isRitual);
const items = new Map<string, CodexItem>(CODEX.find((c) => c.key === 'spells')!.items.map((i) => [i.id, i]));
const textOf = (item: CodexItem): string =>
  (item.sections ?? []).filter((s) => s.title === 'Rituel').flatMap((s) => s.rows).map((r) => (r.t === 'text' ? r.text : '')).join('\n');
const factOf = (item: CodexItem, label: string): string | undefined => (item.meta ?? []).find((f) => f.label === label)?.value;

describe('fiche Codex — chaque rubrique admise atteint le lecteur', () => {
  it('les quatre rubriques de prose sont rendues VERBATIM, pour les 17', () => {
    for (const r of RITUELS) {
      const item = items.get(r.id)!;
      expect(item, r.id).toBeTruthy();
      const md = textOf(item);
      for (const k of ['type', 'components', 'conditions', 'sacrifices', 'consequences'] as const) {
        expect(md, `${r.id}.${k}`).toContain(r.ritual![k]);
      }
    }
  });

  it('les PX d’apprentissage sont un fait d’en-tête, pour les 17', () => {
    for (const r of RITUELS) {
      const attendu = r.ritual!.reduced ? `${r.ritual!.xp} (${r.ritual!.reduced.xp})` : String(r.ritual!.xp);
      expect(factOf(items.get(r.id)!, 'PX d’apprentissage'), r.id).toBe(attendu);
    }
  });

  it('NI : le nombre imprimé, ou le texte de la rubrique quand elle vise la cible', () => {
    // `VDM 02 l.398` : « **NI :** 50 (25) » — la parenthèse de difficulté réduite est imprimée.
    expect(factOf(items.get('art-de-la-malediction')!, 'NI')).toBe('50 (25)');
    expect(factOf(items.get('art-de-la-malediction')!, 'PX d’apprentissage')).toBe('200 (100)');
    const variable = RITUELS.filter((r) => r.cn == null);
    expect(variable.map((r) => r.id)).toEqual(['les-faux-croisees', 'invocation-de-demon', 'lier-une-bete-monstrueuse']);
    for (const r of variable) expect(factOf(items.get(r.id)!, 'NI'), r.id).toBe(r.ritual!.cnFrom);
  });
});
