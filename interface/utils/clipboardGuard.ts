import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
import { getSettings } from "../stores/settings"
import { showToast } from "../stores/dialog"
import { getLanguage } from "./language"

export const CLEAR_CLIPBOARD_OPTIONS = [
	"Never",
	"10 seconds",
	"20 seconds",
	"30 seconds",
	"1 minute",
]

export const CLEAR_CLIPBOARD_SECONDS = [0, 10, 20, 30, 60]

let clearTimer: NodeJS.Timeout | null = null
let lastCopiedToken: string | null = null

export const scheduleClipboardClear = (copiedToken: string) => {
	const settings = getSettings()
	const raw = settings?.settings?.clearClipboard ?? 3
	const timeoutSec = CLEAR_CLIPBOARD_SECONDS[raw] !== undefined ? CLEAR_CLIPBOARD_SECONDS[raw] : raw

	lastCopiedToken = copiedToken.replace(/\s+/g, "")

	if (timeoutSec <= 0) return

	if (clearTimer) clearTimeout(clearTimer)

	const cleanTarget = lastCopiedToken

	clearTimer = setTimeout(async () => {
		try {
			const current = await clipboard.readText()
			if (current && current.replace(/\s+/g, "") === cleanTarget) {
				await clipboard.writeText("")
				const language = getLanguage()
				showToast(language.codes?.clipboardCleared || "Clipboard cleared for security.", "info")
			}
		} catch (e) {
			console.error("Failed to clear clipboard:", e)
		} finally {
			lastCopiedToken = null
			clearTimer = null
		}
	}, timeoutSec * 1000)
}

/**
 * Instantly wipe any sensitive 2FA token from the clipboard (e.g. on app lock)
 */
export const flushClipboardNow = async () => {
	if (clearTimer) {
		clearTimeout(clearTimer)
		clearTimer = null
	}
	if (!lastCopiedToken) return

	const target = lastCopiedToken
	lastCopiedToken = null

	try {
		const current = await clipboard.readText()
		if (current && current.replace(/\s+/g, "") === target) {
			await clipboard.writeText("")
		}
	} catch (e) {
		console.warn("Failed to flush clipboard:", e)
	}
}
