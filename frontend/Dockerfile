# Frontend Dockerfile para React con Vite
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3001

# Variables de entorno
ENV NODE_ENV=production
ENV VITE_API_BASE_URL=http://localhost:5000/api/v1

# Comando de inicio
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]