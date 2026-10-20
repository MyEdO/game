// Juge v6 : netLeave et la part par client de `net` (D5 v6 : `NetState` réduit à sa part partagée,
// `reseauDuClient: { mode, mySeat, connection, hostAway }` à part ; netLeave n'est pas nommé).
import { useGame } from '/home/user/game/src/state/store';
import { initialNet } from '/home/user/game/src/state/netFlow';
useGame.setState({ net: { ...initialNet(), mode: 'guest', mySeat: 2, roomCode: 'ABC234', connection: 'reconnecting', hostAway: true } });
useGame.getState().netLeave();
const n = useGame.getState().net;
console.log('cf4f18bcf : après netLeave, mode =', n.mode, '| mySeat =', n.mySeat, '| connection =', n.connection, '| hostAway =', n.hostAway);
// D5 v6 : `initialNet()` ne rend plus que la part partagée ; `set({ net: initialNet() })` (netFlow.ts:429) compile tel quel.
const PART = ['mode', 'mySeat', 'connection', 'hostAway'] as const;
let v6 = { net: Object.fromEntries(Object.entries(initialNet()).filter(([k]) => !(PART as readonly string[]).includes(k))), reseauDuClient: { mode: 'guest', mySeat: 2, connection: 'reconnecting', hostAway: true } };
v6 = { ...v6, net: Object.fromEntries(Object.entries(initialNet()).filter(([k]) => !(PART as readonly string[]).includes(k))) }; // netLeave inchangé
console.log('D5 v6     : après netLeave, reseauDuClient =', JSON.stringify(v6.reseauDuClient), '→ netHostStart refuse (« mode !== local », netFlow.ts:245), netJoin répond coop.alreadyInSession (:313)');
