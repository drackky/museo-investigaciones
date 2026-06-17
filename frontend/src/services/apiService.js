import axios from 'axios';

// Configuración base
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // Si el token expiró, limpiar localStorage
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Servicio de API
export const apiService = {
  // Métodos HTTP genéricos
  get: (url, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const finalUrl = queryString ? `${url}?${queryString}` : url;
    return api.get(finalUrl);
  },

  post: (url, data) => {
    // Si es FormData, no establecer Content-Type
    if (data instanceof FormData) {
      return api.post(url, data, {
        headers: {
          'Content-Type': undefined
        }
      });
    }
    return api.post(url, data);
  },

  put: (url, data) => api.put(url, data),
  delete: (url) => api.delete(url),
  patch: (url, data) => api.patch(url, data),

  // Autenticación
  auth: {
    login: (credentials) => apiService.post('/auth/login', credentials),
    register: (userData) => apiService.post('/auth/register', userData),
    logout: () => apiService.post('/auth/logout'),
    me: () => apiService.get('/auth/me'),
    refresh: () => apiService.post('/auth/refresh')
  },

  // Documentos
  documents: {
    getAll: (params = {}) => apiService.get('/documents', params),
    getById: (id) => apiService.get(`/documents/${id}`),
    create: (formData) => apiService.post('/documents', formData),
    update: (id, data) => apiService.put(`/documents/${id}`, data),
    delete: (id) => apiService.delete(`/documents/${id}`),
    download: (id) => `${API_BASE_URL}/documents/${id}/download`,
    search: (query, filters = {}) => {
      const params = { q: query, ...filters };
      return apiService.get('/documents/search', params);
    },
    toggleFavorite: (id) => apiService.post(`/documents/${id}/favorite`),

    // Comentarios de documentos
    getComments: (id, params = {}) => apiService.get(`/documents/${id}/comments`, params),
    addComment: (id, data) => apiService.post(`/documents/${id}/comments`, data),
    updateComment: (commentId, data) => apiService.put(`/comments/${commentId}`, data),
    deleteComment: (commentId) => apiService.delete(`/comments/${commentId}`),
    likeComment: (commentId) => apiService.post(`/comments/${commentId}/like`)
  },

  // Colecciones
  collections: {
    getAll: (params = {}) => apiService.get('/collections', params),
    getById: (id) => apiService.get(`/collections/${id}`),
    create: (formData) => apiService.post('/collections', formData),
    update: (id, data) => apiService.put(`/collections/${id}`, data),
    delete: (id) => apiService.delete(`/collections/${id}`),
    addDocument: (id, documentId) => {
      return apiService.post(`/collections/${id}/documents`, { document_id: documentId });
    },
    removeDocument: (id, documentId) => {
      return apiService.delete(`/collections/${id}/documents/${documentId}`);
    },
    
    // Funciones sociales
    toggleFavorite: (id) => apiService.post(`/collections/${id}/favorite`),
    toggleLike: (id) => apiService.post(`/collections/${id}/like`),
    toggleSubscription: (id) => apiService.post(`/collections/${id}/subscribe`),
    rate: (id, rating) => apiService.post(`/collections/${id}/rating`, { rating }),
    share: (id, shareData) => apiService.post(`/collections/${id}/share`, shareData),
    
    // Comentarios de colecciones
    getComments: (id, params = {}) => apiService.get(`/collections/${id}/comments`, params),
    addComment: (id, data) => apiService.post(`/collections/${id}/comments`, data)
  },

  // Investigaciones
  research: {
    getAll: (params = {}) => apiService.get('/research', params),
    getById: (id) => apiService.get(`/research/${id}`),
    create: (data) => apiService.post('/research', data),
    update: (id, data) => apiService.put(`/research/${id}`, data),
    delete: (id) => apiService.delete(`/research/${id}`),
    search: (query, filters = {}) => {
      const params = { q: query, ...filters };
      return apiService.get('/research/search', params);
    }
  },

  // Estadísticas
  stats: {
    general: () => apiService.get('/stats'),
    documents: () => apiService.get('/stats/documents'),
    collections: () => apiService.get('/stats/collections'),
    users: () => apiService.get('/stats/users')
  },

  // Usuarios
  users: {
    getProfile: () => apiService.get('/users/profile'),
    updateProfile: (data) => apiService.put('/users/profile', data),
    changePassword: (data) => apiService.put('/users/password', data)
  },

  // Comentarios
  comments: {
    getByDocument: (documentId, params = {}) => apiService.get(`/documents/${documentId}/comments`, params),
    getByCollection: (collectionId, params = {}) => apiService.get(`/collections/${collectionId}/comments`, params),
    addToDocument: (documentId, data) => apiService.post(`/documents/${documentId}/comments`, data),
    addToCollection: (collectionId, data) => apiService.post(`/collections/${collectionId}/comments`, data),
    update: (commentId, data) => apiService.put(`/comments/${commentId}`, data),
    delete: (commentId) => apiService.delete(`/comments/${commentId}`),
    like: (commentId) => apiService.post(`/comments/${commentId}/like`)
  }
};

// Exportaciones de servicios específicos
export const documentService = apiService.documents;
export const authService = apiService.auth;
export const collectionService = apiService.collections;
export const commentService = apiService.comments;
export const researchService = apiService.research;

export default apiService;