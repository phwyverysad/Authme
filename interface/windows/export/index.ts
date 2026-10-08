import * as fs from "@tauri-apps/plugin-fs"
import * as dialog from "../../utils/dialog"
import { showToast } from "../../stores/dialog"
import { generateTimestamp } from "../../utils/time"
import { encodeBase64, textConverter } from "../../utils/convert"
import { getSettings } from "../../stores/settings"
import { decryptData, verifyWebAuthnLogin } from "../../utils/encryption"
import { navigate } from "@utils/navigate"
import { getLanguage } from "@utils/language"
import { loadMailAccounts } from "../../stores/mail"
import { writable, get } from "svelte/store"
import {
	buildOtpauthUri,
	generateQrDataUrl,
	formatSecretGroups,
	generateAuthmeCodesText,
	generateJsonExport,
	generateCsvExport,
	generateTxtExport,
	generateHtmlDocument,
	generateMigrationPayload,
	generateMigrationBatches,
	generateMailJsonExport,
	generateMailCsvExport,
	generateMailTxtExport,
	escapeHtml,
	escapeJsString,
	type ExportAccountItem,
	type ExportMailItem,
	type MigrationBatch,
} from "./formats"

export {
	buildOtpauthUri,
	generateQrDataUrl,
	formatSecretGroups,
	generateAuthmeCodesText,
	generateJsonExport,
	generateCsvExport,
	generateTxtExport,
	generateHtmlDocument,
	generateMigrationPayload,
	generateMigrationBatches,
	generateMailJsonExport,
	generateMailCsvExport,
	generateMailTxtExport,
	escapeHtml,
	escapeJsString,
	type ExportAccountItem,
	type ExportMailItem,
	type MigrationBatch,
}

export interface ExportAccount extends ExportAccountItem {
	id: string
	index: number
	issuer: string
	name: string
	secret: string
	type: string
	selected: boolean
}

// 2FA Accounts Export State
export const exportAccounts = writable<ExportAccount[]>([])
export const isExportLoading = writable<boolean>(true)
export const exportError = writable<string>("")

// Mail Accounts Export State
export const exportMailAccounts = writable<ExportMailItem[]>([])
export const isMailExportLoading = writable<boolean>(false)
export const mailExportError = writable<string>("")

/**
 * Initialize and load 2FA accounts available for export
 */
export const loadExportAccounts = async () => {
	isExportLoading.set(true)
	exportError.set("")
	const language = getLanguage()
	const settings = getSettings()

	const codes = settings.vault.codes

	if (!codes) {
		isExportLoading.set(false)
		dialog.message(language.codes?.dialog?.noSaveFileFound || "No save file found", { kind: "error" })
		return navigate("import")
	}

	try {
		if (settings.security.hardwareAuthentication === true) {
			const res = await verifyWebAuthnLogin()
			if (res === "error") {
				isExportLoading.set(false)
				exportError.set("Hardware authentication failed")
				return
			}
		}

		const decryptedText = await decryptData(codes)
		if (!decryptedText || decryptedText === "error") {
			isExportLoading.set(false)
			exportError.set(language.export?.exportFailed || "Failed to decrypt vault data")
			return
		}

		const parsed = textConverter(decryptedText, 0)
		const list: ExportAccount[] = []

		for (let i = 0; i < parsed.names.length; i++) {
			const issuer = parsed.issuers[i] || parsed.names[i] || "Unknown"
			const name = parsed.names[i] || ""
			const secret = (parsed.secrets[i] || "").replace(/[\s-]+/g, "").toUpperCase()
			const type = parsed.types[i] || "OTP_TOTP"
			const id = parsed.uniqIds[i] || `exp_${i}_${secret.substring(0, 4)}`

			if (secret) {
				list.push({
					id,
					index: i,
					issuer,
					name,
					secret,
					type,
					selected: true,
				})
			}
		}

		exportAccounts.set(list)
		isExportLoading.set(false)
	} catch (err: any) {
		console.error("Failed to load export accounts:", err)
		isExportLoading.set(false)
		exportError.set(err?.message || "Failed to decrypt export accounts")
	}
}

