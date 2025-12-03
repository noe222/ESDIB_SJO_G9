import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { BlobServiceClient } from '@azure/storage-blob';


// Cargar variables de entorno desde .env
dotenv.config();

//Configuraciones de entorno
const { MONGODB_URI, MONGODB_DB, port = process.env.PORT || 4000, API_KEY, AZURE_STORAGE_CONNECTION_STRING, AZURE_BLOB_CONTAINER, AZURE_STORAGE_ACCOUNT, AZURE_SAS_TOKEN } = process.env;

// Verificar si falta algo crítico
if (!MONGODB_URI || !MONGODB_DB || !API_KEY || !AZURE_STORAGE_CONNECTION_STRING || !AZURE_BLOB_CONTAINER || !AZURE_STORAGE_ACCOUNT || !AZURE_SAS_TOKEN) {
  console.error('Faltan variables de entorno: MONGODB_URI, MONGODB_DB, API_KEY, AZURE...');
  process.exit(1);
}

// Cliente de Azure Blob
const blobService = new BlobServiceClient(
  `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net?${AZURE_SAS_TOKEN}`
);

const container = blobService.getContainerClient(AZURE_BLOB_CONTAINER);

const app = express();

// Helper: genera URL pública con SAS incluido
function blobUrlWithSas(blobName) {
  return `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_BLOB_CONTAINER}/${blobName}?${AZURE_SAS_TOKEN}`;
}

// Middlewares de seguridad y utilidades
//Para trabajar de forma local:
//app.use(helmet());

//Para poder trabajar con la pagina subida a azure:
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "connect-src": ["'self'"], // llamadas fetch/XHR al mismo origen
      "img-src": ["'self'", "https:", "data:", "https://esdibstorage.blob.core.windows.net"],
    }
  }
}));
app.use(cors({ origin: true, credentials: true })); // Habilitar CORS
app.use(express.json()); // Parsear JSON
app.use(morgan('dev')); // Logs HTTP
import multer from 'multer';
import crypto from 'crypto';

// Para que se vea desde azure y no de problemas de autenticidad
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));


// Configurar Multer para la subida de imágenes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }, // 8MB por archivo, máx 10 archivos
  fileFilter: (req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
    cb(ok ? null : new Error('Solo imágenes (png/jpg/webp)'), ok);
  }
});

// Generador de nombres y extensiones para imagenes
const randomName = (ext='bin') => crypto.randomBytes(16).toString('hex') + '.' + ext;
const extFromMime = m => (m?.split('/')[1] || 'bin').replace('jpeg','jpg');

// Auth por API Key
const apiKeyGuard = (req, res, next) => {
  if (req.header('x-api-key') !== process.env.API_KEY) return res.status(401).json({ error: 'No autorizado' });
  next();
};
app.use('/api', apiKeyGuard);

// Conexión a MONGODB
let client;
let db;
async function connectToMongo() {
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB);
  console.log('✅ Conectado a MongoDB');
}


//Helpers de validación
function parseIntegerField(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) {
    throw new Error(`El campo "${fieldName}" debe ser un número entero`);
  }
  return num;
}
function parseDateField(value, fieldName) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`El campo "${fieldName}" no es una fecha válida`);
  }
  return d;
}

//Normalizar todos los datos que se suben antes de guardarlos.
function normalizePetPayload(body) {
  const { animal, nombre, raza, collar, edad, pelo, tamaño, color, sexo, fecha, descripcion } = body;
  if (!animal || !nombre) throw new Error('Los campos "animal" y "nombre" son obligatorios');
    const payload = {
    animal: String(animal).trim(),
    nombre: String(nombre).trim(),
    raza: raza ? String(raza).trim() : null,
    collar: parseIntegerField(collar, 'collar'),
    edad: parseIntegerField(edad, 'edad'),
    pelo: pelo ? String(pelo).trim() : null,
    color: color ? String(color).trim() : null,
    sexo: sexo ? String(sexo).trim() : null,
    fecha: parseDateField(fecha, 'fecha'),
    descripcion: descripcion ? String(descripcion).trim() : null,
  };
    payload['tamaño'] = tamaño ? String(tamaño).trim() : null;
    return payload;
  }

  
