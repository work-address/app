#!/usr/bin/env node
/*
 * A stand-in model API for the live check when no model account is at hand.
 * The agent itself runs for real (its own release, its own hooks or plugin);
 * only the model behind it answers from here. Loopback only.
 *
 * It speaks the three wire formats the recorded agents use:
 * - Anthropic Messages, POST /v1/messages (Claude Code; Kimi Code's Anthropic
 *   provider), streamed or not;
 * - OpenAI Chat Completions, POST /v1/chat/completions (Hermes Agent,
 *   OpenClaw, Kimi Code's OpenAI provider), streamed or not;
 * - OpenAI Responses, POST /v1/responses (Codex), streamed.
 *
 * What the prompt says decides the answer:
 * - "WA_FAIL" anywhere in the request: a non-retryable 400 error;
 * - "WA_SLOW": the answer streams for about a minute, so it can be interrupted;
 * - "WA_DROP": the connection is cut before any answer, as a network failure;
 * - anything else: a one-word answer.
 * Every answer starts after about a second, as a real model's does.
 *
 *   node mock-model.mjs [port]     prints the base URL, serves until killed
 */
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** The answer's words; a slow one is long and paced by `slow`. */
function words(body) {
  return body.includes('WA_SLOW')
    ? Array.from({ length: 120 }, (_, i) => `word${i + 1} `)
    : ['ok']
}

function sse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  return (event, data) =>
    res.write(
      `${event ? `event: ${event}\n` : ''}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
    )
}

async function anthropic(req, res, json, raw) {
  const model = json.model ?? 'mock'
  const id = `msg_${randomUUID().replaceAll('-', '')}`
  const parts = words(raw)
  const pace = raw.includes('WA_SLOW') ? 500 : 0
  if (!json.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(
      JSON.stringify({
        id,
        type: 'message',
        role: 'assistant',
        model,
        content: [{ type: 'text', text: parts.join('') }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: parts.length },
      }),
    )
  }
  const send = sse(res)
  send('message_start', {
    type: 'message_start',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1 },
    },
  })
  send('content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  })
  for (const text of parts) {
    if (res.destroyed) return
    send('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    })
    if (pace) await sleep(pace)
  }
  send('content_block_stop', { type: 'content_block_stop', index: 0 })
  send('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: parts.length },
  })
  send('message_stop', { type: 'message_stop' })
  res.end()
}

async function chat(req, res, json, raw) {
  const model = json.model ?? 'mock'
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const parts = words(raw)
  const pace = raw.includes('WA_SLOW') ? 500 : 0
  const usage = {
    prompt_tokens: 10,
    completion_tokens: parts.length,
    total_tokens: 10 + parts.length,
  }
  if (!json.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(
      JSON.stringify({
        id,
        object: 'chat.completion',
        created,
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: parts.join('') },
            finish_reason: 'stop',
          },
        ],
        usage,
      }),
    )
  }
  const send = sse(res)
  const chunk = (delta, finish = null, extra = {}) => ({
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...extra,
  })
  send(null, chunk({ role: 'assistant', content: '' }))
  for (const text of parts) {
    if (res.destroyed) return
    send(null, chunk({ content: text }))
    if (pace) await sleep(pace)
  }
  send(null, chunk({}, 'stop', { usage }))
  send(null, '[DONE]')
  res.end()
}

async function responses(req, res, json, raw) {
  const model = json.model ?? 'mock'
  const id = `resp_${randomUUID().replaceAll('-', '')}`
  const item = `msg_${randomUUID().replaceAll('-', '')}`
  const parts = words(raw)
  const pace = raw.includes('WA_SLOW') ? 500 : 0
  const text = parts.join('')
  const message = (content) => ({
    id: item,
    type: 'message',
    status: content ? 'completed' : 'in_progress',
    role: 'assistant',
    content: content
      ? [{ type: 'output_text', text: content, annotations: [] }]
      : [],
  })
  const response = (status, output) => ({
    id,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status,
    model,
    output,
    usage: {
      input_tokens: 10,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: parts.length,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 10 + parts.length,
    },
  })
  const send = sse(res)
  let sequence = 0
  const emit = (type, data) =>
    send(type, { type, sequence_number: sequence++, ...data })
  emit('response.created', { response: response('in_progress', []) })
  emit('response.in_progress', { response: response('in_progress', []) })
  emit('response.output_item.added', { output_index: 0, item: message('') })
  emit('response.content_part.added', {
    item_id: item,
    output_index: 0,
    content_index: 0,
    part: { type: 'output_text', text: '', annotations: [] },
  })
  for (const delta of parts) {
    if (res.destroyed) return
    emit('response.output_text.delta', {
      item_id: item,
      output_index: 0,
      content_index: 0,
      delta,
    })
    if (pace) await sleep(pace)
  }
  emit('response.output_text.done', {
    item_id: item,
    output_index: 0,
    content_index: 0,
    text,
  })
  emit('response.content_part.done', {
    item_id: item,
    output_index: 0,
    content_index: 0,
    part: { type: 'output_text', text, annotations: [] },
  })
  emit('response.output_item.done', { output_index: 0, item: message(text) })
  emit('response.completed', {
    response: response('completed', [message(text)]),
  })
  res.end()
}

const MODELS = ['mock', 'claude-mock', 'gpt-mock']
const FIRST_TOKEN_MS = 1000

/** `log` sees each request's method, path and status. */
export function createMockModel({ log } = {}) {
  return createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    let json = {}
    try {
      json = raw ? JSON.parse(raw) : {}
    } catch {}
    const path = new URL(req.url, 'http://x').pathname.replace(/^\/api/, '')
    const reply = (status, body) => {
      log?.(`${req.method} ${path} ${status}`)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'GET' && path.endsWith('/models'))
      return reply(200, {
        object: 'list',
        data: MODELS.map((id) => ({
          id,
          object: 'model',
          type: 'model',
          display_name: id,
          created: 0,
          created_at: '2026-01-01T00:00:00Z',
          owned_by: 'mock',
        })),
      })
    if (req.method !== 'POST') return reply(404, { error: 'not found' })
    if (path.endsWith('/messages/count_tokens'))
      return reply(200, { input_tokens: 10 })
    if (raw.includes('WA_DROP')) {
      log?.(`${req.method} ${path} dropped`)
      return req.socket.destroy()
    }
    if (raw.includes('WA_FAIL'))
      return reply(
        400,
        path.endsWith('/messages')
          ? {
              type: 'error',
              error: {
                type: 'invalid_request_error',
                message: 'WA_FAIL: the live check asked for a failure',
              },
            }
          : {
              error: {
                message: 'WA_FAIL: the live check asked for a failure',
                type: 'invalid_request_error',
                code: 'invalid_request',
              },
            },
      )
    log?.(`${req.method} ${path} 200${raw.includes('WA_SLOW') ? ' slow' : ''}`)
    await sleep(FIRST_TOKEN_MS)
    if (path.endsWith('/messages')) return anthropic(req, res, json, raw)
    if (path.endsWith('/chat/completions')) return chat(req, res, json, raw)
    if (path.endsWith('/responses')) return responses(req, res, json, raw)
    return reply(404, { error: 'not found' })
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const server = createMockModel({ log: (line) => console.error(line) })
  server.listen(Number(process.argv[2] ?? 0), '127.0.0.1', () =>
    console.log(`http://127.0.0.1:${server.address().port}`),
  )
}
