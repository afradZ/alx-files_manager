import Bull from 'bull';
import dbClient from './db';
import redisClient from './redis';

// Initialize queues
const fileQueue = new Bull('fileQueue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

const userQueue = new Bull('userQueue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

// Process file queue for thumbnails
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.db.collection('files').findOne({
    _id: dbClient.ObjectId(fileId),
    userId: dbClient.ObjectId(userId),
  });

  if (!file) throw new Error('File not found');
  if (file.type !== 'image') return;

  const sizes = [500, 250, 100];
  for (const size of sizes) {
    const thumbnail = await imageThumbnail(file.localPath, { width: size });
    const thumbnailPath = `${file.localPath}_${size}`;
    await fs.promises.writeFile(thumbnailPath, thumbnail);
  }
});

// Process user queue for welcome emails
userQueue.process(async (job) => {
  const { userId } = job.data;

  // Validate job data
  if (!userId) {
    throw new Error('Missing userId');
  }

  // Get user from database
  const user = await dbClient.db.collection('users').findOne({
    _id: dbClient.ObjectId(userId),
  });

  if (!user) {
    throw new Error('User not found');
  }

  // In production: Replace with actual email sending code
  console.log(`Welcome ${user.email}!`);
  /* 
  // Example with Mailgun:
  const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  });
  
  await mg.messages().send({
    from: 'Welcome <welcome@yourdomain.com>',
    to: user.email,
    subject: 'Welcome to our platform!',
    text: `Hello ${user.email},\n\nThank you for joining our service!`
  });
  */
});

// Handle queue events
userQueue.on('completed', (job) => {
  console.log(`Welcome email job ${job.id} completed`);
});

userQueue.on('failed', (job, err) => {
  console.error(`Welcome email job ${job.id} failed:`, err);
});

export { fileQueue, userQueue };
