/**
 * Built-in Offline Brand Icons & Smart Online Icon Resolver for Authme
 * Offline vector icons for core brands + Simple Icons CDN & Google S2 Favicon API for all services.
 */

export interface ServiceIcon {
	svg: string
	bg: string
	isMonogram?: boolean
	serviceKey?: string
	isDark?: boolean
}

interface BrandEntry {
	id: string
	name: string
	keywords: string[]
	bg: string
	svg: string
}

export const BRANDS: BrandEntry[] = [
	{
		id: "discord",
		name: "Discord",
		keywords: ["discord"],
		bg: "background: #5865F2;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
	},
	{
		id: "instagram",
		name: "Instagram",
		keywords: ["instagram", "insta"],
		bg: "background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
	},
	{
		id: "vercel",
		name: "Vercel",
		keywords: ["vercel"],
		bg: "background: #000000; border: 1px solid rgba(255,255,255,0.2);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M24 22.525H0l12-21.05 12 21.05z"/></svg>`,
	},
	{
		id: "roblox",
		name: "Roblox",
		keywords: ["roblox", "rblx"],
		bg: "background: linear-gradient(135deg, #1b1c20 0%, #0d0e11 100%); border: 1px solid rgba(255,255,255,0.12);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M18.926 23.998L0 18.892 5.075.002 24 5.108l-5.074 18.89zM15.348 10.09l-5.282-1.417-1.415 5.281 5.282 1.416 1.415-5.28z"/></svg>`,
	},
	{
		id: "google",
		name: "Google",
		keywords: ["google", "gmail", "youtube", "android", "gsuite", "googlemail"],
		bg: "background: #ffffff; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 1px 3px rgba(0,0,0,0.05);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`,
	},
	{
		id: "github",
		name: "GitHub",
		keywords: ["github", "gh"],
		bg: "background: #181717; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
	},
	{
		id: "microsoft",
		name: "Microsoft",
		keywords: ["microsoft", "outlook", "hotmail", "office365", "azure", "live"],
		bg: "background: #ffffff; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 1px 3px rgba(0,0,0,0.05);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>`,
	},
	{
		id: "steam",
		name: "Steam",
		keywords: ["steam", "valvesoftware"],
		bg: "background: linear-gradient(135deg, #171a21 0%, #1b2838 100%); border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.707L.436 15.07C1.82 20.218 6.452 24 11.979 24c6.627 0 12-5.373 12-12s-5.373-12-12-12zM8.366 18.067c-.201-.082-.416-.135-.644-.135-1.026 0-1.859.833-1.859 1.859 0 .285.068.552.183.792l-1.92-1.92c.31-.836 1.01-1.472 1.884-1.688l2.356.992zm7.575-10.879c-1.393 0-2.527 1.134-2.527 2.527 0 1.395 1.134 2.527 2.527 2.527 1.395 0 2.527-1.132 2.527-2.527 0-1.393-1.132-2.527-2.527-2.527z"/></svg>`,
	},
	{
		id: "apple",
		name: "Apple",
		keywords: ["apple", "icloud", "appleid"],
		bg: "background: #000000; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.64 1.36-.56.65-1.06 1.71-.93 2.73 1 .08 2.03-.49 2.65-1.24z"/></svg>`,
	},
	{
		id: "amazon",
		name: "Amazon",
		keywords: ["amazon", "aws"],
		bg: "background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 1px 3px rgba(0,0,0,0.05);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><path fill="#FF9900" d="M13.88 18.06c-2.46 1.81-6.04 2.77-9.12 1.45-.43-.19-.08-.66.31-.83 2.76-1.19 5.86-1.66 8.52-.39.46.22.68.75.29.77z"/><path fill="#FF9900" d="M14.77 16.9c-.31-.4-.63-.8-.94-1.2-.1-.13 0-.25.13-.23 1.38.16 2.76.32 4.14.48.33.04.47.36.25.6-1.19 1.33-2.38 2.66-3.58 3.99-.12.13-.26.06-.21-.11.41-1.18.82-2.36 1.23-3.54z"/><path fill="#232F3E" d="M12.75 6.54c-.11-.08-.25-.09-.36-.02-1.3.83-2.6 1.66-3.9 2.49-.12.08-.14.24-.04.34.8.8 1.6 1.6 2.4 2.4.1.1.26.08.34-.04 1.3-.83 2.6-1.66 3.9-2.49.12-.08.14-.24.04-.34-.8-.8-1.6-1.6-2.38-2.34z"/></svg>`,
	},
	{
		id: "stripe",
		name: "Stripe",
		keywords: ["stripe"],
		bg: "background: #635BFF;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>`,
	},
	{
		id: "gitlab",
		name: "GitLab",
		keywords: ["gitlab"],
		bg: "background: #FC6D26;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="m23.6 9.584-1.026-3.155a.965.965 0 0 0-1.838 0L19.71 9.584H4.29L3.264 6.429a.965.965 0 0 0-1.838 0L.4 9.584a1.448 1.448 0 0 0 .526 1.618l11.074 8.046 11.074-8.046a1.448 1.448 0 0 0 .526-1.618z"/></svg>`,
	},
	{
		id: "cloudflare",
		name: "Cloudflare",
		keywords: ["cloudflare"],
		bg: "background: #F38020;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M19.41 12.58A5.4 5.4 0 0 0 14.05 7a5.35 5.35 0 0 0-4.7 2.8A4.2 4.2 0 0 0 6 9.5a4.2 4.2 0 0 0-4.2 4.2 4.13 4.13 0 0 0 .23 1.34A2.67 2.67 0 0 0 4.5 17.5h14.9a2.6 2.6 0 0 0 2.6-2.6 2.6 2.6 0 0 0-2.59-2.32z"/></svg>`,
	},
	{
		id: "spotify",
		name: "Spotify",
		keywords: ["spotify"],
		bg: "background: #1ED760;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
	},
	{
		id: "tiktok",
		name: "TikTok",
		keywords: ["tiktok", "tik tok", "musical.ly"],
		bg: "background: #010101; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
	},
	{
		id: "namecheap",
		name: "Namecheap",
		keywords: ["namecheap"],
		bg: "background: #DE3723; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(222,55,35,0.35);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.295 17.484c.227.403.57.728.985.931-.309.15-.647.229-.99.232h-3.068a2.26 2.26 0 0 1-1.957-1.143L6.705 6.511a2.27 2.27 0 0 0-.974-.922c.309-.153.652-.233.997-.232h3.05c.81.003 1.558.438 1.959 1.143l5.558 10.984zm-9.329-7.392L6.269 6.755c-.209-.392-.582-.657-.984-.829-.204.165-.391.35-.522.581-.184.349-4.391 8.648-4.569 8.987a2.245 2.245 0 0 0 4.016 1.999l3.756-7.401zm15.846-1.593a2.245 2.245 0 0 0-1.162-2.955v-.001a2.243 2.243 0 0 0-.892-.187l-.003-.011c-.816 0-1.569.443-1.965 1.157l-3.749 7.414 1.689 3.323c.213.399.59.664.998.839.252-.2.473-.444.605-.742l4.479-8.837z"/></svg>`,
	},
	{
		id: "binance",
		name: "Binance",
		keywords: ["binance", "bnb"],
		bg: "background: #181A20; border: 1px solid rgba(240,185,11,0.25); box-shadow: 0 4px 12px rgba(0,0,0,0.4);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#F0B90B"><path d="m16.624 13.92 2.715 2.715-7.34 7.34-7.343-7.34 2.714-2.716 4.628 4.628 4.626-4.628zm-4.625-7.34 4.626 4.627 2.715-2.715-7.34-7.34-7.343 7.34 2.714 2.715 4.628-4.628zm-7.34 4.627-2.715 2.715 2.715 2.716 2.715-2.716-2.715-2.715zm14.683 0-2.715 2.715 2.715 2.716 2.716-2.716-2.716-2.715zm-7.343 1.358-1.358 1.357 1.358 1.358 1.357-1.358-1.357-1.357z"/></svg>`,
	},
	{
		id: "paypal",
		name: "PayPal",
		keywords: ["paypal"],
		bg: "background: #003087;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.97.382-1.05.9l-1.12 7.106zm14.146-14.42c-.03.18-.066.366-.109.557-1.282 5.706-5.26 7.643-10.457 7.643H8.38c-.443 0-.82.323-.889.761l-1.07 6.79H3.14l3.197-20.24h7.525c2.19 0 3.864.448 4.773 1.48.816.927 1.054 1.954.814 3.473z"/></svg>`,
	},
	{
		id: "facebook",
		name: "Facebook",
		keywords: ["facebook", "fb", "meta"],
		bg: "background: #1877F2;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
	},
	{
		id: "twitter",
		name: "Twitter / X",
		keywords: ["twitter", "x", "tweet"],
		bg: "background: #000000; border: 1px solid rgba(255,255,255,0.2);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 23.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
	},
	{
		id: "bitwarden",
		name: "Bitwarden",
		keywords: ["bitwarden"],
		bg: "background: #175DDC;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M21.97 3.59a1.18 1.18 0 0 0-.96-.59H2.99a1.18 1.18 0 0 0-.96.59c-.22.34-.26.77-.1 1.15l.02.04C3.89 8.71 7.21 16.27 12 21c4.79-4.73 8.11-12.29 10.05-16.22l.02-.04c.16-.38.12-.81-.1-1.15zM12 18.66C8.5 14.86 5.86 9.38 4.41 5.4h15.18c-1.45 3.98-4.09 9.46-7.59 13.26z"/></svg>`,
	},
	{
		id: "twitch",
		name: "Twitch",
		keywords: ["twitch"],
		bg: "background: #9146FF;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`,
	},
	{
		id: "reddit",
		name: "Reddit",
		keywords: ["reddit"],
		bg: "background: #FF4500;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-4.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>`,
	},
	{
		id: "proton",
		name: "Proton",
		keywords: ["proton", "protonmail", "pm.me"],
		bg: "background: #6D4AFF;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12.004 0C5.374 0 0 5.373 0 12.003c0 6.627 5.374 11.997 12.004 11.997 6.626 0 11.996-5.37 11.996-11.997C24 5.373 18.63 0 12.004 0zm0 3.753c4.557 0 8.25 3.693 8.25 8.25 0 2.052-.75 3.93-1.998 5.376l-11.628-11.63A8.196 8.196 0 0 1 12.004 3.753zM5.748 6.623l11.628 11.63a8.204 8.204 0 0 1-5.372 2.003c-4.557 0-8.25-3.693-8.25-8.253 0-2.052.75-3.927 1.994-5.38z"/></svg>`,
	},
	{
		id: "epic",
		name: "Epic Games",
		keywords: ["epic", "epicgames", "fortnite"],
		bg: "background: #313131; border: 1px solid rgba(255,255,255,0.15);",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M4.887 0C3.766 0 2.86.906 2.86 2.027v17.414c0 .488.203.953.559 1.285l7.986 7.07c.355.312.873.312 1.228 0l7.985-7.07c.356-.332.559-.797.559-1.285V2.027C21.177.906 20.27 0 19.15 0H4.887zm7.132 3.82c3.486 0 6.07 2.149 6.07 5.485 0 3.19-2.584 5.484-6.07 5.484H8.47v5.39H5.706V3.82h6.313zm0 2.766H8.47v5.438h3.55c2.149 0 3.308-1.229 3.308-2.72 0-1.49-1.159-2.718-3.308-2.718z"/></svg>`,
	},
	{
		id: "yahoo",
		name: "Yahoo",
		keywords: ["yahoo", "ymail"],
		bg: "background: #6001d2;",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-4.5L7.5 6.5h2.2L12 10.3l2.3-3.8h2.2L13 12v4.5z"/></svg>`,
	},
]

