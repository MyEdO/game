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
import { lignesDuJournal, ouvrirEnAuto } from './partie';

/** Le Flow d'une épreuve : un nœud Test de scène, ses branches de réussite et d'échec. */
export type FluxDEpreuve = Extract<FlowDeScene, { kind: 'test' }>;
/** `label` : le nom de l'action jouée, que le journal du noyau affiche. */
export interface Epreuve { label: string; flux: FluxDEpreuve }
/** `testeur` : l'id du héros qui a jeté ; `dr` : ses Degrés de Réussite. */
export interface IssueDEpreuve { groupe: Combatant[]; reussite: boolean; testeur: string; dr: number; journal: string[] }

const ENTITE = 'epreuve';

/** Joue l'`epreuve` sur le `groupe` à la graine `graine`. Rend le groupe tel que le noyau le laisse, l'issue du Test
 *  (`EVT.TEST_RESOLVED`) et les lignes du journal. */
export function jouerLEpreuve(groupe: readonly Combatant[], epreuve: Epreuve, graine: number): IssueDEpreuve {
  const journal: string[] = [];
  let resolu: TestResolu | null = null;
  const { partie, envoyer, pomper } = ouvrirEnAuto(
    graine,
    () => {
      const scene = arena({ id: 'epreuve', label: epreuve.label, w: 8, h: 8, heroStart: { x: 2, y: 4 } });
      scene.entities.push({ id: ENTITE, kind: 'prop', pos: { x: 3, y: 4 }, label: epreuve.label, usable: { actions: [{ id: ENTITE, label: epreuve.label, flow: epreuve.flux }] } });
      return { party: groupe.map((h) => structuredClone(h)), scene, projet: null };
    },
    (r) => {
      journal.push(...lignesDuJournal(r));
      for (const e of r.evenements) if (e.type === 'emis' && e.evt === EVT.TEST_RESOLVED) resolu = e.payload as TestResolu;
      if (r.refus) journal.push(r.refus);
    },
  );
  pomper();
  envoyer('jouerAction', [ENTITE, ENTITE]);
  pomper();
  const rendu = partie.etat().party.map((c) => structuredClone(c));
  partie.fermer();
  const issue = resolu as TestResolu | null;
  if (!issue) throw new Error(`Épreuve « ${epreuve.label} » sans Test résolu : ${journal.join(' ')}`);
  return { groupe: rendu, reussite: issue.success, testeur: issue.actorId, dr: issue.sl, journal };
}

/** Le Test d'une épreuve en clair : la Compétence (`skills.json`) et la Difficulté (`DIFFICULTY_LABELS`). */
export function partiesDuTest(flux: FluxDEpreuve): { competence: string; difficulte: string } {
  const { skill, difficulty } = flux.test;
  return { competence: skill ? skills.find((s) => s.id === skill.id)?.label ?? skill.id : '', difficulte: difficulty ? DIFFICULTY_LABELS[difficulty] : '' };
}

/** La première des `epreuves` que `heros` peut tenter, ou `undefined`. LDB 09 l.30 */
export const epreuveTentable = (heros: Combatant, epreuves: readonly Epreuve[]): Epreuve | undefined =>
  epreuves.find((ep) => peutTenter(heros, ep.flux.test.skill ? { skill: ep.flux.test.skill } : {}));
