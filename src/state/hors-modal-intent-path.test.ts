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
import { NOM_DU_VERBE_DE_JET } from '../noyau/flowVerbs';
import { ACTIONS } from '../data/index';
import { KEYBINDINGS } from './clavier/keybindings';

/**
 * ÉMISSION — une route ne protège que ce que quelqu'un ÉMET. Le défaut d'origine était exactement
 * là : `frapperEnBalayage` routé alors qu'AUCUN site d'écran ne le demande (le clic voyage par
 * `cliquerLaCase`). Chaque intent routé par #1016 déclare donc son émetteur, et le scan
 * CONFRONTE la déclaration aux sources d'écran.
 * UN GESTE PEUT ÊTRE ÉMIS PAR TROIS CHEMINS, et le scan les connaît tous les trois :
 *   1. TEXTUEL — le nom du verbe apparaît dans une source d'écran (`src/ui`/`src/gameIso`) ;
 *   2. RELAI DU REGISTRE — une entrée d'`actions.json` déclare `run: <verbe>` ET porte une surface
 *      vivante (case de console, bandeau d'interlude, touche du registre) : l'écran l'émet par
 *      `jouerLOffreDeLEcran(<état>, <id>)`, sans jamais nommer le verbe ;
 *   3. REGISTRE CLAVIER — `keybindings.ts` appelle le verbe directement (une touche EST une surface,
 *      même définition que la garde d'atteignabilité des actions).
 * DEUX LIMITES DÉCLARÉES : (a) le scan reste TEXTUEL — il prouve l'existence d'un site d'émission,
 * JAMAIS son atteignabilité à l'écran (bouton affiché, affordance ouverte), qui se juge en recette
 * navigateur ; (b) la liste confrontée à cette table est DÉRIVÉE de `netOwnership.ROUTES` (#1051) —
 * toute route nominative doit donc déclarer son émetteur.
 */
const EMISSION: Record<string, { parUI: true } | { sansSurface: string }> = {
  cliquerLaCase: { parUI: true },
  // Les sorts de la fiche, hors combat comme en combat (`CharacterSheet`).
  incanterLeSort: { parUI: true },
  focaliserLeSort: { parUI: true },
  dissiperLeSort: { parUI: true },
  // Le consommable d'un porteur : la fiche hors combat, la barre en combat (`CharacterSheet`, `actionRegistry`).
  utiliserLObjet: { parUI: true },
  // La Détermination de son porteur : la barre (`resolve-*`, `actionRegistry`), la pastille d'État et la modale du jet
  // (`DeterminationButton`, `useTestJetProps`, `CascadeModal`).
  depenserLaDetermination: { parUI: true },
  poserLObjet: { sansSurface: 'hôte Godot : la fiche (`gestesDeLObjet`, bouton « Poser au sol ») et la barre (`depot`, `combat.offres`)' },
  // La sortie d'une fenêtre (`modalArbiter.sortieDeLaFenetre`) : le bouton qui ferme son écran, et les sorties
  // d'interlude du balayage et de la 2ᵉ frappe (`actionRegistry.ENTREES_PAR_RUN`).
  fenetreFermer: { parUI: true },
  // La validation d'une fenêtre (`modalArbiter.validationDeLaFenetre`) : le bouton qui la valide ; pour la pause de
  // Round, l'entrée `debut-de-round` du registre, que le bandeau et la touche partagent (#1411 P2-A).
  fenetreValider: { parUI: true },
  // Le choix d'une fenêtre (`choixDesFenetres.CHOIX_DES_FENETRES`) : le bouton de chaque valeur de son écran.
  fenetreChoisir: { parUI: true },
  // Demande de pause au prochain Round : l'interrupteur du pied de FRISE (`pause`, verbe que déclare son
  // entrée). Les deux sens passent par le même verbe.
  leverLaMain: { parUI: true },
  // Carnet d'enquête (#670) : l'épingle et la nouveauté vue, émises par `CarnetScreen`.
  epinglerLIndice: { parUI: true },
  marquerLesIndices: { parUI: true },
  recruterLeHeros: { parUI: true },
  renvoyerLeHeros: { parUI: true },
  remplacerLeHeros: { parUI: true },
  commanderLObjet: { parUI: true },
  deposerALaBanque: { parUI: true },
  retirerDeLaBanque: { parUI: true },
  solderLaFaveur: { parUI: true },
  menerLActionDeBataille: { parUI: true },
  // Réglages des jets (#3368) : l'arme d'enfoncement d'une rangée de `ForceDoorModal` (EDO 11 l.93), les Bandages du
  // soin (LDB 74 l.41), la déclaration d'une rangée de Contre-sort (#1042/#1059) ou de chute (#700), chacun une option
  // de sa fenêtre.
  jetRegler: { parUI: true },
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
    ...[...src.matchAll(/jouerLOffreDeLEcran\([^,]+,\s*'([^']+)'/g)].map((m) => m[1]),
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

describe('#1016 — toute route porte sur un geste RÉELLEMENT émis (ou déclare n’avoir aucune surface)', () => {
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

  it('toute route NOMINATIVE de `ROUTES` figure dans EMISSION (aucune route sans verdict d’émission)', () => {
    const derivees = new Set<string>(Object.values(NOM_DU_VERBE_DE_JET));
    const routes = [...ROUTES.keys()].filter((a) => !derivees.has(a));
    expect(routes.length, 'précondition : la table expose bien ses routes nominatives').toBeGreaterThan(10);
    const sansVerdict = routes.filter((n) => !(n in EMISSION));
    expect(sansVerdict, 'route sans entrée EMISSION — déclarer qui l’émet').toEqual([]);
  });
});
