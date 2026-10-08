import { BarcodeDetectorPolyfill } from "@undecaf/barcode-detector-polyfill"
import * as fs from "@tauri-apps/plugin-fs"
import * as dialog from "interface/utils/dialog"
import { getState, setState } from "../../stores/state"
import { getSettings, setSettings } from "interface/stores/settings"
import { navigate } from "../../utils/navigate"
import logger from "interface/utils/logger"
import { decodeBase64, migrationImageConverter, totpImageConverter } from "@utils/convert"
import { getLanguage, language } from "@utils/language"

/**
 * Choose images, then read QR codes
 */
export const chooseImages = async () => {
	const filePaths = await dialog.open({ multiple: true, filters: [{ name: "Image file", extensions: ["jpg", "jpeg", "png", "bmp"] }] })

	if (filePaths === null) {
		return
	}

	const images: ImageBitmap[] = []

	// Read images
	for (let i = 0; i < filePaths.length; i++) {
		const file = await fs.readFile(filePaths[i])

		const blob = new Blob([file], { type: "application/octet-binary" })
		const img = await createImageBitmap(blob)

		images.push(img)
	}

	let importString = ""
	let importedAny = false

	// Read QR codes from images sequentially
	for (let i = 0; i < images.length; i++) {
		try {
			const detector = new BarcodeDetectorPolyfill()
			const results = await detector.detect(images[i])

			if (!results || results.length === 0) {
				logger.error(`No QR code found on the #${i + 1} picture`)
				dialog.message(language.import?.errors?.noQrFound || "No QR code found on the picture.", { kind: "error" })
				continue
			}

			const res = results[0]

			if (res.rawValue.startsWith("otpauth://totp/") || res.rawValue.startsWith("otpauth-migration://")) {
				if (res.rawValue.startsWith("otpauth://totp/")) {
					importString += totpImageConverter(res.rawValue)
					importedAny = true
				} else {
					const converted = await migrationImageConverter(res.rawValue)

					if (converted === "") {
						dialog.message(language.import?.errors?.decodeFailed || "Failed to decode QR code(s).", { kind: "error" })
					} else {
						importString += converted
						importedAny = true
					}
				}
			} else {
				// Wrong QR code found
				logger.error(`Error while reading QR code: ${res.rawValue}`)
				dialog.message(language.import?.errors?.wrongQr || "Wrong QR code found on the picture.", { kind: "error" })
			}
		} catch (error) {
			logger.error(`Error while reading QR code: ${error}`)
			dialog.message(language.import?.errors?.noQrFound || "No QR code found on the picture.", { kind: "error" })
		}
	}

	if (importedAny && importString.trim() !== "") {
		dialog.message(language.codes.dialog.codesImported)

		const state = getState()
		state.importData = (state.importData ? state.importData + "\n" : "") + importString
		setState(state)

		navigate("codes")
	}
}

export const closeManualEntry = () => {
	const dialog: LibDialogElement | null = document.querySelector(".dialog0")
	const nameInput = document.querySelector(".name") as HTMLInputElement | null
	const secretInput = document.querySelector(".secret") as HTMLInputElement | null
	const descInput = document.querySelector(".description") as HTMLInputElement | null
	if (nameInput) nameInput.value = ""
	if (secretInput) secretInput.value = ""
	if (descInput) descInput.value = ""
	dialog?.close()
}

export const showManualEntry = () => {
	const dialog: LibDialogElement | null = document.querySelector(".dialog0")
	dialog?.showModal()
}

/**
 * Show tutorial dialog
 */
type tutorialType = "google" | "totp" | "authme" | "aegis" | "2fas" | "bitwarden" | "proton" | "authenticatorcc"

