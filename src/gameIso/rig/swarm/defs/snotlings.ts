import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'snotlings',
  draw: `<path d="M-2.6 1.4 l-2.2 1.6 M2.6 1.4 l2.2 1.6 M-1.2 4 l-0.8 2.2 M1.2 4 l0.8 2.2" stroke="@corpsO" stroke-width="0.8" stroke-linecap="round"/><ellipse cx="0" cy="1.8" rx="3" ry="2.6" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-2.6 -2.6 L-7.2 -4.6 L-2.8 -0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><path d="M2.6 -2.6 L7.2 -4.6 L2.8 -0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><circle cx="0" cy="-2.6" r="3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="-1.1" cy="-3" r="0.8" fill="#160c06"/><circle cx="1.1" cy="-3" r="0.8" fill="#160c06"/><path d="M-1.8 -1.2 Q0 0.4 1.8 -1.2" stroke="#160c06" stroke-width="0.5" fill="none"/>`,
  palette: {"corps":"#5c7c32","corpsO":"#36481e","corpsH":"#88aa50"},
};
