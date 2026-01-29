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

// Configuración Multer para posts de comunidad (imágenes + audio opcional)
const uploadCommunity = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 10 }, // 150MB max
  fileFilter: (req, file, cb) => {
    const isImage = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    const isAudio = /audio\/(mpeg|mp3|wav|ogg|x-wav|x-m4a)/i.test(file.mimetype);
    if (isImage || isAudio) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (png/jpg/webp) y audio (MP3/WAV/OGG)'), false);
    }
  }
});

// Configuración Multer para sonidos (audio + imagen)
const uploadSound = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 2 }, // 150MB max
  fileFilter: (req, file, cb) => {
    const isAudio = /audio\/(mpeg|mp3|wav|ogg|x-wav|x-m4a)/i.test(file.mimetype);
    const isImage = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    if (isAudio || isImage) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio (MP3/WAV/OGG) e imágenes (PNG/JPG/WEBP)'), false);
    }
  }
});

// Helpers
const randomName = (ext = 'bin') => crypto.randomBytes(8).toString('hex') + '.' + ext;
const extFromMime = m => (m?.split('/')[1] || 'bin').replace('jpeg', 'jpg');
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
      photos: post.photos ? post.photos.map(p => ({ ...p, url: blobUrlWithSas(p.blobName) })) : [],
      audioFile: post.audioFile ? { ...post.audioFile, url: blobUrlWithSas(post.audioFile.blobName) } : null
    }));
    res.json(postsWithUrls);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar comunidad' });
  }
});

// 2. POST PÚBLICO (Subir sugerencia)
app.post('/api/community', uploadCommunity.fields([
  { name: 'photos', maxCount: 3 },
  { name: 'audioFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, author, description, category, songUrl } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Faltan datos' });

    const photos = [];
    if (req.files && req.files.photos) {
      for (const f of req.files.photos) {
        const ext = extFromMime(f.mimetype);
        const blobName = `community/${Date.now()}_${randomName(ext)}`;
        const blockBlobClient = container.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(f.buffer, { blobHTTPHeaders: { blobContentType: f.mimetype } });
        photos.push({ blobName, mime: f.mimetype });
      }
    }

    // Procesar archivo de audio si existe
    let audioFile = null;
    if (req.files && req.files.audioFile && req.files.audioFile.length > 0) {
      const audio = req.files.audioFile[0];
      const audioExt = extFromMime(audio.mimetype);
      const audioBlobName = `community/audio/${Date.now()}_${randomName(audioExt)}`;
      const audioBlockBlobClient = container.getBlockBlobClient(audioBlobName);
      await audioBlockBlobClient.uploadData(audio.buffer, {
        blobHTTPHeaders: { blobContentType: audio.mimetype }
      });
      audioFile = { blobName: audioBlobName, mime: audio.mimetype };
    }

    const newPost = {
      title: title.trim(),
      author: author ? author.trim() : 'Anónimo',
      description: description.trim(),
      category: category || 'general',
      songUrl: songUrl ? songUrl.trim() : null,
      photos,
      audioFile,
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
      photos: post.photos ? post.photos.map(p => ({ ...p, url: blobUrlWithSas(p.blobName) })) : [],
      audioFile: post.audioFile ? { ...post.audioFile, url: blobUrlWithSas(post.audioFile.blobName) } : null
    }));
    res.json(pendingWithUrls);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});


// --- RUTAS PARA SONIDOS ---

// 1. POST PÚBLICO (Subir sonido)
app.post('/api/sounds', uploadSound.fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, category, tags } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Título y descripción son obligatorios' });
    }

    if (!req.files || !req.files.audioFile || req.files.audioFile.length === 0) {
      return res.status(400).json({ error: 'Debes subir un archivo de audio' });
    }

    // Procesar archivo de audio
    const audioFile = req.files.audioFile[0];
    const audioExt = extFromMime(audioFile.mimetype);
    const audioBlobName = `sounds/audio/${Date.now()}_${randomName(audioExt)}`;
    const audioBlockBlobClient = container.getBlockBlobClient(audioBlobName);
    await audioBlockBlobClient.uploadData(audioFile.buffer, {
      blobHTTPHeaders: { blobContentType: audioFile.mimetype }
    });

    // Procesar imagen de portada (si existe)
    let coverImage = null;
    if (req.files.coverImage && req.files.coverImage.length > 0) {
      const imgFile = req.files.coverImage[0];
      const imgExt = extFromMime(imgFile.mimetype);
      const imgBlobName = `sounds/images/${Date.now()}_${randomName(imgExt)}`;
      const imgBlockBlobClient = container.getBlockBlobClient(imgBlobName);
      await imgBlockBlobClient.uploadData(imgFile.buffer, {
        blobHTTPHeaders: { blobContentType: imgFile.mimetype }
      });
      coverImage = { blobName: imgBlobName, mime: imgFile.mimetype };
    }

    // Crear documento de sonido
    const newSound = {
      title: title.trim(),
      description: description.trim(),
      category: category || 'general',
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      audioFile: { blobName: audioBlobName, mime: audioFile.mimetype },
      coverImage,
      status: 'pending',
      contributor: 'Comunidad',
      createdAt: new Date()
    };

    const result = await db.collection('sounds').insertOne(newSound);
    res.status(201).json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error('Error subiendo sonido:', err);
    res.status(400).json({ error: 'Error al guardar el sonido' });
  }
});

