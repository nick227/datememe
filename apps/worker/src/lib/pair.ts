export function canonicalizePair(id1: string, id2: string): [string, string] {
  return [id1, id2].sort() as [string, string]
}
