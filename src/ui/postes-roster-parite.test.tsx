// @vitest-environment jsdom
/**
 * PARITÉ des rosters — doctrine utilisateur 2026-09-04 : « une interface cohérente dans toute
 * l'application […] toucher aux primitives plutôt que partir à la chasse de tous les écrans ».
 *
 * Les trois surfaces d'assignation (rôles de marche EDOC 8, postes d'équipage MDG 14, stations à bord
 * MDG 13) et les DEUX porteurs des postes d'équipage (carte du monde = le GROUPE, dossier de navire =
 * l'équipage de la coque) ne diffèrent que par leurs DONNÉES. Ce contrat mesure le SQUELETTE : même
 * markup, même banc, même case vide, aucune inférence affichée nulle part. Si un écran repartait en
 * héros-first, ou fabriquait sa propre case, il divergerait ICI.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { navalTraitsDe } from '../engine/navalTraits';
import { crewRoles, shipStations } from '../data';
import { exposedCrew } from '../engine/shipCritical';
import { manoeuvreCrew } from './ShipSheet';
import { shipDefaultRoles } from '../state/shipCrew';
import { activitiesFor } from '../engine/activities';
import type { Combatant } from '../engine/types';
import { TravelRolesPanel } from './TravelRolesPanel';
import { ShipRolesPanel } from './ShipRolesPanel';
import { ShipStationsPanel } from './ShipStationsPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

/** MÊME groupe pour les quatre montages : seules les données de poste changent d'un roster à l'autre. */
function groupe(): Combatant[] {
  return [
    { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brenner', seed: 7 }), id: 'a' },
    { ...createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Hilda', seed: 8 }), id: 'b' },
  ];
}

function monter(el: React.ReactElement): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(el); });
  return container;
}

/** Le SQUELETTE mesuré : nombre de lignes, présence du banc, case vide muette, aucune inférence. */
function squelette(el: HTMLElement) {
  const lignes = [...el.querySelectorAll('.pr-ligne')] as HTMLElement[];
  const banc = el.querySelector('.pr-banc .pr-ligne') as HTMLElement;
  return {
    nbLignes: lignes.length,
    dernierEstBanc: lignes[lignes.length - 1] === banc,
    bancPresent: !!banc,
    casesVidesMuettes: lignes.every((l) => {
      const add = l.querySelector('.pr-add') as HTMLButtonElement | null;
      return add == null || (add.textContent?.trim() === '' && !!add.getAttribute('aria-label'));
    }),
    aucuneInference: !el.textContent?.includes('auto') && el.querySelector('[data-auto]') == null,
    aucunTitre: [...el.querySelectorAll('.pr-label')].every((n) => !(n as HTMLElement).closest('[title]')),
    // Le mot « auto » ne suffit pas à prouver qu'aucune DÉDUCTION n'est montrée : une ligne peut se
    // peupler en silence. On mesure la CHOSE — un portrait sur une ligne dont personne n'est épinglé.
    portraitsParLigne: lignes.map((l) => ({
      poste: (l as HTMLElement).dataset.poste,
      n: l.querySelectorAll('.ptile').length,
      ferme: !!l.querySelector('button[aria-disabled="true"]'),
      ajoutActif: !!l.querySelector('.pr-add'),
    })),
    banc: banc?.querySelectorAll('.ptile').length ?? -1,
  };
}

describe('PARITÉ — les rosters ne diffèrent QUE par leurs données', () => {
  it('les 4 porteurs rendent le MÊME squelette (le cardinal seul change)', () => {
    const party = groupe();
    useGame.setState({ party, battle: null, massBattle: null, interlude: null, journal: [] });

    const marche = squelette(monter(<TravelRolesPanel />));
    act(() => root?.unmount()); container?.remove();
    const equipageCarte = squelette(monter(<ShipRolesPanel />));
    act(() => root?.unmount()); container?.remove();
    // Le DOSSIER de navire montre l'équipage de la COQUE, pas le groupe : même primitive, autre population.
    const equipageDossier = squelette(monter(<ShipRolesPanel crew={party} onSet={() => {}} />));
    act(() => root?.unmount()); container?.remove();
    const stations = squelette(monter(<ShipStationsPanel traits={navalTraitsDe('barge-fluviale', undefined)} />));

    for (const [nom, s] of Object.entries({ marche, equipageCarte, equipageDossier, stations })) {
      expect(s.bancPresent, `${nom} : le banc ferme le roster`).toBe(true);
      expect(s.dernierEstBanc, `${nom} : le banc est la DERNIÈRE ligne`).toBe(true);
      expect(s.casesVidesMuettes, `${nom} : une case vide ne porte aucun mot`).toBe(true);
      expect(s.aucuneInference, `${nom} : rien de déduit n'est affiché`).toBe(true);
      expect(s.aucunTitre, `${nom} : aucune information en infobulle native`).toBe(true);
      // AUCUN épinglage dans la fixture ⇒ AUCUNE ligne de poste ne porte personne, et le banc les
      // porte TOUS. Une déduction affichée peuplerait une ligne et viderait le banc d'autant.
      const postes = s.portraitsParLigne.filter((l) => l.poste !== '__banc');
      expect(postes.filter((l) => l.n > 0), `${nom} : aucune ligne peuplée sans épinglage`).toEqual([]);
      expect(s.banc, `${nom} : les 2 héros sont au banc`).toBe(2);
      // Une ligne FERMÉE reste inerte : son ajout n'est jamais actif.
      expect(postes.filter((l) => l.ferme && l.ajoutActif), `${nom} : une ligne fermée n’offre aucun ajout actif`).toEqual([]);
    }
    // …et le refus EXISTE là où la donnée le dit : la barge ne porte pas de nid-de-pie
    // (`requiresTrait`, MDG 12 l.299). Sans cette assertion POSITIVE, « aucune ligne fermée active »
    // serait vrai aussi d'un écran qui aurait cessé de fermer quoi que ce soit.
    const nid = stations.portraitsParLigne.find((l) => l.poste === 'nid-de-pie')!;
    expect(nid.ferme, 'la station que la coque n’a pas est ÉTEINTE').toBe(true);
    expect(nid.ajoutActif, 'et son ajout n’est pas actif').toBe(false);
    expect(stations.portraitsParLigne.find((l) => l.poste === 'pont')!.ferme, 'toute coque a un pont').toBe(false);

    // Cardinal RÉEL des catalogues (+1 ligne de banc ; +1 ligne « Repos » pour les postes d'équipage,
    // poste synthétique hors catalogue MDG 14 qui rend épinglable la valeur `BENCHED`).
    expect(marche.nbLignes).toBe(activitiesFor('voyage').length + 1);
    expect(equipageCarte.nbLignes).toBe(crewRoles.length + 2);
    expect(equipageDossier.nbLignes).toBe(crewRoles.length + 2);
    expect(stations.nbLignes).toBe(shipStations.length + 1);
    expect([activitiesFor('voyage').length, crewRoles.length, shipStations.length]).toEqual([8, 9, 5]);
  });

  it('« Repos » est une LIGNE ÉPINGLABLE du roster d’équipage (plus une valeur cachée)', () => {
    const party = groupe();
    useGame.setState({ party, battle: null, massBattle: null, interlude: null, journal: [] });
    const el = monter(<ShipRolesPanel />);
    const repos = el.querySelector('.pr-ligne[data-poste="repos"]') as HTMLElement;
    expect(repos, 'la ligne existe').toBeTruthy();
    expect(repos.textContent).toContain('Repos');
    act(() => { (repos.querySelector('.pr-add') as HTMLButtonElement).click(); });
    const btn = [...document.querySelectorAll('[data-panneau-parametre] button')].find((b) => b.textContent?.includes('Brenner')) as HTMLButtonElement;
    act(() => { btn.click(); });
    expect(useGame.getState().party.find((h) => h.id === 'a')!.shipRole, 'la valeur de résolution est posée telle quelle').toBe('repos');
  });
});

