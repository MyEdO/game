/**
 * Le dé de tirage d'une table (`deDeTirageSchema`) s'édite au formulaire tiré du schéma par deux saisies de
 * nombre entier de 1, `die/n` et `die/sides`, jamais par un texte (#4056, #841).
 */
import { describe, expect, it } from 'vitest';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { champsOfferts } from '../noyau/codex/editFields';
import { avecLaValeur } from '../noyau/edition/formulaire';
import { elementsDuFormulaireTire, type EcrivainDuFormulaire } from './formulaire';
import type { GesteDuCompendium } from '../noyau/index';

const op = { op: 'rollTable', die: { n: 1, sides: 10 }, entries: [{ min: 1, max: 10, ops: [] }] };

/** Les saisies des éléments du formulaire de l'op, par chemin écrit. */
function saisiesParChemin(): Map<string, { type: string; min?: number; pas?: number }> {
  const ecrivain: EcrivainDuFormulaire<string> = { porteur: 'op', emballe: ({ porteur: _, ...g }) => ({ compendium: g as GesteDuCompendium }) };
  const elements = elementsDuFormulaireTire(ecrivain, champsOfferts(gameOpSchema, op), op, () => false, []);
  const lues = new Map<string, { type: string; min?: number; pas?: number }>();
  for (const e of elements) {
    if (e.type !== 'formulaire' || e.verbe !== 'valeur') continue;
    const [, chemin, valeur] = e.champs;
    if (chemin.type === 'fixe') lues.set((chemin.valeur as string[]).join('/'), valeur as { type: string; min?: number; pas?: number });
  }
  return lues;
}

describe('dé de tirage au formulaire (`rollTable.die`)', () => {
  it('`die/n` et `die/sides` sont des saisies de nombre entier de 1', () => {
    const saisies = saisiesParChemin();
    for (const chemin of ['die/n', 'die/sides']) expect(saisies.get(chemin), chemin).toMatchObject({ type: 'saisieNombre', min: 1, pas: 1 });
  });

  it('écrit un nombre de dés ou des faces ; refuse zéro et le fractionnaire', () => {
    expect(avecLaValeur(gameOpSchema, op, ['die', 'n'], 2)).toMatchObject({ ok: true, valeur: { die: { n: 2, sides: 10 } } });
    expect(avecLaValeur(gameOpSchema, op, ['die', 'sides'], 100)).toMatchObject({ ok: true, valeur: { die: { n: 1, sides: 100 } } });
    expect(avecLaValeur(gameOpSchema, op, ['die', 'n'], 0)).toMatchObject({ ok: false });
    expect(avecLaValeur(gameOpSchema, op, ['die', 'sides'], 2.5)).toMatchObject({ ok: false });
  });
});
