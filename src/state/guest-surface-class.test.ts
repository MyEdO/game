/**
 * #1050 — GARDE DE CLASSE de la surface invité. Les gardes existantes mesuraient des FLUX
 * (`guest-flow-surface`, `rollFlowWiring`, `multiFlowOwnership`) ; aucune ne confrontait les SITES
 * D'ÉMISSION de l'écran à l'allowlist. Résultat mesuré au palier : 154 tests de possession verts
 * pendant que 15 symboles émis par des boutons VIVANTS étaient hors `GUEST_INTENTS` — chez un invité
 * le geste s'exécute EN LOCAL puis meurt au snapshot de l'hôte, sans message ni journal.
 *
 * Trois sens, tous structurels :
 *  (a) ÉMISSION → ALLOWLIST : toute action de store émise par `src/ui`/`src/gameIso` est exposée, ou
 *      NOMMÉE dans `HORS_SURFACE_UI` avec sa raison (écran hôte, état d'écran local) ;
 *  (b) le détecteur MORD (cas simulé) — une garde qui ne se prouve que sur l'arbre réel ne dit pas si
 *      elle sait mordre ;
 *  (c) ROUTE → ALLOWLIST : toute route de `netOwnership.ROUTES` est atteignable (dans l'allowlist),
 *      sauf celles que `Route.horsAllowlist` déclare inatteignables — c'est la classe #1016
 *      (`oppositionResist` était routé par participant ET filtré hors de la surface : la route ne
 *      s'exécutait JAMAIS).
 *
 * LIMITES DÉCLARÉES : le scan (a) est TEXTUEL — il repère les sélecteurs `s.<action>` /
 * `getState().<action>` d'un fichier d'écran, donc il prouve l'existence d'un SITE d'émission, jamais
 * son atteignabilité à l'écran (bouton affiché, affordance ouverte), qui se juge en recette
 * navigateur ; et une action appelée autrement (dans une closure déjà déstructurée) lui échappe.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { useGame } from './store';
import { ROUTES } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';

/** Raisons TYPÉES — chaque exclusion est nominative, sa raison dit à quel titre. */
/** État d'écran purement LOCAL (caméra, onglet, survol) : il n'a jamais rien à faire chez l'hôte. */
const CLIENT = (quoi: string) => `état d’écran LOCAL (${quoi}) — jamais un intent`;
/** Écran ou décision pilotés par l'HÔTE (périmètre coop V1 : combat + groupe + interlude). */
const HOTE = (quoi: string) => `${quoi} — écran/décision pilotés par l’HÔTE (périmètre coop V1)`;
/** Exploration : l'invité n'est qu'un miroir des snapshots de l'hôte (portée V1). */
const MIROIR = (quoi: string) => `${quoi} — exploration : l’invité est un MIROIR de l’hôte (V1)`;

/**
 * Actions de store ÉMISES par un écran et VOLONTAIREMENT hors surface invité — une entrée, une
 * raison. Nominatif par ACTION (jamais par fichier) : un écran hôte qui gagne un geste JOUEUR doit
 * repasser ici, ligne par ligne.
 */
