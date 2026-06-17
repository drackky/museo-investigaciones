import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';

const Header = () => {
  const { isAuthenticated, user, logout, isResearcher } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Cerrar menú cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar menú cuando cambie la ruta
  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsUserMenuOpen(false);
  };

  const getUserInitial = () => {
    if (!user) return '?';
    return user.nombre?.charAt(0)?.toUpperCase() || 
           user.name?.charAt(0)?.toUpperCase() || 
           user.email?.charAt(0)?.toUpperCase() || '?';
  };

  const getUserDisplayName = () => {
    return user?.nombre || user?.name || user?.email?.split('@')[0] || 'Usuario';
  };

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="app-header">
      <div className="header-container">
        <Link to="/" className="app-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2M12 4.14L20 8.35V10C20 15.55 16.92 19.54 12 20.89C7.08 19.54 4 15.55 4 10V8.35L12 4.14Z"/>
          </svg>
          <span>Museo de Investigaciones</span>
        </Link>
        
        <nav className="main-nav">
          <ul className="nav-list">
            <li className="nav-item">
              <Link 
                to="/docs" 
                className={`nav-link ${isActivePath('/docs') ? 'active' : ''}`}
              >
                {isAuthenticated && isResearcher() ? 'Mis Documentos' : 'Documentos'}
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                to="/cols" 
                className={`nav-link ${isActivePath('/cols') ? 'active' : ''}`}
              >
                {isAuthenticated && isResearcher() ? 'Mis Colecciones' : 'Colecciones'}
              </Link>
            </li>
            {isAuthenticated && isResearcher() && (
              <>
                <li className="nav-item">
                  <Link 
                    to="/research" 
                    className={`nav-link ${isActivePath('/research') ? 'active' : ''}`}
                  >
                    Investigaciones
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    to="/profile" 
                    className={`nav-link ${isActivePath('/profile') ? 'active' : ''}`}
                  >
                    Perfil
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        
        <div className="header-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="btn btn-secondary">
                Iniciar Sesión
              </Link>
              <Link to="/register" className="btn btn-primary">
                Registrarse
              </Link>
            </>
          ) : (
            <div 
              className={`user-menu ${isUserMenuOpen ? 'active' : ''}`}
              ref={userMenuRef}
            >
              <button 
                className="user-menu-trigger"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                <div className="user-avatar">
                  <span className="user-initial">{getUserInitial()}</span>
                </div>
                <span className="user-name">{getUserDisplayName()}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7,10L12,15L17,10H7Z"/>
                </svg>
              </button>
              
              <div className="user-menu-dropdown">
                <Link to="/profile" className="dropdown-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                  </svg>
                  Mi Perfil
                </Link>
                <Link to="/docs" className="dropdown-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                  Mis Documentos
                </Link>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16,17V14H9V10H16V7L21,12L16,17M14,2A2,2 0 0,1 16,4V6H14V4H5V20H14V18H16V20A2,2 0 0,1 14,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2H14Z"/>
                  </svg>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;