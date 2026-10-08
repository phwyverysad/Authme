import { router } from "@baileyherbert/tinro"
import { get } from "svelte/store"
import {
	activeModal,
	activeContextMenu,
	activeEditModal,
	activeQrModal,
	activePasswordModal,
	activeDisablePasswordModal,
	activeEnablePasswordModal,
	activeResetModal,
} from "../stores/dialog"
import { mailViewActive, exitMailViewToDashboard } from "../stores/mail"

const historyStack: string[] = []
let historyIndex = -1
let isNavigatingHistory = false
let historyInitialized = false

/**
 * Initializes the global navigation history tracker and registers
 * event listeners for Mouse 4 (button 3) and Mouse 5 (button 4).
 */
export function initNavigationHistory(): void {
	if (historyInitialized || typeof window === "undefined") return
	historyInitialized = true

	// Track router path changes
	router.subscribe((data) => {
		if (isNavigatingHistory) {
			isNavigatingHistory = false
			return
		}

		const path = data?.path
		if (!path || path === "/idle") return

		// Prevent duplicate consecutive entries in stack
		if (historyStack.length > 0 && historyStack[historyIndex] === path) {
			return
		}

		// Truncate forward history if a new route was taken
		if (historyIndex < historyStack.length - 1) {
			historyStack.splice(historyIndex + 1)
		}

		historyStack.push(path)
		historyIndex = historyStack.length - 1
	})

	// Global mouse button listener for Mouse 4 (Back) and Mouse 5 (Forward/Back)
	window.addEventListener(
		"mouseup",
		(e: MouseEvent) => {
			if (e.button === 3 || e.button === 4) {
				e.preventDefault()
				e.stopPropagation()
				handleGlobalBack()
			}
		},
		true
	)

	window.addEventListener(
		"pointerup",
		(e: PointerEvent) => {
			if (e.button === 3 || e.button === 4) {
				e.preventDefault()
				e.stopPropagation()
			}
		},
		true
	)

	window.addEventListener(
		"auxclick",
		(e: MouseEvent) => {
			if (e.button === 3 || e.button === 4) {
				e.preventDefault()
				e.stopPropagation()
			}
		},
		true
	)

	// Also support Alt+LeftArrow shortcut for back
	window.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			if (e.altKey && e.key === "ArrowLeft") {
				const target = e.target as HTMLElement | null
				if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
					return
				}
				e.preventDefault()
				e.stopPropagation()
				handleGlobalBack()
			}
		},
		true
	)
}

/**
 * Performs back navigation according to hierarchical priority:
 * 1. Close any active modal/context menu/dialog.
 * 2. If in Mail view (viewing webview), exit to Mail dashboard.
 * 3. Go back to previous route in history stack.
 * 4. Fallback to /codes if not already there.
 */
export function handleGlobalBack(): void {
	// 1. In-app dialogs & context menus
	if (get(activeContextMenu)) {
		activeContextMenu.set(null)
		return
	}
	if (get(activeModal)) {
		const m = get(activeModal)
		m?.resolve(false)
		activeModal.set(null)
		return
	}
	if (get(activeEditModal)) {
		activeEditModal.set(null)
		return
	}
	if (get(activeQrModal)) {
		activeQrModal.set(null)
		return
	}
	if (get(activePasswordModal)) {
		activePasswordModal.set(false)
		return
	}
	if (get(activeDisablePasswordModal)) {
		activeDisablePasswordModal.set(false)
		return
	}
	if (get(activeEnablePasswordModal)) {
		activeEnablePasswordModal.set(false)
		return
	}
	if (get(activeResetModal)) {
		activeResetModal.set(false)
		return
	}

	// 2. Custom active modal callback (e.g. Mail modals & context menus)
	if (typeof (window as any).__authme_closeActiveModal === "function") {
		if ((window as any).__authme_closeActiveModal()) {
			return
		}
	}

	// 3. Mail webview active -> exit to mail accounts dashboard
	if (get(mailViewActive)) {
		exitMailViewToDashboard().catch(() => {})
		return
	}

	// 4. Route history stack
	if (historyIndex > 0) {
		historyIndex--
		const targetPath = historyStack[historyIndex]
		isNavigatingHistory = true
		router.goto(targetPath)
		return
	}

	// 5. Fallback: navigate to /codes if not at root
	const current = typeof location !== "undefined" ? location.pathname : ""
	if (current && current !== "/codes" && current !== "/") {
		router.goto("/codes")
	}
}
