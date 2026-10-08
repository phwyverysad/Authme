import { textConverter } from "../../utils/convert"
import { TOTP } from "otpauth"
import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
import { getSettings, setSettings } from "../../stores/settings"
import { getState, setState } from "../../stores/state"
import { decryptData, encryptData, setEncryptionKey } from "interface/utils/encryption"
import logger from "interface/utils/logger"
import { getLanguage, language, currentLanguage } from "@utils/language"
import { getServiceIcon, fetchBrandIcon, getCachedIcon, normalizeCategory, extractPrefix, cleanAccountName } from "../../utils/icons"
import { getAccurateTimestamp } from "../../utils/timeSync"
import { writable } from "svelte/store"

export interface CodeCategory {
	id: string
	name: string
	count: number
	iconSvg?: string
	bg?: string
	isMonogram?: boolean
	monogramChar?: string
	iconUrl?: string
}

export const activeCodeCategory = writable<string>("all")
export const availableCodeCategories = writable<CodeCategory[]>([])
export const hasCodesStore = writable<boolean>(false)

// Keep category names synchronized with language store
currentLanguage.subscribe((curLang) => {
	if (!curLang) return
	if (typeof invalidateVaultCache === "function") {
		invalidateVaultCache()
	}
	availableCodeCategories.update((cats) => {
		return cats.map((c) => {
			if (c.id === "all") {
				return { ...c, name: curLang.codes?.allCategories || "All" }
			}
			if (c.id === "pinned") {
				return { ...c, name: curLang.codes?.pinnedCategory || "Pinned" }
			}
			return c
		})
	})
})

export { normalizeCategory }

let codesRefresher: NodeJS.Timeout
let searchQuery: LibSearchQuery[] = []
let saveText: string = ""

import { showToast, activeContextMenu } from "../../stores/dialog"
import { scheduleClipboardClear } from "../../utils/clipboardGuard"

const CIRCUMFERENCE = 106.81
let currentCodesData: LibImportFile = { names: [], secrets: [], issuers: [], uniqIds: [] }
let listenersInitialized = false
let cleanupCodeDrag: () => void = () => {}

let pinnedSecrets: Set<string> = new Set()
let pinnedSecretsLoaded = false

export const loadPinnedSecrets = () => {
	if (pinnedSecretsLoaded) return
	pinnedSecretsLoaded = true
	try {
		if (typeof localStorage !== "undefined") {
			const raw = localStorage.getItem("authme_pinned_secrets")
			if (raw) {
				const list = JSON.parse(raw)
				if (Array.isArray(list)) {
					pinnedSecrets = new Set(list.map((s: string) => s.replace(/[\s-]+/g, "").toUpperCase()))
				}
			}
		}
	} catch (e) {
		console.warn("Failed to load pinned secrets:", e)
	}
}

export const savePinnedSecrets = () => {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem("authme_pinned_secrets", JSON.stringify([...pinnedSecrets]))
		}
	} catch (e) {
		console.warn("Failed to save pinned secrets:", e)
	}
}

export const isCodePinned = (secret: string): boolean => {
	loadPinnedSecrets()
	const clean = (secret || "").replace(/[\s-]+/g, "").toUpperCase()
	return pinnedSecrets.has(clean)
}

export const sortPinnedCodesToTop = (codes: LibImportFile): LibImportFile => {
	if (!codes || !codes.names || codes.names.length <= 1) return codes
	loadPinnedSecrets()
	if (pinnedSecrets.size === 0) return codes

	let sawUnpinned = false
	let needsPartition = false
	for (let i = 0; i < codes.secrets.length; i++) {
		const isPinned = isCodePinned(codes.secrets[i])
		if (isPinned && sawUnpinned) {
			needsPartition = true
			break
		}
		if (!isPinned) {
			sawUnpinned = true
		}
	}

	if (!needsPartition) return codes

	const pinnedIndices: number[] = []
	const unpinnedIndices: number[] = []
	for (let i = 0; i < codes.secrets.length; i++) {
		if (isCodePinned(codes.secrets[i])) {
			pinnedIndices.push(i)
		} else {
			unpinnedIndices.push(i)
		}
	}

	const newOrder = [...pinnedIndices, ...unpinnedIndices]
	return {
		names: newOrder.map((idx) => codes.names[idx]),
		secrets: newOrder.map((idx) => codes.secrets[idx]),
		issuers: newOrder.map((idx) => codes.issuers[idx]),
		types: codes.types ? newOrder.map((idx) => codes.types![idx]) : undefined,
		uniqIds: codes.uniqIds ? newOrder.map((idx) => codes.uniqIds![idx]) : undefined,
	}
}

export const togglePinCodeAtIndex = async (index: number) => {
	if (!currentCodesData || currentCodesData.names[index] === undefined) return
	const cleanSecret = (currentCodesData.secrets[index] || "").replace(/[\s-]+/g, "").toUpperCase()
	loadPinnedSecrets()
	const currentlyPinned = pinnedSecrets.has(cleanSecret)

	if (!currentlyPinned) {
		pinnedSecrets.add(cleanSecret)
		savePinnedSecrets()

		const name = currentCodesData.names.splice(index, 1)[0]
		const secret = currentCodesData.secrets.splice(index, 1)[0]
		const issuer = currentCodesData.issuers.splice(index, 1)[0]
		const type = currentCodesData.types ? currentCodesData.types.splice(index, 1)[0] : undefined
		const uniqId = currentCodesData.uniqIds ? currentCodesData.uniqIds.splice(index, 1)[0] : undefined

		// Insert directly after the last pinned item
		let targetIndex = 0
		for (let j = 0; j < currentCodesData.secrets.length; j++) {
			const sec = (currentCodesData.secrets[j] || "").replace(/[\s-]+/g, "").toUpperCase()
			if (pinnedSecrets.has(sec)) {
				targetIndex = j + 1
			} else {
				break
			}
		}

		currentCodesData.names.splice(targetIndex, 0, name)
		currentCodesData.secrets.splice(targetIndex, 0, secret)
		currentCodesData.issuers.splice(targetIndex, 0, issuer)
		if (type && currentCodesData.types) currentCodesData.types.splice(targetIndex, 0, type)
		if (uniqId && currentCodesData.uniqIds) currentCodesData.uniqIds.splice(targetIndex, 0, uniqId)

		await saveUpdatedVault(currentCodesData)
		showToast(language.codes?.pinSuccess || "Pinned account to top", "success")
	} else {
		pinnedSecrets.delete(cleanSecret)
		savePinnedSecrets()

		// If there are remaining pinned items, move this unpinned item after them
		let lastPinnedIndex = -1
		for (let j = 0; j < currentCodesData.secrets.length; j++) {
			if (j !== index) {
				const sec = (currentCodesData.secrets[j] || "").replace(/[\s-]+/g, "").toUpperCase()
				if (pinnedSecrets.has(sec)) {
					lastPinnedIndex = j
				}
			}
		}
		if (lastPinnedIndex >= index) {
			const name = currentCodesData.names.splice(index, 1)[0]
			const secret = currentCodesData.secrets.splice(index, 1)[0]
			const issuer = currentCodesData.issuers.splice(index, 1)[0]
			const type = currentCodesData.types ? currentCodesData.types.splice(index, 1)[0] : undefined
			const uniqId = currentCodesData.uniqIds ? currentCodesData.uniqIds.splice(index, 1)[0] : undefined

			currentCodesData.names.splice(lastPinnedIndex, 0, name)
			currentCodesData.secrets.splice(lastPinnedIndex, 0, secret)
			currentCodesData.issuers.splice(lastPinnedIndex, 0, issuer)
			if (type && currentCodesData.types) currentCodesData.types.splice(lastPinnedIndex, 0, type)
			if (uniqId && currentCodesData.uniqIds) currentCodesData.uniqIds.splice(lastPinnedIndex, 0, uniqId)
		}

		await saveUpdatedVault(currentCodesData)
		showToast(language.codes?.unpinSuccess || "Unpinned account", "info")
	}

	generateCodeElements(currentCodesData)
	search()
}

