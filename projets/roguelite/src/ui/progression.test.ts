import { beforeAll, describe, expect, it } from 'vitest';
import * as J from '../jeu';
import {
  articleDuCatalogue,
  chancesDeReussite,
  libelleDeCarac,
  maniement,
  memeSpecialisation,
  porterAuNiveau,
  progression,
  poserLesReglesDuRoguelite,
} from '../noyau';
import { byId, casesDuNiveau, testValue } from '../../../../src/noyau';
import { ecranDuHeros, progressionDuHeros } from './fiche';
import { panneauDeService } from './services';
import { heros4e, recrue5e } from '../jeu/recrue5e.testkit';

beforeAll(() => poserLesReglesDuRoguelite());

/** Une partie à la salle d'armes au palier 1, le Soldat du roster riche de PX. */
function salle() {
  const e = J.nouvellePartie(3);
  e.batiments.salle = 1;
  const h = e.roster.find((x) => x.carriere === 'soldat')!;
  h.c.xp = 900;
  return { e, h };
}

/** Une partie à la salle d'armes au palier `palier`, un héros 4e de `carriere` (`heros4e`) au roster,
 *  riche de `xp` PX. */
function salle4e(carriere: string, palier: number, xp: number) {
  const e = J.nouvellePartie(3);
  e.batiments.salle = palier;
  const h = heros4e(carriere, 3, xp);
  e.roster.push(h);
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

  it('l’aperçu du pas de CC dit le Test d’attaque de l’arme tenue et l’écart de ses chances, tels que le noyau les joue', () => {
    const { e, h } = salle();
    const arme = J.panoplie(h).main!.id!;
    const avant = maniement(h.c, arme);
    const { texte } = apercuDuPas(progressionDuHeros(e, h), 'capacite-de-combat');
    expect(J.acheterUnPas(e, h.c.id, { genre: 'carac', id: 'capacite-de-combat' }).refus).toBeNull();
    const apres = maniement(h.c, arme).attaque;
    const ecart = chancesDeReussite(apres) - chancesDeReussite(avant.attaque);
    expect(ecart).toBeGreaterThan(0);
    expect(texte.split('\n')).toContain(`${articleDuCatalogue(arme).label} · ${avant.test} ${avant.attaque} → ${apres} : +${ecart} % de chances de toucher`);
  });

  it('l’aperçu d’un Talent dit l’écart de chances du Test qu’il change, tel que le noyau le joue (Imperturbable, Calme)', () => {
    const { e, h } = salle4e('joueur-d-epee', 1, 900);
    const i = J.offresDeCarriere(h).talents.findIndex((t) => t.ref.id === 'imperturbable');
    expect(i).toBeGreaterThanOrEqual(0);
    const bouton = progressionDuHeros(e, h).match(new RegExp(`<button[^>]*data-a="talent"[^>]*data-i="${i}"[^>]*>`))![0];
    const calme = { skill: { id: 'calme' } };
    const avant = testValue(h.c, calme);
    expect(J.acheter(e, h.c.id, { genre: 'talent', ref: { id: 'imperturbable' } })).toBeNull();
    const apres = testValue(h.c, calme);
    const ecart = chancesDeReussite(apres) - chancesDeReussite(avant);
    expect(ecart).toBeGreaterThan(0);
    expect(apercuDe(bouton).texte.split('\n')).toContain(`Calme ${avant} → ${apres} : +${ecart} % de chances`);
  });

  it('un Talent qui ne change aucune valeur de combat n’a pas d’aperçu sur sa plaque (Tireur de précision sans arme à distance)', () => {
    const { e, h } = salle();
    expect(J.panoplie(h).tir).toBeUndefined();
    const i = J.offresDeCarriere(h).talents.findIndex((t) => t.ref.id === 'tireur-de-precision');
    expect(i).toBeGreaterThanOrEqual(0);
    const bouton = progressionDuHeros(e, h).match(new RegExp(`<button[^>]*data-a="talent"[^>]*data-i="${i}"[^>]*>`))![0];
    expect(bouton).not.toContain('data-apercu');
  });

  it('4e : le bouton du pas et les étapes du plan disent le gain réel du pas, au prix de `pasDe`', () => {
    const { e, h } = salle4e('soldat', 1, 900);
    const cible = J.offresDeCarriere(h).caracs[0].id;
    const K = { genre: 'carac', id: cible } as const;
    const augs = () => h.c.charAdvances?.[cible] ?? 0;
    while (augs() % 5 !== 2) expect(J.acheter(e, h.c.id, K)).toBeNull();
    const entame = J.pasDe(h, K)!;
    expect(entame.fois).toBe(3);
    const html = progressionDuHeros(e, h);
    expect(boutonDuPas(html, cible).libelle).toBe(`+3 · ${entame.prix} PX`);
    expect(apercuDe(html.match(/<div class="plan"[^>]*>/)![0]).texte.split('\n')).toContain(`${libelleDeCarac(cible).abr} +3 · ${entame.prix} PX`);
    expect(J.acheterUnPas(e, h.c.id, K).refus).toBeNull();
    const plein = J.pasDe(h, K)!;
    expect(plein.fois).toBe(5);
    expect(boutonDuPas(progressionDuHeros(e, h), cible).libelle).toBe(`+5 · ${plein.prix} PX`);
  });
});