const HORS_SURFACE_UI: Record<string, string> = {
  // ── Rendu / caméra / navigation d'écran : état local du client ────────────────────────────────
  setHovered: CLIENT('survol de la carte'),
  setHoverCombatant: CLIENT('survol d’un combattant'),
  setInspectId: CLIENT('inspection d’un statbloc'),
  clearCursor: CLIENT('curseur clavier'),
  // Élection LOCALE d'écran, hors réseau PAR CONSTRUCTION (même famille que `localIntent`) : le clic
  // qui élit le porteur du mode Dissiper n'engage rien — il ouvre le choix du Sort CHEZ CE JOUEUR.
  // `netFlow.emettreIntentInvite` le joue dans le store de l'émetteur et n'envoie aucun intent ; le
  // COMMIT, lui (`battleDispelSpell`), est exposé. Voyager le ferait naître chez l'HÔTE.
  dispelSelectCarrier: CLIENT('porteur élu du mode Dissiper — panneau-paramètre'),
  setCamPan: CLIENT('caméra'),
  resetCamPan: CLIENT('caméra'),
  setZoom: CLIENT('zoom'),
  // La bascule de vue, celle du POV et celle de l'inspection ne figurent pas ici : aucun écran ne les
  // émet — elles vivent au registre clavier (`state/keybindings.ts`), hors du périmètre de ce scan.
  setScreen: CLIENT('écran courant'),
  setGameMenu: CLIENT('menu système'),
  setEcranCapacites: CLIENT('écran des capacités'),
  closeDocument: CLIENT('document lu'),
  openCodex: CLIENT('codex'),
  closeCodexOverlay: CLIENT('codex'),
  setKeyBinding: CLIENT('raccourcis clavier'),
  resetKeyBindings: CLIENT('raccourcis clavier'),
  setSheetTab: CLIENT('onglet de fiche'),
  setSheetScroll: CLIENT('défilement de fiche'),
  setSheetId: CLIENT('fiche ouverte'),
  setSheetAlarmsSeen: CLIENT('alertes de fiche vues'),
  setEditingHero: CLIENT('brouillon du créateur'),
  openPossessionsScreen: CLIENT('écran Possessions'),
  closePossessionsScreen: CLIENT('écran Possessions'),
  // ── Exploration (miroir V1) ───────────────────────────────────────────────────────────────────
  markExplored: MIROIR('brouillard de guerre'),
  startScene: MIROIR('transition de scène'),
  openWorldMap: MIROIR('carte du monde'),
  closeWorldMap: MIROIR('carte du monde'),
  startTravel: MIROIR('départ en voyage'),
  resumeTravel: MIROIR('reprise de voyage'),
  departWaitDawn: MIROIR('départ à l’aube'),
  departCancel: MIROIR('porte de départ'),
  dismissTravelRecap: MIROIR('bilan de voyage'),
  setVoyageCadence: MIROIR('cadence de voyage'),
  transitionTo: MIROIR('transition de lieu'),
  // ── Fiche de personnage : progression (PX), équipement, sorts hors combat ─────────────────────
  buyCharAdvance: HOTE('progression (PX)'),
  buySkillAdvance: HOTE('progression (PX)'),
  buyTalent: HOTE('progression (PX)'),
  buySpell: HOTE('progression (PX)'),
  changeCareer: HOTE('progression (carrière)'),
  designateCareerSlot: HOTE('progression (carrière)'),
  trainProsthesis: HOTE('progression (prothèse)'),
  buySpellComponent: HOTE('composantes de sort'),
  removeSpellComponent: HOTE('composantes de sort'),
  setHeroBackground: HOTE('historique du héros'),
  favorBreak: HOTE('faveurs/relations'),
  favorSettle: HOTE('faveurs/relations'),
  oocCastSpell: HOTE('incantation hors combat depuis la fiche'),
  oocFocusSpell: HOTE('focalisation hors combat'),
  oocDispelSpell: HOTE('dissipation hors combat'),
  openMedic: HOTE('ouverture de l’infirmerie'),
  usePartyItem: HOTE('consommable hors combat'),
  appraiseItem: HOTE('ouverture d’une Évaluation (inventaire)'),
  appraiseGear: HOTE('ouverture d’une Évaluation (butin)'),
  // ── Possessions / inventaire / équipement (lot coop non ouvert) ───────────────────────────────
  toggleEquip: HOTE('équipement'),
  stowItem: HOTE('rangement d’objet'),
  transferItem: HOTE('transfert d’objet'),
  setItemSkin: HOTE('apparence d’objet'),
  setItemShape: HOTE('forme d’objet'),
  setLoadoutSlot: HOTE('panoplie'),
  createLoadout: HOTE('panoplie'),
  deleteLoadout: HOTE('panoplie'),
  setActiveLoadout: HOTE('panoplie'),
  abandonPossession: HOTE('possessions du groupe'),
  renamePossession: HOTE('possessions du groupe'),
  retrievePossession: HOTE('possessions du groupe'),
  stablePossession: HOTE('possessions du groupe'),
  embark: HOTE('embarquement'),
  disembark: HOTE('débarquement'),
  // ── Bourse du groupe : marché terrestre, marchand, port ───────────────────────────────────────
  addToCart: HOTE('panier du marchand'),
  decFromCart: HOTE('panier du marchand'),
  removeFromCart: HOTE('panier du marchand'),
  clearCart: HOTE('panier du marchand'),
  payCart: HOTE('achat (bourse du groupe)'),
  addToSellCart: HOTE('panier de vente'),
  removeFromSellCart: HOTE('panier de vente'),
  clearSellCart: HOTE('panier de vente'),
  confirmSell: HOTE('vente (bourse du groupe)'),
  setSellHalving: HOTE('option de vente'),
  assignDistribution: HOTE('distribution des achats'),
  confirmDistribution: HOTE('distribution des achats'),
  barterExchange: HOTE('troc'),
  repairItem: HOTE('réparation'),
  searchAvailability: HOTE('recherche de disponibilité'),
  startBargain: HOTE('ouverture d’un Marchandage'),
  refuseBargain: HOTE('refus d’un Marchandage'),
  closeMerchant: HOTE('écran Marchand'),
  openPlaceMerchant: HOTE('écran Marchand'),
  openLandMarket: HOTE('marché terrestre'),
  closeLandMarket: HOTE('marché terrestre'),
  landBuyCargo: HOTE('cargaison'),
  landSellCargo: HOTE('cargaison'),
  landDumpCargo: HOTE('cargaison'),
  landEvalWine: HOTE('évaluation de cargaison'),
  moveCargo: HOTE('cargaison'),
  openPort: HOTE('écran Port'),
  closePort: HOTE('écran Port'),
  portBuyCargo: HOTE('négoce portuaire'),
  portSellCargo: HOTE('négoce portuaire'),
  portDumpCargo: HOTE('négoce portuaire'),
  portRepair: HOTE('chantier naval'),
  portCareen: HOTE('chantier naval'),
  portInstallUpgrade: HOTE('chantier naval'),
  portHireCrew: HOTE('équipage'),
  portDismissCrew: HOTE('équipage'),
  gatherInnInfo: HOTE('auberge (hub de ville)'),
  // ── Navire / rôles / conseil de bord ──────────────────────────────────────────────────────────
  setShipRole: HOTE('rôles de bord'),
  setTravelRole: HOTE('rôles de voyage'),
  setPosteAmmo: HOTE('munitions d’un poste'),
  councilPay: HOTE('paie hebdomadaire (bourse du groupe)'),
  councilClose: HOTE('conseil de bord'),
  // ── Décisions de GROUPE (mer, taverne, poursuite, séance) ─────────────────────────────────────
  seaActivitiesConfirm: HOTE('activités hebdomadaires en mer'),
  resolveShoreLeave: HOTE('relâche à terre'),
  resolveManannPriest: HOTE('événement de port'),
  playTavernGame: HOTE('jeu de taverne'),
  closeTavernGames: HOTE('jeux de taverne'),
  openTavernGames: HOTE('jeux de taverne'),
  pursuitAbandon: HOTE('abandon d’une manche de poursuite'),
  endSession: HOTE('fin de séance'),
  closeSessionEnd: HOTE('fin de séance'),
  chooseDialogue: HOTE('dialogue (jeton unique, #669)'),
  // ── Interlude : ouverture/clôture et bataille de masse ────────────────────────────────────────
  interludeEnd: HOTE('clôture de l’interlude'),
  interludeEntrainement: HOTE('entraînement (bourse du groupe)'),
  massBattleActivity: HOTE('bataille de masse'),
  setMassBattleHero: HOTE('bataille de masse'),
  massBattleAdvance: HOTE('bataille de masse'),
  massBattleClash: HOTE('bataille de masse'),
  massBattleHazard: HOTE('bataille de masse'),
  massBattleRally: HOTE('bataille de masse'),
  massBattleScene: HOTE('bataille de masse'),
  endMassBattle: HOTE('bataille de masse'),
  // ── Repos / butin / victoire / défaite ────────────────────────────────────────────────────────
  openRest: HOTE('ouverture du repos'),
  restSleep: 'repos : l’HÔTE dort pour le groupe — l’invité passe par restSet/restReady (exposés)',
  restCancel: HOTE('annulation du repos'),
  assignLootGear: HOTE('attribution de butin hors victoire'),
  dismissLoot: HOTE('fermeture du butin'),
  dismissVictory: 'victoire : l’invité passe par victoryReady — l’hôte ferme à l’unanimité (exposé)',
  harvestCreature: HOTE('récolte sur un cadavre'),
  dismissDefeat: HOTE('écran de défaite'),
  // ── Persistance / campagne / éditeur / session réseau ─────────────────────────────────────────
  saveGame: HOTE('sauvegarde'),
  loadGame: HOTE('chargement'),
  importGame: HOTE('import de sauvegarde'),
  loadProject: HOTE('éditeur de campagne'),
  setPendingCampaign: HOTE('bibliothèque de campagnes'),
  setParty: HOTE('écran de scénarios de test'),
  startCombat: HOTE('écran de scénarios de test'),
  startMassBattle: HOTE('écran de scénarios de test'),
  netHostStart: 'session réseau elle-même (héberger) — jamais un intent',
  netJoin: 'session réseau elle-même (rejoindre) — jamais un intent',
  netLeave: 'session réseau elle-même (quitter) — jamais un intent',
  netAssign: 'attribution hôte-autoritaire d’un héros à un siège — jamais un intent',
  netAssignSlot: 'attribution hôte-autoritaire d’un emplacement — jamais un intent',
  setGmSeat: 'rôle MJ, hôte-autoritaire — jamais un intent',
};

