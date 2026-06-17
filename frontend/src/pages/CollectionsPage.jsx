import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import { apiService } from '../services/apiService';

const CollectionsPage = () => {
  const [collections, setCollections] = useState([]);
  const [filteredCollections, setFilteredCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  
  // Estados para interacciones sociales
  const [likedCollections, setLikedCollections] = useState(new Set());
  const [favoritedCollections, setFavoritedCollections] = useState(new Set());
  
  const { isAuthenticated, isResearcher } = useAuth();
  const { error, success } = useNotifications();

  useEffect(() => {
    if (isAuthenticated && isResearcher()) {
      loadCollections(showOnlyMine);
    } else {
      loadCollections(false);
    }
  }, [showOnlyMine, isAuthenticated]);

  useEffect(() => {
    filterCollections();
  }, [collections, searchTerm, selectedType, showOnlyMine]);

  const loadCollections = async (misColecciones = false) => {
    try {
      setIsLoading(true);
      
      const params = {};
      if (misColecciones) {
        params.mis_colecciones = 'true';
      }
      
      const data = await apiService.collections.getAll(params);
      setCollections(data.collections || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error cargando colecciones:', err.message);
      error('No se pudieron cargar las colecciones. Verifica la conexión al servidor.');
      setCollections([]);
      setIsLoading(false);
    }
  };

  const handleLike = async (collectionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      error('Debes iniciar sesión para dar me gusta');
      return;
    }

    const isCurrentlyLiked = likedCollections.has(collectionId);
    
    try {
      await apiService.collections.toggleLike(collectionId);
      const newLikedCollections = new Set(likedCollections);
      if (isCurrentlyLiked) {
        newLikedCollections.delete(collectionId);
      } else {
        newLikedCollections.add(collectionId);
      }
      setLikedCollections(newLikedCollections);
      success(isCurrentlyLiked ? 'Me gusta eliminado' : 'Me gusta agregado');
    } catch (err) {
      console.error('Error en like:', err);
      error('Error al procesar me gusta');
    }
  };

  const handleFavorite = async (collectionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      error('Debes iniciar sesión para añadir a favoritos');
      return;
    }

    const isCurrentlyFavorited = favoritedCollections.has(collectionId);
    
    try {
      await apiService.collections.toggleFavorite(collectionId);
      const newFavoritedCollections = new Set(favoritedCollections);
      if (isCurrentlyFavorited) {
        newFavoritedCollections.delete(collectionId);
      } else {
        newFavoritedCollections.add(collectionId);
      }
      setFavoritedCollections(newFavoritedCollections);
      success(isCurrentlyFavorited ? 'Eliminado de favoritos' : 'Añadido a favoritos');
    } catch (err) {
      console.error('Error en favorito:', err);
      error('Error al procesar favorito');
    }
  };

  const filterCollections = () => {
    let filtered = [...collections];

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(collection =>
        collection.titulo?.toLowerCase().includes(term) ||
        collection.descripcion?.toLowerCase().includes(term)
      );
    }

    // Filtrar por tipo
    if (selectedType) {
      filtered = filtered.filter(collection => collection.tipo === selectedType);
    }

    setFilteredCollections(filtered);
  };

  if (isLoading) {
    return (
      <div className="collections-page">
        <div className="page-header">
          <div className="page-title-section">
            <h1>Colecciones Temáticas</h1>
          </div>
        </div>
        <div className="loading-page">
          <div className="loading-spinner"></div>
          <p>Cargando colecciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collections-page">
      <div className="page-container">
        {!isAuthenticated && (
          <div className="guest-welcome">
            <div className="guest-card">
              <div className="guest-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                </svg>
              </div>
              <div className="welcome-text">
                <h3>¡Bienvenido como Invitado!</h3>
                <p>Puedes explorar las colecciones creadas por investigadores, dar me gusta, añadir a favoritos y comentar. 
                   <strong> Para crear tu propio contenido, solicita permisos de investigador.</strong></p>
              </div>
            </div>
          </div>
        )}

        <div className="page-header">
          <div className="page-title-section">
            <h1>
              {isAuthenticated && isResearcher() 
                ? (showOnlyMine ? 'Mis Colecciones' : 'Todas las Colecciones')
                : 'Colecciones Temáticas'
              }
            </h1>
            <p className="page-subtitle">
              {isAuthenticated && isResearcher() 
                ? `${filteredCollections.length} colección${filteredCollections.length !== 1 ? 'es' : ''} creada${filteredCollections.length !== 1 ? 's' : ''}`
                : `${filteredCollections.length} colección${filteredCollections.length !== 1 ? 'es' : ''} disponible${filteredCollections.length !== 1 ? 's' : ''} para explorar`
              }
            </p>
          </div>
          
          {isAuthenticated && isResearcher() && (
            <div className="page-actions">
              <Link to="/cols/new" className="btn btn-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
                Nueva Colección
              </Link>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="documents-filters">
          {isAuthenticated && isResearcher() && (
            <div className="filter-toggle">
              <button
                className={`toggle-btn ${showOnlyMine ? 'active' : ''}`}
                onClick={() => setShowOnlyMine(true)}
              >
                Mis Colecciones
              </button>
              <button
                className={`toggle-btn ${!showOnlyMine ? 'active' : ''}`}
                onClick={() => setShowOnlyMine(false)}
              >
                Todas las Colecciones
              </button>
            </div>
          )}
          
          <input
            type="text"
            placeholder="Buscar colecciones por nombre, descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Lista de colecciones */}
        {filteredCollections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19Z"/>
              </svg>
            </div>
            <h3>No se encontraron colecciones</h3>
            <p>
              {searchTerm || selectedType 
                ? 'Intenta ajustar los filtros de búsqueda.'
                : 'Aún no hay colecciones disponibles.'
              }
            </p>
            {isAuthenticated && isResearcher() && !searchTerm && !selectedType && (
              <Link to="/cols/new" className="btn btn-primary">
                Crear primera colección
              </Link>
            )}
          </div>
        ) : (
          <div className="collections-grid">
            {filteredCollections.map((collection) => {
              // Construir URL completa de la imagen usando la ruta del API
              const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
              const imageUrl = collection.portada_path
                ? `${baseUrl}/collections/${collection.id}/portada`
                : null;
              
              return (
                <div key={collection.id} className="collection-card">
                  <div className="collection-header" style={{
                    backgroundImage: imageUrl
                      ? `linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.4) 100%), url("${imageUrl}")`
                      : 'linear-gradient(135deg, var(--blue-50) 0%, var(--blue-100) 50%, var(--blue-200) 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}>
                  <div className="collection-type-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19Z"/>
                    </svg>
                  </div>
                  <div className="collection-actions">
                    <button
                      onClick={(e) => handleLike(collection.id, e)}
                      className={`action-btn ${likedCollections.has(collection.id) ? 'active' : ''}`}
                      title="Me gusta"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.42 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.42 22,8.5C22,12.27 18.6,15.36 13.45,20.04L12,21.35Z"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleFavorite(collection.id, e)}
                      className={`action-btn ${favoritedCollections.has(collection.id) ? 'active' : ''}`}
                      title="Favorito"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.46,13.97L5.82,21L12,17.27Z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <Link to={`/cols/${collection.id}`} className="collection-content">
                  <h3 className="collection-title">{collection.titulo}</h3>
                  <p className="collection-description">{collection.descripcion}</p>
                  
                  <div className="collection-stats">
                    <span className="stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                      {collection.total_documentos || 0} docs
                    </span>
                    <span className="stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                      </svg>
                      {collection.visualizaciones || 0} vistas
                    </span>
                  </div>

                  <div className="collection-footer">
                    <span className="collection-date">
                      {new Date(collection.created_at).toLocaleDateString()}
                    </span>
                    <span className={`collection-visibility ${collection.is_publica ? 'public' : 'private'}`}>
                      {collection.is_publica ? 'Pública' : 'Privada'}
                    </span>
                  </div>
                </Link>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionsPage;