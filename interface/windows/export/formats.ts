import qrcode from "qrcode-generator"

export interface ExportAccountItem {
	id?: string
	index?: number
	issuer: string
	name: string
	secret: string
	type?: string
	algorithm?: string
	digits?: number
	period?: number
	selected?: boolean
}

export interface ExportMailItem {
	id: string
	provider: string
	name: string
	email: string
	label: string
	custom_url?: string
	unread_count?: number
	created_at?: number
	selected?: boolean
}

export interface MigrationBatch {
	batchIndex: number
	batchSize: number
	batchId: number
	accountCount: number
	uri: string
	qrDataUrl: string
	accounts: ExportAccountItem[]
}

/**
 * Build RFC 6238 compliant otpauth:// URI
 */
export const buildOtpauthUri = (account: {
	issuer: string
	name: string
	secret: string
	type?: string
	algorithm?: string
	digits?: number
	period?: number
}): string => {
	const cleanIssuer = (account.issuer || "2FA").trim()
	const cleanName = (account.name || cleanIssuer).trim()
	const cleanSecret = (account.secret || "").replace(/[\s-]+/g, "").toUpperCase()
	const type = (account.type || "totp").toLowerCase().includes("hotp") ? "hotp" : "totp"
	const label = `${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanName)}`

	const params = new URLSearchParams()
	params.set("secret", cleanSecret)
	params.set("issuer", cleanIssuer)

	if (account.algorithm && account.algorithm.toUpperCase() !== "SHA1") {
		params.set("algorithm", account.algorithm.toUpperCase())
	}
	if (account.digits && account.digits !== 6) {
		params.set("digits", account.digits.toString())
	}
	if (account.period && account.period !== 30) {
		params.set("period", account.period.toString())
	}

	return `otpauth://${type}/${label}?${params.toString()}`
}

/**
 * Decode base32 string to raw bytes
 */
export const base32ToBytes = (str: string): Uint8Array => {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
	const clean = str.replace(/[\s-=]+/g, "").toUpperCase()
	let bits = 0
	let value = 0
	const bytes: number[] = []

	for (let i = 0; i < clean.length; i++) {
		const idx = alphabet.indexOf(clean[i])
		if (idx === -1) continue
		value = (value << 5) | idx
		bits += 5
		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 0xff)
			bits -= 8
		}
	}
	return new Uint8Array(bytes)
}

function encodeVarint(value: number): number[] {
	const bytes: number[] = []
	let v = value >>> 0
	while (v > 127) {
		bytes.push((v & 0x7f) | 0x80)
		v >>>= 7
	}
	bytes.push(v & 0x7f)
	return bytes
}

function encodeLengthDelimited(fieldNumber: number, dataBytes: Uint8Array | number[]): number[] {
	const header = (fieldNumber << 3) | 2
	const len = dataBytes.length
	return [...encodeVarint(header), ...encodeVarint(len), ...Array.from(dataBytes)]
}

function encodeVarintField(fieldNumber: number, value: number): number[] {
	const header = (fieldNumber << 3) | 0
	return [...encodeVarint(header), ...encodeVarint(value)]
}

function encodeUtf8(str: string): Uint8Array {
	if (typeof TextEncoder !== "undefined") {
		return new TextEncoder().encode(str)
	}
	return new Uint8Array(Buffer.from(str, "utf-8"))
}

function bytesToBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== "undefined") {
		return Buffer.from(bytes).toString("base64")
	}
	let binary = ""
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

/**
 * Encode a single account into protobuf OtpParameters
 */