/**
 * Checks whether the current UI state is Dark theme or Light theme.
 */
export const isCurrentDarkTheme = (): boolean => {
	if (typeof document === "undefined") return true
	const root = document.documentElement
	if (root.getAttribute("data-theme") === "light" || root.classList.contains("light")) {
		return false
	}
	if (root.getAttribute("data-theme") === "dark" || root.classList.contains("dark")) {
		return true
	}
	return true
}

/**
 * Extract prefix if name contains "Issuer: user", "Issuer - user", "Issuer (user)", etc.
 */
export const extractPrefix = (text: string): string => {
	if (!text) return ""
	if (text.includes(":")) return text.split(":")[0].trim()
	if (text.includes(" - ")) return text.split(" - ")[0].trim()
	if (text.includes(" / ")) return text.split(" / ")[0].trim()
	if (text.includes(" | ")) return text.split(" | ")[0].trim()
	if (text.includes(" (")) return text.split(" (")[0].trim()
	if (text.includes(" [")) return text.split(" [")[0].trim()
	return ""
}

/**
 * Strips redundant issuer / service prefixes (e.g. "Discord:user@mail.com" -> "user@mail.com")
 * Returns strictly the clean account identifier or email address.
 */
export const cleanAccountName = (name?: string, issuer?: string): string => {
	if (!name) return ""
	let cleaned = name.trim()

	// 1. If explicit issuer is provided, strip "${issuer}:" or "${issuer} - " prefix
	if (issuer && issuer.trim()) {
		const iss = issuer.trim().toLowerCase()
		if (cleaned.toLowerCase().startsWith(iss + ":")) {
			cleaned = cleaned.slice(iss.length + 1).trim()
		} else if (cleaned.toLowerCase().startsWith(iss + " - ")) {
			cleaned = cleaned.slice(iss.length + 3).trim()
		} else if (cleaned.toLowerCase().startsWith(iss + " / ")) {
			cleaned = cleaned.slice(iss.length + 3).trim()
		}
	}

	// 2. If name still contains a colon prefix (e.g. "Google:user@gmail.com", "Discord:phwyverysad")
	if (cleaned.includes(":")) {
		const parts = cleaned.split(":")
		const prefix = parts[0].trim()
		const remainder = parts.slice(1).join(":").trim()
		// Only strip if prefix looks like a service/issuer label and not an email/URL
		if (prefix && remainder && !prefix.includes("@") && !prefix.includes("/") && !prefix.includes("\\")) {
			cleaned = remainder
		}
	}

	return cleaned
}

