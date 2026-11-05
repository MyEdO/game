import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "panneau", render: ()=>`<g><ellipse cx="60" cy="146" rx="10" ry="4" fill="${P.boisSombre9}"/><rect x="57" y="92" width="6" height="54" fill="${P.boisSombre2}"/><rect x="40" y="78" width="40" height="18" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre16}" stroke-width="2"/><path d="M80 87 l10 -5 l-10 -5 z" fill="${P.boisFonce7}"/></g>` };
