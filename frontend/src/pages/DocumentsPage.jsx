import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import { LoadingInline, SkeletonList } from '../components/Loading';

import { formatDate, formatFileSize, debounce } from '../utils';

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('fecha_desc');
  const [showOnlyMine, setShowOnlyMine] = useState(true); // Por defecto mostrar solo los propios
  
  const { isAuthenticated, isResearcher, user } = useAuth();
  const { error, success } = useNotifications();

  // Cargar documentos al montar el componente
  useEffect(() => {
    if (isAuthenticated && isResearcher()) {
      loadDocuments(showOnlyMine);
    } else {
      loadDocuments(false);
    }
  }, [showOnlyMine, isAuthenticated]);

  // Filtrar y ordenar documentos cuando cambien los filtros
  useEffect(() => {
    filterAndSortDocuments();
  }, [documents, searchTerm, selectedCategory, sortBy]);

  const loadDocuments = async (misDocumentos = false) => {
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (misDocumentos) {
        // Para documentos propios, obtener el user_id del token
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          params.append('autor_id', payload.user_id);
          params.append('publico_solo', 'false'); // Incluir documentos privados del usuario
        }
      } else {
        params.append('publico_solo', 'true'); // Solo documentos públicos
      }
      
      // Intentar primero con API Gateway
      let url = `http://localhost:5000/api/v1/documents${params.toString() ? '?' + params.toString() : ''}`;
      let response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      // Si el API Gateway falla, intentar conexión directa al servicio
      if (!response.ok) {
        console.warn('API Gateway falló, intentando conexión directa al servicio de documentos');
        url = `http://localhost:5002/api/v1/documents${params.toString() ? '?' + params.toString() : ''}`;
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        console.log('Documentos recibidos del backend:', data.documents?.length || 0);
        setDocuments(data.documents || []);
      } else {
        console.error('Error en la respuesta:', response.status);
        setDocuments([]);
      }
    } catch (err) {
      console.error('Error cargando documentos:', err);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortDocuments = () => {
    let filtered = [...documents];

    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.titulo?.toLowerCase().includes(term) ||
        doc.descripcion?.toLowerCase().includes(term) ||
        doc.abstract?.toLowerCase().includes(term) ||
        doc.autor?.toLowerCase().includes(term) ||
        doc.institucion?.toLowerCase().includes(term) ||
        doc.tags?.some(tag => tag.nombre?.toLowerCase().includes(term))
      );
    }

    // Filtrar por categoría (tipo MIME)
    if (selectedCategory) {
      filtered = filtered.filter(doc => {
        if (!doc.tipo_mime) return false;
        if (selectedCategory === 'PDF') return doc.tipo_mime.includes('pdf');
        if (selectedCategory === 'DOC') return doc.tipo_mime.includes('word') || doc.tipo_mime.includes('doc');
        if (selectedCategory === 'TXT') return doc.tipo_mime.includes('text');
        return doc.tipo_mime === selectedCategory;
      });
    }

    // Ordenar
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'titulo_asc':
          return (a.titulo || '').localeCompare(b.titulo || '');
        case 'titulo_desc':
          return (b.titulo || '').localeCompare(a.titulo || '');
        case 'fecha_asc':
          return new Date(a.created_at || a.fecha_publicacion || 0) - new Date(b.created_at || b.fecha_publicacion || 0);
        case 'fecha_desc':
        default:
          return new Date(b.created_at || b.fecha_publicacion || 0) - new Date(a.created_at || a.fecha_publicacion || 0);
      }
    });

    setFilteredDocuments(filtered);
  };

  // Debounced search
  const debouncedSearch = debounce((term) => {
    setSearchTerm(term);
  }, 300);

  const handleSearch = (e) => {
    debouncedSearch(e.target.value);
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este documento?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        success('Documento eliminado exitosamente');
        loadDocuments(showOnlyMine); // Recargar la lista
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error eliminando documento:', err.message);
      error('Error al eliminar el documento. Verifica la conexión al servidor.');
    }
  };

  const getUniqueCategories = () => {
    // Obtener tipos de documentos únicos basados en tipo_mime
    const types = new Set();
    documents.forEach(doc => {
      if (doc.tipo_mime) {
        if (doc.tipo_mime.includes('pdf')) types.add('PDF');
        else if (doc.tipo_mime.includes('word') || doc.tipo_mime.includes('doc')) types.add('DOC');
        else if (doc.tipo_mime.includes('text')) types.add('TXT');
      }
    });
    return Array.from(types);
  };

  // Obtener todas las etiquetas únicas
  const getAllTags = () => {
    const tagsSet = new Set();
    documents.forEach(doc => {
      if (doc.tags && Array.isArray(doc.tags)) {
        doc.tags.forEach(tag => {
          if (tag.nombre) tagsSet.add(tag.nombre);
        });
      }
    });
    return tagsSet.size;
  };

  if (isLoading) {
    return (
      <div className="documents-page">
        <div className="page-header">
          <h1>Documentos</h1>
        </div>
        <SkeletonList items={6} linesPerItem={3} />
      </div>
    );
  }

  return (
    <div className="documents-page">
      {/* Mensaje de bienvenida para invitados */}
      {isAuthenticated && !isResearcher() && (
        <div className="guest-welcome-banner">
          <div className="welcome-content">
            <div className="welcome-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </div>
            <div className="welcome-text">
              <h3>Acceso como Invitado</h3>
              <p>Puedes consultar los documentos compartidos por investigadores, descargarlos para lectura y comentar. 
                 <strong>Para subir documentos, necesitas permisos de investigador.</strong></p>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div className="page-title-section">
          <h1>
            {isAuthenticated && isResearcher() 
              ? (showOnlyMine ? 'Mis Documentos' : 'Todos los Documentos')
              : 'Biblioteca Digital'
            }
          </h1>
          <p className="page-subtitle">
            {isAuthenticated && isResearcher() 
              ? `${filteredDocuments.length} documento${filteredDocuments.length !== 1 ? 's' : ''} subido${filteredDocuments.length !== 1 ? 's' : ''}`
              : `${filteredDocuments.length} documento${filteredDocuments.length !== 1 ? 's' : ''} disponible${filteredDocuments.length !== 1 ? 's' : ''} para consulta`
            }
            {documents.length > filteredDocuments.length && (
              <span className="filter-info"> de {documents.length} total{documents.length !== 1 ? 'es' : ''}</span>
            )}
          </p>
        </div>
        
        <div className="page-actions">
          {isAuthenticated && isResearcher() && (
            <>
              <Link to="/docs/new" className="btn btn-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                </svg>
                Nuevo Documento
              </Link>
              <Link to="/cols" className="btn btn-outline">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
                </svg>
                Mis Colecciones
              </Link>
            </>
          )}
          {(!isAuthenticated || !isResearcher()) && (
            <div className="guest-actions">
              {/* <Link to="/cols" className="btn btn-outline">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
                </svg>
                Explorar Colecciones
              </Link> */}
              {!isAuthenticated && (
                <Link to="/register" className="btn btn-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                  </svg>
                  Crear Cuenta
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="documents-filters">
        {isAuthenticated && isResearcher() && (
          <div className="filter-toggle">
            <button
              className={`toggle-btn ${showOnlyMine ? 'active' : ''}`}
              onClick={() => setShowOnlyMine(true)}
            >
              Mis Documentos
            </button>
            <button
              className={`toggle-btn ${!showOnlyMine ? 'active' : ''}`}
              onClick={() => setShowOnlyMine(false)}
            >
              Todos los Documentos
            </button>
          </div>
        )}
        
        <input
          type="text"
          placeholder="Buscar documentos por título, autor o etiquetas..."
          onChange={handleSearch}
          className="search-input"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">Todas las categorías</option>
          {getUniqueCategories().map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
        >
          <option value="fecha_desc">Más recientes</option>
          <option value="fecha_asc">Más antiguos</option>
          <option value="titulo_asc">Título A-Z</option>
          <option value="titulo_desc">Título Z-A</option>
        </select>
      </div>

      {/* Estadísticas rápidas */}
      {documents.length > 0 && (
        <div className="stats-bar">
          <div className="quick-stats">
            <div className="quick-stat">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">{documents.length}</div>
                <div className="stat-label">Total Documentos</div>
              </div>
            </div>
            
            <div className="quick-stat">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">{getUniqueCategories().length}</div>
                <div className="stat-label">Categorías</div>
              </div>
            </div>
            
            <div className="quick-stat">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">{new Set(documents.map(d => d.autor).filter(Boolean)).size}</div>
                <div className="stat-label">Autores</div>
              </div>
            </div>
            
            <div className="quick-stat">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.8,21L7.4,14L2,9.2L9.2,8.6L12,2L14.8,8.6L22,9.2L18.8,12H18C17.3,12 16.6,12.1 15.9,12.4L18.1,10.5L13.7,10.1L12,6.1L10.3,10.1L5.9,10.5L9.2,13.4L8.2,17.7L12,15.4L12.5,15.7C12.3,16.2 12.1,16.8 12.1,17.3L5.8,21M17,14V17H14V19H17V22H19V19H22V17H19V14H17Z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">{getAllTags()}</div>
                <div className="stat-label">Etiquetas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="documents-container">
        {filteredDocuments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
          <h3>No se encontraron documentos</h3>
          <p>
            {searchTerm || selectedCategory 
              ? 'Intenta ajustar los filtros de búsqueda.'
              : 'Aún no hay documentos disponibles.'
            }
          </p>
          {isAuthenticated && isResearcher() && !searchTerm && !selectedCategory && (
            <Link to="/docs/new" className="btn btn-primary">
              Subir el primer documento
            </Link>
          )}
        </div>
      ) : (
        <div className="documents-grid">
          {filteredDocuments.map((document) => (
            <div key={document.id} className="document-card">
              <div className="document-header">
                <div className="document-type-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                </div>
                <div className="document-meta">
                  {document.tipo_mime && (
                    <span className="document-category">
                      {document.tipo_mime.includes('pdf') ? 'PDF' : 
                       document.tipo_mime.includes('word') ? 'DOC' : 
                       document.tipo_mime.includes('text') ? 'TXT' : 'Documento'}
                    </span>
                  )}
                  <span className="document-date">{formatDate(document.created_at || document.fecha_publicacion)}</span>
                </div>
              </div>

              <div className="document-content">
                <h3 className="document-title">{document.titulo}</h3>
                <p className="document-description">
                  {document.descripcion?.substring(0, 150) || document.abstract?.substring(0, 150) || 'Sin descripción'}
                  {(document.descripcion?.length > 150 || document.abstract?.length > 150) ? '...' : ''}
                </p>
                
                <div className="document-details">
                  {document.autor && (
                    <span className="document-author">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                      </svg>
                      {document.autor}
                    </span>
                  )}
                  {document.tamaño_archivo && (
                    <span className="document-size">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                      {formatFileSize(document.tamaño_archivo)}
                    </span>
                  )}
                  {document.visualizaciones !== undefined && (
                    <span className="document-views">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                      </svg>
                      {document.visualizaciones}
                    </span>
                  )}
                </div>

                {document.tags && document.tags.length > 0 && (
                  <div className="document-tags">
                    {document.tags.slice(0, 3).map((tag) => (
                      <span key={tag.id} className="tag" style={{ backgroundColor: tag.color || '#8b5cf6' }}>
                        {tag.nombre}
                      </span>
                    ))}
                    {document.tags.length > 3 && (
                      <span className="tag tag-more">
                        +{document.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="document-actions">
                <Link
                  to={`/docs/${document.id}`}
                  className="btn btn-outline btn-small"
                >
                  Ver Detalles
                </Link>
                
                {isAuthenticated && isResearcher() && document.autor_id === user?.user_id && (
                  <>
                    <Link
                      to={`/docs/${document.id}/edit`}
                      className="btn btn-secondary btn-small"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(document.id)}
                      className="btn btn-danger btn-small"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;