/** Actions DÉCLARÉES par l'interface du store (`store.ts`) — la population confrontée au scan. */
function storeDeclaredActions(): Set<string> {
  const src = readFileSync(join(process.cwd(), 'src', 'state', 'store.ts'), 'utf8');
  const out = new Set<string>();
  for (const l of src.split('\n')) {
    const m = /^ {2}([a-z][A-Za-z0-9_]*)\??:\s*[(<]/.exec(l);
    if (m) out.add(m[1]);
  }
  return out;
}

/** Fichiers d'écran (hors tests) : `src/ui` + `src/gameIso`. */
function ecranFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
    }
  };
  walk(join(process.cwd(), 'src', 'ui'));
  walk(join(process.cwd(), 'src', 'gameIso'));
  return out;
}

const ident = (s: string, i: number): string => {
  let j = i;
  while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
  return s.slice(i, j);
};

/**
 * PURE et éprouvable : les actions de store atteintes par un SÉLECTEUR d'écran (`s.<action>`,
 * `useGame.getState().<action>`), avec le premier site qui les nomme. Extraction textuelle assumée
 * (cf. limites en tête de fichier).
 */
export function emissionsDe(
  fichiers: readonly { rel: string; texte: string }[],
  declarees: ReadonlySet<string>,
): Map<string, string> {
  const hits = new Map<string, string>();
  for (const f of fichiers) {
    f.texte.split('\n').forEach((l, i) => {
      for (const tok of ['=> s.', '=>s.', '.getState().']) {
        let k = -1;
        while ((k = l.indexOf(tok, k + 1)) !== -1) {
          const n = ident(l, k + tok.length);
          if (n && declarees.has(n) && !hits.has(n)) hits.set(n, `${f.rel}:${i + 1}`);
        }
      }
    });
  }
  return hits;
}

