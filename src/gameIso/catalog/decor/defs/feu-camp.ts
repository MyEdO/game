import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "feu-camp", render: ()=>`<g><ellipse cx="60" cy="146" rx="22" ry="9" fill="${P.boisSombre9}"/><path d="M44 144 L74 132 M48 146 L80 138 M40 140 L70 128" stroke="${P.boisFonce20}" stroke-width="5" stroke-linecap="round"/><g class="warm"><path d="M60 138 Q48 118 60 100 Q66 116 72 110 Q78 128 60 138 Z" fill="${P.boisMoyen}"/><path d="M60 136 Q54 124 60 112 Q64 122 60 136 Z" fill="${P.boisTresClair6}"/></g></g>` };
