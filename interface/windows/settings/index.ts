import build from "../../../build.json"
import { path, app, webviewWindow } from "@tauri-apps/api"
import { invoke } from "@tauri-apps/api/core"
import { navigate, open } from "../../utils/navigate"
import { deleteEncryptionKey } from "interface/utils/encryption"
import { getSettings, setSettings } from "interface/stores/settings"
import * as os from "@tauri-apps/plugin-os"
import * as dialog from "interface/utils/dialog"
import * as process from "@tauri-apps/plugin-process"
import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
import { revealItemInDir } from "@tauri-apps/plugin-opener"

import { getLanguage } from "interface/utils/language"

export interface SystemInfo {
	osName: string
	osArch: string
	cpuName: string
	totalMem: number
}

let cachedTauriVersion = ""
let cachedSystemInfo: SystemInfo | null = null

export const prefetchAboutInfo = async () => {
	try {
		if (!cachedTauriVersion) cachedTauriVersion = await app.getTauriVersion()
		if (!cachedSystemInfo) cachedSystemInfo = await invoke<SystemInfo>("system_info")
	} catch (e) {}
}

if (typeof window !== "undefined") {
	prefetchAboutInfo().catch(() => {})
}

export const about = async () => {
	const curLang = getLanguage()
	const ab = (curLang as any).about || {}

	if (!cachedTauriVersion) {
		cachedTauriVersion = await app.getTauriVersion().catch(() => "2.11.5")
	}
	const osVersion = os.version()

	// Browser version
	interface userAgentData {
		fullVersionList?: { version: string }[]
	}

	let runtimeVersion = navigator.userAgent

	try {
		// @ts-ignore
		const ua: userAgentData = await navigator.userAgentData.getHighEntropyValues(["architecture", "model", "platform", "platformVersion", "fullVersionList"])

		if (ua.fullVersionList !== undefined && ua.fullVersionList.length > 0) {
			// @ts-ignore
			runtimeVersion = ua.fullVersionList.filter((item) => item.brand === "Chromium")[0]?.version || "N/A"
		}
	} catch (error) {
		console.log(error)
	}

	// System info
	if (!cachedSystemInfo) {
		cachedSystemInfo = await invoke<SystemInfo>("system_info").catch(() => ({
			osName: "Windows",
			osArch: "x64",
			cpuName: "Processor",
			totalMem: 16 * 1024 * 1024 * 1024,
		}))
	}

	const cpu = cachedSystemInfo.cpuName
		.split("@")[0]
		.replaceAll("(R)", "")
		.replaceAll("(TM)", "")
		.replace(/ +(?= )/g, "")
	const memory = `${Math.round(cachedSystemInfo.totalMem / 1024 / 1024 / 1024)} GB`
	const osName = cachedSystemInfo.osName
	const osArch = cachedSystemInfo.osArch

	const info = `Authme: ${build.version}\n\n${ab.tauri || "Tauri"}: ${cachedTauriVersion}\n${ab.runtime || "Runtime"}: ${runtimeVersion}\n\n${ab.osVersion || "OS version"}: ${osName} ${osArch} ${osVersion}\n${ab.hardwareInfo || "Hardware info"}: ${cpu} ${memory} ${ab.ram || "RAM"}\n\n${ab.releaseDate || "Release date"}: ${build.date}\n${ab.buildNumber || "Build number"}: ${build.number}\n\n${ab.github || "GitHub"}: https://github.com/phwyverysad/Authme\n${ab.developer || "Developer"}: phwyverysad`

	const res = await dialog.confirm(info, {
		title: ab.dialogTitle || "Authme",
		kind: "info",
		cancelLabel: ab.close || curLang.common?.close || "Close",
		okLabel: ab.openGithub || "Open GitHub",
	})

	if (res) {
		open("https://github.com/phwyverysad/Authme")
		clipboard.writeText(info)
	}
}

/**
 * Delete selected data
 */
