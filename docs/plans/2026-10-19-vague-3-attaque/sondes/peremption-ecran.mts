// Juge v6 : la péremption de l'écran du client (D5 v6) rejouée sur les fils de l'invité, au texte de D5.
const CLIENT = new Set(['creator', 'editor', 'test', 'coop', 'compendium', 'gallery', 'webglSpike']);
type C = { screen: string; ecranDuClient: string | null };
const abonnement = (prev: C, s: C): C => (prev.screen !== s.screen ? { ...s, ecranDuClient: null } : s);
const setScreen = (c: C, v: string): C => (CLIENT.has(v) ? { ...c, ecranDuClient: v } : { screen: v, ecranDuClient: null });
const snapshot = (c: C, screen: string): C => abonnement(c, { ...c, screen });         // repriseDeLaPartie : screen seul change
const aff = (c: C) => c.ecranDuClient ?? c.screen;
let inv: C = setScreen({ screen: 'menu', ecranDuClient: null }, 'coop');
inv = snapshot(inv, 'menu'); const a = aff(inv);
inv = snapshot(inv, 'party'); const b = aff(inv);
inv = setScreen(inv, 'creator'); inv = snapshot(inv, 'party'); const c = aff(inv);
inv = snapshot(inv, 'campaign'); const d = aff(inv);
console.log('invité : salon, hôte au salon =', a, '| hôte compose =', b, '| invité au créateur, hôte reste sur party =', c, '| hôte lance =', d);
let hote: C = setScreen({ screen: 'campaign', ecranDuClient: null }, 'compendium');
hote = abonnement(hote, { ...hote, screen: 'menu' });                                   // défaite (store.ts:2853)
console.log('hôte au compendium, défaite =', aff(hote));
