import { webviewWindow } from "@tauri-apps/api"
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi"
import { getSettings, setSettings } from "../stores/settings"

const appWindow = webviewWindow.getCurrentWebviewWindow()
let saveTimeout: NodeJS.Timeout | null = null

export const initWindowBounds = async () => {
	try {
		const settings = getSettings()
		const enabled = settings?.settings?.rememberWindowPosition ?? true

		if (settings?.settings?.windowPosition) {
			const wp = settings.settings.windowPosition
			if (
				wp.x === undefined ||
				wp.y === undefined ||
				wp.x < -500 ||
				wp.y < -500 ||
				(wp.width !== undefined && wp.width < 400) ||
				(wp.height !== undefined && wp.height < 300)
			) {
				// Clear corrupted bounds saved during Windows minimization (-32000)
				settings.settings.windowPosition = null
				setSettings(settings)
			}
		}

		// Window position and size are restored natively in Rust before window.show()
		// to guarantee smooth, instant appearance without post-launch warping.


		// Only focus if the window is already visible (do not force-show if launched minimized)
		try {
			const isVisible = await appWindow.isVisible()
			if (isVisible) {
				await appWindow.setFocus()
			}
		} catch (err) {}

		// Track position & size changes with debounce
		const recordBounds = async () => {
			const s = getSettings()
			if (!(s?.settings?.rememberWindowPosition ?? true)) return

			if (saveTimeout) clearTimeout(saveTimeout)
			saveTimeout = setTimeout(async () => {
				try {
					const isMin = await appWindow.isMinimized()
					if (isMin) return

					const isMax = await appWindow.isMaximized()
					if (isMax) {
						if (!s.settings.windowPosition) {
							s.settings.windowPosition = { x: 0, y: 0, width: 1280, height: 800, maximized: true }
						} else {
							s.settings.windowPosition.maximized = true
						}
						setSettings(s)
						return
					}

					const pos = await appWindow.outerPosition()
					const size = await appWindow.outerSize()

					// Ignore invalid coordinates reported during window minimization or hiding (-32000)
					if (pos.x < -500 || pos.y < -500 || size.width < 400 || size.height < 300) {
						return
					}

					s.settings.windowPosition = {
						x: pos.x,
						y: pos.y,
						width: size.width,
						height: size.height,
						maximized: false,
					}
					setSettings(s)
				} catch (e) {}
			}, 600)
		}

		appWindow.onMoved(recordBounds)
		appWindow.onResized(recordBounds)
	} catch (e) {
		console.error("Failed to init window bounds:", e)
	}
}
