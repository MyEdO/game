import { coupesAuCaractere } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/coupeAuCaractere.mjs'
const vus = (text) => coupesAuCaractere([{ rel: 'temoin.tsx', text }])
const cas = {
  exprVide: "const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    {/* c */}\n    {'…'}\n  </span>\n);",
  deuxVides: "const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    {/* a */}{}\n    {/* b */}\n    …\n  </span>\n);",
  videPuisBalise: "const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    {/* c */}\n    <b>fin</b>\n    {'…'}\n  </span>\n);",
  exprNonVide: "const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    {x}\n    {'…'}\n  </span>\n);",
}
for (const [k, t] of Object.entries(cas)) console.log(k, JSON.stringify(vus(t)))
