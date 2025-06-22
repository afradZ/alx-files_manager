import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import Queue from 'bull';

const fileQueue = new Queue('fileQueue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

class FilesController {
  static async postUpload(req, res) {
    // authenticate
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, type, parentId = '0', isPublic = false, data } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!['folder', 'file', 'image'].includes(type))
      return res.status(400).json({ error: 'Missing type' });
    if (type !== 'folder' && !data)
      return res.status(400).json({ error: 'Missing data' });

    // validate parent
    if (parentId !== '0') {
      const parent = await mongoose.connection.db
        .collection('files')
        .findOne({ _id: mongoose.Types.ObjectId(parentId), userId: mongoose.Types.ObjectId(userId) });
      if (!parent) return res.status(400).json({ error: 'Parent not found' });
      if (parent.type !== 'folder')
        return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const filesCol = mongoose.connection.db.collection('files');
    const fileDoc = {
      userId: mongoose.Types.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      const result = await filesCol.insertOne(fileDoc);
      const file = result.ops[0];
      return res.status(201).json({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    }

    // file or image
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const filename = uuidv4();
    const localPath = path.join(folderPath, filename);
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    fileDoc.localPath = localPath;
    const result = await filesCol.insertOne(fileDoc);
    const file = result.ops[0];

    if (type === 'image') {
      fileQueue.add({ fileId: file._id.toString(), userId });
    }

    return res.status(201).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await mongoose.connection.db
      .collection('files')
      .findOne({ _id: mongoose.Types.ObjectId(req.params.id), userId: mongoose.Types.ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page) || 0;
    const filesCol = mongoose.connection.db.collection('files');

    const docs = await filesCol
      .find({ userId: mongoose.Types.ObjectId(userId), parentId })
      .skip(page * 20)
      .limit(20)
      .toArray();

    const result = docs.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));
    return res.status(200).json(result);
  }

  static async putPublish(req, res) {
    return FilesController._togglePublic(req, res, true);
  }

  static async putUnpublish(req, res) {
    return FilesController._togglePublic(req, res, false);
  }

  static async _togglePublic(req, res, publish) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const filesCol = mongoose.connection.db.collection('files');
    const result = await filesCol.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(req.params.id), userId: mongoose.Types.ObjectId(userId) },
      { $set: { isPublic: publish } },
      { returnOriginal: false }
    );

    if (!result.value) return res.status(404).json({ error: 'Not found' });
    const file = result.value;
    return res.status(200).json({
      id: file.__id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const size = req.query.size;
    const file = await mongoose.connection.db
      .collection('files')
      .findOne({ _id: mongoose.Types.ObjectId(id) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    // authorization check
    if (!file.isPublic) {
      const token = req.headers['x-token'];
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== file.userId.toString())
        return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder')
      return res.status(400).json({ error: "A folder doesn't have content" });

    let filePath = file.localPath;
    if (size) {
      if (![100, 250, 500].includes(parseInt(size)))
        return res.status(400).json({ error: 'Invalid size' });
      filePath = `${filePath}_${size}`;
    }

    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'Not found' });

    const content = fs.readFileSync(filePath);
    const mimeType = mime.lookup(file.name) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    return res.send(content);
  }
}

export default FilesController;
