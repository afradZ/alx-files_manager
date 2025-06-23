import { ObjectId } from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import { userQueue } from '../worker';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      // Check if email already exists
      const existingUser = await dbClient.db.collection('users').findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash password
      const hashedPassword = sha1(password);

      // Create new user
      const result = await dbClient.db.collection('users').insertOne({
        email,
        password: hashedPassword,
      });

      // Add welcome email job to queue
      userQueue.add({
        userId: result.insertedId.toString(),
      }, {
        attempts: 3, // Retry 3 times if fails
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s delays between retries
        },
      });

      // Return new user (without password)
      return res.status(201).json({
        id: result.insertedId,
        email,
      });
    } catch (err) {
      console.error('Error creating user:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await dbClient.db.collection('users').findOne({ 
        _id: ObjectId(userId) 
      });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(200).json({
        id: user._id,
        email: user.email,
      });
    } catch (err) {
      console.error('Error in getMe:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default UsersController;
