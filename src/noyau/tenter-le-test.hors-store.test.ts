/**
 * Les Tests de Compétence hors combat d'un hôte (#4834) : le verbe `tenterLeTest` les lance, testeur choisi en toute
 * cadence (LDB 12 l.7, l.137) ; la branche d'un Test vise « le testeur », celui qui a jeté (`avecLeTesteur`) ; un
 * lancement dont la validation relève une erreur est refusé avant toute écriture (`exigerUnProjetJouable`).
 */
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type Cadence, type Partie, type ResultatDeLAppel } from './index';
import { testScene } from '../scenes/test-fixture';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { EMPTY_FLOW } from '../engine/flowCore';
import { refusNePeutTenter } from '../engine/skills';
import { ouvrirLeBanc } from './banc.testkit';
import { runFlow } from './combatEffects';
import { testFlow } from './monde/flow';
import { ProjetRefuse } from './worldMap';
import { EVT } from './bus';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { FlowDeScene } from '../data/schemas/defs-scenes/effets';

/** Trois héros sans Compétence acquise ; C voit le mieux (Initiative 90), A ouvre le groupe. */
const groupe = (): Combatant[] => ['A', 'B', 'C'].map((label, i) => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: i + 1 });
  h.characteristics.initiative = i === 2 ? 90 : 10;
  h.skills = [];
  return h;
});

const PERCEPTION = { id: 'perception' } as const;

/** Joue `geste` sur une partie du groupe `party` lancée dans `scene`, à la cadence `cadence`, puis la ferme. */
function avecUnePartie(party: Combatant[], cadence: Cadence, geste: (partie: Partie) => void, lancement: Partial<Parameters<Partie['lancer']>[0]> = {}): void {
  const partie = creerPartie(etatInitialDuJeu(), { graine: 11, reglesMaison: {}, cadence, desFixes: false, persisterLeHeros: () => {} });
  try {
    testsResolus(partie, partie.lancer({ party, scene: testScene(), projet: null, ...lancement }));
    geste(partie);
  } finally {
    partie.fermer();
  }
}

/** Les Tests résolus par `resultat` et par chaque jeton qu'il programme, rejoués jusqu'au dernier. */
function testsResolus(partie: Partie, resultat: ResultatDeLAppel): { actorId: string; success: boolean }[] {
  const resolus: { actorId: string; success: boolean }[] = [];
  const file = [resultat];
  while (file.length) {
    for (const e of file.shift()!.evenements) {
      if (e.type === 'emis' && e.evt === EVT.TEST_RESOLVED) resolus.push(e.payload);
      if (e.type === 'programme') file.push(partie.reprendre(e.jeton));
    }
  }
  return resolus;
}

/** Les lignes écrites au journal par `resultat`. */
const lignesDuJournal = (resultat: ResultatDeLAppel): string[] => resultat.journal.flatMap((l) => (l.de === 'journal' ? [l.texte] : []));

describe('tenterLeTest : un Test de Compétence par un verbe public', () => {
  it.each(['auto', 'manuel'] as const)('cadence %s : le héros désigné jette, son issue est l’événement du Test', (cadence) => {
    const party = groupe();
    avecUnePartie(party, cadence, (partie) => {
      const ouvert = partie.envoyer({ type: 'tenterLeTest', args: [PERCEPTION, 'intermediaire', party[1].id] });
      const resolus = cadence === 'auto'
        ? testsResolus(partie, ouvert)
        : (partie.envoyer({ type: 'jetLancer', args: ['test'] }), testsResolus(partie, partie.envoyer({ type: 'jetValider', args: ['test'] })));
      expect(resolus.map((r) => r.actorId)).toEqual([party[1].id]);
    });
  });

  it('sans héros désigné, le meilleur du groupe jette', () => {
    const party = groupe();
    avecUnePartie(party, 'auto', (partie) => {
      expect(testsResolus(partie, partie.envoyer({ type: 'tenterLeTest', args: [PERCEPTION, 'intermediaire'] })).map((r) => r.actorId)).toEqual([party[2].id]);
    });
  });

  it('refus dits au journal : un héros hors du groupe, une Compétence avancée que le héros n’a pas (LDB 09 l.30)', () => {
    const party = groupe();
    avecUnePartie(party, 'auto', (partie) => {
      expect(lignesDuJournal(partie.envoyer({ type: 'tenterLeTest', args: [PERCEPTION, 'intermediaire', 'inconnu'] })))
        .toEqual([t('tenterLeTest.refus.horsDuGroupe', { id: 'inconnu' })]);
      expect(lignesDuJournal(partie.envoyer({ type: 'tenterLeTest', args: [{ id: 'crochetage' }, 'difficile', party[0].id] })))
        .toEqual([refusNePeutTenter(party[0], { skill: { id: 'crochetage' } })]);
      expect(partie.etat().pendingTest).toBeNull();
    });
  });

  it('refus dit quand une fenêtre tient la main : le Test ouvert garde son testeur', () => {
    const party = groupe();
    avecUnePartie(party, 'manuel', (partie) => {
      partie.envoyer({ type: 'tenterLeTest', args: [PERCEPTION, 'facile', party[0].id] });
      const second = partie.envoyer({ type: 'tenterLeTest', args: [PERCEPTION, 'difficile', party[1].id] });
      expect(lignesDuJournal(second)).toEqual([t('tenterLeTest.refus.mainTenue')]);
      expect(partie.etat().pendingTest?.actorId).toBe(party[0].id);
    });
  });

  it('refus dit en combat : le combat a ses Actions', () => {
    avecUnePartie(groupe(), 'manuel', (partie) => {
      partie.envoyer({ type: 'tenterLeTest', args: [PERCEPTION, 'intermediaire'] });
      expect(partie.etat().refus?.texte).toBe(t('tenterLeTest.refus.horsExploration'));
      expect(partie.etat().pendingTest).toBeNull();
    }, { combatDirect: 'enc-mutants' });
  });
});

