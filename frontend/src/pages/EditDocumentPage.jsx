import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import apiService from '../services/apiService';

const EditDocumentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    abstract: '',
    institucion: '',
    fecha_publicacion: '',
    tags: '',
    is_publico: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [availableTags, setAvailableTags] = useState([]);
  const [notFound, setNotFound] = useState(false);

  const { isAuthenticated, isResearcher, user } = useAuth();
  const { error, success } = useNotifications();

  useEffect(() => {
    if (!isAuthenticated || !isResearcher()) {
      navigate('/docs');
      return;
    }
    loadDocument();
    loadAvailableTags();
  }, [id, isAuthenticated, isResearcher, navigate]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.documents.getById(id);
      if (!data || !data.document) {
        setNotFound(true);
        return;
      }
      const doc = data.document;

      if (doc.autor_id !== (user?.id || user?.user_id)) {
        error('No tienes permiso para editar este documento');
        navigate(`/docs/${id}`);
        return;
      }

      setFormData({
        titulo: doc.titulo || '',
        descripcion: doc.descripcion || '',
        abstract: doc.abstract || '',
        institucion: doc.institucion || '',
        fecha_publicacion: doc.fecha_publicacion ? doc.fecha_publicacion.split('T')[0] : '',
        tags: Array.isArray(doc.tags) ? doc.tags.map(t => t.nombre || t).join(', ') : (doc.tags || ''),
        is_publico: doc.is_publico !== false
      });
    } catch (err) {
      console.error('Error cargando documento:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        error('Error al cargar el documento');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const data = await apiService.get('/tags');
      setAvailableTags(data.tags || []);
    } catch (err) {
      setAvailableTags([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'El título es requerido';
    } else if (formData.titulo.trim().length < 5) {
      newErrors.titulo = 'El título debe tener al menos 5 caracteres';
    } else if (formData.titulo.trim().length > 200) {
      newErrors.titulo = 'El título no puede exceder 200 caracteres';
    }

    if (formData.descripcion && formData.descripcion.length > 1000) {
      newErrors.descripcion = 'La descripción no puede exceder 1000 caracteres';
    }

    if (formData.abstract && formData.abstract.length > 2000) {
      newErrors.abstract = 'El abstract no puede exceder 2000 caracteres';
    }

    if (formData.fecha_publicacion) {
      const fecha = new Date(formData.fecha_publicacion);
      const hoy = new Date();
      if (fecha > hoy) {
        newErrors.fecha_publicacion = 'La fecha de publicación no puede ser futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addTag = (tagName) => {
    if (!tagName.trim()) return;
    const currentTags = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];
    if (!currentTags.includes(tagName)) {
      const newTags = [...currentTags, tagName].join(', ');
      setFormData(prev => ({
        ...prev,
        tags: newTags
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const dataToSend = {
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim(),
        abstract: formData.abstract.trim(),
        institucion: formData.institucion.trim(),
        fecha_publicacion: formData.fecha_publicacion,
        is_publico: formData.is_publico,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      const data = await apiService.documents.update(id, dataToSend);
      success('Documento actualizado exitosamente');
      navigate(`/docs/${id}`);
    } catch (err) {
      console.error('Error actualizando documento:', err);
      error(err.response?.data?.error || err.message || 'Error al actualizar el documento');
    } finally {
      setIsSaving(false);
    }
  };

  if (notFound) {
    return (
      <div className="new-document-page">
        <div className="page-container">
          <div className="error-page">
            <div className="error-content">
              <h1>404</h1>
              <h2>Documento no encontrado</h2>
              <p>El documento que buscas no existe o ha sido eliminado.</p>
              <button onClick={() => navigate('/docs')} className="btn btn-primary">
                Volver a documentos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="new-document-page">
        <div className="page-container">
          <div className="loading-spinner">
            <div className="spinner" />
            <p>Cargando documento...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="new-document-page">
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-section">
            <h1>Editar Documento</h1>
            <p className="page-subtitle">
              Actualiza la información de tu documento académico
            </p>
          </div>
        </div>

        <div className="upload-form-container">
          <form onSubmit={handleSubmit} className="upload-form">
            <div className="form-section">
              <h3 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
                Información del Documento
              </h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="titulo" className="form-label required">
                    Título del Documento
                    <span className="field-counter">{formData.titulo.length}/200</span>
                  </label>
                  <input
                    type="text"
                    id="titulo"
                    name="titulo"
                    value={formData.titulo}
                    onChange={handleInputChange}
                    className={`form-input ${errors.titulo ? 'error' : formData.titulo.trim() ? 'valid' : ''}`}
                    placeholder="Ingresa el título del documento"
                    disabled={isSaving}
                    maxLength="200"
                  />
                  {errors.titulo && <div className="error-message">{errors.titulo}</div>}
                  {formData.titulo.trim() && !errors.titulo && (
                    <div className="success-message">✓ Título válido</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="institucion" className="form-label">
                    Institución
                  </label>
                  <input
                    type="text"
                    id="institucion"
                    name="institucion"
                    value={formData.institucion}
                    onChange={handleInputChange}
                    className={`form-input ${formData.institucion.trim() ? 'valid' : ''}`}
                    placeholder="Institución de origen"
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fecha_publicacion" className="form-label">
                    Fecha de Publicación
                  </label>
                  <input
                    type="date"
                    id="fecha_publicacion"
                    name="fecha_publicacion"
                    value={formData.fecha_publicacion}
                    onChange={handleInputChange}
                    className={`form-input ${errors.fecha_publicacion ? 'error' : formData.fecha_publicacion ? 'valid' : ''}`}
                    disabled={isSaving}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {errors.fecha_publicacion && <div className="error-message">{errors.fecha_publicacion}</div>}
                  {formData.fecha_publicacion && !errors.fecha_publicacion && (
                    <div className="success-message">✓ Fecha válida</div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="descripcion" className="form-label">
                  Descripción
                  <span className="field-counter">{formData.descripcion.length}/1000</span>
                </label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  className={`form-textarea ${errors.descripcion ? 'error' : formData.descripcion.trim() ? 'valid' : ''}`}
                  rows="4"
                  placeholder="Describe brevemente el contenido del documento"
                  disabled={isSaving}
                  maxLength="1000"
                />
                {errors.descripcion && <div className="error-message">{errors.descripcion}</div>}
                {formData.descripcion.trim() && !errors.descripcion && (
                  <div className="success-message">✓ Descripción completa</div>
                )}
                <small className="form-help">
                  Una buena descripción ayuda a otros investigadores a entender tu trabajo
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="abstract" className="form-label">
                  Abstract/Resumen
                  <span className="field-counter">{formData.abstract.length}/2000</span>
                </label>
                <textarea
                  id="abstract"
                  name="abstract"
                  value={formData.abstract}
                  onChange={handleInputChange}
                  className={`form-textarea ${errors.abstract ? 'error' : formData.abstract.trim() ? 'valid' : ''}`}
                  rows="6"
                  placeholder="Resumen académico del documento"
                  disabled={isSaving}
                  maxLength="2000"
                />
                {errors.abstract && <div className="error-message">{errors.abstract}</div>}
                {formData.abstract.trim() && !errors.abstract && (
                  <div className="success-message">✓ Abstract completo</div>
                )}
                <small className="form-help">
                  El abstract debe resumir los objetivos, metodología y conclusiones principales
                </small>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.63,5.84C17.27,5.33 16.67,5 16,5L5,5.01C3.9,5.01 3,5.9 3,7V17C3,18.1 3.9,19 5,19H16C16.67,19 17.27,18.67 17.63,18.16L22,12L17.63,5.84Z"/>
                </svg>
                Clasificación y Etiquetas
              </h3>

              <div className="form-group">
                <label htmlFor="tags" className="form-label">
                  Etiquetas
                </label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className={`form-input ${formData.tags.trim() ? 'valid' : ''}`}
                  placeholder="Separar etiquetas con comas: arqueología, historia, medieval"
                  disabled={isSaving}
                />
                <small className="form-help">
                  Las etiquetas ayudan a categorizar y encontrar tu documento
                </small>
              </div>

              {availableTags.length > 0 && (
                <div className="tags-suggestions">
                  <label className="form-label">Etiquetas sugeridas</label>
                  <div className="tag-buttons">
                    {availableTags.slice(0, 12).map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => addTag(tag.nombre)}
                        className="tag-button"
                        disabled={isSaving}
                        title={`Añadir etiqueta: ${tag.nombre}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}>
                          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                        {tag.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <div className="checkbox-group enhanced">
                  <input
                    type="checkbox"
                    id="is_publico"
                    name="is_publico"
                    checked={formData.is_publico}
                    onChange={handleInputChange}
                    className="form-checkbox"
                    disabled={isSaving}
                  />
                  <label htmlFor="is_publico" className="checkbox-label">
                    <div className="checkbox-icon">
                      {formData.is_publico ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2Z"/>
                        </svg>
                      )}
                    </div>
                    <div className="checkbox-content">
                      <strong>Documento público</strong>
                      <small>{formData.is_publico ? 'Visible para todos los usuarios' : 'Solo visible para ti'}</small>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate(`/docs/${id}`)}
                className="btn btn-outline btn-lg"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,1A11,11 0 1,0 23,12A11,11 0 0,0 12,1M12,19A7,7 0 1,1 19,12A7,7 0 0,1 12,19Z" opacity="0.25"/>
                      <path d="M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12H21A9,9 0 0,0 12,3Z"/>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                    </svg>
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditDocumentPage;
