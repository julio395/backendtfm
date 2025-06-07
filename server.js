const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ruta de prueba simple
app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ message: 'Backend is working!' });
});

// Conexión a MongoDB
const MONGODB_URI = 'mongodb://BBDD-mongo:ObnfN9UwzjE9pEmCX7dDhX5Jixa7JMe1oT8iLwjUWI8Wkc10fhKpVVqmmx86b5DH@5.135.131.59:6590/?directConnection=true';
console.log('Intentando conectar a MongoDB...');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'tfm'
})
.then(async () => {
    console.log('Conectado a MongoDB - Base de datos: tfm');
    try {
        // Obtener la base de datos
        const db = mongoose.connection.db;
        
        // Listar todas las bases de datos disponibles
        const adminDb = mongoose.connection.db.admin();
        const dbs = await adminDb.listDatabases();
        console.log('Bases de datos disponibles:', dbs.databases.map(db => db.name));
        
        // Listar todas las colecciones disponibles
        const collections = await db.listCollections().toArray();
        console.log('Colecciones disponibles:', collections.map(c => c.name));
        
        // Verificar cada colección
        const collectionNames = ['Activos', 'Amenazas', 'Vulnerabilidades', 'Salvaguardas', 'Relaciones'];
        for (const name of collectionNames) {
            try {
                const collection = db.collection(name);
                const count = await collection.countDocuments();
                console.log(`Colección ${name}: ${count} documentos`);
                
                // Obtener un documento de ejemplo
                const sample = await collection.findOne();
                if (sample) {
                    console.log(`Ejemplo de documento en ${name}:`, JSON.stringify(sample, null, 2));
                } else {
                    console.log(`No se encontraron documentos en la colección ${name}`);
                }
            } catch (error) {
                console.error(`Error al acceder a la colección ${name}:`, error);
            }
        }
    } catch (error) {
        console.error('Error al listar colecciones:', error);
    }
})
.catch(err => {
    console.error('Error conectando a MongoDB:', err);
    process.exit(1);
});

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
        console.log(`Obteniendo datos de la colección: ${collection}`);
        
        const db = mongoose.connection.db;
        const collectionObj = db.collection(collection);
        
        // Verificar si la colección existe
        const count = await collectionObj.countDocuments();
        console.log(`Número de documentos encontrados en ${collection}: ${count}`);
        
        if (count === 0) {
            console.log(`La colección ${collection} está vacía`);
            return res.json([]);
        }
        
        const docs = await collectionObj.find().toArray();
        console.log(`Datos encontrados en ${collection}:`, JSON.stringify(docs, null, 2));
        
        res.json(docs);
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log('Available routes:');
    console.log('- GET /api/activos');
    console.log('- GET /api/amenazas');
    console.log('- GET /api/vulnerabilidades');
    console.log('- GET /api/salvaguardas');
    console.log('- GET /api/relaciones');
}); 