describe('cible « testeur » : la conséquence frappe celui qui a jeté', () => {
  const blesseLeTesteur: FlowDeScene = { kind: 'effet', effet: { type: 'ops', on: 'testeur', ops: [{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }] } };

  it.each([['auto', 2], ['manuel', 1]] as const)('cadence %s : le testeur seul perd une Blessure, qu’il réussisse ou rate', (cadence, rang) => {
    const banc = ouvrirLeBanc({ cadence });
    const party = groupe();
    banc.setState({ party, pendingTest: null, battle: null });
    const avant = party.map((h) => h.wounds.current);
    runFlow(banc.getState, banc.setState, testFlow({ skill: PERCEPTION, difficulty: 'intermediaire' }, blesseLeTesteur, blesseLeTesteur));
    if (cadence === 'manuel') {
      banc.getState().jetRegler('test', 'testeur', party[rang].id);
      banc.getState().jetLancer('test');
      banc.getState().jetValider('test');
    }
    banc.reprendreTout();
    expect(banc.getState().party.map((h, i) => avant[i] - h.wounds.current)).toEqual(party.map((_, i) => (i === rang ? 1 : 0)));
  });

  it('cadence manuel : un Test imbriqué dans la branche frappe son propre testeur, la suite de la branche celui du Test parent', () => {
    const banc = ouvrirLeBanc({ cadence: 'manuel' });
    const party = groupe();
    banc.setState({ party, pendingTest: null, battle: null });
    const avant = party.map((h) => h.wounds.current);
    const interne = testFlow({ skill: PERCEPTION, difficulty: 'facile' }, blesseLeTesteur, blesseLeTesteur);
    const branche: FlowDeScene = { kind: 'sequence', etapes: [interne, blesseLeTesteur] };
    runFlow(banc.getState, banc.setState, testFlow({ skill: PERCEPTION, difficulty: 'facile' }, branche, branche));
    for (const testeur of [party[0], party[1]]) {
      banc.getState().jetRegler('test', 'testeur', testeur.id);
      banc.getState().jetLancer('test');
      banc.getState().jetValider('test');
      banc.reprendreTout();
    }
    expect(banc.getState().party.map((h, i) => avant[i] - h.wounds.current)).toEqual([1, 1, 0]);
  });
});

describe('porte du lancement : un projet que la validation dit fautif ne se lance pas', () => {
  const blessure = { op: 'wounds', amount: 1 };
  const action = (flow: unknown) => ({ id: 'chute', label: 'Dalle suspecte', flow });
  const FAUTIVES = {
    'etat-inconnu': action({ kind: 'effet', effet: { type: 'ops', ops: [{ op: 'condition', id: 'empoisonne', value: 1 }] } }),
    'difficulte-inconnue': action({ kind: 'test', test: { skill: PERCEPTION, difficulty: 'tres-difficile' }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW }),
    'testeur-hors-test': action({ kind: 'effet', effet: { type: 'ops', on: 'testeur', ops: [blessure] } }),
    'sans-libelle': { id: 'chute', flow: EMPTY_FLOW },
  };

  it.each(Object.entries(FAUTIVES))('%s : refusé à `lancer` en ProjetRefuse de cause « validation », avant toute écriture', (id, fautive) => {
    const scene = testScene();
    scene.entities = [...scene.entities, { id, kind: 'prop', decor: { id: 'autel' }, pos: { x: 8, y: 7 }, usable: { actions: [fautive] } } as never];
    const partie = creerPartie(etatInitialDuJeu(), { graine: 11, reglesMaison: {}, cadence: 'auto', desFixes: false, persisterLeHeros: () => {} });
    try {
      expect(() => partie.lancer({ party: groupe(), scene, projet: null })).toThrow(ProjetRefuse);
      let refus: ProjetRefuse | undefined;
      try { partie.lancer({ party: groupe(), scene, projet: null }); } catch (e) { refus = e as ProjetRefuse; }
      expect(refus?.cause).toBe('validation');
      expect(refus?.fautes.map((f) => f.chemin)).toContainEqual([scene.id, id]);
      expect(partie.etat().party).toEqual([]);
    } finally {
      partie.fermer();
    }
  });
});