if (typeof window !== "undefined" && !listenersInitialized) {
	listenersInitialized = true

	window.addEventListener("authme:themechange", (e: any) => {
		const isDark = !e.detail?.isLight
		const container = getCodesContainer()
		if (container && currentCodesData?.names) {
			for (let i = 0; i < currentCodesData.names.length; i++) {
				const iconData = getServiceIcon(currentCodesData.issuers[i], currentCodesData.names[i], isDark)
				const bgDiv = container.querySelector(`#brandIconContainer${i}`) as HTMLElement | null
				const innerDiv = container.querySelector(`#brandIconInner${i}`) as HTMLElement | null
				if (bgDiv) bgDiv.style.cssText = iconData.bg
				if (innerDiv) innerDiv.innerHTML = iconData.svg
			}
		}

		availableCodeCategories.update((cats) => {
			return cats.map((c) => {
				if (c.id === "all") return c
				const iconInfo = getServiceIcon(c.name, "", isDark)
				return {
					...c,
					iconSvg: iconInfo.svg,
					bg: iconInfo.bg,
				}
			})
		})
	})

	window.addEventListener("authme:iconloaded", (e: any) => {
		const { slug, isDark, svg } = e.detail || {}
		if (!slug || !svg) return
		const container = getCodesContainer()
		if (container && currentCodesData?.names) {
			for (let i = 0; i < currentCodesData.names.length; i++) {
				const cat = normalizeCategory(currentCodesData.issuers[i], currentCodesData.names[i])
				if (cat.id === slug) {
					const iconData = getServiceIcon(currentCodesData.issuers[i], currentCodesData.names[i], isDark)
					const bgDiv = container.querySelector(`#brandIconContainer${i}`) as HTMLElement | null
					const innerDiv = container.querySelector(`#brandIconInner${i}`) as HTMLElement | null
					if (bgDiv) bgDiv.style.cssText = iconData.bg
					if (innerDiv) innerDiv.innerHTML = iconData.svg
				}
			}
		}

		availableCodeCategories.update((cats) => {
			return cats.map((c) => {
				if (c.id === slug) {
					return { ...c, iconSvg: svg, isMonogram: false }
				}
				return c
			})
		})
	})
}

interface CodeItemRef {
	code: HTMLElement
	circle: SVGElement
	countdown: HTMLElement | null
	ringContainer: HTMLElement | null
	secret: string
}
let activeCodeRefs: CodeItemRef[] = []
let lastTotpStep = -1
let lastRemainingSeconds = -1

export const formatToken = (token: string): string => {
	if (!token) return ""
	if (token.length === 6) {
		return `${token.slice(0, 3)} ${token.slice(3)}`
	} else if (token.length === 8) {
		return `${token.slice(0, 4)} ${token.slice(4)}`
	}
	return token
}

export const getCodesContainer = (): HTMLElement | null => {
	return document.querySelector(".codes-content") || document.querySelector(".codes-page .content") || document.querySelector(".content")
}

