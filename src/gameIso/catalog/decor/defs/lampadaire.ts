import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "lampadaire", render: ()=>`<g><ellipse cx="60" cy="146" rx="12" ry="5" fill="${P.terreSombre2}"/><rect x="57" y="70" width="6" height="76" fill="${P.terreSombre5}"/><path d="M50 70 L70 70 L66 56 L54 56 Z" fill="${P.terreSombre3}"/><rect x="53" y="56" width="14" height="4" fill="${P.terreSombre5}"/><circle class="warm" cx="60" cy="64" r="5" fill="${P.boisTresClair6}"/></g>` };
