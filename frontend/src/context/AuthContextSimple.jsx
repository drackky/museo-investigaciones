import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      try {
        const data = await apiService.auth.me();
        if (data && data.user) {
          setUser(data.user);
          localStorage.setItem('user_data', JSON.stringify(data.user));
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user_data');
        }
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setIsLoading(true);
      
      // Usar apiService que tiene configuración de CORS y timeouts
      console.log('Intentando login con API...', credentials);
      const data = await apiService.auth.login(credentials);
      
      console.log('Respuesta del API:', data);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      console.error('Error en login:', error);
      throw new Error(error.response?.data?.error || error.message || 'Error de conexión al servidor. Verifica que los servicios estén funcionando.');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      
      // Usar apiService que tiene configuración de CORS
      const data = await apiService.auth.register(userData);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      console.error('Error en registro:', error);
      throw new Error(error.response?.data?.error || error.message || 'Error de conexión al servidor. Verifica que los servicios estén funcionando.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_data');
    setUser(null);
    setIsAuthenticated(false);
  };

  const isResearcher = () => {
    return user?.tipo === 'investigador' || user?.rol === 'investigador';
  };

  const isGuest = () => {
    return user?.tipo === 'invitado';
  };

  const hasRole = (role) => {
    return user?.tipo === role;
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    register,
    logout,
    isResearcher,
    isGuest,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};