export const generateCodeElements = (codes: LibImportFile) => {
	const partitioned = sortPinnedCodesToTop(codes)
	currentCodesData = partitioned
	const names = partitioned.names
	const secrets = partitioned.secrets
	const issuers = partitioned.issuers

	// Reset cached refs & step tracking for ultra-smooth 2FA performance
	activeCodeRefs = []
	lastTotpStep = -1
	lastRemainingSeconds = -1

	// Clear any previous code elements specifically from codes container
	getCodesContainer()?.querySelectorAll(".code").forEach((el) => el.remove())
	searchQuery = []

	if (codesRefresher) {
		clearInterval(codesRefresher)
	}

	const pageEl = document.querySelector(".codes-page") || document
	const importEl = pageEl.querySelector(".importCodes") as HTMLElement | null
	const searchEl = pageEl.querySelector(".codesSearchContainer, .searchContainer") as HTMLElement | null

	if (!names || names.length === 0) {
		hasCodesStore.set(false)
		availableCodeCategories.set([])
		if (importEl) importEl.style.display = "block"
		if (searchEl) searchEl.style.display = "none"
		return
	}
	hasCodesStore.set(true)

	// Dynamically build available categories
	const catCounts: Record<string, { name: string; count: number }> = {}
	let pinnedCount = 0
	for (let i = 0; i < names.length; i++) {
		if (isCodePinned(secrets[i])) {
			pinnedCount++
		}
		const cat = normalizeCategory(issuers[i], names[i])
		if (!catCounts[cat.id]) {
			catCounts[cat.id] = { name: cat.name, count: 0 }
		}
		catCounts[cat.id].count++
	}

	const catList: CodeCategory[] = [
		{ id: "all", name: language.codes?.allCategories || "All", count: names.length },
	]

	if (pinnedCount > 0) {
		catList.push({
			id: "pinned",
			name: language.codes?.pinnedCategory || "Pinned",
			count: pinnedCount,
			iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5 text-amber-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
			bg: "background: rgba(245, 158, 11, 0.15);",
			isMonogram: false,
		})
	}

	const sortedEntries = Object.entries(catCounts).sort((a, b) => b[1].count - a[1].count)
	for (const [id, data] of sortedEntries) {
		const iconInfo = getServiceIcon(data.name, "")
		const cached = getCachedIcon(data.name)
		catList.push({
			id,
			name: data.name,
			count: data.count,
			iconSvg: iconInfo.svg,
			bg: iconInfo.bg,
			isMonogram: iconInfo.isMonogram,
			monogramChar: data.name.charAt(0).toUpperCase(),
			iconUrl: cached || undefined,
		})

		// Fetch authentic brand icon in background if not cached yet
		if (!cached && iconInfo.isMonogram) {
			fetchBrandIcon(data.name).then((svg) => {
				if (svg) {
					availableCodeCategories.update((cats) => {
						return cats.map((c) => (c.id === id ? { ...c, iconSvg: svg, isMonogram: false } : c))
					})
				}
			})
		}
	}
	availableCodeCategories.set(catList)

	if (importEl) importEl.style.display = "none"
	if (searchEl) searchEl.style.display = "flex"

	const contentEl = getCodesContainer()
	if (contentEl && !(contentEl as any).__authme_delegated) {
		;(contentEl as any).__authme_delegated = true
		contentEl.addEventListener("contextmenu", (e: Event) => {
			const me = e as MouseEvent
			const card = (me.target as HTMLElement)?.closest(".code") as HTMLElement | null
			if (card) {
				me.preventDefault()
				me.stopPropagation()
				const idx = parseInt(card.getAttribute("data-index") || card.getAttribute("id")?.replace("codes", "") || "", 10)
				if (!isNaN(idx) && currentCodesData?.names?.[idx] !== undefined) {
					const codeElem = card.querySelector(`[id^="code"]`)
					const currentToken = codeElem?.getAttribute("data-raw") || codeElem?.textContent?.replace(/\s+/g, "") || ""
					const curIssuer = currentCodesData.issuers[idx] || ""
					const curName = cleanAccountName(currentCodesData.names[idx] || "", curIssuer)
					activeContextMenu.set({
						x: me.clientX,
						y: me.clientY,
						index: idx,
						issuer: curIssuer,
						name: curName,
						secret: currentCodesData.secrets[idx] || "",
						token: currentToken,
					})
				}
			}
		})
	}

	const triggerCopy = (i: number, rawToken: string) => {
		clipboard.writeText(rawToken)
		scheduleClipboardClear(rawToken)

		const codeElem = document.querySelector(`#code${i}`)
		const cardElem = document.querySelector(`#codes${i}`)

		if (codeElem) {
			codeElem.classList.add("text-emerald-500")
		}
		if (cardElem) {
			cardElem.classList.add("ring-2", "ring-emerald-500/50")
		}

		const primaryTitle = (issuers[i] || "").trim() || (names[i] || "").trim() || "2FA"
		showToast(`${language.common.copied}: ${primaryTitle} (${formatToken(rawToken)})`, "success")

		setTimeout(() => {
			if (codeElem) {
				codeElem.classList.remove("text-emerald-500")
			}
			if (cardElem) {
				cardElem.classList.remove("ring-2", "ring-emerald-500/50")
			}
		}, 800)
	}

	let isDraggingCode = false
	let codeDragJustEnded = false
	let codeDownX = 0
	let codeDownY = 0
	let codeGrabOffsetX = 0
	let codeGrabOffsetY = 0
	let lastCodePointerX = 0
	let activeFloatingCodeClone: HTMLElement | null = null
	let draggedCard: HTMLElement | null = null
	let pendingDragCard: HTMLElement | null = null
	let dragPointerId: number | null = null
	let dragIsFromHandle = false
	let lastPlaceholderMoveTime = 0

	const startCodeDrag = (card: HTMLElement, clientX: number, clientY: number) => {
		const searchBar = document.querySelector<HTMLInputElement>(".search")
		if (searchBar && searchBar.value.trim() !== "") return

		const container = getCodesContainer()
		if (!container) return

		let currentCat = "all"
		activeCodeCategory.subscribe((v) => (currentCat = v))()

		const visibleCards = Array.from(container.querySelectorAll<HTMLElement>(".code")).filter((c) => {
			if (c.style.display === "none") return false
			if (currentCat === "all") return true
			if (currentCat === "pinned") return c.getAttribute("data-pinned") === "true"
			return (c.getAttribute("data-category") || "other") === currentCat
		})

		if (visibleCards.length <= 1) return

		isDraggingCode = true
		codeDragJustEnded = true
		draggedCard = card

		if (dragPointerId !== null) {
			try {
				card.setPointerCapture(dragPointerId)
			} catch {}
		}

		const rect = card.getBoundingClientRect()
		if (codeGrabOffsetX === 0 && codeGrabOffsetY === 0) {
			codeGrabOffsetX = clientX - rect.left
			codeGrabOffsetY = clientY - rect.top
		}
		lastCodePointerX = clientX

		// Create floating clone
		const clone = card.cloneNode(true) as HTMLElement
		clone.id = "active_code_floating_avatar"
		clone.className = "code code-drag-floating select-none pointer-events-none"
		clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"))
		clone.style.width = `${rect.width}px`
		clone.style.height = `${rect.height}px`
		clone.style.left = "0px"
		clone.style.top = "0px"
		clone.style.transition = "none"
		clone.style.transform = `translate3d(${clientX - codeGrabOffsetX}px, ${clientY - codeGrabOffsetY}px, 0) scale(1.03)`

		document.body.appendChild(clone)
		activeFloatingCodeClone = clone

		// Set placeholder styling on card in grid
		card.classList.add("code-drag-placeholder")

		document.body.classList.add("cursor-grabbing", "select-none", "is-dragging-code")
	}

	const movePlaceholder = (placeholder: HTMLElement, insertBeforeNode: Node | null, visibleCards: HTMLElement[]) => {
		const container = getCodesContainer()
		if (!container) return

		const now = Date.now()
		if (now - lastPlaceholderMoveTime < 130) return
		lastPlaceholderMoveTime = now

		// 1. Reset in-flight transforms on siblings to guarantee accurate layout measurements
		for (const card of visibleCards) {
			if (card !== placeholder) {
				card.style.transition = ""
				card.style.transform = ""
			}
		}

		// 2. Record initial clean bounding boxes of visible sibling cards (First)
		const firstRects = new Map<HTMLElement, DOMRect>()
		for (const card of visibleCards) {
			if (card !== placeholder) {
				firstRects.set(card, card.getBoundingClientRect())
			}
		}

		// 3. Move placeholder DOM node
		if (insertBeforeNode) {
			container.insertBefore(placeholder, insertBeforeNode)
		} else {
			const lastCard = visibleCards[visibleCards.length - 1]
			if (lastCard && lastCard !== placeholder) {
				container.insertBefore(placeholder, lastCard.nextSibling)
			} else {
				container.appendChild(placeholder)
			}
		}

		// 4. Record new positions (Last) and animate siblings smoothly with magnetic snap
		for (const card of visibleCards) {
			if (card === placeholder) continue
			const first = firstRects.get(card)
			if (first) {
				const last = card.getBoundingClientRect()
				const dx = first.left - last.left
				const dy = first.top - last.top
				if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
					card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
					card.style.transition = "none"
					void card.offsetWidth // Force reflow so inverted position registers immediately
					requestAnimationFrame(() => {
						card.style.transition = "transform 180ms cubic-bezier(0.25, 1, 0.5, 1)"
						card.style.transform = "translate3d(0, 0, 0)"
					})
					setTimeout(() => {
						if (card !== placeholder) {
							card.style.transition = ""
							card.style.transform = ""
						}
					}, 190)
				}
			}
		}
	}

	const onWindowCodePointerMove = (e: PointerEvent) => {
		if (!isDraggingCode && pendingDragCard) {
			const dist = Math.hypot(e.clientX - codeDownX, e.clientY - codeDownY)
			const threshold = dragIsFromHandle ? 4 : 24
			if (dist >= threshold) {
				startCodeDrag(pendingDragCard, e.clientX, e.clientY)
			}
		}

		if (isDraggingCode && activeFloatingCodeClone && draggedCard) {
			e.preventDefault()

			// 1. Move floating clone with dynamic velocity tilt (zero-lag tracking)
			const vx = e.clientX - lastCodePointerX
			lastCodePointerX = e.clientX
			const tilt = Math.max(-4, Math.min(4, vx * 0.12))
			activeFloatingCodeClone.style.transition = "none"
			activeFloatingCodeClone.style.transform = `translate3d(${e.clientX - codeGrabOffsetX}px, ${e.clientY - codeGrabOffsetY}px, 0) scale(1.03) rotate(${tilt}deg)`

			// 2. Smooth edge scrolling
			if (e.clientY < 90) {
				window.scrollBy({ top: -14, behavior: "auto" })
				const scrollContainer = document.querySelector(".overflow-y-auto") as HTMLElement | null
				if (scrollContainer) scrollContainer.scrollTop -= 14
			} else if (e.clientY > window.innerHeight - 90) {
				window.scrollBy({ top: 14, behavior: "auto" })
				const scrollContainer = document.querySelector(".overflow-y-auto") as HTMLElement | null
				if (scrollContainer) scrollContainer.scrollTop += 14
			}

			// 3. Deliberate slot matching with hysteresis (prevents erratic / rapid swapping)
			const container = getCodesContainer()
			if (!container) return

			let currentCat = "all"
			activeCodeCategory.subscribe((v) => (currentCat = v))()

			const visibleCards = Array.from(container.querySelectorAll<HTMLElement>(".code")).filter((c) => {
				if (currentCat === "all") return c.style.display !== "none"
				return (c.getAttribute("data-category") || "other") === currentCat && c.style.display !== "none"
			})

			if (visibleCards.length <= 1) return

			const placeholderIdx = visibleCards.indexOf(draggedCard)
			if (placeholderIdx === -1) return

			// Extreme boundary checks: way above first or way below last card
			const firstRect = visibleCards[0].getBoundingClientRect()
			const lastRect = visibleCards[visibleCards.length - 1].getBoundingClientRect()

			if (e.clientY < firstRect.top - 25) {
				if (placeholderIdx !== 0) {
					movePlaceholder(draggedCard, visibleCards[0], visibleCards)
				}
				return
			} else if (e.clientY > lastRect.bottom + 25) {
				if (placeholderIdx !== visibleCards.length - 1) {
					movePlaceholder(draggedCard, null, visibleCards)
				}
				return
			}

			const phRect = draggedCard.getBoundingClientRect()

			for (let i = 0; i < visibleCards.length; i++) {
				const card = visibleCards[i]
				if (card === draggedCard) continue

				const r = card.getBoundingClientRect()
				// Cursor must be physically inside target card
				if (
					e.clientX >= r.left &&
					e.clientX <= r.right &&
					e.clientY >= r.top &&
					e.clientY <= r.bottom
				) {
					const isSameRow = Math.abs(phRect.top - r.top) < 35
					let insertBeforeNode: Node | null = null

					if (placeholderIdx < i) {
						// Moving forward in grid:
						// If same row, cursor must cross 35% from left; if lower row, cursor must cross 35% from top
						const ready = isSameRow
							? e.clientX > r.left + r.width * 0.35
							: e.clientY > r.top + r.height * 0.35

						if (ready) {
							insertBeforeNode = card.nextSibling
						}
					} else {
						// Moving backward in grid:
						// If same row, cursor must cross 35% from right; if higher row, cursor must cross 35% from bottom
						const ready = isSameRow
							? e.clientX < r.right - r.width * 0.35
							: e.clientY < r.bottom - r.height * 0.35

						if (ready) {
							insertBeforeNode = card
						}
					}

					if (insertBeforeNode && insertBeforeNode !== draggedCard && insertBeforeNode !== draggedCard.nextSibling) {
						movePlaceholder(draggedCard, insertBeforeNode, visibleCards)
					}
					break
				}
			}
		}
	}

	const onWindowCodePointerUp = async () => {
		window.removeEventListener("pointermove", onWindowCodePointerMove)
		window.removeEventListener("pointerup", onWindowCodePointerUp)
		window.removeEventListener("pointercancel", onWindowCodePointerUp)

		if (pendingDragCard && dragPointerId !== null) {
			try {
				pendingDragCard.releasePointerCapture(dragPointerId)
			} catch {}
		}
		dragPointerId = null
		pendingDragCard = null
		codeGrabOffsetX = 0
		codeGrabOffsetY = 0

		if (isDraggingCode && draggedCard) {
			const card = draggedCard
			const clone = activeFloatingCodeClone

			if (clone) {
				const destRect = card.getBoundingClientRect()
				clone.style.transition = "transform 160ms cubic-bezier(0.25, 1, 0.5, 1), opacity 160ms ease"
				clone.style.transform = `translate3d(${destRect.left}px, ${destRect.top}px, 0) scale(1) rotate(0deg)`

				setTimeout(() => {
					clone.remove()
					card.classList.remove("code-drag-placeholder")
					card.classList.add("code-drop-settle")
					setTimeout(() => {
						card.classList.remove("code-drop-settle")
					}, 350)
				}, 160)
			} else {
				card.classList.remove("code-drag-placeholder")
			}

			activeFloatingCodeClone = null
			isDraggingCode = false
			draggedCard = null
			document.body.classList.remove("cursor-grabbing", "select-none", "is-dragging-code")

			await commitReorder()

			const container = getCodesContainer()
			if (container) {
				container.querySelectorAll<HTMLElement>(".code").forEach((el) => {
					el.style.transform = ""
					el.style.transition = ""
				})
			}

			setTimeout(() => {
				codeDragJustEnded = false
			}, 250)
		} else {
			isDraggingCode = false
			draggedCard = null
			if (activeFloatingCodeClone) {
				activeFloatingCodeClone.remove()
				activeFloatingCodeClone = null
			}
			document.body.classList.remove("cursor-grabbing", "select-none", "is-dragging-code")
		}
	}

	cleanupCodeDrag = () => {
		if (typeof window !== "undefined") {
			window.removeEventListener("pointermove", onWindowCodePointerMove)
			window.removeEventListener("pointerup", onWindowCodePointerUp)
			window.removeEventListener("pointercancel", onWindowCodePointerUp)
		}
		if (activeFloatingCodeClone) {
			activeFloatingCodeClone.remove()
			activeFloatingCodeClone = null
		}
		if (draggedCard) {
			draggedCard.classList.remove("code-drag-placeholder")
			draggedCard = null
		}
		isDraggingCode = false
		pendingDragCard = null
		if (typeof document !== "undefined") {
			document.body.classList.remove("cursor-grabbing", "select-none", "is-dragging-code")
		}
	}

	const updateCardIndices = (card: HTMLElement, newIdx: number) => {
		card.id = `codes${newIdx}`
		card.setAttribute("data-index", String(newIdx))

		const dragHandle = card.querySelector('[id^="dragHandle"]')
		if (dragHandle) dragHandle.id = `dragHandle${newIdx}`

		const brandContainer = card.querySelector('[id^="brandIconContainer"]')
		if (brandContainer) brandContainer.id = `brandIconContainer${newIdx}`

		const brandInner = card.querySelector('[id^="brandIconInner"]')
		if (brandInner) brandInner.id = `brandIconInner${newIdx}`

		const nameEl = card.querySelector('[id^="name"]')
		if (nameEl) nameEl.id = `name${newIdx}`

		const descEl = card.querySelector('[id^="description"]')
		if (descEl) descEl.id = `description${newIdx}`

		const codeEl = card.querySelector('[id^="code"]')
		if (codeEl) codeEl.id = `code${newIdx}`

		const ringContainer = card.querySelector('[id^="ringContainer"]')
		if (ringContainer) ringContainer.id = `ringContainer${newIdx}`

		const circleEl = card.querySelector('[id^="circle"]')
		if (circleEl) circleEl.id = `circle${newIdx}`

		const countdownEl = card.querySelector('[id^="countdown"]')
		if (countdownEl) countdownEl.id = `countdown${newIdx}`

		const starBtn = card.querySelector('[id^="starBtn"]')
		if (starBtn) starBtn.id = `starBtn${newIdx}`

		const moreBtn = card.querySelector('[id^="moreBtn"]')
		if (moreBtn) moreBtn.id = `moreBtn${newIdx}`
	}

	const commitReorder = async () => {
		const container = getCodesContainer()
		if (!container || !currentCodesData?.names) return

		const allCards = Array.from(container.querySelectorAll<HTMLElement>(".code"))
		if (allCards.length === 0) return

		let currentCat = "all"
		activeCodeCategory.subscribe((v) => (currentCat = v))()

		const categoryCards = allCards.filter((c) => {
			if (currentCat === "all") return true
			if (currentCat === "pinned") return c.getAttribute("data-pinned") === "true"
			return (c.getAttribute("data-category") || "other") === currentCat
		})

		if (categoryCards.length <= 1) return

		// Vault indices of category cards in their new order
		const sourceVaultIndices = categoryCards.map((c) => parseInt(c.getAttribute("data-index") || "0", 10))
		const targetVaultSlots = [...sourceVaultIndices].sort((a, b) => a - b)

		const hasChanged = sourceVaultIndices.some((idx, i) => idx !== targetVaultSlots[i])
		if (!hasChanged) return

		const n = currentCodesData.names.length
		const newNames = [...currentCodesData.names]
		const newSecrets = [...currentCodesData.secrets]
		const newIssuers = [...currentCodesData.issuers]
		const newTypes = currentCodesData.types ? [...currentCodesData.types] : undefined
		const newUniqIds = currentCodesData.uniqIds ? [...currentCodesData.uniqIds] : undefined
		const newRefs = [...activeCodeRefs]
		const newQuery = [...searchQuery]

		const slotToSource = new Map<number, number>()
		for (let i = 0; i < targetVaultSlots.length; i++) {
			const slot = targetVaultSlots[i]
			const source = sourceVaultIndices[i]
			slotToSource.set(slot, source)

			newNames[slot] = currentCodesData.names[source]
			newSecrets[slot] = currentCodesData.secrets[source]
			newIssuers[slot] = currentCodesData.issuers[source]
			if (newTypes && currentCodesData.types) newTypes[slot] = currentCodesData.types[source]
			if (newUniqIds && currentCodesData.uniqIds) newUniqIds[slot] = currentCodesData.uniqIds[source]
			if (newRefs[slot] && activeCodeRefs[source]) newRefs[slot] = activeCodeRefs[source]
			if (newQuery[slot] && searchQuery[source]) newQuery[slot] = searchQuery[source]
		}

		currentCodesData.names = newNames
		currentCodesData.secrets = newSecrets
		currentCodesData.issuers = newIssuers
		if (newTypes) currentCodesData.types = newTypes
		if (newUniqIds) currentCodesData.uniqIds = newUniqIds
		activeCodeRefs = newRefs
		searchQuery = newQuery

		const cardByOrigIndex = new Map<number, HTMLElement>()
		for (const card of allCards) {
			const origIdx = parseInt(card.getAttribute("data-index") || "0", 10)
			cardByOrigIndex.set(origIdx, card)
		}

		for (let slot = 0; slot < n; slot++) {
			const source = slotToSource.has(slot) ? slotToSource.get(slot)! : slot
			const card = cardByOrigIndex.get(source)
			if (card) {
				container.appendChild(card)
				updateCardIndices(card, slot)
			}
		}

		await saveUpdatedVault(currentCodesData)

		const curSettings = getSettings()
		if (curSettings.settings.sortCodes !== 0) {
			curSettings.settings.sortCodes = 0
			setSettings(curSettings)
		}
	}

	const moveCardRelative = async (card: HTMLElement, direction: -1 | 1) => {
		const container = getCodesContainer()
		if (!container) return

		let currentCat = "all"
		activeCodeCategory.subscribe((v) => (currentCat = v))()

		const visibleCards = Array.from(container.querySelectorAll<HTMLElement>(".code")).filter((c) => {
			if (c.style.display === "none") return false
			if (currentCat === "all") return true
			if (currentCat === "pinned") return c.getAttribute("data-pinned") === "true"
			return (c.getAttribute("data-category") || "other") === currentCat
		})

		const idx = visibleCards.indexOf(card)
		if (idx === -1) return

		const targetIdx = idx + direction
		if (targetIdx < 0 || targetIdx >= visibleCards.length) return

		const targetCard = visibleCards[targetIdx]

		const firstCardRect = card.getBoundingClientRect()
		const firstTargetRect = targetCard.getBoundingClientRect()

		if (direction < 0) {
			container.insertBefore(card, targetCard)
		} else {
			container.insertBefore(card, targetCard.nextSibling)
		}

		const lastCardRect = card.getBoundingClientRect()
		const lastTargetRect = targetCard.getBoundingClientRect()

		const dx1 = firstCardRect.left - lastCardRect.left
		const dy1 = firstCardRect.top - lastCardRect.top
		const dx2 = firstTargetRect.left - lastTargetRect.left
		const dy2 = firstTargetRect.top - lastTargetRect.top

		card.style.transform = `translate3d(${dx1}px, ${dy1}px, 0)`
		card.style.transition = "none"
		targetCard.style.transform = `translate3d(${dx2}px, ${dy2}px, 0)`
		targetCard.style.transition = "none"

		requestAnimationFrame(() => {
			card.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)"
			card.style.transform = ""
			targetCard.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)"
			targetCard.style.transform = ""
		})

		await commitReorder()
		card.focus()
	}

	const generate = () => {
		const fragment = document.createDocumentFragment()
		for (let i = 0; i < names.length; i++) {
			const element = document.createElement("div")
			const iconData = getServiceIcon(issuers[i], names[i])
			const cat = normalizeCategory(issuers[i], names[i])

			let token = "------"
			const cleanSecret = (secrets[i] || "").replace(/[\s-]+/g, "").toUpperCase()
			try {
				token = new TOTP({
					secret: cleanSecret,
				}).generate({ timestamp: getAccurateTimestamp() })
			} catch (err) {
				logger.warn(`Failed to generate TOTP code at index ${i}: ${err}`)
			}

			const nowMs = getAccurateTimestamp()
			const remainingTime = 30 - Math.floor((nowMs / 1000.0) % 30)
			const offset = (CIRCUMFERENCE * (1 - remainingTime / 30)).toFixed(2)
			const ringColor = remainingTime <= 5 ? "#ef4444" : "#0284c7"

			let rawIssuer = (issuers[i] || "").trim()
			let rawName = (names[i] || "").trim()

			const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

			// Field swap detection: if issuer is an email but name is a brand/title, swap them for clean display
			if (isEmail(rawIssuer) && rawName && !isEmail(rawName)) {
				const tmp = rawIssuer
				rawIssuer = rawName
				rawName = tmp
			}

			// Smart display logic:
			let primaryTitle = rawIssuer
			let secondarySubtitle = cleanAccountName(rawName, rawIssuer)

			if (!primaryTitle && rawName) {
				const prefix = extractPrefix(rawName)
				if (prefix && prefix !== rawName) {
					primaryTitle = prefix
					const remainder = cleanAccountName(rawName.slice(prefix.length), prefix)
					secondarySubtitle = remainder || cleanAccountName(rawName)
				} else {
					primaryTitle = rawName
					secondarySubtitle = ""
				}
			} else if (primaryTitle && secondarySubtitle) {
				secondarySubtitle = cleanAccountName(secondarySubtitle, primaryTitle)
				if (primaryTitle.toLowerCase() === secondarySubtitle.toLowerCase()) {
					secondarySubtitle = ""
				}
			}

			if (!primaryTitle) {
				primaryTitle = secondarySubtitle || "2FA Service"
				secondarySubtitle = ""
			}

			const isPinned = isCodePinned(cleanSecret)

			element.innerHTML = `
			<div class="flex flex-row items-center justify-between gap-2 sm:gap-2.5 w-full pointer-events-none">
				<!-- Brand Icon -->
				<div id="brandIconContainer${i}" class="flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shadow-sm overflow-hidden select-none transition-transform duration-200 group-hover:scale-105" style="${iconData.bg}">
					<div id="brandIconInner${i}" class="w-full h-full flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7 sm:[&>svg]:w-8 sm:[&>svg]:h-8 [&>svg]:max-w-[70%] [&>svg]:max-h-[70%]">
						${iconData.svg}
					</div>
				</div>

				<!-- Info Stack: Issuer, Account/Email, TOTP Code -->
				<div class="flex flex-col justify-center flex-grow min-w-0 text-left pl-1.5 sm:pl-2">
					<p id="name${i}" class="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate w-full" title="${primaryTitle}">
						${primaryTitle}
					</p>
					${secondarySubtitle ? `
					<p id="description${i}" class="text-[11px] sm:text-xs font-normal text-slate-500 dark:text-slate-400 [overflow-wrap:anywhere] break-all leading-tight w-full select-text" title="${secondarySubtitle}">
						${secondarySubtitle}
					</p>` : ""}
					<p
						id="code${i}"
						class="font-mono text-xl sm:text-2xl card2:text-3xl font-extrabold tracking-normal sm:tracking-wide text-slate-900 dark:text-white mt-0.5 select-none pointer-events-none transition-colors duration-150 active:scale-95 whitespace-nowrap"
						style="font-variant-numeric: tabular-nums;"
						title="${language.common.copy}"
						data-raw="${token}"
					>
						${formatToken(token)}
					</p>
				</div>

				<!-- Right Side: Action Stack -->
				<div class="flex-shrink-0 flex flex-col items-end justify-between self-stretch pointer-events-auto py-0.5 min-h-[64px]">
					<!-- Top-Right: Star Pin Button -->
					<button
						type="button"
						id="starBtn${i}"
						class="star-btn w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 focus:outline-none cursor-pointer ${
							isPinned
								? 'text-amber-400 bg-amber-400/15 dark:bg-amber-400/20 border border-amber-400/40 shadow-xs'
								: 'text-slate-400 hover:text-amber-400 dark:text-slate-500 dark:hover:text-amber-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
						}"
						title="${isPinned ? (language.codes?.unpin || 'Unpin from top') : (language.codes?.pinToTop || 'Pin to top')}"
					>
						${
							isPinned
								? `<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400 drop-shadow-xs pointer-events-none" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
								: `<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
						}
					</button>

					<!-- Bottom Row: Countdown Ring, Drag Grip Handle & More Options -->
					<div class="flex items-center gap-1 sm:gap-1.5 mt-auto">
						<div id="ringContainer${i}" class="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center select-none" title="${remainingTime}${language.codes?.countdownTooltip || 's remaining'}">
							<svg class="w-7 h-7 sm:w-8 sm:h-8 transform -rotate-90 pointer-events-none" viewBox="0 0 44 44">
								<circle
									cx="22"
									cy="22"
									r="17"
									class="stroke-slate-200/80 dark:stroke-slate-700/60"
									stroke-width="3"
									fill="none"
								/>
								<circle
									id="circle${i}"
									cx="22"
									cy="22"
									r="17"
									stroke="${ringColor}"
									stroke-width="3"
									stroke-linecap="round"
									stroke-dasharray="${CIRCUMFERENCE}"
									stroke-dashoffset="${offset}"
									fill="none"
									class="transition-all duration-300 ease-linear"
								/>
							</svg>
							<!-- Clean, modern countdown seconds indicator -->
							<span
								id="countdown${i}"
								class="absolute flex items-baseline justify-center select-none pointer-events-none ${remainingTime <= 5 ? 'text-rose-500 font-bold animate-pulse' : 'text-slate-500 dark:text-slate-300 font-semibold'}"
								style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-variant-numeric: tabular-nums;"
							>
								<span class="text-[10px] sm:text-[11px] leading-none tracking-tight">${remainingTime}</span><span class="text-[8px] leading-none opacity-50 ml-[0.5px] font-normal">s</span>
							</span>
						</div>

						<!-- Dedicated Drag Grip Handle -->
						<div
							id="dragHandle${i}"
							class="drag-handle w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 cursor-grab active:cursor-grabbing transition-all select-none flex-shrink-0"
							style="touch-action: none;"
							title="${language.codes?.dragHandleTooltip || 'Drag to reorder'}"
						>
							<svg class="w-3.5 h-3.5 pointer-events-none opacity-70 group-hover:opacity-100" viewBox="0 0 24 24" fill="currentColor">
								<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
								<circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
								<circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
							</svg>
						</div>

						<!-- Three Dots Menu Button -->
						<button
							type="button"
							id="moreBtn${i}"
							class="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-all active:scale-90 focus:outline-none cursor-pointer"
							title="${language.common.moreOptions} ${language.codes?.rightClickHint || ''}"
						>
							<svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
								<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
			`

			element.classList.add("code", "group", "cursor-pointer", "hover:scale-[1.01]", "select-none", "relative")
			if (isPinned) {
				element.classList.add("code-pinned")
			}
			element.setAttribute("id", `codes${i}`)
			element.setAttribute("data-index", String(i))
			element.setAttribute("data-category", cat.id)
			element.setAttribute("data-pinned", isPinned ? "true" : "false")
			element.setAttribute("tabindex", "0")
			element.setAttribute("draggable", "false")
			element.style.touchAction = "none"

			element.addEventListener("pointerdown", (e: PointerEvent) => {
				if (e.button !== 0) return
				const target = e.target as HTMLElement | null
				if (target?.closest("button") || target?.closest(".moreBtn") || target?.closest('[id^="moreBtn"]')) return

				const searchBar = document.querySelector<HTMLInputElement>(".search")
				if (searchBar && searchBar.value.trim() !== "") return

				// Only allow drag reordering from the dedicated drag handle (6 dots icon)
				const isHandle = !!target?.closest(".drag-handle")
				if (!isHandle) return
				dragIsFromHandle = true

				codeDownX = e.clientX
				codeDownY = e.clientY
				lastCodePointerX = e.clientX
				pendingDragCard = element
				dragPointerId = e.pointerId

				const rect = element.getBoundingClientRect()
				codeGrabOffsetX = e.clientX - rect.left
				codeGrabOffsetY = e.clientY - rect.top

				window.addEventListener("pointermove", onWindowCodePointerMove, { passive: false })
				window.addEventListener("pointerup", onWindowCodePointerUp)
				window.addEventListener("pointercancel", onWindowCodePointerUp)
			})

			fragment.appendChild(element)

			const code = element.querySelector(`#code${i}`) as HTMLElement
			const circle = element.querySelector(`#circle${i}`) as SVGElement
			const countdown = element.querySelector(`#countdown${i}`) as HTMLElement
			const ringContainer = element.querySelector(`#ringContainer${i}`) as HTMLElement

			activeCodeRefs.push({
				code,
				circle,
				countdown,
				ringContainer,
				secret: secrets[i],
			})

			// Universal Dynamic Icon Discovery: Asynchronously fetch authentic icon if fallback monogram (deferred to prevent UI freeze)
			if (iconData.isMonogram && iconData.serviceKey) {
				const sKey = iconData.serviceKey
				setTimeout(() => {
					fetchBrandIcon(sKey).then((iconUrl) => {
						if (iconUrl) {
							const inner = document.querySelector(`#brandIconInner${i}`)
							const container = document.querySelector(`#brandIconContainer${i}`)
							if (inner && container) {
								if (iconUrl.includes("<svg")) {
									let normalizedSvg = iconUrl
									if (!normalizedSvg.includes("width=")) {
										normalizedSvg = normalizedSvg.replace(/<svg\b/i, '<svg width="28" height="28"')
									}
									inner.innerHTML = normalizedSvg
									container.setAttribute(
										"style",
										"background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);"
									)
								} else {
									inner.innerHTML = `<img src="${iconUrl}" alt="${primaryTitle}" class="w-7 h-7 md:w-8 md:h-8 object-contain drop-shadow transition-opacity duration-300" style="opacity: 0;" />`
									const img = inner.querySelector("img")
									if (img) {
										img.onload = () => {
											img.style.opacity = "1"
											container.setAttribute(
												"style",
												"background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);"
											)
										}
									}
								}
							}
						}
					})
				}, i * 25 + 50)
			}

			searchQuery.push({
				name: `${primaryTitle.toLowerCase().trim()}`,
				description: `${secondarySubtitle.toLowerCase().trim()}`,
				rawIssuer: rawIssuer,
				rawName: rawName,
				originalTitle: primaryTitle,
				originalSubtitle: secondarySubtitle,
			})

			if (remainingTime <= 5) {
				code.classList.add("text-rose-500")
			}

			const openMenu = (clientX?: number, clientY?: number) => {
				const currentIdx = parseInt(element.getAttribute("data-index") || String(i), 10)
				const codeElem = element.querySelector(`[id^="code"]`) as HTMLElement | null
				const currentToken = codeElem?.getAttribute("data-raw") || codeElem?.textContent?.replace(/\s+/g, "") || ""
				let x = clientX
				let y = clientY
				if (x === undefined || y === undefined) {
					const rect = element.getBoundingClientRect()
					x = rect.left + rect.width / 2
					y = rect.top + rect.height / 2
				}
				const curIssuer = currentCodesData.issuers[currentIdx] || ""
				const curName = cleanAccountName(currentCodesData.names[currentIdx] || "", curIssuer)
				const curSecret = currentCodesData.secrets[currentIdx] || ""
				activeContextMenu.set({
					x,
					y,
					index: currentIdx,
					issuer: curIssuer,
					name: curName,
					secret: curSecret,
					token: currentToken,
					pinned: isCodePinned(curSecret),
				})
			}

			// Click to copy (only primary left click, ignoring button clicks, star button, drag handle & active drags)
			element.addEventListener("click", (e: MouseEvent) => {
				if (e.button !== 0) return
				if (
					(e.target as HTMLElement)?.closest(`.moreBtn`) ||
					(e.target as HTMLElement)?.closest(`[id^="moreBtn"]`) ||
					(e.target as HTMLElement)?.closest(`.star-btn`) ||
					(e.target as HTMLElement)?.closest(`[id^="starBtn"]`) ||
					(e.target as HTMLElement)?.closest(`.drag-handle`) ||
					(e.target as HTMLElement)?.closest(`button`)
				) return
				if (isDraggingCode || codeDragJustEnded) return
				const currentIdx = parseInt(element.getAttribute("data-index") || String(i), 10)
				const codeElem = element.querySelector(`[id^="code"]`) as HTMLElement | null
				const raw = codeElem?.getAttribute("data-raw") || codeElem?.textContent?.replace(/\s+/g, "") || ""
				triggerCopy(currentIdx, raw)
			})

			// Right-click context menu directly on the card
			element.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault()
				e.stopPropagation()
				openMenu(e.clientX, e.clientY)
			})

			// Keyboard shortcuts: Alt+Arrow to reorder within active category / all, Shift+F10/ContextMenu to open menu
			element.addEventListener("keydown", async (e: KeyboardEvent) => {
				if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowLeft")) {
					e.preventDefault()
					await moveCardRelative(element, -1)
				} else if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowRight")) {
					e.preventDefault()
					await moveCardRelative(element, 1)
				} else if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
					e.preventDefault()
					openMenu()
				}
			})

			// Star Pin button click
			const starBtn = element.querySelector(`#starBtn${i}`) as HTMLButtonElement | null
			starBtn?.setAttribute("draggable", "false")
			starBtn?.addEventListener("pointerdown", (e) => {
				e.stopPropagation()
			})
			starBtn?.addEventListener("click", async (e: MouseEvent) => {
				e.preventDefault()
				e.stopPropagation()
				const currentIdx = parseInt(element.getAttribute("data-index") || String(i), 10)
				await togglePinCodeAtIndex(currentIdx)
			})

			// Three-dots menu button click
			const moreBtn = element.querySelector(`#moreBtn${i}`) as HTMLElement | null
			moreBtn?.setAttribute("draggable", "false")
			moreBtn?.addEventListener("dragstart", (e) => {
				e.preventDefault()
				e.stopPropagation()
			})
			moreBtn?.addEventListener("click", (e: MouseEvent) => {
				e.preventDefault()
				e.stopPropagation()
				const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
				openMenu(rect.left, rect.bottom + 6)
			})
		}
		getCodesContainer()?.appendChild(fragment)
	}

	generate()

	// Save newly imported codes
	const currentState = getState()
	if (currentState.importData !== null) {
		saveCodes().catch((err) => logger.error("saveCodes failed: " + err))
	}

	codesRefresher = setInterval(() => {
		try {
			refreshCodes(secrets)
		} catch (error) {
			logger.error("Error refreshing codes")
		}
	}, 500)

	// Apply active category filter or latest search to newly generated DOM cards
	let currentCat = "all"
	activeCodeCategory.subscribe((v) => (currentCat = v))()

	if (currentCat !== "all" && !catList.some((c) => c.id === currentCat)) {
		currentCat = "all"
		activeCodeCategory.set("all")
	}

	const latestSearch = currentState.searchHistory
	const searchBar: HTMLInputElement | null = document.querySelector(".search")
	if (searchBar && latestSearch !== null && latestSearch.trim() !== "" && !searchBar.value) {
		searchBar.value = latestSearch
	}

	// Always sync filtering to newly generated cards in DOM so categories remain active
	search()
}

