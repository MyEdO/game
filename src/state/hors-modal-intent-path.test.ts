/**
 * #1016 — ÉMISSION des gestes d'une fenêtre HORS registre de modales (`modalArbiter.HORS_MODAL`), côté web : toute
 * route de `netOwnership.ROUTES` porte sur un geste qu'un écran, un relais du registre ou une touche ÉMET. Le chemin
 * complet du geste d'un invité (allowlist → possession → action jouée au nom du siège → effet) se joue au banc du
 * noyau (`src/noyau/hors-modal-intent-path.hors-store.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { ROUTES } from '../noyau/netOwnership';
import { jetOwnedIntents, participantOwnedIntents } from '../noyau/flowVerbs';
import { ACTIONS } from '../data/index';
import { KEYBINDINGS } from './clavier/keybindings';

/**
 * ÉMISSION — une route ne protège que ce que quelqu'un ÉMET. Le défaut d'origine était exactement
 * là : `cleaveAttack` routé alors qu'AUCUN site d'écran ne le demande (le clic voyage par
 * `battleClickEntity`). Chaque intent routé par #1016 déclare donc son émetteur, et le scan
 * CONFRONTE la déclaration aux sources d'écran.
 * UN GESTE PEUT ÊTRE ÉMIS PAR TROIS CHEMINS, et le scan les connaît tous les trois :
 *   1. TEXTUEL — le nom du verbe apparaît dans une source d'écran (`src/ui`/`src/gameIso`) ;
 *   2. RELAI DU REGISTRE — une entrée d'`actions.json` déclare `run: <verbe>` ET porte une surface
 *      vivante (case de console, bandeau d'interlude, touche du registre) : l'écran l'émet par
 *      `runAction(<id>)`, sans jamais nommer le verbe ;
 *   3. REGISTRE CLAVIER — `keybindings.ts` appelle le verbe directement (une touche EST une surface,
 *      même définition que la garde d'atteignabilité des actions).
 * DEUX LIMITES DÉCLARÉES : (a) le scan reste TEXTUEL — il prouve l'existence d'un site d'émission,
 * JAMAIS son atteignabilité à l'écran (bouton affiché, affordance ouverte), qui se juge en recette
 * navigateur ; (b) la liste confrontée à cette table est DÉRIVÉE de `netOwnership.ROUTES` (#1051) —
 * toute route nominative doit donc déclarer son émetteur, sauf celles que `Route.horsAllowlist`
 * marque inatteignables par le réseau.
 */