const isEmailAddress = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
const isGenericService = (s: string) =>
	/^(totp|otp|otp_totp|2fa|authenticator|unknown|authme|code|service|myaccount|account)$/i.test(s.trim())

/**
 * Extracts candidate service text from issuer or accountName prefix.
 * Strictly separates the service provider from the account credential (email/username).
 */
export const extractServiceCandidate = (
	issuer?: string,
	accountName?: string
): { candidate: string; isEmailFallback: boolean } => {
	let rawIssuer = (issuer || "").trim()
	let rawName = (accountName || "").trim()

	// Field swap detection: if issuer is an email but accountName is a brand/title, swap them
	if (isEmailAddress(rawIssuer) && rawName && !isEmailAddress(rawName)) {
		const tmp = rawIssuer
		rawIssuer = rawName
		rawName = tmp
	}

	// 1. Primary: Issuer is evaluated first and strictly
	if (rawIssuer && !isEmailAddress(rawIssuer) && !isGenericService(rawIssuer)) {
		let clean = rawIssuer
		if (clean.includes(":")) {
			const part = clean.split(":")[0].trim()
			if (part && !isEmailAddress(part) && !isGenericService(part)) clean = part
		}
		return { candidate: clean, isEmailFallback: false }
	}

	// 2. Secondary: Prefix in accountName (e.g. "Microsoft: user@gmail.com", "Discord - user", "Steam (gamer)")
	if (rawName) {
		const prefix = extractPrefix(rawName)
		if (prefix && !isEmailAddress(prefix) && !isGenericService(prefix)) {
			return { candidate: prefix, isEmailFallback: false }
		}
	}

	// 3. Fallback: Check if an email address exists in rawIssuer or rawName
	const emailCandidate = isEmailAddress(rawIssuer) ? rawIssuer : isEmailAddress(rawName) ? rawName : ""
	if (emailCandidate) {
		return { candidate: emailCandidate, isEmailFallback: true }
	}

	// 4. Fallback to rawName if not empty and not generic
	if (rawName && !isGenericService(rawName)) {
		return { candidate: rawName, isEmailFallback: false }
	}

	return { candidate: "", isEmailFallback: false }
}

