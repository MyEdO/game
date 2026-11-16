import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "pin", render: ()=>`<g><ellipse cx="60" cy="148" rx="20" ry="9" fill="${P.ombre}" opacity="0.3"/><rect x="56" y="118" width="8" height="32" rx="2" fill="${P.boisSombre3}"/><path d="M60 24 L86 74 L72 72 L94 120 L26 120 L48 72 L34 74 Z" fill="${P.feuillageSombre}"/><path d="M60 24 L86 74 L72 72 L94 120 L60 120 Z" fill="${P.feuillageSombre2}" opacity="0.7"/></g>` };
