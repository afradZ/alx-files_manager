import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      // Verify user
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Validate request body
      const { name, type, parentId = '0', isPublic = false, data } = req.body;
      
      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      // Validate parent if exists
      if (parentId !== '0') {
        const parentFile = await dbClient.db.collection('files').findOne({ 
          _id: ObjectId(parentId) 
        });
        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      // Handle folder creation
      if (type === 'folder') {
        const result = await dbClient.db.collection('files').insertOne({
          userId: ObjectId(userId),
          name,
          type,
          isPublic,
          parentId: parentId === '0' ? '0' : ObjectId(parentId),
        });
        return res.status(201).json({
          id: result.insertedId,
          userId,
          name,
          type,
          isPublic,
          parentId,
        });
      }

      // Handle file upload
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const fileId = uuidv4();
      const localPath = path.join(folderPath, fileId);
      const fileContent = Buffer.from(data, 'base64');

      fs.writeFileSync(localPath, fileContent);

      const result = await dbClient.db.collection('files').insertOne({
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId === '0' ? '0' : ObjectId(parentId),
        localPath,
      });

      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });
    } catch (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default FilesController;































































































































































