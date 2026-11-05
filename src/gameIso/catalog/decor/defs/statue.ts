import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "statue", render: ()=>`<g><ellipse cx="60" cy="146" rx="22" ry="8" fill="${P.terreSombre11}"/><rect x="46" y="128" width="28" height="18" fill="${P.osMoyen6}"/><path d="M52 128 Q50 88 60 70 Q70 88 68 128 Z" fill="${P.osClair4}"/><circle cx="60" cy="64" r="9" fill="${P.osClair6}"/></g>` };
