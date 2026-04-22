/**
 * @import { Hono } from 'hono'
 * @import { SSEStreamingApi } from 'hono/streaming'
 */

import { streamSSE } from 'hono/streaming';

const ENDPOINT = '/__livereload';
const KEEPALIVE_MS = 25000;

const CLIENT_SCRIPT = `<script>(function(){try{var es=new EventSource(${JSON.stringify(ENDPOINT)});es.addEventListener('reload',function(){location.reload();});}catch(e){}})();</script>`;

/**
 * @returns {{ register: (app: Hono) => void, broadcast: (event: string) => void, close: () => void }}
 */
export function createLiveReload() {
    /** @type {Set<SSEStreamingApi>} */
    const clients = new Set();
    let closed = false;

    return { register, broadcast, close };

    /**
     * @param {Hono} app
     */
    function register(app) {
        app.get(ENDPOINT, c => {
            return streamSSE(c, async stream => {
                clients.add(stream);
                stream.onAbort(() => {
                    clients.delete(stream);
                });
                while (!closed && !stream.aborted && !stream.closed) {
                    await new Promise(res => setTimeout(res, KEEPALIVE_MS));
                    if (closed || stream.aborted || stream.closed) break;
                    try {
                        await stream.writeSSE({ event: 'ping', data: '' });
                    } catch {
                        break;
                    }
                }
                clients.delete(stream);
            });
        });

        // Inject the livereload client script into any text/html response.
        // This handles disk (serveStatic), in-memory, and customize()-added routes
        // uniformly because we buffer the body via res.text() before rewriting.
        //
        // NOTE: Hono's `c.res` setter merges headers from the previous response
        // into the newly-assigned one (see hono/src/context.ts). If we left the
        // original `content-length` on `res.headers`, it would overwrite the one
        // we set on the new Response and truncate the body (the original value
        // reflects the pre-injection size, e.g. from serveStatic's stat()).
        // So we delete it on the OLD response before assigning `c.res`.
        app.use('*', async (c, next) => {
            await next();
            const res = c.res;
            if (!res) return;
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.toLowerCase().includes('text/html')) return;
            let body;
            try {
                body = await res.text();
            } catch {
                return;
            }
            const injected = inject(body);
            res.headers.delete('content-length');
            c.res = new Response(injected, {
                status: res.status,
                statusText: res.statusText,
                headers: { 'content-length': String(Buffer.byteLength(injected)) },
            });
        });
    }

    /** @param {string} event */
    function broadcast(event) {
        for (const stream of clients) {
            try {
                stream.writeSSE({ event, data: '' });
            } catch {
                clients.delete(stream);
            }
        }
    }

    function close() {
        closed = true;
        for (const stream of clients) {
            try {
                stream.close();
            } catch {
                // ignore
            }
        }
        clients.clear();
    }
}

/**
 * @param {string} html
 * @returns {string}
 */
function inject(html) {
    if (html.includes(ENDPOINT)) {
        return html;
    }
    const match = html.match(/<\/body\s*>/i);
    if (match) {
        const idx = /** @type {number} */ (match.index);
        return html.slice(0, idx) + CLIENT_SCRIPT + html.slice(idx);
    }
    return html + CLIENT_SCRIPT;
}
