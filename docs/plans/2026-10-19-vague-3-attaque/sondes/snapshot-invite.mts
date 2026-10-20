// Sonde H-e : un snapshot d'hôte écrase-t-il l'état d'interface de l'invité (codexOverlay, sheetId, camRot, keyOverrides) ?
import { useGame } from '/home/user/game/src/state/store';
import { netSnapshot, applyNetSnapshot } from '/home/user/game/src/state/netFlow';
// 1. état de l'HÔTE
useGame.setState({ codexOverlay: { category: 'talents', id: 'hote' } as any, sheetId: 'hote', camRot: 3, keyOverrides: { 'cam-left': ['KeyH'] } as any, screen: 'campaign' } as any);
const snap = netSnapshot(useGame.getState);
// 2. état de l'INVITÉ, puis application du snapshot
useGame.setState({ codexOverlay: { category: 'talents', id: 'invite' } as any, sheetId: 'invite', camRot: 1, keyOverrides: { 'cam-left': ['KeyI'] } as any, localIntent: { actionId: 'courir' } } as any);
applyNetSnapshot(useGame.setState as any, snap);
const s = useGame.getState() as any;
console.log('codexOverlay', JSON.stringify(s.codexOverlay), '| sheetId', s.sheetId, '| camRot', s.camRot, '| keyOverrides', JSON.stringify(s.keyOverrides), '| localIntent', JSON.stringify(s.localIntent));
