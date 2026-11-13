// Logique de la page "Backup all" : répertoire de backup (settings),
// export multi-DB et import multi-DB. Les états sont retournés pour le template.
interface ZipEntry {
	filename: string
	size: number
	dbName: string | null
}

type ExportResult = {
	dbName: string
	displayName: string
	success: boolean
	filename?: string
	error?: string
}

type ImportResult = {
	dbName: string
	filename: string
	success: boolean
	error?: string
}

type ExportResponse = {
	success: boolean
	backups: ExportResult[]
	backupDir: string
	summary: { total: number; succeeded: number; failed: number }
}

type ImportResponse = {
	success: boolean
	results: ImportResult[]
	summary: { total: number; succeeded: number; failed: number }
}

// Import/export results need to be read (counts, partial failures) — keep them longer on screen
const RESULT_TOAST_DURATION = 5000

export const useBackupAll = () => {
	const { t } = useI18n()
	const { success: toastSuccess, error: toastError } = useAppToast()
	const { fetchDatabases, databases } = useDatabase()
	const backupStore = useBackupStore()
	const { selectedDbIds } = storeToRefs(backupStore)

	// --- Settings ---
	const backupSettings = ref({ backupDir: '' })
	const backupDirInput = ref('')
	const isSavingSettings = ref(false)

	const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

	const pickDirectory = async (): Promise<string | null> => {
		if (!isTauri) return null
		const { open } = await import('@tauri-apps/plugin-dialog')
		const selected = await open({ directory: true, multiple: false })
		return typeof selected === 'string' ? selected : null
	}

	const pickBackupDir = async () => {
		const dir = await pickDirectory()
		if (dir) backupDirInput.value = dir
	}

	const fetchSettings = async () => {
		try {
			const settings = await $fetch<{ backupDir: string }>('/api/backup/settings')
			backupSettings.value = settings
			backupDirInput.value = settings.backupDir
		} catch (error) {
			console.error('Failed to fetch backup settings:', error)
		}
	}

	const saveSettings = async () => {
		isSavingSettings.value = true
		try {
			const settings = await $fetch<{ backupDir: string }>('/api/backup/settings', {
				method: 'PATCH',
				body: { backupDir: backupDirInput.value },
			})
			backupSettings.value = settings
			toastSuccess(t('pages.backup_restore.settings_saved'))
		} catch (error) {
			console.error('Failed to save backup settings:', error)
			toastError(t('common.title.error'), t('pages.backup_restore.settings_save_error'))
		} finally {
			isSavingSettings.value = false
		}
	}

	// --- Export ---
	const isExporting = ref(false)
	const exportProgress = ref({ current: 0, total: 0 })
	const exportResults = ref<ExportResult[]>([])

	const onExport = async () => {
		isExporting.value = true
		exportResults.value = []
		exportProgress.value = { current: 0, total: selectedDbIds.value.length }

		try {
			const selectedNames = databases.value
				.filter(d => selectedDbIds.value.includes(d.id))
				.map(d => d.name)
				.join(',')

			const response = await $fetch<ExportResponse>(`/api/backup/all?dbNames=${encodeURIComponent(selectedNames)}`)

			for (const backup of response.backups) {
				exportProgress.value.current++
				exportResults.value.push({
					dbName: backup.dbName,
					displayName: backup.displayName,
					success: backup.success,
					filename: backup.filename,
					error: backup.error,
				})
			}

			const succeeded = exportResults.value.filter(r => r.success).length
			const failed = exportResults.value.filter(r => !r.success).length

			if (failed === 0) {
				toastSuccess(t('pages.backup_restore.export_success', { count: succeeded }), undefined, RESULT_TOAST_DURATION)
			} else if (succeeded > 0) {
				toastSuccess(t('pages.backup_restore.export_partial', { success: succeeded, total: exportResults.value.length }), undefined, RESULT_TOAST_DURATION)
			} else {
				toastError(t('common.title.error'), t('pages.backup_restore.export_failed'), RESULT_TOAST_DURATION)
			}
		} catch (error) {
			console.error('Export all failed:', error)
			toastError(t('common.title.error'), t('pages.backup_restore.export_failed'), RESULT_TOAST_DURATION)
		} finally {
			isExporting.value = false
			exportProgress.value = { current: 0, total: 0 }
		}
	}

	// --- Import ---
	const zipFiles = ref<ZipEntry[]>([])
	const selectedZipFiles = ref<string[]>([])
	const isScanning = ref(false)
	const hasScanned = ref(false)
	const isImporting = ref(false)
	const showConfirmModal = ref(false)
	const importProgress = ref({ current: 0, total: 0 })
	const importResults = ref<ImportResult[]>([])

	const replaceCount = computed(() => {
		return selectedZipFiles.value.filter(f => {
			const zip = zipFiles.value.find(z => z.filename === f)
			return zip?.dbName && databases.value.some(d => d.name === zip.dbName)
		}).length
	})

	const scanBackupDir = async () => {
		isScanning.value = true
		try {
			const response = await $fetch<{ files: ZipEntry[] }>('/api/backup/list-dir')
			zipFiles.value = response.files
			hasScanned.value = true
			selectedZipFiles.value = []
		} catch (error) {
			console.error('Failed to scan backup dir:', error)
			toastError(t('common.title.error'), t('pages.backup_restore.import_scan_error'))
		} finally {
			isScanning.value = false
		}
	}

	const toggleZipFile = (filename: string) => {
		const idx = selectedZipFiles.value.indexOf(filename)
		if (idx >= 0) {
			selectedZipFiles.value.splice(idx, 1)
		} else {
			selectedZipFiles.value.push(filename)
		}
	}

	const onImport = async () => {
		showConfirmModal.value = false
		isImporting.value = true
		importResults.value = []
		importProgress.value = { current: 0, total: selectedZipFiles.value.length }

		try {
			const response = await $fetch<ImportResponse>('/api/backup/all', {
				method: 'POST',
				body: { files: selectedZipFiles.value },
			})

			importResults.value = response.results
			importProgress.value.current = response.results.length

			const succeeded = response.summary.succeeded
			const failed = response.summary.failed

			if (failed === 0) {
				toastSuccess(t('pages.backup_restore.import_success', { count: succeeded }), undefined, RESULT_TOAST_DURATION)
			} else if (succeeded > 0) {
				toastSuccess(t('pages.backup_restore.import_partial', { success: succeeded, total: response.summary.total }), undefined, RESULT_TOAST_DURATION)
			} else {
				toastError(t('common.title.error'), t('pages.backup_restore.import_failed'), RESULT_TOAST_DURATION)
			}

			// Recharger la liste des DB et rescanner le répertoire
			await fetchDatabases()
			await scanBackupDir()
		} catch (error) {
			console.error('Import all failed:', error)
			toastError(t('common.title.error'), t('pages.backup_restore.import_failed'), RESULT_TOAST_DURATION)
		} finally {
			isImporting.value = false
			importProgress.value = { current: 0, total: 0 }
		}
	}

	return {
		backupSettings,
		backupDirInput,
		isSavingSettings,
		isTauri,
		pickBackupDir,
		fetchSettings,
		saveSettings,
		isExporting,
		exportProgress,
		exportResults,
		onExport,
		zipFiles,
		selectedZipFiles,
		isScanning,
		hasScanned,
		isImporting,
		showConfirmModal,
		importProgress,
		importResults,
		replaceCount,
		scanBackupDir,
		toggleZipFile,
		onImport,
	}
}
