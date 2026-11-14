/**
 * Classes coop des actions de l'ADAPTATEUR web (`ActionsDeLAdaptateur`) : interface, caméra, clavier,
 * persistance, session réseau. Aucune n'est `invité` : l'allowlist ne compte que des actions du noyau
 * (`noyau/intentionsDeSiege.ts`, `CLASSE_DES_ACTIONS_DU_NOYAU`, `GUEST_INTENTS`).
 */
import type { TableDesClasses } from '../noyau/intentionsDeSiege';
import type { ActionsDeLAdaptateur } from './store';

export type TableDeLAdaptateur = { [A in keyof TableDesClasses<ActionsDeLAdaptateur>]: Exclude<TableDesClasses<ActionsDeLAdaptateur>[A], 'invité'> };

export const CLASSE_DES_ACTIONS_DE_L_ADAPTATEUR = {
  // ═══ local : état d'écran du client ═══
  // ── Rendu / caméra / navigation d'écran ───────────────────────────────────────────────────────
  setHovered: 'local', setHoverCombatant: 'local', setInspectId: 'local', clearCursor: 'local',
  setCamPan: 'local', resetCamPan: 'local', setZoom: 'local', setScreen: 'local', setGameMenu: 'local', fermerRetraitsDeChargement: 'local',
  openCodex: 'local', closeCodexOverlay: 'local', setKeyBinding: 'local', resetKeyBindings: 'local',
  setSheetTab: 'local', setSheetScroll: 'local', setSheetId: 'local', setSheetAlarmsSeen: 'local',
  setEditingHero: 'local', openPossessionsScreen: 'local', closePossessionsScreen: 'local',
  // ═══ hôte : persistance et session réseau ═══
  // `net*` de session : le client gère SA connexion.
  saveGame: 'hôte', loadGame: 'hôte', importGame: 'hôte',
  netHostStart: 'local', netJoin: 'local', netLeave: 'local',
  // La campagne choisie au menu (`pendingCampaign`), avant tout siège.
  setPendingCampaign: 'hôte',
  // ── Vue et curseur clavier (registre `state/clavier/keybindings.ts`) ─────────────────────────────────
  rotateCam: 'local', toggleViewMode: 'local', togglePov: 'local', setReveler: 'local', moveCursor: 'local',
  snapCursorToTarget: 'local', commitCursor: 'local', stepPartyDir: 'local',
} as const satisfies TableDeLAdaptateur;
