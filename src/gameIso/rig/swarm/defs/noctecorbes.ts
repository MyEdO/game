import type { SwarmFormDef } from '../formDef';

export const swarmForm: SwarmFormDef = {
  id: 'noctecorbes',
  draw: `<path d="M-1.6 -0.8 Q-7 -5 -11.4 -3 Q-7 -1 -2 0.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><path d="M1.6 -0.8 Q7 -5 11.4 -3 Q7 -1 2 0.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><path d="M-3.4 -1.6 l-3.2 -0.4 M-5.6 -0.6 l-3 0.2 M3.4 -1.6 l3.2 -0.4 M5.6 -0.6 l3 0.2" stroke="@corpsO" stroke-width="0.4" opacity="0.6"/><ellipse cx="0" cy="0.4" rx="2.4" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-1.4 3.2 l-1.4 3 l4 -1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><circle cx="0" cy="-3.6" r="1.6" fill="@corps" stroke="@corpsO" stroke-width="0.4"/><path d="M0.4 -4.8 l2.4 -1.2 l-2.2 0.2 Z" fill="@accent"/><circle cx="0.8" cy="-3.8" r="0.45" fill="#d8402a"/>`,
  palette: {"corps":"#2c2c34","corpsO":"#141419","corpsH":"#4e4e58","accent":"#c4402a"},
  aerial: true,
};
