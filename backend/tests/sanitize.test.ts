import { NextFunction, Request, Response } from 'express';
import { sanitizeBody } from '../src/middleware/sanitize';

const run = (body: unknown): unknown => {
  const req = { body } as Request;
  sanitizeBody(req, {} as Response, jest.fn() as unknown as NextFunction);
  return req.body;
};

describe('sanitizeBody (XSS defence-in-depth)', () => {
  it('strips script tags from strings', () => {
    expect(run({ note: 'hello <script>alert(1)</script> world' })).toEqual({
      note: 'hello  world',
    });
  });

  it('strips inline event handlers and javascript: urls', () => {
    const result = run({ html: '<img src=x onerror="steal()">', link: 'javascript:evil()' }) as {
      html: string;
      link: string;
    };
    expect(result.html).not.toContain('onerror=');
    expect(result.link).not.toContain('javascript:');
  });

  it('sanitises nested objects and arrays', () => {
    const result = run({
      items: ['<script>x</script>ok', { deep: '<script>y</script>fine' }],
    }) as { items: [string, { deep: string }] };
    expect(result.items[0]).toBe('ok');
    expect(result.items[1].deep).toBe('fine');
  });

  it('leaves normal Arabic/English content untouched', () => {
    expect(run({ text: 'مرحبا Hello 123', n: 5, ok: true })).toEqual({
      text: 'مرحبا Hello 123',
      n: 5,
      ok: true,
    });
  });
});
