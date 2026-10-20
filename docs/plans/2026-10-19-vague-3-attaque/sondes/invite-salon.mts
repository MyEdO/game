// L'invité suit-il l'hôte hors du salon coop ? Mesure à cf4f18bcf, puis la règle de D5 v5 appliquée au même fil.
import { useGame } from '/home/user/game/src/state/store';
import { netSnapshot, applyNetSnapshot } from '/home/user/game/src/state/netFlow';
// 1. HÔTE : il compose l'équipe depuis le salon (CoopLobby.tsx:131, setScreen('party')).
useGame.getState().setScreen('party');
const snap = netSnapshot(useGame.getState);
// 2. INVITÉ : il attend dans le salon (CoopLobby.tsx:107, écran 'coop'), puis reçoit le snapshot.
useGame.getState().setScreen('coop');
applyNetSnapshot(useGame.setState as any, snap);
console.log('cf4f18bcf : écran de l’invité après le snapshot =', useGame.getState().screen);
// 3. D5 v5 (design.md:385-392, 376-377) : 'coop' est du SHELL → ecranDuShell, par client, hors snapshot ;
//    applyNetSnapshot pose repriseDeLaPartie(game), qui ne touche pas la moitié d'interface.
const SHELL = new Set(['editor', 'test', 'coop', 'compendium', 'gallery', 'webglSpike']);
let invite = { screen: 'menu', ecranDuShell: null as string | null };
const setScreen = (v: string) => { invite = SHELL.has(v) ? { ...invite, ecranDuShell: v } : { screen: v, ecranDuShell: null }; };
setScreen('coop');                                   // l'invité ouvre le salon
const donnees = { screen: (snap as any).game?.screen ?? (snap as any).screen }; // la partie de l'hôte : screen 'party'
invite = { ...invite, ...donnees };                  // repriseDeLaPartie : les données de l'hôte par-dessus
const ecranAffiche = invite.ecranDuShell ?? invite.screen;
console.log('D5 v5   : screen =', invite.screen, '| ecranDuShell =', invite.ecranDuShell, '| ecranAffiche =', ecranAffiche);
