import App from "./app.svelte"
import "../styles/index.css"
import { event, webviewWindow } from "@tauri-apps/api"
import { invoke } from "@tauri-apps/api/core"
import * as os from "@tauri-apps/plugin-os"
import { getSettings, setSettings, applyTheme } from "../stores/settings"
import { navigate } from "../utils/navigate"
import { getState, setState } from "interface/stores/state"
import { router } from "@baileyherbert/tinro"
import { setEncryptionKey } from "interface/utils/encryption"
import { dev } from "../../build.json"
import { optionalAnalyticsPayload } from "interface/utils/analytics"
import { checkForUpdate } from "interface/utils/update"
import logger from "interface/utils/logger"
import posthog from "posthog-js"

const settings = getSettings()
const state = getState()

// Apply saved theme immediately before mount to prevent any visual theme glitch
applyTheme(settings?.settings?.theme ?? 0)

// Pre-determine authentication & initial route synchronously to prevent initial render warp
if (settings.security?.requireAuthentication === false) {
	setEncryptionKey().catch(() => {})
	if (!state.authenticated) {
		state.authenticated = true
		setState(state)
	}
	router.goto("/codes")
} else if (settings.security?.password) {
	router.goto("/confirm")
}

const appWindow = webviewWindow.getCurrentWebviewWindow()

// Initialize backend lifecycle & privacy protection from saved settings
invoke("set_minimize_to_tray", { enabled: settings.settings?.minimizeToTray !== false }).catch(() => {})
invoke("set_remember_window_position", { enabled: settings.settings?.rememberWindowPosition !== false }).catch(() => {})
appWindow.setContentProtected(settings.settings?.windowCapture === true).catch(() => {})

// Create the svelte app
const target = document.getElementById("app") || document.body
const app = new App({
	target,
})

import { getServiceIcon, fetchBrandIcon } from "../utils/icons"
import { generateCodeElements } from "../windows/codes/index"

if (typeof window !== "undefined") {
	;(window as any).__authme_icons = { getServiceIcon, fetchBrandIcon }
	;(window as any).__authme_generateCodes = generateCodeElements

	// Prevent default classic browser context menu across the entire app interface
	window.addEventListener(
		"contextmenu",
		(e) => {
			const target = e.target as HTMLElement | null
			if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")) {
				e.preventDefault()
			}
		},
		true
	)
}

export default app


// Tray & single-instance launch handler: always open directly to codes
event.listen("openCodes", (data: any) => {
	const isOpening: boolean = data?.payload?.event ?? true
	if (!isOpening) return

	const currentSettings = getSettings()
	const curState = getState()

	if (curState.authenticated === true || currentSettings.security?.requireAuthentication === false) {
		if (!curState.authenticated) {
			curState.authenticated = true
			setState(curState)
		}
		navigate("codes")
	} else {
		navigate("confirm")
	}
})

// Listen for focus changes
appWindow.onFocusChanged((focused) => {
	const curState = getState()
	if (focused.payload === true && curState.authenticated === true) {
		document.querySelector<HTMLInputElement>(".search")?.select()
	}
})

import { initLockTimer, lockApp } from "../utils/lockTimer"
import { initWindowBounds } from "../utils/windowBounds"
import { initMailStore } from "../stores/mail"
import { initNavigationHistory } from "../utils/navigationHistory"

initLockTimer()
initWindowBounds()
initNavigationHistory()
initMailStore().catch(() => {})

// Listen for close request
appWindow.onCloseRequested((event) => {
	const currentSettings = getSettings()
	if (currentSettings.settings.minimizeToTray !== false) {
		event.preventDefault()
		appWindow.hide()

		const curState = getState()
		if (curState.authenticated === true) {
			if ((currentSettings.settings.lockTimer || 0) > 0) {
				lockApp(false)
			}
		}
	} else {
		// Cleanly exit application when minimize to tray is disabled
		invoke("set_minimize_to_tray", { enabled: false }).catch(() => {})
	}
})

// Global shortcuts: Ctrl+L to lock app, Ctrl++/Ctrl-- to adjust display scale
window.addEventListener("keydown", (e) => {
	if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")) {
		e.preventDefault()
		lockApp(true)
	} else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
		e.preventDefault()
		const cur = getSettings()
		const scale = Math.min(2, (cur.settings.appScale ?? 1) + 1)
		cur.settings.appScale = scale
		setSettings(cur)
	} else if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
		e.preventDefault()
		const cur = getSettings()
		const scale = Math.max(0, (cur.settings.appScale ?? 1) - 1)
		cur.settings.appScale = scale
		setSettings(cur)
	} else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
		e.preventDefault()
		const cur = getSettings()
		cur.settings.appScale = 1
		setSettings(cur)
	}
})

// Prevent default Chromium/WebView2 right-click context menu everywhere except in text inputs or webview
document.addEventListener("contextmenu", (event) => {
	const target = event.target as HTMLElement | null
	if (
		target?.matches?.("input, textarea, [contenteditable='true']") ||
		target?.closest?.("[data-allow-contextmenu]")
	) {
		return
	}
	event.preventDefault()
})

// Handle launch options
const launchOptions = async () => {
	try {
		const args: string[] = await invoke("get_args")

		if (args && args.includes("--minimized")) {
			await appWindow.hide()
		}
	} catch (e) {
		logger.error(`Failed to handle launch options: ${e}`)
	}
}

launchOptions()

// Optional analytics
const optionalAnalytics = async () => {
	if (settings.settings.optionalAnalytics && !dev) {
		const payload = await optionalAnalyticsPayload()

		try {
			posthog.init("phc_QYxqnCtHIrREhZ47S6ZVPaksY8jO2j7YZCPQjbPgF09", {
				api_host: "https://eu.i.posthog.com",
				capture_pageview: false,
				capture_pageleave: false,
				persistence: "localStorage",
				autocapture: false,
			})

			posthog.capture("app_start", { version: payload.version, build: payload.build, os: payload.os, lang: payload.lang, date: payload.date.toISOString().split("T")[0] })
		} catch (error) {
			logger.error(`Failed to send analytics: ${error}`)
		}
	}
}

optionalAnalytics()
checkForUpdate()