export const showTutorial = (type: tutorialType) => {
	const dialog: LibDialogElement = document.querySelector(".tutorialDialog")
	const closeDialog = document.querySelector(".tutorialDialogClose")

	// list element
	const list = document.querySelector(".tutorialList")
	const tutorialTitle = document.querySelector(".tutorialTitle")
	const tutorialDescription = document.querySelector(".tutorialDescription")
	list.innerHTML = ""

	if (type === "google") {
		const elements = language.import.googleAuthTutorial
		tutorialTitle.innerHTML = language.import.googleAuthQRCode
		tutorialDescription.innerHTML = language.import.googleAuthQRCodeText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "totp") {
		const elements = language.import.totpTutorial
		tutorialTitle.innerHTML = language.import.totpQRCode
		tutorialDescription.innerHTML = language.import.totpQRCodeText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "authme") {
		const elements = language.import.authmeTutorial
		tutorialTitle.innerHTML = language.import.authme
		tutorialDescription.innerHTML = language.import.authmeText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "aegis") {
		const elements = language.import.aegisTutorial
		tutorialTitle.innerHTML = language.import.aegisAuth
		tutorialDescription.innerHTML = language.import.aegisAuthText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "2fas") {
		const elements = language.import.twoFasTutorial
		tutorialTitle.innerHTML = language.import.twoFasAuth
		tutorialDescription.innerHTML = language.import.twoFasAuthText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "bitwarden") {
		const elements = language.import.bitwardenTutorial
		tutorialTitle.innerHTML = language.import.bitwardenAuth
		tutorialDescription.innerHTML = language.import.bitwardenAuthText
		
		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "proton") {
		const elements = language.import.protonTutorial
		tutorialTitle.innerHTML = language.import.protonAuth
		tutorialDescription.innerHTML = language.import.protonAuthText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	} else if (type === "authenticatorcc") {
		const elements = language.import.authenticatorccTutorial
		tutorialTitle.innerHTML = language.import.authenticatorccAuth
		tutorialDescription.innerHTML = language.import.authenticatorccAuthText

		for (let i = 0; i < elements.length; i++) {
			list.innerHTML += `<li>${elements[i]}</li>`
		}
	}

	dialog?.showModal()
}

export const closeTutorial = () => {
	const dialog: LibDialogElement | null = document.querySelector(".tutorialDialog")
	dialog?.close()
}

/**
 * Enter a TOTP code manually
 */
export const manualEntry = () => {
	const issuer = (document.querySelector(".name") as HTMLInputElement)?.value?.trim() ?? ""
	const secret = (document.querySelector(".secret") as HTMLInputElement)?.value?.trim() ?? ""
	let name = (document.querySelector(".description") as HTMLInputElement)?.value?.trim() ?? ""

	if (issuer === "") {
		return dialog.message(language.import?.errors?.nameRequired || "The name field is required.", { kind: "error" })
	}

	if (secret === "") {
		return dialog.message(language.import?.errors?.secretRequired || "The secret field is required.", { kind: "error" })
	}

	if (name === "") {
		name = issuer
	}

	const importString = `\nName:   ${name} \nSecret: ${secret} \nIssuer: ${issuer} \nType:   OTP_TOTP\n`

	const state = getState()
	state.importData = (state.importData ? state.importData + "\n" : "") + importString
	setState(state)

	navigate("codes")
}

/**
 * Import all codes from an .authme file
 */
export const chooseFile = async () => {
	const state = getState()
	const settings = getSettings()
	const filePath = await dialog.open({ filters: [{ name: "Authme file", extensions: ["authme"] }] })

	if (filePath !== null) {
		const loadedFile = await fs.readTextFile(filePath)
		const file: LibAuthmeFile = JSON.parse(loadedFile)
		const importString = decodeBase64(file.codes)

		const hasExistingCodes = Boolean(settings.vault?.codes || state.importData)
		let shouldMerge = false

		if (hasExistingCodes) {
			shouldMerge = await dialog.ask(
				language.import?.mergeOrReplacePrompt || "Existing 2FA codes found in your vault.\n\nDo you want to MERGE the imported codes with your existing codes, or REPLACE them completely?",
				{
					title: language.import?.importOptionsTitle || "Import .authme file",
					okLabel: language.import?.mergeButton || "Merge",
					cancelLabel: language.import?.replaceButton || "Replace",
					kind: "info",
				}
			)
		}

		if (shouldMerge) {
			state.importData = (state.importData ? state.importData + "\n" : "") + importString
		} else {
			settings.vault.codes = null
			setSettings(settings)
			state.importData = importString
		}

		setState(state)
		dialog.message(language.codes.dialog.codesImported)
		navigate("codes")
	}
}

/**
 * Import from a 2FAS backup file
 */
export const twoFasAuthFile = async () => {
	const filePath = await dialog.open({ filters: [{ name: "2FAS file", extensions: ["2fas"] }] })

	interface TwoFasFile {
		services: {
			name: string
			secret: string
			otp: {
				link: string
				tokenType: string
				source: "Link" | "Manual"
			}
		}[]
	}

	if (filePath !== null) {
		const loadedFile = await fs.readTextFile(filePath)
		const file: TwoFasFile = JSON.parse(loadedFile)
		let importString = ""

		for (let i = 0; i < (file.services?.length || 0); i++) {
			const service = file.services[i]

			if (service?.otp?.tokenType === "TOTP") {
				if (service.otp.source === "Link" && service.otp.link !== undefined && service.otp.link.trim()) {
					importString += totpImageConverter(service.otp.link)
				} else {
					importString += totpImageConverter(`otpauth://totp/${service.name}?secret=${service.secret}&issuer=${service.name}`)
				}
			}
		}

		dialog.message(language.codes.dialog.codesImported)

		const state = getState()
		state.importData = (state.importData ? state.importData + "\n" : "") + importString
		setState(state)

		navigate("codes")
	}
}

