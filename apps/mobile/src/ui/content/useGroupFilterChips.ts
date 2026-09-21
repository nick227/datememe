import { useCallback, useState } from 'react'

export const TOP_CHIP_ID = 'top'

/**
 * Shared multi-select "categories" chip state for Discover and Lists — both
 * feeds run the exact same groupSlugs OR-filter server-side (see
 * DiscoverFeedFilters/ListsFeedFilters in @project/sdk). Tapping "All"
 * clears the selection back to unfiltered; tapping any other group chip
 * toggles it in/out of the multi-select set, independent of the others.
 */
export function useGroupFilterChips() {
  const [selectedGroupSlugs, setSelectedGroupSlugs] = useState<string[]>([])

  const toggleGroup = useCallback((chipId: string) => {
    if (chipId === TOP_CHIP_ID) {
      setSelectedGroupSlugs([])
      return
    }
    setSelectedGroupSlugs((prev) => (prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]))
  }, [])

  return { selectedGroupSlugs, toggleGroup }
}
