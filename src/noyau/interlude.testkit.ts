/**
 * Pratiquer une Activité d'interlude comme un siège (LDB 23 l.5) : la composer par `fenetreChoisir('interlude', axe,
 * valeur, héros)` — l'Activité, puis ses cibles, son option d'Entraînement, son ouvrage et ses qualités —, puis la
 * pratiquer. Le premier choix refusé se dit, et rien ne se joue après lui.
 */
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { ArgumentsDuChoix } from './choixDesFenetres';
import { refusDuChoix } from './choixDeFenetre';
import type { CiblesChoisies } from './verdictsDInterlude';
import type { InterludeState } from './interludeFlow';

/** Ce que compose l'Activité : ses cibles, l'option d'Entraînement (`cleDEntrainement`), l'ouvrage à engager et ses
 *  Atouts et Défauts. */
export type Composee = Omit<CiblesChoisies, 'depotId'> & { entrainement?: string; ouvrage?: string; qualites?: readonly string[] };

export function pratiquer(get: () => Jeu & Pick<ActionsDuNoyau, 'fenetreChoisir'>, heroId: string, activite: string, c: Composee = {}): void {
  const choix: ArgumentsDuChoix[] = [
    ['interlude', 'activite', activite, heroId],
    ...(c.talentId === undefined ? [] : [['interlude', 'talent', c.talentId, heroId]] satisfies ArgumentsDuChoix[]),
    ...(c.itemUid === undefined ? [] : [['interlude', 'objet', c.itemUid, heroId]] satisfies ArgumentsDuChoix[]),
    ...(c.spellId === undefined ? [] : [['interlude', 'sort', c.spellId, heroId]] satisfies ArgumentsDuChoix[]),
    ...(c.traitPsy === undefined ? [] : [['interlude', 'traitPsychologique', c.traitPsy, heroId]] satisfies ArgumentsDuChoix[]),
    ...(c.entrainement === undefined ? [] : [['interlude', 'entrainement', c.entrainement, heroId]] satisfies ArgumentsDuChoix[]),
    ...(c.ouvrage === undefined ? [] : [['interlude', 'ouvrage', c.ouvrage, heroId]] satisfies ArgumentsDuChoix[]),
    ...(c.qualites ?? []).map((q): ArgumentsDuChoix => ['interlude', 'ajouterLaQualite', q, heroId]),
    ['interlude', 'pratiquer', true, heroId],
  ];
  for (const args of choix) {
    const [fenetre, axe, valeur, pid] = args;
    const refuse = refusDuChoix(get(), fenetre, axe, valeur, pid) !== null;
    get().fenetreChoisir(...args);
    if (refuse) return;
  }
}

/** L'interlude sans le brouillon des compositions : ce que pratiquer une Activité refusée laisse intact. */
export function horsComposition(i: InterludeState | null | undefined): InterludeState | null | undefined {
  if (!i) return i;
  return { ...i, perHero: Object.fromEntries(Object.entries(i.perHero).map(([id, st]) => {
    const copie = { ...st };
    delete copie.composition;
    return [id, copie];
  })) };
}
