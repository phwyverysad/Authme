import { navigate } from "../../utils/navigate"
import { getSettings, setSettings } from "../../stores/settings"
import { getState, setState } from "../../stores/state"
import { invoke } from "@tauri-apps/api/core"
import * as dialog from "interface/utils/dialog"
import { setEntry, generateRandomKey, setEncryptionKey, createWebAuthnLogin, verifyWebAuthnLogin } from "interface/utils/encryption"
import { search } from "interface/utils/password"
import { encodeBase64, encodeBytesToBase64 } from "@utils/convert"
import { getLanguage, language } from "@utils/language"

export const noPassword = async () => {
	const settings = getSettings()
	const state = getState()

	if (settings.security.hardwareAuthentication === true) {
		const createRes = await createWebAuthnLogin()

		if (createRes === "error") {
			return
		}

		const loginRes = await verifyWebAuthnLogin()

		if (loginRes === "error") {
			return
		}
	}

	const key = await generateRandomKey(32)

	await setEntry("encryptionKey", encodeBytesToBase64(key))
	await setEncryptionKey()

	settings.security.requireAuthentication = false
	state.authenticated = true

	setSettings(settings)
	setState(state)

	navigate("codes")
}

export const requirePassword = () => {
	const reqEl = document.querySelector(".requirePassword") as HTMLElement | null
	const landEl = document.querySelector(".landing") as HTMLElement | null
	if (reqEl) reqEl.style.display = "block"
	if (landEl) landEl.style.display = "none"
}

export const createPassword = async () => {
	const settings = getSettings()

	const input0 = document.querySelector(".passwordInput0") as HTMLInputElement | null
	const input1 = document.querySelector(".passwordInput1") as HTMLInputElement | null

	if (!input0 || !input1) return

	if (input0.value !== input1.value) {
		return dialog.message(language.landing.dialog.passwordsNotMatch, { kind: "error" })
	}

	if (input0.value.length < 8) {
		return dialog.message(language.landing.dialog.passwordMinLength, { kind: "error" })
	} else if (input0.value.length > 64) {
		return dialog.message(language.landing.dialog.passwordMaxLength, { kind: "error" })
	}

	if (search(input0.value)) {
		return dialog.message(language.landing.dialog.commonPassword, { kind: "error" })
	}

	if (settings.security.hardwareAuthentication === true) {
		const createRes = await createWebAuthnLogin()

		if (createRes === "error") {
			return
		}

		const loginRes = await verifyWebAuthnLogin()

		if (loginRes === "error") {
			return
		}
	}

	settings.security.password = encodeBase64(await invoke("encrypt_password", { password: input0.value }))
	settings.security.requireAuthentication = true

	setSettings(settings)

	navigate("confirm")
}

export const appController = async () => {
	const settings = getSettings()
	const state = getState()

	if (settings.security.requireAuthentication === false) {
		await setEncryptionKey()

		state.authenticated = true
		setState(state)

		navigate("codes")
	} else if (settings.security.requireAuthentication === true) {
		navigate("confirm")
	}
}

export const showPassword = (id: number) => {
	const inputEl = document.querySelector(`.passwordInput${id}`) as HTMLInputElement | null
	if (!inputEl) return

	const inputState = inputEl.getAttribute("type")
	const showEl = document.querySelector(`.showPassword${id}`) as HTMLElement | null
	const hideEl = document.querySelector(`.hidePassword${id}`) as HTMLElement | null

	if (inputState === "password") {
		if (showEl) showEl.style.display = "none"
		if (hideEl) hideEl.style.display = "block"

		inputEl.setAttribute("type", "text")
	} else {
		if (showEl) showEl.style.display = "block"
		if (hideEl) hideEl.style.display = "none"

		inputEl.setAttribute("type", "password")
	}
}
