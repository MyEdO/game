import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "tonneau", render: ()=>`<g><ellipse cx="60" cy="146" rx="22" ry="8" fill="${P.boisSombre16}"/><path d="M40 110 Q60 104 80 110 L78 144 Q60 150 42 144 Z" fill="${P.boisFonce12}"/><path d="M40 122 h40 M40 134 h40" stroke="${P.boisTresSombre2}" stroke-width="3"/><ellipse cx="60" cy="110" rx="20" ry="7" fill="${P.boisFonce24}"/></g>` };
