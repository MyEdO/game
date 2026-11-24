import { describe, expect, it, onTestFinished } from 'vitest';
import { campaignStart } from '../engine/clock';
import { blesseDeTest, combattantDeTest } from '../engine/combattantDeTest.testkit';
import { addCondition, stacks, syncDerivedConditions } from '../engine/conditions';
import { contractDiseaseOnce } from '../engine/disease';
import { deFixe } from '../engine/dice.testkit';
import { resetDesFixes, setDesFixes } from '../engine/fixedDie';
import { resetRule, setRule } from '../engine/policy';
import { zonesDeLEcran } from '../hote/ecran';
import { fenetreADessiner } from '../hote/gestes';
import { projeter } from '../hote/projection';
import { SANS_ROSTER } from '../hote/roster';
import { ouvrirLeBanc } from './banc.testkit';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';
import type { Jeu } from './etat';
import { emptyNarratif } from './monde/campaignNarratif';
import { emptyScene } from './monde/scene';
import { documentDeProjet, parseProject, type WorldMap } from './worldMap';

const depart = emptyScene('depart-camp', 10, 10);
const arrivee = emptyScene('arrivee-camp', 10, 10);
const carte: WorldMap = {
  id: 'camp', label: 'Campement',
  params: { perilDie: 0 },
  places: [
    { id: 'depart', label: 'Départ', pos: { x: 0, y: 0 }, scene: { id: depart.id } },
    { id: 'arrivee', label: 'Arrivée', pos: { x: 5, y: 5 }, scene: { id: arrivee.id } },
  ],
  routes: [{ id: 'route-du-camp', a: { id: 'depart' }, b: { id: 'arrivee' }, km: 5, modes: ['pied'] }],
};

function preparerVoyage(options: {
  fatigue: boolean; blessures: boolean; competence: 'survie-en-exterieur' | 'guerison'; secondCamp?: boolean; malaise?: boolean;
}) {
  const banc = ouvrirLeBanc({ etat: { gameTime: campaignStart() } });
  setRule('voyage-etapes', true);
  onTestFinished(() => resetRule('voyage-etapes'));
  const { getState: get } = banc;
  const campeur = combattantDeTest({
    id: 'campeur', label: 'Campeur', kind: 'heros',
    skills: [{ id: options.competence, characteristic: 'intelligence', advances: 20 }],
  });
  const marcheur = combattantDeTest({
    id: 'marcheur', label: 'Marcheur', kind: 'heros', characteristics: { intelligence: 40 },
    skills: [{ id: 'guerison', characteristic: 'intelligence', advances: 10 }],
  });
  if (options.fatigue) addCondition(marcheur, 'extenue', 1);
  if (options.malaise) {
    contractDiseaseOnce(marcheur, 'rhume-commun', deFixe(5));
    syncDerivedConditions(marcheur);
  }
  const profilDuBlesse = { id: 'blesse', label: 'Blessé', kind: 'heros' } as const;
  const blesse = options.blessures ? blesseDeTest(3, profilDuBlesse) : combattantDeTest(profilDuBlesse);
  get().fixerLeGroupe([campeur, marcheur, blesse]);
  const identite = { type: 'projet', id: 'voyage-camp', label: 'Voyage et camp', versionContenu: 1, maison: 'Banc de voyage.' } as const;
  const projet = parseProject(documentDeProjet(identite, [depart, arrivee], { worldMap: carte, narratif: emptyNarratif() }));
  get().chargerLeProjet({ scenes: projet.scenes, entryId: depart.id, worldMap: projet.worldMap, projet });
  get().affecterAuRoleDeMarche(campeur.id, { activityId: 'monter-camp' });
  get().affecterAuRoleDeMarche(marcheur.id, { activityId: options.secondCamp ? 'monter-camp' : 'recuperer' });
  get().affecterAuRoleDeMarche(blesse.id, { activityId: 'recuperer' });
  return get;
}

function optionDeCamp(etat: Jeu) {
  const p = projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 });
  return zonesDeLEcran(etat, p, fenetreADessiner(etat), null, SANS_ROSTER, [])['fenetre.reglages']
    .find((g) => g.id === 'jetRegler@cascade#choix');
}

