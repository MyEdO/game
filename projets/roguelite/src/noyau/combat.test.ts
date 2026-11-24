import { beforeAll, describe, expect, it } from 'vitest';
import { annonceDuCoupSurUnAllie, jouerLeCombat, nouvelleRecrue, type Coup, type IssueDuCombat, poserLesReglesDuRoguelite } from './index';
import { DESTINATIONS, estUtile, nouvellePartie, PROFILS, recrue as recrueDuHameau } from '../jeu';
import { t } from '../../../../src/i18n';

beforeAll(poserLesReglesDuRoguelite);

const recrue = (graine: number, carriere: string, nom: string) => ({ ...nouvelleRecrue(graine, carriere, 'humains-reiklander', PROFILS.find((p) => p.id === carriere)!.identite, estUtile), label: nom });
const groupe = () => [recrue(31, 'soldat', 'Hans'), recrue(32, 'chasseur', 'Greta'), recrue(33, 'ratier', 'Ulli')];

/** Les coups d'arme d'une figure sur une autre de son camp, lu sur le plateau du pas qui les porte. */
function coupsSurUnAllie(issue: IssueDuCombat): Coup[] {
  return issue.pas.flatMap((p) => {
    const camp = (id: string) => p.pions.find((q) => q.id === id)?.camp;
    return p.coups.filter((c) => c.genre !== 'spell' && c.de !== c.vers && camp(c.de) === camp(c.vers));
  });
}

describe('le rejeu d’un coup porté sur son propre camp', () => {
  it('un tir dévié dans la mêlée : le rejeu annonce la touche et la ligne du noyau, qui en dit la cause (LDB 14 l.116)', () => {
    const issue = jouerLeCombat(groupe(), ['gobelin'], 4);
    const [coup] = coupsSurUnAllie(issue);
    expect(coup).toMatchObject({ genre: 'distance', touche: true });
    const victime = issue.pas.flatMap((x) => x.pions).find((q) => q.id === coup.vers)!.label;
    expect(coup.ligne).toContain(t('cf.touchePerdueEnMelee', { name: victime }));
    expect(annonceDuCoupSurUnAllie(coup, true)).toEqual({ flash: 'Touche un allié !', ruban: coup.ligne });
  });

  it('deux gobelins qui se battent : le rejeu rend le coup tel que le noyau le journalise, sans cause que le noyau ne porte pas', () => {
    const issue = jouerLeCombat(groupe(), ['gobelin', 'gobelin'], 1);
    const coups = coupsSurUnAllie(issue);
    expect(coups.length).toBeGreaterThan(0);
    for (const c of coups) expect(annonceDuCoupSurUnAllie(c, true)).toEqual({ flash: c.touche ? 'Touche un allié !' : null, ruban: c.ligne });
  });
});

describe('l’issue d’un combat joué par la couture de la rencontre (#4847)', () => {
  it('un héros que le Destin sauve n’est pas compté mort : la rencontre rend son Destin dépensé, lu après la fenêtre du Destin', () => {
    const e = nouvellePartie(7000);
    const groupe = [0, 1, 2, 3].map((k) => recrueDuHameau(e, PROFILS[k % PROFILS.length]).c);
    const hardes = DESTINATIONS.find((d) => d.id === 'hardes')!;
    const issue = jouerLeCombat(groupe, hardes.elites[1], 9000, hardes.lumiere);
    const sauves = Object.entries(issue.destinDepense).filter(([, n]) => n > 0).map(([id]) => id);
    expect(sauves.length).toBeGreaterThan(0);
    for (const id of sauves) {
      expect(issue.morts).not.toContain(id);
      expect(issue.groupe.find((c) => c.id === id)!.fate).toBe(groupe.find((c) => c.id === id)!.fate! - issue.destinDepense[id]);
    }
  });
});

describe('le placement du groupe et la consigne de chaque héros (#4959)', () => {
  it('le noyau pose le groupe en file dans son ordre, tournée vers la ligne des ennemis : le premier en tête', () => {
    const g = groupe();
    const issue = jouerLeCombat(g, ['gobelin', 'gobelin'], 4);
    const [premier] = issue.pas;
    const pion = (id: string) => premier.pions.find((p) => p.id === id)!;
    const ennemis = premier.pions.filter((p) => p.camp === 'ennemi');
    expect(g.map((h) => pion(h.id).x)).toEqual(g.map(() => pion(g[0].id).x));
    expect(g.map((h) => pion(h.id).y)).toEqual(g.map((_, i) => pion(g[0].id).y + i));
    expect(ennemis.every((p) => p.y < pion(g[0].id).y)).toBe(true);
  });

  it('la cadence automatique pilote un héros par la doctrine forcée de son combattant (`aiDoctrine`), comme un ennemi : très entamé, `racaille` le replie au lieu de charger', () => {
    const premierPas = (aiDoctrine?: 'racaille') => {
      const h = recrue(31, 'soldat', 'Hans');
      const c = { ...h, wounds: { ...h.wounds, current: 2 }, ...(aiDoctrine ? { aiDoctrine } : {}) };
      const issue = jouerLeCombat([c], ['gobelin'], 4);
      const depart = issue.pas[0].pions.find((p) => p.id === h.id)!;
      const ennemi = issue.pas[0].pions.find((p) => p.camp === 'ennemi')!;
      const apres = issue.pas.find((p) => p.pions.some((q) => q.id === h.id && (q.x !== depart.x || q.y !== depart.y)))!.pions.find((q) => q.id === h.id)!;
      const distance = (p: { x: number; y: number }) => Math.max(Math.abs(p.x - ennemi.x), Math.abs(p.y - ennemi.y));
      return distance(apres) - distance(depart);
    };
    expect(premierPas()).toBeLessThan(0);
    expect(premierPas('racaille')).toBeGreaterThan(0);
  });
});
