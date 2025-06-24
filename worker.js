import Bull from 'bull';
import { promises as fs } from 'fs';
import path from 'path';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';
import redisClient from './utils/redis';

// Initialize queues
const fileQueue = new Bull('fileQueue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  }
});

const userQueue = new Bull('userQueue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  }
});

// Process file queue
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.db.collection('files').findOne({
    _id: dbClient.ObjectId(fileId),
    userId: dbClient.ObjectId(userId)
  });

  if (!file) throw new Error('File not found');
  if (file.type !== 'image') return;

  const sizes = [500, 250, 100];
  for (const size of sizes) {
    const thumbnail = await imageThumbnail(file.localPath, { width: size });
    const thumbnailPath = `${file.localPath}_${size}`;
    await fs.writeFile(thumbnailPath, thumbnail);
  }
});

// Process user queue
userQueue.process(async (job) => {
  const { userId } = job.data;

  if (!userId) throw new Error('Missing userId');

  const user = await dbClient.db.collection('users').findOne({
    _id: dbClient.ObjectId(userId)
  });

  if (!user) throw new Error('User not found');
  
  console.log(`Welcome ${user.email}!`);
});

export { fileQueue, userQueue };
