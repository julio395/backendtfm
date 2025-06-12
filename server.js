const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// Middleware para logging de todas las solicitudes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// Configuración de CORS
app.use((req, res, next) => {
    console.log('Configurando CORS para solicitud:', req.url);
    res.header('Access-Control-Allow-Origin', 'https://projectfm.julio.coolify.hgccarlos.es');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
        console.log('Manejando solicitud OPTIONS');
        return res.status(200).end();
    }
    next();
});

// Middleware para parsear JSON
app.use(express.json());

// Ruta de prueba
app.get('/api/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ message: 'Backend is working!' });
});

// Ruta para verificar la conexión a MongoDB
app.get('/api/mongodb-status', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        res.json({
            status: 'connected',
            collections: collections.map(c => c.name)
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Ruta de prueba simple
app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ message: 'Backend is working!' });
});

// Endpoint para verificar el estado del servidor
app.get('/api/health', (req, res) => {
    console.log('Verificando estado del servidor');
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime()
    };
    console.log('Estado del servidor:', status);
    res.json(status);
});

// Configuración de MongoDB
const MONGODB_URI = 'mongodb://BBDD-mongo:ObnfN9UwzjE9pEmCX7dDhX5Jixa7JMe1oT8iLwjUWI8Wkc10fhKpVVqmmx86b5DH@5.135.131.59:6590/?directConnection=true';

// Inicialización de colecciones
const collections = [
    'Activos',
    'Amenazas',
    'Vulnerabilidades',
    'Salvaguardas',
    'Relaciones',
    'Auditorias',
    'Borradores'
];

// Definición de colecciones
let auditoriasCollection;

// Función para inicializar colecciones
const initializeCollections = async () => {
    try {
        const db = mongoose.connection.db;
        const existingCollections = await db.listCollections().toArray();
        const existingCollectionNames = existingCollections.map(col => col.name);

        for (const collectionName of collections) {
            if (!existingCollectionNames.includes(collectionName)) {
                console.log(`Creando colección: ${collectionName}`);
                await db.createCollection(collectionName);
            }
        }
        
        // Inicializar referencias a colecciones
        auditoriasCollection = db.collection('Auditorias');
        
        console.log('Todas las colecciones inicializadas correctamente');
    } catch (error) {
        console.error('Error al inicializar colecciones:', error);
        throw error;
    }
};

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promesa rechazada no manejada:', error);
});

console.log('Iniciando conexión a MongoDB...');
// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'backend-tfm'
})
.then(async () => {
    console.log('=== Conexión a MongoDB establecida ===');
    console.log('URI de conexión:', process.env.MONGODB_URI);
    console.log('Base de datos:', 'backend-tfm');
    console.log('Estado de la conexión:', mongoose.connection.readyState);
    await initializeCollections();
})
.catch(err => {
    console.error('=== Error al conectar con MongoDB ===');
    console.error('Error:', err);
    console.error('URI de conexión:', process.env.MONGODB_URI);
    console.error('Estado de la conexión:', mongoose.connection.readyState);
    process.exit(1);
});

// Manejar eventos de conexión
mongoose.connection.on('connected', () => {
    console.log('Mongoose conectado a MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Error en la conexión de Mongoose:', err);
    console.error('Stack trace:', err.stack);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose desconectado de MongoDB');
});

// Manejar cierre de la aplicación
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('Conexión a MongoDB cerrada por terminación de la aplicación');
        process.exit(0);
    } catch (err) {
        console.error('Error al cerrar la conexión a MongoDB:', err);
        process.exit(1);
    }
});

// Iniciar el servidor
const startServer = async () => {
    try {
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en puerto ${PORT}`);
            console.log('Configuración del servidor:');
            console.log('- Puerto:', PORT);
            console.log('- Entorno:', process.env.NODE_ENV || 'development');
            console.log('- MongoDB URI:', process.env.MONGODB_URI.replace(/:[^:@]*@/, ':****@')); // Ocultar credenciales en logs
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

// Iniciar el servidor
startServer();

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

// Endpoint para obtener todos los activos sin paginación
app.get('/api/tfm/Activos/all', async (req, res) => {
    try {
        console.log('=== Iniciando petición de activos ===');
        console.log('Estado de conexión MongoDB:', mongoose.connection.readyState);
        
        // Verificar conexión a MongoDB
        if (!mongoose.connection.readyState) {
            console.error('No hay conexión con MongoDB. Estado:', mongoose.connection.readyState);
            return res.status(500).json({ 
                error: 'Error de conexión a la base de datos',
                details: 'El servidor no puede conectarse a MongoDB',
                state: mongoose.connection.readyState
            });
        }

        console.log('Conexión a MongoDB establecida, obteniendo colección Activos...');
        const db = mongoose.connection.db;
        
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
        console.error('Error detallado al obtener activos:', error);
        console.error('Stack trace:', error.stack);
        
        // Determinar el tipo de error
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
        
        // Buscar la auditoría en progreso más reciente del usuario
        const auditoria = await auditoriasCollection.findOne(
            { 
                'cliente.id': userId,
                estado: 'en_progreso'
            },
            { sort: { ultimaModificacion: -1 } }
        );
        
        if (!auditoria) {
            return res.status(404).json({ message: 'No se encontró una auditoría en progreso' });
        }
        
        res.json(auditoria);
    } catch (error) {
        console.error('Error al obtener auditoría en progreso:', error);
        res.status(500).json({ error: 'Error al obtener la auditoría en progreso' });
    }
});

// Crear nueva auditoría en progreso
app.post('/api/auditoria/en-progreso', async (req, res) => {
    try {
        const { respuestas, cliente } = req.body;
        
        const auditoriaData = {
            _id: new ObjectId(),
            respuestas,
            cliente,
            estado: 'en_progreso',
            fechaCreacion: new Date().toISOString(),
            ultimaModificacion: new Date().toISOString(),
            procesadoIA: false
        };
        
        const result = await auditoriasCollection.insertOne(auditoriaData);
        
        if (result.acknowledged) {
            res.json({ 
                _id: auditoriaData._id,
                message: 'Auditoría en progreso creada correctamente'
            });
        } else {
            throw new Error('Error al crear la auditoría');
        }
    } catch (error) {
        console.error('Error al crear auditoría en progreso:', error);
        res.status(500).json({ error: 'Error al crear la auditoría en progreso' });
    }
});

// Actualizar auditoría en progreso
app.put('/api/auditoria/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { respuestas, cliente, ultimaModificacion } = req.body;
        
        // Obtener la auditoría actual
        const auditoriaActual = await auditoriasCollection.findOne({ _id: new ObjectId(id) });
        
        if (!auditoriaActual) {
            return res.status(404).json({ error: 'No se encontró la auditoría para actualizar' });
        }
        
        // Fusionar las respuestas existentes con las nuevas
        const respuestasActualizadas = {
            ...auditoriaActual.respuestas,
            ...respuestas
        };
        
        const updateData = {
            $set: {
                respuestas: respuestasActualizadas,
                ultimaModificacion: new Date().toISOString()
            }
        };
        
        const result = await auditoriasCollection.updateOne(
            { _id: new ObjectId(id) },
            updateData
        );
        
        if (result.modifiedCount > 0) {
            res.json({ 
                message: 'Auditoría actualizada correctamente',
                respuestas: respuestasActualizadas
            });
        } else {
            res.status(404).json({ error: 'No se encontró la auditoría para actualizar' });
        }
    } catch (error) {
        console.error('Error al actualizar auditoría:', error);
        res.status(500).json({ error: 'Error al actualizar la auditoría' });
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