const refreshCodes = (secrets: string[]) => {
	const now = getAccurateTimestamp()
	const remainingTime = 30 - Math.floor((now / 1000.0) % 30)

	const offset = (CIRCUMFERENCE * (1 - remainingTime / 30)).toFixed(2)
	const isLow = remainingTime <= 5
	const countdownInner = `<span class="text-[12px] leading-none tracking-tight">${remainingTime}</span><span class="text-[9px] leading-none opacity-50 ml-[1px] font-normal">s</span>`
	const countdownLowClass = "absolute flex items-baseline justify-center select-none pointer-events-none text-rose-500 font-bold animate-pulse"
	const countdownNormClass = "absolute flex items-baseline justify-center select-none pointer-events-none text-slate-500 dark:text-slate-300 font-semibold"
	const tooltipText = `${remainingTime}${language.codes?.countdownTooltip || 's remaining'}`

	// Fallback to querySelector if activeCodeRefs is empty
	if (activeCodeRefs.length === 0 && secrets.length > 0) {
		for (let i = 0; i < secrets.length; i++) {
			const code = document.querySelector(`#code${i}`) as HTMLElement | null
			const circle = document.querySelector(`#circle${i}`) as SVGElement | null
			const countdown = document.querySelector(`#countdown${i}`) as HTMLElement | null
			const ringContainer = document.querySelector(`#ringContainer${i}`) as HTMLElement | null
			if (code && circle) {
				const cleanSec = (secrets[i] || "").replace(/[\s-]+/g, "").toUpperCase()
				activeCodeRefs.push({ code, circle, countdown, ringContainer, secret: cleanSec })
			}
		}
	}

	for (let i = 0; i < activeCodeRefs.length; i++) {
		const ref = activeCodeRefs[i]
		if (!ref || !ref.code || !ref.circle) continue

		// Generate token and update DOM whenever token differs or on rollover
		try {
			const cleanSecret = (ref.secret || "").replace(/[\s-]+/g, "").toUpperCase()
			const currentRaw = ref.code.getAttribute("data-raw") || ""
			const token = new TOTP({
				secret: cleanSecret,
			}).generate({ timestamp: getAccurateTimestamp() })
			if (currentRaw !== token) {
				ref.code.setAttribute("data-raw", token)
				ref.code.textContent = formatToken(token)
			}
		} catch (err) {}

		ref.circle.setAttribute("stroke-dashoffset", offset)

		if (isLow) {
			ref.circle.setAttribute("stroke", "#ef4444")
			ref.code.classList.add("text-rose-500")
			if (ref.countdown) {
				ref.countdown.innerHTML = countdownInner
				ref.countdown.className = countdownLowClass
			}
		} else {
			ref.circle.setAttribute("stroke", "#0284c7")
			ref.code.classList.remove("text-rose-500")
			if (ref.countdown) {
				ref.countdown.innerHTML = countdownInner
				ref.countdown.className = countdownNormClass
			}
		}

		if (ref.ringContainer) {
			ref.ringContainer.title = tooltipText
		}
	}
}

