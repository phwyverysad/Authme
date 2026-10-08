/**
 * Category-aware vault reordering algorithms.
 * Enables seamless reordering of 2FA accounts within any category filter
 * as well as the master "all" view, preserving relative ordering of other categories.
 */

/**
 * Reorders vault items based on the new order of items within the active category.
 *
 * @param items Array of items in the master vault
 * @param getItemCategory Function mapping an item to its category identifier
 * @param activeCategory The currently active category ("all" or a category id)
 * @param newCatOrderIndices Original vault indices of the category's items in their new relative order
 * @returns A new array with reordered items
 */
export function reorderCategoryVault<T>(
	items: T[],
	getItemCategory: (item: T) => string,
	activeCategory: string,
	newCatOrderIndices: number[]
): T[] {
	if (!items || items.length <= 1) return [...(items || [])]

	// Collect the master vault slots belonging to the active category
	const targetVaultSlots: number[] = []
	for (let i = 0; i < items.length; i++) {
		if (activeCategory === "all" || getItemCategory(items[i]) === activeCategory) {
			targetVaultSlots.push(i)
		}
	}

	if (targetVaultSlots.length <= 1 || newCatOrderIndices.length !== targetVaultSlots.length) {
		return [...items]
	}

	const result = [...items]
	for (let k = 0; k < targetVaultSlots.length; k++) {
		const targetSlot = targetVaultSlots[k]
		const sourceOrigIdx = newCatOrderIndices[k]
		result[targetSlot] = items[sourceOrigIdx]
	}

	return result
}

/**
 * Moves an item at currentVaultIndex relative to its siblings in the active category.
 *
 * @param items Array of items in the master vault
 * @param getItemCategory Function mapping an item to its category identifier
 * @param activeCategory The currently active category ("all" or a category id)
 * @param currentVaultIndex Master vault index of the item to move
 * @param direction -1 for up/previous, 1 for down/next
 * @returns A new array with reordered items
 */
export function moveCategoryItemRelative<T>(
	items: T[],
	getItemCategory: (item: T) => string,
	activeCategory: string,
	currentVaultIndex: number,
	direction: -1 | 1
): T[] {
	if (!items || items.length <= 1) return [...(items || [])]

	const catSlots: number[] = []
	for (let i = 0; i < items.length; i++) {
		if (activeCategory === "all" || getItemCategory(items[i]) === activeCategory) {
			catSlots.push(i)
		}
	}

	const posInCat = catSlots.indexOf(currentVaultIndex)
	if (posInCat === -1) return [...items]

	const targetPosInCat = posInCat + direction
	if (targetPosInCat < 0 || targetPosInCat >= catSlots.length) return [...items]

	const newOrder = [...catSlots]
	const temp = newOrder[posInCat]
	newOrder[posInCat] = newOrder[targetPosInCat]
	newOrder[targetPosInCat] = temp

	return reorderCategoryVault(items, getItemCategory, activeCategory, newOrder)
}
