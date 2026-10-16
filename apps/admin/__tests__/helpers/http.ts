// Builders for route-handler calls: a Request plus Next's `{ params }` context.

export function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

export const params = <T extends Record<string, unknown>>(p: T) => ({ params: Promise.resolve(p) })

export async function json(res: Response) {
  return { status: res.status, body: await res.json() }
}