const EMISSION: Record<string, { parUI: true } | { interne: string; dans: string } | { sansSurface: string }> = {
  battleClickEntity: { parUI: true },
  battleClickTile: { parUI: true },
  cleaveEnd: { parUI: true },
  dualStrikeSkip: { parUI: true },
  roundStartPromote: { parUI: true },
  // Pause de Round : le bandeau de la console et la touche passent tous deux par l'entrée
  // `round-start` du registre (#1411 P2-A) — c'est SON dispatcher qui arbitre solo (ouvrir) et coop
  // (marquer le siège prêt). Aucun écran ne nomme plus ces deux verbes : la porte est unique.
  confirmRoundStart: { interne: 'actionRegistry.ACTION_RUN.roundStart — porte unique du geste « commencer » (solo)', dans: 'src/noyau/actionRegistry.ts' },
  roundStartReady: { interne: 'actionRegistry.ACTION_RUN.roundStart — porte unique du geste « prêt » (coop)', dans: 'src/noyau/actionRegistry.ts' },
  victoryReady: { parUI: true },
  // Demande de pause au prochain Round : l'interrupteur du pied de FRISE (`raise-hand`, relais du
  // registre). Les deux sens passent par le même dispatcher, d'où le retrait `interne`.
  raiseHand: { parUI: true },
  lowerHand: { interne: 'actionRegistry.ACTION_RUN.raiseHand — le retrait est le `toggleOff` de la même entrée', dans: 'src/noyau/actionRegistry.ts' },
  assignVictoryGear: { parUI: true },
  // Carnet d'enquête (#670) : l'épingle et la nouveauté vue, émises par `CarnetScreen`.
  toggleCluePin: { parUI: true },
  markCluesSeen: { parUI: true },
  partyAddHero: { parUI: true },
  partyRemoveHero: { parUI: true },
  partyReplaceHero: { parUI: true },
  interludeActivity: { parUI: true },
  interludeCraftStart: { parUI: true },
  interludeOrder: { parUI: true },
  interludeBank: { parUI: true },
  interludeWithdraw: { parUI: true },
  interludeEntrainement: { parUI: true },
  favorSettle: { parUI: true },
  massBattleActivity: { parUI: true },
  // Tir rapide (#1050) : le badge de la frise ARME la visée ; le tir lui-même part du clic-token.
  armPreempt: { parUI: true },
  cascadeResist: { parUI: true },
  cascadeReverse: { parUI: true },
  extendedTestReverse: { parUI: true },
  // PHASE 1 du Contre-sort (#1042/#1059) : le choix de déclaration vit SUR la rangée, dans la modale
  // d'incantation ; « tout déclarer » est un verbe NULLAIRE du drive d'auto-cadence (aucun bouton).
  counterspellDeclare: { parUI: true },
  // Déclaration d'une rangée de chute volontaire (#700) : option de la rangée dans `FallModal`.
  fallChoose: { parUI: true },
  // Choix de l'arme d'enfoncement (EDO 11 l.93) : option de la rangée dans `ForceDoorModal`.
  forceDoorChoisirArme: { parUI: true },
  // « Laisser passer » : action de la barre de la modale d'incantation — routée depuis #1042 pour
  // porter la frontière de phase (elle tombait sur le repli universel avant).
  counterspellCancel: { parUI: true },
  counterspellDeclareAll: { interne: 'combatAuto.STEP_WINDOW_AUTO — drive de la fenêtre réactive', dans: 'src/noyau/combatAuto.ts' },
  preemptRangedShot: { interne: 'combatSlice.battleClickEntity — le clic voyage par battleClickEntity (visée armée)', dans: 'src/noyau/combatSlice.ts' },
  // Verbes NULLAIRES du drive d'auto-cadence (#1030) : aucun bouton, le pilote local les enchaîne.
  counterspellRollAll: { interne: 'combatAuto.STEP_WINDOW_AUTO — drive de la fenêtre réactive', dans: 'src/noyau/combatAuto.ts' },
  oppositionRollAll: { interne: 'combatAuto.STEP_WINDOW_AUTO — drive de la fenêtre réactive', dans: 'src/noyau/combatAuto.ts' },
  cleaveAttack: { interne: 'targetingModes.CLEAVE_MODE.commitCombatant — le clic voyage par battleClickEntity', dans: 'src/noyau/targetingModes.ts' },
  dualStrikeAttack: { interne: 'targetingModes.DUAL_MODE.commitCombatant — le clic voyage par battleClickEntity', dans: 'src/noyau/targetingModes.ts' },
};

/** Sources d'ÉCRAN (hors fichiers de test) : `src/ui` + `src/gameIso`. */
const ecranSources = (): string[] => readCorpus(['src/ui', 'src/gameIso']).map(({ text }) => text);

/** Surfaces VIVANTES d'une entrée du registre : une case de console (site d'appel `cellFor('<id>')`
 *  ou `data-action="<id>"`), le bandeau d'interlude que la console rend depuis le registre, ou une
 *  touche du registre clavier. Même définition que la garde `action-atteignabilite`. */
function actionsAvecSurface(): Set<string> {
  const src = readFileSync(join(process.cwd(), 'src', 'ui', 'console', 'CombatConsole.tsx'), 'utf8');
  const frise = readFileSync(join(process.cwd(), 'src', 'ui', 'InitiativeStrip.tsx'), 'utf8');
  const cles = [
    ...[...src.matchAll(/cellFor\(\s*'([^']+)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/runAction\(\s*'([^']+)'/g)].map((m) => m[1]),
    ...[...frise.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]),
    ...KEYBINDINGS.map((b) => b.id),
  ];
  if (/currentInterludeAction/.test(src)) for (const a of ACTIONS) if (a.surface === 'interlude') cles.push(a.id);
  const vivantes = new Set(cles);
  return new Set(ACTIONS.filter((a) => [a.id, ...(a.keys ?? [])].some((k) => vivantes.has(k))).map((a) => a.id));
}

