import { getSettings } from "../stores/settings"
import { getState, setState } from "../stores/state"
import { navigate } from "./navigate"
import { showToast } from "../stores/dialog"
import { getLanguage } from "./language"
import { flushClipboardNow } from "./clipboardGuard"
import { clearCodesMemory } from "../windows/codes"
import { clearEncryptionKey } from "./encryption"

export const LOCK_TIMER_OPTIONS = [
	"Never",
	"30 seconds",
	"1 minute",
	"5 minutes",
	"10 minutes",
	"30 minutes",
	"1 hour",
]

export const LOCK_TIMER_SECONDS = [0, 30, 60, 300, 600, 1800, 3600]

let idleTimer: NodeJS.Timeout | null = null
let lastActivityTime = Date.now()
let lastThrottleTime = 0
let isLocking = false
let listenersAttached = false

export const getLockTimeoutSeconds = (): number => {
	const settings = getSettings()
	const raw = settings?.settings?.lockTimer ?? 0
	return LOCK_TIMER_SECONDS[raw] !== undefined ? LOCK_TIMER_SECONDS[raw] : raw
}

export const getLastActivityTime = (): number => lastActivityTime

export const setLastActivityTime = (time: number) => {
	lastActivityTime = time
	lastThrottleTime = time
}

export const resetActivityTime = () => {
	const now = Date.now()
	lastActivityTime = now
	lastThrottleTime = now
}

export const checkIdleTimeout = (now = Date.now()): boolean => {
	const settings = getSettings()
	const state = getState()

	if (!state.authenticated) return false
	if (settings.security && settings.security.requireAuthentication === false) return false

	const timeoutSec = getLockTimeoutSeconds()
	if (timeoutSec <= 0) return false

	const idleSeconds = (now - lastActivityTime) / 1000
	if (idleSeconds >= timeoutSec) {
		lockApp(true)
		return true
	}
	return false
}

export const lockApp = async (notify = true) => {
	if (isLocking) return
	const settings = getSettings()
	const state = getState()
	if (!state.authenticated) return
	if (settings.security && settings.security.requireAuthentication === false) return

	isLocking = true
	try {
		state.authenticated = false
		setState(state)

		try {
			await flushClipboardNow()
		} catch (e) {
			console.warn("Failed to flush clipboard on lock:", e)
		}

		clearCodesMemory()
		try {
			await clearEncryptionKey()
		} catch (e) {}

		navigate("confirm")

		if (notify) {
			const language = getLanguage()
			showToast(language.confirm?.locked || "Authme has been locked.", "info")
		}
	} finally {
		isLocking = false
	}
}

export const resetIdleTimer = () => {
	const now = Date.now()

	// CRITICAL: Check if already expired BEFORE resetting activity time!
	// If the user was idle past timeout, any event (mouse move, key press)
	// must trigger the lock immediately and NOT revive the session.
	if (checkIdleTimeout(now)) {
		return
	}

	if (now - lastThrottleTime >= 1000) {
		lastThrottleTime = now
		lastActivityTime = now
	}
}

export const onWindowFocusOrVisible = () => {
	const now = Date.now()
	if (checkIdleTimeout(now)) {
		return
	}
	resetIdleTimer()
}

export const stopLockTimer = () => {
	if (idleTimer) {
		clearInterval(idleTimer)
		idleTimer = null
	}
}

export const initLockTimer = () => {
	if (typeof window === "undefined") return

	if (!listenersAttached) {
		listenersAttached = true

		const events = ["mousemove", "keydown", "mousedown", "wheel", "touchstart"]
		events.forEach((ev) => {
			window.addEventListener(ev, resetIdleTimer, { passive: true })
		})

		window.addEventListener("focus", onWindowFocusOrVisible, { passive: true })
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				onWindowFocusOrVisible()
			}
		}, { passive: true })
	}

	// Check periodically
	if (idleTimer) clearInterval(idleTimer)

	idleTimer = setInterval(() => {
		checkIdleTimeout()
	}, 1000)
}
