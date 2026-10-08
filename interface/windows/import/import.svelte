<div class="transparent-900 mx-auto my-6 sm:my-10 md:my-16 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left">
	<h1 class="px-2 sm:px-6 md:px-10">{language.import.supportedTypes}</h1>

	<!-- Category Filter Pills -->
	<div class="px-2 sm:px-6 md:px-10 mt-6 flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer
				{selectedCategory === 'all'
					? 'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-md'
					: 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}"
			on:click={() => (selectedCategory = "all")}
		>
			{language.import?.categoryAll || "All"}
		</button>
		<button
			type="button"
			class="px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer
				{selectedCategory === '2fa'
					? 'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-md'
					: 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}"
			on:click={() => (selectedCategory = "2fa")}
		>
			<span class="flex items-center gap-1.5">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
				{language.import?.category2fa || "2FA Codes"}
			</span>
		</button>
		<button
			type="button"
			class="px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer
				{selectedCategory === 'mail'
					? 'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-md'
					: 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}"
			on:click={() => (selectedCategory = "mail")}
		>
			<span class="flex items-center gap-1.5">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
				{language.import?.categoryMail || "Mail"}
			</span>
		</button>
	</div>

	<div class="mx-auto flex flex-col items-center justify-center gap-5 rounded-2xl p-2 sm:p-6 md:p-8">
		{#if selectedCategory === 'all' || selectedCategory === '2fa'}
		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.totpQRCode}</h2>
				<h3>{language.import.totpQRCodeText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("totp")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details openByDefault={true} title={language.import.chooseImportMethod}>
					<div class="space-y-5">
						<div class="flex justify-between">
							<div>
								<h4 class="text-slate-900 dark:text-white">{language.import.enterSecretManually}</h4>
								<h5>{language.import.enterSecretManuallyText}</h5>
							</div>
							<div>
								<button class="smallButton" on:click={showManualEntry}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></svg>
									{language.import.enterSecretManuallyButton}
								</button>
							</div>
						</div>

						<div class="flex justify-between">
							<div>
								<h4 class="text-slate-900 dark:text-white">{language.import.screenCapture}</h4>
								<h5>{language.import.screenCaptureText}</h5>
							</div>
							<div>
								<button class="smallButton" on:click={captureScreen}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="6" r="3" /><path d="M22 12v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /><path d="M12 17v4" /><path d="M8 21h8" /></svg>
									{language.import.screenCaptureButton}
								</button>
							</div>
						</div>

						<div class="flex justify-between">
							<div>
								<h4 class="text-slate-900 dark:text-white">{language.import.importFromImage}</h4>
								<h5>{language.import.importFromImageText}</h5>
							</div>
							<div>
								<button class="smallButton" on:click={chooseImages}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
									{language.import.chooseImageButton}
								</button>
							</div>
						</div>

						<div class="flex justify-between">
							<div>
								<h4 class="text-slate-900 dark:text-white">{language.import.webcam}</h4>
								<h5>{language.import.webcamText}</h5>
							</div>
							<div>
								<button class="smallButton" on:click={useWebcam}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
									{language.import.webcamButton}
								</button>
							</div>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.googleAuthQRCode}</h2>
				<h3>{language.import.googleAuthQRCodeText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("google")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="space-y-5">
						<div class="flex justify-between">
							<div>
								<h4 class="text-slate-900 dark:text-white">{language.import.importFromImage}</h4>
								<h5>{language.import.importFromImageText}</h5>
							</div>
							<div>
								<button class="smallButton" on:click={chooseImages}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
									{language.import.chooseImageButton}
								</button>
							</div>
						</div>

						<div class="flex justify-between">
							<div>
								<h4 class="text-slate-900 dark:text-white">{language.import.webcam}</h4>
								<h5>{language.import.webcamText}</h5>
							</div>
							<div>
								<button class="smallButton" on:click={useWebcam}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
									{language.import.webcamButton}
								</button>
							</div>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.authme}</h2>
				<h3>{language.import.authmeText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("authme")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="flex flex-row justify-between">
						<div>
							<h4 class="text-slate-900 dark:text-white">{language.import.authmeFile}</h4>
							<h5>{language.import.authmeFileText}</h5>
						</div>
						<div>
							<button class="smallButton" on:click={chooseFile}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><polyline points="14 2 14 8 20 8" /><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m9 18-1.5-1.5" /></svg>
								{language.import.authmeFileButton}
							</button>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.aegisAuth}</h2>
				<h3>{language.import.aegisAuthText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("aegis")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="flex flex-row justify-between">
						<div>
							<h4 class="text-slate-900 dark:text-white">{language.import.aegisFile}</h4>
							<h5>{language.import.aegisFileText}</h5>
						</div>
						<div>
							<button class="smallButton" on:click={aegisFile}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><polyline points="14 2 14 8 20 8" /><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m9 18-1.5-1.5" /></svg>
								{language.import.aegisFileButton}
							</button>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.twoFasAuth}</h2>
				<h3>{language.import.twoFasAuthText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("2fas")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="flex flex-row justify-between">
						<div>
							<h4 class="text-slate-900 dark:text-white">{language.import.twoFasFile}</h4>
							<h5>{language.import.twoFasFileText}</h5>
						</div>
						<div>
							<button class="smallButton" on:click={twoFasAuthFile}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><polyline points="14 2 14 8 20 8" /><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m9 18-1.5-1.5" /></svg>
								{language.import.authmeFileButton}
							</button>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.bitwardenAuth}</h2>
				<h3>{language.import.bitwardenAuthText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("bitwarden")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="flex flex-row justify-between">
						<div>
							<h4 class="text-slate-900 dark:text-white">{language.import.bitwardenFile}</h4>
							<h5>{language.import.bitwardenFileText}</h5>
						</div>
						<div>
							<button class="smallButton" on:click={bitwardenFile}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><polyline points="14 2 14 8 20 8" /><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m9 18-1.5-1.5" /></svg>
								{language.import.bitwardenFileButton}
							</button>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.protonAuth}</h2>
				<h3>{language.import.protonAuthText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("proton")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="flex flex-row justify-between">
						<div>
							<h4 class="text-slate-900 dark:text-white">{language.import.protonFile}</h4>
							<h5>{language.import.protonFileText}</h5>
						</div>
						<div>
							<button class="smallButton" on:click={protonFile}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><polyline points="14 2 14 8 20 8" /><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m9 18-1.5-1.5" /></svg>
								{language.import.protonFileButton}
							</button>
						</div>
					</div>
				</Details>
			</div>
		</div>

		<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
			<div>
				<h2>{language.import.authenticatorccAuth}</h2>
				<h3>{language.import.authenticatorccAuthText}</h3>
			</div>
			<div class="mt-5 flex w-full">
				<button class="button" on:click={() => showTutorial("authenticatorcc")}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
					{language.import.instructions}
				</button>
			</div>
			<div class="mt-5 flex w-full">
				<Details title={language.import.chooseImportMethod}>
					<div class="flex flex-row justify-between">
						<div>
							<h4 class="text-slate-900 dark:text-white">{language.import.authenticatorccFile}</h4>
							<h5>{language.import.authenticatorccFileText}</h5>
						</div>
						<div>
							<button class="smallButton" on:click={authenticatorcc}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><polyline points="14 2 14 8 20 8" /><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m9 18-1.5-1.5" /></svg>
								{language.import.authenticatorccFileButton}
							</button>
						</div>
					</div>
				</Details>
			</div>
		</div>
		{/if}

		{#if selectedCategory === 'all' || selectedCategory === 'mail'}
			<!-- Section Header for Mail Category -->
			{#if selectedCategory === 'all'}
				<div class="w-full pt-6 pb-2 border-t border-slate-200/60 dark:border-slate-800">
					<h2 class="text-xl font-bold text-slate-900 dark:text-white">{language.import?.mailCategoryTitle || "Email Accounts (Mail)"}</h2>
					<h3 class="text-sm text-slate-500 dark:text-slate-400">{language.import?.mailCategorySubtitle || "Connect Google Gmail, Microsoft Outlook, or custom webmail to manage in Authme."}</h3>
				</div>
			{/if}

			<!-- Google Gmail -->
			<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
				<div class="flex items-center gap-3.5 mb-1">
					<div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
						<svg class="w-6 h-6" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
						</svg>
					</div>
					<div>
						<h2>Google (Gmail)</h2>
						<h3>{language.mail?.googleDesc || "Sign in with your @gmail.com Google account"}</h3>
					</div>
				</div>
				<div class="mt-4 flex w-full">
					<button class="button flex items-center gap-2" on:click={() => connectMail("gmail")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						{language.mail?.signInGoogle || "Sign in with Google (Gmail)"}
					</button>
				</div>
			</div>

			<!-- Microsoft Outlook -->
			<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
				<div class="flex items-center gap-3.5 mb-1">
					<div class="w-10 h-10 rounded-xl bg-[#0078d4] flex items-center justify-center shadow-sm flex-shrink-0">
						<svg class="w-6 h-6" viewBox="0 0 24 24" fill="white">
							<path d="M23.007 6.467L13.72.062a.853.853 0 00-.916.037L.426 8.358A.853.853 0 000 9.072v11.996c0 .472.383.854.854.854h22.292c.472 0 .854-.382.854-.854V7.27a.853.853 0 00-.993-.803z" fill="#ffffff"/>
							<path d="M13.714 13.626L24 7.271v13.797a.853.853 0 01-.854.854H13.714V13.626z" fill="#d0e2ff"/>
							<path d="M0 9.072l10.286 6.355V21.92H.854A.853.853 0 010 21.068V9.072z" fill="#ffffff"/>
						</svg>
					</div>
					<div>
						<h2>Microsoft Outlook</h2>
						<h3>{language.mail?.signInOutlook || "Sign in with Outlook, Hotmail, or Microsoft 365"}</h3>
					</div>
				</div>
				<div class="mt-4 flex w-full">
					<button class="button flex items-center gap-2" on:click={() => connectMail("outlook")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						{language.mail?.signInOutlook || "Sign in with Outlook"}
					</button>
				</div>
			</div>

			<!-- Proton Mail -->
			<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
				<div class="flex items-center gap-3.5 mb-1">
					<div class="w-10 h-10 rounded-xl bg-[#6d4aff] flex items-center justify-center text-white shadow-sm flex-shrink-0">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
					</div>
					<div>
						<h2>Proton Mail</h2>
						<h3>{language.mail?.protonDesc}</h3>
					</div>
				</div>
				<div class="mt-4 flex w-full">
					<button class="button flex items-center gap-2" on:click={() => connectMail("proton")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						{language.mail?.signInProton}
					</button>
				</div>
			</div>

			<!-- Yahoo Mail -->
			<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
				<div class="flex items-center gap-3.5 mb-1">
					<div class="w-10 h-10 rounded-xl bg-[#6001d2] flex items-center justify-center text-white font-black text-lg shadow-sm flex-shrink-0">
						Y!
					</div>
					<div>
						<h2>Yahoo Mail</h2>
						<h3>{language.mail?.yahooDesc}</h3>
					</div>
				</div>
				<div class="mt-4 flex w-full">
					<button class="button flex items-center gap-2" on:click={() => connectMail("yahoo")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						{language.mail?.signInYahoo}
					</button>
				</div>
			</div>

			<!-- iCloud Mail -->
			<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
				<div class="flex items-center gap-3.5 mb-1">
					<div class="w-10 h-10 rounded-xl bg-[#0091ff] flex items-center justify-center text-white shadow-sm flex-shrink-0">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
					</div>
					<div>
						<h2>iCloud Mail</h2>
						<h3>{language.mail?.icloudDesc}</h3>
					</div>
				</div>
				<div class="mt-4 flex w-full">
					<button class="button flex items-center gap-2" on:click={() => connectMail("icloud")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						{language.mail?.signInIcloud}
					</button>
				</div>
			</div>

			<!-- Custom Webmail -->
			<div class="transparent-800 flex w-full flex-col items-start rounded-xl p-5 text-left">
				<div class="flex items-center gap-3.5 mb-1">
					<div class="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-white shadow-sm flex-shrink-0">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
					</div>
					<div>
						<h2>{language.mail?.customWebmail}</h2>
						<h3>{language.mail?.customWebmailDesc}</h3>
					</div>
				</div>
				<div class="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-xl">
					<input
						type="text"
						bind:value={customWebmailInput}
						placeholder="https://mail.example.com"
						class="input flex-1 py-2.5 px-3.5 rounded-xl text-sm"
					/>
					<button class="button flex items-center justify-center gap-2 whitespace-nowrap" on:click={() => connectMail("custom")}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						{language.common?.confirm}
					</button>
				</div>
				{#if customWebmailError}
					<p class="text-xs text-rose-500 mt-2 font-medium">{customWebmailError}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<dialog class="dialog dialog1 overflow-hidden">
	<h2 class="dialog1Title">{language.import.captureScreenTitle}</h2>
	<h3>{language.import.captureScreenWaiting}</h3>

	<div class="mt-10 flex aspect-video h-60 flex-row space-x-5">
		<!-- svelte-ignore a11y-media-has-caption -->
		<video class="video rounded-xl bg-white p-1" autoplay />
	</div>

	<div class="mt-10">
		<button class="button stopVideo">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{language.common.cancel}
		</button>
	</div>
</dialog>

<dialog class="dialog dialog0">
	<h2>{language.import.manualEntry}</h2>
	<h3>{language.import.manualEntryText}</h3>

	<div class="mt-10 flex flex-row gap-5 sm:flex-col">
		<div>
			<h5>{language.import.manualEntryName}</h5>
			<input class="input name mt-1" type="text" placeholder="Google" />
		</div>
		<div>
			<h5>{language.import.manualEntrySecret}</h5>
			<input class="input secret mt-1" type="text" placeholder="JBSWY3DPEHPK3PXP" />
		</div>
		<div>
			<h5>{language.import.manualEntryDescription}</h5>
			<input class="input description mt-1" type="text" placeholder="example@mail.com" />
		</div>
	</div>

	<div class="mt-10 flex space-x-5">
		<button class="button dialog0Close" on:click={closeManualEntry}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{language.common.cancel}
		</button>
		<button class="button" on:click={manualEntry}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{language.common.confirm}
		</button>
	</div>
</dialog>

<dialog class="dialog tutorialDialog">
	<h2 class="tutorialTitle">-</h2>
	<h3 class="tutorialDescription">-</h3>

	<div class="mt-10 flex flex-row space-x-5">
		<ol class="instructions tutorialList" />
	</div>

	<div class="mt-10 flex space-x-5">
		<button class="button tutorialDialogClose" on:click={closeTutorial}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{language.common.close}
		</button>
	</div>
</dialog>

<script lang="ts">
	import {
		aegisFile,
		bitwardenFile,
		captureScreen,
		chooseFile,
		chooseImages,
		manualEntry,
		showManualEntry,
		closeManualEntry,
		showTutorial,
		closeTutorial,
		twoFasAuthFile,
		useWebcam,
		protonFile,
		authenticatorcc,
	} from "./index"
	import Details from "../../components/details.svelte"
	import { getLanguage, currentLanguage } from "@utils/language"
	import { router } from "@baileyherbert/tinro"
	import { navigate } from "@utils/navigate"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	let selectedCategory: "all" | "2fa" | "mail" = "all"
	let customWebmailInput = "https://"
	let customWebmailError = ""

	$: if ($router.query?.category === "mail") {
		selectedCategory = "mail"
	} else if ($router.query?.category === "2fa") {
		selectedCategory = "2fa"
	}

	function connectMail(provider: "gmail" | "outlook" | "yahoo" | "proton" | "icloud" | "custom", customUrl?: string) {
		if (provider === "custom") {
			let url = (customUrl || customWebmailInput || "").trim()
			if (!url || url === "https://" || url === "http://") {
				customWebmailError = language.mail?.toastEnterValidUrl || "Please enter a valid webmail URL"
				return
			}
			customWebmailError = ""
			if (!url.startsWith("http://") && !url.startsWith("https://")) {
				url = "https://" + url
			}
			navigate(`/mail?action=login&provider=custom&url=${encodeURIComponent(url)}`)
		} else {
			navigate(`/mail?action=login&provider=${provider}`)
		}
	}
</script>