export const encodeOtpParameters = (account: ExportAccountItem): Uint8Array => {
	const bytes: number[] = []

	// Field 1: bytes secret
	const secretBytes = base32ToBytes(account.secret)
	bytes.push(...encodeLengthDelimited(1, secretBytes))

	// Field 2: string name (format: Issuer:Account or Account)
	const cleanIssuer = (account.issuer || "").trim()
	const cleanName = (account.name || cleanIssuer || "2FA").trim()
	const fullName = cleanIssuer && cleanName && cleanIssuer !== cleanName
		? `${cleanIssuer}:${cleanName}`
		: cleanName
	bytes.push(...encodeLengthDelimited(2, encodeUtf8(fullName)))

	// Field 3: string issuer
	if (cleanIssuer) {
		bytes.push(...encodeLengthDelimited(3, encodeUtf8(cleanIssuer)))
	}

	// Field 4: algorithm (1 = SHA1)
	bytes.push(...encodeVarintField(4, 1))

	// Field 5: digits (1 = 6 digits, 2 = 8 digits)
	bytes.push(...encodeVarintField(5, account.digits === 8 ? 2 : 1))

	// Field 6: type (2 = TOTP, 1 = HOTP)
	const isHotp = (account.type || "").toLowerCase().includes("hotp")
	bytes.push(...encodeVarintField(6, isHotp ? 1 : 2))

	return new Uint8Array(bytes)
}

/**
 * Generate Google Authenticator Migration Payload URI
 * Format: otpauth-migration://offline?data=<url_encoded_base64_protobuf>
 */
export const generateMigrationPayload = (
	accounts: ExportAccountItem[],
	batchSize = 1,
	batchIndex = 0,
	batchId = 123456
): string => {
	const bytes: number[] = []

	// Field 1: repeated OtpParameters otp_parameters
	for (const acc of accounts) {
		const paramBytes = encodeOtpParameters(acc)
		bytes.push(...encodeLengthDelimited(1, paramBytes))
	}

	// Field 2: int32 version = 1
	bytes.push(...encodeVarintField(2, 1))

	// Field 3: int32 batch_size
	bytes.push(...encodeVarintField(3, batchSize))

	// Field 4: int32 batch_index
	bytes.push(...encodeVarintField(4, batchIndex))

	// Field 5: int32 batch_id
	bytes.push(...encodeVarintField(5, batchId))

	const base64Str = bytesToBase64(new Uint8Array(bytes))
	return `otpauth-migration://offline?data=${encodeURIComponent(base64Str)}`
}

/**
 * Generate Google Authenticator Migration batches.
 * Bundles accounts into batches of up to 10 accounts per QR code.
 * (e.g. 1-10 accounts = 1 QR code; 11-20 = 2 QR codes; 21-30 = 3 QR codes).
 * Fully compatible with Google Authenticator, 2FAS, Aegis, Ente, Raivo, etc.
 */
export const generateMigrationBatches = (
	accounts: ExportAccountItem[],
	accountsPerBatch = 10
): MigrationBatch[] => {
	if (accounts.length === 0) return []

	const totalBatches = Math.max(1, Math.ceil(accounts.length / accountsPerBatch))
	const batchId = Math.floor(Math.random() * 899999) + 100000
	const batches: MigrationBatch[] = []

	for (let i = 0; i < totalBatches; i++) {
		const start = i * accountsPerBatch
		const batchAccounts = accounts.slice(start, start + accountsPerBatch)
		const uri = generateMigrationPayload(batchAccounts, totalBatches, i, batchId)
		const qrDataUrl = generateQrDataUrl(uri, 5, 2)

		batches.push({
			batchIndex: i,
			batchSize: totalBatches,
			batchId,
			accountCount: batchAccounts.length,
			uri,
			qrDataUrl,
			accounts: batchAccounts,
		})
	}

	return batches
}

/**
 * Generate high-contrast base64 Data URL for a given URI using qrcode-generator
 */
export const generateQrDataUrl = (uri: string, cellSize = 4, margin = 2): string => {
	try {
		const qr = qrcode(0, "M")
		qr.addData(uri)
		qr.make()
		return qr.createDataURL(cellSize, margin)
	} catch (e) {
		try {
			const qr = qrcode(0, "L")
			qr.addData(uri)
			qr.make()
			return qr.createDataURL(cellSize, margin)
		} catch (e2) {
			console.error("QR generator error:", e2)
			return ""
		}
	}
}

/**
 * Format secret into readable groups of 4 characters
 */
export const formatSecretGroups = (secret: string): string => {
	return secret.replace(/\s+/g, "").match(/.{1,4}/g)?.join(" ") || secret
}

export function escapeHtml(text: string): string {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
}

export function escapeJsString(text: string): string {
	return String(text)
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
}

/**
 * Generate raw text representation for .authme file
 */
