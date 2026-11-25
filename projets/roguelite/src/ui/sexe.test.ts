import { beforeAll, describe, expect, it } from 'vitest';
import { poserLesReglesDuRoguelite, progression } from '../noyau';
import * as J from '../jeu';
import { carteDeHeros, gabaritDe } from './pieces';
import { panneauDeService } from './services';

beforeAll(() => poserLesReglesDuRoguelite());

/** La première partie dont la création tire une héroïne au Soldat de la compagnie de départ. */
function soldate(): { e: J.Etat; h: J.Heros } {
  for (let graine = 1; ; graine++) {
    const e = J.nouvellePartie(graine);
    const h = e.roster.find((x) => x.carriere === 'soldat' && x.c.appearance?.sex === 'F');
    if (h) return { e, h };
  }
}

describe('le libellé de carrière et le portrait suivent le sexe du héros', () => {
  it('une héroïne Soldat se lit « Soldate » sur sa carte', () => {
    const { h } = soldate();
    expect(carteDeHeros(h, false)).toMatch(/<span class="sous-titre">(<svg.*?<\/svg>)?Soldate<\/span>/s);
  });

  it('son niveau suivant se lit « Soldate » à sa progression', () => {
    const { h } = soldate();
    expect(progression(h.c).suivant?.titre).toBe('Soldate');
  });

  it('sa tombe la dit « Soldate » au Jardin de Morr', () => {
    const { e, h } = soldate();
    expect(J.partir(e, 'reikwald', [h.c.id])).toBeNull();
    e.expedition!.salles[0] = { type: 'boss', ennemis: ['loup-funeste', 'orc', 'orc'], faite: false };
    h.c.fate = 0;
    h.c.wounds.current = 1;
    expect(J.avancer(e)?.fin).toBe('defaite');
    expect(e.cimetiere[0]).toMatchObject({ nom: h.c.label, carriere: 'soldat', sexe: 'F' });
    const { cadre } = panneauDeService({ e, client: null, emplacement: 'main', dest: null, choix: new Set(), congediement: null }, 'memorial');
    expect(cadre).toContain('<span class="sous-titre">Soldate</span>');
  });

  it('une naine n’a pas de barbe ; un nain la garde', () => {
    const { h } = soldate();
    expect(gabaritDe({ ...h, espece: 'nains' }).barbe).toBe(false);
    expect(gabaritDe({ ...h, espece: 'nains', c: { ...h.c, appearance: { ...h.c.appearance!, sex: 'M' } } }).barbe).toBe(true);
  });
});
