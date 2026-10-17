/** Bound bytes before decoding. Timeout prevents an unfinished hook pipe hanging the host. */
export async function readInput(
  limit = 1024 * 1024,
  timeoutMs = 1000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const timer = setTimeout(
      () => finish(new Error('INPUT_TIMEOUT')),
      timeoutMs,
    )
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) finish(new Error('INPUT_TOO_LARGE'))
      else chunks.push(chunk)
    }
    const onEnd = () => finish()
    const onError = () => finish(new Error('INPUT_ERROR'))
    function finish(error?: Error) {
      clearTimeout(timer)
      process.stdin.off('data', onData).off('end', onEnd).off('error', onError)
      process.stdin.pause()
      if (error) reject(error)
      else resolve(Buffer.concat(chunks).toString('utf8'))
    }
    process.stdin.on('data', onData).once('end', onEnd).once('error', onError)
  })
}
