import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'zombies',
  draw: `<path d="M-1 4 l-0.7 2.6 M1 4 l0.5 2.6" stroke="@corpsO" stroke-width="1" stroke-linecap="round"/><path d="M-2.6 4 Q-3.2 -1.2 0 -3.2 Q3.2 -1.2 2.6 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-2.6 3.4 l0.9 1.8 l0.8 -1.4 l0.9 1.8 l0.8 -1.4 l0.9 1.6" fill="@corpsO" opacity="0.6"/><path d="M-1.6 -1 Q-3.2 1 -3.4 3.6" stroke="@corps" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M1.6 -1.2 Q5.2 -1.4 7.8 0.2" stroke="@corps" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M7.8 0.2 l1.5 -0.7 M7.8 0.2 l1.1 1.1 M8.4 0 l0.8 -1.2" stroke="@corpsO" stroke-width="0.6" stroke-linecap="round"/><circle cx="2.2" cy="-4.2" r="2.1" fill="@corpsH" stroke="@corpsO" stroke-width="0.5"/><circle cx="2.9" cy="-4.4" r="0.5" fill="#160c06"/><path d="M1.8 -2.8 q1.3 0.7 2 -0.1" stroke="@corpsO" stroke-width="0.4" fill="none"/>`,
  palette: {"corps":"#6a6a5c","corpsO":"#3a3a30","corpsH":"#8c9476"},
};
