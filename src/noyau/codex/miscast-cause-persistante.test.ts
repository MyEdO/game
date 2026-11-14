/**
 * Rendu Codex de la rangée 81-87 de la Colère des dieux (« Purifier la chair », `LDB 40 l.75`) : la
 * cause récurrente gatée sur l'État qu'elle pose (`LDB 16 l.117`) se lit comme la PERSISTANCE d'UN
 * Inconscient, jamais comme un second État gagné. Le dialecte miscast a son renderer dédié
 * (`registry.ts::miscastOpRow`) : il partage le prédicat (`estCausePersistante`, `engine/ops.ts`) et
 * le terme joueur (`causePersistante`, `noyau/codex/humanize.ts`) avec les deux autres lecteurs.
 */
import { describe, it, expect } from 'vitest';
import { CODEX, type CodexRow } from './registry';
import { causePersistante } from './humanize';

function rangee() {
  const cat = CODEX.find((c) => c.key === 'colereDesDieux')!;
  const item = cat.items.find((i) => i.id === 'colere-purifier-la-chair')!;
  const rows: CodexRow[] = (item.sections ?? []).flatMap((s) => s.rows);
  return { item, rows };
}

describe('Codex — « Purifier la chair » 81-87 (LDB 40 l.75)', () => {
  it('UNE seule chip Inconscient : la pose littérale est absorbée par la cause qui la maintient', () => {
    const { rows } = rangee();
    const chips = rows.filter((r) => r.t === 'ref' && r.category === 'etats' && r.id === 'inconscient');
    expect(chips, 'la seconde op ne vaut pas un second État').toHaveLength(1);
    expect(rows.some((r) => r.t === 'sub' && r.label === 'Échec ≤ DR -4'), 'le palier reste nommé').toBe(true);
  });

  it('la persistance et sa durée se lisent au BADGE de la chip, comme chez l’autre lecteur (`opRows`)', () => {
    const { rows } = rangee();
    const chip = rows.find((r) => r.t === 'ref' && r.category === 'etats' && r.id === 'inconscient')!;
    expect(chip.t === 'ref' && chip.show).toBe('Inconscient');
    expect(chip.t === 'ref' && chip.badge).toBe(`${causePersistante()} · 1d10 Round(s)`);
    expect(rows.some((r) => r.t === 'text' && r.text.includes(causePersistante())), 'aucune ligne de texte parallèle').toBe(false);
  });
});
