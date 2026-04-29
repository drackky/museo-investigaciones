import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { ROLES } from '../utils';

const AuthGuard = ({ children, requireAuth = false, requiredRole = null, fallback = null }) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>Verificando autenticación...</p>
      </div>
    );
  }

  // Si se requiere autenticación y no está autenticado
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se requiere un rol específico y no lo tiene
  if (requiredRole && (!isAuthenticated || !hasRole(requiredRole))) {
    if (fallback) {
      return fallback;
    }
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta sección.</p>
          <div className="access-denied-actions">
            <Navigate to="/" replace />
          </div>
        </div>
      </div>
    );
  }

  return children;
};

// Componente específico para investigadores
export const ResearcherGuard = ({ children, fallback }) => (
  <AuthGuard 
    requireAuth={true} 
    requiredRole={ROLES.INVESTIGADOR} 
    fallback={fallback}
  >
    {children}
  </AuthGuard>
);

// Componente específico para usuarios autenticados
export const PrivateRoute = ({ children }) => (
  <AuthGuard requireAuth={true}>
    {children}
  </AuthGuard>
);

// Componente específico para usuarios no autenticados
export const PublicRoute = ({ children, redirectTo = '/' }) => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return children;
};

export default AuthGuard;