/**
 * Initialize and load Mail accounts available for export
 */
export const loadMailExportAccounts = async () => {
	isMailExportLoading.set(true)
	mailExportError.set("")
	try {
		const accounts = await loadMailAccounts()
		const list: ExportMailItem[] = (accounts || []).map((acc) => ({
			id: acc.id,
			provider: acc.provider,
			name: acc.name,
			email: acc.email,
			label: acc.label || "",
			custom_url: acc.custom_url || "",
			unread_count: acc.unread_count || 0,
			created_at: acc.created_at || Date.now(),
			selected: true,
		}))
		exportMailAccounts.set(list)
		isMailExportLoading.set(false)
	} catch (err: any) {
		console.error("Failed to load mail accounts for export:", err)
		isMailExportLoading.set(false)
		mailExportError.set(err?.message || "Failed to load mail accounts")
	}
}

/**
 * Save selected 2FA accounts as an .authme backup file
 */
export const exportSelectedAuthmeFile = async (accounts: ExportAccount[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const selectedCodesText = generateAuthmeCodesText(accounts)

	const saveFile: LibAuthmeFile = {
		role: "codes",
		encrypted: false,
		codes: encodeBase64(selectedCodesText),
		date: generateTimestamp(),
		version: 3,
	}

	const fileContent = JSON.stringify(saveFile, null, "\t")
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_backup_${accounts.length}_accounts.authme`,
			filters: [{ name: "Authme file (*.authme)", extensions: ["authme"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(fileContent))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} accounts`, "success")
		return true
	} catch (err: any) {
		console.error("Export .authme failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected 2FA accounts as a standalone HTML page with QR codes & print stylesheet
 */
export const exportSelectedHtmlFile = async (accounts: ExportAccount[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const encoder = new TextEncoder()
	const fullHtml = generateHtmlDocument(accounts)

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_2fa_qrcodes_${accounts.length}.html`,
			filters: [{ name: "HTML document (*.html)", extensions: ["html"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(fullHtml))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} QR codes`, "success")
		return true
	} catch (err: any) {
		console.error("Export HTML failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected 2FA accounts as universal standard JSON
 */
export const exportSelectedJsonFile = async (accounts: ExportAccount[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const fileContent = generateJsonExport(accounts)
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_2fa_backup_${accounts.length}.json`,
			filters: [{ name: "JSON file (*.json)", extensions: ["json"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(fileContent))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} accounts`, "success")
		return true
	} catch (err: any) {
		console.error("Export JSON failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected 2FA accounts as CSV spreadsheet
 */
export const exportSelectedCsvFile = async (accounts: ExportAccount[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const csvContent = generateCsvExport(accounts)
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_2fa_spreadsheet_${accounts.length}.csv`,
			filters: [{ name: "CSV spreadsheet (*.csv)", extensions: ["csv"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(csvContent))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} accounts`, "success")
		return true
	} catch (err: any) {
		console.error("Export CSV failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected 2FA accounts as plain text list of otpauth:// URIs
 */
export const exportSelectedTxtFile = async (accounts: ExportAccount[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const uris = generateTxtExport(accounts)
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_2fa_uris_${accounts.length}.txt`,
			filters: [{ name: "Text file (*.txt)", extensions: ["txt"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(uris))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} URIs`, "success")
		return true
	} catch (err: any) {
		console.error("Export TXT failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected Mail accounts as JSON
 */
export const exportSelectedMailJson = async (accounts: ExportMailItem[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const fileContent = generateMailJsonExport(accounts)
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_mail_backup_${accounts.length}.json`,
			filters: [{ name: "JSON file (*.json)", extensions: ["json"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(fileContent))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} mail accounts`, "success")
		return true
	} catch (err: any) {
		console.error("Export Mail JSON failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected Mail accounts as CSV spreadsheet
 */
export const exportSelectedMailCsv = async (accounts: ExportMailItem[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const csvContent = generateMailCsvExport(accounts)
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_mail_accounts_${accounts.length}.csv`,
			filters: [{ name: "CSV spreadsheet (*.csv)", extensions: ["csv"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(csvContent))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} mail accounts`, "success")
		return true
	} catch (err: any) {
		console.error("Export Mail CSV failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Save selected Mail accounts as plain text list
 */
export const exportSelectedMailTxt = async (accounts: ExportMailItem[]): Promise<boolean> => {
	const language = getLanguage()
	if (accounts.length === 0) {
		showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
		return false
	}

	const content = generateMailTxtExport(accounts)
	const encoder = new TextEncoder()

	try {
		const filePath = await dialog.save({
			defaultPath: `authme_mail_accounts_${accounts.length}.txt`,
			filters: [{ name: "Text file (*.txt)", extensions: ["txt"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, encoder.encode(content))
		showToast(`${language.export?.exportSuccess || "Exported successfully"}: ${accounts.length} mail accounts`, "success")
		return true
	} catch (err: any) {
		console.error("Export Mail TXT failed:", err)
		showToast(`${language.export?.exportFailed || "Export failed"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Download any QR code as a high-resolution PNG image
 */
export const downloadQrPngImage = async (dataUrl: string, baseFileName: string): Promise<boolean> => {
	const language = getLanguage()
	try {
		const safeTitle = baseFileName.replace(/[/\\?%*:|"<>]/g, "_").trim() || "qrcode"
		const fileName = `${safeTitle}.png`

		const img = new Image()
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve()
			img.onerror = (e) => reject(e)
			img.src = dataUrl
		})

		const canvas = document.createElement("canvas")
		const size = 600
		canvas.width = size
		canvas.height = size
		const ctx = canvas.getContext("2d")
		if (!ctx) throw new Error("Canvas context unavailable")

		ctx.fillStyle = "#ffffff"
		ctx.fillRect(0, 0, size, size)
		const pad = 40
		ctx.imageSmoothingEnabled = false
		ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2)

		const pngDataUrl = canvas.toDataURL("image/png")
		const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "")
		const binaryString = atob(base64Data)
		const bytes = new Uint8Array(binaryString.length)
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i)
		}

		const filePath = await dialog.save({
			defaultPath: fileName,
			filters: [{ name: "PNG Image (*.png)", extensions: ["png"] }],
		})

		if (!filePath) {
			showToast(language.export?.exportCanceled || "Export canceled", "info")
			return false
		}

		await fs.writeFile(filePath, bytes)
		showToast(`${language.export?.downloadQrPng || "QR Code downloaded"}: ${fileName}`, "success")
		return true
	} catch (err: any) {
		console.error("Download QR PNG error:", err)
		showToast(`${language.export?.exportFailed || "Failed to download QR code"}: ${err?.message || err}`, "error")
		return false
	}
}

/**
 * Download single account's QR code as a high-resolution PNG image
 */
export const downloadSingleQrPng = async (account: ExportAccount): Promise<boolean> => {
	const uri = buildOtpauthUri(account)
	const dataUrl = generateQrDataUrl(uri, 8, 4)
	const safeTitle = (account.issuer || account.name || "authme_2fa").trim()
	return downloadQrPngImage(dataUrl, `${safeTitle}_qrcode`)
}

// Backward compatibility bindings
export const exportCodes = loadExportAccounts
export const exportAuthmeFile = async () => {
	const all = get(exportAccounts)
	const selected = all.filter((a) => a.selected)
	return exportSelectedAuthmeFile(selected.length > 0 ? selected : all)
}
export const exportHtmlFile = async () => {
	const all = get(exportAccounts)
	const selected = all.filter((a) => a.selected)
	return exportSelectedHtmlFile(selected.length > 0 ? selected : all)
}