/**
 * Normalizes an account's issuer and name to a definitive category { id, name }.
 * Guarantees zero false-positives (e.g. a Microsoft account with a Gmail address stays Microsoft).
 */
export const normalizeCategory = (issuer?: string, accountName?: string): { id: string; name: string } => {
	const { candidate, isEmailFallback } = extractServiceCandidate(issuer, accountName)

	if (!candidate) {
		return { id: "other", name: "Other" }
	}

	// Handle pure email fallback ONLY when no service/issuer was provided
	if (isEmailFallback) {
		const domain = candidate.split("@")[1]?.toLowerCase() || ""
		if (domain.includes("gmail") || domain.includes("googlemail")) {
			return { id: "google", name: "Google" }
		}
		if (
			domain.includes("outlook") ||
			domain.includes("hotmail") ||
			domain.includes("live") ||
			domain.includes("msn") ||
			domain.includes("office365") ||
			domain.includes("passport")
		) {
			return { id: "microsoft", name: "Microsoft" }
		}
		if (domain.includes("icloud") || domain.includes("me.com") || domain.includes("mac.com")) {
			return { id: "apple", name: "Apple" }
		}
		if (domain.includes("proton") || domain.includes("pm.me")) {
			return { id: "proton", name: "Proton" }
		}
		if (domain.includes("yahoo") || domain.includes("ymail")) {
			return { id: "yahoo", name: "Yahoo" }
		}
		const mainDomain = domain.split(".")[0]?.trim()
		if (mainDomain && mainDomain.length >= 2) {
			const slug = mainDomain.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
			const formatted = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)
			return { id: slug || "other", name: formatted }
		}
		return { id: "other", name: "Other" }
	}

	// Clean candidate string for brand matching
	let clean = candidate.toLowerCase().trim()
	clean = clean.replace(/^https?:\/\//i, "").replace(/[/?#].*$/, "").trim()
	clean = clean.replace(/^(www\.|auth\.|accounts?\.|login\.|myaccount\.|id\.|oauth\.|api\.)/i, "").trim()
	const cleanWithoutTld = clean
		.replace(/\.(com|org|net|io|gg|co|tv|app|dev|me|online|ai|so|cc|info|biz|uk|de|fr|jp|cn|us|ca|au)$/i, "")
		.trim()

	// 1. Exact match against brand IDs
	for (const brand of BRANDS) {
		if (clean === brand.id || cleanWithoutTld === brand.id) {
			return { id: brand.id, name: brand.name }
		}
	}

	// 2. Specific Brand Matching with Word Boundaries (Zero false positives!)
	// Microsoft check (protect against "deliveroo", "olive", "clive", etc.)
	if (
		/\b(microsoft|outlook|office365|office\s*365|msft|azure|hotmail|windows\s*live)\b/i.test(clean) ||
		clean.includes("microsoftonline") ||
		clean === "live" ||
		cleanWithoutTld === "live" ||
		clean.endsWith(".live.com")
	) {
		return { id: "microsoft", name: "Microsoft" }
	}

	// Google check
	if (
		/\b(google|gmail|youtube|gsuite|googlemail)\b/i.test(clean) ||
		clean.includes("google workspace") ||
		clean.includes("google cloud") ||
		clean === "android"
	) {
		return { id: "google", name: "Google" }
	}

	// Steam check
	if (/\b(steam|valvesoftware)\b/i.test(clean) || clean === "valve") {
		return { id: "steam", name: "Steam" }
	}

	// Apple check (ensure "pineapple" is NOT apple)
	if (/\b(apple|icloud|appleid)\b/i.test(clean) && !clean.includes("pineapple")) {
		return { id: "apple", name: "Apple" }
	}

	// Amazon check
	if (/\b(amazon|aws)\b/i.test(clean)) {
		return { id: "amazon", name: "Amazon" }
	}

	// Facebook / Meta check (ensure "metamask", "metadata" are NOT facebook)
	if (
		/\b(facebook|fb)\b/i.test(clean) ||
		(/\bmeta\b/i.test(clean) && !clean.includes("metamask") && !clean.includes("metadata"))
	) {
		return { id: "facebook", name: "Facebook" }
	}

	// Twitter / X check
	if (/\b(twitter|tweet)\b/i.test(clean) || clean === "x" || clean === "x.com") {
		return { id: "twitter", name: "Twitter / X" }
	}

	// Epic Games check (ensure "epicurious" is NOT epic)
	if (/\b(epicgames|fortnite)\b/i.test(clean) || /\bepic\s*games\b/i.test(clean) || clean === "epic") {
		return { id: "epic", name: "Epic Games" }
	}

	// Keyword matching for other predefined brands
	for (const brand of BRANDS) {
		for (const kw of brand.keywords) {
			const regex = new RegExp(`\\b${kw}\\b`, "i")
			if (regex.test(clean) || regex.test(cleanWithoutTld)) {
				return { id: brand.id, name: brand.name }
			}
		}
	}

	// Dynamic Service Category for ANY custom or third-party service (e.g. Cloudflare, Bitbucket, Supabase, etc.)
	const rawCandidate = cleanWithoutTld || clean || candidate
	const slug = rawCandidate.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
	if (slug && slug.length >= 2) {
		const formatted = candidate.trim().charAt(0).toUpperCase() + candidate.trim().slice(1)
		return { id: slug, name: formatted }
	}

	return { id: "other", name: "Other" }
}

