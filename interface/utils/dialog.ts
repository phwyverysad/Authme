import { showToast, askModal } from "../stores/dialog"
export { open, save } from "@tauri-apps/plugin-dialog"

export const message = async (
	msg: string,
	options?: { title?: string; kind?: "info" | "warning" | "error" }
): Promise<void> => {
	const kind = options?.kind || "info"
	showToast(msg, kind, options?.title)
}

export const ask = async (
	msg: string,
	options?: { title?: string; kind?: "info" | "warning" | "error"; okLabel?: string; cancelLabel?: string }
): Promise<boolean> => {
	return askModal(msg, options)
}

export const confirm = async (
	msg: string,
	options?: { title?: string; kind?: "info" | "warning" | "error"; okLabel?: string; cancelLabel?: string }
): Promise<boolean> => {
	return askModal(msg, options)
}
