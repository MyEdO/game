import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'nurglings',
  draw: `<path d="M-3.8 0.6 l-2.2 1.2 M3.8 0.6 l2.2 1.2 M-1.6 4.2 l-0.6 2 M1.6 4.2 l0.6 2" stroke="@corpsO" stroke-width="0.8" stroke-linecap="round"/><ellipse cx="0" cy="1.2" rx="4.4" ry="3.6" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="-1.2" cy="0" rx="2.4" ry="1.8" fill="@corpsH" opacity="0.3"/><circle cx="1.8" cy="1.8" r="0.7" fill="@corpsO" opacity="0.5"/><circle cx="-2.2" cy="2.4" r="0.6" fill="@corpsO" opacity="0.5"/><circle cx="0" cy="-3.2" r="2.5" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="0" cy="-3.2" r="1.6" fill="#e8e4c8"/><circle cx="0.4" cy="-3" r="0.85" fill="#160c06"/><path d="M-1.8 -1.2 Q0 0.8 1.8 -1.2 Z" fill="#2a1a0e"/><path d="M-0.9 -0.8 l0 1.5 M0.5 -0.6 l0 1.7" stroke="#dcd6b8" stroke-width="0.4"/><path d="M1.4 -0.6 q1.1 1.8 0.4 3.6" stroke="@corpsH" stroke-width="0.6" fill="none" opacity="0.85"/>`,
  palette: {"corps":"#6e8a38","corpsO":"#445222","corpsH":"#9cba5a"},
};
