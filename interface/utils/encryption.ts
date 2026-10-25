import { invoke } from "@tauri-apps/api/core"
import * as dialog from "./dialog"
import { getSettings, setSettings } from "interface/stores/settings"
import logger from "./logger"
import { dev } from "../../build.json"
import { getLanguage } from "./language"

const service = dev ? "authme_dev" : "authme"

/**
 * Generates random key
 */
export const generateRandomKey = async (length: number): Promise<ArrayBuffer> => {
	const array = new Uint8Array(length)
	const cryptoObj = typeof window !== "undefined" && window.crypto ? window.crypto : (globalThis as any).crypto
	cryptoObj.getRandomValues(array)
	return array.buffer
}

/**
 * Encrypts a string with the encryption key
 */
export const encryptData = async (data: string): Promise<string> => {
	try {
		return await invoke("encrypt_data", { data })
	} catch (e) {
		logger.error(`Encryption failed: ${e}`)
		return "error"
	}
}

let lastDecryptErrorTime = 0

/**
 * Decrypts a string with the encryption key
 * @param data Ciphertext to decrypt
 * @param silent When true, skips showing popup dialog on failure (e.g. for background speculative preload)
 */
export const decryptData = async (data: string, silent: boolean = false): Promise<string> => {
	if (!data || data.trim() === "") return ""
	try {
		const res: string = await invoke("decrypt_data", { data })

		if (res === "error" && !silent) {
			const now = Date.now()
			if (now - lastDecryptErrorTime > 8000) {
				lastDecryptErrorTime = now
				dialog.message(
					getLanguage().encryption?.decryptFailed ||
						"Failed to decrypt your vault! Please restart Authme and try again.",
					{ kind: "error" }
				)
			}
		}

		return res
	} catch (e) {
		logger.error(`Decryption failed: ${e}`)
		if (!silent) {
			const now = Date.now()
			if (now - lastDecryptErrorTime > 8000) {
				lastDecryptErrorTime = now
				dialog.message(
					getLanguage().encryption?.decryptFailed ||
						"Failed to decrypt your vault! Please restart Authme and try again.",
					{ kind: "error" }
				)
			}
		}
		return "error"
	}
}

/**
 * Sets an entry on the system keychain
 */
export const setEntry = async (name: string, data: string): Promise<string> => {
	try {
		const res: string = await invoke("set_entry", { name, data, service })

		if (res === "error") {
			dialog.message(
				getLanguage().encryption?.keychainFailed ||
					"Failed to set encryption key on system keychain. You can use the password method.",
				{ kind: "error" }
			)
		}

		return res
	} catch (e) {
		logger.error(`setEntry failed: ${e}`)
		return "error"
	}
}

let setEncryptionKeyPromise: Promise<string> | null = null
export const setEncryptionKey = async (): Promise<string> => {
	if (setEncryptionKeyPromise) return setEncryptionKeyPromise
	setEncryptionKeyPromise = (async () => {
		try {
			const res: string = await invoke("set_encryption_key", { service })
			if (res === "error") {
				dialog.message(
					getLanguage().encryption?.keychainFailed ||
						"Failed to set encryption key on system keychain. Please restart Authme and try again.",
					{ kind: "error" }
				)
			}
			return res
		} catch (e) {
			logger.error(`setEncryptionKey failed: ${e}`)
			return "error"
		} finally {
			setEncryptionKeyPromise = null
		}
	})()
	return setEncryptionKeyPromise
}

/**
 * Set the encryption key on the backend
 */
export const sendEncryptionKey = async (key: string): Promise<string> => {
	try {
		return await invoke("receive_encryption_key", { key })
	} catch (e) {
		logger.error(`sendEncryptionKey failed: ${e}`)
		return "error"
	}
}

/**
 * Clear the active encryption key from backend memory
 */
