import { beforeAll, describe, expect, it } from 'vitest';
import {
  ameliorer, attendreUneSemaine, PRIX_DU_SOIN_PAR_BLESSURE, prixDuSoin, soignerAuTemple, compagnieEpuisee, TAILLE_DU_GROUPE, ECHELLE_DES_PRIX, congedier, confierALHospice, disponible, nouvellePartie, partir, prendreUneChambre, prixDeLaChambre,
  qualiteDeLaChambre, recruter, refusDeDepart, rentrer, SEMAINE_DE_REPOS, type Etat, type QualiteDeRepos,
} from './index';
import { prixDuSejourALAuberge, poserLesReglesDuRoguelite } from '../noyau';
import { bonus, effectiveChar } from '../../../../src/engine/characteristics';
import { t } from '../../../../src/i18n';

beforeAll(() => poserLesReglesDuRoguelite());

/** Une partie riche dont le quatrième héros est blessé. */
function avecUnBlesse(graine: number): { e: Etat; id: string } {
  const e = nouvellePartie(graine);
  e.or = 1000;
  const h = e.roster[3];
  h.c.wounds.current = 1;
  return { e, id: h.c.id };
}

describe('la chambre de l’Auberge relais', () => {
  it('le prix d’une semaine est le séjour d’auberge du noyau à la qualité du palier', () => {
    const { e } = avecUnBlesse(1);
    const prix = (q: QualiteDeRepos) => Math.round(prixDuSejourALAuberge(q, SEMAINE_DE_REPOS) * ECHELLE_DES_PRIX);
    expect(qualiteDeLaChambre(e)).toBe('pietre');
    expect(prixDeLaChambre(e)).toBe(prix('pietre'));
    expect(ameliorer(e, 'relais')).toBeNull();
    expect(qualiteDeLaChambre(e)).toBe('normale');
    expect(prixDeLaChambre(e)).toBe(prix('normale'));
    expect(prix('normale')).toBeGreaterThan(prix('pietre'));
  });

  it('retire le héros des départs une semaine, puis le rend reposé par les nuits du noyau, chacune au moins son Bonus d’Endurance (LDB 18 l.296)', () => {
    const { e, id } = avecUnBlesse(2);
    const h = e.roster.find((x) => x.c.id === id)!;
    const or = e.or;
    expect(prendreUneChambre(e, id)).toBeNull();
    expect(e.or).toBe(or - prixDeLaChambre(e));
    expect(disponible(h)).toBe(false);
    expect(refusDeDepart(h)).toBe(`Auberge encore ${SEMAINE_DE_REPOS} jours.`);
    expect(partir(e, 'reikwald', [id])).toBe('Choisissez au moins un héros valide.');
    for (const x of e.roster) if (x !== h) x.c.wounds.current = 0;
    const be = bonus(effectiveChar(h.c, 'endurance'));
    expect(attendreUneSemaine(e)).toBeNull();
    expect(h.sejour).toBeUndefined();
    expect(disponible(h)).toBe(true);
    expect(h.c.wounds.current).toBeGreaterThanOrEqual(Math.min(h.c.wounds.max, 1 + SEMAINE_DE_REPOS * be));
  });

  /** Une semaine en chambre du relais au palier `palier` sur la graine `graine` : le blessé, ce que la chambre a coûté et
   *  son prix affiché, le journal de la semaine. */
  function uneSemaineEnChambre(palier: number, graine: number) {
    const { e, id } = avecUnBlesse(graine);
    e.trophees = 10;
    for (let p = 0; p < palier; p++) expect(ameliorer(e, 'relais')).toBeNull();
    e.or = 1000;
    for (const x of e.roster) if (x.c.id !== id) x.c.wounds.current = 0;
    const h = e.roster.find((x) => x.c.id === id)!;
    const prix = prixDeLaChambre(e);
    expect(prendreUneChambre(e, id)).toBeNull();
    const paye = 1000 - e.or;
    e.journal = [];
    expect(attendreUneSemaine(e)).toBeNull();
    return { h, paye, prix, journal: e.journal.join('\n') };
  }
  const GRAINES = Array.from({ length: 20 }, (_, k) => k + 1);
  const courante = (h: { c: { diseases?: { id: string }[] } }) => (h.c.diseases ?? []).some((d) => d.id === 'courante-galopante');

  it('la chambre piètre expose à la Courante galopante de son repas (LDB 66 l.5)', () => {
    expect(GRAINES.some((g) => courante(uneSemaineEnChambre(0, g).h))).toBe(true);
  }, 60_000);

  it('la grande chambre n’expose jamais à la Courante galopante (LDB 66 l.5)', () => {
    for (const g of GRAINES) expect(courante(uneSemaineEnChambre(2, g).h), `graine ${g}`).toBe(false);
  }, 60_000);

  it('à tout palier, la semaine payée en or du hameau couvre chambre et repas : ni note refusée ni faim', () => {
    for (const palier of [0, 1, 2]) for (const g of GRAINES.slice(0, 5)) {
      const { h, paye, prix, journal } = uneSemaineEnChambre(palier, g);
      expect(paye).toBe(prix);
      expect(journal).not.toContain(t('jet.ferme.noteNonCouverte'));
      expect(h.c.hunger?.days ?? 0, `palier ${palier}, graine ${g}`).toBe(0);
    }
  }, 60_000);

  it('au hameau, la table commune nourrit chaque jour : sans vivres ni séjour, personne n’a faim après une semaine (LDB 18 l.337-343)', () => {
    const { e } = avecUnBlesse(5);
    for (const h of e.roster) { h.c.items = (h.c.items ?? []).filter((i) => i.trappingId !== 'ration'); h.c.wounds.current = 1; }
    expect(attendreUneSemaine(e)).toBeNull();
    for (const h of e.roster) expect(h.c.hunger?.days ?? 0, h.c.label).toBe(0);
  });

  it('sans chambre ni hospice, le blessé resté au hameau ne récupère pas en une semaine', () => {
    const { e, id } = avecUnBlesse(7);
    const h = e.roster.find((x) => x.c.id === id)!;
    for (const x of e.roster) if (x !== h) x.c.wounds.current = 0;
    const jour = e.jour;
    expect(attendreUneSemaine(e)).toBeNull();
    expect(e.jour).toBe(jour + SEMAINE_DE_REPOS);
    expect(h.c.wounds.current).toBe(1);
  });

  it('refuse le héros sans blessure ni fatigue, celui déjà à l’hospice, et la bourse trop maigre', () => {
    const { e, id } = avecUnBlesse(3);
    expect(prendreUneChambre(e, e.roster[0].c.id)).toBe('Ni blessé ni fatigué : rien à reposer.');
    e.or = 0;
    expect(prendreUneChambre(e, id)).toBe(`Il faut ${prixDeLaChambre(e)} CO.`);
    e.or = 1000;
    const h = e.roster.find((x) => x.c.id === id)!;
    h.c.traumas = [{ id: 'plaie', label: 'Plaie', needsSurgery: true } as never];
    e.batiments.temple = 2;
    expect(confierALHospice(e, id, 'operer')).toBeNull();
    expect(prendreUneChambre(e, id)).toBe(`Hospice encore ${SEMAINE_DE_REPOS} jours.`);
  });

  it('refuse le héros en expédition', () => {
    const { e, id } = avecUnBlesse(4);
    expect(partir(e, 'reikwald', [id])).toBeNull();
    expect(prendreUneChambre(e, id)).toMatch(/en expédition/);
  });
});

