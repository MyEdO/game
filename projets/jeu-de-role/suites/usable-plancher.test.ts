/**
 * PLANCHER — aucune instance LIVRÉE ne devient muette (#1687, méthode de la sonde du juge).
 *
 * Lecture des paquets livrés en PLANCHER, jamais en assertion de contenu : l'égalité comparée est
 * DÉRIVÉE des deux côtés (offre AVANT le lot = capacités d'instance + places du TYPE ; offre APRÈS =
 * `estUtilisable`). Aucun nombre n'est récité — ajouter une entité à une campagne ne rougit pas ce
 * test, retirer une offre à une entité livrée, si.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { emptyScene, type Scene, type SceneEntity } from '../../../src/noyau/monde/scene';
import { seatSlotsOf } from '../../../src/noyau/monde/seating';
import { estUtilisable } from '../../../src/noyau/monde/usable';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';

function scene(entities: SceneEntity[]): Scene {
  const s = emptyScene('scene-test', 12, 12);
  s.entities = entities;
  return s;
}

describe('PLANCHER — les entités des paquets livrés gardent leur offre', () => {
  const PROJETS = cheminsDesProjetsLivres();

  it('les paquets livrés sont lisibles (sans quoi le plancher ne mesure rien)', () => {
    expect(PROJETS.length).toBeGreaterThan(0);
  });

  it.each(PROJETS)('%s : chaque entité qui offrait quelque chose AVANT offre encore', (chemin: string) => {
    const doc = JSON.parse(readFileSync(chemin, 'utf8')) as { scenes: { id: string; entities?: SceneEntity[] }[] };
    const muettes: string[] = [];
    let offrantes = 0;
    for (const sc of doc.scenes) {
      const s = scene((sc.entities ?? []) as SceneEntity[]);
      for (const e of s.entities) {
        // L'offre d'AVANT le lot, telle que la sonde du juge la mesurait : les capacités d'instance,
        // les gestes authorés, plus les places que le TYPE porte (l'assise était alors une propriété
        // du TYPE seul). Le rôle `tavernGame` n'en est pas : sa table n'a jamais eu d'exécuteur hors
        // du nœud de dialogue qui la sert (`openTavernGames`, mesuré).
        const avant = !!e.dialogueId || !!e.merchant || !!e.usable?.actions?.length
          || (e.kind === 'prop' && seatSlotsOf(s, e.id).length > 0);
        if (!avant) continue;
        offrantes++;
        if (!estUtilisable(s, e)) muettes.push(`${sc.id} › ${e.id}`);
      }
    }
    expect(offrantes, `${chemin} : aucune entité offrante — le plancher ne mesure rien`).toBeGreaterThan(0);
    expect(muettes, 'entités livrées devenues MUETTES').toEqual([]);
  });
});
