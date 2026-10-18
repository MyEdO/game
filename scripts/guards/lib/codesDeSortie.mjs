/** Code de sortie « DIFFÉRÉ » (`EX_TEMPFAIL`, sysexits.h) : verrou des gestes lourds tenu à l'échéance de son attente,
 *  ou admission mémoire refusée — rien n'a tourné (#2603, #2586). */
export const CODE_DIFFERE = 75

/** Verdict d'un processus enfant : un enfant tué par signal, ou clos sans code, ne réussit pas. */
export function codeEnfant(code, signal) {
  return signal ? 1 : (code ?? 1)
}
