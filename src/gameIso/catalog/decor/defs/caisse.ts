import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "caisse", render: ()=>`<g><path d="M30 150 L30 110 L60 96 L90 110 L90 150 L60 164 Z" fill="${P.boisFonce24}"/><path d="M30 110 L60 124 L90 110 L60 96 Z" fill="${P.boisFonce36}"/><path d="M60 124 L60 164 M30 110 L30 150 M90 110 L90 150" stroke="${P.boisSombre16}" stroke-width="2"/></g>` };