/**
 * Import from an Aegis vault file
 */
export const aegisFile = async () => {
	const filePath = await dialog.open({ filters: [{ name: "Aegis vault file", extensions: ["json"] }] })

	interface AegisFile {
		db: {
			entries: {
				type: string
				name: string
				issuer: string
				info: {
					secret: string
				}
			}[]
		}
	}

	if (filePath !== null) {
		const loadedFile = await fs.readTextFile(filePath)
		const file: AegisFile = JSON.parse(loadedFile)
		let importString = ""

		for (let i = 0; i < (file.db?.entries?.length || 0); i++) {
			const entry = file.db.entries[i]

			if (entry?.type === "totp" && entry?.info?.secret) {
				importString += totpImageConverter(`otpauth://totp/${entry.name}?secret=${entry.info.secret}&issuer=${entry.issuer}`)
			}
		}

		dialog.message(language.codes.dialog.codesImported)

		const state = getState()
		state.importData = (state.importData ? state.importData + "\n" : "") + importString
		setState(state)

		navigate("codes")
	}
}

/**
 * Import from a Bitwarden export file
 */
export const bitwardenFile = async () => {
	const filePath = await dialog.open({ filters: [{ name: "Bitwarden export file", extensions: ["json"] }] })

	interface BitwardenFile {
		encrypted: boolean
		items: {
			login?: {
				totp?: string
			}
		}[]
	}

	if (filePath !== null) {
		const loadedFile = await fs.readTextFile(filePath)
		const file: BitwardenFile = JSON.parse(loadedFile)
		let importString = ""

		for (let i = 0; i < (file.items?.length || 0); i++) {
			const entry = file.items[i]

			if (entry?.login?.totp) {
				importString += totpImageConverter(entry.login.totp)
			}
		}

		dialog.message(language.codes.dialog.codesImported)

		const state = getState()
		state.importData = (state.importData ? state.importData + "\n" : "") + importString
		setState(state)

		navigate("codes")
	}
}

/**
 * Import from a Proton Authenticator export file
 */
export const protonFile = async () => {
	const filePath = await dialog.open({ filters: [{ name: "Proton Authenticator export file", extensions: ["json", "txt"] }] })

	interface ProtonFile {
		entries: {
			content?: {
				uri?: string
				name?: string
			}
		}[]
	}

	if (filePath !== null) {
		const loadedFile = await fs.readTextFile(filePath)
		const file: ProtonFile = JSON.parse(loadedFile)
		let importString = ""

		if (!file.entries) {
			return dialog.message(language.import?.errors?.noEntriesInFile || "No entries found in the selected file!", { kind: "error" })
		}

		for (let i = 0; i < file.entries.length; i++) {
			const entry = file.entries[i]

			if (entry?.content?.uri?.startsWith("otpauth://totp/")) {
				importString += totpImageConverter(entry.content.uri)
			}
		}

		dialog.message(language.codes.dialog.codesImported)

		const state = getState()
		state.importData = (state.importData ? state.importData + "\n" : "") + importString
		setState(state)

		navigate("codes")
	}
}

/**
 * Import from an authenticator.cc export file
 */
export const authenticatorcc = async () => {
	const filePath = await dialog.open({ filters: [{ name: "Authenticator.cc export file", extensions: ["txt"] }] })

	if (filePath !== null) {
		const loadedFile = await fs.readTextFile(filePath)
		let importString = ""

		const lines = loadedFile.split(/\r?\n/)
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim()

			if (line.startsWith("otpauth://totp/")) {
				importString += totpImageConverter(line)
			}
		}

		dialog.message(language.codes.dialog.codesImported)

		const state = getState()
		state.importData = (state.importData ? state.importData + "\n" : "") + importString
		setState(state)

		navigate("codes")
	}
}

/**
 * Start a video capture, when a QR code detected try to read it
 */
