/**
 * La quantité d'une dotation (`countSpecSchema`) s'édite au formulaire tiré du schéma par des saisies de nombre
 * entier de 1 : `count/fixed`, ou le dé de tirage `count/roll/n` et `count/roll/sides`, jamais par un texte ni par
 * un multiplicateur ou un ajout (#4056, #841). LDB 08 l.238, l.965, l.1667
 */
import { describe, expect, it } from 'vitest';
import { dotationDeCatalogueSchema } from '../data/schemas/grammaire/reference';
import { champsOfferts } from '../noyau/codex/editFields';
import { avecLaValeur } from '../noyau/edition/formulaire';
import { elementsDuFormulaireTire, type EcrivainDuFormulaire } from './formulaire';
import type { GesteDuCompendium } from '../noyau/index';

const fixe = { id: 'carreau', count: { fixed: 10 } };
const tire = { id: 'carreau', count: { roll: { n: 2, sides: 10 } } };
const ecrivain: EcrivainDuFormulaire<string> = { porteur: 'dotation', emballe: ({ porteur: _, ...g }) => ({ compendium: g as GesteDuCompendium }) };
const elements = (d: Record<string, unknown>) => elementsDuFormulaireTire(ecrivain, champsOfferts(dotationDeCatalogueSchema, d), d, () => false, []);

/** Les saisies des éléments du formulaire de la dotation, par chemin écrit. */
function saisiesParChemin(d: Record<string, unknown>): Map<string, { type: string; min?: number; pas?: number }> {
  const lues = new Map<string, { type: string; min?: number; pas?: number }>();
  for (const e of elements(d)) {
    if (e.type !== 'formulaire' || e.verbe !== 'valeur') continue;
    const [, chemin, valeur] = e.champs;
    if (chemin.type === 'fixe') lues.set((chemin.valeur as string[]).join('/'), valeur as { type: string; min?: number; pas?: number });
  }
  return lues;
}

describe('quantité d’une dotation au formulaire (`count`)', () => {
  it('`count/fixed`, `count/roll/n` et `count/roll/sides` sont des saisies de nombre entier de 1', () => {
    expect(saisiesParChemin(fixe).get('count/fixed')).toMatchObject({ type: 'saisieNombre', min: 1, pas: 1 });
    const duJet = saisiesParChemin(tire);
    for (const chemin of ['count/roll/n', 'count/roll/sides']) expect(duJet.get(chemin), chemin).toMatchObject({ type: 'saisieNombre', min: 1, pas: 1 });
    expect([...duJet.keys()].filter((c) => c.startsWith('count/roll/') && !['count/roll/n', 'count/roll/sides'].includes(c))).toEqual([]);
  });

  it('le choix de la variante pose `{fixed: 1}` ou `{roll: {n: 1, sides: 1}}`', () => {
    const choix = elements(fixe).find((e) => e.type === 'choix' && e.id === 'valeur/count/forme');
    expect(choix?.type === 'choix' ? choix.valeurs.map((b) => b.libelle) : null).toEqual(['fixé', 'jet']);
    expect(avecLaValeur(dotationDeCatalogueSchema, tire, ['count'], { fixed: 1 })).toMatchObject({ ok: true, valeur: { count: { fixed: 1 } } });
    expect(avecLaValeur(dotationDeCatalogueSchema, fixe, ['count'], { roll: { n: 1, sides: 1 } })).toMatchObject({ ok: true, valeur: { count: { roll: { n: 1, sides: 1 } } } });
    expect(avecLaValeur(dotationDeCatalogueSchema, tire, ['count'], { fixed: 0 })).toMatchObject({ ok: false });
    expect(avecLaValeur(dotationDeCatalogueSchema, fixe, ['count'], { roll: { n: 0, sides: 0 } })).toMatchObject({ ok: false });
  });

  it('écrit une quantité entière de 1 ; refuse zéro, le négatif, le fractionnaire et l’ajout', () => {
    expect(avecLaValeur(dotationDeCatalogueSchema, fixe, ['count', 'fixed'], 1000)).toMatchObject({ ok: true, valeur: { count: { fixed: 1000 } } });
    for (const v of [0, -3, 1.5]) expect(avecLaValeur(dotationDeCatalogueSchema, fixe, ['count', 'fixed'], v), `fixed=${v}`).toMatchObject({ ok: false });
    expect(avecLaValeur(dotationDeCatalogueSchema, tire, ['count', 'roll', 'n'], 8)).toMatchObject({ ok: true, valeur: { count: { roll: { n: 8, sides: 10 } } } });
    expect(avecLaValeur(dotationDeCatalogueSchema, tire, ['count', 'roll', 'n'], 0)).toMatchObject({ ok: false });
    expect(avecLaValeur(dotationDeCatalogueSchema, tire, ['count', 'roll', 'sides'], 2.5)).toMatchObject({ ok: false });
    expect(avecLaValeur(dotationDeCatalogueSchema, tire, ['count', 'roll', 'plus'], 3)).toMatchObject({ ok: false });
  });
});
