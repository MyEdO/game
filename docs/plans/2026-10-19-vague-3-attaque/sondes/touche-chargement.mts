// Juge v7 : la classe « préférence clavier écrasée par l'état de partie » hors de startScene, à cf4f18bcf.
import { useGame } from '/home/user/game/src/state/store';
import { snapshotSave } from '/home/user/game/src/state/saves';
import { applyNetSnapshot, netSnapshot } from '/home/user/game/src/state/netFlow';
const g = useGame.getState;
g().setKeyBinding('cam-left', 'KeyA');                       // la touche AVANT la save
const save = snapshotSave(g() as never, useGame.getInitialState() as never, 'x');
console.log('save porte keyOverrides :', JSON.stringify((save.data as any).keyOverrides));
g().setKeyBinding('cam-left', 'KeyZ');                       // la touche reliée APRÈS la save (localStorage = KeyZ)
g().importGame(JSON.stringify(save));
console.log('après importGame (chargement) : cam-left =', g().keyOverrides['cam-left'], '| reliée =', 'KeyZ');
// invité : un snapshot de l'hôte (touches de l'hôte) écrase la touche de l'invité
g().setKeyBinding('cam-left', 'KeyG');                       // l'invité relie SA touche
const hote = { ...netSnapshot(g as never) } as Record<string, unknown>;
const hg = (hote as any).game ?? hote; (hg as any).keyOverrides = { 'cam-left': 'KeyH' };
applyNetSnapshot(useGame.setState as never, hote);
console.log('invité après snapshot : cam-left =', g().keyOverrides['cam-left'], '| reliée par l invité = KeyG');
