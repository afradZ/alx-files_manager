import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hashedPassword = sha1(password);
      const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const token = uuidv4();
      const key = `auth_${token}`;
      await redisClient.set(key, user._id.toString(), 86400); // 24 hours

      return res.status(200).json({ token });
    } catch (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      await redisClient.del(key);
      return res.status(204).send();
    } catch (err) {
      console.error('Disconnection error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default AuthController;
