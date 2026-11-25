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

/** Une action d'une rencontre jouée à graine fixe par le héros de la carrière `carriere` : `reussie`, la graine où son
 *  Test réussit ; `marquee`, celle où il rate et où le noyau laisse sa marque (`attendu`) ; `indemne`, celle où il rate
 *  et où le Test du noyau (Exposition, Contraction) laisse le héros indemne. */
interface Cas { salle: SalleAJet; action: IdActionAJet; carriere: string; reussie: number; marquee: number; indemne?: number; attendu?: (v: Victime) => void }

const corrompu = (v: Victime) => {
  expect(v.corruption!.avant).toBe(0);
  expect(v.corruption!.apres).toBeGreaterThan(0);
};
const contracte = (maladie: string) => (v: Victime) => expect(v.maladies).toEqual([nomDeMaladie(maladie)]);

const CAS: readonly Cas[] = [
  { salle: 'autel', action: 'purifier', carriere: 'nonne', reussie: 1, marquee: 2, indemne: 17, attendu: corrompu },
  { salle: 'autel', action: 'piller', carriere: 'soldat', reussie: 3, marquee: 2, indemne: 1, attendu: corrompu },
  { salle: 'puits', action: 'descendre', carriere: 'soldat', reussie: 1, marquee: 2, indemne: 14, attendu: contracte('courante-galopante') },
  { salle: 'puits', action: 'sonder', carriere: 'soldat', reussie: 3, marquee: 1 },
  { salle: 'blesse', action: 'panser', carriere: 'nonne', reussie: 1, marquee: 2, indemne: 14, attendu: contracte('verole-urticante') },
  { salle: 'blesse', action: 'questionner', carriere: 'soldat', reussie: 1, marquee: 2, attendu: contracte('verole-urticante') },
];

/** Joue l'action du `cas` à la `graine` : la partie, le récit, l'épreuve et le héros qui l'a tentée. */
function jouer(cas: Cas, graine: number) {
  const e = devant(cas.salle, graine, ['medecin']);
  const h = du(e, cas.carriere);
  const r = recit(agirDansLaSalle(e, cas.action, h.c.id));
  return { e, r, x: r.epreuve!, h: du(e, cas.carriere) };
}

describe.each(CAS)('$salle · $action, tenté par le $carriere', (cas) => {
  const s = EPREUVES[cas.salle];
  const a = ACTIONS_A_JET[cas.action];

  it('réussi : la bourse de la rencontre, aucune marque, la salle franchie', () => {
    const { e, r, x, h } = jouer(cas, cas.reussie);
    expect([x.testeur, x.reussite]).toEqual([h.c.id, true]);
    expect(x.victimes).toEqual([]);
    expect(x.or).toBeGreaterThan(0);
    expect(e.expedition!.or).toBe(x.or);
    expect(r.lignes).toContain(a.reussite);
    expect(r.lignes).toContain(`${s.gain.libelle} : ${x.or} CO.`);
    expect(e.expedition!.index).toBe(1);
  });

  it('raté : ni bourse ; le noyau joue la branche d’échec, et le récit dit ce qu’elle laisse au héros qui l’a tenté', () => {
    const { e, r, x, h } = jouer(cas, cas.marquee);
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

  if (cas.indemne !== undefined) {
    it('raté, le Test du noyau épargne le héros : il n’en garde aucune marque', () => {
      const { x, h } = jouer(cas, cas.indemne!);
      expect(x.reussite).toBe(false);
      expect(x.victimes).toEqual([]);
      expect([h.c.corruption ?? 0, h.c.diseases ?? []]).toEqual([0, []]);
    });
  }
});

describe('les rencontres et le seuil de Corruption du noyau', () => {
  it('l’autel profané qui fait déborder la Corruption : le Test du seuil rate, la mutation vient et le récit la dit', () => {
    const e = devant('autel', 1);
    const h = du(e, 'soldat');
    h.c.corruption = souillure(h.c).seuil - 1;
    const r = recit(agirDansLaSalle(e, 'piller', h.c.id));
    const apres = du(e, 'soldat');
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
