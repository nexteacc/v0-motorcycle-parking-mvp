import { useState, useCallback } from "react"

interface ErrorHandlerReturn {
  error: string | null
  setError: (error: string | null) => void
  handleError: (err: unknown, defaultMessage?: string) => void
  clearError: () => void
}

/**
 * 统一的错误处理 Hook
 * @param defaultMessage 默认错误消息
 * @returns 错误状态和处理方法
 */
export function useErrorHandler(defaultMessage: string = "Failed"): ErrorHandlerReturn {
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback(
    (err: unknown, customMessage?: string) => {
      let errorMessage = customMessage || defaultMessage

      if (err instanceof Error) {
        errorMessage = err.message || errorMessage
      } else if (typeof err === "string") {
        errorMessage = err
      }

      setError(errorMessage)
      console.error("Error:", err)
    },
    [defaultMessage]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    error,
    setError,
    handleError,
    clearError,
  }
}
