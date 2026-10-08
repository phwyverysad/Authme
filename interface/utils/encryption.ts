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
	window.crypto.getRandomValues(array)
	return array.buffer
}

/**
 * Encrypts a string with the encryption key
 */
export const encryptData = async (data: string): Promise<string> => {
	return await invoke("encrypt_data", { data })
}

/**
 * Decrypts a string with the encryption key
 */
export const decryptData = async (data: string): Promise<string> => {
	if (!data || data.trim() === "") return ""
	const res: string = await invoke("decrypt_data", { data })

	if (res === "error") {
		dialog.message(getLanguage().encryption?.decryptFailed || "Failed to decrypt your vault! Please restart Authme and try again.", { kind: "error" })
	}

	return res
}

/**
 * Sets an entry on the system keychain
 */
export const setEntry = async (name: string, data: string) => {
	const res = await invoke("set_entry", { name, data, service })

	if (res === "error") {
		dialog.message(getLanguage().encryption?.keychainFailed || "Failed to set encryption key on system keychain. You can use the password method.", { kind: "error" })
	}

	return res
}

let setEncryptionKeyPromise: Promise<string> | null = null
export const setEncryptionKey = async (): Promise<string> => {
	if (setEncryptionKeyPromise) return setEncryptionKeyPromise
	setEncryptionKeyPromise = (async () => {
		try {
			const res: string = await invoke("set_encryption_key", { service })
			if (res === "error") {
				dialog.message(getLanguage().encryption?.keychainFailed || "Failed to set encryption key on system keychain. Please restart Authme and try again.", { kind: "error" })
			}
			return res
		} finally {
			setEncryptionKeyPromise = null
		}
	})()
	return setEncryptionKeyPromise
}

/**
 * Set the encryption key on the backend
 */
export const sendEncryptionKey = async (key: string) => {
	return await invoke("receive_encryption_key", { key })
}

/**
 * Clear the active encryption key from backend memory
 */
export const clearEncryptionKey = async (): Promise<void> => {
	setEncryptionKeyPromise = null
	await invoke("clear_encryption_key")
}

/**
 * Delete encryption key
 */
export const deleteEncryptionKey = async (name: string) => {
	return await invoke("delete_entry", { name, service })
}

/**
 * Create a new WebAuthn credential
 */
export const createWebAuthnLogin = async () => {
	try {
		const res = await navigator.credentials.create({
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
		})

		const currentSettings = getSettings()
		currentSettings.security.hardwareAuthentication = true
		currentSettings.security.hardwareKey = res.id
		setSettings(currentSettings)
	} catch (error) {
		dialog.message(`${getLanguage().encryption?.webauthnRegisterFailed || "Failed to register hardware key."} \n\n${error}`, { kind: "error" })

		logger.error(`Failed to register hardware key: ${error}`)

		return "error"
	}
}

/**
 * Get an existing WebAuthn credential
 */
export const verifyWebAuthnLogin = async () => {
	try {
		const res = await navigator.credentials.get({
			publicKey: {
				timeout: 60000,
				challenge: await generateRandomKey(64),
				userVerification: "discouraged",
			},
		})

		const currentSettings = getSettings()
		if (res.id !== currentSettings.security.hardwareKey) {
			dialog.message(getLanguage().encryption?.webauthnKeyMismatch || "Failed to authenticate. The selected hardware key does not match the saved key.", { kind: "error" })

			return "error"
		}
	} catch (error) {
		dialog.message(`${getLanguage().encryption?.webauthnLoginFailed || "Failed to login with your hardware key. Please try again!"} \n\n${error}`, { kind: "error" })

		logger.error(`Failed to login with hardware key: ${error}`)

		return "error"
	}
}
