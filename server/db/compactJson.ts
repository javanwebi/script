import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';

const brAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Compress only bounded JSON responses; never touch event streams, media or WebSockets. */
export async function sendCatalogJson(req: Request, res: Response, body: unknown): Promise<Response> {
  const data = Buffer.from(JSON.stringify(body));
  const accepted = req.get('accept-encoding') || '';
  res.vary('Accept-Encoding');
  if (data.length < 2048 || (!accepted.includes('br') && !accepted.includes('gzip'))) {
    return res.type('application/json').send(data);
  }
  try {
    const useBr = accepted.includes('br');
    const compressed = useBr
      ? await brAsync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
      : await gzipAsync(data, { level: 5 });
    if (res.headersSent) return res;
    res.setHeader('Content-Encoding', useBr ? 'br' : 'gzip');
    res.type('application/json');
    return res.send(compressed);
  } catch {
    return res.type('application/json').send(data);
  }
}
