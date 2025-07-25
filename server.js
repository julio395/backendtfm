const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// Configuración de CORS
const corsOptions = {
    origin: [
        'https://projectfm.julio.coolify.hgccarlos.es',
        'https://backendtfm.julio.coolify.hgccarlos.es',
        'http://localhost:3000',
        'http://localhost:5000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma',
        'If-Match',
        'If-None-Match',
        'If-Modified-Since',
        'If-Unmodified-Since'
    ],
    exposedHeaders: [
        'ETag',
        'Last-Modified',
        'Cache-Control',
        'Content-Type',
        'Content-Length'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false,
    maxAge: 86400 // 24 horas
};

app.use(cors(corsOptions));

// Middleware para manejar preflight requests
app.options('*', cors(corsOptions));

// Middleware para logging de peticiones
app.use((req, res, next) => {
    console.log(`=== Nueva petición ${req.method} a ${req.url} ===`);
    console.log('Headers:', req.headers);
    console.log('Origin:', req.headers.origin);
    next();
});

// Middleware para parsear JSON
app.use(express.json());

// Ruta de prueba simple
app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ message: 'Backend is working!' });
});

// Middleware para verificar la conexión a MongoDB
const checkMongoConnection = (req, res, next) => {
    if (mongoose.connection.readyState === 1) {
        next();
    } else {
        console.error('Error: MongoDB no está conectado para esta petición.');
        res.status(503).json({
            error: 'Error de conexión a la base de datos',
            details: 'MongoDB no está conectado'
        });
    }
};

// Endpoint de health check mejorado
app.get('/api/health', async (req, res) => {
    console.log('=== Health Check Iniciado ===');
    try {
        console.log('Verificando estado de MongoDB...');
        const isConnected = mongoose.connection.readyState === 1;

        if (!isConnected) {
            console.log('MongoDB no está conectado');
            return res.status(503).json({
                status: 'error',
                error: 'Error de conexión con la base de datos',
                mongodb: {
                    connected: false,
                    error: 'No se pudo establecer conexión'
                }
            });
        }

        console.log('MongoDB está conectado. Verificando acceso a la base de datos...');
        const db = mongoose.connection.db;
        if (!db) {
            console.log('No se pudo acceder a la base de datos');
            return res.status(503).json({
                status: 'error',
                error: 'Error de conexión con la base de datos',
                mongodb: {
                    connected: false,
                    error: 'No se pudo acceder a la base de datos'
                }
            });
        }

        console.log('Listando colecciones...');
        const collections = await db.listCollections().toArray();
        console.log('Colecciones encontradas:', collections.map(c => c.name));

        console.log('=== Health Check Completado con Éxito ===');
        res.json({
            status: 'ok',
            mongodb: {
                connected: true,
                collections: collections.map(c => c.name)
            }
        });
    } catch (error) {
        console.error('Error en health check:', {
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack
        });
        res.status(503).json({
            status: 'error',
            error: 'Error de conexión con la base de datos',
            mongodb: {
                connected: false,
                error: error.message,
                code: error.code
            }
        });
    }
});

// Configuración de MongoDB
const MONGODB_URI = 'mongodb://BBDD-mongo:ObnfN9UwzjE9pEmCX7dDhX5Jixa7JMe1oT8iLwjUWI8Wkc10fhKpVVqmmx86b5DH@5.135.131.59:6590/tfm?authSource=admin&directConnection=true';
const MONGODB_OPTIONS = {
    useNewUrlParser: true, // Deprecated, but often included for compatibility
    useUnifiedTopology: true, // Deprecated, but often included for compatibility
    serverSelectionTimeoutMS: 120000,
    socketTimeoutMS: 120000,
    connectTimeoutMS: 120000,
    family: 4,
    directConnection: true,
    authSource: 'admin',
    ssl: false, // Ensure this is correct for your MongoDB setup
    tls: false, // Ensure this is correct for your MongoDB setup
    tlsAllowInvalidCertificates: true, // Use with caution in production
    tlsAllowInvalidHostnames: true, // Use with caution in production
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10,
    minPoolSize: 5
};

