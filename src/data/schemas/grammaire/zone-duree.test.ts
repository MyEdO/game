/**
 * Durée d'une op `zone` (#4202) : hors sort, la zone porte sa durée (`durationRounds`) — un Flow d'effet
 * déclenché qui pose une zone sans elle est refusé (`refuserLaZoneSansDuree`, `grammaire/mecanique.ts`) ; l'op d'un sort
 * dure le temps du sort (LDB 47 l.15) — `durationRounds` y est refusé (`defs/spells.ts`).
 */
import { describe, it, expect } from 'vitest';
import { validateDataset } from '../validate';
import trappingsJson from '../../trappings.json';
import spellsJson from '../../spells.json';
import { catalogueDuProcessus } from '../../catalogueDuProcessus';

type Entree = { id: string; onHitEffects?: { flow: { effet: { ops: Record<string, unknown>[] } } }[]; effects?: unknown };
const copie = <T>(doc: T): T => JSON.parse(JSON.stringify(doc)) as T;
const D10 = { dice: { n: 1, sides: 10 } };

/** L'op `zone` de la Bombe fumigène, dans une copie de `trappings.json`. */
function zoneDeLaFumigene(doc: Entree[]): Record<string, unknown> {
  const op = doc.find((t) => t.id === 'bombe-fumigene')?.onHitEffects?.[0].flow.effet.ops[0];
  if (op?.op !== 'zone') throw new Error('bombe-fumigene sans op zone à la touche');
  return op;
}

/** La première op `zone` d'un sort, dans une copie de `spells.json`. */
function premiereZoneDeSort(n: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(n)) { for (const e of n) { const z = premiereZoneDeSort(e); if (z) return z; } return undefined; }
  if (n == null || typeof n !== 'object') return undefined;
  const o = n as Record<string, unknown>;
  if (o.op === 'zone') return o;
  for (const v of Object.values(o)) { const z = premiereZoneDeSort(v); if (z) return z; }
  return undefined;
}

describe('durée d’une op zone (#4202)', () => {
  it('les données livrées passent la règle de durée', () => {
    expect(validateDataset('trappings.json', copie(trappingsJson), catalogueDuProcessus()) ?? '').not.toContain('op « zone »');
    expect(validateDataset('spells.json', copie(spellsJson), catalogueDuProcessus()) ?? '').not.toContain('op « zone »');
  });

  it('hors sort : une zone sans « durationRounds » est refusée', () => {
    const doc = copie(trappingsJson) as Entree[];
    delete zoneDeLaFumigene(doc).durationRounds;
    expect(validateDataset('trappings.json', doc, catalogueDuProcessus())).toContain('op « zone » hors sort sans « durationRounds »');
  });

  it('sort : une zone avec « durationRounds » est refusée', () => {
    const doc = copie(spellsJson) as Entree[];
    const zone = premiereZoneDeSort(doc);
    if (!zone) throw new Error('aucune op zone dans spells.json');
    zone.durationRounds = D10;
    expect(validateDataset('spells.json', doc, catalogueDuProcessus())).toContain('« durationRounds » interdit');
  });
});
