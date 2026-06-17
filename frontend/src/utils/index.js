// Utilidades de formateo de fechas
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return date.toLocaleDateString('es-ES', defaultOptions);
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatRelativeTime = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'hace un momento';
  if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} minutos`;
  if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} horas`;
  if (diffInSeconds < 604800) return `hace ${Math.floor(diffInSeconds / 86400)} días`;
  
  return formatDate(dateString);
};

// Utilidades de formateo de archivos
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

// Utilidades de texto
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

export const capitalizeFirst = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Utilidades de validación
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
    errors: [
      ...(password.length < minLength ? [`Mínimo ${minLength} caracteres`] : []),
      ...(hasUpperCase ? [] : ['Una mayúscula']),
      ...(hasLowerCase ? [] : ['Una minúscula']),
      ...(hasNumbers ? [] : ['Un número'])
    ]
  };
};

// Utilidades de URL y navegación
export const getQueryParams = () => {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

export const setQueryParam = (key, value) => {
  const url = new URL(window.location);
  url.searchParams.set(key, value);
  window.history.replaceState({}, '', url);
};

export const removeQueryParam = (key) => {
  const url = new URL(window.location);
  url.searchParams.delete(key);
  window.history.replaceState({}, '', url);
};

// Utilidades de almacenamiento local
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage:`, error);
      return defaultValue;
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage:`, error);
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage:`, error);
    }
  },

  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error(`Error clearing localStorage:`, error);
    }
  }
};

// Utilidades de debounce y throttle
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, wait) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
};

// Utilidades de arrays y objetos
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

export const uniqueBy = (array, key) => {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

// Utilidades de notificaciones
export const showNotification = (message, type = 'info', duration = 4000) => {
  // Esta función será implementada por el componente NotificationProvider
  if (window.showNotification) {
    window.showNotification(message, type, duration);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

// Utilidades de roles y permisos
export const ROLES = {
  INVESTIGADOR: 'investigador',
  INVITADO: 'invitado'
};

export const PERMISSIONS = {
  CREATE_DOCUMENTS: 'create_documents',
  CREATE_COLLECTIONS: 'create_collections',
  EDIT_OWN_CONTENT: 'edit_own_content',
  DELETE_OWN_CONTENT: 'delete_own_content',
  COMMENT: 'comment',
  VIEW_CONTENT: 'view_content'
};

export const getRolePermissions = (role) => {
  switch (role) {
    case ROLES.INVESTIGADOR:
      return [
        PERMISSIONS.VIEW_CONTENT,
        PERMISSIONS.COMMENT,
        PERMISSIONS.CREATE_DOCUMENTS,
        PERMISSIONS.CREATE_COLLECTIONS,
        PERMISSIONS.EDIT_OWN_CONTENT,
        PERMISSIONS.DELETE_OWN_CONTENT
      ];
    
    case ROLES.INVITADO:
      return [
        PERMISSIONS.VIEW_CONTENT,
        PERMISSIONS.COMMENT
      ];
    
    default:
      return [PERMISSIONS.VIEW_CONTENT];
  }
};

export const hasPermission = (userRole, permission) => {
  const permissions = getRolePermissions(userRole);
  return permissions.includes(permission);
};

// Utilidades de formularios
export const createFormData = (data) => {
  const formData = new FormData();
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (value instanceof File) {
      formData.append(key, value);
    } else if (value !== null && value !== undefined) {
      formData.append(key, value.toString());
    }
  });
  
  return formData;
};

// Utilidades de errores
export const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'Ha ocurrido un error inesperado';
};

// Utilidades de loading states
export const createLoadingState = () => ({
  loading: false,
  error: null,
  data: null
});

export const setLoading = (state, loading = true) => ({
  ...state,
  loading,
  error: loading ? null : state.error
});

export const setError = (state, error) => ({
  ...state,
  loading: false,
  error: getErrorMessage(error)
});

export const setData = (state, data) => ({
  ...state,
  loading: false,
  error: null,
  data
});

// Utilidad para generar IDs únicos
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export default {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatFileSize,
  truncateText,
  capitalizeFirst,
  escapeHtml,
  validateEmail,
  validatePassword,
  getQueryParams,
  setQueryParam,
  removeQueryParam,
  storage,
  debounce,
  throttle,
  groupBy,
  sortBy,
  uniqueBy,
  showNotification,
  ROLES,
  PERMISSIONS,
  getRolePermissions,
  hasPermission,
  createFormData,
  getErrorMessage,
  createLoadingState,
  setLoading,
  setError,
  setData,
  generateId
};