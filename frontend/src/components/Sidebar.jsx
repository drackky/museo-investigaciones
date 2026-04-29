import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';

const Sidebar = () => {
  const { isAuthenticated, isResearcher } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const navigationItems = [
    {
      path: '/',
      label: 'Inicio',
      icon: (
        <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/>
      ),
      public: true
    },
    {
      path: '/docs',
      label: 'Documentos',
      icon: (
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
      ),
      public: true
    },
    {
      path: '/cols',
      label: 'Colecciones',
      icon: (
        <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
      ),
      public: true
    },
    {
      path: '/research',
      label: 'Investigaciones',
      icon: (
        <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19Z"/>
      ),
      requireAuth: true
    },
    {
      path: '/profile',
      label: 'Mi Perfil',
      icon: (
        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
      ),
      requireAuth: true
    }
  ];

  // Filtrar elementos según autenticación
  const visibleItems = navigationItems.filter(item => {
    if (item.public) return true;
    if (item.requireAuth) return isAuthenticated;
    if (item.researcherOnly) return isAuthenticated && isResearcher();
    return false;
  });

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button 
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            {isCollapsed ? (
              <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
            ) : (
              <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
            )}
          </svg>
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {visibleItems.map((item) => (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                className={`nav-link ${isActivePath(item.path) ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  {item.icon}
                </svg>
                <span className="nav-text">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Sección de acciones rápidas para investigadores */}
      {isAuthenticated && isResearcher() && (
        <div className="sidebar-actions">
          <div className="action-section">
            {!isCollapsed && <span className="section-title">Acciones Rápidas</span>}
            <Link to="/docs/new" className="action-item" title="Subir Documento">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,11L16,15H13V19H11V15H8L12,11Z"/>
              </svg>
              <span className="action-text">Subir Documento</span>
            </Link>
            <Link to="/cols/new" className="action-item" title="Nueva Colección">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
              </svg>
              <span className="action-text">Nueva Colección</span>
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;