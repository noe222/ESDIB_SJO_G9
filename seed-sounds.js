import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const { MONGODB_URI, MONGODB_DB } = process.env;

// Sonidos base que estaban en la página original
const defaultSounds = [
    {
        title: 'Hoguera',
        description: 'La calidez y tranquilidad de la chimenea transformadas en un audio envolvente que invita al descanso. El suave crepitar de las llamas crea una sensación reconfortante que transmite la misma paz que si estuvieras junto al fuego.',
        category: 'naturaleza',
        tags: ['fuego', 'calidez', 'relajación'],
        audioFile: {
            blobName: 'sounds/hoguera.mp3', // Tendrás que subir el archivo real
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/hoguera.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Bosque',
        description: 'Los susurros del bosque te envuelven en una experiencia auditiva única. El canto de los pájaros, el murmullo de las hojas y la brisa entre los árboles crean una atmósfera perfecta para la meditación.',
        category: 'naturaleza',
        tags: ['bosque', 'naturaleza', 'pájaros'],
        audioFile: {
            blobName: 'sounds/bosque.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/bosque.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Mar',
        description: 'Las olas del mar rompen suavemente en la orilla, creando un ritmo natural y relajante. Perfecto para desconectar y encontrar la calma interior.',
        category: 'naturaleza',
        tags: ['mar', 'olas', 'playa'],
        audioFile: {
            blobName: 'sounds/mar.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/mar.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Playa',
        description: 'El sonido de la playa combina las olas del mar con la brisa marina, transportándote a un lugar de paz y serenidad.',
        category: 'naturaleza',
        tags: ['playa', 'mar', 'olas'],
        audioFile: {
            blobName: 'sounds/playa.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/playa.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Lluvia',
        description: 'El sonido rítmico de la lluvia cayendo suavemente, perfecto para concentrarse, relajarse o conciliar el sueño.',
        category: 'naturaleza',
        tags: ['lluvia', 'agua', 'relajación'],
        audioFile: {
            blobName: 'sounds/lluvia.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/lluvia.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Noche',
        description: 'Los sonidos nocturnos de la naturaleza: grillos, búhos y la calma de la noche estrellada.',
        category: 'ambiente',
        tags: ['noche', 'naturaleza', 'calma'],
        audioFile: {
            blobName: 'sounds/noche.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/noche.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Tormenta',
        description: 'El poder de la naturaleza capturado en el sonido de una tormenta: truenos lejanos, lluvia intensa y el viento.',
        category: 'naturaleza',
        tags: ['tormenta', 'lluvia', 'truenos'],
        audioFile: {
            blobName: 'sounds/tormenta.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/tormenta.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    },
    {
        title: 'Viento',
        description: 'La brisa suave del viento entre los árboles y la hierba, un sonido que conecta con la esencia de la naturaleza.',
        category: 'naturaleza',
        tags: ['viento', 'brisa', 'naturaleza'],
        audioFile: {
            blobName: 'sounds/viento.mp3',
            mime: 'audio/mpeg'
        },
        coverImage: {
            blobName: 'sounds/images/viento.jpg',
            mime: 'image/jpeg'
        },
        status: 'approved',
        contributor: 'Neuma',
        createdAt: new Date()
    }
];

async function seedSounds() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB');

        const db = client.db(MONGODB_DB);
        const soundsCollection = db.collection('sounds');

        // Verificar si ya hay sonidos
        const count = await soundsCollection.countDocuments();
        if (count > 0) {
            console.log(`⚠️  Ya hay ${count} sonidos en la base de datos.`);
            console.log('¿Quieres eliminarlos y empezar de cero? Comenta la línea de abajo:');
            // await soundsCollection.deleteMany({});
            // console.log('🗑️  Sonidos anteriores eliminados');
        }

        // Insertar sonidos por defecto
        const result = await soundsCollection.insertMany(defaultSounds);
        console.log(`✅ ${result.insertedCount} sonidos insertados correctamente`);

        console.log('\n📝 NOTA IMPORTANTE:');
        console.log('Los archivos de audio e imágenes NO se han subido a Azure.');
        console.log('Tienes dos opciones:');
        console.log('1. Subir manualmente los archivos a Azure Blob Storage en las rutas especificadas');
        console.log('2. Usar URLs de placeholder (como las de Unsplash) temporalmente');
        console.log('\nPara actualizar las URLs, edita este script y vuelve a ejecutarlo.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n👋 Desconectado de MongoDB');
    }
}

// Ejecutar
seedSounds();
