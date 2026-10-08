import { invoke } from "@tauri-apps/api/core"
import { webviewWindow } from "@tauri-apps/api"
import { writable, get } from "svelte/store"
import build from "../../build.json"

const defaultSettings: LibSettings = {
	info: {
		version: build.version,
		build: build.number,
		date: build.date,
	},

	security: {
		requireAuthentication: null,
		hardwareAuthentication: false,
		password: null,
		hardwareKey: null,
	},

	settings: {
		language: 0,
		launchOnStartup: true,
		minimizeToTray: true,
		optionalAnalytics: true,
		codesDescription: false,
		blurCodes: false,
		sortCodes: 0,
		codesLayout: 0,
		theme: 0,
		lockTimer: 0,
		rememberWindowPosition: true,
		clearClipboard: 3,
		appScale: 1,
		windowCapture: false,
	},

	searchFilter: {
		name: true,
		description: true,
	},

	vault: {
		codes: null,
	},

	shortcuts: {
		show: "CmdOrCtrl+Shift+a",
		settings: "None",
		exit: "CmdOrCtrl+Shift+d",
	},

	banners: {
		sponsor: null,
	},
}

// Setup auto launch on first start
try {
	if (build.dev === false && typeof localStorage !== "undefined") {
		const existing = localStorage.getItem("settings") || (localStorage as any).settings
		if (!existing) {
			invoke("enable_auto_launch")
		}
	}
} catch {}

const parseSettings = (): LibSettings => {
	try {
		if (typeof localStorage !== "undefined") {
			const raw = localStorage.getItem("settings") || (localStorage as any).settings
			if (raw) {
				const parsed = JSON.parse(raw)
				if (parsed && typeof parsed === "object") {
					const mergedSettings = { ...defaultSettings.settings, ...(parsed.settings || {}) }
					if (typeof mergedSettings.clearClipboard === "number" && mergedSettings.clearClipboard > 4) {
						mergedSettings.clearClipboard = 3
					}
					const mergedSearchFilter = {
						name: true,
						description: true,
						...(parsed.searchFilter || {}),
					}
					// Upgrade legacy false default so account/email search works automatically
					if (parsed.searchFilter && parsed.searchFilter.description === false && parsed.searchFilter._customized !== true) {
						mergedSearchFilter.description = true
					}
					return {
						...defaultSettings,
						...parsed,
						settings: mergedSettings,
						security: { ...defaultSettings.security, ...(parsed.security || {}) },
						searchFilter: mergedSearchFilter,
					}
				}
			}
		}
	} catch (e) {
		console.error("Failed to parse settings:", e)
	}
	return defaultSettings
}

export function applyTheme(themeIndex: number) {
	if (typeof document === "undefined") return
	const isLight = themeIndex === 1
	const root = document.documentElement
	const body = document.body

	if (isLight) {
		root.setAttribute("data-theme", "light")
		root.classList.remove("dark")
		root.classList.add("light")
		root.style.colorScheme = "light"
		root.style.backgroundColor = "#f1f5f9"

		if (body) {
			body.setAttribute("data-theme", "light")
			body.classList.remove("dark")
			body.classList.add("light")
			body.style.backgroundColor = "#f1f5f9"
			body.style.color = "#0f172a"
		}
	} else {
		root.setAttribute("data-theme", "dark")
		root.classList.remove("light")
		root.classList.add("dark")
		root.style.colorScheme = "dark"
		root.style.backgroundColor = "#0f172a"

		if (body) {
			body.setAttribute("data-theme", "dark")
			body.classList.remove("light")
			body.classList.add("dark")
			body.style.backgroundColor = "#0f172a"
			body.style.color = "#ffffff"
		}
	}

	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("authme:themechange", { detail: { isLight, isDark: !isLight } }))
	}
}

export const APP_SCALE_FACTORS = [0.9, 1.0, 1.15]

export function applyAppScale(scaleIndex: number = 1) {
	if (typeof document === "undefined") return
	const factor = APP_SCALE_FACTORS[scaleIndex] || 1.0
	try {
		// Clear any legacy zoom that caused clipping
		;(document.documentElement.style as any).zoom = ""
		// Standard Root rem scaling: 1rem is based on root fontSize (16px * factor)
		document.documentElement.style.fontSize = `${16 * factor}px`
		document.documentElement.style.setProperty("--app-scale", factor.toString())
	} catch (e) {
		console.error("Failed to apply app scale:", e)
	}
}

// Create store
export const settings = writable<LibSettings>(parseSettings())

export const getSettings = (): LibSettings => {
	return get(settings)
}

export const setSettings = (newSettings: LibSettings) => {
	settings.set(newSettings)
}

export const toggleTheme = () => {
	const current = getSettings()
	const newTheme = current.settings.theme === 1 ? 0 : 1
	current.settings.theme = newTheme
	setSettings(current)
}

// Listen for store events
settings.subscribe((data) => {
	if (typeof window !== "undefined" && (window as any).__AUTHME_DEBUG__) {
		const sanitized = {
			...data,
			vault: { ...data.vault, codes: data.vault?.codes ? "[REDACTED]" : null },
			security: { ...data.security, password: data.security?.password ? "[REDACTED]" : null },
		}
		console.log("Settings changed: ", sanitized)
	}

	if (!data.settings) {
		data.settings = defaultSettings.settings
	}

	if (data.settings.language === undefined) {
		data.settings.language = 0
	}

	if (data.settings.theme === undefined) {
		data.settings.theme = 0
	}

	applyTheme(data.settings.theme)
	applyAppScale(data.settings.appScale !== undefined ? data.settings.appScale : 1)

	// Sync desktop lifecycle flags and privacy protection directly to Tauri backend
	try {
		invoke("set_minimize_to_tray", { enabled: data.settings.minimizeToTray !== false }).catch(() => {})
		invoke("set_remember_window_position", { enabled: data.settings.rememberWindowPosition !== false }).catch(() => {})
		const appWindow = webviewWindow.getCurrentWebviewWindow()
		appWindow.setContentProtected(data.settings.windowCapture === true).catch(() => {})
	} catch {}

	if (data.banners === undefined) {
		data.banners = {}
	}

	if (data.banners.sponsor === undefined) {
		data.banners.sponsor = null
	}

	try {
		if (typeof localStorage !== "undefined") {
			const json = JSON.stringify(data)
			localStorage.setItem("settings", json)
			try {
				;(localStorage as any).settings = json
			} catch {}
		}
	} catch {}
})