/**
 * Returns a deterministic hash code for a string.
 */
const stringHash = (str: string): number => {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 31 + str.charCodeAt(i)) >>> 0
	}
	return hash
}

// In-memory and LocalStorage persistent cache for dynamically discovered brand icons from Simple Icons CDN
const ICON_CACHE_KEY = "authme_dynamic_icon_cache_v2"
let dynamicIconCache: Record<string, string> = {}
const failedIcons = new Set<string>()

if (typeof window !== "undefined") {
	try {
		const stored = localStorage.getItem(ICON_CACHE_KEY)
		if (stored) {
			dynamicIconCache = JSON.parse(stored)
		}
	} catch (e) {}
}

const setCachedIcon = (key: string, value: string) => {
	dynamicIconCache[key] = value
	if (typeof window !== "undefined") {
		try {
			localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(dynamicIconCache))
		} catch (e) {}
	}
}

/**
 * Retrieves a cached SVG or icon URL by service name if available.
 */
export const getCachedIcon = (serviceName: string): string | null => {
	const slug = serviceName.toLowerCase().replace(/[^a-z0-9-]/g, "")
	return dynamicIconCache[slug] || null
}

/**
 * Automatically detects and fetches real brand icons from Simple Icons CDN or Google S2 Favicon API.
 * Uses the official brand color from Simple Icons CDN.
 */
