// controllers/AuthController.js
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import sha1 from 'sha1';

class AuthController {
  static async getConnect(req, res) {
    const auth = req.get('Authorization') || '';
    const [scheme, payload] = auth.split(' ');
    if (scheme !== 'Basic' || !payload) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [email, password] = Buffer.from(payload, 'base64')
      .toString()
      .split(':');
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.getUserByEmailAndPassword(
      email,
      sha1(password)
    );
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 3600);
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await redisClient.del(key);
    return res.status(204).send();
  }
}

export default AuthController;

