/** #1869 sur les paquets livrés : tout dialogue d'une scène a un OUVREUR dans cette scène
 *  (`src/scenes/dialogue-jamais-ouvert.test.ts` en tient le détecteur et le commun). */
import { describe, expect, it } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { avisDialogueJamaisOuvert, validateScene } from '../../../src/noyau/validateScene';

describe('#1869 — paquets livrés', () => {
  it('aucun projet livré ne porte de dialogue jamais ouvert', () => {
    const trouves = listerProjetsLivres().map((rel) => parseProject(lireProjetLivre(rel))).flatMap((doc) =>
      validateScene(doc.scenes, doc.worldMap).filter((w) => w.refId && w.message === avisDialogueJamaisOuvert(w.refId)).map((w) => `${w.sceneId} › ${w.refId}`));
    expect(trouves, 'donner le dialogue à une entité, l’ouvrir par un effet, ou le supprimer').toEqual([]);
  });
});