describe('le panneau d’exigences suit le modèle de progression du héros', () => {
  it('4e : Caractéristiques de carrière, huit Compétences et un Talent, à 5 × niveau points (LDB 07 l.124-131)', () => {
    const { e, h } = salle4e('soldat', 1, 900);
    const html = progressionDuHeros(e, h);
    const n = J.offresDeCarriere(h).caracs.length;
    expect(html).toMatch(new RegExp(`: \\+5 chacune</span><span class="cpt chiffres">\\d+ / ${n}</span>`));
    expect(html).toMatch(/>8 Compétences à \+5<\/span><span class="cpt chiffres">\d+ \/ 8<\/span>/);
    expect(html).toContain('<span>Un Talent de ce niveau</span>');
  });

  it('4e : « Passer » reste fermé tant que le noyau ne valide pas le niveau, même quand les comptes de la fiche sont pleins (LDB 07 l.124-131)', () => {
    const { e, h } = salle4e('alchimiste', 2, 0);
    h.c = porterAuNiveau(h.c, 2, 5);
    const c = h.c;
    const p = progression(c);
    for (const k of p.caracs) c.charAdvances = { ...c.charAdvances, [k.id]: 10 };
    const metiers = p.competences.filter((k) => k.ref.id === 'metier');
    for (const k of [...metiers, ...p.competences.filter((x) => x.ref.id !== 'metier').slice(0, 6)]) {
      const s = c.skills.find((x) => x.id === k.ref.id && memeSpecialisation(x.spec, k.ref.spec));
      if (s) s.advances = 10;
      else c.skills.push({ id: k.ref.id, spec: k.ref.spec, characteristic: byId('skill', k.ref.id)!.characteristic, advances: 10 });
    }
    c.xp = 10000;
    const talent = p.talents.find((t) => !t.aSpecifier && !t.auMaxi)!;
    expect(J.acheter(e, c.id, { genre: 'talent', ref: talent.ref })).toBeNull();
    expect(metiers.length).toBeGreaterThan(1);
    expect(J.offresDeCarriere(h).complet).toBe(false);
    const passer = progressionDuHeros(e, h).match(/<button[^>]*data-a="niveau"[^>]*>/)![0];
    expect(passer).toContain(' disabled');
  });

  it('5e : les cases cochées au niveau sur leur seuil, les points de chaque valeur, un pas de +5 (CRB 048 l.45)', () => {
    const { e, h } = recrue5e(5000);
    const html = progressionDuHeros(e, h);
    expect(html).toContain(`<span>Cases de carrière cochées à ce niveau</span><span class="cpt chiffres">${casesDuNiveau(h.c, 'soldat', 1)} / 10</span>`);
    expect(html).toContain(`<span class="points chiffres">+${h.c.charAdvances?.['capacite-de-combat'] ?? 0}</span>`);
    const pas = J.pasDe(h, { genre: 'carac', id: 'capacite-de-combat' })!;
    expect(pas).toMatchObject({ fois: 1, points: 5 });
    expect(boutonDuPas(html, 'capacite-de-combat').libelle).toBe(`+5 · ${pas.prix} PX`);
  });
});
