export function stripFences(code: string): string {
  let c = code.trim();
  if (c.startsWith("```")) c = c.replace(/^```\w*\n?/, "");
  if (c.endsWith("```")) c = c.replace(/```$/, "");
  // Strip any text preamble before the first import/export statement
  const codeStart = c.search(/^(import |export )/m);
  if (codeStart > 0) c = c.slice(codeStart);
  return c;
}

// Count braces/parens. Skip single quotes — apostrophes in JSX text (e.g. "We'll") cause false positives.
export function countDelimiters(code: string) {
  let braces = 0, parens = 0, inString: string | null = null, escaped = false;
  for (const ch of code) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (inString) { if (ch === inString) inString = null; continue; }
    if (ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '(') parens++;
    if (ch === ')') parens--;
  }
  return { braces, parens };
}

// Strip trailing non-code text (model reasoning, second code blocks) that
// sometimes appears after a complete React component.
function stripPostamble(code: string): string {
  const lines = code.split('\n');
  let prevBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      prevBlank = true;
      continue;
    }

    // Embedded markdown fence — strong signal, no blank line required
    if (line.startsWith('```') && i > 0) {
      return lines.slice(0, i).join('\n').trimEnd();
    }

    // After a blank line, check for natural-language patterns that LLMs
    // emit when they start "thinking out loud" after generating code.
    if (prevBlank && i > 5) {
      if (/^(Wait|Let me|I need|I should|I'll|Note[:\s]|Actually|Here'?s|However|Looking|Now[,\s]|To |In this|For the|\d+\.\s)/.test(line)) {
        return lines.slice(0, i).join('\n').trimEnd();
      }
    }

    prevBlank = false;
  }
  return code;
}

export function autoClose(code: string): string {
  let c = stripFences(code);
  c = stripPostamble(c);
  const { braces, parens } = countDelimiters(c);
  if (parens > 0) c += '\n' + ')'.repeat(parens);
  if (braces > 0) c += '\n' + '}'.repeat(braces);
  return c;
}
