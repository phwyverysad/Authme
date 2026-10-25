import { invoke } from "@tauri-apps/api/core"
import * as dialog from "./dialog"
import { getState, setState } from "../stores/state"
import { TOTP } from "otpauth"
import logger from "./logger"
import { cleanAccountName } from "./icons"
import { getLanguage } from "./language"

interface ParsedEntry {
	name: string
	secret: string
	issuer: string
	type: string
}

/**
 * Convert codes from plain text to arrays
 * @param {string} text
 * @param {number} sortNumber
 * @return {LibImportFile} Import file structure
 */
export const textConverter = (text: string, sortNumber: number): LibImportFile => {
	if (!text || text.trim() === "") {
		return {
			names: [],
			secrets: [],
			issuers: [],
			types: [],
			uniqIds: [],
		}
	}

	// Normalize text: strip double quotes, split attribute keys on commas if inline, split on lines
	const lines = text
		.replace(/"/g, "")
		.replace(/,\s*(Name|Secret|Issuer|Type)\s*:/gi, "\n$1:")
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0)

	const parsedEntries: ParsedEntry[] = []
	let currentEntry: Partial<ParsedEntry> | null = null

	const flushEntry = () => {
		if (currentEntry && (currentEntry.name || currentEntry.secret || currentEntry.issuer)) {
			const name = currentEntry.name || currentEntry.issuer || "Unknown"
			const rawSecret = (currentEntry.secret || "").replace(/[\s-]+/g, "").toUpperCase()
			const issuer = currentEntry.issuer || name
			const type = currentEntry.type || "OTP_TOTP"
			if (rawSecret) {
				parsedEntries.push({ name, secret: rawSecret, issuer, type })
			}
		}
		currentEntry = null
	}

	for (const line of lines) {
		const nameMatch = line.match(/^Name\s*:\s*(.*)$/i)
		const secretMatch = line.match(/^Secret\s*:\s*(.*)$/i)
		const issuerMatch = line.match(/^Issuer\s*:\s*(.*)$/i)
		const typeMatch = line.match(/^Type\s*:\s*(.*)$/i)

		if (nameMatch) {
			if (currentEntry && currentEntry.name !== undefined) {
				flushEntry()
			}
			if (!currentEntry) currentEntry = {}
			currentEntry.name = nameMatch[1].trim()
		} else if (secretMatch) {
			if (currentEntry && currentEntry.secret !== undefined) {
				flushEntry()
			}
			if (!currentEntry) currentEntry = {}
			currentEntry.secret = secretMatch[1].trim()
		} else if (issuerMatch) {
			if (currentEntry && currentEntry.issuer !== undefined) {
				flushEntry()
			}
			if (!currentEntry) currentEntry = {}
			currentEntry.issuer = issuerMatch[1].trim()
		} else if (typeMatch) {
			if (currentEntry && currentEntry.type !== undefined) {
				flushEntry()
			}
			if (!currentEntry) currentEntry = {}
			currentEntry.type = typeMatch[1].trim()
		}
	}

	flushEntry()

	const names: string[] = []
	const secrets: string[] = []
	const issuers: string[] = []
	const types: string[] = []
	const uniqIds: string[] = []
	let invalidCount = 0

	for (const entry of parsedEntries) {
		try {
			new TOTP({
				secret: entry.secret,
			}).generate()
		} catch (error) {
			invalidCount++
			logger.warn(`Skipping invalid account "${entry.name}" (${entry.issuer}): Failed to generate TOTP code from secret: ${error}`)
			continue
		}

		const cleanIssuer = (entry.issuer || "").trim()
		const cleanName = cleanAccountName(entry.name, cleanIssuer)
		names.push(cleanName)
		secrets.push(entry.secret)
		issuers.push(cleanIssuer)
		types.push(entry.type)
		uniqIds.push(crypto.randomUUID())
	}

	if (invalidCount > 0) {
		dialog.message(getLanguage().import?.errors?.totpGenFailed || "Failed to generate TOTP code from secret.", {
			kind: names.length === 0 ? "error" : "warning",
		})

		if (names.length === 0) {
			const currentState = getState()
			currentState.importData = null
			setState(currentState)

			return {
				names: [],
				secrets: [],
				issuers: [],
				types: [],
				uniqIds: [],
			}
		}
	}

	// Put unsorted codes in a map
	const codesMap = new Map<string, LibCodesFormat>()
	let sortedMap = new Map<string, LibCodesFormat>()

	for (let i = 0; i < names.length; i++) {
		codesMap.set(uniqIds[i], {
			name: names[i],
			secret: secrets[i],
			issuer: issuers[i],
			type: types[i],
		})
	}

	// Sort map
	if (sortNumber === 1) {
		sortedMap = new Map([...codesMap.entries()].sort((a, b) => a[1].issuer.localeCompare(b[1].issuer)))
	} else if (sortNumber === 2) {
		sortedMap = new Map([...codesMap.entries()].sort((a, b) => b[1].issuer.localeCompare(a[1].issuer)))
	} else {
		sortedMap = codesMap
	}

	const sortedUniqIds: string[] = []
	const sortedNames: string[] = []
	const sortedSecrets: string[] = []
	const sortedIssuers: string[] = []
	const sortedTypes: string[] = []
	sortedMap.forEach((value, key) => {
		sortedUniqIds.push(key)
		sortedNames.push(value.name)
		sortedSecrets.push(value.secret)
		sortedIssuers.push(value.issuer)
		sortedTypes.push(value.type)
	})

	return {
		names: sortedNames,
		secrets: sortedSecrets,
		issuers: sortedIssuers,
		types: sortedTypes,
		uniqIds: sortedUniqIds,
	}
}