export const stopCodesRefresher = () => {
	clearInterval(codesRefresher)
	cleanupCodeDrag()
}

export const invalidateVaultCache = () => {
	cachedDecryptedVault = null
	cachedEncryptedVault = null
	cachedSortSetting = null
}

export const clearCodesMemory = () => {
	stopCodesRefresher()
	currentCodesData = { names: [], secrets: [], issuers: [], uniqIds: [] }
	activeCodeRefs = []
	saveText = ""
	searchQuery = []
	cachedDecryptedVault = null
	cachedEncryptedVault = null
	cachedSortSetting = null
	invalidateVaultCache()
	activeCodeCategory.set("all")
	availableCodeCategories.set([])
	getCodesContainer()?.querySelectorAll(".code").forEach((el) => el.remove())
}

const BRAND_SYNONYMS: Record<string, string[]> = {
	gmail: ["google", "gmail", "gsuite", "workspace"],
	google: ["gmail", "google", "gsuite", "workspace", "youtube"],
	microsoft: ["outlook", "hotmail", "live", "office", "msft", "azure", "xbox"],
	outlook: ["microsoft", "outlook", "hotmail", "live"],
	hotmail: ["microsoft", "outlook", "hotmail", "live"],
	github: ["gh", "github"],
	discord: ["dc", "discord"],
	facebook: ["fb", "facebook", "meta"],
	meta: ["fb", "facebook", "meta", "instagram", "whatsapp"],
	instagram: ["ig", "instagram", "insta"],
	twitter: ["x", "twitter"],
	apple: ["icloud", "apple", "appleid"],
	amazon: ["aws", "amazon"],
	steam: ["valve", "steam"],
	roblox: ["rblx", "roblox"],
	stripe: ["stripe"],
	vercel: ["vercel"],
}

