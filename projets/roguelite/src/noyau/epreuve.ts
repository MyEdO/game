/**
 * Une épreuve hors combat jouée par le noyau : un Test de scène sur une entité générée d'une salle dégagée, joué par
 * le geste d'exploration qui offre son action (`gestesDExploration`) en cadence automatique ; ses branches sont des
 * effets de scène du noyau.
 */
import {
  arena,
  skills,
  type FlowDeScene,
  gestesDExploration,
  type Jeu,
  EVT,
  type TestJete,
  rollLine,
  DIFFICULTE_PAR_DEFAUT,
  DIFFICULTY_LABELS,
  evaluateTest,
  peutTenter,
  TIME_COST,
  type Combatant,
} from '../../../../src/noyau';
import { lignesDuJournal, ouvrirEnAuto } from './partie';

/** Le Flow d'une épreuve : un nœud Test de scène, ses branches de réussite et d'échec. */
export type FluxDEpreuve = Extract<FlowDeScene, { kind: 'test' }>;
/** `label` : le nom de l'action jouée, que le journal du noyau affiche. */
export interface Epreuve { label: string; flux: FluxDEpreuve }
/** Le Test résolu : `testeur`, l'id du héros qui a jeté ; `dr`, ses Degrés de Réussite ; `cible`, la cible du jet.
 *  Sinon `refus` : le refus du noyau, ou le groupe hors d'action avant le jet (`partyWiped`,
 *  `src/noyau/partyWipe.ts`). `groupe` : tel que le noyau le laisse, dans les deux cas. */
export type IssueDEpreuve = { groupe: Combatant[]; journal: string[] }
  & ({ reussite: boolean; testeur: string; dr: number; cible: number } | { refus: string });

/** L'entité qui porte le Test : un décor du catalogue (`props.json`), que le roguelite ne montre pas. */
const ENTITE = 'epreuve';
const DECOR = 'caisse';
/** Ce que l'action de l'épreuve coûte à l'horloge : le Round de son Test. LDB 13 l.13 */
const DUREE = TIME_COST.combatRound;

/** Joue l'`epreuve` sur le `groupe` à la graine `graine`. Rend le groupe tel que le noyau le laisse, l'issue du Test
 *  (le dernier `EVT.TEST_JETE` de sa Compétence, relance comprise) ou ce qui l'a empêché, et les lignes du journal. */
export function jouerLEpreuve(groupe: readonly Combatant[], epreuve: Epreuve, graine: number): IssueDEpreuve {
  const journal: string[] = [];
  let resolu: TestJete | null = null;
  const competence = epreuve.flux.test.skill?.id;
  let refus: string | undefined;
  const { partie, envoyer, pomper } = ouvrirEnAuto(
    graine,
    () => {
      const scene = arena({ id: 'epreuve', label: epreuve.label, w: 8, h: 8, heroStart: { x: 2, y: 4 } });
      scene.entities.push({ id: ENTITE, kind: 'prop', decor: { id: DECOR }, pos: { x: 3, y: 4 }, label: epreuve.label, usable: { actions: [{ id: ENTITE, label: epreuve.label, minutes: DUREE, flow: epreuve.flux }] } });
      return { party: groupe.map((h) => structuredClone(h)), scene, projet: null };
    },
    (r) => {
      journal.push(...lignesDuJournal(r));
      for (const e of r.evenements) {
        if (e.type !== 'emis' || e.evt !== EVT.TEST_JETE) continue;
        const jet = e.payload as TestJete;
        if (jet.reference.genre === 'competence' && jet.reference.id === competence) resolu = jet;
      }
      if (r.refus) { journal.push(r.refus); refus = r.refus; }
    },
  );
  pomper();
  const action = gestesDExploration(partie.etat() as Jeu).find((g) => g.gestes.some(({ args }) => args[0] === ENTITE && args[1] === ENTITE));
  for (const { verbe, args } of action?.gestes ?? []) envoyer(verbe, args);
  pomper();
  const { party, partyWiped } = partie.etat();
  const rendu = party.map((c) => structuredClone(c));
  partie.fermer();
  const jet = resolu as TestJete | null;
  if (jet) {
    const { porteur, issue } = jet;
    if (porteur === null || issue.cible === null || issue.dr === null) throw new Error(`Épreuve « ${epreuve.label} » : jet masqué au groupe`);
    return { groupe: rendu, reussite: issue.reussi, testeur: porteur, dr: issue.dr, cible: issue.cible, journal };
  }
  if (partyWiped) refus = `${rendu.map((c) => c.label).join(', ')} : hors d'action, le Test n'est pas joué.`;
  if (refus) return { groupe: rendu, refus, journal };
  throw new Error(`Épreuve « ${epreuve.label} » sans Test résolu ni refus : ${journal.join(' ')}`);
}

/** Le Test d'une épreuve en clair : la Compétence (`skills.json`) et la Difficulté (`DIFFICULTY_LABELS`). */
export function partiesDuTest(flux: FluxDEpreuve): { competence: string; difficulte: string } {
  const { skill, difficulty } = flux.test;
  return { competence: skill ? skills.find((s) => s.id === skill.id)?.label ?? skill.id : '', difficulte: difficulty ? DIFFICULTY_LABELS[difficulty] : '' };
}

/** La première des `epreuves` que `heros` peut tenter, ou `undefined`. LDB 09 l.30 */
export const epreuveTentable = (heros: Combatant, epreuves: readonly Epreuve[]): Epreuve | undefined =>
  epreuves.find((ep) => peutTenter(heros, ep.flux.test.skill ? { skill: ep.flux.test.skill } : {}));

/** Ce qu'un héros vise à un Test : la Compétence testée, la cible du jet, ses chances en pour cent. */
export interface Visee { competence: string; cible: number; chances: number }

/** Les chances, en pour cent, qu'un d100 réussisse un Test de cible `cible`, bandes automatiques comprises
 *  (`evaluateTest`). LDB 12 l.7-13, l.28 */
export const chancesDeReussite = (cible: number): number =>
  Array.from({ length: 100 }, (_, i) => evaluateTest(i + 1, cible).success).filter(Boolean).length;

/** Ce que `heros` viserait aux `epreuves` : la première qu'il peut tenter (`epreuveTentable`), sa Compétence, la cible
 *  de son Test telle que le noyau la monte (`rollLine` : Compétence ou Caractéristique, Difficulté, modificateurs du
 *  héros) et ses chances (`chancesDeReussite`) ; `undefined` s'il n'en peut tenter aucune. */
export function viseeDeLEpreuve(heros: Combatant, epreuves: readonly Epreuve[]): Visee | undefined {
  const ep = epreuveTentable(heros, epreuves);
  if (!ep) return undefined;
  const { skill, difficulty } = ep.flux.test;
  const { target } = rollLine({ actor: heros, test: skill ? { skill } : {}, difficulty: difficulty ?? DIFFICULTE_PAR_DEFAUT });
  return { competence: partiesDuTest(ep.flux).competence, cible: target, chances: chancesDeReussite(target) };
}