export const captureScreen = async () => {
	const dialogElement: LibDialogElement = document.querySelector(".dialog1")
	const videoElement: HTMLVideoElement = document.querySelector(".video")
	let interval: NodeJS.Timeout

	const titleEl = document.querySelector(".dialog1Title")
	if (titleEl) titleEl.textContent = language.import?.screenCapture || "Screen capture"

	try {
		videoElement.srcObject = await navigator.mediaDevices.getDisplayMedia({ audio: false })
		const track = videoElement.srcObject.getTracks()[0]

		dialogElement.showModal()

		document.querySelector(".stopVideo").addEventListener("click", () => {
			clearInterval(interval)
			track.stop()

			dialogElement.close()
		})

		const detect = async () => {
			logger.log("Checking for QR code on screen...")

			const detector = new BarcodeDetectorPolyfill()
			const results = await detector.detect(videoElement)

			// Check if a QR code was found
			if (results.length === 0) {
				return
			}

			const res = results[0]

			let importString = ""

			if (res.rawValue.startsWith("otpauth://totp/") || res.rawValue.startsWith("otpauth-migration://")) {
				if (res.rawValue.startsWith("otpauth://totp/")) {
					importString += totpImageConverter(res.rawValue)
				} else {
					const converted = await migrationImageConverter(res.rawValue)

					if (converted === "") {
						return dialog.message(language.import?.errors?.decodeFailed || "Failed to decode QR code(s).", { kind: "error" })
					} else {
						importString += converted
					}
				}

				const state = getState()
				state.importData = importString
				setState(state)

				clearInterval(interval)
				track.stop()

				dialog.message(language.codes.dialog.codesImported)

				navigate("codes")
			} else {
				// Wrong QR code found
				logger.error(`Wrong type of QR code found during screen capture: ${JSON.stringify(res)}`)
				dialog.message(language.import?.errors?.wrongQr || "Wrong type of QR code found.", { kind: "error" })

				clearInterval(interval)
				track.stop()

				dialogElement.close()
			}
		}

		// Check for QR code every second
		interval = setInterval(detect, 1000)
	} catch (err) {
		logger.error(`Error during screen capture: ${err}`)
		dialog.message(`${language.common?.error || "Error"}: \n\n${err}`, { kind: "error" })

		dialogElement.close()
	}
}

/**
 * Check for an available webcam
 */
const webcamAvailable = async () => {
	const md = navigator.mediaDevices

	if (!md || !md.enumerateDevices) {
		return false
	} else {
		const devices = await md.enumerateDevices()

		for (let i = 0; i < devices.length; i++) {
			if (devices[i].kind === "videoinput") {
				return true
			}

			if (i === devices.length - 1) {
				return false
			}
		}
	}
}

export const useWebcam = async () => {
	const hasWebcam = await webcamAvailable()

	const titleEl = document.querySelector(".dialog1Title")
	if (titleEl) titleEl.textContent = language.import?.webcam || "Webcam"

	if (hasWebcam === false) {
		// Not found webcam
		dialog.message(language.import?.errors?.webcamNotFound || "Webcam not found!", { kind: "error" })
	} else {
		const dialogElement: LibDialogElement = document.querySelector(".dialog1")
		const videoElement: HTMLVideoElement = document.querySelector(".video")
		let interval: NodeJS.Timeout

		try {
			videoElement.srcObject = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } })
			const track = videoElement.srcObject.getTracks()[0]

			dialogElement.showModal()

			document.querySelector(".stopVideo").addEventListener("click", () => {
				clearInterval(interval)
				track.stop()

				dialogElement.close()
			})

			const detect = async () => {
				logger.log("Checking for QR code with webcam...")

				const detector = new BarcodeDetectorPolyfill()
				const results = await detector.detect(videoElement)

				// Check if a QR code was found
				if (results.length === 0) {
					return
				}

				const res = results[0]

				let importString = ""

				if (res.rawValue.startsWith("otpauth://totp/") || res.rawValue.startsWith("otpauth-migration://")) {
					if (res.rawValue.startsWith("otpauth://totp/")) {
						importString += totpImageConverter(res.rawValue)
					} else {
						const converted = await migrationImageConverter(res.rawValue)

						if (converted === "") {
							return dialog.message(language.import?.errors?.decodeFailed || "Failed to decode QR code(s).", { kind: "error" })
						} else {
							importString += converted
						}
					}

					const state = getState()
					state.importData = importString
					setState(state)

					clearInterval(interval)
					track.stop()

					dialog.message(language.codes.dialog.codesImported)

					navigate("codes")
				} else {
					// Wrong QR code found
					dialog.message(language.import?.errors?.wrongQr || "Wrong type of QR code found.", { kind: "error" })
					logger.error(`Wrong type of QR code found during webcam import: ${JSON.stringify(res)}`)

					clearInterval(interval)
					track.stop()

					dialogElement.close()
				}
			}

			// Check for QR code every second
			interval = setInterval(detect, 1000)
		} catch (err) {
			logger.error(`Error occurred while using the webcam: ${err}`)
			dialog.message(`${language.common?.error || "Error"}: \n\n${err}`, { kind: "error" })

			dialogElement.close()
		}
	}
}