/**
 * APTITUDE — le roster ne montre que l'équipage qu'un Test peut RÉELLEMENT enrôler.
 * `shipDefaultRoles` part d'`exposedCrew` : un mort, un marin à 0 Blessure ne tiennent aucun rôle,
 * MÊME épinglés. Les offrir à l'épinglage promettrait un geste que la résolution ignore — c'est ce
 * que le composeur (`PosteSheet`) empêche en filtrant AVANT de passer `crew` à la primitive.
 */
describe('APTITUDE — un marin hors d’état n’entre pas au roster', () => {
  const marin = (id: string, label: string, pv: number, dead = false): Combatant => ({
    id, label, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: pv, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, dead,
  } as Combatant);

  it('le RÉSOLVEUR ignore mort et 0 Blessure, même ÉPINGLÉS — la surface doit s’aligner sur lui', () => {
    const vivant = marin('v', 'Hilda', 12);
    const mort = marin('m', 'Brenner', 0, true);
    const ko = marin('k', 'Ansmann', 0);
    const crew = [vivant, mort, ko];
    expect(exposedCrew(crew).map((c) => c.id), 'seul le vivant est exposé').toEqual(['v']);
    const roles = shipDefaultRoles(crew.map((c) => ({ ...c, shipRole: 'timonier' })), 'manoeuvre');
    expect([...roles.keys()], 'même épinglé, un marin hors d’état ne tient aucun rôle au Test').toEqual(['v']);
  });

  it('le COMPOSEUR du dossier écarte l’inapte AVANT la primitive (`manoeuvreCrew`)', () => {
    const vivant = marin('v', 'Hilda', 12);
    const mort = marin('m', 'Brenner', 0, true);
    const ko = marin('k', 'Ansmann', 0);
    const servant = marin('s', 'Perla', 12);
    const hull = { id: 'ship', label: 'La Cogue', kind: 'npc', conditions: [], wounds: { current: 50, max: 50 },
      postes: [{ item: { label: 'Pierrier', uid: 'p1' }, crewIds: ['s'] }] } as unknown as Combatant;
    const montre = manoeuvreCrew(hull, [vivant, mort, ko, servant]).map((c) => c.id);
    expect(montre, 'ni le mort, ni le marin à 0 Blessure, ni le servant de pièce').toEqual(['v']);
    // Et c'est bien le MÊME crible que le résolveur applique.
    expect(exposedCrew([vivant, mort, ko]).map((c) => c.id)).toEqual(['v']);
  });

  it('la primitive rend CE qu’on lui donne : le filtre est au COMPOSEUR, elle ne devine pas', () => {
    const vivant = marin('v', 'Hilda', 12);
    useGame.setState({ party: [vivant], battle: null, massBattle: null, interlude: null, journal: [] });
    // `PosteSheet` passe `exposedCrew(crew)` : la primitive reçoit déjà l'équipage apte.
    const el = monter(<ShipRolesPanel crew={exposedCrew([vivant, marin('m', 'Brenner', 0, true)])} onSet={() => {}} />);
    act(() => { (el.querySelector('.pr-ligne[data-poste="timonier"] .pr-add') as HTMLButtonElement).click(); });
    const noms = [...document.querySelectorAll('[data-panneau-parametre] button')].map((b) => b.textContent).join(' | ');
    expect(noms, 'le vivant est proposé').toContain('Hilda');
    expect(noms, 'le mort n’est proposé nulle part').not.toContain('Brenner');
  });
});
