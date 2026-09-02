export function toImageDataUrl(
  value: string | null | undefined,
  mimeType = 'image/webp',
): string | undefined {
  if (!value) {
    return undefined
  }

  return `data:${mimeType};base64,${value}`
}