export const clearEncryptionKey = async (): Promise<void> => {
	setEncryptionKeyPromise = null
	try {
		await invoke("clear_encryption_key")
	} catch (e) {
		logger.error(`clearEncryptionKey failed: ${e}`)
	}
}

/**
 * Delete encryption key
 */
export const deleteEncryptionKey = async (name: string): Promise<string> => {
	try {
		return await invoke("delete_entry", { name, service })
	} catch (e) {
		logger.error(`deleteEncryptionKey failed: ${e}`)
		return "error"
	}
}

/**
 * Helper to convert Base64/Base64URL or raw string to Uint8Array for WebAuthn descriptor ID
 */
export const credentialIdToBuffer = (key: string): Uint8Array => {
	try {
		// Convert Base64URL to standard Base64
		let base64 = key.replace(/-/g, "+").replace(/_/g, "/")
		while (base64.length % 4 !== 0) {
			base64 += "="
		}
		const binary = atob(base64)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i)
		}
		return bytes
	} catch {
		return new TextEncoder().encode(key)
	}
}

/**
 * Create a new WebAuthn credential
 */
export const createWebAuthnLogin = async (): Promise<string | void> => {
	try {
		const res = (await navigator.credentials.create({
			publicKey: {
				rp: {
					name: "Authme Hardware Authentication",
				},

				user: {
					id: new Uint8Array(16),
					name: "Authme",
					displayName: "Authme User",
				},

				pubKeyCredParams: [
					{
						type: "public-key",
						alg: -257,
					},
					{
						type: "public-key",
						alg: -7,
					},
				],

				attestation: "none",

				timeout: 60000,

				challenge: await generateRandomKey(64),
			},
		})) as PublicKeyCredential | null

		if (!res || !res.id || typeof res.id !== "string" || res.id.trim() === "") {
			throw new Error("Invalid or empty credential received from hardware device.")
		}

		const currentSettings = getSettings()
		currentSettings.security.hardwareAuthentication = true
		currentSettings.security.hardwareKey = res.id
		setSettings(currentSettings)
	} catch (error) {
		dialog.message(
			`${getLanguage().encryption?.webauthnRegisterFailed || "Failed to register hardware key."} \n\n${error}`,
			{ kind: "error" }
		)

		logger.error(`Failed to register hardware key: ${error}`)

		return "error"
	}
}

/**
 * Get an existing WebAuthn credential
 */
export const verifyWebAuthnLogin = async (): Promise<string | void> => {
	const currentSettings = getSettings()
	const savedKey = currentSettings?.security?.hardwareKey

	// Reject immediately if no hardware key is registered or if it's empty
	if (!savedKey || typeof savedKey !== "string" || savedKey.trim() === "") {
		dialog.message(
			getLanguage().encryption?.webauthnKeyMismatch || "Failed to authenticate. No hardware key is registered.",
			{ kind: "error" }
		)
		logger.error("Failed to authenticate with hardware key: No hardware key registered in settings.")
		return "error"
	}

	try {
		const keyBuffer = credentialIdToBuffer(savedKey)

		const res = (await navigator.credentials.get({
			publicKey: {
				timeout: 60000,
				challenge: await generateRandomKey(64),
				userVerification: "discouraged",
				allowCredentials: [
					{
						type: "public-key",
						id: keyBuffer as BufferSource,
					},
				],
			},
		})) as PublicKeyCredential | null

		if (!res || !res.id || res.id !== savedKey) {
			dialog.message(
				getLanguage().encryption?.webauthnKeyMismatch ||
					"Failed to authenticate. The selected hardware key does not match the saved key.",
				{ kind: "error" }
			)

			return "error"
		}
	} catch (error) {
		dialog.message(
			`${getLanguage().encryption?.webauthnLoginFailed || "Failed to login with your hardware key. Please try again!"} \n\n${error}`,
			{ kind: "error" }
		)

		logger.error(`Failed to login with hardware key: ${error}`)

		return "error"
	}
}