export const setCodesCategory = (catId: string) => {
	activeCodeCategory.set(catId)
	search()
}

export const clearSearch = () => {
	const searchBar = document.querySelector<HTMLInputElement>(".search")
	if (searchBar) {
		searchBar.value = ""
		searchBar.focus()
	}
	activeCodeCategory.set("all")
	search()
}

export const search = () => {
	const searchBar: HTMLInputElement | null = document.querySelector(".search")
	const rawInput = searchBar?.value || ""
	const input = rawInput.trim().toLowerCase()
	let currentCat = "all"
	activeCodeCategory.subscribe((v) => (currentCat = v))()

	const currentSettings = getSettings()
	const filterName = currentSettings.searchFilter?.name ?? true
	const filterDesc = currentSettings.searchFilter?.description ?? true

	const checkName = filterName || (!filterName && !filterDesc)
	const checkDesc = filterDesc || (!filterName && !filterDesc)

	// Clear button toggle
	const clearBtn = document.querySelector(".searchClearBtn") as HTMLElement | null
	if (clearBtn) {
		clearBtn.style.display = rawInput.length > 0 ? "flex" : "none"
	}

	const noResultsEl = document.querySelector(".noSearchResults") as HTMLElement | null
	const searchResultText = document.querySelector(".searchResult") as HTMLElement | null
	const countBadge = document.querySelector(".searchCountBadge") as HTMLElement | null

	// Reset state when search input is empty and category is all
	if (input === "" && currentCat === "all") {
		for (let i = 0; i < searchQuery.length; i++) {
			const div = document.querySelector(`#codes${i}`) as HTMLElement | null
			if (div) {
				div.style.display = "block"
				div.style.order = ""
			}
			const nameEl = document.querySelector(`#name${i}`)
			const descEl = document.querySelector(`#description${i}`)
			if (nameEl && searchQuery[i]?.originalTitle !== undefined) {
				nameEl.textContent = searchQuery[i].originalTitle
			}
			if (descEl && searchQuery[i]?.originalSubtitle !== undefined) {
				descEl.textContent = searchQuery[i].originalSubtitle
			}
		}

		if (noResultsEl) noResultsEl.style.display = "none"
		if (countBadge) countBadge.style.display = "none"

		const curState = getState()
		curState.searchHistory = ""
		setState(curState)
		return
	}

	const tokens = input ? input.split(/\s+/).filter(Boolean) : []
	let matchedCount = 0

	for (let i = 0; i < searchQuery.length; i++) {
		const item = searchQuery[i]
		const div = document.querySelector(`#codes${i}`) as HTMLElement | null
		const nameEl = document.querySelector(`#name${i}`) as HTMLElement | null
		const descEl = document.querySelector(`#description${i}`) as HTMLElement | null
		if (!div) continue

		// 1. Check Category match
		const cardCat = div.getAttribute("data-category") || "other"
		const cardIsPinned = div.getAttribute("data-pinned") === "true"
		const catMatches = currentCat === "all" ? true : currentCat === "pinned" ? cardIsPinned : cardCat === currentCat
		if (!catMatches) {
			div.style.display = "none"
			div.style.order = ""
			if (nameEl && item.originalTitle) nameEl.textContent = item.originalTitle
			if (descEl && item.originalSubtitle) descEl.textContent = item.originalSubtitle
			continue
		}

		// If no search tokens, category match is enough!
		if (tokens.length === 0) {
			div.style.display = "block"
			div.style.order = ""
			matchedCount++
			if (nameEl && item.originalTitle) nameEl.textContent = item.originalTitle
			if (descEl && item.originalSubtitle) descEl.textContent = item.originalSubtitle
			continue
		}

		// 2. Token Matching
		const rawIssuer = (item.rawIssuer || item.name || "").toLowerCase()
		const rawAccount = (item.rawName || item.description || "").toLowerCase()
		const title = (item.originalTitle || item.name || "").toLowerCase()
		const subtitle = (item.originalSubtitle || item.description || "").toLowerCase()

		const emailParts = rawAccount.split("@")
		const emailUsername = emailParts[0] || ""
		const emailDomain = emailParts[1] || ""

		let cardMatches = true
		let cardScore = 0

		for (const token of tokens) {
			let tokenMatched = false
			let tokenScore = 0

			if (checkName) {
				if (rawIssuer === token || title === token) {
					tokenScore = Math.max(tokenScore, 100)
					tokenMatched = true
				} else if (rawIssuer.startsWith(token) || title.startsWith(token)) {
					tokenScore = Math.max(tokenScore, 80)
					tokenMatched = true
				} else if (rawIssuer.includes(token) || title.includes(token)) {
					tokenScore = Math.max(tokenScore, 60)
					tokenMatched = true
				}

				for (const [key, synonyms] of Object.entries(BRAND_SYNONYMS)) {
					if (token === key || synonyms.includes(token)) {
						if (rawIssuer.includes(key) || synonyms.some((s) => rawIssuer.includes(s))) {
							tokenScore = Math.max(tokenScore, 90)
							tokenMatched = true
						}
					}
				}
			}

			if (checkDesc) {
				if (rawAccount === token || emailUsername === token) {
					tokenScore = Math.max(tokenScore, 95)
					tokenMatched = true
				} else if (emailUsername.startsWith(token) || subtitle.startsWith(token)) {
					tokenScore = Math.max(tokenScore, 75)
					tokenMatched = true
				} else if (emailUsername.includes(token) || subtitle.includes(token)) {
					tokenScore = Math.max(tokenScore, 65)
					tokenMatched = true
				} else if (emailDomain.includes(token)) {
					tokenScore = Math.max(tokenScore, 50)
					tokenMatched = true
				} else if (rawAccount.includes(token)) {
					tokenScore = Math.max(tokenScore, 40)
					tokenMatched = true
				}
			}

			if (!tokenMatched) {
				cardMatches = false
				break
			} else {
				cardScore += tokenScore
			}
		}

		if (cardMatches) {
			div.style.display = "block"
			div.style.order = String(-cardScore)
			matchedCount++
			if (nameEl && item.originalTitle) nameEl.textContent = item.originalTitle
			if (descEl && item.originalSubtitle) descEl.textContent = item.originalSubtitle
		} else {
			div.style.display = "none"
			div.style.order = ""
			if (nameEl && item.originalTitle) nameEl.textContent = item.originalTitle
			if (descEl && item.originalSubtitle) descEl.textContent = item.originalSubtitle
		}
	}

	if (matchedCount === 0) {
		if (noResultsEl) noResultsEl.style.display = "block"
		if (searchResultText) {
			searchResultText.textContent = input ? rawInput : currentCat
		}
		if (countBadge) {
			countBadge.style.display = "flex"
			countBadge.textContent = "0"
			countBadge.className = "searchCountBadge px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20"
		}
	} else {
		if (noResultsEl) noResultsEl.style.display = "none"
		if (countBadge) {
			if (input !== "" || currentCat !== "all") {
				countBadge.style.display = "flex"
				countBadge.textContent = `${matchedCount} / ${searchQuery.length}`
				countBadge.className = "searchCountBadge px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80"
			} else {
				countBadge.style.display = "none"
			}
		}
		if (input !== "") {
			const curState = getState()
			curState.searchHistory = rawInput
			setState(curState)
		}
	}
}

