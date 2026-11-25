/**
 * GARDE ABSOLUE (#2219, #2539) — tout drapeau LU par un paquet a son PRODUCTEUR (`setFlag`) dans ce paquet ; tout état
 * de campagne LU (Condition `etat`, sélecteur `who: {etat}`) a le sien (`poserEtat`, `designerHeros`), et toute VALEUR
 * comparée (`etat` + `value`) un `poserEtat` de cette valeur ; tout état DÉCLARÉ (`narratif.etats`) est produit dans le
 * paquet. Le détecteur : `./lectureEtProduction.testkit.ts` ; chaque projet le joue sur ses paquets dans sa suite.
 *
 * ABSOLUE : aucun stock, aucune exemption — la garde NOMME ses sites.
 */
import { describe, it, expect } from 'vitest';
import { parseProject } from '../../../noyau/worldMap';
import paquetDeTest from '../../../scenes/fixtures/paquet-de-test.json';
import { declaresNonProduits, lusSansProducteur } from './lectureEtProduction.testkit';
import type { PaquetASites } from './sites-de-paquet';

describe('#2219 · #2539 — sur le paquet de test', () => {
  it('tout drapeau ou état lu a son producteur', () => {
    expect(lusSansProducteur(parseProject(structuredClone(paquetDeTest)))).toEqual([]);
  });

  it('tout état déclaré est produit', () => {
    expect(declaresNonProduits(parseProject(structuredClone(paquetDeTest)))).toEqual([]);
  });
});

// COUVERTURE du détecteur, sur un paquet jouet : sans elle, le vert ci-dessus ne dirait rien des sites
// qu'aucun paquet livré ne peuple.
describe('#2219 · #2539 — chaque site lecteur est lu, chaque site producteur produit', () => {
  const flag = (expr: string) => ({ kind: 'flag', expr });
  const pose = (f: string) => ({ kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'setFlag', flag: f } }] });
  const si = (cond: unknown) => ({ kind: 'si', condition: cond, alors: { kind: 'sequence', etapes: [] } });
  const jouet = (): PaquetASites => ({
    scenes: [{
      id: 's',
      triggers: [
        { id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, when: { kind: 'all', of: [flag('dec')] }, flow: pose('produit') },
        { id: 'u', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'sequence', etapes: [
          si(flag('flux-declencheur')),
          { kind: 'effet', effet: { type: 'delayedEffect', afterMinutes: 5, cancelFlag: 'annule', flow: si({ kind: 'etat', etat: 'issue', value: 'v' }) } },
        ] } },
      ],
      entities: [{ id: 'e', usable: { actions: [
        { id: 'a', flow: { kind: 'sequence', etapes: [
          { kind: 'effet', effet: { type: 'setFlag', flag: 'par-action' } },
          { kind: 'test', test: { skill: { id: 'perception' }, gate: flag('porte') }, reussite: { kind: 'sequence', etapes: [] }, echec: { kind: 'sequence', etapes: [] } },
        ] } },
      ] } }],
      encounters: [{ id: 'r', onVictory: si({ kind: 'partyDead', who: { etat: 'sosie' } }) }],
      dialogues: [{ id: 'd', start: { id: 'n' }, nodes: [{ id: 'n', desc: '…', choices: [
        { id: 'a', label: 'a', when: flag('choix') },
        { id: 'b', label: 'b', flow: si(flag('si')) },
      ] }] }],
    }],
    worldMap: { places: [{ id: 'l', when: flag('lieu,!produit,!par-action') }], routes: [{ id: 'r', when: flag(' route ') }] },
    narratif: { cloture: { when: flag('clos') } },
  });

  it('lieu, route, clôture, déclencheur (`when` et `flow`), action, rencontre, choix, `if` de dialogue, `gate` de test, `cancelFlag` sont NOMMÉS ; un drapeau posé dans `usable.actions[].flow` ou `triggers[].flow` ne l’est pas', () => {
    expect(lusSansProducteur(jouet())).toEqual([
      's › déclencheur t : drapeau dec',
      's › dialogue d : drapeau choix',
      's › déclencheur u : drapeau flux-declencheur',
      's › déclencheur u : état issue',
      's › déclencheur u : valeur issue=v',
      's › action e›a : drapeau porte',
      's › dialogue d : drapeau si',
      's › rencontre r : état sosie',
      'carte › lieu l : drapeau lieu',
      'carte › route r : drapeau route',
      'narratif › clôture : drapeau clos',
      's › déclencheur u : drapeau annule',
    ]);
  });

  const actionDe = (p: PaquetASites) => (p.scenes[0] as { entities: { usable: { actions: { flow: { etapes: unknown[] } }[] } }[] }).entities[0].usable.actions[0].flow;

  it('`poserEtat` et `designerHeros` produisent l’état qu’un lecteur lit, `poserEtat` la valeur comparée', () => {
    const p = jouet();
    actionDe(p).etapes.push({ kind: 'effet', effet: { type: 'designerHeros', etat: 'sosie' } }, { kind: 'effet', effet: { type: 'poserEtat', etat: 'issue', valeur: 'v' } });
    expect(lusSansProducteur(p).filter((l) => / : (état|valeur) /.test(l))).toEqual([]);
  });

  it('une valeur comparée que nul `poserEtat` ne pose est nommée, même si l’état est produit', () => {
    const p = jouet();
    actionDe(p).etapes.push({ kind: 'effet', effet: { type: 'poserEtat', etat: 'issue', valeur: 'autre' } });
    expect(lusSansProducteur(p).filter((l) => / : (état|valeur) /.test(l))).toEqual(['s › déclencheur u : valeur issue=v', 's › rencontre r : état sosie']);
  });

  it('un état déclaré que rien ne produit est nommé', () => {
    const p = jouet();
    (p.narratif as { etats?: unknown[] }).etats = [{ id: 'issue' }, { id: 'muet' }, { id: 'sosie' }];
    actionDe(p).etapes.push({ kind: 'effet', effet: { type: 'poserEtat', etat: 'issue', valeur: 'v' } }, { kind: 'effet', effet: { type: 'designerHeros', etat: 'orphelin' } });
    expect(declaresNonProduits(p)).toEqual(['muet', 'sosie']);
  });
});
