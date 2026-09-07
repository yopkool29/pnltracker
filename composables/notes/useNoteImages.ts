const extractNtImages = (content: string): string[] => {
	let decoded: string
	try {
		decoded = decodeURIComponent(content)
	} catch {
		decoded = content
	}
	const results = new Set<string>()

	// Match images with .../nt_xxx or .../tmp_nt_xxx pattern (works for both /path/ and ?path=.../)
	// Gère aussi les titles markdown optionnels : ![caption](url "title")
	const mdRegex = /!\[[^\]]*\]\([^)]*\/(tmp_)?(nt_[^)&\s"']+)(?:\s+"[^"]*")?\)/g
	for (const match of decoded.matchAll(mdRegex)) {
		// Inclure le préfixe tmp_ si présent pour matcher le filename exact
		results.add(match[1] ? `${match[1]}${match[2]}` : match[2])
	}

	// Fallback : images en HTML (Milkdown peut générer <img> pour les image blocks avec caption)
	const htmlRegex = /<img[^>]*src="[^"]*\/(tmp_)?(nt_[^"&\s]+)"/g
	for (const match of decoded.matchAll(htmlRegex)) {
		results.add(match[1] ? `${match[1]}${match[2]}` : match[2])
	}

	return Array.from(results)
}

export const useNoteImages = () => {
	const userStore = useUserStore()
	const { currentDatabase } = useDatabase()

	const uploadContext = computed(() => {
		const userId = userStore.user?.id
		const dbName = currentDatabase.value?.name
		if (!userId || !dbName) return undefined
		return { userId, dbName }
	})

	const normalizeImageUrl = (url: string) => {
		const match = url.match(/\/screenshots\/([^&\s]+)/)
		return match ? `/api/image?path=screenshots/${match[1]}` : url
	}

	const fileToDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = reject
		reader.readAsDataURL(file)
	})

	const uploadFile = async (file: File): Promise<string> => {
		if (!uploadContext.value) return fileToDataUrl(file)

		const formData = new FormData()
		formData.append('image', file)
		const result = await $fetch<{ url: string }>('/api/notes/images/upload', {
			method: 'POST',
			body: formData,
		})
		return normalizeImageUrl(result.url)
	}

	const cleanupOrphanImages = async (oldContent: string, newContent: string) => {
		if (!uploadContext.value) return
		const oldImages = extractNtImages(oldContent)
		const newImages = new Set(extractNtImages(newContent))
		const orphans = oldImages.filter(name => !newImages.has(name))
		for (const filename of orphans) {
			// console.log('Deleting orphan image:', filename)
			try {
				await $fetch(`/api/notes/images/${encodeURIComponent(filename)}`, { method: 'DELETE' })
			} catch {
				// ignore — file may already be deleted
			}
		}
	}

	const cleanupTmpImages = async () => {
		if (!uploadContext.value) return
		try {
			await $fetch('/api/notes/images/cleanup-tmp', { method: 'DELETE' })
		} catch {
			// ignore
		}
	}

	const finalizeImages = async (noteId: number, content: string): Promise<string> => {
		if (!uploadContext.value || !content.includes('tmp_nt_')) return content
		try {
			const result = await $fetch<{ content: string }>('/api/notes/images/finalize', {
				method: 'POST',
				body: { noteId, content },
			})
			return result.content
		} catch {
			return content
		}
	}

	const duplicateImages = async (content: string): Promise<string> => {
		if (!uploadContext.value) return content

		const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
		const matches = [...content.matchAll(imageRegex)]

		let newContent = content
		for (const match of matches) {
			const fullMatch = match[0]
			const imageUrl = match[1]

			// Skip base64 images and external URLs
			if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) {
				continue
			}

			// Skip already-temporary images (they're already independent copies)
			if (imageUrl.includes('tmp_nt_')) {
				continue
			}

			// Only process local note images
			if (!imageUrl.includes('/api/image') && !imageUrl.includes('nt_')) {
				continue
			}

			try {
				// Fetch the image as blob
				const response = await fetch(imageUrl)
				if (!response.ok) continue

				const blob = await response.blob()
				const file = new File([blob], 'image.png', { type: blob.type })

				const newUrl = await uploadFile(file)
				newContent = newContent.replace(fullMatch, fullMatch.replace(imageUrl, newUrl))
			} catch (error) {
				console.warn('Failed to duplicate image:', imageUrl, error)
				// Continue with other images even if one fails
			}
		}

		return newContent
	}

	// Delete images from the server that are no longer referenced in the content
	const deleteNoteImages = async (content: string): Promise<void> => {
		if (!uploadContext.value) return
		const images = extractNtImages(content)
		for (const filename of images) {
			try {
				await $fetch(`/api/notes/images/${encodeURIComponent(filename)}`, { method: 'DELETE' })
			} catch {
				// ignore — file may already be deleted
			}
		}
	}

	const uploadImage = async (file: File): Promise<string> => uploadFile(file)

	// Convertit les blob: URLs du contenu en images uploadées sur le serveur
	// Retourne le contenu avec les URLs blob: remplacées par /api/image?path=screenshots/tmp_nt_xxx
	const uploadBlobImages = async (content: string): Promise<string> => {
		if (!uploadContext.value || !content.includes('blob:')) return content

		const blobRegex = /!\[[^\]]*\]\((blob:[^)]+)\)/g
		const matches = [...content.matchAll(blobRegex)]
		if (matches.length === 0) return content

		let newContent = content
		for (const match of matches) {
			const fullMatch = match[0]
			const blobUrl = match[1]

			try {
				const response = await fetch(blobUrl)
				if (!response.ok) {
					console.warn('[uploadBlobImages] fetch failed for', blobUrl, response.status)
					continue
				}
				const blob = await response.blob()
				const file = new File([blob], 'image.png', { type: blob.type || 'image/png' })

				const finalUrl = await uploadFile(file)
				newContent = newContent.replace(fullMatch, fullMatch.replace(blobUrl, finalUrl))
			} catch (error) {
				console.warn('[uploadBlobImages] failed for', blobUrl, error)
			}
		}
		return newContent
	}

	return { uploadContext, cleanupOrphanImages, cleanupTmpImages, finalizeImages, duplicateImages, deleteNoteImages, uploadImage, extractNtImages, uploadBlobImages }
}