const saveCodes = async () => {
	if (!saveText || saveText.trim() === "" || saveText === "error") return
	const encryptedText = await encryptData(saveText)
	if (!encryptedText || encryptedText === "error" || encryptedText.trim() === "") {
		logger.error("Failed to encrypt codes in saveCodes - aborting save to prevent vault wipe")
		return
	}
	const curState = getState()
	const curSettings = getSettings()

	curState.importData = null
	curSettings.vault.codes = encryptedText

	cachedEncryptedVault = encryptedText
	cachedDecryptedVault = saveText
	cachedSortSetting = curSettings.settings.sortCodes

	logger.log("Codes saved")

	setState(curState)
	setSettings(curSettings)
}

let cachedDecryptedVault: string | null = null
let cachedEncryptedVault: string | null = null
let cachedSortSetting: number | null = null
let inFlightLoadCodesPromise: Promise<void> | null = null

export const loadCodes = async (): Promise<void> => {
	if (inFlightLoadCodesPromise) return inFlightLoadCodesPromise
	inFlightLoadCodesPromise = (async () => {
		try {
			await executeLoadCodes()
		} finally {
			inFlightLoadCodesPromise = null
		}
	})()
	return inFlightLoadCodesPromise
}

const executeLoadCodes = async () => {
	setupCodesEventListeners()
	let savedCodes = false

	const currentSettings = getSettings()
	if (currentSettings.vault.codes !== null) {
		savedCodes = true
	} else {
		const importEl = document.querySelector(".importCodes") as HTMLElement | null
		if (importEl) importEl.style.display = "block"
	}

	const curState = getState()

	// Instant fast path: If codes are already loaded and rendered in DOM, and vault hasn't changed
	const domCards = getCodesContainer()?.querySelectorAll(".code") || []
	if (
		savedCodes &&
		curState.importData === null &&
		cachedEncryptedVault === currentSettings.vault.codes &&
		cachedSortSetting === currentSettings.settings.sortCodes &&
		currentCodesData.names &&
		currentCodesData.names.length > 0 &&
		domCards.length === currentCodesData.names.length
	) {
		if (!codesRefresher) {
			codesRefresher = setInterval(() => {
				try {
					refreshCodes(currentCodesData.secrets)
				} catch (error) {
					logger.error("Error refreshing codes")
				}
			}, 500)
		}
		refreshCodes(currentCodesData.secrets)
		document.querySelector<HTMLInputElement>(".search")?.select()
		return
	}

	if (savedCodes === true) {
		// Ensure keychain key is loaded if user does not require master password
		if (currentSettings.security.requireAuthentication === false) {
			await setEncryptionKey()
		}

		let decryptedText: string
		if (cachedEncryptedVault === currentSettings.vault.codes && cachedDecryptedVault !== null) {
			decryptedText = cachedDecryptedVault
		} else {
			decryptedText = await decryptData(currentSettings.vault.codes)
			if (!decryptedText || decryptedText === "error") {
				logger.error("Could not decrypt saved vault codes")
				hasCodesStore.set(false)
				availableCodeCategories.set([])
				generateCodeElements({ names: [], secrets: [], issuers: [], uniqIds: [] })
				return
			}
			cachedEncryptedVault = currentSettings.vault.codes
			cachedDecryptedVault = decryptedText
			cachedSortSetting = currentSettings.settings.sortCodes
		}

		if (curState.importData !== null) {
			// There are saved and new codes
			savedCodes = false
			saveText = curState.importData + decryptedText

			const codes = textConverter(curState.importData + decryptedText, currentSettings.settings.sortCodes)
			logger.log(`New codes merged with existing ones. Count: ${codes.names.length}`)
			generateCodeElements(codes)
		} else {
			// There are saved but not new ones
			const codes = textConverter(decryptedText, currentSettings.settings.sortCodes)
			logger.log(`Existing codes loaded. Count: ${codes.names.length}`)
			generateCodeElements(codes)
		}

		document.querySelector<HTMLInputElement>(".search")?.select()
	} else {
		if (curState.importData !== null) {
			// There are no saved codes, but new codes imported
			saveText = curState.importData

			const codes = textConverter(curState.importData, currentSettings.settings.sortCodes)
			logger.log(`New codes imported and saved. Count: ${codes.names.length}`)
			generateCodeElements(codes)
		} else {
			hasCodesStore.set(false)
			availableCodeCategories.set([])
			generateCodeElements({ names: [], secrets: [], issuers: [], uniqIds: [] })
		}
	}
}

const saveUpdatedVault = async (data: LibImportFile) => {
	let newVaultText = ""
	for (let i = 0; i < data.names.length; i++) {
		newVaultText += `\nName:   ${data.names[i]} \nSecret: ${data.secrets[i]} \nIssuer: ${data.issuers[i]} \nType:   OTP_TOTP\n`
	}
	const currentSettings = getSettings()
	if (data.names.length === 0) {
		currentSettings.vault.codes = null
		cachedEncryptedVault = null
		cachedDecryptedVault = null
	} else {
		try {
			const encrypted = await encryptData(newVaultText)
			if (encrypted && encrypted !== "error") {
				currentSettings.vault.codes = encrypted
				cachedEncryptedVault = encrypted
				cachedDecryptedVault = newVaultText
				cachedSortSetting = currentSettings.settings.sortCodes
			} else {
				console.error("Vault encryption returned invalid data, aborting save")
				return
			}
		} catch (err) {
			console.warn("Vault encryption failed:", err)
			return
		}
	}
	setSettings(currentSettings)
}

export const deleteCodeAtIndex = async (index: number) => {
	if (!currentCodesData || currentCodesData.names[index] === undefined) return
	const secret = (currentCodesData.secrets[index] || "").replace(/[\s-]+/g, "").toUpperCase()
	if (secret && pinnedSecrets.has(secret)) {
		pinnedSecrets.delete(secret)
		savePinnedSecrets()
	}
	currentCodesData.names.splice(index, 1)
	currentCodesData.secrets.splice(index, 1)
	currentCodesData.issuers.splice(index, 1)
	if (currentCodesData.uniqIds) currentCodesData.uniqIds.splice(index, 1)

	await saveUpdatedVault(currentCodesData)
	showToast(language.common.delete + " " + language.common.confirm, "success")
	generateCodeElements(currentCodesData)
	search()
}

export const editCodeAtIndex = async (index: number, newIssuer: string, newName: string, newSecret?: string) => {
	if (!currentCodesData || currentCodesData.names[index] === undefined) return
	const oldSecret = (currentCodesData.secrets[index] || "").replace(/[\s-]+/g, "").toUpperCase()
	const cleanIssuer = newIssuer.trim()
	const cleanName = cleanAccountName(newName.trim(), cleanIssuer)
	currentCodesData.issuers[index] = cleanIssuer
	currentCodesData.names[index] = cleanName
	if (newSecret && newSecret.trim() !== "") {
		const formattedNewSecret = newSecret.replace(/[\s-]+/g, "").toUpperCase()
		if (oldSecret !== formattedNewSecret && pinnedSecrets.has(oldSecret)) {
			pinnedSecrets.delete(oldSecret)
			pinnedSecrets.add(formattedNewSecret)
			savePinnedSecrets()
		}
		currentCodesData.secrets[index] = formattedNewSecret
	}

	await saveUpdatedVault(currentCodesData)
	showToast(language.edit?.saveSuccess || language.common.edit + " " + language.common.confirm, "success")
	generateCodeElements(currentCodesData)
	search()
}

export const setupCodesEventListeners = () => {
	if (listenersInitialized || typeof window === "undefined") return
	listenersInitialized = true

	window.addEventListener("authme:copy-code", (e: any) => {
		const { index, token } = e.detail || {}
		if (index !== undefined) {
			const codeElem = document.querySelector(`#code${index}`)
			const raw = token || codeElem?.getAttribute("data-raw") || ""
			if (raw) {
				clipboard.writeText(raw)
				scheduleClipboardClear(raw)
				const primaryTitle = (currentCodesData.issuers[index] || "").trim() || (currentCodesData.names[index] || "").trim() || "2FA"
				showToast(`${language.common.copied}: ${primaryTitle} (${formatToken(raw)})`, "success")
			}
		}
	})

	window.addEventListener("authme:toggle-pin-code", async (e: any) => {
		const { index } = e.detail || {}
		if (index !== undefined) {
			await togglePinCodeAtIndex(index)
		}
	})

	window.addEventListener("authme:delete-code", async (e: any) => {
		const { index } = e.detail || {}
		if (index !== undefined) {
			await deleteCodeAtIndex(index)
		}
	})

	window.addEventListener("authme:edit-code-save", async (e: any) => {
		const { index, issuer, name, secret } = e.detail || {}
		if (index !== undefined) {
			await editCodeAtIndex(index, issuer, name, secret)
		}
	})
}

if (typeof window !== "undefined") {
	;(window as any).__authme_codes = {
		togglePinCodeAtIndex,
		editCodeAtIndex,
		deleteCodeAtIndex,
		getCodesData: () => currentCodesData,
		loadCodes,
		generateCodeElements,
		search,
		clearSearch,
	}
	setupCodesEventListeners()
}

