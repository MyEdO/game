import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'marcassins',
  draw: `<path d="M-3 3.4 l-0.6 2.8 M-1 3.6 l0 2.8 M2 3.6 l0.4 2.8 M3.6 3.2 l0.8 2.8" stroke="@corpsO" stroke-width="0.9"/><path d="M-5.6 -1.2 q-2 0.4 -2.6 2.4" stroke="@corpsO" stroke-width="0.8" fill="none"/><ellipse cx="0" cy="0" rx="6" ry="4" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-3.2 -2.8 q0.2 3.4 0.6 5.8 M-0.2 -3.2 q0.2 3.6 0.4 6.2 M2.8 -2.8 q-0.2 3.2 -0.6 5.6" stroke="@corpsH" stroke-width="0.7" fill="none" opacity="0.75"/><ellipse cx="6.2" cy="0.6" rx="2.4" ry="1.8" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><circle cx="7.7" cy="0.2" r="0.4" fill="#160c06"/><circle cx="7.7" cy="1.1" r="0.4" fill="#160c06"/><path d="M6.4 1.8 l1.4 1.4" stroke="#efe6cf" stroke-width="0.8" stroke-linecap="round"/><path d="M1.8 -3.6 l-1.2 -2.2 l2.6 0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.3"/><circle cx="4.4" cy="-1.2" r="0.7" fill="#160c06"/>`,
  palette: {"corps":"#7a5a36","corpsO":"#4a3620","corpsH":"#caa674"},
};
