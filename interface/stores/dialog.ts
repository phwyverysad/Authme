import { writable } from "svelte/store"
import { language } from "@utils/language"

export interface ToastItem {
	id: string
	message: string
	kind: "info" | "success" | "warning" | "error"
	title?: string
	code?: string
}

export interface ModalItem {
	title?: string
	message: string
	kind: "info" | "warning" | "error"
	okLabel?: string
	cancelLabel?: string
	resolve: (value: boolean) => void
}

export interface ContextMenuItem {
	x: number
	y: number
	index: number
	issuer: string
	name: string
	token: string
	secret: string
	pinned?: boolean
}

export interface EditModalItem {
	index: number
	issuer: string
	name: string
	secret?: string
}

export interface QrModalItem {
	issuer: string
	name: string
	secret: string
	qrDataUrl: string
}

export const toasts = writable<ToastItem[]>([])
export const activeModal = writable<ModalItem | null>(null)
export const activeContextMenu = writable<ContextMenuItem | null>(null)
export const activeEditModal = writable<EditModalItem | null>(null)
export const activeQrModal = writable<QrModalItem | null>(null)
export const activePasswordModal = writable<boolean>(false)
export const activeDisablePasswordModal = writable<boolean>(false)
export const activeEnablePasswordModal = writable<boolean>(false)
export const activeResetModal = writable<boolean>(false)

const toastTimers = new Map<string, { timeout: ReturnType<typeof setTimeout>; remaining: number; startedAt: number }>()

export const showToast = (
	message: string,
	kind: "info" | "success" | "warning" | "error" = "info",
	title?: string,
	code?: string
) => {
	const id = Math.random().toString(36).substring(2, 9)
	toasts.update((items) => [...items, { id, message, kind, title, code }])
	const timeout = setTimeout(() => {
		removeToast(id)
	}, 4200)
	toastTimers.set(id, { timeout, remaining: 4200, startedAt: Date.now() })
}

export const removeToast = (id: string) => {
	const timer = toastTimers.get(id)
	if (timer) {
		clearTimeout(timer.timeout)
		toastTimers.delete(id)
	}
	toasts.update((items) => items.filter((t) => t.id !== id))
}

export const pauseToast = (id: string) => {
	const timer = toastTimers.get(id)
	if (timer) {
		clearTimeout(timer.timeout)
		const elapsed = Date.now() - timer.startedAt
		timer.remaining = Math.max(0, timer.remaining - elapsed)
	}
}

export const resumeToast = (id: string) => {
	const timer = toastTimers.get(id)
	if (timer && timer.remaining > 0) {
		timer.startedAt = Date.now()
		timer.timeout = setTimeout(() => {
			removeToast(id)
		}, timer.remaining)
	}
}

export const askModal = (
	message: string,
	options?: { title?: string; kind?: "info" | "warning" | "error"; okLabel?: string; cancelLabel?: string }
): Promise<boolean> => {
	return new Promise((resolve) => {
		activeModal.set({
			title: options?.title || "Authme",
			message,
			kind: options?.kind || "warning",
			okLabel: options?.okLabel || language.common?.yes || "Yes",
			cancelLabel: options?.cancelLabel || language.common?.no || "No",
			resolve: (val: boolean) => {
				activeModal.set(null)
				resolve(val)
			},
		})
	})
}