describe('Monter un camp sur la route (EDOC 08 l.180, LDB 09 l.260)', () => {
  it.each(['survie-en-exterieur', 'guerison'] as const)(
    'répartit 3 DR d’un test %s entre une fatigue retirable et un blessé, avec un Exténué de Malaise',
    (competence) => {
      const get = preparerVoyage({ fatigue: true, blessures: true, competence, malaise: true });
      setDesFixes(true);
      onTestFinished(resetDesFixes);
      const pbs = () => get().party.find((h) => h.id === 'blesse')!.wounds.current;
      const etats = () => stacks(get().party.find((h) => h.id === 'marcheur')!, 'extenue');
      get().partirEnVoyage('route-du-camp', 'pied', { cadence: 'jourParJour' });
      expect(avanceEtapeCascade(get, () => 42)).toBe('etape-meteo');
      expect(avanceEtapeCascade(get, (_step, row) => row?.id === 'campeur' ? 24 : undefined)).toBe('etapePosteEnBande');

      const avant = get().pendingCascade;
      expect(avant?.purpose).toBe('travelDay');
      expect(avant?.participants.find((s) => s.kind === 'etapePosteEnBande')?.participants?.find((r) => r.id === 'campeur')?.result)
        .toMatchObject({ success: true, sl: 3 });
      expect([etats(), pbs()]).toEqual([2, 3]);
      expect(optionDeCamp(get())).toMatchObject({
        valeurs: [{ libelle: 'Retirer un Exténué à Marcheur' }, { libelle: 'Rendre 4 PB à Blessé' }, { libelle: 'Renoncer aux DR restants' }],
      });

      expect(avanceEtapeCascade(get, undefined, () => 'extenue:marcheur')).toBe('etapePosteCamp');
      expect([etats(), pbs()]).toEqual([1, 3]);
      expect(optionDeCamp(get())).toMatchObject({
        valeurs: [{ libelle: 'Rendre 4 PB à Blessé' }, { libelle: 'Renoncer aux DR restants' }],
      });
      expect(avanceEtapeCascade(get, undefined, () => 'guerison:blesse')).toBe('etapePosteCamp');
      expect(pbs()).toBe(7);
      expect(optionDeCamp(get())).toMatchObject({
        valeurs: [{ libelle: 'Rendre 1 PB à Blessé' }, { libelle: 'Renoncer aux DR restants' }],
      });
      expect(avanceEtapeCascade(get, undefined, () => 'guerison:blesse')).toBe('etapePosteCamp');
      draineCascade(get);
      expect([etats(), pbs(), get().lieu]).toEqual([1, 8, 'arrivee']);
    },
  );

  it('sous ordres, attend la décision même quand il faut renoncer faute de cible', () => {
    const get = preparerVoyage({ fatigue: false, blessures: false, competence: 'guerison' });
    get().ensemencerLeTirage(1);
    get().partirEnVoyage('route-du-camp', 'pied', { cadence: 'commande' });
    const etape = () => {
      const cascade = get().pendingCascade;
      return cascade?.participants[cascade.cursor];
    };
    expect(etape()).toMatchObject({ kind: 'etapePosteCamp', actorId: 'campeur' });
    expect(etape()?.defaultChoice).toBeUndefined();
    expect(optionDeCamp(get())).toMatchObject({ valeurs: [{ libelle: 'Renoncer aux DR restants' }] });
    get().jetValider('cascade');
    expect(etape()?.kind).toBe('etapePosteCamp');
    expect(get().lieu).toBeNull();
    avanceEtapeCascade(get, undefined, () => 'renoncer');
    draineCascade(get);
    expect(get().lieu).toBe('arrivee');
  });

  it('le renoncement du premier campeur laisse le second répartir ses propres DR', () => {
    const get = preparerVoyage({ fatigue: false, blessures: true, competence: 'guerison', secondCamp: true });
    setDesFixes(true);
    onTestFinished(resetDesFixes);
    get().partirEnVoyage('route-du-camp', 'pied', { cadence: 'jourParJour' });
    avanceEtapeCascade(get, () => 42);
    avanceEtapeCascade(get, (_step, row) => row?.id === 'campeur' ? 24 : 44);
    expect(avanceEtapeCascade(get, undefined, () => 'guerison:blesse')).toBe('etapePosteCamp');
    expect(avanceEtapeCascade(get, undefined, () => 'renoncer')).toBe('etapePosteCamp');

    const cascade = get().pendingCascade;
    expect(cascade?.participants[cascade.cursor]).toMatchObject({ kind: 'etapePosteCamp', actorId: 'marcheur' });
    expect(optionDeCamp(get())).toMatchObject({ valeurs: [{ libelle: 'Rendre 5 PB à Blessé' }, { libelle: 'Renoncer aux DR restants' }] });
    expect(avanceEtapeCascade(get, undefined, () => 'guerison:blesse')).toBe('etapePosteCamp');
    draineCascade(get);
    expect(get().party.find((h) => h.id === 'blesse')?.wounds.current).toBe(12);
  });
});
