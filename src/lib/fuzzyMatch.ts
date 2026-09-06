// Typo-tolerant text matching for product search — lets "oroimo" still
// find "Oraimo" without a small typo accidentally pulling in unrelated
// products. No external library: this is a small, well-understood
// algorithm (edit distance) with a threshold that scales with word
// length, so a couple of swapped/missing letters on a longer word is
// forgiven, but short words still have to match closely (otherwise
// almost anything would "fuzzy match" almost anything else).

/** Classic Levenshtein edit distance — the minimum number of single-letter
 * insertions, deletions, or substitutions to turn `a` into `b`. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const dist: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i++) dist[i][0] = i
  for (let j = 0; j < cols; j++) dist[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1, // deletion
        dist[i][j - 1] + 1, // insertion
        dist[i - 1][j - 1] + cost, // substitution
      )
    }
  }
  return dist[rows - 1][cols - 1]
}

/** How many typo'd letters we forgive, based on how long the word is.
 * Short words (3 letters or fewer) get zero tolerance — "tv" fuzzy-matching
 * half the catalogue would make search worse, not better. */
function allowedTypos(length: number): number {
  if (length <= 3) return 0
  if (length <= 6) return 1
  return 2
}

/** True if `query` reasonably matches `text` — an exact substring match,
 * or a typo-tolerant match against one of `text`'s words. */
export function fuzzyIncludes(text: string, query: string): boolean {
  const haystack = text.toLowerCase()
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (haystack.includes(needle)) return true

  const words = haystack.split(/[\s\-/,]+/).filter(Boolean)
  for (const word of words) {
    // Cheap pre-filter before running the real (more expensive) distance
    // check — a word whose length is wildly different from the query
    // can't possibly be a close typo of it.
    if (Math.abs(word.length - needle.length) > 2) continue
    const tolerance = allowedTypos(Math.max(word.length, needle.length))
    if (tolerance === 0) continue
    if (editDistance(word, needle) <= tolerance) return true
  }
  return false
}