export const clearData = async (clearCodesOption: boolean, clearSettingsOption: boolean) => {
	const dialogClearData: LibDialogElement = document.querySelector(".dialogClearData")

	// clear codes
	if (clearCodesOption && !clearSettingsOption) {
		const curLang = getLanguage()
		const confirm0 = await dialog.ask(curLang.settings?.confirmClearCodes || "Are you sure you want to clear 2FA codes? \n\nThis cannot be undone!", { kind: "warning" })

		if (confirm0 === false) {
			return
		}

		const settings = getSettings()
		settings.vault.codes = null
		setSettings(settings)

		dialogClearData.close()
		navigate("codes")
	}

	// clear settings
	if (!clearCodesOption && clearSettingsOption) {
		const curLang = getLanguage()
		const confirm0 = await dialog.ask(curLang.settings?.confirmClearSettings || "Are you sure you want to clear all settings? \n\nThis cannot be undone!", { kind: "warning" })

		if (confirm0 === false) {
			return
		}

		const settings = getSettings()
		settings.settings.language = 0
		settings.settings.launchOnStartup = true
		settings.settings.minimizeToTray = true
		settings.settings.optionalAnalytics = true
		settings.settings.codesDescription = false
		settings.settings.blurCodes = false
		settings.settings.sortCodes = 0
		settings.settings.codesLayout = 0
		setSettings(settings)

		dialogClearData.close()
		navigate("settings")
	}

	// clear everything
	if (clearCodesOption && clearSettingsOption) {
		const curLang = getLanguage()
		const confirm0 = await dialog.ask(curLang.settings?.confirmClearAllData || "Are you sure you want to clear all data? \n\nThis cannot be undone!", { kind: "warning" })

		if (confirm0 === false) {
			return
		}

		const confirm1 = await dialog.ask(curLang.settings?.confirmClearAllDataFinal || "Are you absolutely sure? \n\nThere is no way back!", { kind: "warning" })

		if (confirm1 === true) {
			localStorage.clear()
			sessionStorage.clear()

			await deleteEncryptionKey("encryptionKey")

			if (build.dev === false) {
				await invoke("disable_auto_launch")
				process.exit()
			} else {
				navigate("/")
				location.reload()
			}
		}
	}
}

/**
 * Show Clear data dialog
 */
export const showClearDataDialog = () => {
	const dialogClearData: LibDialogElement | null = document.querySelector(".dialogClearData")
	const closeDialog = document.querySelector(".dialogClearDataClose")

	if (closeDialog && !(closeDialog as any).__authme_listener_attached) {
		;(closeDialog as any).__authme_listener_attached = true
		closeDialog.addEventListener("click", () => {
			dialogClearData?.close()
		})
	}

	dialogClearData?.showModal()
}

export const showLogs = async () => {
	const folderPath = await path.join(await path.cacheDir(), "com.levminer.authme", "logs")
	revealItemInDir(folderPath)
}

export const setLaunchOnStartup = (enabled: boolean) => {
	const current = getSettings()
	current.settings.launchOnStartup = enabled
	setSettings(current)
	if (enabled) {
		invoke("enable_auto_launch").catch((e) => console.warn("enable_auto_launch error:", e))
	} else {
		invoke("disable_auto_launch").catch((e) => console.warn("disable_auto_launch error:", e))
	}
}

export const launchOnStartup = () => {
	const current = getSettings()
	setLaunchOnStartup(!current.settings.launchOnStartup)
}

export const setMinimizeToTray = (enabled: boolean) => {
	const current = getSettings()
	current.settings.minimizeToTray = enabled
	setSettings(current)
}

export const setRememberWindowPosition = (enabled: boolean) => {
	const current = getSettings()
	current.settings.rememberWindowPosition = enabled
	setSettings(current)
}

export const setWindowCapture = (enabled: boolean) => {
	const current = getSettings()
	current.settings.windowCapture = enabled
	setSettings(current)
	const appWindow = webviewWindow.getCurrentWebviewWindow()
	appWindow.setContentProtected(enabled).catch(() => {})
}

export const toggleWindowCapture = (windowCapture: boolean) => {
	setWindowCapture(windowCapture)
}