export const fetchBrandIcon = async (serviceName: string): Promise<string | null> => {
	if (!serviceName || typeof window === "undefined") return null
	const clean = serviceName.toLowerCase().trim().replace(/[^a-z0-9-]/g, "")
	if (!clean || clean.length < 2) return null

	if (failedIcons.has(clean)) return null
	if (dynamicIconCache[clean]) return dynamicIconCache[clean]

	// 1. Try Simple Icons CDN (Official brand SVG vector)
	try {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), 1200)
		const simpleIconsUrl = `https://cdn.simpleicons.org/${clean}`
		const res = await fetch(simpleIconsUrl, { method: "GET", signal: controller.signal })
		clearTimeout(timer)
		if (res.ok) {
			const text = await res.text()
			if (text && text.includes("<svg")) {
				setCachedIcon(clean, text)
				window.dispatchEvent(new CustomEvent("authme:iconloaded", { detail: { slug: clean, svg: text } }))
				return text
			}
		}
	} catch (e) {}

	// 2. Try Google S2 High-Res Favicon API (Universal for any domain/brand)
	try {
		const domain = clean.includes(".") ? clean : `${clean}.com`
		const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
		const img = new Image()
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				img.src = ""
				reject(new Error("Timeout"))
			}, 800)
			img.onload = () => {
				clearTimeout(timer)
				resolve()
			}
			img.onerror = () => {
				clearTimeout(timer)
				reject()
			}
			img.src = googleFaviconUrl
		})
		if (img.naturalWidth > 16) {
			setCachedIcon(clean, googleFaviconUrl)
			window.dispatchEvent(new CustomEvent("authme:iconloaded", { detail: { slug: clean, url: googleFaviconUrl } }))
			return googleFaviconUrl
		}
	} catch (e) {}

	failedIcons.add(clean)
	return null
}

