import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import { formatDate, formatFileSize, formatRelativeTime } from '../utils';

const DocumentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Estados para interacciones sociales
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [downloadsCount, setDownloadsCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Estados para comentarios
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showComments, setShowComments] = useState(true);
  const [commentsCount, setCommentsCount] = useState(0);
  
  const { isAuthenticated, isResearcher, user } = useAuth();
  const { error, success } = useNotifications();

  useEffect(() => {
    loadDocument();
    loadDocumentInteractions();
    loadComments();
    incrementViewCount();
  }, [id]);

const loadDocument = async () => {
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('token');
      
      // Intentar primero con API Gateway
      let response = await fetch(`http://localhost:5000/api/v1/documents/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      // Si el API Gateway falla, intentar conexión directa al servicio
      if (!response.ok) {
        console.warn('API Gateway falló, intentando conexión directa al servicio de documentos');
        response = await fetch(`http://localhost:5002/api/v1/documents/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        setDocument(data.document);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.error('Error cargando documento:', err.message);
    }

    // Usar documento demo
    console.log('Usando documento demo');
    const mockDocument = {
      id: parseInt(id),
      titulo: 'Manuscrito Medieval del Siglo XV',
      descripcion: `Este extraordinario manuscrito medieval representa una ventana única al pasado, 
        ofreciendo una perspectiva invaluable sobre las prácticas comerciales, sociales y culturales 
        del siglo XV. Descubierto en los archivos de la Catedral de León durante una restauración 
        en 1987, este documento ha sido cuidadosamente preservado y digitalizado para garantizar 
        su accesibilidad para futuras generaciones de investigadores.
        
        El manuscrito contiene referencias detalladas a rutas comerciales medievales, sistemas 
        monetarios de la época, y regulaciones gremiales que gobernaban el comercio textil en 
        la región de Castilla y León. Particularmente notable es la sección que describe los 
        acuerdos comerciales entre los mercaderes locales y los comerciantes extranjeros, 
        proporcionando evidencia crucial sobre las redes comerciales internacionales del período.
        
        La caligrafía gótica utilizada en el documento sugiere que fue creado por un escriba 
        profesional, posiblemente asociado con la administración real o eclesiástica. Las 
        ilustraciones marginales incluyen representaciones de herramientas comerciales, 
        símbolos gremiales, y decoraciones típicas del arte medieval tardío.`,
      autor: 'Anónimo (Escriba Real)',
      categoria: 'Manuscritos Medievales',
      subcategoria: 'Documentos Comerciales',
      fecha_creacion: new Date().toISOString(),
      fecha_documento: '1456-03-15',
      tamaño: 2048576,
      formato: 'Pergamino digitalizado (PDF, TIFF)',
      idioma: 'Latín medieval',
      estado_conservacion: 'Bueno',
      procedencia: 'Catedral de León, Archivo Histórico',
      derechos: 'Dominio público',
      digitalizacion: {
        fecha: '2020-08-15',
        resolucion: '600 DPI',
        formato_digital: 'TIFF sin compresión',
        calidad: 'Alta resolución'
      },
      etiquetas: ['medieval', 'comercio', 'historia', 'castilla', 'león', 'manuscrito', 'siglo-xv'],
      colecciones: [
        { id: 1, nombre: 'Manuscritos Medievales' },
        { id: 3, nombre: 'Historia Comercial Española' }
      ],
      archivos: [
        {
          nombre: 'manuscrito_original.pdf',
          tamaño: 1548576,
          tipo: 'application/pdf',
          descripcion: 'Versión completa digitalizada'
        },
        {
          nombre: 'transcripcion.txt',
          tamaño: 45632,
          tipo: 'text/plain',
          descripcion: 'Transcripción paleográfica'
        },
        {
          nombre: 'traduccion_castellano.pdf',
          tamaño: 234567,
          tipo: 'application/pdf',
          descripcion: 'Traducción al castellano moderno'
        }
      ],
      metadatos: {
        catalogador: 'Dr. María González Ruiz',
        fecha_catalogacion: '2020-09-10',
        revision: '2023-03-15',
        nivel_acceso: 'Público',
        restricciones: 'Ninguna'
      }
    };
    
    setDocument(mockDocument);
    setIsLoading(false);
  };

