import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { BlobServiceClient } from '@azure/storage-blob';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURACIÓN INICIAL ---
dotenv.config();
const { 
  MONGODB_URI, MONGODB_DB, 
  PORT = 4000, 
  API_KEY, 
  AZURE_STORAGE_CONNECTION_STRING, 
  AZURE_BLOB_CONTAINER, 
  AZURE_STORAGE_ACCOUNT, 
  AZURE_SAS_TOKEN 
} = process.env;

// Cliente Azure
const blobService = new BlobServiceClient(
  `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net?${AZURE_SAS_TOKEN}`
);
const container = blobService.getContainerClient(AZURE_BLOB_CONTAINER);

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      // Permitimos scripts normales dentro del HTML
      "script-src": ["'self'", "'unsafe-inline'"],
      // Permitimos botones con onclick (ESTA ES LA LÍNEA NUEVA QUE NECESITAS):
      "script-src-attr": ["'unsafe-inline'"], 
      "img-src": ["'self'", "https:", "data:", `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`],
      "media-src": ["'self'", "https:", "data:", `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`], 
      "connect-src": ["'self'", `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`] 
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 2048 * 2048, files: 10}, 
  fileFilter: (req, file, cb) => {
    const isImage = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    cb(isImage ? null : new Error('Solo se permiten imágenes (png/jpg/webp)'), isImage);
  }
});

// Helpers
const randomName = (ext='bin') => crypto.randomBytes(8).toString('hex') + '.' + ext;
const extFromMime = m => (m?.split('/')[1] || 'bin').replace('jpeg','jpg');
function blobUrlWithSas(blobName) {
  return `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_BLOB_CONTAINER}/${blobName}?${AZURE_SAS_TOKEN}`;
}

// Middleware de Seguridad
const adminGuard = (req, res, next) => {
  const key = req.header('x-api-key') || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Acceso denegado: API Key incorrecta' });
  next();
};

// Conexión BBDD
let db;
MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db(MONGODB_DB);
  console.log('✅ Conectado a MongoDB');
  app.listen(PORT, () => console.log(`🚀 Servidor listo en http://localhost:${PORT}`));
}).catch(err => console.error(err));


// --- RUTAS (ENDPOINTS) ---

// 1. GET PÚBLICO (Comunidad aprobada)
app.get('/api/community', async (req, res) => {
  try {
    const posts = await db.collection('community')
      .find({ status: 'approved' }) 
      .sort({ createdAt: -1 })
      .toArray();
    const postsWithUrls = posts.map(post => ({
      ...post,
      photos: post.photos ? post.photos.map(p => ({ ...p, url: blobUrlWithSas(p.blobName) })) : []
    }));
    res.json(postsWithUrls);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar comunidad' });
  }
});

// 2. POST PÚBLICO (Subir sugerencia)
app.post('/api/community', upload.array('photos', 3), async (req, res) => {
  try {
    const { title, author, description, category, songUrl } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Faltan datos' });

    const photos = [];
    if (req.files) {
      for (const f of req.files) {
        const ext = extFromMime(f.mimetype);
        const blobName = `community/${Date.now()}_${randomName(ext)}`;
        const blockBlobClient = container.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(f.buffer, { blobHTTPHeaders: { blobContentType: f.mimetype } });
        photos.push({ blobName, mime: f.mimetype });
      }
    }

    const newPost = {
      title: title.trim(),
      author: author ? author.trim() : 'Anónimo',
      description: description.trim(),
      category: category || 'general',
      songUrl: songUrl ? songUrl.trim() : null,
      photos,
      status: 'pending', 
      createdAt: new Date()
    };

    const result = await db.collection('community').insertOne(newPost);
    res.status(201).json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al guardar' });
  }
});

// 3. PUT PROTEGIDO (Aprobar)
app.put('/api/community/:id/approve', adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('community').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved' } }
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// 4. DELETE PROTEGIDO (Borrar)
app.delete('/api/community/:id', adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('community').deleteOne({ _id: new ObjectId(id) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// 5. GET PROTEGIDO (Ver pendientes)
app.get('/api/admin/pending', adminGuard, async (req, res) => {
  try {
    const pending = await db.collection('community').find({ status: 'pending' }).toArray();
    const pendingWithUrls = pending.map(post => ({
      ...post,
      photos: post.photos ? post.photos.map(p => ({ ...p, url: blobUrlWithSas(p.blobName) })) : []
    }));
    res.json(pendingWithUrls);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});