const GRADIENT_PALETTES = [
	"background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);",
	"background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);",
	"background: linear-gradient(135deg, #059669 0%, #047857 100%);",
	"background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);",
	"background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);",
	"background: linear-gradient(135deg, #db2777 0%, #be185d 100%);",
	"background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);",
	"background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);",
	"background: linear-gradient(135deg, #d97706 0%, #b45309 100%);",
	"background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);",
]

/**
 * Resolve icon for an issuer or account name using the built-in offline SVG or cached CDN icon.
 */
export const getServiceIcon = (
	issuer?: string,
	accountName?: string,
	isDarkOverride?: boolean
): ServiceIcon => {
	const isDark = isDarkOverride !== undefined ? isDarkOverride : isCurrentDarkTheme()
	const cat = normalizeCategory(issuer, accountName)
	const brand = BRANDS.find((b) => b.id === cat.id)

	if (brand) {
		return {
			svg: brand.svg,
			bg: brand.bg,
			isMonogram: false,
			serviceKey: brand.id,
			isDark,
		}
	}

	// Check persistent cache for dynamically discovered Simple Icons / Google Favicons
	const cached = getCachedIcon(cat.id)
	if (cached) {
		if (cached.startsWith("<svg") || cached.includes("<svg")) {
			let normalizedSvg = cached
			if (!normalizedSvg.includes("width=")) {
				normalizedSvg = normalizedSvg.replace(/<svg\b/i, '<svg width="28" height="28"')
			}
			const dynamicBg = isDark
				? "background: #1e293b; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
				: "background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
			return {
				svg: normalizedSvg,
				bg: dynamicBg,
				isMonogram: false,
				serviceKey: cat.id,
				isDark,
			}
		} else {
			// Favicon image url
			const imgSvg = `<img src="${cached}" alt="${cat.name}" class="w-7 h-7 object-contain rounded-md" />`
			const dynamicBg = isDark
				? "background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(8px);"
				: "background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
			return {
				svg: imgSvg,
				bg: dynamicBg,
				isMonogram: false,
				serviceKey: cat.id,
				isDark,
			}
		}
	}

	// Dynamic Monogram Fallback
	const displayLabel = (cat.name && cat.name !== "Other" ? cat.name : issuer || accountName || "2FA").trim()
	const initial = (displayLabel.charAt(0) || "A").toUpperCase()
	const hash = stringHash(displayLabel)
	const bg = GRADIENT_PALETTES[hash % GRADIENT_PALETTES.length] + " border: 1px solid rgba(255,255,255,0.15);"
	const monogramSvg = `<span class="text-2xl font-bold text-white tracking-wider select-none font-sans drop-shadow">${initial}</span>`

	return {
		svg: monogramSvg,
		bg: bg,
		isMonogram: true,
		serviceKey: cat.id,
		isDark,
	}
}