/**
 * Convert TOTP QR code pictures to string
 * @param {string} data
 * @return {string} string
 */
export const totpImageConverter = (data: string): string => {
	try {
		if (!data || typeof data !== "string" || data.trim() === "") {
			return ""
		}

		const uri = new URL(data)

		// get name & sanitize newlines
		const rawLabel = decodeURIComponent(uri.pathname.slice(1)).replace(/[\r\n]+/g, " ").trim()

		// get secret & sanitize newlines
		const rawSecret = (uri.searchParams.get("secret") || "").replace(/[\r\n]+/g, " ").trim()
		if (!rawSecret) {
			return ""
		}

		// get issuer & sanitize newlines
		let issuer = (uri.searchParams.get("issuer") || "").replace(/[\r\n]+/g, " ").trim()

		let name = rawLabel
		if (rawLabel.includes(":")) {
			const parts = rawLabel.split(":")
			const prefix = parts[0].trim()
			const remainder = parts.slice(1).join(":").trim()
			if (!issuer || issuer === "") {
				issuer = prefix
			}
			if (remainder) {
				name = remainder
			}
		}

		// check if issuer is empty
		if (issuer === "") {
			issuer = name
		}

		name = cleanAccountName(name, issuer)

		// Sanitize CRLF injection: prevent newline injection in line-based Authme format
		const cleanName = (name || "").replace(/[\r\n]+/g, " ").trim()
		const cleanIssuer = (issuer || "").replace(/[\r\n]+/g, " ").trim()
		const cleanSecret = (rawSecret || "").replace(/[\r\n]+/g, " ").trim()

		if (!cleanSecret) {
			return ""
		}

		// add to final string
		return `\nName:   ${cleanName} \nSecret: ${cleanSecret} \nIssuer: ${cleanIssuer} \nType:   OTP_TOTP\n`
	} catch (e) {
		return ""
	}
}

/**
 * Convert Migration QR code pictures to string
 * @param {string} data
 * @return {string} string
 */
export const migrationImageConverter = async (data: string): Promise<string> => {
	// return string
	let returnString = ""

	try {
		// decode data
		const decoded: LibCodesFormat[] = await invoke("google_authenticator_converter", { secret: data })

		if (!decoded || decoded.length === 0) {
			return ""
		}

		// make a string
		decoded.forEach((element) => {
			const cleanSecret = (element.secret || "").replace(/[\r\n]+/g, " ").trim()
			if (!cleanSecret) return

			const cleanIssuer = (element.issuer || "").replace(/[\r\n]+/g, " ").trim()
			const cleanName = cleanAccountName(element.name, cleanIssuer).replace(/[\r\n]+/g, " ").trim()
			const tempString = `\nName:   ${cleanName} \nSecret: ${cleanSecret} \nIssuer: ${cleanIssuer || cleanName} \nType:   OTP_TOTP\n`
			returnString += tempString
		})
	} catch (e) {
		return ""
	}

	return returnString
}

/**
 * Convert markdown to text
 */
export const markdownConverter = (text: string) => {
	const body = text
		.replaceAll("###", "")
		.replaceAll("*", " -")
		.replaceAll(/(#[0-9])\w+/g, "")
		.replaceAll("-  ", "- ")

	return body
}

/**
 * Convert base64 to text
 */
export const decodeBase64 = (text: string): string => {
	if (!text) return ""
	try {
		const binary = atob(text)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i)
		}
		return new TextDecoder().decode(bytes)
	} catch (e) {
		logger.warn(`Failed to decode base64 string: ${e}`)
		return text
	}
}

/**
 * Convert text to base64 safely without call stack overflow
 */
export const encodeBase64 = (text: string): string => {
	if (!text) return ""
	const bytes = new TextEncoder().encode(text)
	let binary = ""
	const len = bytes.byteLength
	const chunkSize = 0x2000 // 8192
	for (let i = 0; i < len; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, len)))
	}
	return btoa(binary)
}

/**
 * Convert raw bytes (ArrayBuffer or Uint8Array) to base64 safely without UTF-8 corruption
 */
export const encodeBytesToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
	let binary = ""
	const len = bytes.byteLength
	const chunkSize = 0x2000 // 8192
	for (let i = 0; i < len; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, len)))
	}
	return btoa(binary)
}
