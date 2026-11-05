import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "cadavre", render: ()=>`<g><ellipse cx="60" cy="146" rx="32" ry="10" fill="${P.sangSombre8}" opacity="0.5"/><path d="M60 132 L94 124 M60 134 L90 148" stroke="${P.boisSombre}" stroke-width="11" stroke-linecap="round"/><path d="M54 130 L30 116 M54 134 L34 150" stroke="${P.boisSombre}" stroke-width="8" stroke-linecap="round"/><ellipse cx="58" cy="132" rx="20" ry="13" fill="${P.boisSombre}"/><ellipse cx="58" cy="132" rx="20" ry="13" fill="${P.ombre}" opacity="0.18"/><circle cx="34" cy="128" r="10" fill="${P.boisClair5}"/><path d="M24 124 q10 -9 20 0z" fill="${P.boisTresSombre2}"/></g>` };