/** Verbes que le REGISTRE relaie pour l'écran : `run` d'une action qui porte une surface vivante. */
function verbesRelayesParLeRegistre(): Set<string> {
  const avecSurface = actionsAvecSurface();
  return new Set(ACTIONS.filter((a) => a.run && avecSurface.has(a.id)).map((a) => a.run!));
}

describe('#1016 — toute route porte sur un geste RÉELLEMENT émis (ou déclare son site interne)', () => {
  const emis = (name: string, sources: string[]) => sources.some((src) => src.includes(name));
  const CLAVIER_SRC = readFileSync(join(process.cwd(), 'src', 'state', 'clavier', 'keybindings.ts'), 'utf8');
  /** Les trois chemins d'émission (voir l'en-tête d'`EMISSION`). */
  const emisParUneSurface = (n: string, sources: string[], relais: Set<string>) =>
    emis(n, sources) || relais.has(n) || CLAVIER_SRC.includes(n);

  it('précondition : le scan voit bien des sources d’écran, un relais de registre et un registre clavier', () => {
    expect(ecranSources().length).toBeGreaterThan(50);
    expect(verbesRelayesParLeRegistre().size).toBeGreaterThan(10);
    expect(KEYBINDINGS.length).toBeGreaterThan(10);
  });

  it('les intents déclarés `parUI` ONT un site d’émission (écran, relais du registre ou touche)', () => {
    const sources = ecranSources();
    const relais = verbesRelayesParLeRegistre();
    const muets = Object.entries(EMISSION)
      .filter(([, e]) => 'parUI' in e).map(([n]) => n)
      .filter((n) => !emisParUneSurface(n, sources, relais));
    expect(muets, 'route déclarée « émise par l’UI » sans aucun site — la route est MORTE').toEqual([]);
  });

  it('les intents déclarés `sansSurface` n’en ont VRAIMENT aucune, et portent leur destination', () => {
    const sources = ecranSources();
    const relais = verbesRelayesParLeRegistre();
    const decl = Object.entries(EMISSION).filter(([, e]) => 'sansSurface' in e) as [string, { sansSurface: string }][];
    const perimees = decl.map(([n]) => n).filter((n) => emisParUneSurface(n, sources, relais));
    expect(perimees, 'déclaré sans surface alors qu’un émetteur existe — le reclasser `parUI`').toEqual([]);
    const muettes = decl.filter(([, e]) => e.sansSurface.trim().length < 15).map(([n]) => n);
    expect(muettes, 'entrée `sansSurface` sans adresse de destination').toEqual([]);
  });

  it('les intents déclarés `interne` n’ont AUCUN site d’écran, et le site nommé existe', () => {
    const sources = ecranSources();
    const internes = Object.entries(EMISSION).filter(([, e]) => 'interne' in e) as [string, { interne: string; dans: string }][];
    expect(internes.map(([n]) => n), 'précondition : au moins une route de défense en profondeur').not.toEqual([]);
    const menteuses = internes.map(([n]) => n).filter((n) => emis(n, sources));
    expect(menteuses, 'déclaré interne mais émis par un écran — le reclasser `parUI`').toEqual([]);
    // Le fichier NOMMÉ par la déclaration doit contenir l'appel : un site interne inventé se voit ici.
    const absents = internes.filter(([n, e]) => !readFileSync(join(process.cwd(), ...e.dans.split('/')), 'utf8').includes(n)).map(([n]) => n);
    expect(absents, 'site interne nommé mais introuvable dans le fichier déclaré').toEqual([]);
  });

  it('toute route NOMINATIVE de `ROUTES` figure dans EMISSION (aucune route sans verdict d’émission)', () => {
    const derivees = new Set([...Object.keys(jetOwnedIntents()), ...participantOwnedIntents()]);
    const routes = [...ROUTES.keys()].filter((a) => !derivees.has(a));
    expect(routes.length, 'précondition : la table expose bien ses routes nominatives').toBeGreaterThan(10);
    const sansVerdict = routes.filter((n) => !(n in EMISSION) && !ROUTES.get(n)!.horsAllowlist);
    expect(sansVerdict, 'route sans entrée EMISSION — déclarer qui l’émet').toEqual([]);
  });
});
