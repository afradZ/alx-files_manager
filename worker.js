import Bull from 'bull';
import { promises as fs } from 'fs';
import path from 'path';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

// Initialize the queue
const fileQueue = new Bull('fileQueue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  
  // Validate job data
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  // Verify file exists in database
  const file = await dbClient.db.collection('files').findOne({
    _id: dbClient.ObjectId(fileId),
    userId: dbClient.ObjectId(userId)
  });

  if (!file) {
    throw new Error('File not found');
  }

  // Only process image files
  if (file.type !== 'image') {
    return;
  }

  // Generate thumbnails
  const sizes = [100, 250, 500];
  const thumbnailPromises = sizes.map(async (size) => {
    try {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const thumbnailPath = `${file.localPath}_${size}`;
      await fs.writeFile(thumbnailPath, thumbnail);
    } catch (err) {
      console.error(`Error generating ${size}px thumbnail:`, err);
    }
  });

  await Promise.all(thumbnailPromises);
});

console.log('Worker started and listening for file processing jobs...');
