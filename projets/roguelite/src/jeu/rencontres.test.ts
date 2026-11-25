import { beforeAll, describe, expect, it } from 'vitest';
import { nomDeMaladie, poserLesReglesDuRoguelite, souillure } from '../noyau';
import {
  ACTIONS_A_JET,
  agirDansLaSalle,
  EPREUVES,
  herosDuGroupe,
  nouvellePartie,
  PROFILS,
  recrue,
  refusDAction,
  type Etat,
  type IdActionAJet,
  type SalleAJet,
  type Victime,
} from './index';
import { devant, recit } from './salles.testkit';

beforeAll(() => poserLesReglesDuRoguelite());

/** Le héros de la carrière `carriere` dans le groupe. */
const du = (e: Etat, carriere: string) => herosDuGroupe(e).find((h) => h.carriere === carriere)!;

/** Une action d'une rencontre tentée par le héros de la carrière `carriere` : `attendu`, la marque que le noyau laisse
 *  quand son Test rate ; `indemne`, l'action a aussi une issue ratée où le Test du noyau (Exposition, Contraction)
 *  laisse le héros indemne. */
interface Cas { salle: SalleAJet; action: IdActionAJet; carriere: string; indemne?: true; attendu?: (v: Victime) => void }

const corrompu = (v: Victime) => {
  expect(v.corruption!.avant).toBe(0);
  expect(v.corruption!.apres).toBeGreaterThan(0);
};
const contracte = (maladie: string) => (v: Victime) => expect(v.maladies).toEqual([nomDeMaladie(maladie)]);

const CAS: readonly Cas[] = [
  { salle: 'autel', action: 'purifier', carriere: 'nonne', indemne: true, attendu: corrompu },
  { salle: 'autel', action: 'piller', carriere: 'soldat', indemne: true, attendu: corrompu },
  { salle: 'puits', action: 'descendre', carriere: 'soldat', indemne: true, attendu: contracte('courante-galopante') },
  { salle: 'puits', action: 'sonder', carriere: 'soldat' },
  { salle: 'blesse', action: 'panser', carriere: 'nonne', indemne: true, attendu: contracte('verole-urticante') },
  { salle: 'blesse', action: 'questionner', carriere: 'soldat', attendu: contracte('verole-urticante') },
];

/** Joue l'action du `cas` à la `graine` : la partie, le récit, l'épreuve et le héros qui l'a tentée. */
function jouer(cas: Cas, graine: number) {
  const e = devant(cas.salle, graine, ['medecin']);
  const h = du(e, cas.carriere);
  const r = recit(agirDansLaSalle(e, cas.action, h.c.id));
  return { e, r, x: r.epreuve!, h: du(e, cas.carriere) };
}

/** La première partie `partie(graine)`, par graine croissante de 1 à 200, qui finit comme le dit `issue`. */
function premiere<T>(partie: (graine: number) => T, issue: (t: T) => boolean): T {
  for (let graine = 1; graine <= 200; graine++) {
    const t = partie(graine);
    if (issue(t)) return t;
  }
  throw new Error('aucune graine de 1 à 200 ne donne l’issue cherchée');
}

/** L'action du `cas` jouée à la première graine où son épreuve finit comme le dit `issue`. */
const jouerJusqua = (cas: Cas, issue: (x: ReturnType<typeof jouer>['x']) => boolean) => premiere((g) => jouer(cas, g), (j) => issue(j.x));

describe.each(CAS)('$salle · $action, tenté par le $carriere', (cas) => {
  const s = EPREUVES[cas.salle];
  const a = ACTIONS_A_JET[cas.action];

  it('réussi : la bourse de la rencontre, aucune marque, la salle franchie', () => {
    const { e, r, x, h } = jouerJusqua(cas, (x) => x.reussite);
    expect([x.testeur, x.reussite]).toEqual([h.c.id, true]);
    expect(x.victimes).toEqual([]);
    expect(x.or).toBeGreaterThan(0);
    expect(e.expedition!.or).toBe(x.or);
    expect(r.lignes).toContain(a.reussite);
    expect(r.lignes).toContain(`${s.gain.libelle} : ${x.or} CO.`);
    expect(e.expedition!.index).toBe(1);
  });

  it('raté : ni bourse ; le noyau joue la branche d’échec, et le récit dit ce qu’elle laisse au héros qui l’a tenté', () => {
    const { e, r, x, h } = jouerJusqua(cas, (x) => !x.reussite && (!cas.attendu || x.victimes.length > 0));
    expect([x.testeur, x.reussite, x.or]).toEqual([h.c.id, false, 0]);
    expect(r.lignes).toContain(a.echec);
    expect(e.expedition!.index).toBe(1);
    if (!cas.attendu) { expect(x.victimes).toEqual([]); return; }
    expect(x.victimes.map((v) => v.id)).toEqual([h.c.id]);
    const [v] = x.victimes;
    cas.attendu(v);
    if (v.corruption) {
      expect(v.corruption).toEqual({ avant: 0, apres: h.c.corruption, seuil: souillure(h.c).seuil });
      expect(r.lignes).toContain(`${h.c.label} : Corruption 0 → ${h.c.corruption} / ${souillure(h.c).seuil}.`);
    }
    for (const m of v.maladies) expect(r.lignes).toContain(`${h.c.label} contracte : ${m}.`);
  });

  if (cas.indemne) {
    it('raté, le Test du noyau épargne le héros : il n’en garde aucune marque', () => {
      const { x, h } = jouerJusqua(cas, (x) => !x.reussite && x.victimes.length === 0);
      expect(x.reussite).toBe(false);
      expect(x.victimes).toEqual([]);
      expect([h.c.corruption ?? 0, h.c.diseases ?? []]).toEqual([0, []]);
    });
  }
});

describe('les rencontres et le seuil de Corruption du noyau', () => {
  it('l’autel profané qui fait déborder la Corruption : le Test du seuil rate, la mutation vient et le récit la dit', () => {
    const deborde = (graine: number) => {
      const e = devant('autel', graine);
      const h = du(e, 'soldat');
      h.c.corruption = souillure(h.c).seuil - 1;
      return { r: recit(agirDansLaSalle(e, 'piller', h.c.id)), apres: du(e, 'soldat') };
    };
    const { r, apres } = premiere(deborde, (j) => (j.r.epreuve!.victimes[0]?.mutations.length ?? 0) > 0);
    const [m] = souillure(apres.c).mutations;
    expect(r.epreuve!.victimes[0].mutations).toEqual([m]);
    expect(r.lignes).toContain(`${apres.c.label} mute : ${m}.`);
  });
});

describe('les rencontres neuves et le roster', () => {
  it('toute carrière du roster tente chaque action d’une rencontre neuve sans lever, ou se la voit refuser', () => {
    const base = nouvellePartie(6);
    for (const { salle, action } of CAS) {
      for (const p of PROFILS) {
        const e = devant(salle, 6);
        const h = recrue(base, p);
        e.roster.push(h); e.expedition!.groupe.push(h.c.id);
        const r = agirDansLaSalle(e, action, h.c.id);
        expect(typeof r === 'string' ? r : r.epreuve!.testeur, `${p.id} · ${action}`).toBe(refusDAction(h, action) ?? h.c.id);
      }
    }
  }, 120_000);
});
