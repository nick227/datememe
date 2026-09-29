export type AttributeSide = 'IS' | 'SEEKING'

export function attributeKeys(rows: { key: string; side: string }[] | undefined, side: AttributeSide) {
  return (rows ?? []).filter((row) => row.side === side).map((row) => row.key)
}
