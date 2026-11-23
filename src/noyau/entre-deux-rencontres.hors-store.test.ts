/**
 * ENTRE DEUX RENCONTRES (#4833) : sur une scène générée, le repos du noyau joue la récupération et dit pourquoi elle est
 * nulle (LDB 16 l.74, l.105 ; LDB 18 l.296, l.338) ; la fin de convalescence d'une fracture passe par la nuit du noyau
 * (LDB 18 l.202) ; l'infirmerie dit toujours pourquoi elle ne soigne pas (LDB 09 l.260) et son soigneur se choisit
 * (réglage `soins.soigneur`, Soutien LDB 12).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';
import { arena } from '../scenes/test-scenarios/_shared';
import { t } from '../i18n';
import { fenetreDuSoin } from './soin';
import { draineCascade } from './cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 55, force: 35, endurance: 43, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 35, sociabilite: 30 };
const heros = (id: string, over: Partial<Combatant> = {}): Combatant => blessuresSurLeProfil({
  id, label: id, kind: 'heros', characteristics: { ...CHARS }, conditions: [], skills: [], talents: [], weapons: [], advantage: 0,
  pos: { x: 0, y: 0 }, wounds: blessuresDeBase(14), fortune: 2, resilience: 1, movement: 4,
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over,
} as Combatant) as Combatant;
const guerison = (advances: number) => [{ id: 'guerison', advances, characteristic: 'intelligence' }] as Combatant['skills'];
const blesse = (id: string, over: Partial<Combatant> = {}) => heros(id, { wounds: blessuresDeBase(14, 4), ...over });

/** Le groupe `party` hors combat, sur une arène générée. */
function surLArene(party: Combatant[], rest?: { maison: true }): void {
  const scene = arena({ id: 'arene', label: 'Arène', w: 8, h: 8 });
  banc.setState({ mode: 'exploration', battle: null, party, journal: [], pendingRest: null, pendingCascade: null, medic: null, pendingHeal: null, scene: rest ? { ...scene, rest } : scene } as never);
}

/** La nuit réglée par défaut, puis chaque jet de la nuit joué (`draineCascade`). */
function dormir(): void {
  g().ouvrirLeRepos();
  g().fenetreValider('repos');
  draineCascade(g);
}

describe('le repos sur une scène générée récupère, ou dit pourquoi', () => {
  it('nourri au logis : la nuit rend des Points de Blessure (LDB 18 l.296)', () => {
    surLArene([blesse('a')], { maison: true });
    dormir();
    expect(g().party[0].wounds.current).toBeGreaterThan(4);
  });

  it('sans vivres : la nuit dit que le héros, affamé, ne récupère pas (LDB 18 l.338)', () => {
    surLArene([blesse('a')]);
    dormir();
    expect(g().party[0].wounds.current).toBe(4);
    expect(g().journal).toContain(t('rest.deprived', { name: 'a', etat: t('rest.deprivedHunger') }));
  });

  it('Hémorragique : la nuit dit qu’il est à stabiliser (LDB 16 l.105)', () => {
    surLArene([blesse('a', { conditions: [{ id: 'hemorragique', value: 1 }] })], { maison: true });
    dormir();
    expect(g().journal).toContain(t('rest.noRest', { name: 'a' }));
  });

  it('la fracture au terme de sa convalescence se clôt par la nuit du noyau (LDB 18 l.202)', () => {
    const fracture = { uid: 'f1', kind: 'fracture', label: 'Fracture du bras', location: 'brasD', severity: 'mineur', recoveryDays: 1 };
    surLArene([heros('a', { traumas: [fracture] as Combatant['traumas'], criticalWounds: 1 })], { maison: true });
    dormir();
    expect(g().party[0].criticalWounds).toBe(0);
    expect(g().journal.some((l) => l === t('tra.fractureHealed', { name: 'a', label: fracture.label }) || l === t('tra.fractureSequela', { name: 'a', label: fracture.label }))).toBe(true);
  });
});

describe('l’infirmerie dit toujours pourquoi elle ne soigne pas', () => {
  it('un blessé qui a reçu son jet de Guérison de la rencontre : le refus le dit (LDB 09 l.260)', () => {
    surLArene([heros('doc', { skills: guerison(20) }), blesse('p', { soinRencontreUtilise: true })]);
    g().ouvrirLeMedecin('p');
    expect(g().medic).toBeNull();
    expect(g().journal[g().journal.length - 1]).toBe(t('heal.raisonSoinDejaRecu'));
  });

  it('sans patient désigné ni personne à soigner : le refus le dit', () => {
    surLArene([heros('doc', { skills: guerison(20) }), blesse('p', { soinRencontreUtilise: true })]);
    g().ouvrirLeMedecin();
    expect(g().medic).toBeNull();
    expect(g().journal[g().journal.length - 1]).toBe(t('heal.raisonSoinDejaRecu'));
  });

  it('sans patient désigné : l’infirmerie s’ouvre sur le premier blessé qu’elle soigne', () => {
    surLArene([heros('doc', { skills: guerison(20) }), blesse('p', { soinRencontreUtilise: true }), blesse('q')]);
    g().ouvrirLeMedecin();
    expect(g().medic?.patientId).toBe('q');
    expect(g().pendingHeal).toMatchObject({ targetId: 'q', mode: 'blessures' });
  });
});

describe('le soigneur de l’infirmerie se choisit (réglage `soins.soigneur`)', () => {
  it('le soigneur choisi jette, soutenu par l’autre (LDB 12)', () => {
    surLArene([heros('fort', { skills: guerison(30) }), heros('faible', { skills: guerison(5) }), blesse('p')]);
    g().ouvrirLeMedecin('p');
    expect(g().pendingHeal?.healerId, 'le meilleur par défaut').toBe('fort');
    g().jetRegler('soins', 'soigneur', 'faible');
    expect(g().pendingHeal).toMatchObject({ healerId: 'faible', support: { ids: ['fort'] } });
    expect(fenetreDuSoin(g())?.soigneur?.choisie).toBe('faible');
    g().fenetreChoisir('infirmerie', 'patient', 'fort');
    expect(g().pendingHeal?.healerId, 'le choix tient d’un patient à l’autre').toBe('faible');
  });

  it('un héros sans Guérison ne prend pas le soin : refusé, le soin reste au soigneur', () => {
    surLArene([heros('doc', { skills: guerison(30) }), blesse('p')]);
    g().ouvrirLeMedecin('p');
    g().jetRegler('soins', 'soigneur', 'p');
    expect(g().pendingHeal?.healerId).toBe('doc');
    expect(g().journal[g().journal.length - 1]).toBe(t('medic.soigneurSansActe', { name: 'p' }));
    expect(fenetreDuSoin(g())?.soigneur?.options.map((o) => o.valeur)).toEqual(['doc']);
  });
});
