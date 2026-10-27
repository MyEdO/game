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
  // `net*` de session : le client gère SA connexion ; l'attribution de sièges et le rôle MJ sont
  // hôte-autoritaires.
  saveGame: 'hôte', loadGame: 'hôte', importGame: 'hôte',
  netHostStart: 'local', netJoin: 'local', netLeave: 'local',
  netAssign: 'hôte', netAssignSlot: 'hôte', setGmSeat: 'hôte',
  // ═══ interne : aucun écran ne l'émet ═══
  // ── Vue et curseur clavier (registre `state/clavier/keybindings.ts`) ─────────────────────────────────
  rotateCam: 'interne', toggleViewMode: 'interne', togglePov: 'interne', setReveler: 'interne', moveCursor: 'interne',
  snapCursorToTarget: 'interne', commitCursor: 'interne', stepPartyDir: 'interne',
  // ── Persistance silencieuse ───────────────────────────────────────────────────────────────────
  autoSave: 'interne',
} as const satisfies TableDeLAdaptateur;

/** Args JSON-sûrs pour un intent : les handlers React passent parfois l'ÉVÉNEMENT en argument
 *  (`onClick={action}`) — circulaire, il ferait échouer la sérialisation et PERDRAIT l'intent
 *  (bug trouvé à l'audit coop : « Appliquer » d'invité muet). On TRONQUE la queue non
 *  sérialisable (l'événement est toujours en dernier) sans toucher aux vrais arguments. */
export function sanitizeIntentArgs(args: unknown[]): unknown[] {
  const jsonSafe = (v: unknown) => {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  };
  const out = [...args];
  while (out.length && (!jsonSafe(out[out.length - 1]) || typeof out[out.length - 1] === 'function')) out.pop();
  return out;
}