const emissions = (): Map<string, string> => {
  const declarees = storeDeclaredActions();
  const fichiers = ecranFiles().map((p) => ({
    rel: p.split('\\').join('/').split('/src/')[1] ?? p,
    texte: readFileSync(p, 'utf8'),
  }));
  return emissionsDe(fichiers, declarees);
};

describe('#1050 — (a) tout geste ÉMIS par un écran est exposé, ou nommé hors surface', () => {
  it('précondition : le scan voit bien des écrans ET des actions de store', () => {
    expect(ecranFiles().length).toBeGreaterThan(50);
    expect(storeDeclaredActions().size).toBeGreaterThan(200);
    expect(emissions().size).toBeGreaterThan(100);
  });

  it('aucune SURFACE MORTE : action émise par un écran, hors allowlist et sans exclusion motivée', () => {
    const mortes = [...emissions()].filter(([n]) => !GUEST_INTENTS.has(n) && !(n in HORS_SURFACE_UI));
    expect(
      mortes.map(([n, site]) => `${n} (${site})`),
      'geste d’écran hors GUEST_INTENTS : chez l’invité il s’exécute EN LOCAL puis meurt au snapshot, sans message',
    ).toEqual([]);
  });

  it('HORS_SURFACE_UI ne porte que des exclusions VIVANTES (ni exposée, ni inexistante, ni muette)', () => {
    const declarees = storeDeclaredActions();
    const inconnues = Object.keys(HORS_SURFACE_UI).filter((n) => !declarees.has(n));
    expect(inconnues, 'exclusion sur une action qui n’existe plus — la retirer').toEqual([]);
    const exposees = Object.keys(HORS_SURFACE_UI).filter((n) => GUEST_INTENTS.has(n));
    expect(exposees, 'exclusion sur une action pourtant exposée — la retirer').toEqual([]);
    const emises = emissions();
    const jamaisEmises = Object.keys(HORS_SURFACE_UI).filter((n) => !emises.has(n));
    expect(jamaisEmises, 'exclusion sur une action qu’aucun écran n’émet — la retirer (liste morte)').toEqual([]);
    const sansRaison = Object.entries(HORS_SURFACE_UI).filter(([, why]) => why.trim().length < 20).map(([n]) => n);
    expect(sansRaison, 'exclusion sans raison lisible').toEqual([]);
  });

  it('les 15 symboles du ticket sont EXPOSÉS (inventaire nominatif — la classe est close)', () => {
    for (const n of [
      'oppositionConfirm', 'oppositionResist', 'cascadeResist', 'counterspellRollAll', 'oppositionRollAll',
      'climbAcross', 'battleSelfManeuver', 'battleShipReload', 'battleManPoste', 'battleWater',
      'battleLeavePoste', 'battlePushEngine', 'battleAidTeam', 'battleGainAdvantage', 'battleSelectAttack',
      'battleManeuverArea', 'preemptRangedShot', 'armPreempt',
    ]) {
      expect(GUEST_INTENTS.has(n), `${n} : hors allowlist`).toBe(true);
      expect(typeof (useGame.getState() as unknown as Record<string, unknown>)[n], `${n} : action inexistante`).toBe('function');
    }
  });
});

