/**
 * CONTRAT — toute place de sort du document de PROJET est une forme que `remapSortsFusionnesDeep`
 * réécrit (#1897).
 *
 * QUESTION : `PROJECT_MIGRATIONS[15]` (`src/state/worldMap.ts`) confie à la primitive la réécriture des
 * ids FUSIONNÉS, places reconnues par leur FORME (clé + liste ou chaîne), pas par le schéma — une
 * migration ne lit pas la forme du jour. Le schéma COURANT déclare-t-il une place `idDe('spell')`
 * (`slotsDe(projetSchema)`) sous une forme que la primitive ne reconnaît pas ? Une place de plus sous
 * une clé inconnue rend ce banc rouge, en la NOMMANT.
 */
import { describe, expect, it } from 'vitest';
import { slotsDe } from './schemas/grammaire/slots';
import { projetSchema } from './schemas/defs-scenes/projet';
import { remapSortsFusionnesDeep } from './sortsFusionnes';

const PLACES = slotsDe('src/scenes', 'projet', projetSchema).filter((s) => s.type === 'spell');

/** La FORME terminale d'une place : la clé qui porte la valeur, et si la valeur est une liste. */
function formeDe(path: string): { cle: string; liste: boolean } {
  const liste = path.endsWith('[]');
  const sansListe = liste ? path.slice(0, -2) : path;
  return { cle: sansListe.slice(sansListe.lastIndexOf('.') + 1), liste };
}

describe('remapSortsFusionnesDeep — contrat avec les places de sort du schéma de projet', () => {
  it('le schéma déclare des places de sort (sans quoi le banc ne mesurerait rien)', () => {
    expect(PLACES.length).toBeGreaterThan(0);
  });

  it('chaque place `spell` de `slotsDe(projetSchema)` aboutit à une forme que la primitive réécrit', () => {
    const nonReecrites = PLACES.filter((s) => {
      const { cle, liste } = formeDe(s.path);
      const avant = { [cle]: liste ? ['alarme'] : 'alarme' };
      const attendu = { [cle]: liste ? ['alerte'] : 'alerte' };
      return JSON.stringify(remapSortsFusionnesDeep(avant)) !== JSON.stringify(attendu);
    }).map((s) => s.path);
    expect(nonReecrites).toEqual([]);
  });
});
