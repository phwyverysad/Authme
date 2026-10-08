<div class="transparent-900 saveExportedCodes mx-auto my-6 sm:my-10 md:my-16 w-[96%] sm:w-[94%] md:w-[92%] lg:w-[90%] xl:w-4/5 max-w-7xl rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 text-left select-none transition-all">
	<!-- Page Title & Subtitle -->
	<div class="px-2 sm:px-6 md:px-10">
		<h1>{language.export?.exportCodes || "Export codes"}</h1>
		<p class="mt-2 text-base md:text-lg text-slate-500 dark:text-slate-400">
			{activeTab === "2fa"
				? (language.export?.exportSubtitle || "Select accounts and choose your preferred export format.")
				: (language.export?.mailExportSubtitle || "Select email accounts to export as backup or spreadsheet.")}
		</p>
	</div>

	<!-- Category Filter Tabs (Matching Import / Mail categories) -->
	<div class="px-2 sm:px-6 md:px-10 mt-6 flex flex-wrap items-center gap-3">
		<button
			type="button"
			class="px-5 py-2.5 rounded-xl text-sm md:text-base font-semibold transition-all cursor-pointer flex items-center gap-2
				{activeTab === '2fa'
					? 'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-md'
					: 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}"
			on:click={() => setTab("2fa")}
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
			<span>{language.export?.tab2fa || "2FA Codes"}</span>
			{#if $exportAccounts.length > 0}
				<span class="px-2 py-0.5 text-xs rounded-md font-bold {activeTab === '2fa' ? 'bg-white/20 text-white dark:bg-black/15 dark:text-black' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200'}">
					{$exportAccounts.length}
				</span>
			{/if}
		</button>

		<button
			type="button"
			class="px-5 py-2.5 rounded-xl text-sm md:text-base font-semibold transition-all cursor-pointer flex items-center gap-2
				{activeTab === 'mail'
					? 'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-md'
					: 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}"
			on:click={() => setTab("mail")}
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
			<span>{language.export?.tabMail || "Mail Accounts"}</span>
			{#if $exportMailAccounts.length > 0}
				<span class="px-2 py-0.5 text-xs rounded-md font-bold {activeTab === 'mail' ? 'bg-white/20 text-white dark:bg-black/15 dark:text-black' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200'}">
					{$exportMailAccounts.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- =================== TAB 1: 2FA CODES =================== -->
	{#if activeTab === "2fa"}
		{#if $isExportLoading}
			<div class="flex flex-col items-center justify-center py-28 text-slate-500 dark:text-slate-400">
				<div class="w-10 h-10 rounded-full border-3 border-slate-400 border-t-transparent animate-spin mb-4" />
				<p class="text-base font-medium">{language.common?.processing || "Loading vault accounts..."}</p>
			</div>
		{:else if $exportError}
			<div class="mx-6 md:mx-10 my-8 rounded-2xl p-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-center">
				<p class="font-semibold text-lg mb-3">{$exportError}</p>
				<button type="button" class="smallButton inline-flex" on:click={loadExportAccounts}>
					{language.common?.retry || "Try Again"}
				</button>
			</div>
		{:else if $exportAccounts.length === 0}
			<div class="mx-6 md:mx-10 my-10 rounded-2xl p-12 text-center transparent-800">
				<p class="text-lg text-slate-500 dark:text-slate-400">
					{language.export?.noAccountsFound || "No 2FA accounts found in vault."}
				</p>
			</div>
		{:else}
			<div class="mx-auto flex flex-col items-center justify-center gap-6 rounded-2xl p-6 md:p-10">
				<!-- Step 1 Card: Account Selector -->
				<div class="transparent-800 flex w-full flex-col items-start rounded-2xl p-6 md:p-8 text-left border border-slate-200/80 dark:border-white/10">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
						<div>
							<h2>{language.export?.selectAccounts || "Select Accounts"}</h2>
							<h3 class="flex items-center gap-2 mt-1">
								<span>{language.export?.accountsSelected || "Accounts selected"}:</span>
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-300/80 dark:border-white/15">
									{selectedCount} / {$exportAccounts.length}
								</span>
							</h3>
						</div>

						<div class="flex items-center gap-2 self-start sm:self-auto">
							<button type="button" class="smallButton cursor-pointer" on:click={handleSelectAll2fa}>
								{language.export?.selectAll || "Select All"}
							</button>
							<button type="button" class="smallButton cursor-pointer" on:click={handleDeselectAll2fa}>
								{language.export?.deselectAll || "Deselect All"}
							</button>
						</div>
					</div>

					<!-- Search Filter -->
					<div class="relative w-full mt-5">
						<svg class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
						<input
							type="text"
							bind:value={search2fa}
							placeholder={language.export?.searchAccountsPlaceholder || "Filter accounts..."}
							class="w-full pl-12 pr-12 py-3.5 rounded-2xl text-base shadow-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] focus:border-slate-400 dark:focus:border-white/30 focus:bg-white dark:focus:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all outline-none"
						/>
						{#if search2fa}
							<button
								type="button"
								on:click={() => (search2fa = "")}
								class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						{/if}
					</div>

					<!-- Accounts Grid (Spacious, tactile, clean custom check) -->
					<div class="grid grid-cols-1 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3 gap-3.5 w-full mt-5 max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar select-none">
						{#each filteredAccounts as acc (acc.id)}
							{@const icon = getServiceIcon(acc.issuer, acc.name)}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<div
								role="button"
								tabindex="0"
								class="group relative flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-150 cursor-pointer
									{acc.selected
										? 'bg-blue-50/80 dark:bg-white/10 border-blue-500/50 dark:border-white/30 text-slate-900 dark:text-white shadow-md shadow-blue-500/5 dark:shadow-black/20'
										: 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/80 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 shadow-xs'}"
								on:click={() => toggleAccount2fa(acc.id)}
							>
								<!-- Custom Checkbox Indicator -->
								<div
									class="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150
										{acc.selected
											? 'bg-blue-600 text-white dark:bg-white dark:text-slate-900 shadow-sm'
											: 'border-2 border-slate-300 dark:border-white/20 group-hover:border-slate-400 dark:group-hover:border-white/40'}"
								>
									{#if acc.selected}
										<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12" />
										</svg>
									{/if}
								</div>

								<!-- Service Brand Icon -->
								<span
									class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-black/10 dark:border-white/15 [&>svg]:w-5.5 [&>svg]:h-5.5 [&>img]:w-5.5 [&>img]:h-5.5 [&>span]:text-sm [&>span]:font-bold [&>span]:text-white"
									style="{icon.bg || 'background: #64748b;'}"
								>
									{@html icon.svg}
								</span>

								<!-- Account Info -->
								<div class="min-w-0 flex-1 text-left">
									<p class="text-[15px] font-semibold text-slate-900 dark:text-white truncate leading-tight group-hover:text-slate-900 dark:group-hover:text-white">
										{acc.issuer}
									</p>
									<p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 leading-tight group-hover:text-slate-700 dark:group-hover:text-slate-300">
										{acc.name || acc.issuer}
									</p>
								</div>
							</div>
						{/each}
					</div>

					{#if filteredAccounts.length === 0}
						<p class="text-center w-full py-8 text-sm text-slate-500 dark:text-slate-400">
							{language.common?.noResultsFound || "No accounts match search filter"}
						</p>
					{/if}
				</div>

				<!-- Step 2: Hero - All-In-One Transfer QR Code (Combined 1-3 QRs) -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left border-2 border-emerald-500/50 bg-emerald-50/60 dark:bg-emerald-500/10">
					<div class="max-w-2xl pr-4">
						<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300 mb-2 border border-emerald-300 dark:border-transparent">
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
							<span>{language.export?.recommendedBadge || "RECOMMENDED • ALL AUTHENTICATORS"}</span>
						</div>
						<h2>{language.export?.allInOneQrCard || "All-In-One Transfer QR Code (1-3 QR)"}</h2>
						<h3>{language.export?.allInOneQrCardText || "Google Authenticator migration protocol. Bundles up to 10 accounts per QR code for 1-tap transfer to Google Authenticator, 2FAS, Aegis, Ente, or Raivo."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button !bg-emerald-600 hover:!bg-emerald-500 !text-white !border-emerald-600 cursor-pointer shadow-md"
							disabled={selectedCount === 0}
							on:click={openMigrationModal}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
							<span>{language.export?.viewAllInOneQrButton || "Open Transfer QR"}</span>
							{#if selectedCount > 0}
								<span class="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/25 text-white font-bold">
									{Math.ceil(selectedCount / 10)} QR
								</span>
							{/if}
						</button>
					</div>
				</div>

				<!-- Step 3: Single QR Codes on Screen -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.viewQrOnScreen || "Single QR Codes on Screen"}</h2>
						<h3>{language.export?.viewQrOnScreenText || "Browse and scan accounts one-by-one directly on your screen without saving any files to disk."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedCount === 0}
							on:click={openQrViewer}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							{language.export?.viewQrButton || "View Single QRs"}
						</button>
					</div>
				</div>

				<!-- Step 4: Export HTML with QR Codes -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportHTMlFile || "Export HTML with QR Codes"}</h2>
						<h3>{language.export?.exportHTMlFileText || "Standalone printable backup page with All-in-One transfer QR and individual codes."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedCount === 0}
							on:click={() => exportSelectedHtmlFile(selectedAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="m9 18 3-3-3-3" /><path d="m5 12-3 3 3 3" /></svg>
							{language.export?.exportHtmlButton || "Export HTML"}
						</button>
					</div>
				</div>

				<!-- Step 5: Export Authme Vault File (.authme) -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportAuthmeFile || "Export Authme file (.authme)"}</h2>
						<h3>{language.export?.exportAuthmeFileText || "Native format for importing back into Authme on another device or installation."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedCount === 0}
							on:click={() => exportSelectedAuthmeFile(selectedAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/></svg>
							{language.export?.exportAuthmeButton || "Export Authme"}
						</button>
					</div>
				</div>

				<!-- Step 6: Export Universal JSON (.json) -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportJsonFile || "Export Universal JSON (.json)"}</h2>
						<h3>{language.export?.exportJsonFileText || "Standard JSON format compatible with 2FA migration scripts and password managers."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedCount === 0}
							on:click={() => exportSelectedJsonFile(selectedAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
							{language.export?.exportJsonButton || "Export JSON"}
						</button>
					</div>
				</div>

				<!-- Step 7: Export CSV Spreadsheet (.csv) -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportCsvFile || "Export CSV Spreadsheet (.csv)"}</h2>
						<h3>{language.export?.exportCsvFileText || "Compatible with Microsoft Excel, Google Sheets, Bitwarden, and KeePassXC."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedCount === 0}
							on:click={() => exportSelectedCsvFile(selectedAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
							{language.export?.exportCsvButton || "Export CSV"}
						</button>
					</div>
				</div>

				<!-- Step 8: Export Plain Text URIs (.txt) -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportTxtFile || "Export OTPAuth URIs (.txt)"}</h2>
						<h3>{language.export?.exportTxtFileText || "Plain text list with one otpauth:// URI per line, widely supported across authenticators."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedCount === 0}
							on:click={() => exportSelectedTxtFile(selectedAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
							{language.export?.exportTxtButton || "Export TXT"}
						</button>
					</div>
				</div>
			</div>
		{/if}

	<!-- =================== TAB 2: MAIL ACCOUNTS =================== -->
	{:else if activeTab === "mail"}
		{#if $isMailExportLoading}
			<div class="flex flex-col items-center justify-center py-28 text-slate-500 dark:text-slate-400">
				<div class="w-10 h-10 rounded-full border-3 border-slate-400 border-t-transparent animate-spin mb-4" />
				<p class="text-base font-medium">{language.common?.processing || "Loading mail accounts..."}</p>
			</div>
		{:else if $mailExportError}
			<div class="mx-6 md:mx-10 my-8 rounded-2xl p-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-center">
				<p class="font-semibold text-lg mb-3">{$mailExportError}</p>
				<button type="button" class="smallButton inline-flex" on:click={loadMailExportAccounts}>
					{language.common?.retry || "Try Again"}
				</button>
			</div>
		{:else if $exportMailAccounts.length === 0}
			<div class="mx-6 md:mx-10 my-10 rounded-2xl p-12 text-center transparent-800">
				<p class="text-lg text-slate-500 dark:text-slate-400">
					{language.export?.noMailAccountsFound || "No connected email accounts found."}
				</p>
			</div>
		{:else}
			<div class="mx-auto flex flex-col items-center justify-center gap-6 rounded-2xl p-6 md:p-10">
				<!-- Step 1 Card: Mail Accounts Selector -->
				<div class="transparent-800 flex w-full flex-col items-start rounded-2xl p-6 md:p-8 text-left border border-slate-200/80 dark:border-white/10">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
						<div>
							<h2>{language.export?.selectAccounts || "Select Mail Accounts"}</h2>
							<h3 class="flex items-center gap-2 mt-1">
								<span>{language.export?.accountsSelected || "Accounts selected"}:</span>
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-300/80 dark:border-white/15">
									{selectedMailCount} / {$exportMailAccounts.length}
								</span>
							</h3>
						</div>

						<div class="flex items-center gap-2 self-start sm:self-auto">
							<button type="button" class="smallButton cursor-pointer" on:click={handleSelectAllMail}>
								{language.export?.selectAll || "Select All"}
							</button>
							<button type="button" class="smallButton cursor-pointer" on:click={handleDeselectAllMail}>
								{language.export?.deselectAll || "Deselect All"}
							</button>
						</div>
					</div>

					<!-- Search Filter -->
					<div class="relative w-full mt-5">
						<svg class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
						<input
							type="text"
							bind:value={searchMail}
							placeholder={language.export?.searchAccountsPlaceholder || "Filter email accounts..."}
							class="w-full pl-12 pr-12 py-3.5 rounded-2xl text-base shadow-sm border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] focus:border-slate-400 dark:focus:border-white/30 focus:bg-white dark:focus:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all outline-none"
						/>
						{#if searchMail}
							<button
								type="button"
								on:click={() => (searchMail = "")}
								class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						{/if}
					</div>

					<!-- Accounts Grid (Spacious, tactile, clean custom check) -->
					<div class="grid grid-cols-1 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3 gap-3.5 w-full mt-5 max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar select-none">
						{#each filteredMailAccounts as acc (acc.id)}
							{@const icon = getServiceIcon(acc.provider, acc.email)}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<div
								role="button"
								tabindex="0"
								class="group relative flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-150 cursor-pointer
									{acc.selected
										? 'bg-blue-50/80 dark:bg-white/10 border-blue-500/50 dark:border-white/30 text-slate-900 dark:text-white shadow-md shadow-blue-500/5 dark:shadow-black/20'
										: 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/80 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 shadow-xs'}"
								on:click={() => toggleAccountMail(acc.id)}
							>
								<!-- Custom Checkbox Indicator -->
								<div
									class="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150
										{acc.selected
											? 'bg-blue-600 text-white dark:bg-white dark:text-slate-900 shadow-sm'
											: 'border-2 border-slate-300 dark:border-white/20 group-hover:border-slate-400 dark:group-hover:border-white/40'}"
								>
									{#if acc.selected}
										<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12" />
										</svg>
									{/if}
								</div>

								<!-- Provider Icon -->
								<span
									class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-black/10 dark:border-white/15 [&>svg]:w-5.5 [&>svg]:h-5.5 [&>img]:w-5.5 [&>img]:h-5.5 [&>span]:text-sm [&>span]:font-bold [&>span]:text-white"
									style="{icon.bg || 'background: #64748b;'}"
								>
									{@html icon.svg}
								</span>

								<!-- Account Info -->
								<div class="min-w-0 flex-1 text-left">
									<div class="flex items-center gap-2">
										<p class="text-[15px] font-semibold text-slate-900 dark:text-white truncate leading-tight group-hover:text-slate-900 dark:group-hover:text-white">
											{acc.name || acc.email}
										</p>
										{#if acc.label}
											<span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold flex-shrink-0 border border-slate-200 dark:border-transparent">
												{acc.label}
											</span>
										{/if}
									</div>
									<p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 leading-tight group-hover:text-slate-700 dark:group-hover:text-slate-300">
										{acc.email}
									</p>
								</div>
							</div>
						{/each}
					</div>

					{#if filteredMailAccounts.length === 0}
						<p class="text-center w-full py-8 text-sm text-slate-500 dark:text-slate-400">
							{language.common?.noResultsFound || "No accounts match search filter"}
						</p>
					{/if}
				</div>

				<!-- Mail Format 1: Backup JSON -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportMailJsonTitle || "Export Mail Backup (.json)"}</h2>
						<h3>{language.export?.exportMailJsonText || "Structured JSON file with complete account configurations and provider metadata."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedMailCount === 0}
							on:click={() => exportSelectedMailJson(selectedMailAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
							{language.export?.exportMailJsonButton || "Export JSON"}
						</button>
					</div>
				</div>

				<!-- Mail Format 2: CSV Spreadsheet -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportMailCsvTitle || "Export CSV Spreadsheet (.csv)"}</h2>
						<h3>{language.export?.exportMailCsvText || "Spreadsheet containing Provider, Email, Account Name, and Label for Excel or Sheets."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedMailCount === 0}
							on:click={() => exportSelectedMailCsv(selectedMailAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
							{language.export?.exportMailCsvButton || "Export CSV"}
						</button>
					</div>
				</div>

				<!-- Mail Format 3: Plain Text -->
				<div class="transparent-800 flex w-full flex-col md:flex-row md:items-center justify-between rounded-xl p-6 md:p-8 text-left">
					<div class="max-w-2xl pr-4">
						<h2>{language.export?.exportMailTxtTitle || "Export Plain Text (.txt)"}</h2>
						<h3>{language.export?.exportMailTxtText || "Clean plain text list of email accounts and connected providers."}</h3>
					</div>

					<div class="mt-6 md:mt-0 flex-shrink-0">
						<button
							type="button"
							class="button cursor-pointer"
							disabled={selectedMailCount === 0}
							on:click={() => exportSelectedMailTxt(selectedMailAccounts)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
							{language.export?.exportMailTxtButton || "Export TXT"}
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- ========================================================================= -->
<!-- MODAL 1: All-In-One Transfer QR Code Modal (1-3 QR for all major apps)   -->
<!-- ========================================================================= -->
{#if showMigrationModal && currentBatch}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none"
		on:click|self={() => (showMigrationModal = false)}
		on:keydown|self={(e) => e.key === "Escape" && (showMigrationModal = false)}
	>
		<div
			transition:scale={{ start: 0.94, duration: 180 }}
			class="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl p-6 sm:p-8 shadow-2xl border text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white backdrop-blur-2xl"
		>
			<!-- Top Bar / Header -->
			<div class="flex items-start justify-between mb-5 pb-4 border-b border-slate-200 dark:border-white/10">
				<div class="text-left pr-4">
					<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 mb-2">
						<span class="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
						<span>{language.export?.googleMigrationProtocol || "Google Authenticator Migration Protocol"}</span>
					</div>
					<h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
						{language.export?.migrationModalTitle || "All-In-One Transfer QR Code"}
					</h2>
					<p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
						{language.export?.migrationModalSubtitle?.replace("{count}", selectedCount.toString()) ||
							`Scan with Google Authenticator, 2FAS, Aegis, or Ente to import all ${selectedCount} selected accounts.`}
					</p>
				</div>

				<button
					type="button"
					on:click={() => (showMigrationModal = false)}
					class="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
					aria-label={language.common?.close || "Close"}
					title={language.common?.close || "Close"}
				>
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			</div>

			<!-- Main Content: Symmetrical 2-Column Split on Desktop -->
			<div class="flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-8">
				<!-- Left Column: Large QR Code + Batch Badge + Navigation (Centered, no awkward stretching) -->
				<div class="w-full md:w-[44%] flex flex-col items-center justify-center gap-4 p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
					<!-- QR Code Canvas -->
					<div class="p-5 sm:p-6 rounded-2xl bg-white shadow-xl border border-slate-200/80 dark:border-transparent inline-flex flex-col items-center justify-center transition-transform">
						<img
							src={currentBatch.qrDataUrl}
							alt="Transfer QR Batch {migrationBatchIndex + 1} of {migrationBatches.length}"
							class="w-56 h-56 sm:w-60 sm:h-60 object-contain select-none image-rendering-pixelated"
						/>
					</div>

					<!-- Batch Indicator Badge -->
					<div class="flex items-center justify-center">
						<span class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-white/10 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 shadow-xs">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
							<span>
								{language.export?.batchCounter
									?.replace("{current}", (migrationBatchIndex + 1).toString())
									?.replace("{total}", migrationBatches.length.toString())
									?.replace("{count}", currentBatch.accountCount.toString()) ||
									`QR Code ${migrationBatchIndex + 1} of ${migrationBatches.length} (${currentBatch.accountCount} Accounts)`}
							</span>
						</span>
					</div>

					<!-- Batch Navigation if > 1 QR code -->
					{#if migrationBatches.length > 1}
						<div class="flex items-center justify-between gap-3 w-full px-2">
							<button
								type="button"
								disabled={migrationBatchIndex === 0}
								on:click={() => (migrationBatchIndex = Math.max(0, migrationBatchIndex - 1))}
								class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer
									{migrationBatchIndex === 0
										? 'text-slate-400 dark:text-slate-600 bg-slate-200/50 dark:bg-white/5 cursor-not-allowed'
										: 'text-slate-800 dark:text-white bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 active:scale-95'}"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><path d="m15 18-6-6 6-6"/></svg>
								<span>{language.common?.previous || "Previous"}</span>
							</button>

							<div class="flex items-center gap-1.5">
								{#each migrationBatches as _, idx}
									<span class="h-2 rounded-full transition-all duration-300 {idx === migrationBatchIndex ? 'w-6 bg-emerald-500 dark:bg-emerald-400' : 'w-2 bg-slate-300 dark:bg-white/20'}" />
								{/each}
							</div>

							<button
								type="button"
								disabled={migrationBatchIndex === migrationBatches.length - 1}
								on:click={() => (migrationBatchIndex = Math.min(migrationBatches.length - 1, migrationBatchIndex + 1))}
								class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer
									{migrationBatchIndex === migrationBatches.length - 1
										? 'text-slate-400 dark:text-slate-600 bg-slate-200/50 dark:bg-white/5 cursor-not-allowed'
										: 'text-slate-800 dark:text-white bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 active:scale-95'}"
							>
								<span>{language.common?.next || "Next"}</span>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><path d="m9 18 6-6-6-6"/></svg>
							</button>
						</div>
					{/if}
				</div>

				<!-- Right Column: Included Accounts List + Action Buttons -->
				<div class="w-full md:w-[56%] flex flex-col justify-between text-left">
					<div class="flex flex-col flex-1">
						<div class="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-white/10">
							<span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
								{language.export?.accountsInThisQr || "Accounts in this QR"} ({currentBatch.accounts.length})
							</span>
							<span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
								{language.export?.batchIndicator || "Batch"} {migrationBatchIndex + 1} / {migrationBatches.length}
							</span>
						</div>

						<!-- Spacious Accounts List with Authentic Brand Icons and Full Text -->
						<div class="flex flex-col gap-2 max-h-[290px] overflow-y-auto custom-scrollbar pr-1.5">
							{#each currentBatch.accounts as item, idx}
								{@const icon = getServiceIcon(item.issuer, item.name)}
								<div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all">
									<span
										class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-black/10 dark:border-white/15 [&>svg]:w-5 [&>svg]:h-5 [&>img]:w-5 [&>img]:h-5 [&>span]:text-xs [&>span]:font-bold [&>span]:text-white"
										style="{icon.bg || 'background: #64748b;'}"
									>
										{@html icon.svg}
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
											{item.issuer}
										</p>
										<p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-tight">
											{item.name || item.issuer}
										</p>
									</div>
									<span class="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/5 border border-slate-300/70 dark:border-white/10">
										#{idx + 1}
									</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Bottom Action Buttons (Sleek, side-by-side, explicit SVG dimensions) -->
					<div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
						<button
							type="button"
							on:click={() => downloadQrPngImage(currentBatch.qrDataUrl, `authme_migration_qr_${migrationBatchIndex + 1}_of_${migrationBatches.length}`)}
							class="h-11 px-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
							<span class="truncate">{language.export?.downloadQrPng || "Download PNG"}</span>
						</button>

						<button
							type="button"
							on:click={() => copyTextToClipboard(currentBatch.uri, language.export?.copied || "Copied Migration URI")}
							class="h-11 px-3 rounded-xl font-semibold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/15 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							<span class="truncate">{language.export?.copyUri || "Copy URI"}</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ========================================================================= -->
<!-- MODAL 2: Single Account QR Code Gallery Modal                             -->
<!-- ========================================================================= -->
{#if showQrModal && activeQrAccount}
	{@const currentUri = buildOtpauthUri(activeQrAccount)}
	{@const currentQrUrl = generateQrDataUrl(currentUri, 6, 2)}
	{@const icon = getServiceIcon(activeQrAccount.issuer, activeQrAccount.name)}
	<div
		role="presentation"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none"
		on:click|self={() => (showQrModal = false)}
		on:keydown|self={(e) => e.key === "Escape" && (showQrModal = false)}
	>
		<div
			transition:scale={{ start: 0.94, duration: 180 }}
			class="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl p-6 sm:p-8 shadow-2xl border text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white backdrop-blur-2xl"
		>
			<!-- Top Bar / Header -->
			<div class="flex items-start justify-between mb-5 pb-4 border-b border-slate-200 dark:border-white/10">
				<div class="flex items-center gap-3.5 text-left min-w-0 pr-4">
					<span
						class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-black/10 dark:border-white/15 [&>svg]:w-7 [&>svg]:h-7 [&>img]:w-7 [&>img]:h-7 [&>span]:text-lg [&>span]:font-bold [&>span]:text-white"
						style="{icon.bg || 'background: #64748b;'}"
					>
						{@html icon.svg}
					</span>
					<div class="min-w-0">
						<h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate leading-tight">
							{activeQrAccount.issuer}
						</h3>
						<p class="text-xs sm:text-sm text-slate-500 dark:text-slate-300 truncate mt-0.5">
							{activeQrAccount.name || activeQrAccount.issuer}
						</p>
					</div>
				</div>

				<button
					type="button"
					on:click={() => (showQrModal = false)}
					class="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
					aria-label={language.common?.close || "Close"}
					title={language.common?.close || "Close"}
				>
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			</div>

			<!-- Main 2-Column Split: Left (QR & Nav) | Right (Secret & Actions) -->
			<div class="flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-8">
				<!-- Left Column: QR Code + Carousel Navigation (Centered, no stretching) -->
				<div class="w-full md:w-[46%] flex flex-col items-center justify-center gap-4 p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
					<!-- QR Code Canvas -->
					<div class="p-5 sm:p-6 rounded-2xl bg-white shadow-xl border border-slate-200/80 dark:border-transparent inline-flex items-center justify-center">
						<img
							src={currentQrUrl}
							alt="{activeQrAccount.issuer} QR Code"
							class="w-56 h-56 sm:w-60 sm:h-60 object-contain select-none image-rendering-pixelated"
						/>
					</div>

					<!-- Navigation controls if multiple accounts selected -->
					{#if selectedAccounts.length > 1}
						<div class="flex items-center justify-between gap-3 w-full px-2">
							<button
								type="button"
								on:click={prevQrAccount}
								class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-white bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><path d="m15 18-6-6 6-6"/></svg>
								<span>{language.common?.previous || "Previous"}</span>
							</button>

							<span class="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
								{qrAccountIndex + 1} / {selectedAccounts.length}
							</span>

							<button
								type="button"
								on:click={nextQrAccount}
								class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-white bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
							>
								<span>{language.common?.next || "Next"}</span>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><path d="m9 18 6-6-6-6"/></svg>
							</button>
						</div>
					{/if}
				</div>

				<!-- Right Column: Secret Key + Actions -->
				<div class="w-full md:w-[54%] flex flex-col justify-between text-left">
					<div class="space-y-4">
						<!-- Secret Key Box -->
						<div class="rounded-2xl p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
									{language.codes?.secretKey || "Secret Key"}
								</span>
								<button
									type="button"
									on:click={() => (showPlainSecret = !showPlainSecret)}
									class="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 transition-colors"
								>
									{showPlainSecret ? (language.common?.hide || "Hide") : (language.common?.show || "Show")}
								</button>
							</div>
							<p class="font-mono text-sm sm:text-base font-bold tracking-wider select-all break-all text-slate-900 dark:text-white bg-slate-200/60 dark:bg-black/20 p-3 rounded-xl border border-slate-300/60 dark:border-white/5">
								{showPlainSecret ? formatSecretGroups(activeQrAccount.secret) : "•••• •••• •••• ••••"}
							</p>
						</div>

						<!-- Metadata Specs -->
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
								{language.export?.typeLabel || "Type"}: <strong class="text-slate-900 dark:text-white">{activeQrAccount.type || "TOTP"}</strong>
							</span>
							<span class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
								{language.export?.digitsLabel || "Digits"}: <strong class="text-slate-900 dark:text-white">{activeQrAccount.digits || 6}</strong>
							</span>
							<span class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
								{language.export?.periodLabel || "Period"}: <strong class="text-slate-900 dark:text-white">{activeQrAccount.period || 30}s</strong>
							</span>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
						<button
							type="button"
							on:click={() => downloadSingleQrPng(activeQrAccount)}
							class="h-11 px-2.5 rounded-xl font-bold text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
							title={language.export?.downloadQrPng || "Download QR PNG"}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
							<span class="truncate">{language.export?.qrPng || "PNG"}</span>
						</button>

						<button
							type="button"
							on:click={() => copyTextToClipboard(currentUri, language.export?.copied || "Copied URI")}
							class="h-11 px-2.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
							title={language.export?.copyUri || "Copy URI"}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							<span class="truncate">{language.export?.copyUri || "Copy URI"}</span>
						</button>

						<button
							type="button"
							on:click={() => copyTextToClipboard(activeQrAccount.secret, language.export?.copied || "Copied Secret")}
							class="h-11 px-2.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
							title={language.export?.copySecret || "Copy Secret"}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 flex-shrink-0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
							<span class="truncate">{language.export?.copySecret || "Secret"}</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(148, 163, 184, 0.4);
		border-radius: 9999px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(148, 163, 184, 0.7);
	}
	:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.18);
	}
	:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.35);
	}
</style>

<script lang="ts">
	import { onMount } from "svelte"
	import { fade, scale } from "svelte/transition"
	import {
		exportAccounts,
		isExportLoading,
		exportError,
		loadExportAccounts,
		exportMailAccounts,
		isMailExportLoading,
		mailExportError,
		loadMailExportAccounts,
		exportSelectedAuthmeFile,
		exportSelectedHtmlFile,
		exportSelectedJsonFile,
		exportSelectedCsvFile,
		exportSelectedTxtFile,
		exportSelectedMailJson,
		exportSelectedMailCsv,
		exportSelectedMailTxt,
		downloadSingleQrPng,
		downloadQrPngImage,
		buildOtpauthUri,
		generateQrDataUrl,
		formatSecretGroups,
		generateMigrationBatches,
		type ExportAccount,
		type ExportMailItem,
		type MigrationBatch,
	} from "./index"
	import { getLanguage, currentLanguage } from "@utils/language"
	import { getServiceIcon } from "../../utils/icons"
	import { showToast } from "../../stores/dialog"

	let language = getLanguage()
	$: language = $currentLanguage || getLanguage()

	// Tab switcher
	let activeTab: "2fa" | "mail" = "2fa"

	// 2FA filters and states
	let search2fa = ""
	let showQrModal = false
	let qrAccountIndex = 0
	let showPlainSecret = false

	// Migration QR (All-In-One) states
	let showMigrationModal = false
	let migrationBatchIndex = 0
	let migrationBatches: MigrationBatch[] = []

	// Mail filters
	let searchMail = ""

	// Reactive 2FA lists
	$: filteredAccounts = $exportAccounts.filter((acc) => {
		if (!search2fa.trim()) return true
		const q = search2fa.toLowerCase()
		return acc.issuer.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q)
	})

	$: selectedAccounts = $exportAccounts.filter((acc) => acc.selected)
	$: selectedCount = selectedAccounts.length
	$: activeQrAccount = selectedAccounts[qrAccountIndex] || selectedAccounts[0]
	$: currentBatch = migrationBatches[migrationBatchIndex] || migrationBatches[0]

	// Reactive Mail lists
	$: filteredMailAccounts = $exportMailAccounts.filter((acc) => {
		if (!searchMail.trim()) return true
		const q = searchMail.toLowerCase()
		return (
			acc.email.toLowerCase().includes(q) ||
			acc.name.toLowerCase().includes(q) ||
			acc.provider.toLowerCase().includes(q) ||
			(acc.label && acc.label.toLowerCase().includes(q))
		)
	})

	$: selectedMailAccounts = $exportMailAccounts.filter((acc) => acc.selected)
	$: selectedMailCount = selectedMailAccounts.length

	const setTab = (tab: "2fa" | "mail") => {
		activeTab = tab
		if (tab === "mail" && $exportMailAccounts.length === 0 && !$isMailExportLoading) {
			loadMailExportAccounts()
		}
	}

	// 2FA Handlers
	const handleSelectAll2fa = () => {
		exportAccounts.update((items) =>
			items.map((it) => {
				const matches =
					!search2fa.trim() ||
					it.issuer.toLowerCase().includes(search2fa.toLowerCase()) ||
					it.name.toLowerCase().includes(search2fa.toLowerCase())
				return matches ? { ...it, selected: true } : it
			})
		)
	}

	const handleDeselectAll2fa = () => {
		exportAccounts.update((items) =>
			items.map((it) => {
				const matches =
					!search2fa.trim() ||
					it.issuer.toLowerCase().includes(search2fa.toLowerCase()) ||
					it.name.toLowerCase().includes(search2fa.toLowerCase())
				return matches ? { ...it, selected: false } : it
			})
		)
	}

	const toggleAccount2fa = (id: string) => {
		exportAccounts.update((items) =>
			items.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
		)
	}

	const openMigrationModal = () => {
		if (selectedAccounts.length === 0) {
			showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
			return
		}
		migrationBatches = generateMigrationBatches(selectedAccounts, 10)
		migrationBatchIndex = 0
		showMigrationModal = true
	}

	const openQrViewer = () => {
		if (selectedAccounts.length === 0) {
			showToast(language.export?.noAccountsSelected || "Please select at least 1 account", "warning")
			return
		}
		qrAccountIndex = 0
		showPlainSecret = false
		showQrModal = true
	}

	const nextQrAccount = () => {
		if (selectedAccounts.length > 0) {
			qrAccountIndex = (qrAccountIndex + 1) % selectedAccounts.length
			showPlainSecret = false
		}
	}

	const prevQrAccount = () => {
		if (selectedAccounts.length > 0) {
			qrAccountIndex = (qrAccountIndex - 1 + selectedAccounts.length) % selectedAccounts.length
			showPlainSecret = false
		}
	}

	// Mail Handlers
	const handleSelectAllMail = () => {
		exportMailAccounts.update((items) =>
			items.map((it) => {
				const q = searchMail.toLowerCase()
				const matches =
					!searchMail.trim() ||
					it.email.toLowerCase().includes(q) ||
					it.name.toLowerCase().includes(q) ||
					it.provider.toLowerCase().includes(q) ||
					(it.label && it.label.toLowerCase().includes(q))
				return matches ? { ...it, selected: true } : it
			})
		)
	}

	const handleDeselectAllMail = () => {
		exportMailAccounts.update((items) =>
			items.map((it) => {
				const q = searchMail.toLowerCase()
				const matches =
					!searchMail.trim() ||
					it.email.toLowerCase().includes(q) ||
					it.name.toLowerCase().includes(q) ||
					it.provider.toLowerCase().includes(q) ||
					(it.label && it.label.toLowerCase().includes(q))
				return matches ? { ...it, selected: false } : it
			})
		)
	}

	const toggleAccountMail = (id: string) => {
		exportMailAccounts.update((items) =>
			items.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
		)
	}

	const copyTextToClipboard = async (text: string, successMsg: string) => {
		try {
			await navigator.clipboard.writeText(text)
			showToast(successMsg, "success")
		} catch (e) {
			console.error("Copy failed:", e)
		}
	}

	onMount(() => {
		loadExportAccounts()
		loadMailExportAccounts()
	})
</script>
