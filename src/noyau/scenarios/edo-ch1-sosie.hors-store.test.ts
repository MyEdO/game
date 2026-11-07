/**
 * Le SOSIE de Kastor Lieberung, désigné par le joueur à la fouille du cadavre — EDO 02 l.91 ; #2219
 * c.6068818868. Puis les Documents 3 et 4 remis l'un après l'autre (EDO 02 l.93-95), et l'indice qui les garde
 * relisibles. Chemin RÉEL : l'action `fouiller` du paquet `la-diligence`, jouée sur le banc du noyau. Leur prose
 * nommée par l'identité du sosie (EDO 02 l.112-127, #686), lue dans la modale montée, se joue en
 * `src/state/edo-ch1-sosie-documents.test.tsx`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { createHero } from '../../engine/character';
import { pickActiveModalKey } from '../../noyau/modalArbiter';
import { evalCondition } from '../../engine/flowCore';
import { condCtx } from '../../noyau/bourseFlow';
import { chargerSurLeBanc, sauverLeBanc } from '../persistance/save.testkit';
import { campagneDuJeu, diligenceCampaign, lancerCampagne, paquetDuJeu } from '../../scenes/campaign';
import { poserLeGroupe } from '../../noyau/marcheDuGroupe';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const paquet = paquetDuJeu(diligenceCampaign);
const SOSIE = 'campagne-sosie-heros';
const get = () => banc.getState();
const heros = (label: string, seed: number) => ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), id: `h-${seed}` });

beforeEach(() => {
  get().setParty([heros('Vivant', 1), { ...heros('Tombé', 2), dead: true }, heros('Autre', 3)]);
  expect(lancerCampagne(banc.getState, campagneDuJeu(diligenceCampaign), paquet.scenes[0].id)).toBeNull();
  get().fenetreValider('ouverture');
  get().quitterLaScene('route-principale-virage');
  poserLeGroupe(get, banc.setState, { x: 36, y: 3 });
  get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
});

describe('EDO 02 l.91 — la fouille du cadavre ouvre la désignation du sosie', () => {
  it('la fouille ouvre la désignation (modale de groupe, invite de l’Effet) ; la fouille s’achève au choix', () => {
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
    expect(get().pendingDesignationHeros?.invite).toMatch(/sosie/);
    expect(pickActiveModalKey(get())).toBe('designationHeros');
    expect(get().etats[SOSIE]).toBeUndefined();
    expect(get().flags['edo-ch1-corps-kastor-fouille'], 'EDO 02 l.89-91 : la suite de la fouille attend la désignation').toBeUndefined();
    get().fenetreChoisir('designationHeros', 'heros', 'h-1');
    expect(get().flags['edo-ch1-corps-kastor-fouille'], 'EDO 02 l.93-95 : les deux documents se lisent avant').toBeUndefined();
    get().fenetreFermer('document');
    get().fenetreFermer('document');
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);
  });

  it('un héros MORT n’est pas proposable : son choix ne pose rien et la désignation reste ouverte', () => {
    get().fenetreChoisir('designationHeros', 'heros', 'h-2');
    expect(get().etats[SOSIE]).toBeUndefined();
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
  });

  it('le choix d’un héros vivant pose l’état à son id et referme la désignation', () => {
    get().fenetreChoisir('designationHeros', 'heros', 'h-1');
    expect(get().etats[SOSIE]).toBe('h-1');
    expect(get().pendingDesignationHeros).toBeNull();
    expect(evalCondition({ kind: 'species', id: 'humains-reiklander', who: { etat: SOSIE } }, condCtx(get))).toBe(true);
    expect(evalCondition({ kind: 'partyDead', who: { etat: SOSIE } }, condCtx(get))).toBe(false);
  });

  it('la désignation ne s’annule pas : elle survit au changement de scène', () => {
    get().quitterLaScene('altdorf-porte-sud');
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
  });

  it('sauvegarde puis reprise : l’état désigné est conservé', () => {
    get().fenetreChoisir('designationHeros', 'heros', 'h-3');
    const texte = sauverLeBanc(banc);
    banc.setState({ etats: {} });
    chargerSurLeBanc(banc, texte);
    expect(get().etats[SOSIE]).toBe('h-3');
  });
});

describe('EDO 02 l.93-127 — les Documents 3 et 4 nomment le sosie, l’indice les garde', () => {
  const naine = () => ({ ...createHero({ speciesId: 'nains', careerId: 'soldat', label: 'Naine', seed: 9, apparence: { sex: 'F' } }), id: 'h-9' });

  beforeEach(() => {
    get().setParty([heros('Vivant', 1), naine()]);
    get().loadProject({ scenes: paquet.scenes, entryId: paquet.scenes[0].id, worldMap: paquet.worldMap, narratif: paquet.narratif, projet: { id: paquet.id } });
    get().fenetreValider('ouverture');
    get().quitterLaScene('route-principale-virage');
    poserLeGroupe(get, banc.setState, { x: 36, y: 3 });
    get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
    get().fenetreChoisir('designationHeros', 'heros', 'h-9');
  });

  it('naine désignée : son identité se fige, le Document 3 lui est remis ; fermé, le Document 4', () => {
    expect(get().identitesFigees[SOSIE]).toEqual({ espece: 'nain', sexe: 'F' });
    expect(get().document?.documentId).toBe('edo-document-3-heritage');
    get().fenetreFermer('document');
    expect(get().document?.documentId).toBe('edo-document-4-affidavit');
    get().fenetreFermer('document');
    expect(get().document).toBeNull();
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);
  });

  it('l’indice « L’héritage » révèle ses deux stades, un par document', () => {
    get().fenetreFermer('document');
    get().fenetreFermer('document');
    expect(get().clues['edo-ch1-indice-heritage']?.historique.map((h) => h.stade)).toEqual(['veste', 'poche']);
  });
});
