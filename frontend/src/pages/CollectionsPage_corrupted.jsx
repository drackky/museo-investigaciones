import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';

const CollectionsPage = () => {
  const [collections, setCollections] = useState([]);
  const [filteredCollections, setFilteredCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(true); // Por defecto mostrar solo las propias
  
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
      
      // Intentar cargar desde API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (misColecciones && token) {
        params.append('mis_colecciones', 'true');
      }
      
      // Intentar primero con API Gateway
      let url = `http://localhost:5000/api/v1/collections${params.toString() ? '?' + params.toString() : ''}`;
      let response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Si el API Gateway falla, intentar conexión directa al servicio
      if (!response.ok) {
        console.warn('API Gateway falló, intentando conexión directa al servicio de colecciones');
        url = `http://localhost:5003/api/v1/collections${params.toString() ? '?' + params.toString() : ''}`;
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
        setIsLoading(false);
        return;
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error cargando colecciones:', err.message);
      if (err.name !== 'AbortError') {
        error('No se pudieron cargar las colecciones. Verifica la conexión al servidor.');
      }
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
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${collectionId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const newLikedCollections = new Set(likedCollections);
        if (isCurrentlyLiked) {
          newLikedCollections.delete(collectionId);
        } else {
          newLikedCollections.add(collectionId);
        }
        setLikedCollections(newLikedCollections);
        success(isCurrentlyLiked ? 'Me gusta eliminado' : 'Me gusta agregado');
      }
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
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${collectionId}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const newFavoritedCollections = new Set(favoritedCollections);
        if (isCurrentlyFavorited) {
          newFavoritedCollections.delete(collectionId);
        } else {
          newFavoritedCollections.add(collectionId);
        }
        setFavoritedCollections(newFavoritedCollections);
        success(isCurrentlyFavorited ? 'Eliminado de favoritos' : 'Añadido a favoritos');
      }
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
        collection.descripcion?.toLowerCase().includes(term) ||
        collection.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Filtrar por tipo
    if (selectedType) {
      filtered = filtered.filter(collection => collection.tipo === selectedType);
    }

    setFilteredCollections(filtered);
  };

  if (!isAuthenticated) {
    return (
      <div className="collections-page">
        <div className="page-header">
          <div className="page-title-section">
            <h1>Colecciones Temáticas</h1>
            <p className="page-subtitle">
              Explora {filteredCollections.length} colección{filteredCollections.length !== 1 ? 'es' : ''} disponible{filteredCollections.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

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
                 <strong>Para crear tu propio contenido, solicita permisos de investigador.</strong></p>
            </div>
          </div>
        </div>
      </div>
    );
  }
        fecha_creacion: new Date(Date.now() - 86400000).toISOString(),
        documentos_count: 28,
        imagen: null,
        tags: ['mapas', 'navegación', 'américa', 'exploración'],
        autor_principal: 'Cartógrafos Reales',
        periodo: 'Siglos XV-XVIII',
        acceso: 'restringido',
        likesCount: 35,
        favoritesCount: 22,
        rating: 4.8,
        viewsCount: 189
      },
      {
        id: 3,
        nombre: 'Correspondencia Diplomática',
        descripcion: 'Archivo de correspondencia oficial entre cortes europeas durante los siglos XVI-XVIII. Incluye tratados, acuerdos comerciales y comunicaciones diplomáticas.',
        tipo: 'Correspondencia',
        fecha_creacion: new Date(Date.now() - 172800000).toISOString(),
        documentos_count: 156,
        imagen: null,
        tags: ['diplomacia', 'cartas', 'tratados', 'política'],
        autor_principal: 'Embajadores y Cancilleres',
        periodo: 'Siglos XVI-XVIII',
        acceso: 'público',
        likesCount: 42,
        favoritesCount: 28,
        rating: 4.5,
        viewsCount: 312
      },
      {
        id: 4,
        nombre: 'Arquitectura Renacentista',
        descripcion: 'Planos, diseños y tratados sobre arquitectura del Renacimiento español. Incluye proyectos de catedrales, palacios y edificios civiles.',
        tipo: 'Planos y Diseños',
        fecha_creacion: new Date(Date.now() - 259200000).toISOString(),
        documentos_count: 73,
        imagen: null,
        tags: ['arquitectura', 'renacimiento', 'planos', 'construcción'],
        autor_principal: 'Juan de Herrera y otros',
        periodo: 'Siglos XV-XVII',
        acceso: 'público',
        likesCount: 31,
        favoritesCount: 18,
        rating: 4.6,
        viewsCount: 156
      },
      {
        id: 5,
        nombre: 'Literatura del Siglo de Oro',
        descripcion: 'Primeras ediciones y manuscritos de obras literarias del Siglo de Oro español. Incluye teatro, poesía y narrativa.',
        tipo: 'Literatura',
        fecha_creacion: new Date(Date.now() - 345600000).toISOString(),
        documentos_count: 89,
        imagen: null,
        tags: ['literatura', 'siglo de oro', 'teatro', 'poesía'],
        autor_principal: 'Lope de Vega, Calderón y otros',
        periodo: 'Siglos XVI-XVII',
        acceso: 'público',
        likesCount: 48,
        favoritesCount: 33,
        rating: 4.9,
        viewsCount: 278
      },
      {
        id: 6,
        nombre: 'Códices Prehispánicos',
        descripcion: 'Documentos y códices de culturas precolombinas. Representaciones pictográficas y textos en lenguas indígenas.',
        tipo: 'Códices',
        fecha_creacion: new Date(Date.now() - 432000000).toISOString(),
        documentos_count: 15,
        imagen: null,
        tags: ['prehispánico', 'códices', 'indígena', 'pictografía'],
        autor_principal: 'Culturas Mesoamericanas',
        periodo: 'Siglos I-XVI',
        acceso: 'restringido',
        likesCount: 39,
        favoritesCount: 25,
        rating: 4.8,
        viewsCount: 167
      }
    ];
    
    setCollections(mockCollections);
    setIsLoading(false);
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
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${collectionId}/like`, {
        method: isCurrentlyLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const newLikedSet = new Set(likedCollections);
        if (isCurrentlyLiked) {
          newLikedSet.delete(collectionId);
        } else {
          newLikedSet.add(collectionId);
        }
        setLikedCollections(newLikedSet);
        
        // Actualizar contador en la colección
        setCollections(prev => prev.map(col => 
          col.id === collectionId 
            ? { ...col, likesCount: (col.likesCount || 0) + (isCurrentlyLiked ? -1 : 1) }
            : col
        ));
        
        success(isCurrentlyLiked ? 'Me gusta eliminado' : 'Me gusta agregado');
      }
    } catch (err) {
      // Modo demo
      const newLikedSet = new Set(likedCollections);
      if (isCurrentlyLiked) {
        newLikedSet.delete(collectionId);
      } else {
        newLikedSet.add(collectionId);
      }
      setLikedCollections(newLikedSet);
      
      setCollections(prev => prev.map(col => 
        col.id === collectionId 
          ? { ...col, likesCount: (col.likesCount || 0) + (isCurrentlyLiked ? -1 : 1) }
          : col
      ));
      
      success(isCurrentlyLiked ? 'Me gusta eliminado (demo)' : 'Me gusta agregado (demo)');
    }
  };

  const handleFavorite = async (collectionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      error('Debes iniciar sesión para agregar a favoritos');
      return;
    }

    const isCurrentlyFavorited = favoritedCollections.has(collectionId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${collectionId}/favorite`, {
        method: isCurrentlyFavorited ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const newFavoritedSet = new Set(favoritedCollections);
        if (isCurrentlyFavorited) {
          newFavoritedSet.delete(collectionId);
        } else {
          newFavoritedSet.add(collectionId);
        }
        setFavoritedCollections(newFavoritedSet);
        
        setCollections(prev => prev.map(col => 
          col.id === collectionId 
            ? { ...col, favoritesCount: (col.favoritesCount || 0) + (isCurrentlyFavorited ? -1 : 1) }
            : col
        ));
        
        success(isCurrentlyFavorited ? 'Eliminado de favoritos' : 'Agregado a favoritos');
      }
    } catch (err) {
      // Modo demo
      const newFavoritedSet = new Set(favoritedCollections);
      if (isCurrentlyFavorited) {
        newFavoritedSet.delete(collectionId);
      } else {
        newFavoritedSet.add(collectionId);
      }
      setFavoritedCollections(newFavoritedSet);
      
      setCollections(prev => prev.map(col => 
        col.id === collectionId 
          ? { ...col, favoritesCount: (col.favoritesCount || 0) + (isCurrentlyFavorited ? -1 : 1) }
          : col
      ));
      
      success(isCurrentlyFavorited ? 'Eliminado de favoritos (demo)' : 'Agregado a favoritos (demo)');
    }
  };

  const filterCollections = () => {
    let filtered = [...collections];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(collection => 
        collection.nombre?.toLowerCase().includes(term) ||
        collection.descripcion?.toLowerCase().includes(term) ||
        collection.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    if (selectedType) {
      filtered = filtered.filter(collection => collection.tipo === selectedType);
    }

    setFilteredCollections(filtered);
  };

  const getUniqueTypes = () => {
    const types = collections.map(col => col.tipo).filter(Boolean);
    return [...new Set(types)];
  };

  const getAccessBadgeClass = (acceso) => {
    switch(acceso) {
      case 'público': return 'badge-success';
      case 'restringido': return 'badge-warning';
      case 'privado': return 'badge-danger';
      default: return 'badge-secondary';
    }
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
          <div className="loading-text">Cargando colecciones...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="collections-page">
      {/* Mensaje de bienvenida para invitados */}
      {isAuthenticated && !isResearcher() && (
        <div className="guest-welcome-banner">
          <div className="welcome-content">
            <div className="welcome-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
              </svg>
            </div>
            <div className="welcome-text">
              <h3>¡Bienvenido como Invitado!</h3>
              <p>Puedes explorar las colecciones creadas por investigadores, dar me gusta, añadir a favoritos y comentar. 
                 <strong>Para crear tu propio contenido, solicita permisos de investigador.</strong></p>
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
          placeholder="Buscar colecciones por nombre, descripción o etiquetas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los tipos</option>
          {getUniqueTypes().map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="documents-container">
        {filteredCollections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
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
            {filteredCollections.map((collection) => (
              <div key={collection.id} className="collection-card">
                <div className="collection-header">
                  <div className="collection-type-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
                    </svg>
                  </div>
                  <div className="collection-meta">
                    <span className={`access-badge ${getAccessBadgeClass(collection.acceso)}`}>
                      {collection.acceso}
                    </span>
                    <span className="collection-type">{collection.tipo}</span>
                  </div>
                </div>

                <div className="collection-content">
                  <h3 className="collection-title">{collection.nombre}</h3>
                  <p className="collection-description">
                    {collection.descripcion?.substring(0, 180)}
                    {collection.descripcion?.length > 180 ? '...' : ''}
                  </p>
                  
                  <div className="collection-stats">
                    <div className="stat-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                      <span>{collection.documentos_count} documentos</span>
                    </div>
                    <div className="stat-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                      </svg>
                      <span>{collection.autor_principal}</span>
                    </div>
                    <div className="stat-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                      </svg>
                      <span>{collection.periodo}</span>
                    </div>
                  </div>

                  {collection.tags && collection.tags.length > 0 && (
                    <div className="document-tags">
                      {collection.tags.slice(0, 4).map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                      {collection.tags.length > 4 && (
                        <span className="tag tag-more">
                          +{collection.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="document-actions">
                  <div className="social-actions-card">
                    <button
                      onClick={(e) => handleLike(collection.id, e)}
                      className={`btn-icon ${likedCollections.has(collection.id) ? 'liked' : ''}`}
                      title="Me gusta"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.04L12,21.35Z"/>
                      </svg>
                      <span>{collection.likesCount || 0}</span>
                    </button>

                    <button
                      onClick={(e) => handleFavorite(collection.id, e)}
                      className={`btn-icon ${favoritedCollections.has(collection.id) ? 'favorited' : ''}`}
                      title="Favorito"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z"/>
                      </svg>
                      <span>{collection.favoritesCount || 0}</span>
                    </button>

                    <div className="rating-mini">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.46,13.97L5.82,21L12,17.27Z"/>
                      </svg>
                      <span>{collection.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>

                  <div className="main-actions">
                    <Link
                      to={`/cols/${collection.id}`}
                      className="btn btn-outline btn-small"
                    >
                      Ver Colección
                    </Link>
                    
                    <Link
                      to={`/cols/${collection.id}/docs`}
                      className="btn btn-secondary btn-small"
                    >
                      Explorar ({collection.documentos_count})
                    </Link>
                    
                    {isAuthenticated && isResearcher() && (
                      <Link
                        to={`/cols/${collection.id}/edit`}
                        className="btn btn-primary btn-small"
                      >
                        Gestionar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionsPage;