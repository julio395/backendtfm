# Usar una imagen base de Node.js
FROM node:18-alpine

# Crear y establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto del código fuente
COPY . .

# Exponer el puerto que usa la aplicación
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["npm", "start"] 