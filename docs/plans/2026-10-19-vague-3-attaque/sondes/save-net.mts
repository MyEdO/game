// Juge v6 : la save et la session réseau courante. Mesure à cf4f18bcf, puis la règle de D5 v6
// (DonneesDeLaPartie = EtatDeJeu − CHAMPS_PAR_CLIENT − HORS_SAVE ; `net` réduit à sa part partagée y reste).
import { useGame } from '/home/user/game/src/state/store';
import { snapshotSave } from '/home/user/game/src/state/saves';
import { initialNet } from '/home/user/game/src/state/netFlow';
const g = useGame.getState;
// 1. Une save prise lors d'une session passée (salon ANCIEN, un invité au siège 1).
useGame.setState({ net: { ...initialNet(), mode: 'host', roomCode: 'ANCIEN', seatNames: { 0: 'Anne', 1: 'Bob' }, presence: { 1: 'ok' }, ownership: { h1: 1 }, slots: [0, 1, 0, 0] } });
const save = snapshotSave(g() as never, useGame.getInitialState() as never, 'x');
console.log('save.data.net =', JSON.stringify((save.data as any).net));
// 2. Aujourd'hui, l'hôte d'un salon VIVANT charge cette save en session.
useGame.setState({ net: { ...initialNet(), mode: 'host', roomCode: 'VIVANT', seatNames: { 0: 'Anne', 2: 'Carl' }, presence: { 2: 'ok' }, ownership: {}, slots: [0, 2, 0, 0] } });
const avant = JSON.stringify(g().net);
const cause = g().importGame(JSON.stringify(save));
console.log('importGame ->', cause, '| écran', g().screen);
console.log('cf4f18bcf : net après chargement =', JSON.stringify(g().net), '| identique à la session courante :', JSON.stringify(g().net) === avant);
// 3. Règle de D5 v6 : reprise = etatInitialDuJeu() − CHAMPS_PAR_CLIENT, données par-dessus ; seul reseauDuClient est gardé.
const PART_PAR_CLIENT = ['mode', 'mySeat', 'connection', 'hostAway'];
const partage = (n: any) => Object.fromEntries(Object.entries(n).filter(([k]) => !PART_PAR_CLIENT.includes(k)));
const netV6 = partage((save.data as any).net);
console.log('D5 v6     : net (part partagée) après chargement =', JSON.stringify(netV6), '| reseauDuClient =', JSON.stringify({ mode: 'host', mySeat: 0 }));
console.log('D5 v6     : roomCode', netV6.roomCode, '≠ salon vivant', JSON.parse(avant).roomCode, '; presence', JSON.stringify(netV6.presence), '; ownership', JSON.stringify(netV6.ownership));
// 4. Conséquence en SOLO (reseauDuClient.mode = 'local') : le quorum des ready-checks lit seatNames/ownership sans le mode.
import { siegesRequis } from '/home/user/game/src/state/netOwnership';
const party = [{ id: 'h1' }] as never;
console.log('siegesRequis solo, net de la session courante (initialNet) =', JSON.stringify(siegesRequis({ party, net: initialNet() } as never)), '| net partagé de la save (D5 v6) =', JSON.stringify(siegesRequis({ party, net: { ...initialNet(), ...netV6 } } as never)));