describe('l’engagement au relais', () => {
  it('la compagnie épuisée et sans le sou engage sans frais un groupe entier, et peut repartir', () => {
    const e = nouvellePartie(3);
    for (const h of e.roster) h.c.wounds.current = 0;
    e.or = 0;
    expect(compagnieEpuisee(e)).toBe(true);
    const tombes = new Set(e.roster.map((h) => h.c.id));
    for (let k = 0; k < TAILLE_DU_GROUPE; k++) expect(recruter(e, 0)).toBeNull();
    expect(e.or).toBe(0);
    const groupe = e.roster.filter((h) => !tombes.has(h.c.id)).map((h) => h.c.id);
    expect(groupe).toHaveLength(TAILLE_DU_GROUPE);
    expect(partir(e, 'reikwald', groupe)).toBeNull();
  });

  it('refuse un candidat déjà parti', () => {
    const e = nouvellePartie(3);
    expect(recruter(e, e.candidats.length)).toBe('Candidat parti.');
  });
});

describe('le renvoi au relais', () => {
  it('retire le héros sans rien rapporter à la bourse', () => {
    const { e } = avecUnBlesse(5);
    const h = e.roster[1];
    h.c.xp = 250;
    const or = e.or;
    expect(congedier(e, h.c.id)).toBeNull();
    expect(e.or).toBe(or);
    expect(e.roster).not.toContain(h);
  });

  it('refuse le dernier héros et celui en expédition', () => {
    const { e, id } = avecUnBlesse(6);
    expect(partir(e, 'reikwald', [id])).toBeNull();
    expect(congedier(e, id)).toMatch(/en expédition/);
    rentrer(e, false);
    for (const h of e.roster.slice(1)) expect(congedier(e, h.c.id)).toBeNull();
    expect(congedier(e, e.roster[0].c.id)).toBe('Le dernier héros de la compagnie ne se renvoie pas.');
    expect(e.roster).toHaveLength(1);
  });
});

describe('le soin de l’hospice', () => {
  /** Une partie riche, l'hospice au palier `palier`, le quatrième héros à `pb` Blessures. */
  function aLHospice(palier: number, pb: number): { e: Etat; id: string } {
    const { e, id } = avecUnBlesse(4);
    e.trophees = 10;
    for (let p = 0; p < palier; p++) expect(ameliorer(e, 'temple')).toBeNull();
    e.or = 1000;
    e.roster[3].c.wounds.current = pb;
    return { e, id };
  }

  it('se paie au tarif du palier par Blessure que le soin rend', () => {
    for (const palier of [1, 2]) {
      const { e, id } = aLHospice(palier, 3);
      const h = e.roster[3];
      expect(prixDuSoin(e, h)).toBe(PRIX_DU_SOIN_PAR_BLESSURE[palier]! * (h.c.wounds.max - 3));
      expect(soignerAuTemple(e, id)).toBeNull();
      expect(h.c.wounds.current).toBe(h.c.wounds.max);
      expect(1000 - e.or).toBe(PRIX_DU_SOIN_PAR_BLESSURE[palier]! * (h.c.wounds.max - 3));
    }
  });

  it('est gratuit au dernier palier', () => {
    const { e, id } = aLHospice(3, 0);
    expect(prixDuSoin(e, e.roster[3])).toBe(0);
    expect(soignerAuTemple(e, id)).toBeNull();
    expect(e.or).toBe(1000);
  });

  it('le héros à 0 Blessure paie l’hospice du premier palier plus cher qu’une semaine en chambre piètre', () => {
    const { e } = aLHospice(1, 0);
    expect(qualiteDeLaChambre(e)).toBe('pietre');
    expect(prixDuSoin(e, e.roster[3])).toBeGreaterThan(prixDeLaChambre(e));
  });
});