export const generateAuthmeCodesText = (accounts: ExportAccountItem[]): string => {
	let text = ""
	for (const acc of accounts) {
		text += `Name: ${acc.name}\nSecret: ${acc.secret}\nIssuer: ${acc.issuer}\nType: ${acc.type || "OTP_TOTP"}\n\n`
	}
	return text
}

/**
 * Generate Universal JSON format for 2FA accounts
 */
export const generateJsonExport = (accounts: ExportAccountItem[], appVersion = "7.1.1"): string => {
	const exportObj = {
		app: "Authme",
		version: appVersion,
		exportedAt: new Date().toISOString(),
		count: accounts.length,
		accounts: accounts.map((a) => ({
			issuer: a.issuer,
			name: a.name,
			secret: a.secret,
			type: a.type || "TOTP",
			algorithm: a.algorithm || "SHA1",
			digits: a.digits || 6,
			period: a.period || 30,
			uri: buildOtpauthUri(a),
		})),
	}
	return JSON.stringify(exportObj, null, 2)
}

/**
 * Generate RFC 4180 CSV spreadsheet format for 2FA accounts
 */
export const generateCsvExport = (accounts: ExportAccountItem[]): string => {
	const rows = [
		["Issuer", "Account", "Secret", "Type", "Algorithm", "Digits", "Period", "URI"],
	]

	for (const acc of accounts) {
		const uri = buildOtpauthUri(acc)
		rows.push([
			acc.issuer,
			acc.name,
			acc.secret,
			acc.type || "TOTP",
			acc.algorithm || "SHA1",
			String(acc.digits || 6),
			String(acc.period || 30),
			uri,
		])
	}

	return rows
		.map((row) =>
			row
				.map((col) => `"${String(col).replace(/"/g, '""')}"`)
				.join(",")
		)
		.join("\r\n")
}

/**
 * Generate plain text list of otpauth:// URIs
 */
export const generateTxtExport = (accounts: ExportAccountItem[]): string => {
	return accounts.map((acc) => buildOtpauthUri(acc)).join("\r\n")
}

/**
 * Generate JSON export for Mail accounts
 */
export const generateMailJsonExport = (accounts: ExportMailItem[], appVersion = "7.1.1"): string => {
	const exportObj = {
		app: "Authme",
		type: "mail_accounts",
		version: appVersion,
		exportedAt: new Date().toISOString(),
		count: accounts.length,
		accounts: accounts.map((a) => ({
			provider: a.provider,
			email: a.email,
			name: a.name,
			label: a.label || "",
			custom_url: a.custom_url || "",
			created_at: a.created_at || Date.now(),
		})),
	}
	return JSON.stringify(exportObj, null, 2)
}

/**
 * Generate CSV export for Mail accounts
 */
export const generateMailCsvExport = (accounts: ExportMailItem[]): string => {
	const rows = [
		["Provider", "Email", "Name", "Label", "Custom URL"],
	]

	for (const a of accounts) {
		rows.push([
			a.provider,
			a.email,
			a.name,
			a.label || "",
			a.custom_url || "",
		])
	}

	return rows
		.map((row) =>
			row
				.map((col) => `"${String(col).replace(/"/g, '""')}"`)
				.join(",")
		)
		.join("\r\n")
}

/**
 * Generate Plain text export for Mail accounts
 */
export const generateMailTxtExport = (accounts: ExportMailItem[]): string => {
	return accounts
		.map((a) => {
			const parts = [`Email: ${a.email}`, `Provider: ${a.provider}`]
			if (a.name && a.name !== a.email) parts.push(`Name: ${a.name}`)
			if (a.label) parts.push(`Label: ${a.label}`)
			if (a.custom_url) parts.push(`URL: ${a.custom_url}`)
			return parts.join(" | ")
		})
		.join("\r\n")
}

/**
 * Generate standalone printable HTML page with high-res QR codes and print stylesheet.
 * Includes Google Authenticator Migration QR codes for 1-step scanning, plus individual cards.
 */
