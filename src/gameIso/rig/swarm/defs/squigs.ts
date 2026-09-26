import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'squigs',
  draw: `<path d="M-2 3.8 l-0.7 2.2 M2 3.8 l0.7 2.2" stroke="@corpsO" stroke-width="0.9" stroke-linecap="round"/><circle cx="0" cy="0" r="4.4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="-1.2" cy="-1.6" rx="2" ry="1.6" fill="@corpsH" opacity="0.3"/><path d="M-3.6 0.6 Q0 -1 3.6 0.6 Q3 4.2 0 4.4 Q-3 4.2 -3.6 0.6 Z" fill="#2a0e0c"/><path d="M-2.4 0.8 l0.8 2.4 l0.9 -2.2 Z M-0.1 0.4 l0.7 2.8 l0.9 -2.6 Z M2 0.8 l0.7 2.2 l0.8 -2 Z" fill="#efe6cf"/><circle cx="-1.8" cy="-2.4" r="1" fill="#f4ecd8"/><circle cx="-1.6" cy="-2.2" r="0.5" fill="#160c06"/><circle cx="1.8" cy="-2.4" r="1" fill="#f4ecd8"/><circle cx="1.6" cy="-2.2" r="0.5" fill="#160c06"/>`,
  palette: {"corps":"#9a2a46","corpsO":"#5e1426","corpsH":"#c85a6e"},
};
