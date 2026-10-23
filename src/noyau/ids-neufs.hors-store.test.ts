/**
 * IDS NEUFS DU NOYAU (#2907) : une partie fabrique tout id qui circule par la fabrique de ses entrées
 * (`EntreesDeLaPartie.idNeuf`). Une fabrique MARQUEUSE retient ce qu'elle rend : sur un état gardé qui porte déjà
 * `hero-1` et `it-1`, tout id apparu dans l'état est l'un des siens, et aucun ne croise un id gardé.
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie } from './index';
import { createHero } from '../engine/character';
import { BOURSE_TRAPPING_ID } from '../engine/bourse';
import type { FabriqueDId } from '../lib/entityId';
import { fabriqueEnSequence } from '../lib/entityId.testkit';
import type { Combatant } from '../engine/types';

const SOLDAT = { speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gardé', seed: 4801 } as const;

const idsDu = (party: readonly Combatant[]): string[] => party.flatMap((h) => [h.id, ...(h.items ?? []).map((i) => i.uid)]);

/** Une fabrique qui rend des ids marqués et retient chacun. */
function marqueuse(): { idNeuf: FabriqueDId; emis: string[] } {
  const emis: string[] = [];
  return { emis, idNeuf: (genre) => { const id = `${genre}-marque-${emis.length + 1}`; emis.push(id); return id; } };
}

describe('la partie fabrique ses ids par la fabrique de ses entrées (#2907)', () => {
  it('un héros recruté sans Bourse la reçoit d’un uid de la fabrique ; aucun id neuf ne croise un id gardé', () => {
    const enSequence = fabriqueEnSequence();
    const garde = createHero({ ...SOLDAT, id: 'hero-1', idNeuf: enSequence });
    const recrue = createHero({ ...SOLDAT, label: 'Recrue', id: 'recrue', idNeuf: enSequence });
    recrue.items = (recrue.items ?? []).filter((i) => i.trappingId !== BOURSE_TRAPPING_ID);
    const pris = new Set(idsDu([garde, recrue]));
    expect([...pris]).toEqual(expect.arrayContaining(['hero-1', 'it-1']));

    const { idNeuf, emis } = marqueuse();
    const entrees: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {}, idNeuf };
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [garde] }, entrees);
    try {
      partie.envoyer({ type: 'partyAddHero', args: [recrue] });
      const apres = idsDu(partie.etat().party);
      const neufs = apres.filter((id) => !pris.has(id));
      expect(partie.etat().party.find((h) => h.id === 'recrue')?.items?.some((i) => i.trappingId === BOURSE_TRAPPING_ID), 'la recrue n’a pas reçu de Bourse').toBe(true);
      expect(neufs.length).toBeGreaterThan(0);
      expect(neufs.filter((id) => !emis.includes(id)), 'un id neuf n’est pas venu de la fabrique des entrées').toEqual([]);
    } finally {
      partie.fermer();
    }
  });

  it('un héros déjà au groupe est refusé, et le refus se dit au journal', () => {
    const garde = createHero({ ...SOLDAT, id: 'hero-1', idNeuf: fabriqueEnSequence() });
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [garde] }, { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {}, idNeuf: marqueuse().idNeuf });
    try {
      const r = partie.envoyer({ type: 'partyAddHero', args: [garde] });
      expect(partie.etat().party.map((h) => h.id)).toEqual(['hero-1']);
      expect(r.journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []))).toEqual(['Gardé est déjà dans le groupe.']);
    } finally {
      partie.fermer();
    }
  });
});
