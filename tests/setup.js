import { MongoMemoryServer } from 'mongodb-memory-server';
import redis from 'redis';
import util from 'util';
import mongoose from 'mongoose';

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.DB_HOST = mongod.getUri();
  // for redis, you can either run a real instance locally,
  // or use a mock like `redis-mock` here
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