describe('#1050 — (b) le détecteur d’émission MORD (cas simulé)', () => {
  it('un sélecteur d’écran sur une action déclarée est vu, avec son site ; le reste est ignoré', () => {
    const fichiers = [
      { rel: 'ui/Faux.tsx', texte: 'const a = useGame((s) => s.fauxGeste);\nconst b = useGame((s)=>s.autreGeste);' },
      { rel: 'ui/Bis.tsx', texte: 'useGame.getState().troisieme();\nconst x = s.pasUnSelecteur;' },
    ];
    const vus = emissionsDe(fichiers, new Set(['fauxGeste', 'autreGeste', 'troisieme', 'pasUnSelecteur']));
    expect([...vus.keys()].sort()).toEqual(['autreGeste', 'fauxGeste', 'troisieme']);
    expect(vus.get('fauxGeste')).toBe('ui/Faux.tsx:1');
    expect(vus.get('troisieme')).toBe('ui/Bis.tsx:1');
  });

  it('une action NON déclarée par le store n’est jamais retenue (pas de faux positif)', () => {
    const vus = emissionsDe([{ rel: 'ui/F.tsx', texte: 'useGame((s) => s.inconnue)' }], new Set(['autre']));
    expect([...vus.keys()]).toEqual([]);
  });
});

describe('#1050 — (c) toute ROUTE de possession est atteignable par le réseau', () => {
  it('une route hors `GUEST_INTENTS` DÉCLARE qu’elle l’est (sinon la règle ne s’exécute jamais)', () => {
    const muettes = [...ROUTES.entries()]
      .filter(([a, r]) => !GUEST_INTENTS.has(a) && !r.horsAllowlist)
      .map(([a]) => a);
    expect(
      muettes,
      'route déclarée mais filtrée hors de l’allowlist (classe #1016) : l’intent n’atteint JAMAIS l’hôte',
    ).toEqual([]);
  });

  it('toute route pointe sur une action RÉELLE du store (hors routes hors-allowlist assumées)', () => {
    const store = useGame.getState() as unknown as Record<string, unknown>;
    const fantomes = [...ROUTES.keys()].filter((a) => typeof store[a] !== 'function');
    expect(fantomes, 'route sur une action inexistante').toEqual([]);
  });
});