// Función para conectar a MongoDB (llamada solo una vez)
const connectToMongoDB = async () => {
    console.log('=== Intentando conectar a MongoDB ===');
    console.log('Estado inicial de la conexión:', mongoose.connection.readyState);

    // Set up event listeners once
    mongoose.connection.on('connected', () => {
        console.log('MongoDB conectado exitosamente');
    });

    mongoose.connection.on('error', (err) => {
        console.error('Error en la conexión MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
        console.log('MongoDB desconectado. Intentando reconectar...');
        // You might want to implement a reconnection strategy here,
        // but for now, we just log.
    });

    try {
        if (mongoose.connection.readyState === 1) {
            console.log('Ya conectado a MongoDB. No se requiere nueva conexión.');
            return true;
        }

        console.log('Conectando a MongoDB por primera vez...');
        await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
        console.log('Conexión inicial a MongoDB establecida.');
        return true;
    } catch (error) {
        console.error('=== Error al realizar la conexión inicial a MongoDB ===');
        console.error('Error:', error);
        console.error('Estado de la conexión después del error:', mongoose.connection.readyState);
        // Exit the process or handle the error appropriately if the initial connection fails
        process.exit(1); // Exit if we can't connect at startup
    }
};

// Función para inicializar colecciones
const initializeCollections = async () => {
    try {
        console.log('=== Inicializando colecciones ===');
        const db = mongoose.connection.db;

        // Lista de colecciones requeridas
        const requiredCollections = ['Activos', 'Amenazas', 'Vulnerabilidades', 'Salvaguardas', 'Relaciones', 'Auditorias'];

        // Obtener colecciones existentes
        const existingCollections = await db.listCollections().toArray();
        const existingCollectionNames = existingCollections.map(c => c.name);
        console.log('Colecciones existentes:', existingCollectionNames);

        // Crear colecciones faltantes
        for (const collectionName of requiredCollections) {
            if (!existingCollectionNames.includes(collectionName)) {
                console.log(`Creando colección ${collectionName}...`);
                await db.createCollection(collectionName);
                console.log(`Colección ${collectionName} creada`);
            }
        }

        // Verificar colección Activos
        const activosCollection = db.collection('Activos');
        const activosCount = await activosCollection.countDocuments();
        console.log(`Número de documentos en Activos: ${activosCount}`);

        // Verificar colección Auditorias
        const auditoriasCollection = db.collection('Auditorias');
        const auditoriasCount = await auditoriasCollection.countDocuments();
        console.log(`Número de documentos en Auditorias: ${auditoriasCount}`);

        if (activosCount === 0) {
            console.log('La colección Activos está vacía');
        } else {
            const sampleDoc = await activosCollection.findOne();
            console.log('Ejemplo de documento en Activos:', sampleDoc);
        }

        console.log('=== Inicialización de colecciones completada ===');
    } catch (error) {
        console.error('Error al inicializar colecciones:', error);
        throw error;
    }
};

// Iniciar conexión
// connectWithRetry();

// Ruta de prueba para verificar la conexión
app.get('/api/test', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = ['Activos', 'Amenazas', 'Vulnerabilidades', 'Salvaguardas', 'Relaciones'];
        const result = {};
        
        for (const collection of collections) {
            const docs = await db.collection(collection).find().toArray();
            console.log(`Encontrados ${docs.length} documentos en ${collection}`);
            if (docs.length > 0) {
                console.log(`Ejemplo de documento en ${collection}:`, JSON.stringify(docs[0], null, 2));
            }
            result[collection] = docs;
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error en ruta de prueba:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rutas
app.get('/api/tfm/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        // Convertir el nombre de la colección a la primera letra en mayúscula
        const collectionName = collection.charAt(0).toUpperCase() + collection.slice(1).toLowerCase();
        
        console.log(`Obteniendo datos de la colección: ${collectionName}, página: ${page}, límite: ${limit}`);
        
        const db = mongoose.connection.db;
        const collectionObj = db.collection(collectionName);
        
        // Obtener el total de documentos para la paginación
        const total = await collectionObj.countDocuments();
        
        // Verificar si la colección existe
        if (total === 0) {
            console.log(`La colección ${collectionName} está vacía`);
            return res.json({
                data: [],
                pagination: {
                    total: 0,
                    page: page,
                    limit: limit,
                    totalPages: 0
                }
            });
        }
        
        // Obtener los documentos paginados
        const docs = await collectionObj.find()
            .skip(skip)
            .limit(limit)
            .toArray();
            
        console.log(`Datos encontrados en ${collectionName}: ${docs.length} documentos`);
        
        res.json({
            data: docs,
            pagination: {
                total: total,
                page: page,
                limit: limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(`Error obteniendo datos de ${req.params.collection}:`, error);
        res.status(500).json({ 
            error: error.message,
            details: 'Error al obtener datos de la colección'
        });
    }
});

app.post('/api/tfm/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        console.log(`Creando nuevo item en la colección: ${collection}`, req.body);
        
        const db = mongoose.connection.db;
        const result = await db.collection(collection).insertOne(req.body);
        
        console.log(`Item creado en ${collection}:`, result);
        res.json(result);
    } catch (error) {
        console.error(`Error creando item en ${req.params.collection}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tfm/:collection/:id', async (req, res) => {
    try {
        const { collection, id } = req.params;
        console.log(`Actualizando item ${id} en la colección: ${collection}`, req.body);
        
        const db = mongoose.connection.db;
        const result = await db.collection(collection).updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: req.body }
        );
        
        console.log(`Item actualizado en ${collection}:`, result);
        res.json(result);
    } catch (error) {
        console.error(`Error actualizando item en ${req.params.collection}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tfm/:collection/:id', async (req, res) => {
    try {
        const { collection, id } = req.params;
        console.log(`Eliminando item ${id} de la colección: ${collection}`);
        
        const db = mongoose.connection.db;
        const result = await db.collection(collection).deleteOne(
            { _id: new mongoose.Types.ObjectId(id) }
        );
        
        console.log(`Item eliminado de ${collection}:`, result);
        res.json({ message: 'Item eliminado correctamente' });
    } catch (error) {
        console.error(`Error eliminando item en ${req.params.collection}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Crear índices para la colección de auditorías
mongoose.connection.once('open', async () => {
    try {
        const db = mongoose.connection.db;
        const auditoriasCollection = db.collection('Auditorias');
        
        // Crear índices para mejorar la visualización y búsqueda
        await auditoriasCollection.createIndex({ fecha: -1 });
        await auditoriasCollection.createIndex({ 'cliente.nombre': 1 });
        await auditoriasCollection.createIndex({ estado: 1 });
        await auditoriasCollection.createIndex({ sequence: -1 });
        await auditoriasCollection.createIndex({ updateCounter: -1 });
        
        console.log('Índices creados para la colección Auditorias');
    } catch (error) {
        console.error('Error creando índices:', error);
    }
});

// Endpoint para guardar respuestas de auditoría
app.post('/api/auditoria', async (req, res) => {
    try {
        console.log('Recibiendo datos de auditoría:', JSON.stringify(req.body, null, 2));
        
        const { respuestas, cliente } = req.body;
        if (!respuestas || !cliente) {
            console.error('Datos incompletos recibidos:', { respuestas, cliente });
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        const db = mongoose.connection.db;
        console.log('Conexión a MongoDB establecida, base de datos:', db.databaseName);
        
        // Verificar si la colección existe
        const collections = await db.listCollections().toArray();
        console.log('Colecciones disponibles:', collections.map(c => c.name));
        
        // Verificar si la colección Auditorias existe
        const auditoriasCollection = db.collection('Auditorias');
        const auditoriasCount = await auditoriasCollection.countDocuments();
        console.log(`Número actual de auditorías en la colección: ${auditoriasCount}`);
        
        const fechaActual = new Date();
        const timestamp = fechaActual.getTime();
        const uniqueId = new mongoose.Types.ObjectId();
        
        // Obtener el último número de secuencia
        const lastAudit = await auditoriasCollection.find()
            .sort({ sequence: -1 })
            .limit(1)
            .toArray();
        
        const sequence = lastAudit.length > 0 ? lastAudit[0].sequence + 1 : 1;
        
        const auditoriaData = {
            _id: uniqueId,
            sequence: sequence,
            timestamp: timestamp,
            updateCounter: Date.now(),
            respuestas,
            cliente: {
                id: cliente.id,
                nombre: cliente.nombre,
                email: cliente.email,
                empresa: cliente.empresa
            },
            fecha: fechaActual,
            fechaISO: fechaActual.toISOString(),
            estado: 'completada',
            finalizado: true,
            procesadoIA: false,
            metadata: {
                version: '1.0',
                tipo: 'auditoria_seguridad',
                usuario: cliente.id,
                fechaCreacion: fechaActual.toISOString(),
                ultimaModificacion: fechaActual.toISOString()
            },
            resumen: {
                totalActivos: Object.keys(respuestas).reduce((acc, cat) => acc + (respuestas[cat].cantidad || 0), 0),
                categorias: Object.keys(respuestas),
                fechaFormateada: fechaActual.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            }
        };
        
        console.log('Intentando guardar auditoría con datos:', JSON.stringify(auditoriaData, null, 2));
        
        // Usar insertOne con el documento completo incluyendo _id
        const result = await auditoriasCollection.insertOne(auditoriaData);
        
        console.log('Auditoría guardada exitosamente:', {
            insertedId: result.insertedId,
            acknowledged: result.acknowledged,
            sequence: sequence
        });

        // Verificar que el documento se guardó correctamente
        const savedAudit = await auditoriasCollection.findOne({ _id: uniqueId });
        console.log('Documento guardado verificado:', savedAudit);

        // Verificar el total de documentos después de la inserción
        const newCount = await auditoriasCollection.countDocuments();
        console.log(`Número total de auditorías después de la inserción: ${newCount}`);

        // Listar todas las auditorías para verificación
        const allAudits = await auditoriasCollection.find()
            .sort({ sequence: -1 })
            .toArray();
            
        console.log('Todas las auditorías en la colección:', allAudits.map(audit => ({
            id: audit._id,
            sequence: audit.sequence,
            timestamp: audit.timestamp,
            fecha: audit.fecha,
            cliente: audit.cliente.nombre,
            resumen: audit.resumen
        })));

        res.json({ 
            message: 'Auditoría guardada correctamente', 
            id: uniqueId,
            sequence: sequence,
            timestamp: timestamp,
            resumen: auditoriaData.resumen
        });
    } catch (error) {
        console.error('Error guardando auditoría:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Error al guardar la auditoría en la base de datos'
        });
    }
});

// Endpoint para listar todas las auditorías
app.get('/api/auditorias', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const auditoriasCollection = db.collection('Auditorias');
        
        console.log('Obteniendo todas las auditorías...');
        
        // Ordenar por sequence descendente para obtener las más recientes primero
        const auditorias = await auditoriasCollection.find()
            .sort({ sequence: -1 })
            .toArray();
            
        console.log(`Encontradas ${auditorias.length} auditorías`);
        
        res.json(auditorias);
    } catch (error) {
        console.error('Error obteniendo auditorías:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'Error al obtener las auditorías de la base de datos'
        });
    }
});

// Función para obtener el siguiente número de secuencia
async function getNextSequence(collectionName) {
    try {
        const db = mongoose.connection.db;
        const result = await db.collection('counters').findOneAndUpdate(
            { _id: collectionName },
            { $inc: { sequence_value: 1 } },
            { 
                upsert: true,
                returnDocument: 'after'
            }
        );
        return result.value ? result.value.sequence_value : 1;
    } catch (error) {
        console.error(`Error al obtener secuencia para ${collectionName}:`, error);
        return Date.now(); // Fallback a timestamp si hay error
    }
}

// Endpoint para guardar borradores de auditoría
app.post('/api/auditoria/borrador', async (req, res) => {
    try {
        const { respuestas, cliente, metadata } = req.body;
        
        if (!respuestas || !cliente || !metadata) {
            console.error('Datos faltantes en la solicitud:', { respuestas, cliente, metadata });
            return res.status(400).json({ 
                error: 'Faltan datos requeridos',
                details: 'Se requieren respuestas, cliente y metadata'
            });
        }

        if (!mongoose.connection.readyState) {
            throw new Error('No hay conexión con la base de datos');
        }

        const timestamp = Date.now();
        const uniqueId = `BORRADOR_${timestamp}_${cliente.id}`;
        const sequence = await getNextSequence('borradores');

        const borradorData = {
            _id: uniqueId,
            sequence: sequence,
            timestamp: timestamp,
            updateCounter: Date.now(),
            respuestas,
            cliente,
            fecha: new Date(),
            fechaISO: new Date().toISOString(),
            estado: 'borrador',
            metadata: {
                ...metadata,
                ultimaModificacion: new Date().toISOString()
            }
        };

        console.log('Intentando guardar borrador con datos:', JSON.stringify(borradorData, null, 2));

        const db = mongoose.connection.db;
        
        // Verificar que la colección existe
        const collections = await db.listCollections().toArray();
        const borradoresExists = collections.some(col => col.name === 'Borradores');

        if (!borradoresExists) {
            console.log('Creando colección Borradores...');
            await db.createCollection('Borradores');
        }

        // Verificar que la colección counters existe
        const countersExists = collections.some(col => col.name === 'counters');
        if (!countersExists) {
            console.log('Creando colección counters...');
            await db.createCollection('counters');
            // Inicializar el contador para borradores
            await db.collection('counters').insertOne({
                _id: 'borradores',
                sequence_value: 0
            });
        }

        // Intentar guardar el borrador
        try {
            const result = await db.collection('Borradores').insertOne(borradorData);
            
            if (result.acknowledged) {
                console.log('Borrador guardado exitosamente:', {
                    id: uniqueId,
                    timestamp: timestamp
                });
                res.status(200).json({
                    id: uniqueId,
                    message: 'Borrador guardado correctamente',
                    timestamp: timestamp
                });
            } else {
                throw new Error('No se recibió confirmación del servidor al guardar el borrador');
            }
        } catch (dbError) {
            console.error('Error específico de base de datos:', dbError);
            throw new Error(`Error al guardar en la base de datos: ${dbError.message}`);
        }
    } catch (error) {
        console.error('Error al guardar borrador:', error);
        res.status(500).json({ 
            error: 'Error al guardar el borrador',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Endpoint para obtener todos los activos
app.get('/api/tfm/Activos/all', checkMongoConnection, async (req, res) => {
    try {
        console.log('=== Iniciando petición de activos ===');
        console.log('Estado de conexión MongoDB:', mongoose.connection.readyState);
        
        const db = mongoose.connection.db;
        console.log('Base de datos:', db.databaseName);
        
        // Verificar que la colección existe
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        console.log('Colecciones disponibles:', collectionNames);
        
        if (!collectionNames.includes('Activos')) {
            console.error('La colección Activos no existe');
            return res.status(500).json({ 
                error: 'Colección no encontrada',
                details: 'La colección Activos no existe en la base de datos',
                availableCollections: collectionNames
            });
        }

        const collectionObj = db.collection('Activos');
        console.log('Ejecutando consulta find()...');
        
        const docs = await collectionObj.find().toArray();
        console.log(`Datos encontrados en Activos: ${docs.length} documentos`);
        
        if (docs.length === 0) {
            console.log('No se encontraron activos en la base de datos');
            return res.json([]);
        }

        // Verificar la estructura de los documentos
        const firstDoc = docs[0];
        console.log('Estructura del primer documento:', Object.keys(firstDoc));
        
        // Filtrar documentos inválidos
        const validDocs = docs.filter(doc => doc && typeof doc === 'object');
        console.log(`Documentos válidos: ${validDocs.length} de ${docs.length}`);
        
        if (validDocs.length === 0) {
            console.error('No hay documentos válidos en la colección');
            return res.status(500).json({ 
                error: 'Datos inválidos',
                details: 'No se encontraron documentos válidos en la colección Activos'
            });
        }
        
        console.log('Enviando respuesta con activos...');
        res.json(validDocs);
    } catch (error) {
        console.error('=== Error al obtener activos ===');
        console.error('Error:', error);
        console.error('Stack trace:', error.stack);
        
        let errorDetails = 'Error al obtener todos los activos';
        if (error.name === 'MongoError') {
            errorDetails = 'Error de MongoDB: ' + error.message;
        } else if (error.name === 'MongooseError') {
            errorDetails = 'Error de Mongoose: ' + error.message;
        }
        
        res.status(500).json({ 
            error: error.message,
            details: errorDetails,
            type: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Endpoint para obtener borradores guardados por usuario
app.get('/api/auditoria/borrador/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!mongoose.connection.readyState) {
            throw new Error('No hay conexión con la base de datos');
        }

        const db = mongoose.connection.db;
        const borradores = await db.collection('Borradores')
            .find({ 
                'cliente.id': userId,
                estado: 'borrador'
            })
            .sort({ timestamp: -1 })
            .toArray();

        res.json(borradores);
    } catch (error) {
        console.error('Error al obtener borradores:', error);
        res.status(500).json({ 
            error: 'Error al obtener los borradores',
            details: error.message
        });
    }
});

// Obtener auditoría en progreso de un usuario
app.get('/api/auditoria/en-progreso/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Buscando auditoría en progreso para usuario:', userId);
        
        const db = mongoose.connection.db;
        const auditoriasCollection = db.collection('Auditorias');
        
        // Verificar que la colección existe
        const collections = await db.listCollections().toArray();
        if (!collections.some(c => c.name === 'Auditorias')) {
            console.log('La colección Auditorias no existe, creándola...');
            await db.createCollection('Auditorias');
        }
        
        // Buscar la auditoría en progreso más reciente del usuario
        const auditoria = await auditoriasCollection.findOne(
            { 
                'cliente.id': userId,
                estado: 'en_progreso'
            },
            { sort: { ultimaModificacion: -1 } }
        );
        
        console.log('Resultado de búsqueda:', auditoria ? 'Auditoría encontrada' : 'No se encontró auditoría');
        
        if (!auditoria) {
            console.log('No se encontró auditoría en progreso para el usuario:', userId);
            return res.status(404).json({ 
                message: 'No se encontró una auditoría en progreso',
                userId: userId
            });
        }
        
        console.log('Auditoría encontrada:', {
            id: auditoria._id,
            estado: auditoria.estado,
            ultimaModificacion: auditoria.ultimaModificacion
        });
        
        res.json(auditoria);
    } catch (error) {
        console.error('Error al obtener auditoría en progreso:', error);
        res.status(500).json({ 
            error: 'Error al obtener la auditoría en progreso',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Crear nueva auditoría en progreso
app.post('/api/auditoria/en-progreso', async (req, res) => {
    try {
        console.log('=== Creando nueva auditoría en progreso ===');
        console.log('Headers recibidos:', req.headers);
        console.log('Datos recibidos:', JSON.stringify(req.body, null, 2));
        
        // Verificar que la colección existe
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Colecciones disponibles:', collections.map(c => c.name));
        
        if (!collections.some(c => c.name === 'Auditorias')) {
            console.log('La colección Auditorias no existe, creándola...');
            await db.createCollection('Auditorias');
        }
        
        const { respuestas = {}, cliente } = req.body;
        
        if (!cliente || !cliente.id) {
            console.error('Error: No se proporcionó información del cliente');
            return res.status(400).json({ error: 'Se requiere información del cliente' });
        }
        
        const auditoriaData = {
            _id: new ObjectId(),
            respuestas,
            cliente,
            estado: 'en_progreso',
            fechaCreacion: new Date().toISOString(),
            ultimaModificacion: new Date().toISOString(),
            procesadoIA: false
        };
        
        console.log('Datos de auditoría a crear:', JSON.stringify(auditoriaData, null, 2));
        
        const auditoriasCollection = db.collection('Auditorias');
        console.log('Intentando insertar en la colección Auditorias...');
        
        const result = await auditoriasCollection.insertOne(auditoriaData);
        console.log('Resultado de la inserción:', result);
        
        if (result.acknowledged) {
            console.log('Auditoría creada exitosamente:', result);
            res.json({ 
                _id: auditoriaData._id,
                message: 'Auditoría en progreso creada correctamente'
            });
        } else {
            console.error('Error: La inserción no fue reconocida por MongoDB');
            throw new Error('Error al crear la auditoría: inserción no reconocida');
        }
    } catch (error) {
        console.error('Error detallado al crear auditoría en progreso:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Error al crear la auditoría en progreso',
            details: error.message
        });
    }
});

// Actualizar auditoría
app.put('/api/auditoria/:id', async (req, res) => {
    try {
        console.log('=== Actualizando auditoría ===');
        console.log('ID de auditoría:', req.params.id);
        console.log('Datos recibidos:', JSON.stringify(req.body, null, 2));

        const { id } = req.params;
        const { respuestas, cliente, estado } = req.body;

        // Verificar que la colección existe
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Colecciones disponibles:', collections.map(c => c.name));

        if (!collections.some(c => c.name === 'Auditorias')) {
            console.error('Error: La colección Auditorias no existe');
            return res.status(500).json({ error: 'La colección de auditorías no está disponible' });
        }

        const auditoriasCollection = db.collection('Auditorias');
        
        // Verificar que la auditoría existe
        const auditoriaExistente = await auditoriasCollection.findOne({ _id: new ObjectId(id) });
        if (!auditoriaExistente) {
            console.error('Error: No se encontró la auditoría con ID:', id);
            return res.status(404).json({ error: 'Auditoría no encontrada' });
        }

        // Preparar datos de actualización
        const updateData = {
            ultimaModificacion: new Date().toISOString()
        };

        if (respuestas) updateData.respuestas = respuestas;
        if (cliente) updateData.cliente = cliente;
        if (estado) updateData.estado = estado;

        console.log('Datos de actualización:', JSON.stringify(updateData, null, 2));

        // Realizar la actualización
        const result = await auditoriasCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        console.log('Resultado de la actualización:', result);

        if (result.matchedCount === 0) {
            console.error('Error: No se encontró la auditoría para actualizar');
            return res.status(404).json({ error: 'Auditoría no encontrada' });
        }

        if (result.modifiedCount === 0) {
            console.log('Advertencia: No se modificó ningún documento');
            return res.status(200).json({ 
                message: 'La auditoría ya estaba actualizada',
                auditoriaId: id
            });
        }

        res.json({ 
            message: 'Auditoría actualizada correctamente',
            auditoriaId: id
        });

    } catch (error) {
        console.error('Error detallado al actualizar auditoría:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Error al actualizar la auditoría',
            details: error.message
        });
    }
});

// Finalizar auditoría
app.put('/api/auditoria/:id/finalizar', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, finalizado, procesadoIA, ultimaModificacion } = req.body;
        
        const updateData = {
            $set: {
                estado: 'completada',
                finalizado: true,
                procesadoIA: false,
                ultimaModificacion: new Date().toISOString()
            }
        };
        
        const result = await auditoriasCollection.updateOne(
            { _id: new ObjectId(id) },
            updateData
        );
        
        if (result.modifiedCount > 0) {
            res.json({ message: 'Auditoría finalizada correctamente' });
        } else {
            res.status(404).json({ error: 'No se encontró la auditoría para finalizar' });
        }
    } catch (error) {
        console.error('Error al finalizar auditoría:', error);
        res.status(500).json({ error: 'Error al finalizar la auditoría' });
    }
});

// Middleware para logging de errores
app.use((err, req, res, next) => {
    console.error('=== Error en la aplicación ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    console.error('URL:', req.url);
    console.error('Método:', req.method);
    console.error('Headers:', req.headers);
    
    res.status(500).json({
        error: 'Error interno del servidor',
        details: err.message,
        path: req.url
    });
});

// Endpoint para insertar datos de prueba en Activos (GET y POST)
app.get('/api/tfm/Activos/seed', checkMongoConnection, async (req, res) => {
    try {
        console.log('=== Insertando datos de prueba en Activos (GET) ===');
        const db = mongoose.connection.db;
        const activosCollection = db.collection('Activos');
        
        // Datos de ejemplo
        const activosEjemplo = [
            {
                Nombre: 'Servidor Web',
                Categoría: 'Infraestructura',
                Proveedor: 'Microsoft',
                Descripción: 'Servidor web principal de la empresa',
                Criticidad: 'Alta',
                Ubicación: 'Centro de Datos Principal',
                Estado: 'Activo'
            },
            {
                Nombre: 'Base de Datos',
                Categoría: 'Datos',
                Proveedor: 'Oracle',
                Descripción: 'Base de datos principal',
                Criticidad: 'Alta',
                Ubicación: 'Centro de Datos Principal',
                Estado: 'Activo'
            },
            {
                Nombre: 'Firewall',
                Categoría: 'Seguridad',
                Proveedor: 'Cisco',
                Descripción: 'Firewall perimetral',
                Criticidad: 'Alta',
                Ubicación: 'Centro de Datos Principal',
                Estado: 'Activo'
            }
        ];
        
        // Verificar si ya existen datos
        const count = await activosCollection.countDocuments();
        if (count > 0) {
            console.log(`Ya existen ${count} documentos en la colección Activos`);
            return res.json({ 
                message: 'La colección ya contiene datos',
                count: count
            });
        }
        
        // Insertar datos de ejemplo
        const result = await activosCollection.insertMany(activosEjemplo);
        console.log(`${result.insertedCount} documentos insertados`);
        
        res.json({
            message: 'Datos de prueba insertados correctamente',
            count: result.insertedCount
        });
    } catch (error) {
        console.error('Error al insertar datos de prueba:', error);
        res.status(500).json({
            error: 'Error al insertar datos de prueba',
            details: error.message
        });
    }
});

// Mantener también la ruta POST para compatibilidad
app.post('/api/tfm/Activos/seed', checkMongoConnection, async (req, res) => {
    try {
        console.log('=== Insertando datos de prueba en Activos (POST) ===');
        const db = mongoose.connection.db;
        const activosCollection = db.collection('Activos');
        
        // Datos de ejemplo
        const activosEjemplo = [
            {
                Nombre: 'Servidor Web',
                Categoría: 'Infraestructura',
                Proveedor: 'Microsoft',
                Descripción: 'Servidor web principal de la empresa',
                Criticidad: 'Alta',
                Ubicación: 'Centro de Datos Principal',
                Estado: 'Activo'
            },
            {
                Nombre: 'Base de Datos',
                Categoría: 'Datos',
                Proveedor: 'Oracle',
                Descripción: 'Base de datos principal',
                Criticidad: 'Alta',
                Ubicación: 'Centro de Datos Principal',
                Estado: 'Activo'
            },
            {
                Nombre: 'Firewall',
                Categoría: 'Seguridad',
                Proveedor: 'Cisco',
                Descripción: 'Firewall perimetral',
                Criticidad: 'Alta',
                Ubicación: 'Centro de Datos Principal',
                Estado: 'Activo'
            }
        ];
        
        // Verificar si ya existen datos
        const count = await activosCollection.countDocuments();
        if (count > 0) {
            console.log(`Ya existen ${count} documentos en la colección Activos`);
            return res.json({ 
                message: 'La colección ya contiene datos',
                count: count
            });
        }
        
        // Insertar datos de ejemplo
        const result = await activosCollection.insertMany(activosEjemplo);
        console.log(`${result.insertedCount} documentos insertados`);
        
        res.json({
            message: 'Datos de prueba insertados correctamente',
            count: result.insertedCount
        });
    } catch (error) {
        console.error('Error al insertar datos de prueba:', error);
        res.status(500).json({
            error: 'Error al insertar datos de prueba',
            details: error.message
        });
    }
});

// Configuración de timeout para todas las peticiones
app.use((req, res, next) => {
    req.setTimeout(60000); // 60 segundos
    res.setTimeout(60000); // 60 segundos
    next();
});

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    console.log('Intentando conectar a MongoDB...');
    try {
        await connectToMongoDB();
        console.log('Conexión a MongoDB establecida correctamente');
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
    }
}); 