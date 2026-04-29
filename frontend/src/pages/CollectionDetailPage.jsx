import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import { formatDate, formatFileSize } from '../utils';

const CollectionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');
  
  // Estados para características sociales
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const { isAuthenticated, isResearcher, user } = useAuth();
  const { error, success } = useNotifications();

  useEffect(() => {
    loadCollectionData();
    loadCollectionInteractions();
    loadComments();
    
    // Incrementar vistas
    setTimeout(() => {
      incrementViews();
    }, 1000);
    
    // URL para compartir
    setShareUrl(window.location.href);
  }, [id]);

  const loadCollectionInteractions = async () => {
    try {
      const token = localStorage.getItem('token');
      // Try API Gateway first
      let response = await fetch(`http://localhost:5000/api/v1/collections/${id}/interactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      // If API Gateway fails, try direct service connection
      if (!response.ok) {
        response = await fetch(`http://localhost:5003/api/v1/collections/${id}/interactions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
        setIsFavorited(data.isFavorited);
        setIsSubscribed(data.isSubscribed);
        setLikesCount(data.likesCount);
        setFavoritesCount(data.favoritesCount);
        setSubscribersCount(data.subscribersCount);
        setViewsCount(data.viewsCount);
        setRating(data.averageRating);
        setUserRating(data.userRating);
        setCommentsCount(data.commentsCount);
      }
    } catch (err) {
      // Generar datos demo para interacciones
      setLikesCount(Math.floor(Math.random() * 80) + 20); // 20-100
      setFavoritesCount(Math.floor(Math.random() * 40) + 10); // 10-50
      setSubscribersCount(Math.floor(Math.random() * 150) + 50); // 50-200
      setViewsCount(Math.floor(Math.random() * 800) + 200); // 200-1000
      setRating(Math.random() * 2 + 3.5); // 3.5-5.5
      setCommentsCount(Math.floor(Math.random() * 25) + 5); // 5-30
      setIsLiked(Math.random() > 0.7);
      setIsFavorited(Math.random() > 0.8);
      setIsSubscribed(Math.random() > 0.6);
      setUserRating(Math.floor(Math.random() * 5) + 1);
    }
  };

  const loadComments = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Intentar primero con API Gateway
      let response = await fetch(`http://localhost:5000/api/v1/collections/${id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      // Si el API Gateway falla, intentar conexión directa al servicio
      if (!response.ok) {
        console.warn('API Gateway falló para comentarios, intentando conexión directa');
        response = await fetch(`http://localhost:5004/api/v1/collections/${id}/comments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        return;
      }
    } catch (err) {
      // Generar comentarios demo
      const demoComments = [
        {
          id: 1,
          user: { name: 'Dr. María García' },
          contenido: 'Excelente colección, los manuscritos están muy bien conservados y la catalogación es impecable.',
          fecha: '2024-01-10T10:30:00Z',
          likes: 12,
          isLiked: false,
          replies: [
            {
              id: 11,
              user: { name: 'Prof. Carlos Ruiz' },
              contenido: 'Estoy de acuerdo, especialmente destacan los códices iluminados.',
              fecha: '2024-01-10T11:45:00Z'
            }
          ]
        },
        {
          id: 2,
          user: { name: 'Ana Rodríguez' },
          contenido: 'Me ha sido muy útil para mi investigación sobre filosofía medieval. ¡Gracias por mantener esta colección!',
          fecha: '2024-01-08T16:20:00Z',
          likes: 8,
          isLiked: true,
          replies: []
        },
        {
          id: 3,
          user: { name: 'Dr. Luis Fernández' },
          contenido: 'Los manuscritos de Alfonso X son realmente únicos. ¿Hay planes de digitalizar más documentos?',
          fecha: '2024-01-05T09:15:00Z',
          likes: 15,
          isLiked: false,
          replies: [
            {
              id: 31,
              user: { name: 'Elena Martínez' },
              contenido: 'Sí, estamos trabajando en la digitalización del 95% restante.',
              fecha: '2024-01-05T14:30:00Z'
            }
          ]
        }
      ];
      setComments(demoComments);
    }
  };

  const incrementViews = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Intentar primero con API Gateway
      let response = await fetch(`http://localhost:5000/api/v1/collections/${id}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      // Si el API Gateway falla, intentar conexión directa al servicio
      if (!response.ok) {
        console.warn('API Gateway falló para vista, intentando conexión directa');
        response = await fetch(`http://localhost:5003/api/v1/collections/${id}/view`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      }
    } catch (err) {
      // En modo demo, incrementar localmente
      setViewsCount(prev => prev + 1);
    }
  };

  const loadCollectionData = async () => {
    try {
      setIsLoading(true);
      
      // Intentar cargar desde API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const token = localStorage.getItem('token');
      
      // Cargar colección
      const collectionResponse = await fetch(`http://localhost:5000/api/v1/collections/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      // Cargar documentos de la colección
      const documentsResponse = await fetch(`http://localhost:5000/api/v1/collections/${id}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (collectionResponse.ok && documentsResponse.ok) {
        const collectionData = await collectionResponse.json();
        const documentsData = await documentsResponse.json();
        setCollection(collectionData.collection);
        setDocuments(documentsData.documents || []);
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error cargando colección:', err.message);
      }
    }

    // Usar datos demo
    console.log('Usando datos demo de colección');
    const mockCollection = {
      id: parseInt(id),
      nombre: 'Manuscritos Medievales',
      descripcion: `Esta prestigiosa colección reúne una selección excepcional de manuscritos medievales que abarcan desde el siglo V hasta el XV. Cada documento ha sido cuidadosamente preservado y catalogado, representando una ventana única hacia el pensamiento, la cultura y las prácticas de la Europa medieval.

      La colección incluye textos religiosos, crónicas históricas, tratados filosóficos, documentos administrativos y obras literarias que proporcionan una visión integral de la vida medieval. Muchos de estos manuscritos son únicos en su género y han sido objeto de estudio por parte de historiadores y paleógrafos de renombre internacional.

      Destacan especialmente los códices iluminados con sus elaboradas miniaturas, que no solo representan arte de primera calidad, sino que también ofrecen información invaluable sobre las técnicas artísticas, los materiales utilizados y las influencias culturales de cada período.`,
      tipo: 'Manuscritos Históricos',
      fecha_creacion: new Date().toISOString(),
      documentos_count: 42,
      tamaño_total: 256789012,
      tags: ['medieval', 'manuscritos', 'historia', 'religión', 'filosofía'],
      autor_principal: 'Diversos autores medievales',
      periodo: 'Siglos V-XV',
      acceso: 'público',
      curador: 'Dr. Elena Martínez Sánchez',
      institucion: 'Universidad de Salamanca',
      fecha_ultima_actualizacion: '2024-01-15',
      idiomas: ['Latín', 'Castellano Antiguo', 'Francés Antiguo'],
      temas: [
        'Historia Medieval',
        'Textos Religiosos',
        'Filosofía Escolástica',
        'Literatura Cortesana',
        'Documentos Administrativos'
      ],
      metadatos: {
        nivel_catalogacion: 'Completo',
        digitalizacion: '95% completada',
        acceso_fisico: 'Restringido con cita previa',
        copyright: 'Dominio público',
        condiciones_uso: 'Libre para investigación académica'
      }
    };

    const mockDocuments = [
      {
        id: 1,
        titulo: 'Códice de Alfonso X el Sabio',
        descripcion: 'Manuscrito iluminado de las Cantigas de Santa María con notación musical medieval.',
        autor: 'Alfonso X el Sabio',
        fecha_creacion: '1260-01-01',
        categoria: 'Literatura Musical',
        tamaño: 15678901,
        etiquetas: ['alfonso-x', 'cantigas', 'música', 'iluminado']
      },
      {
        id: 2,
        titulo: 'Crónica de la Reconquista',
        descripcion: 'Relato contemporáneo de las campañas de reconquista durante el siglo XII.',
        autor: 'Anónimo',
        fecha_creacion: '1150-01-01',
        categoria: 'Crónicas Históricas',
        tamaño: 8901234,
        etiquetas: ['reconquista', 'historia', 'militar', 'siglo-xii']
      },
      {
        id: 3,
        titulo: 'Tratado de Filosofía Escolástica',
        descripcion: 'Obra sobre filosofía tomista con comentarios y glosas marginales.',
        autor: 'Tomás de Aquino (copia)',
        fecha_creacion: '1300-01-01',
        categoria: 'Filosofía',
        tamaño: 12345678,
        etiquetas: ['filosofía', 'escolástica', 'tomás-aquino', 'teología']
      },
      {
        id: 4,
        titulo: 'Cartulario Monástico',
        descripcion: 'Registro de propiedades y privilegios del Monasterio de San Pedro.',
        autor: 'Escribas Monásticos',
        fecha_creacion: '1200-01-01',
        categoria: 'Documentos Administrativos',
        tamaño: 6789012,
        etiquetas: ['monasterio', 'cartulario', 'propiedades', 'privilegios']
      }
    ];
    
    setCollection(mockCollection);
    setDocuments(mockDocuments);
    setIsLoading(false);
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      error('Debes iniciar sesión para dar me gusta');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${id}/like`, {
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
      const response = await fetch(`http://localhost:5000/api/v1/collections/${id}/favorite`, {
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

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      error('Debes iniciar sesión para suscribirte');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${id}/subscribe`, {
        method: isSubscribed ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setIsSubscribed(!isSubscribed);
        setSubscribersCount(prev => isSubscribed ? prev - 1 : prev + 1);
        success(isSubscribed ? 'Suscripción cancelada' : 'Te has suscrito a las actualizaciones');
      }
    } catch (err) {
      // Modo demo
      setIsSubscribed(!isSubscribed);
      setSubscribersCount(prev => isSubscribed ? prev - 1 : prev + 1);
      success(isSubscribed ? 'Suscripción cancelada (demo)' : 'Te has suscrito a las actualizaciones (demo)');
    }
  };

  const handleRating = async (newRating) => {
    if (!isAuthenticated) {
      error('Debes iniciar sesión para calificar');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/v1/collections/${id}/rating`, {
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
      const response = await fetch(`http://localhost:5000/api/v1/collections/${id}/comments`, {
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
        user: { name: user?.nombre || user?.email || 'Usuario' },
        contenido: newComment,
        fecha: new Date().toISOString(),
        likes: 0,
        isLiked: false,
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
    const title = collection?.nombre || 'Colección';
    const text = `Echa un vistazo a esta colección: ${title}`;

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
      const response = await fetch(`http://localhost:5000/api/v1/collections/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        success('Colección eliminada exitosamente');
        navigate('/cols');
      } else {
        // En modo demo
        success('Colección eliminada (modo demo)');
        navigate('/cols');
      }
    } catch (err) {
      console.warn('Error eliminando colección:', err.message);
      success('Colección eliminada (modo demo)');
      navigate('/cols');
    }
  };

  if (isLoading) {
    return (
      <div className="collection-detail-page">
        <div className="loading-page">
          <div className="loading-spinner"></div>
          <div className="loading-text">Cargando colección...</div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="collection-detail-page">
        <div className="error-page">
          <div className="error-content">
            <h1>404</h1>
            <h2>Colección no encontrada</h2>
            <p>La colección que buscas no existe o no tienes permisos para acceder a ella.</p>
            <Link to="/cols" className="btn btn-primary">Volver a colecciones</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-detail-page">
      {/* Header de la colección */}
      <div className="collection-detail-header">
        <div className="collection-detail-container">
          <div className="breadcrumb">
            <Link to="/cols" className="breadcrumb-link">Colecciones</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{collection.nombre}</span>
          </div>

          <div className="collection-header-content">
            <div className="collection-info-main">
              <div className="collection-header-info">
                <h1 className="collection-detail-title">{collection.nombre}</h1>
                <div className="collection-meta-line">
                  <span className={`access-badge ${collection.acceso === 'público' ? 'badge-success' : 'badge-warning'}`}>
                    {collection.acceso}
                  </span>
                  <span className="collection-type-badge">{collection.tipo}</span>
                  <span className="collection-period">{collection.periodo}</span>
                </div>
                <p className="collection-summary">
                  {collection.descripcion?.substring(0, 300)}
                  {collection.descripcion?.length > 300 ? '...' : ''}
                </p>
              </div>
              
              <div className="collection-stats-hero">
                <div className="stat-hero">
                  <div className="stat-number">{collection.documentos_count}</div>
                  <div className="stat-label">Documentos</div>
                </div>
                <div className="stat-hero">
                  <div className="stat-number">{formatFileSize(collection.tamaño_total || 256789012)}</div>
                  <div className="stat-label">Tamaño total</div>
                </div>
                <div className="stat-hero">
                  <div className="stat-number">{rating.toFixed(1)}</div>
                  <div className="stat-label">Calificación</div>
                </div>
              </div>
            </div>

            <div className="collection-actions-main">
              <div className="collection-social-stats">
                <div className="social-stat">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.04L12,21.35Z"/>
                  </svg>
                  <div className="social-info">
                    <span className="social-count">{likesCount}</span>
                    <span className="social-label">Me gusta</span>
                  </div>
                </div>
                <div className="social-stat">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z"/>
                  </svg>
                  <div className="social-info">
                    <span className="social-count">{favoritesCount}</span>
                    <span className="social-label">Favoritos</span>
                  </div>
                </div>
                <div className="social-stat">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17,12C17,14.42 15.28,16.44 13,16.9V21H11V16.9C8.72,16.44 7,14.42 7,12H9C9,13.66 10.34,15 12,15C13.66,15 15,13.66 15,12H17M12,2A3,3 0 0,1 15,5V6H19A1,1 0 0,1 20,7V9A1,1 0 0,1 19,10H5A1,1 0 0,1 4,9V7A1,1 0 0,1 5,6H9V5A3,3 0 0,1 12,2Z"/>
                  </svg>
                  <div className="social-info">
                    <span className="social-count">{subscribersCount}</span>
                    <span className="social-label">Suscriptores</span>
                  </div>
                </div>
                <div className="social-stat">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                  </svg>
                  <div className="social-info">
                    <span className="social-count">{viewsCount}</span>
                    <span className="social-label">Vistas</span>
                  </div>
                </div>
              </div>

              <div className="collection-actions">
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
                  onClick={handleSubscribe}
                  className={`btn btn-social ${isSubscribed ? 'subscribed' : ''}`}
                  title={isSubscribed ? 'Te has suscrito' : 'Suscribirse'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17,12C17,14.42 15.28,16.44 13,16.9V21H11V16.9C8.72,16.44 7,14.42 7,12H9C9,13.66 10.34,15 12,15C13.66,15 15,13.66 15,12H17M12,2A3,3 0 0,1 15,5V6H19A1,1 0 0,1 20,7V9A1,1 0 0,1 19,10H5A1,1 0 0,1 4,9V7A1,1 0 0,1 5,6H9V5A3,3 0 0,1 12,2Z"/>
                  </svg>
                  <span>{subscribersCount}</span>
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
                <Link to="/docs" className="btn btn-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                  </svg>
                  Explorar Documentos
                </Link>
                
                {isAuthenticated && isResearcher() && (
                  <>
                    <Link to={`/cols/${collection.id}/edit`} className="btn btn-secondary">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                      </svg>
                      Gestionar
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
                
                <Link to="/cols" className="btn btn-outline">
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
      </div>

      {/* Sección de calificación e interacción */}
      <div className="collection-interaction-bar">
        <div className="collection-detail-container">
          <div className="interaction-section">
            <div className="rating-interactive">
              <span className="rating-label">Califica esta colección:</span>
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
              <span className="rating-avg">({rating.toFixed(1)} promedio)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="collection-tabs">
        <div className="collection-detail-container">
          <div className="tabs-nav">
            <button 
              className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              Documentos ({documents.length})
            </button>
            <button 
              className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/>
              </svg>
              Información
            </button>
            <button 
              className={`tab-button ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9,22A1,1 0 0,1 8,21V18H4A2,2 0 0,1 2,16V4C2,2.89 2.9,2 4,2H20A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H13.9L10.2,21.71C10,21.9 9.75,22 9.5,22V22H9Z"/>
              </svg>
              Comentarios ({commentsCount})
            </button>
          </div>
        </div>
      </div>

      {/* Contenido de las pestañas */}
      <div className="collection-detail-container">
        {activeTab === 'documents' && (
          <div className="tab-content">
            <div className="collection-description">
              <h2>Descripción de la colección</h2>
              <div className="description-content">
                {collection.descripcion.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph.trim()}</p>
                ))}
              </div>
            </div>

            <div className="documents-section">
              <div className="section-header">
                <h2>Documentos en esta colección</h2>
                <p>{documents.length} documento{documents.length !== 1 ? 's' : ''} disponible{documents.length !== 1 ? 's' : ''}</p>
              </div>
              
              {documents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                  </div>
                  <h3>No hay documentos en esta colección</h3>
                  <p>Los documentos aparecerán aquí cuando sean añadidos a la colección.</p>
                </div>
              ) : (
                <div className="documents-grid">
                  {documents.map((document) => (
                    <div key={document.id} className="document-card">
                      <div className="document-header">
                        <div className="document-type-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                        </div>
                        <div className="document-meta">
                          <span className="document-category">{document.categoria}</span>
                          <span className="document-date">{new Date(document.fecha_creacion).getFullYear()}</span>
                        </div>
                      </div>

                      <div className="document-content">
                        <h3 className="document-title">{document.titulo}</h3>
                        <p className="document-description">
                          {document.descripcion?.substring(0, 120)}
                          {document.descripcion?.length > 120 ? '...' : ''}
                        </p>
                        
                        <div className="document-details">
                          <span className="document-author">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                            </svg>
                            {document.autor}
                          </span>
                          <span className="document-size">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            {formatFileSize(document.tamaño)}
                          </span>
                        </div>

                        {document.etiquetas && document.etiquetas.length > 0 && (
                          <div className="document-tags">
                            {document.etiquetas.slice(0, 3).map((tag, index) => (
                              <span key={index} className="tag">
                                {tag}
                              </span>
                            ))}
                            {document.etiquetas.length > 3 && (
                              <span className="tag tag-more">
                                +{document.etiquetas.length - 3}
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
                          Ver Documento
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="tab-content">
            <div className="collection-info-grid">
              {/* Información general */}
              <div className="info-section">
                <h3>Información General</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Curador</span>
                    <span className="info-value">{collection.curador}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Institución</span>
                    <span className="info-value">{collection.institucion}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Período histórico</span>
                    <span className="info-value">{collection.periodo}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Última actualización</span>
                    <span className="info-value">{formatDate(collection.fecha_ultima_actualizacion)}</span>
                  </div>
                </div>
              </div>

              {/* Idiomas */}
              {collection.idiomas && (
                <div className="info-section">
                  <h3>Idiomas</h3>
                  <div className="tags-list">
                    {collection.idiomas.map((idioma, index) => (
                      <span key={index} className="tag tag-large">
                        {idioma}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Temas */}
              {collection.temas && (
                <div className="info-section">
                  <h3>Temas principales</h3>
                  <div className="tags-list">
                    {collection.temas.map((tema, index) => (
                      <span key={index} className="tag tag-large">
                        {tema}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Etiquetas */}
              {collection.tags && (
                <div className="info-section">
                  <h3>Etiquetas</h3>
                  <div className="tags-list">
                    {collection.tags.map((tag, index) => (
                      <span key={index} className="tag tag-large">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadatos */}
              {collection.metadatos && (
                <div className="info-section">
                  <h3>Metadatos técnicos</h3>
                  <div className="info-grid">
                    {Object.entries(collection.metadatos).map(([key, value], index) => (
                      <div key={index} className="info-item">
                        <span className="info-label">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="info-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="tab-content">
            <div className="comments-section">
              <div className="collection-detail-container">
                <h3 className="comments-title">
                  Comentarios y Discusiones ({commentsCount})
                </h3>

                {/* Formulario para nuevo comentario */}
                {isAuthenticated && (
                  <div className="comment-form">
                    <div className="comment-input-container">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Comparte tus pensamientos sobre esta colección..."
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
                    <div className="login-prompt-content">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                      </svg>
                      <div>
                        <p><strong>¡Únete a la conversación!</strong></p>
                        <p>Inicia sesión para comentar y compartir tus opiniones sobre esta colección</p>
                        <Link to="/login" className="btn btn-outline btn-sm">Iniciar Sesión</Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de comentarios */}
                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div className="no-comments">
                      <p>No hay comentarios aún. ¡Sé el primero en comentar sobre esta colección!</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="comment-item">
                        <div className="comment-header">
                          <div className="comment-author">
                            <div className="author-avatar">
                              {comment.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="author-info">
                              <span className="author-name">{comment.user?.name}</span>
                              <span className="comment-date">{formatDate(comment.fecha)}</span>
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
                              <span>{comment.likes || 0}</span>
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
                          <p>{comment.contenido}</p>
                        </div>
                        
                        {/* Respuestas al comentario */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="comment-replies">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="reply-item">
                                <div className="reply-header">
                                  <div className="reply-author">
                                    <div className="author-avatar small">
                                      {reply.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <span className="author-name">{reply.user?.name}</span>
                                    <span className="reply-date">{formatDate(reply.fecha)}</span>
                                  </div>
                                </div>
                                <div className="reply-content">
                                  <p>{reply.contenido}</p>
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
          </div>
        )}
      </div>

      {/* Modal para compartir */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Compartir colección</h3>
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
              <p>¿Estás seguro de que quieres eliminar la colección "<strong>{collection.nombre}</strong>"?</p>
              <p className="text-error">Esta acción eliminará también todos los documentos asociados y no se puede deshacer.</p>
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
                Eliminar colección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionDetailPage;