/**
 * Saving a file the app made. On iPhone this opens the share sheet (Save to Files, AirDrop,
 * Mail …); elsewhere it downloads. Must be called straight from a tap.
 * Resolves true when saved or shared, false when the person cancelled.
 */
export async function saveFile(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return true
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false
      throw new Error('Couldn’t open the share sheet. Try again.')
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
