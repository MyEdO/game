/**
 * ENTRÉE DANS LA CASCADE (#3328) : « bestiaire » joué au geste en focus, comme la touche Entrée le joue. Une étape à
 * plusieurs jets (le Sang-froid face à la Terreur) jette chaque rangée puis se valide ; une étape qui attend un choix
 * (dévier ou subir le Coup Critique), un réglage de l'étape (`fenetre.reglages`), ne se valide, ne se résout ni ne se
 * termine avant lui, et rien n'y prend le focus.
 * Le Coup Critique d'une Défense ne montre pas la Défense de l'attaque suivante, déjà en attente.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, gestesDessines } from './pont.testkit';
import { clicDuCombattant } from './pont';
import type { Bouton, Choix, Element } from '../../../src/hote/elements';

const { appel } = table();
const NAVIGATION = ['jetValider@cascade', 'jetLancer@cascade*', 'fenetreFermer@cascade'];

describe('Entrée dans la cascade', () => {
  it('chaque rangée jetée puis l’étape validée ; le choix d’une étape attendu avant sa navigation ; le Coup Critique seul', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'bestiaire', graine: 7 }));
    const vus = { batchValide: false, choix: false, critique: false };
    let meme = { cle: '', fois: 0 };
    for (let pas = 0; pas < 300 && !(vus.batchValide && vus.choix && vus.critique); pas++) {
      const { fenetre, combat } = suite.vue.projection;
      let jeu: unknown;
      if (fenetre) {
        const gestes: Element[] = gestesDessines(suite.vue);
        const focus = gestes.find((g): g is Bouton => g.type === 'bouton' && g.focus);
        if (fenetre.etape?.interaction === 'batch' && focus?.id === 'jetValider@cascade') vus.batchValide = true;
        if (fenetre.etape?.genre === 'critique') {
          vus.critique = true;
          expect(suite.vue.zones['fenetre.corps'].filter((e) => e.id.startsWith('defense/')), 'le Coup Critique sans la Défense d’une autre attaque').toEqual([]);
        }
        if (focus) jeu = focus.jeu;
        else {
          const choix = suite.vue.zones['fenetre.reglages'].find((g): g is Choix => g.type === 'choix' && g.id === 'jetRegler@cascade#choix');
          expect(choix, `sans focus, la fenêtre ${fenetre.cle} attend un choix`).toBeDefined();
          expect(gestes.map((g) => g.id).filter((id) => NAVIGATION.includes(id)), 'ni valider, ni tout résoudre, ni terminer avant le choix').toEqual([]);
          vus.choix = true;
          jeu = choix!.valeurs[0].jeu;
        }
        const cle = `${fenetre.etape?.id}/${JSON.stringify(jeu)}`;
        meme = cle === meme.cle ? { cle, fois: meme.fois + 1 } : { cle, fois: 1 };
        expect(meme.fois, `Entrée rejoue ${cle} sans effet`).toBeLessThan(8);
      } else {
        expect(combat && !combat.fin, 'le combat se poursuit').toBeTruthy();
        const offres = suite.vue.zones['combat.offres'].flatMap((x) => x.valeurs).filter((b) => !b.refus);
        jeu = combat!.intention && combat!.cibles.liste.length
          ? clicDuCombattant(suite.vue, combat!.cibles.liste[0])!
          : (offres.find((o) => o.id === 'attaque' && !combat!.intention) ?? offres.find((o) => o.id === 'fin-de-tour'))!.jeu;
      }
      ({ suite } = drainer(appel, appel('jouer', jeu)));
    }
    expect(vus, 'une étape à plusieurs jets validée par Entrée, un choix attendu, un Coup Critique').toEqual({ batchValide: true, choix: true, critique: true });
  });
});
