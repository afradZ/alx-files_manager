import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { name, type, parentId = '0', isPublic = false, data } = req.body;
      
      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (parentId !== '0') {
        const parentFile = await dbClient.db.collection('files').findOne({ 
          _id: ObjectId(parentId) 
        });
        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

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

      if (type === 'image') {
        fileQueue.add({
          fileId: result.insertedId,
          userId,
        });
      }

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

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const fileId = req.params.id;
      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
      });

      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(file);
    } catch (err) {
      console.error('Get file error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const parentId = req.query.parentId || '0';
      const page = parseInt(req.query.page, 10) || 0;
      const limit = 20;
      const skip = page * limit;

      const files = await dbClient.db.collection('files')
        .find({ userId: ObjectId(userId), parentId })
        .skip(skip)
        .limit(limit)
        .toArray();

      return res.status(200).json(files);
    } catch (err) {
      console.error('List files error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const fileId = req.params.id;
      const result = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: ObjectId(fileId), userId: ObjectId(userId) },
        { $set: { isPublic: true } },
        { returnDocument: 'after' }
      );

      if (!result.value) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(result.value);
    } catch (err) {
      console.error('Publish error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const fileId = req.params.id;
      const result = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: ObjectId(fileId), userId: ObjectId(userId) },
        { $set: { isPublic: false } },
        { returnDocument: 'after' }
      );

      if (!result.value) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(result.value);
    } catch (err) {
      console.error('Unpublish error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];
    const { size } = req.query;

    try {
      let userId = null;
      if (token) {
        const key = `auth_${token}`;
        userId = await redisClient.get(key);
      }

      const file = await dbClient.db.collection('files').findOne({ 
        _id: ObjectId(fileId) 
      });
      if (!file) return res.status(404).json({ error: 'Not found' });

      if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      let filePath = file.localPath;
      if (size && ['100', '250', '500'].includes(size)) {
        filePath = `${file.localPath}_${size}`;
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const mimeType = mime.lookup(file.name) || 'text/plain';
      res.setHeader('Content-Type', mimeType);
      return res.status(200).sendFile(filePath);
    } catch (err) {
      console.error('Get file data error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default FilesController;




























































































































