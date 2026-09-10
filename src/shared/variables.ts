// Variables let workflow steps exchange data: "Set variable" steps write
// values, and any later step can reference them with ${name} placeholders.
// The same engine is used at run time (main) and for form validation
// (renderer), so names stay consistent everywhere.

const VARIABLE_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/

export function isVariableName(value: string): boolean {
  return VARIABLE_NAME.test(value)
}

// Resolves every ${name} occurrence inside one string using the given values.
// Unknown variable names resolve to the empty string. A doubled brace
// ($${name}) is an escape hatch: the leading $ is removed and the rest is
// left untouched, so literal "${name}" text can be produced.
export function resolvePlaceholders(
  value: string,
  vars: ReadonlyMap<string, string>,
): string {
  return value.replace(
    /\$\$\{([A-Za-z][A-Za-z0-9_-]*)\}|\$\{([A-Za-z][A-Za-z0-9_-]*)\}/g,
    (match, escaped: string | undefined, plain: string | undefined) => {
      if (escaped !== undefined) {
        return `\${${escaped}}`
      }
      if (plain !== undefined) {
        return vars.get(plain) ?? ''
      }
      return match
    },
  )
}