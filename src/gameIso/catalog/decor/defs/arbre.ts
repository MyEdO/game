import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "arbre", render: ()=>`<g><ellipse cx="60" cy="148" rx="26" ry="11" fill="${P.ombre}" opacity="0.3"/><rect x="53" y="110" width="14" height="40" rx="3" fill="${P.boisSombre2}"/><path d="M60 50 L100 122 L74 114 L60 130 L46 114 L20 122 Z" fill="${P.feuillageSombre11}"/><path d="M60 50 L100 122 L74 114 L60 92 Z" fill="${P.feuillageSombre9}"/><path d="M60 72 L84 116 L60 108 Z" fill="${P.feuillageFonce22}" opacity="0.6"/></g>` };
