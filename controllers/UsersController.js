import sha1 from 'sha1';
import mongoose from 'mongoose';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    const existing = await mongoose.connection.db
      .collection('users')
      .findOne({ email });
    if (existing) return res.status(400).json({ error: 'Already exist' });

    const hashed = sha1(password);
    const result = await mongoose.connection.db
      .collection('users')
      .insertOne({ email, password: hashed });

    const user = result.ops[0];
    return res.status(201).json({ id: user._id, email: user.email });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await mongoose.connection.db
      .collection('users')
      .findOne({ _id: mongoose.Types.ObjectId(userId) });

    return res.status(200).json({ id: userId, email: user.email });
  }
}

export default UsersController;
