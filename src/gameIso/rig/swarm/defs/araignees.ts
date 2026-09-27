import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'araignees',
  draw: `<path d="M0 -2 Q3 -5.4 6.2 -6.4 M1 -1.4 Q5.2 -3 8.4 -3 M1 1.4 Q5.2 3 8.4 3 M0 2 Q3 5.4 6.2 6.4" stroke="@corps" stroke-width="0.9" fill="none" stroke-linecap="round"/><path d="M-1 -2 Q-4 -5.4 -7.2 -6.4 M-2 -1.4 Q-6.2 -3 -9.4 -3 M-2 1.4 Q-6.2 3 -9.4 3 M-1 2 Q-4 5.4 -7.2 6.4" stroke="@corps" stroke-width="0.9" fill="none" stroke-linecap="round"/><ellipse cx="-2.2" cy="0" rx="3.8" ry="3.3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="-2.8" cy="-0.9" rx="2" ry="1.4" fill="@corpsH" opacity="0.28"/><circle cx="2.6" cy="0" r="2.3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="3.6" cy="-0.9" r="0.65" fill="#c43030"/><circle cx="3.6" cy="0.9" r="0.65" fill="#c43030"/>`,
  palette: {"corps":"#2a231f","corpsO":"#14100c","corpsH":"#54463a"},
};
