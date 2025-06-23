const request = require('supertest');
const { expect } = require('chai');
const app = require('../../server');

describe('Files Endpoints', () => {
  let token;
  let fileId;

  before(async () => {
    // Get auth token
    const res = await request(app)
      .get('/connect')
      .set('Authorization', 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=');
    token = res.body.token;
  });

  it('POST /files - should upload file', async () => {
    const res = await request(app)
      .post('/files')
      .set('X-Token', token)
      .send({
        name: 'test.txt',
        type: 'file',
        data: 'SGVsbG8gV29ybGQK' // Hello World base64
      });
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    fileId = res.body.id;
  });

  it('GET /files/:id - should get file', async () => {
    const res = await request(app)
      .get(`/files/${fileId}`)
      .set('X-Token', token);
    expect(res.status).to.equal(200);
    expect(res.body.id).to.equal(fileId);
  });

});
