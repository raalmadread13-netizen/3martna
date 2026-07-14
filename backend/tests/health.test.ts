import request from 'supertest';
import { createApp } from '@presentation/http/app';

const app = createApp();

describe('GET /health', () => {
  it('returns { status: "ok" }', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /health/details', () => {
  it('reports uptime and database configuration state', async () => {
    const response = await request(app).get('/health/details');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('not_configured');
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });
});

describe('unknown routes', () => {
  it('return the standard 404 error envelope', async () => {
    const response = await request(app).get('/api/v1/nope');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, code: 'ROUTE_NOT_FOUND' });
  });
});
