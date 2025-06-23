const request = require('supertest');
const { expect } = require('chai');
const app = require('../../server');
const dbClient = require('../../utils/db');
const redisClient = require('../../utils/redis');

describe('User Endpoints', () => {
  let token;
  const testUser = {
    email: 'test@example.com',
    password: 'password123'
  };

  after(async () => {
    // Cleanup test data
    await dbClient.db.collection('users').deleteMany({ email: testUser.email });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/users')
        .send(testUser);
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id');
      expect(res.body.email).to.equal(testUser.email);
      expect(res.body).to.not.have.property('password');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/users')
        .send({ password: 'password123' });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing email');
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'test@example.com' });
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing password');
    });

    it('should return 400 if email already exists', async () => {
      await request(app).post('/users').send(testUser);
      const res = await request(app)
        .post('/users')
        .send(testUser);
      
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Already exist');
    });
  });

  describe('GET /users/me', () => {
    before(async () => {
      // Create a user and get token
      await request(app).post('/users').send(testUser);
      const authRes = await request(app)
        .get('/connect')
        .set('Authorization', `Basic ${Buffer.from(`${testUser.email}:${testUser.password}`).toString('base64')}`);
      token = authRes.body.token;
    });

    it('should return user data with valid token', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('X-Token', token);
      
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('id');
      expect(res.body.email).to.equal(testUser.email);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('X-Token', 'invalid-token');
      
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Unauthorized');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/users/me');
      
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Unauthorized');
    });
  });
});
