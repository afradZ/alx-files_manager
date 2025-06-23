import request from 'supertest';
import server from '../../server';  // export your Express app

describe('GET /status', () => {
  it('returns redis and db status', async () => {
    const res = await request(server).get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('redis');
    expect(res.body).toHaveProperty('db');
  });
});

