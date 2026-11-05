import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "cheval-mort", render: ()=>`<g><ellipse cx="62" cy="146" rx="42" ry="11" fill="${P.ombre}" opacity="0.25"/><path d="M40 112 q-14 6 -10 26 q10 -6 12 -18z" fill="${P.ombre6}"/><ellipse cx="58" cy="128" rx="40" ry="20" fill="${P.boisSombre4}"/><ellipse cx="26" cy="124" rx="17" ry="16" fill="${P.boisSombre4}"/><path d="M44 142 l-4 14 M58 144 l0 14 M74 140 l4 14 M86 138 l8 12" stroke="${P.boisSombre6}" stroke-width="6" stroke-linecap="round"/><path d="M88 120 Q104 122 112 134 Q108 140 96 134 Z" fill="${P.boisSombre4}"/><path d="M108 130 Q121 134 125 143 L112 140 Z" fill="${P.boisSombre7}"/><ellipse cx="117" cy="138" rx="3" ry="2.4" fill="${P.ombre6}"/></g>` };
