/**
 * Une épreuve hors combat jouée par le noyau : un Test de scène sur une entité générée d'une salle dégagée, joué par
 * l'intention `jouerAction` en cadence automatique ; ses branches sont des effets de scène du noyau.
 */
import { arena } from '../../../src/scenes/test-scenarios/_shared';
import { EVT, type TestResolu } from '../../../src/noyau/bus';
import { DIFFICULTY_LABELS, type Combatant } from '../../../src/engine/types';
import { skills } from '../../../src/data';
import { peutTenter } from '../../../src/engine/skills';
import type { FlowDeScene } from '../../../src/data/schemas/defs-scenes/effets';
import { conclure, lignesDuJournal, ouvrirEnAuto, type AvecRenier } from './partie';

/** Le Flow d'une épreuve : un nœud Test de scène, ses branches de réussite et d'échec. */
export type FluxDEpreuve = Extract<FlowDeScene, { kind: 'test' }>;
/** `label` : le nom de l'action jouée, que le journal du noyau affiche. */
export interface Epreuve { label: string; flux: FluxDEpreuve }
/** Le Test résolu : `testeur`, l'id du héros qui a jeté ; `dr`, ses Degrés de Réussite. Sinon `refus` : le refus du
 *  noyau, ou le groupe hors d'action avant le jet (`partyWiped`, `src/noyau/partyWipe.ts`). `groupe` : tel que le
 *  noyau le laisse, dans les deux cas. */
type IssueJouee = { groupe: Combatant[]; journal: string[] } & ({ reussite: boolean; testeur: string; dr: number } | { refus: string });
export type IssueDEpreuve = AvecRenier<IssueJouee>;

const ENTITE = 'epreuve';

/** Joue l'`epreuve` sur le `groupe` à la graine `graine`. Rend le groupe tel que le noyau le laisse, l'issue du Test
 *  (`EVT.TEST_RESOLVED`) ou ce qui l'a empêché, et les lignes du journal ; un « Je te renie ! » ouvert attend le choix
 *  du joueur (`conclure`). */
export function jouerLEpreuve(groupe: readonly Combatant[], epreuve: Epreuve, graine: number): IssueDEpreuve {
  const journal: string[] = [];
  let resolu: TestResolu | null = null;
  let refus: string | undefined;
  const enAuto = ouvrirEnAuto(
    graine,
    () => {
      const scene = arena({ id: 'epreuve', label: epreuve.label, w: 8, h: 8, heroStart: { x: 2, y: 4 } });
      scene.entities.push({ id: ENTITE, kind: 'prop', pos: { x: 3, y: 4 }, label: epreuve.label, usable: { actions: [{ id: ENTITE, label: epreuve.label, flow: epreuve.flux }] } });
      return { party: groupe.map((h) => structuredClone(h)), scene, projet: null };
    },
    (r) => {
      journal.push(...lignesDuJournal(r));
      for (const e of r.evenements) if (e.type === 'emis' && e.evt === EVT.TEST_RESOLVED) resolu = e.payload as TestResolu;
      if (r.refus) { journal.push(r.refus); refus = r.refus; }
    },
  );
  enAuto.pomper();
  enAuto.envoyer('jouerAction', [ENTITE, ENTITE]);
  enAuto.pomper();
  return conclure<IssueJouee>(enAuto, () => {
    const { party, partyWiped } = enAuto.partie.etat();
    const rendu = party.map((c) => structuredClone(c));
    const issue = resolu as TestResolu | null;
    if (issue) return { groupe: rendu, reussite: issue.success, testeur: issue.actorId, dr: issue.sl, journal: [...journal] };
    if (partyWiped) refus = `${rendu.map((c) => c.label).join(', ')} : hors d'action, le Test n'est pas joué.`;
    if (refus) return { groupe: rendu, refus, journal: [...journal] };
    throw new Error(`Épreuve « ${epreuve.label} » sans Test résolu ni refus : ${journal.join(' ')}`);
  });
}

/** Le Test d'une épreuve en clair : la Compétence (`skills.json`) et la Difficulté (`DIFFICULTY_LABELS`). */
export function partiesDuTest(flux: FluxDEpreuve): { competence: string; difficulte: string } {
  const { skill, difficulty } = flux.test;
  return { competence: skill ? skills.find((s) => s.id === skill.id)?.label ?? skill.id : '', difficulte: difficulty ? DIFFICULTY_LABELS[difficulty] : '' };
}

/** La première des `epreuves` que `heros` peut tenter, ou `undefined`. LDB 09 l.30 */
export const epreuveTentable = (heros: Combatant, epreuves: readonly Epreuve[]): Epreuve | undefined =>
  epreuves.find((ep) => peutTenter(heros, ep.flux.test.skill ? { skill: ep.flux.test.skill } : {}));
