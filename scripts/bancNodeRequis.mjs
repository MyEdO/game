export const bancnoderequistestmjs = (() => {
const modulesDuHook = (texte) => [...texte.matchAll(/"\$\(dirname "\$0"\)\/([\w-]+\.mjs)"/g)].map((m) => m[1])
return { modulesDuHook }
})()
