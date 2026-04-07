export const normalizeDataKeyToReadableString = (key: string = ''): string => {
  const result: string[] = []

  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < key.length; i++) {
    const char = key[i]

    if (i === 0) {
      result.push(char.toUpperCase())
    } else if (char === char.toUpperCase()) {
      result.push(' ', char)
    } else if (char === char.toLowerCase()) {
      result.push(char)
    }
  }

  return result.join('')
}