const loadDocumentInteractions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}/interactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLikesCount(data.likes || 0);
        setFavoritesCount(data.favorites || 0);
        setViewsCount(data.views || 0);
        setDownloadsCount(data.downloads || 0);
        setRating(data.average_rating || 0);
        setIsLiked(data.is_liked || false);
        setIsFavorited(data.is_favorited || false);
        setUserRating(data.user_rating || 0);
      }
    } catch (err) {
      console.error('Error cargando interacciones:', err.message);
    }
  };
  const loadComments = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error cargando comentarios:', err.message);
      }
    }

    // Comentarios demo
    const mockComments = [
      {
        id: 1,
        autor: 'Dr. María Elena García',
        avatar: null,
        contenido: 'Excelente documento para entender las prácticas comerciales medievales. La sección sobre los gremios textiles es particularmente reveladora.',
        fecha: new Date(Date.now() - 86400000 * 2).toISOString(),
        likes: 8,
        replies: [
          {
            id: 11,
            autor: 'Prof. Carlos Mendoza',
            avatar: null,
            contenido: 'Estoy de acuerdo, María. También me llamó la atención el sistema de regulación de precios descrito en la página 15.',
            fecha: new Date(Date.now() - 86400000 * 1).toISOString(),
            likes: 3
          }
        ]
      },
      {
        id: 2,
        autor: 'Ana Rodríguez López',
        avatar: null,
        contenido: 'Sería interesante hacer un análisis comparativo con documentos similares del mismo período en otras regiones de España.',
        fecha: new Date(Date.now() - 86400000 * 5).toISOString(),
        likes: 12,
        replies: []
      },
      {
        id: 3,
        autor: 'Dr. Fernando Castillo',
        avatar: null,
        contenido: 'La calidad de la digitalización es impresionante. Se pueden leer incluso las anotaciones marginales más pequeñas. ¡Felicitaciones al equipo de restauración!',
        fecha: new Date(Date.now() - 86400000 * 7).toISOString(),
        likes: 15,
        replies: [
          {
            id: 31,
            autor: 'Técnico Digital',
            avatar: null,
            contenido: 'Gracias, Dr. Castillo. Utilizamos tecnología de escaneo de alta resolución y técnicas de mejoramiento de imagen para preservar cada detalle.',
            fecha: new Date(Date.now() - 86400000 * 6).toISOString(),
            likes: 6
          }
        ]
      }
    ];

    setComments(mockComments);
    setCommentsCount(mockComments.length + mockComments.reduce((acc, comment) => acc + (comment.replies?.length || 0), 0));
  };

  const incrementViewCount = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Intentar primero con API Gateway
      let response = await fetch(`http://localhost:5000/api/v1/documents/${id}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})  // Enviar objeto vacío para que el API Gateway no falle
      });

      // Si el API Gateway falla, intentar conexión directa al servicio
      if (!response.ok) {
        console.warn('API Gateway falló para vista, intentando conexión directa');
        response = await fetch(`http://localhost:5002/api/v1/documents/${id}/view`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})  // Enviar objeto vacío
        });
      }
    } catch (err) {
      console.log('Vista registrada en modo demo');
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      error('Debes iniciar sesión para dar me gusta');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
        success(isLiked ? 'Me gusta eliminado' : 'Me gusta agregado');
      }
    } catch (err) {
      // Modo demo
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
      success(isLiked ? 'Me gusta eliminado (demo)' : 'Me gusta agregado (demo)');
    }
  };

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      error('Debes iniciar sesión para agregar a favoritos');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}/favorite`, {
        method: isFavorited ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setIsFavorited(!isFavorited);
        setFavoritesCount(prev => isFavorited ? prev - 1 : prev + 1);
        success(isFavorited ? 'Eliminado de favoritos' : 'Agregado a favoritos');
      }
    } catch (err) {
      // Modo demo
      setIsFavorited(!isFavorited);
      setFavoritesCount(prev => isFavorited ? prev - 1 : prev + 1);
      success(isFavorited ? 'Eliminado de favoritos (demo)' : 'Agregado a favoritos (demo)');
    }
  };

  const handleRating = async (newRating) => {
    if (!isAuthenticated) {
      error('Debes iniciar sesión para calificar');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}/rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: newRating })
      });

      if (response.ok) {
        setUserRating(newRating);
        success('Calificación guardada');
        // Recalcular rating promedio (simplificado para demo)
        setRating(prev => (prev + newRating) / 2);
      }
    } catch (err) {
      // Modo demo
      setUserRating(newRating);
      success('Calificación guardada (demo)');
      setRating(prev => (prev + newRating) / 2);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) {
      error('Debes iniciar sesión y escribir un comentario');
      return;
    }

    setIsSubmittingComment(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          contenido: newComment,
          replyTo: replyTo
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (replyTo) {
          // Agregar respuesta
          setComments(prev => prev.map(comment => 
            comment.id === replyTo 
              ? { ...comment, replies: [...(comment.replies || []), data.comment] }
              : comment
          ));
        } else {
          // Agregar comentario nuevo
          setComments(prev => [data.comment, ...prev]);
        }
        setNewComment('');
        setReplyTo(null);
        success('Comentario agregado');
      }
    } catch (err) {
      // Modo demo
      const newCommentObj = {
        id: Date.now(),
        autor: user?.nombre || user?.email || 'Usuario',
        avatar: null,
        contenido: newComment,
        fecha: new Date().toISOString(),
        likes: 0,
        replies: []
      };

      if (replyTo) {
        setComments(prev => prev.map(comment => 
          comment.id === replyTo 
            ? { ...comment, replies: [...(comment.replies || []), newCommentObj] }
            : comment
        ));
      } else {
        setComments(prev => [newCommentObj, ...prev]);
      }
      
      setNewComment('');
      setReplyTo(null);
      success('Comentario agregado (demo)');
      setCommentsCount(prev => prev + 1);
    }

    setIsSubmittingComment(false);
  };

  const handleShare = (platform) => {
    const url = window.location.href;
    const title = document?.titulo || 'Documento';
    const text = `Echa un vistazo a este documento: ${title}`;

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
        break;
      case 'email':
        window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + ' ' + url)}`);
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        success('Enlace copiado al portapapeles');
        break;
    }
    setShowShareModal(false);
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        success('Documento eliminado exitosamente');
        navigate('/docs');
      } else {
        // En modo demo
        success('Documento eliminado (modo demo)');
        navigate('/docs');
      }
    } catch (err) {
      console.warn('Error eliminando documento:', err.message);
      success('Documento eliminado (modo demo)');
      navigate('/docs');
    }
  };

  const downloadFile = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5002/api/v1/documents/${id}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.archivo_original || 'documento';
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setDownloadsCount(prev => prev + 1);
      success('Descarga iniciada');
    } else {
      error('Error al descargar el documento');
    }
  } catch (err) {
    error('Error de conexión al descargar');
  }
};
  if (isLoading) {
    return (
      <div className="document-detail-page">
        <div className="loading-page">
          <div className="loading-spinner"></div>
          <div className="loading-text">Cargando documento...</div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="document-detail-page">
        <div className="error-page">
          <div className="error-content">
            <h1>404</h1>
            <h2>Documento no encontrado</h2>
            <p>El documento que buscas no existe o no tienes permisos para acceder a él.</p>
            <Link to="/docs" className="btn btn-primary">Volver a documentos</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-detail-page">
      {/* Header del documento */}
      <div className="document-detail-header">
        <div className="document-detail-container">
          <div className="breadcrumb">
            <Link to="/docs" className="breadcrumb-link">Documentos</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{document.titulo}</span>
          </div>

          <div className="document-title-section">
            <div className="document-title-info">
              <h1 className="document-detail-title">{document.titulo}</h1>
              <div className="document-meta-line">
                <span className="document-category-badge">{document.categoria}</span>
                <span className="document-author">por {document.autor}</span>
                <span className="document-date">{formatDate(document.fecha_creacion)}</span>
              </div>
            </div>
            
            <div className="document-actions">
              <div className="social-actions">
                <button 
                  onClick={handleLike}
                  className={`btn btn-social ${isLiked ? 'liked' : ''}`}
                  title="Me gusta"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.04L12,21.35Z"/>
                  </svg>
                  <span>{likesCount}</span>
                </button>

                <button 
                  onClick={handleFavorite}
                  className={`btn btn-social ${isFavorited ? 'favorited' : ''}`}
                  title="Favoritos"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z"/>
                  </svg>
                  <span>{favoritesCount}</span>
                </button>

                <button 
                  onClick={() => setShowShareModal(true)}
                  className="btn btn-social"
                  title="Compartir"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z"/>
                  </svg>
                  Compartir
                </button>
              </div>

              <div className="admin-actions">
                {isAuthenticated && isResearcher() && (
                  <>
                    <Link 
                      to={`/docs/${document.id}/edit`}
                      className="btn btn-secondary"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                      </svg>
                      Editar
                    </Link>
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="btn btn-danger"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                      </svg>
                      Eliminar
                    </button>
                  </>
                )}
                <Link to="/docs" className="btn btn-outline">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/>
                  </svg>
                  Volver
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas del documento */}
      <div className="document-stats-bar">
        <div className="document-detail-container">
          <div className="stats-grid">
            <div className="stat-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
              </svg>
              <span className="stat-number">{viewsCount}</span>
              <span className="stat-label">Vistas</span>
            </div>
            
            <div className="stat-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
              </svg>
              <span className="stat-number">{downloadsCount}</span>
              <span className="stat-label">Descargas</span>
            </div>
            
            <div className="stat-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.46,13.97L5.82,21L12,17.27Z"/>
              </svg>
              <span className="stat-number">{rating.toFixed(1)}</span>
              <span className="stat-label">Calificación</span>
            </div>
            
            <div className="stat-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9,22A1,1 0 0,1 8,21V18H4A2,2 0 0,1 2,16V4C2,2.89 2.9,2 4,2H20A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H13.9L10.2,21.71C10,21.9 9.75,22 9.5,22V22H9Z"/>
              </svg>
              <span className="stat-number">{commentsCount}</span>
              <span className="stat-label">Comentarios</span>
            </div>

            <div className="rating-section">
              <span className="rating-label">Tu calificación:</span>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    className={`star ${star <= userRating ? 'filled' : ''} ${star <= Math.ceil(rating) ? 'average' : ''}`}
                    disabled={!isAuthenticated}
                    title={isAuthenticated ? `Calificar con ${star} estrella${star !== 1 ? 's' : ''}` : 'Inicia sesión para calificar'}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.46,13.97L5.82,21L12,17.27Z"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido del documento */}
      <div className="document-detail-container">
        <div className="document-detail-grid">
          {/* Contenido principal */}
          <div className="document-main-content">
            <div className="document-content-card">
              <h2>Descripción</h2>
              <div className="document-description-full">
                {document.descripcion.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph.trim()}</p>
                ))}
              </div>
            </div>

            {/* Archivos */}
            {document.archivos && document.archivos.length > 0 && (
              <div className="document-content-card">
                <h2>Archivos disponibles</h2>
                <div className="files-list">
                  {document.archivos.map((archivo, index) => (
                    <div key={index} className="file-item">
                      <div className="file-info">
                        <div className="file-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                        </div>
                        <div className="file-details">
                          <div className="file-name">{archivo.nombre}</div>
                          <div className="file-meta">
                            <span className="file-size">{formatFileSize(archivo.tamaño)}</span>
                            <span className="file-type">{archivo.tipo}</span>
                          </div>
                          {archivo.descripcion && (
                            <div className="file-description">{archivo.descripcion}</div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => downloadFile(archivo)}
                        className="btn btn-outline btn-small"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                        </svg>
                        Descargar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
{/* Descarga del archivo real */}
{document.archivo_original && (
  <div className="document-content-card">
    <h2>Archivo disponible</h2>
    <div className="file-item">
      <div className="file-info">
        <div className="file-details">
          <div className="file-name">{document.archivo_original}</div>
          <div className="file-meta">
            <span className="file-size">{formatFileSize(document.tamaño_archivo)}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => downloadFile()}
        className="btn btn-primary btn-small"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
        </svg>
        Descargar
      </button>
    </div>
  </div>
)}
            {/* Colecciones */}
            {document.colecciones && document.colecciones.length > 0 && (
              <div className="document-content-card">
                <h2>Colecciones</h2>
                <div className="collections-list">
                  {document.colecciones.map((coleccion) => (
                    <Link 
                      key={coleccion.id}
                      to={`/cols/${coleccion.id}`}
                      className="collection-link"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17Z"/>
                      </svg>
                      {coleccion.nombre}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar con información */}
          <div className="document-sidebar">
            {/* Información básica */}
            <div className="document-info-card">
              <h3>Información del documento</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Categoría</span>
                  <span className="info-value">{document.categoria}</span>
                </div>
                {document.subcategoria && (
                  <div className="info-item">
                    <span className="info-label">Subcategoría</span>
                    <span className="info-value">{document.subcategoria}</span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Autor</span>
                  <span className="info-value">{document.autor}</span>
                </div>
                {document.fecha_documento && (
                  <div className="info-item">
                    <span className="info-label">Fecha del documento</span>
                    <span className="info-value">{new Date(document.fecha_documento).toLocaleDateString()}</span>
                  </div>
                )}
                {document.idioma && (
                  <div className="info-item">
                    <span className="info-label">Idioma</span>
                    <span className="info-value">{document.idioma}</span>
                  </div>
                )}
                {document.formato && (
                  <div className="info-item">
                    <span className="info-label">Formato</span>
                    <span className="info-value">{document.formato}</span>
                  </div>
                )}
                {document.procedencia && (
                  <div className="info-item">
                    <span className="info-label">Procedencia</span>
                    <span className="info-value">{document.procedencia}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Etiquetas */}
            {document.etiquetas && document.etiquetas.length > 0 && (
              <div className="document-info-card">
                <h3>Etiquetas</h3>
                <div className="document-tags">
                  {document.etiquetas.map((tag, index) => (
                    <span key={index} className="tag tag-large">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadatos técnicos */}
            {document.metadatos && (
              <div className="document-info-card">
                <h3>Metadatos</h3>
                <div className="info-grid">
                  {document.metadatos.catalogador && (
                    <div className="info-item">
                      <span className="info-label">Catalogador</span>
                      <span className="info-value">{document.metadatos.catalogador}</span>
                    </div>
                  )}
                  {document.metadatos.fecha_catalogacion && (
                    <div className="info-item">
                      <span className="info-label">Fecha catalogación</span>
                      <span className="info-value">{formatDate(document.metadatos.fecha_catalogacion)}</span>
                    </div>
                  )}
                  {document.metadatos.nivel_acceso && (
                    <div className="info-item">
                      <span className="info-label">Nivel de acceso</span>
                      <span className="info-value">{document.metadatos.nivel_acceso}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección de comentarios */}
      <div className="comments-section">
        <div className="document-detail-container">
          <h3 className="comments-title">
            Comentarios ({commentsCount})
          </h3>

          {/* Formulario para nuevo comentario */}
          {isAuthenticated && (
            <div className="comment-form">
              <div className="comment-input-container">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe tu comentario aquí..."
                  rows="4"
                  className="comment-textarea"
                />
                <div className="comment-form-actions">
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="btn btn-primary"
                  >
                    {isSubmittingComment ? 'Publicando...' : 'Publicar comentario'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className="login-prompt">
              <p>Inicia sesión para participar en la conversación</p>
            </div>
          )}

          {/* Lista de comentarios */}
          <div className="comments-list">
            {comments.length === 0 ? (
              <div className="no-comments">
                <p>No hay comentarios aún. ¡Sé el primero en comentar!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <div className="comment-author">
                      <div className="author-avatar">
                        {comment.user?.name?.charAt(0)?.toUpperCase() || comment.autor?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="author-info">
                        <span className="author-name">{comment.user?.name || comment.autor}</span>
                        <span className="comment-date">{formatDate(comment.createdAt || comment.fecha)}</span>
                      </div>
                    </div>
                    <div className="comment-actions">
                      <button 
                        className={`comment-like ${comment.isLiked ? 'liked' : ''}`}
                        onClick={() => {/* TODO: Implementar like de comentario */}}
                        title="Me gusta"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                        </svg>
                        <span>{comment.likesCount || comment.likes || 0}</span>
                      </button>
                      <button 
                        className="comment-reply"
                        onClick={() => setReplyTo(comment.id)}
                        title="Responder"
                      >
                        Responder
                      </button>
                    </div>
                  </div>
                  <div className="comment-content">
                    <p>{comment.content || comment.contenido}</p>
                  </div>
                  
                  {/* Respuestas al comentario */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="comment-replies">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="reply-item">
                          <div className="reply-header">
                            <div className="reply-author">
                              <div className="author-avatar small">
                                {reply.user?.name?.charAt(0)?.toUpperCase() || reply.autor?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <span className="author-name">{reply.user?.name || reply.autor}</span>
                              <span className="reply-date">{formatDate(reply.createdAt || reply.fecha)}</span>
                            </div>
                          </div>
                          <div className="reply-content">
                            <p>{reply.content || reply.contenido}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal para compartir */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Compartir documento</h3>
              <button 
                className="modal-close"
                onClick={() => setShowShareModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="share-options">
                <button 
                  className="share-option whatsapp"
                  onClick={() => handleShare('whatsapp')}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472,14.382C17.367,14.382 17.1,14.382 17.1,14.382C16.884,14.273 15.846,13.755 15.846,13.755C15.846,13.755 15.411,13.755 15.195,13.973C15.195,13.973 14.651,14.382 14.435,14.6C14.435,14.6 14.219,14.6 14.111,14.6C14.111,14.6 13.895,14.491 13.679,14.382C13.679,14.382 12.857,14.055 12.095,13.4C12.095,13.4 11.333,12.745 10.787,11.964C10.787,11.964 10.571,11.636 10.463,11.418C10.463,11.418 10.355,11.2 10.355,11.091C10.355,11.091 10.355,10.873 10.463,10.655C10.463,10.655 10.571,10.436 10.679,10.218L11.008,9.782C11.008,9.782 11.116,9.673 11.116,9.455C11.116,9.455 11.116,9.236 11.008,9.018C11.008,9.018 10.571,8.036 10.463,7.927C10.463,7.927 10.355,7.818 10.139,7.818C10.139,7.818 9.923,7.818 9.815,7.818C9.815,7.818 9.599,7.818 9.383,8.036C9.383,8.036 9.167,8.255 9.167,8.473C9.167,8.473 9.167,8.691 9.059,9.018C9.059,9.018 8.951,9.345 8.951,9.782C8.951,9.782 8.951,10.218 9.059,10.655C9.059,10.655 9.167,11.091 9.383,11.527C9.383,11.527 9.599,11.964 9.923,12.4C9.923,12.4 10.247,12.836 10.679,13.273C10.679,13.273 11.333,13.927 12.203,14.491C12.203,14.491 13.073,15.055 14.111,15.4C14.111,15.4 14.327,15.509 14.543,15.509C14.543,15.509 14.759,15.509 14.975,15.4C14.975,15.4 15.191,15.291 15.407,15.073C15.407,15.073 15.623,14.855 15.731,14.636C15.731,14.636 15.839,14.418 15.839,14.2C15.839,14.2 15.839,14.091 15.731,14.091C15.731,14.091 15.515,14.091 15.407,14.091Z"/>
                  </svg>
                  WhatsApp
                </button>
                <button 
                  className="share-option facebook"
                  onClick={() => handleShare('facebook')}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>
                <button 
                  className="share-option twitter"
                  onClick={() => handleShare('twitter')}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Twitter
                </button>
                <button 
                  className="share-option email"
                  onClick={() => handleShare('email')}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
                  </svg>
                  Email
                </button>
              </div>
              
              <div className="share-link">
                <label>Enlace directo:</label>
                <div className="link-container">
                  <input 
                    type="text" 
                    value={shareUrl}
                    readOnly
                    className="share-url-input"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      success('Enlace copiado al portapapeles');
                    }}
                    className="copy-link-btn"
                    title="Copiar enlace"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar eliminación</h3>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="modal-close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de que quieres eliminar el documento "<strong>{document.titulo}</strong>"?</p>
              <p className="text-error">Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="btn btn-danger"
              >
                Eliminar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDetailPage;