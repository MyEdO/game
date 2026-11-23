import { describe, expect, it } from 'vitest';
import * as J from '../jeu';
import { testValue } from '../../../src/engine/skills';
import { ecranDuHeros, progressionDuHeros } from './fiche';
import { panneauDeService } from './services';

/** Une partie à la salle d'armes au palier 1, le Soldat du roster riche de PX. */
function salle() {
  const e = J.nouvellePartie(3);
  e.batiments.salle = 1;
  const h = e.roster.find((x) => x.carriere === 'soldat')!;
  h.c.xp = 900;
  return { e, h };
}

/** L'aperçu (`data-apercu`) du bouton de pas de la Caractéristique `k`. */
function apercuDuPas(html: string, k: string): { texte: string } {
  const bouton = html.match(new RegExp(`<button[^>]*data-a="pas"[^>]*data-k="${k}"[^>]*>`))![0];
  const brut = bouton.match(/data-apercu="([^"]*)"/)![1];
  return JSON.parse(brut.replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
}

describe('un seul écran de progression', () => {
  it('la salle d’armes et l’onglet Progression de la fiche posent le même bloc', () => {
    const { e, h } = salle();
    const bloc = progressionDuHeros(e, h);
    const { cadre } = panneauDeService({ e, client: h.c.id, emplacement: 'main', dest: null, choix: new Set(), congediement: null }, 'salle');
    expect(cadre).toContain(bloc);
    expect(ecranDuHeros({ e, congediement: null }, h.c.id, null)).toContain(bloc);
    expect(ecranDuHeros({ e, congediement: null }, h.c.id, 'progression')).toContain(bloc);
  });

  it('l’aperçu du pas de CC dit le Test de Corps à corps avant et après, tel que le noyau le joue', () => {
    const { e, h } = salle();
    const ref = { id: 'corps-a-corps', spec: 'base' };
    const avant = testValue(h.c, { skill: ref });
    const { texte } = apercuDuPas(progressionDuHeros(e, h), 'capacite-de-combat');
    expect(J.acheterUnPas(e, h.c.id, { genre: 'carac', id: 'capacite-de-combat' }).refus).toBeNull();
    const apres = testValue(h.c, { skill: ref });
    expect(apres).toBeGreaterThan(avant);
    expect(texte.split('\n')).toContain(`Corps à corps (Base) ${avant} → ${apres}`);
  });
});
