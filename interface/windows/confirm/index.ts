import { navigate } from "../../utils/navigate"
import { getSettings } from "../../stores/settings"
import { invoke } from "@tauri-apps/api/core"
import * as dialog from "interface/utils/dialog"
import { getState, setState } from "../../stores/state"
import { sendEncryptionKey, verifyWebAuthnLogin } from "interface/utils/encryption"
import { decodeBase64 } from "@utils/convert"
import { getLanguage, language } from "@utils/language"

export const confirmPassword = async () => {
	const settings = getSettings()
	const state = getState()
	const inputEl = document.querySelector(".passwordInput") as HTMLInputElement | null
	if (!inputEl) return
	const input = inputEl.value || ""

	if (!settings.security?.password) {
		dialog.message(language.confirm.dialog.wrongPassword, { kind: "error" })
		return
	}

	const result = await invoke("verify_password", { password: input, hash: decodeBase64(settings.security.password) })

	if (result === true) {
		if (settings.security.hardwareAuthentication === true) {
			const res = await verifyWebAuthnLogin()

			if (res === "error") {
				return
			}
		}

		await sendEncryptionKey(input)

		state.authenticated = true
		setState(state)

		navigate("codes")
	} else {
		dialog.message(language.confirm.dialog.wrongPassword, { kind: "error" })
	}
}

export const showPassword = () => {
	const inputEl = document.querySelector(".passwordInput") as HTMLInputElement | null
	if (!inputEl) return

	const inputState = inputEl.getAttribute("type")
	const showEl = document.querySelector(".showPassword") as HTMLElement | null
	const hideEl = document.querySelector(".hidePassword") as HTMLElement | null

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
