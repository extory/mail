// Lightweight line-level diff with Myers-style LCS, returning a
// sequence of {kind: 'context'|'added'|'removed', text}.
// We don't need a perfect implementation — only enough fidelity to show
// a reader what changed. For long content we fall back to a coarse
// "block" diff (sequential added/removed lines).

export type DiffLine = { kind: "context" | "added" | "removed"; text: string };

/**
 * Convert HTML to readable plain text suitable for diffing. Strips tags,
 * collapses whitespace within a line, but preserves line breaks coming
 * from block-level elements so the reader can map differences to the
 * email content rather than the markup.
 */
export function htmlToPlainLines(html: string): string[] {
  if (!html) return [];
  let out = html;
  // Replace block-level closes with newlines so paragraphs split
  out = out.replace(/<\s*(\/p|\/div|\/li|\/h[1-6]|br\s*\/?|\/tr)\s*>/gi, "\n");
  // Strip everything else
  out = out.replace(/<[^>]*>/g, "");
  // Decode the most common entities
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return out
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter((line) => line.length > 0);
}

/** Compare two arrays of lines, return a diff with shared "context" merged. */
export function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  // LCS table
  const m = oldLines.length;
  const n = newLines.length;
  if (m === 0 && n === 0) return [];
  if (m === 0) return newLines.map((t) => ({ kind: "added" as const, text: t }));
  if (n === 0) return oldLines.map((t) => ({ kind: "removed" as const, text: t }));

  // For very long inputs, bail out to a coarse diff to avoid quadratic memory
  if (m * n > 200_000) {
    return [
      ...oldLines.map((t) => ({ kind: "removed" as const, text: t })),
      ...newLines.map((t) => ({ kind: "added" as const, text: t })),
    ];
  }

  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      lcs[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? lcs[i - 1][j - 1] + 1
        : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ kind: "context", text: oldLines[i - 1] });
      i--; j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      result.unshift({ kind: "removed", text: oldLines[i - 1] });
      i--;
    } else {
      result.unshift({ kind: "added", text: newLines[j - 1] });
      j--;
    }
  }
  while (i > 0) { result.unshift({ kind: "removed", text: oldLines[--i] }); }
  while (j > 0) { result.unshift({ kind: "added", text: newLines[--j] }); }
  return result;
}

/** Counts of added/removed lines for badges. */
export function diffStats(diff: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const d of diff) {
    if (d.kind === "added") added++;
    else if (d.kind === "removed") removed++;
  }
  return { added, removed };
}
