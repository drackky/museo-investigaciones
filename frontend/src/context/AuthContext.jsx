import React, { createContext, useContext, useReducer, useEffect } from 'react';
// Importación dinámica para evitar problemas circulares
// import { apiService } from '../services/apiService';

// Estado inicial
const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true,
  error: null
};

// Tipos de acciones
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  LOAD_USER: 'LOAD_USER',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_ERROR:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: action.payload
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null
      };

    case AUTH_ACTIONS.LOAD_USER:
      return {
        ...state,
        isAuthenticated: !!action.payload,
        user: action.payload,
        loading: false
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
}

// Contexto
const AuthContext = createContext(null);

// Hook personalizado
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

// Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        // Cargar desde cache primero
        const user = JSON.parse(userData);
        dispatch({
          type: AUTH_ACTIONS.LOAD_USER,
          payload: user
        });

        // Verificar con el servidor en background
        try {
          const response = await apiService.get('/auth/me');
          if (response.user) {
            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: {
                user: response.user,
                token: token
              }
            });
            // Actualizar cache
            localStorage.setItem('user_data', JSON.stringify(response.user));
          }
        } catch (error) {
          // Token inválido, limpiar
          logout();
        }
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOAD_USER,
          payload: null
        });
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      dispatch({
        type: AUTH_ACTIONS.LOAD_USER,
        payload: null
      });
    }
  };

  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });
      
      const response = await apiService.post('/auth/login', credentials);
      
      if (response.token && response.user) {
        // Guardar en localStorage
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('user_data', JSON.stringify(response.user));
        
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: response.user,
            token: response.token
          }
        });
        
        return response;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Error de inicio de sesión';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_ERROR,
        payload: errorMessage
      });
      throw new Error(errorMessage);
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });
      
      const response = await apiService.post('/auth/register', userData);
      
      if (response.token && response.user) {
        // Guardar en localStorage
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('user_data', JSON.stringify(response.user));
        
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: response.user,
            token: response.token
          }
        });
        
        return response;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Error de registro';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_ERROR,
        payload: errorMessage
      });
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    // Limpiar localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Verificar si el usuario tiene un rol específico
  const hasRole = (role) => {
    return state.user?.rol === role;
  };

  // Verificar si el usuario es investigador
  const isResearcher = () => {
    return hasRole('investigador');
  };

  // Verificar si el usuario es invitado
  const isGuest = () => {
    return hasRole('invitado');
  };

  const value = {
    // Estado
    ...state,
    
    // Acciones
    login,
    register,
    logout,
    checkAuth,
    clearError,
    
    // Utilidades
    hasRole,
    isResearcher,
    isGuest
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;