import { describe, expect, it } from 'vitest';
import * as J from '../jeu';
import { testValue } from '../../../src/engine/skills';
import { libelleDeCarac } from '../noyau';
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

/** L'aperçu (`data-apercu`) d'une balise ouvrante. */
const apercuDe = (balise: string): { texte: string } =>
  JSON.parse(balise.match(/data-apercu="([^"]*)"/)![1].replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));

/** Le bouton de pas de la Caractéristique `k` : sa balise ouvrante et son libellé. */
function boutonDuPas(html: string, k: string): { balise: string; libelle: string } {
  const [tout, balise] = html.match(new RegExp(`(<button[^>]*data-a="pas"[^>]*data-k="${k}"[^>]*>)[\\s\\S]*?</button>`))!;
  return { balise, libelle: tout.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() };
}
const apercuDuPas = (html: string, k: string) => apercuDe(boutonDuPas(html, k).balise);

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

  it('le bouton du pas et les étapes du plan disent le gain réel du pas, au prix de `pasDe`', () => {
    const { e, h } = salle();
    const vierge = J.offresDeCarriere(h).caracs.find((k) => k.augmentations === 0)!.id;
    const K = { genre: 'carac', id: vierge } as const;
    const augs = () => h.c.charAdvances?.[vierge] ?? 0;
    while (augs() % 5 !== 2) expect(J.acheter(e, h.c.id, K)).toBeNull();
    const entame = J.pasDe(h, K)!;
    expect(entame.fois).toBe(3);
    const html = progressionDuHeros(e, h);
    expect(boutonDuPas(html, vierge).libelle).toBe(`+3 · ${entame.prix} PX`);
    expect(apercuDe(html.match(/<div class="plan"[^>]*>/)![0]).texte.split('\n')).toContain(`${libelleDeCarac(vierge).abr} +3 · ${entame.prix} PX`);
    expect(J.acheterUnPas(e, h.c.id, K).refus).toBeNull();
    const plein = J.pasDe(h, K)!;
    expect(plein.fois).toBe(5);
    expect(boutonDuPas(progressionDuHeros(e, h), vierge).libelle).toBe(`+5 · ${plein.prix} PX`);
  });
});
