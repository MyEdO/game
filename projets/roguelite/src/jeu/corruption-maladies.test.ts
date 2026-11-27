import { beforeAll, describe, expect, it } from 'vitest';
import { contractDisease } from '../../../../src/engine/disease';
import { maladieDeclaree, MINUTES_PER_DAY } from '../../../../src/noyau';
import { jouerLEpreuve, makeRNG, maladies, souillure, type Combatant, type Epreuve, poserLesReglesDuRoguelite } from '../noyau';
import { ecranDuHeros } from '../ui/fiche';
import { attendreUneSemaine, compagnieEpuisee, confierALHospice, EPREUVES, nouvellePartie, SEMAINE_DE_REPOS, type Etat, type Heros } from './index';

beforeAll(() => poserLesReglesDuRoguelite());

/** La compagnie épuisée : chacun sous la moitié de ses Blessures, la semaine d'attente s'ouvre. */
function epuisee(e: Etat): void {
  for (const h of e.roster) h.c.wounds.current = 1;
  expect(compagnieEpuisee(e)).toBe(true);
}
/** La maladie `id` contractée par le moteur, `incubation` jours d'incubation et `duree` jours de Durée. */
const contracter = (c: Combatant, id: string, incubation: number, duree: number) => { c.diseases = [contractDisease(id, makeRNG(1), { incubation, duration: duree })!]; };
const joursRestants = (h: Heros) => h.c.diseases![0].minutesLeft / MINUTES_PER_DAY;

describe('l’horloge des maladies entre les expéditions', () => {
  it('la Fièvre du rongeur en incubation se déclare au hameau une fois ses jours passés, et la chronique le dit', () => {
    const e = nouvellePartie(5);
    const h = e.roster[0];
    contracter(h.c, 'fievre-du-rongeur', 5, 20);
    epuisee(e);
    expect(attendreUneSemaine(e)).toBeNull();
    expect(maladieDeclaree(h.c.diseases![0])).toBe(true);
    expect(e.journal.join(' ')).toMatch(/Fièvre du Rongeur/);
  });

  it('une maladie au bout de sa Durée se résout dans la semaine : aucun Test de fin laissé en attente', () => {
    const e = nouvellePartie(9);
    const h = e.roster[0];
    contracter(h.c, 'fievre-du-rongeur', 0, 2);
    epuisee(e);
    expect(attendreUneSemaine(e)).toBeNull();
    expect((h.c.diseases ?? []).filter((d) => d.endTestPending)).toEqual([]);
    expect(e.journal.join(' ')).toMatch(/Fièvre du Rongeur/);
  });

  it('une semaine à l’hospice : la maladie veillée par les sœurs perd deux jours par jour (LDB 09 l.265), les Blessures se récupèrent chaque nuit (LDB 18 l.296), nourri', () => {
    const base = nouvellePartie(6);
    contracter(base.roster[0].c, 'fievre-du-rongeur', 0, 20);
    base.batiments.temple = 2;
    base.or = 1000;
    epuisee(base);
    const temoin = structuredClone(base);
    const soigne = base.roster[0];
    soigne.c.traumas = [{ id: 'plaie', label: 'Plaie', needsSurgery: true } as never];
    expect(confierALHospice(base, soigne.c.id, 'operer')).toBeNull();
    expect(soigne.sejour?.ou).toBe('temple');
    expect(attendreUneSemaine(base)).toBeNull();
    expect(attendreUneSemaine(temoin)).toBeNull();
    expect(joursRestants(temoin.roster[0]), 'au village, sans veilleur').toBe(20 - SEMAINE_DE_REPOS);
    expect(joursRestants(soigne), 'à l’hospice, veillé par les sœurs').toBe(20 - 2 * SEMAINE_DE_REPOS);
    expect(soigne.c.wounds.current, 'les nuits de l’hospice récupèrent des Blessures').toBeGreaterThan(temoin.roster[0].c.wounds.current);
    expect(soigne.c.hunger?.days ?? 0, 'les sœurs nourrissent leurs patients').toBe(0);
  });
});

describe('« Je te renie ! » sans choix : le roguelite ne gère pas la Résilience (MyEdO/game#4947)', () => {
  /** Graine 5 : le Test du seuil échoue (`cor.thresholdFail`), le noyau ouvre « Je te renie ! » (Résilience 2). */
  it('une épreuve qui fait déborder la Corruption et rate le Test du seuil laisse venir la mutation, Résilience intacte', () => {
    const heros = nouvellePartie(7).roster[0].c;
    heros.corruption = souillure(heros).seuil;
    heros.resilience = 2;
    const fouille = EPREUVES.tresor.actions.fouiller.epreuves[0];
    const corrompt = { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'corruption', amount: 1 }] } } as Epreuve['flux']['echec'];
    const autel: Epreuve = { label: 'Autel profané', flux: { ...fouille.flux, reussite: corrompt, echec: corrompt } };
    const r = jouerLEpreuve([heros], autel, 5);
    const journal = r.journal.join(' ');
    expect(journal).toContain(`${heros.label} échoue à contenir sa Corruption`);
    expect(journal).toContain(`${heros.label} MUTE`);
    expect(r.groupe[0].mutations).toHaveLength(1);
    expect(r.groupe[0].resilience).toBe(2);
  });
});

describe('la fiche montre la Corruption et les maladies', () => {
  it('la Corruption face au seuil du noyau, la maladie, sa phase et ses jours', () => {
    const e = nouvellePartie(8);
    const h = e.roster[0];
    h.c.corruption = 3;
    contracter(h.c, 'fievre-du-rongeur', 4, 20);
    const fiche = ecranDuHeros({ e, congediement: null }, h.c.id, null);
    const [m] = maladies(h.c);
    expect(fiche).toContain(`Corruption 3 / ${souillure(h.c).seuil}`);
    expect(fiche).toContain(`${m.label} · incubation · 4 j`);
  });
});