// 2. GET PÚBLICO (Obtener sonidos aprobados con filtros)
app.get('/api/sounds', async (req, res) => {
  try {
    const { search, category } = req.query;

    // Construir filtro
    const filter = { status: 'approved' };

    if (category && category !== '') {
      filter.category = category;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ];
    }

    const sounds = await db.collection('sounds')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    // Añadir URLs con SAS token
    const soundsWithUrls = sounds.map(sound => ({
      ...sound,
      audioFile: sound.audioFile ? {
        ...sound.audioFile,
        url: blobUrlWithSas(sound.audioFile.blobName)
      } : null,
      coverImage: sound.coverImage ? {
        ...sound.coverImage,
        url: blobUrlWithSas(sound.coverImage.blobName)
      } : null
    }));

    res.json(soundsWithUrls);
  } catch (err) {
    console.error('Error cargando sonidos:', err);
    res.status(500).json({ error: 'Error al cargar sonidos' });
  }
});

// 3. GET PÚBLICO (Detalle de un sonido)
app.get('/api/sounds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sound = await db.collection('sounds').findOne({
      _id: new ObjectId(id),
      status: 'approved'
    });

    if (!sound) {
      return res.status(404).json({ error: 'Sonido no encontrado' });
    }

    // Añadir URLs con SAS token
    const soundWithUrls = {
      ...sound,
      audioFile: sound.audioFile ? {
        ...sound.audioFile,
        url: blobUrlWithSas(sound.audioFile.blobName)
      } : null,
      coverImage: sound.coverImage ? {
        ...sound.coverImage,
        url: blobUrlWithSas(sound.coverImage.blobName)
      } : null
    };

    res.json(soundWithUrls);
  } catch (err) {
    console.error('Error obteniendo sonido:', err);
    res.status(500).json({ error: 'Error al obtener el sonido' });
  }
});

// 4. PUT PROTEGIDO (Aprobar sonido)
app.put('/api/sounds/:id/approve', adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('sounds').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved' } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// 5. DELETE PROTEGIDO (Borrar sonido)
app.delete('/api/sounds/:id', adminGuard, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener el sonido para eliminar los archivos de Azure
    const sound = await db.collection('sounds').findOne({ _id: new ObjectId(id) });

    if (sound) {
      // Eliminar archivo de audio de Azure
      if (sound.audioFile && sound.audioFile.blobName) {
        try {
          const audioBlobClient = container.getBlockBlobClient(sound.audioFile.blobName);
          await audioBlobClient.delete();
        } catch (e) {
          console.warn('Error eliminando audio de Azure:', e);
        }
      }

      // Eliminar imagen de portada de Azure
      if (sound.coverImage && sound.coverImage.blobName) {
        try {
          const imgBlobClient = container.getBlockBlobClient(sound.coverImage.blobName);
          await imgBlobClient.delete();
        } catch (e) {
          console.warn('Error eliminando imagen de Azure:', e);
        }
      }
    }

    // Eliminar de MongoDB
    await db.collection('sounds').deleteOne({ _id: new ObjectId(id) });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando sonido:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// 6. GET PROTEGIDO (Ver sonidos pendientes)
app.get('/api/admin/sounds/pending', adminGuard, async (req, res) => {
  try {
    const pending = await db.collection('sounds').find({ status: 'pending' }).toArray();
    const pendingWithUrls = pending.map(sound => ({
      ...sound,
      audioFile: sound.audioFile ? {
        ...sound.audioFile,
        url: blobUrlWithSas(sound.audioFile.blobName)
      } : null,
      coverImage: sound.coverImage ? {
        ...sound.coverImage,
        url: blobUrlWithSas(sound.coverImage.blobName)
      } : null
    }));
    res.json(pendingWithUrls);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar pendientes' });
  }
});