//Rutas
//GET: Para listar toda la BBDD
app.get('/api/pets', async (req, res) => {
  try {
    const pets = await db.collection('pets')
      .find({})
      .sort({ _id: -1 })
      .toArray();
    res.json(pets);
  } catch (err) {
    console.error('Error en GET /api/pets:', err);
    res.status(500).json({ error: 'Error al obtener mascotas' });
  }
});

//POST Crear registros + subir imágenes en AZURE
app.post('/api/pets', upload.array('files', 10), async (req, res) => {
  try {
    const pet = normalizePetPayload(req.body);
    if (!pet.animal || !pet.nombre) {
      return res.status(400).json({ error: 'Los campos "animal" y "nombre" son obligatorios' });
    }

    // 1) Inserta sin fotos para obtener _id
    const baseDoc = { ...pet, photos: [] };
    const result = await db.collection('pets').insertOne(baseDoc);
    const _id = result.insertedId;

    // 2) Sube imágenes bajo carpeta del _id
    const files = Array.isArray(req.files) ? req.files : [];
    const photos = [];
    for (const f of files) {
      const ext = extFromMime(f.mimetype);
      const blobName = `pets/${_id}/${randomName(ext)}`; // 👈 prefijo estable por mascota
      const block = container.getBlockBlobClient(blobName);
      await block.uploadData(f.buffer, { blobHTTPHeaders: { blobContentType: f.mimetype } });
      photos.push({ blobName, mime: f.mimetype, size: f.size, uploadedAt: new Date() });
    }

    // 3) Actualiza el doc con las fotos
    if (photos.length) {
      await db.collection('pets').updateOne({ _id }, { $push: { photos: { $each: photos } } });
    }

    // 4) Devuelve el doc final
    const doc = await db.collection('pets').findOne({ _id });
    res.status(201).json(doc);
  } catch (err) {
    console.error('POST /api/pets error:', err);
    res.status(400).json({ error: err.message || 'Error al crear mascota' });
  }
});

// DELETE Eliminar registros de la BBDD (De azure por ahora no)
app.delete('/api/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID no válido' });

    const result = await db.collection('pets').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en DELETE /api/pets/:id:', err);
    res.status(500).json({ error: 'Error al eliminar mascota' });
  }
});

//Función para buscar por objectid
function buildIdFilter(id) {
  const s = String(id || '').trim();
  const or = [{ _id: s }];
  if (ObjectId.isValid(s)) or.unshift({ _id: new ObjectId(s) });
  return { $or: or };
}
//PUT Actualizar registro
app.put('/api/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = buildIdFilter(id);
    const payload = normalizePetPayload(req.body);

    // DEBUG LOGS
    console.log('[PUT] id:', id);
    console.log('[PUT] filter:', JSON.stringify(filter));

    // 1) Actualiza
    const r = await db.collection('pets').updateOne(filter, { $set: payload });

    console.log('[PUT] matched:', r.matchedCount, 'modified:', r.modifiedCount);

    // 2) Si no existía, 404
    if (r.matchedCount === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    // 3) Devuelve el documento actual (aunque no haya cambiado nada)
    const updated = await db.collection('pets').findOne(filter);
    console.log('[PUT] returning _id:', updated?._id);
    return res.json(updated);
  } catch (err) {
    console.error('Error en PUT /api/pets/:id', err);
    return res.status(400).json({ error: err.message || 'Error al actualizar mascota' });
  }
});

//Comprobador para saber si el servidor responde
app.get('/health', (req, res) => res.json({ ok: true }));

// Devuelve fotos de una mascota
app.get('/api/pets/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;
    const pet = await db.collection('pets').findOne(buildIdFilter(id), { projection: { photos: 1 } });
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada' });
    const out = (pet.photos || []).map(p => ({ ...p, url: blobUrlWithSas(p.blobName) })); // o makeBlobReadSasUrl si generas al vuelo
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Error al obtener fotos' });
  }
});

// Arranque
connectToMongo()
  .then(() => {
    app.listen(port, () => console.log(`🚀 API escuchando en http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err);
    process.exit(1);
  });

// Cierre elegante
process.on('SIGINT', async () => {
  try {
    await client?.close();
  } finally {
    process.exit(0);
  }
});