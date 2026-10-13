// @vitest-environment jsdom
/**
 * Rôles de marche : le poste est un Test CHOISI (EDOC 8 l.131). Un héros qui ne peut tenter aucune
 * compétence du poste (LDB 09 l.30 ; Inconscient, LDB 16 l.113) reste candidat au panneau, FERMÉ avec
 * le refus que l'Étape poserait (#2588). Pratiquer une Compétence demande la Compétence (EDOC 8 l.172) :
 * celles de sa fiche et les Compétences de base hors fiche (LDB 09 l.30), chacune fermée avec son refus
 * s'il ne peut pas la tenter ; un héros qui n'en peut tenter aucune est fermé dès le premier panneau, et
 * la case affiche la Compétence épinglée.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useGame } from '../state/store';
import { refusNePeutTenter } from '../engine/skills';
import { TravelRolesPanel } from './TravelRolesPanel';
import { ACTIVITIES, activityById } from '../engine/activities';
import { setDataset } from '../data/overrides';
import { refLabel } from '../data';
import type { Combatant } from '../engine/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

const hero = (id: string, label: string, over: Partial<Combatant> = {}): Combatant => ({
  id, label, kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...over,
} as Combatant);

const HILDA = hero('h1', 'Hilda');
const GUNNAR = hero('h2', 'Gunnar', { conditions: [{ id: 'inconscient', value: 1 }] } as Partial<Combatant>);

function ouvrirPanneau(poste: string): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(<TravelRolesPanel />); });
  const ajout = container.querySelector(`.pr-ligne[data-poste="${poste}"] .pr-add`) as HTMLButtonElement;
  act(() => { ajout.click(); });
  return document.querySelector('[data-panneau-parametre]') as HTMLElement;
}
const candidat = (panneau: HTMLElement, nom: string) =>
  [...panneau.querySelectorAll('button')].find((b) => b.textContent?.includes(nom)) as HTMLButtonElement;

describe('TravelRolesPanel — un poste que le héros ne peut pas tenter est FERMÉ par candidat', () => {
  beforeEach(() => useGame.setState({ party: [HILDA, GUNNAR] }));

  it('le candidat Inconscient reste offert, éteint, et dit pourquoi ; l’autre reste ouvert', () => {
    const panneau = ouvrirPanneau('rester-aux-aguets');
    const ferme = candidat(panneau, 'Gunnar');
    expect(ferme.getAttribute('aria-disabled')).toBe('true');
    expect(ferme.hasAttribute('disabled'), 'atteignable, jamais disabled').toBe(false);
    const raison = document.getElementById(ferme.getAttribute('aria-describedby')!);
    expect(raison?.textContent).toContain(refusNePeutTenter(GUNNAR, { skill: 'perception' }));
    expect(candidat(panneau, 'Hilda').getAttribute('aria-disabled')).toBeNull();
  });

  it('cliquer le candidat fermé n’épingle rien', () => {
    const panneau = ouvrirPanneau('rester-aux-aguets');
    act(() => { candidat(panneau, 'Gunnar').click(); });
    expect(useGame.getState().party.find((h) => h.id === 'h2')!.travelRole).toBeUndefined();
  });
});

describe('TravelRolesPanel — Pratiquer une Compétence demande la Compétence', () => {
  const ERUDIT = hero('h3', 'Aldric', { skills: [{ id: 'escalade', advances: 10 }, { id: 'evaluation', advances: 0 }] as Combatant['skills'] });
  beforeEach(() => useGame.setState({ party: [ERUDIT] }));

  const panneauCompetence = (): HTMLElement => {
    const personnes = ouvrirPanneau('pratiquer-competence');
    act(() => { candidat(personnes, 'Aldric').click(); });
    const panneaux = [...document.querySelectorAll('[data-panneau-parametre]')] as HTMLElement[];
    expect(panneaux).toHaveLength(1);
    expect(panneaux[0].getAttribute('aria-label')).toContain('quelle Compétence');
    return panneaux[0];
  };

  it('choisir le héros n’épingle rien : le panneau demande la Compétence ; l’Avancée sans Augmentation est fermée et dit pourquoi', () => {
    const panneau = panneauCompetence();
    expect(useGame.getState().party[0].travelRole).toBeUndefined();
    const fermee = candidat(panneau, refLabel('skills', { id: 'evaluation' }));
    expect(fermee.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(fermee.getAttribute('aria-describedby')!)?.textContent).toContain(refusNePeutTenter(ERUDIT, { skill: 'evaluation' }));
    act(() => { fermee.click(); });
    expect(useGame.getState().party[0].travelRole).toBeUndefined();
  });

  it('la Compétence choisie part avec le poste épinglé', () => {
    const panneau = panneauCompetence();
    act(() => { candidat(panneau, refLabel('skills', { id: 'escalade' })).click(); });
    expect(useGame.getState().party[0].travelRole).toEqual({ activityId: 'pratiquer-competence', freeSkill: { id: 'escalade' } });
    expect(document.querySelector('[data-panneau-parametre]')).toBeNull();
  });
});

describe('TravelRolesPanel — Pratiquer une Compétence : jamais épinglé sans Compétence', () => {
  const panneaux = () => [...document.querySelectorAll('[data-panneau-parametre]')] as HTMLElement[];

  it('héros sans Compétence à sa fiche : ouvert, il demande une Compétence de base, il n’épingle rien seul', () => {
    useGame.setState({ party: [hero('h0', 'Nu')] });
    const personnes = ouvrirPanneau('pratiquer-competence');
    expect(candidat(personnes, 'Nu').getAttribute('aria-disabled')).toBeNull();
    act(() => { candidat(personnes, 'Nu').click(); });
    expect(useGame.getState().party[0].travelRole).toBeUndefined();
    const [competences] = panneaux();
    expect(competences.getAttribute('aria-label')).toContain('quelle Compétence');
    expect(candidat(competences, refLabel('skills', { id: 'orientation' })).getAttribute('aria-disabled')).toBeNull();
  });

  it('héros Inconscient : FERMÉ dès le premier panneau, avec sa raison ; cliqué, rien ne s’épingle ni ne s’ouvre', () => {
    const ko = hero('h1', 'Ko', { conditions: [{ id: 'inconscient', value: 1 }], skills: [{ id: 'escalade', advances: 10 }] } as Partial<Combatant>);
    useGame.setState({ party: [ko] });
    const personnes = ouvrirPanneau('pratiquer-competence');
    const ferme = candidat(personnes, 'Ko');
    expect(ferme.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(ferme.getAttribute('aria-describedby')!)?.textContent)
      .toContain(refusNePeutTenter(ko, { action: activityById('pratiquer-competence')!.label }));
    act(() => { ferme.click(); });
    expect(useGame.getState().party[0].travelRole).toBeUndefined();
    expect(panneaux().some((p) => p.getAttribute('aria-label')?.includes('quelle Compétence'))).toBe(false);
  });

  it('la case affiche la Compétence épinglée en texte visible, sur un élément focalisable', () => {
    useGame.setState({ party: [hero('h2', 'Aldric', { skills: [{ id: 'escalade', advances: 10 }], travelRole: { activityId: 'pratiquer-competence', freeSkill: { id: 'escalade' } } } as Partial<Combatant>)] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<TravelRolesPanel />); });
    const ligne = container.querySelector('.pr-ligne[data-poste="pratiquer-competence"]') as HTMLElement;
    const precision = ligne.querySelector('.pr-precision') as HTMLElement;
    expect(precision.textContent).toBe(refLabel('skills', { id: 'escalade' }));
    expect(precision.tabIndex).toBe(0);
  });
});

describe('TravelRolesPanel — un poste non tenu (`postingTenu`) ne s’affiche jamais comme affecté', () => {
  it('un rôle épinglé que l’édition du catalogue rend non tenu quitte sa case', () => {
    useGame.setState({ party: [hero('h4', 'Aldric')] });
    useGame.getState().setTravelRole('h4', { activityId: 'recuperer' });
    const affecteARecuperer = (): boolean => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => { root!.render(<TravelRolesPanel />); });
      const noms = [...container.querySelectorAll('.pr-ligne[data-poste="recuperer"] [aria-label]')].map((b) => b.getAttribute('aria-label') ?? '');
      act(() => root?.unmount()); container.remove(); root = null; container = null;
      return noms.some((n) => n.includes('Retirer Aldric'));
    };
    expect(affecteARecuperer(), 'contrôle : le poste tenu s’affiche affecté').toBe(true);
    const avant = [...ACTIVITIES];
    try {
      setDataset('activities', avant.map((a) => (a.id === 'recuperer' ? { ...a, freeSkill: true } : a)));
      expect(affecteARecuperer()).toBe(false);
    } finally {
      setDataset('activities', avant);
    }
  });
});
