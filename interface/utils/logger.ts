import { path } from "@tauri-apps/api"
import { invoke } from "@tauri-apps/api/core"
import { dev } from "../../build.json"

let fileName: string

const getTime = () => {
	return new Date().toLocaleString("hu")
}

export const log = (message: string) => {
	const time = getTime()

	console.log(`[AUTHME LOG] (${time}) ${`${message}`}`)
	invoke("logger", { message, time, kind: "log" })
	writeToFile(`[AUTHME LOG] (${time}) ${`${message}`}`)
}

export const warn = (message: string) => {
	const time = getTime()

	console.log(`[AUTHME WARN] (${time}) ${message}`)
	invoke("logger", { message, time, kind: "warn" })
	writeToFile(`[AUTHME WARN] (${time}) ${message}`)
}

export const error = (message: string) => {
	const time = getTime()

	console.log(`[AUTHME ERROR] (${time}) ${message}`)
	invoke("logger", { message, time, kind: "error" })
	writeToFile(`[AUTHME ERROR] (${time}) ${message}`)
}

const writeToFile = async (message: string) => {
	if (dev === true) {
		return
	}

	try {
		const time = new Date().toISOString().replace("T", "-").replaceAll(":", "-").substring(0, 19)
		const cache = await path.cacheDir()
		const folderPath = await path.join(cache, "com.levminer.authme", "logs")
		await invoke("create_logs_dir", { path: folderPath })

		if (fileName === undefined) {
			fileName = `authme-${time}.log`
		}

		invoke("write_logs", { name: `${folderPath}/${fileName}`, message: `${message}\n` })
	} catch (e) {
		console.error("Failed to write log to file:", e)
	}
}

export default { log, warn, error }
