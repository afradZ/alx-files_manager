iimport mongoose from 'mongoose';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}/${database}`;

    mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    this.db = mongoose.connection;
    this.db.on('error', (err) => console.error('MongoDB error:', err));
  }

  isAlive() {
    return this.db.readyState === 1;
  }

  async nbUsers() {
    return mongoose.connection.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return mongoose.connection.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
