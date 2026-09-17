export const useAppToast = () => {
    const toast = useToast()

    const DURATION = 2000

    const success = (title: string, description?: string, duration: number = DURATION) => {
        toast.add({
            title,
            description,
            icon: 'i-heroicons-check-circle',
            color: 'success',
            duration,
        })
    }

    const error = (title: string, description?: string, duration: number = DURATION) => {
        toast.add({
            title,
            description,
            icon: 'i-heroicons-exclamation-circle',
            color: 'error',
            duration,
        })
    }

    const info = (title: string, description?: string, duration: number = DURATION) => {
        toast.add({
            title,
            description,
            icon: 'i-heroicons-information-circle',
            color: 'primary',
            duration,
        })
    }

    const warning = (title: string, description?: string, duration: number = DURATION) => {
        toast.add({
            title,
            description,
            icon: 'i-heroicons-exclamation-triangle',
            color: 'warning',
            duration,
        })
    }

    return { success, error, info, warning }
}