export const generateHtmlDocument = (accounts: ExportAccountItem[]): string => {
	const dateStr = new Date().toLocaleString()
	const batches = generateMigrationBatches(accounts, 10)

	let migrationHtml = ""
	if (batches.length > 0) {
		let batchCards = ""
		for (const b of batches) {
			batchCards += `
			<div class="batch-card">
				<div class="qr-image-wrapper">
					<img class="qr-image" src="${b.qrDataUrl}" alt="Batch ${b.batchIndex + 1} of ${b.batchSize}" />
				</div>
				<div class="batch-badge">
					QR ${b.batchIndex + 1} / ${b.batchSize} (${b.accountCount} Accounts)
				</div>
				<p class="batch-desc">Scan with Google Authenticator, 2FAS, or Aegis</p>
			</div>`
		}

		migrationHtml = `
		<section class="migration-section">
			<div class="section-title">
				<h2>All-In-One Migration QR Codes</h2>
				<p>Scan these ${batches.length} QR code(s) with Google Authenticator, 2FAS, or Aegis to import all ${accounts.length} accounts at once.</p>
			</div>
			<div class="batch-grid">
				${batchCards}
			</div>
		</section>`
	}

	let cardsHtml = ""
	for (const acc of accounts) {
		const uri = buildOtpauthUri(acc)
		const qrDataUrl = generateQrDataUrl(uri, 5, 2)
		const formattedSecret = formatSecretGroups(acc.secret)

		cardsHtml += `
		<div class="qr-card">
			<div class="qr-image-wrapper">
				<img class="qr-image" src="${qrDataUrl}" alt="${escapeHtml(acc.issuer)} QR Code" />
			</div>
			<div class="qr-details">
				<div class="qr-header">
					<h3 class="qr-issuer">${escapeHtml(acc.issuer)}</h3>
					<p class="qr-name">${escapeHtml(acc.name)}</p>
				</div>
				<div class="qr-secret-box">
					<span class="qr-label">SECRET KEY</span>
					<code class="qr-secret">${escapeHtml(formattedSecret)}</code>
				</div>
				<div class="qr-uri-box">
					<span class="qr-label">OTPAUTH URI</span>
					<div class="qr-uri-row">
						<input type="text" readonly value="${escapeHtml(uri)}" class="qr-uri-input" />
						<button type="button" class="copy-btn" onclick="navigator.clipboard.writeText('${escapeJsString(uri)}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 1500)">Copy</button>
					</div>
				</div>
			</div>
		</div>`
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Authme 2FA Backup - ${accounts.length} Accounts</title>
	<style>
		:root {
			--bg: #0f172a;
			--card-bg: #1e293b;
			--border: rgba(255, 255, 255, 0.12);
			--text-main: #f8fafc;
			--text-muted: #94a3b8;
			--accent: #10b981;
			--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			--font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		}
		@media (prefers-color-scheme: light) {
			:root {
				--bg: #f8fafc;
				--card-bg: #ffffff;
				--border: #e2e8f0;
				--text-main: #0f172a;
				--text-muted: #64748b;
			}
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: var(--font-sans);
			background-color: var(--bg);
			color: var(--text-main);
			padding: 32px 20px;
			line-height: 1.5;
		}
		.container {
			max-width: 1080px;
			margin: 0 auto;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-wrap: wrap;
			gap: 16px;
			padding-bottom: 24px;
			margin-bottom: 32px;
			border-bottom: 1px solid var(--border);
		}
		.title-group h1 {
			font-size: 24px;
			font-weight: 800;
			letter-spacing: -0.02em;
		}
		.title-group p {
			color: var(--text-muted);
			font-size: 14px;
			margin-top: 4px;
		}
		.actions {
			display: flex;
			gap: 12px;
		}
		.btn {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			background: #0f172a;
			color: #ffffff;
			border: 1px solid var(--border);
			padding: 10px 18px;
			border-radius: 12px;
			font-size: 13px;
			font-weight: 600;
			cursor: pointer;
			text-decoration: none;
			transition: all 0.15s ease;
		}
		.btn:hover {
			opacity: 0.9;
			transform: translateY(-1px);
		}
		.migration-section {
			margin-bottom: 36px;
			padding: 24px;
			border-radius: 20px;
			background: var(--card-bg);
			border: 1px solid var(--border);
		}
		.section-title h2 {
			font-size: 18px;
			font-weight: 700;
		}
		.section-title p {
			font-size: 13px;
			color: var(--text-muted);
			margin-top: 4px;
		}
		.batch-grid {
			display: flex;
			flex-wrap: wrap;
			gap: 20px;
			margin-top: 20px;
			justify-content: center;
		}
		.batch-card {
			display: flex;
			flex-direction: column;
			align-items: center;
			padding: 16px;
			border-radius: 16px;
			background: rgba(0,0,0,0.03);
			border: 1px solid var(--border);
		}
		.batch-badge {
			margin-top: 10px;
			font-weight: 700;
			font-size: 13px;
		}
		.batch-desc {
			font-size: 11px;
			color: var(--text-muted);
			margin-top: 2px;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
			gap: 24px;
		}
		.qr-card {
			background: var(--card-bg);
			border: 1px solid var(--border);
			border-radius: 20px;
			padding: 24px;
			display: flex;
			flex-direction: column;
			align-items: center;
			box-shadow: 0 4px 20px rgba(0,0,0,0.06);
			page-break-inside: avoid;
			break-inside: avoid;
		}
		.qr-image-wrapper {
			background: #ffffff;
			padding: 12px;
			border-radius: 16px;
			box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
			margin-bottom: 18px;
		}
		.qr-image {
			display: block;
			width: 190px;
			height: 190px;
			image-rendering: pixelated;
		}
		.qr-details {
			width: 100%;
			text-align: left;
		}
		.qr-issuer {
			font-size: 18px;
			font-weight: 700;
			color: var(--text-main);
			line-height: 1.2;
		}
		.qr-name {
			font-size: 13px;
			color: var(--text-muted);
			margin-top: 2px;
			word-break: break-all;
		}
		.qr-secret-box {
			margin-top: 14px;
			background: rgba(0,0,0,0.04);
			border: 1px solid var(--border);
			padding: 10px 12px;
			border-radius: 12px;
		}
		.qr-label {
			display: block;
			font-size: 10px;
			font-weight: 700;
			color: var(--text-muted);
			letter-spacing: 0.05em;
			margin-bottom: 4px;
		}
		.qr-secret {
			font-family: var(--font-mono);
			font-size: 13px;
			font-weight: 700;
			letter-spacing: 0.08em;
			color: var(--text-main);
			display: block;
			word-break: break-all;
		}
		.qr-uri-box {
			margin-top: 12px;
		}
		.qr-uri-row {
			display: flex;
			gap: 8px;
			margin-top: 4px;
		}
		.qr-uri-input {
			flex: 1;
			font-family: var(--font-mono);
			font-size: 11px;
			background: transparent;
			border: 1px solid var(--border);
			color: var(--text-muted);
			padding: 6px 10px;
			border-radius: 8px;
			outline: none;
		}
		.copy-btn {
			background: var(--border);
			color: var(--text-main);
			border: none;
			padding: 6px 12px;
			border-radius: 8px;
			font-size: 12px;
			font-weight: 600;
			cursor: pointer;
		}
		.copy-btn:hover {
			opacity: 0.8;
		}
		@media print {
			body {
				background: #ffffff !important;
				color: #000000 !important;
				padding: 0 !important;
			}
			.actions { display: none !important; }
			.migration-section {
				box-shadow: none !important;
				border: 1px solid #ccc !important;
				page-break-inside: avoid !important;
				break-inside: avoid !important;
			}
			.qr-card {
				box-shadow: none !important;
				border: 1px solid #ccc !important;
				page-break-inside: avoid !important;
				break-inside: avoid !important;
				margin-bottom: 24px !important;
			}
			.copy-btn { display: none !important; }
			.grid {
				display: grid !important;
				grid-template-columns: 1fr 1fr !important;
				gap: 16px !important;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<div class="title-group">
				<h1>Authme 2FA Backup</h1>
				<p>Exported ${accounts.length} accounts &bull; ${dateStr}</p>
			</div>
			<div class="actions">
				<button type="button" class="btn" onclick="window.print()">
					&#x1F5B6; Print / Save PDF
				</button>
			</div>
		</header>
		${migrationHtml}
		<main class="grid">
			${cardsHtml}
		</main>
	</div>
</body>
</html>`
}
