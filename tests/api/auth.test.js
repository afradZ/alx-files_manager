const request = require('supertest');
const { expect } = require('chai');
const app = require('../../server');

describe('Auth Endpoints', () => {
  let token;

  it('POST /connect - should authenticate user', async () => {
    const res = await request(app)
      .get('/connect')
      .set('Authorization', 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token');
    token = res.body.token;
  });

  it('GET /disconnect - should sign out user', async () => {
    const res = await request(app)
      .get('/disconnect')
      .set('X-Token', token);
    expect(res.status).to.equal(204);
  });
});
