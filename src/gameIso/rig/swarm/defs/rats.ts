import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'rats',
  draw: `<path d="M-2.6 3.2 l-1 3 M0.2 3.4 l0 3 M2.8 3 l1 3" stroke="@corpsO" stroke-width="0.6"/><path d="M-5.2 0.2 q-6 0.6 -10.2 3.6" stroke="@corpsO" stroke-width="0.8" fill="none"/><ellipse cx="0" cy="0" rx="6" ry="3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="0.5" cy="1" rx="4.2" ry="1.4" fill="@corpsO" opacity="0.4"/><path d="M5 -1 L9.6 0.2 L5 1.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><circle cx="3.2" cy="-2.9" r="1.5" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><circle cx="3.2" cy="-2.9" r="0.7" fill="@corpsO" opacity="0.5"/><circle cx="5.6" cy="-0.5" r="0.7" fill="#160c06"/><circle cx="9.3" cy="0.2" r="0.5" fill="#1a0d08"/>`,
  palette: {"corps":"#74675a","corpsO":"#403830","corpsH":"#9a8c7c"},
};
