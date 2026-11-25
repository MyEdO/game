/**
 * Rendu Codex de la rangée 81-87 de la Colère des dieux (« Purifier la chair », `LDB 40 l.75`) : l'État
 * porté du palier « −4 DR » se lit en UNE chip, sa durée propre au badge (`registry.ts::miscastOpRow`).
 */
import { describe, it, expect } from 'vitest';
import { CODEX, type CodexRow } from './registry';

function rangee(): CodexRow[] {
  const cat = CODEX.find((c) => c.key === 'colereDesDieux')!;
  const item = cat.items.find((i) => i.id === 'colere-purifier-la-chair')!;
  return (item.sections ?? []).flatMap((s) => s.rows);
}

describe('Codex — « Purifier la chair » 81-87 (LDB 40 l.75)', () => {
  it('le palier « −4 DR » contient EXACTEMENT une chip Inconscient, de 1d10 Rounds', () => {
    const rows = rangee();
    const palier = rows.findIndex((r) => r.t === 'sub' && r.label === 'Échec ≤ DR -4');
    expect(palier, 'le palier reste nommé').toBeGreaterThanOrEqual(0);
    expect(rows.slice(palier + 1)).toEqual([
      { t: 'ref', category: 'etats', id: 'inconscient', label: 'Inconscient', show: 'Inconscient', badge: '1d10 Round(s)' },
    ]);
  });
});
