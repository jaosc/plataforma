import * as compression from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import * as path from 'path';
import * as mongoose from 'mongoose';
import * as helmet from 'helmet';

// import logger from 'morgan';
// Import API endpoint routes
import authRoutes from './routes/auth';
import emailRoutes from './routes/email';
import userRoutes from './routes/user';
import contractorRoutes from './routes/contractor';
import contractRoutes from './routes/contract';
import invoiceRoutes from './routes/invoice';

class NortanAPI {
  public app;

  constructor() {
    this.app = express();

    // Connect to the database before starting the application server.
    const options = {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useFindAndModify: false,
      autoIndex: false,
      poolSize: 100,
      serverSelectionTimeoutMS: 29000,
      connectTimeoutMS: 29000,
    } as mongoose.ConnectionOptions;
    mongoose
      .connect(process.env.MONGODB_URI, options)
      .then(() => {
        console.log('Database connection ready!');
      })
      .catch((error) => {
        console.log('Database Connection failed! ', error);
        process.exit(1);
      });
    mongoose.set('useCreateIndex', true);

    // app.use(logger('dev'));
    this.app.use(compression());
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
      })
    );
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use('/', express.static(path.join(__dirname, 'angular')));

    // API endpoint routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/sendmail', emailRoutes);
    this.app.use('/api/user', userRoutes);
    this.app.use('/api/contractor', contractorRoutes);
    this.app.use('/api/contract', contractRoutes);
    this.app.use('/api/invoice', invoiceRoutes);

    // For all GET requests, send back index.html
    // so that PathLocationStrategy can be used
    this.app.get('/*', function (req, res) {
      res.sendFile(path.join(__dirname, '/angular/index.html'));
    });
  }
}

export default { express: new NortanAPI().app, db: mongoose.connection };
