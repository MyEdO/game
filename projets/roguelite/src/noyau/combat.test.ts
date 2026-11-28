import { beforeAll, describe, expect, it } from 'vitest';
import { annonceDuCoupSurUnAllie, jouerLeCombat, nouvelleRecrue, type Coup, type IssueDuCombat, poserLesReglesDuRoguelite } from './index';
import { estUtile, PROFILS } from '../jeu';
import { t } from '../../../../src/i18n';
import { chebyshev } from '../../../../src/engine/grid';
import { poserLeDataset } from '../../../../src/data/datasetDeTest.testkit';
import { blessuresDeBase, combattantDeTest, profilDeTest } from '../../../../src/engine/combattantDeTest.testkit';
import type { Combatant } from '../../../../src/engine/types';

beforeAll(() => poserLesReglesDuRoguelite());

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
    const issue = jouerLeCombat(groupe(), ['gobelin'], 5);
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
  // Fixtures déclarées au seam des datasets : une brute qui, quand elle touche, tue sa victime (op `kill`, que le Destin
  // conjure) et tombe d'elle-même ; un héros qui ne peut ni l'esquiver ni la blesser.
  poserLeDataset('traits', (livre) => [...livre, {
    id: 'coup-fatal-de-test', type: 'traits', label: 'Coup fatal de test', source: { book: 'LDB', page: 0 },
    effects: [
      { trigger: 'onHit', on: 'victime', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'kill' }] } } },
      { trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 99, ignoreTB: true, ignoreAP: true }] } } },
    ],
  } as never]);
  poserLeDataset('creatures', (livre) => [...livre, {
    id: 'brute-de-test', type: 'creatures', label: 'Brute de test', title: null, folder: 'Test', source: { book: 'LDB', page: 0 },
    char: { M: 12, 'capacite-de-combat': 95, 'capacite-de-tir': 10, force: 60, endurance: 10, initiative: 99, agilite: 1, dexterite: 10, intelligence: 10, 'force-mentale': 10, sociabilite: 10, B: 1 },
    traits: [{ id: 'arme', value: 5 }, { id: 'coup-fatal-de-test' }], optionals: [], skills: [], talents: [], trappings: [], spells: [], desc: '',
  } as never]);
  const heros = (): Combatant => combattantDeTest({
    id: 'victime', label: 'Victime', kind: 'heros', fate: 5, characteristics: profilDeTest({ 'capacite-de-combat': 5, agilite: 5, initiative: 1 }),
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }], wounds: blessuresDeBase(40),
  });

  it('un héros que le Destin sauve n’est pas compté mort : la rencontre rend son Destin dépensé, lu après la fenêtre du Destin', () => {
    const groupe = [heros()];
    const issue = jouerLeCombat(groupe, ['brute-de-test'], 1);
    const sauves = Object.entries(issue.destinDepense).filter(([, n]) => n > 0).map(([id]) => id);
    expect(sauves).toEqual(['victime']);
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
      const distance = (p: { x: number; y: number }) => chebyshev(p, ennemi);
      return distance(apres) - distance(depart);
    };
    expect(premierPas()).toBeLessThan(0);
    expect(premierPas('racaille')).toBeGreaterThan(0);
  });
});
