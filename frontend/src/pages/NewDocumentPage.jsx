import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import apiService from '../services/apiService';

const NewDocumentPage = () => {
  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    descripcion: '',
    abstract: '',
    institucion: '',
    fecha_publicacion: '',
    tags: '',
    is_publico: true
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [availableTags, setAvailableTags] = useState([]);
  
  const { isAuthenticated, isResearcher, user } = useAuth();
  const { error, success } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !isResearcher()) {
      navigate('/docs');
      return;
    }

    // Pre-cargar datos del usuario
    if (user) {
      setFormData(prev => ({
        ...prev,
        autor: user.nombre || '',
        institucion: user.institucion || ''
      }));
    }

    loadAvailableTags();
  }, [isAuthenticated, isResearcher, user, navigate]);

  const loadAvailableTags = async () => {
    try {
      const data = await apiService.get('/tags');
      setAvailableTags(data.tags || []);
    } catch (err) {
      console.log('Error cargando tags desde el servidor');
      setAvailableTags([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Limpiar error del campo
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'application/vnd.oasis.opendocument.text'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        file: 'Solo se permiten documentos académicos (PDF, DOC, DOCX, TXT, RTF, ODT)'
      }));
      setSelectedFile(null);
      return;
    }

    // Validar tamaño (50MB máximo)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setErrors(prev => ({
        ...prev,
        file: 'El archivo no puede superar los 50MB'
      }));
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setErrors(prev => ({
      ...prev,
      file: null
    }));

    // Auto-completar título si está vacío
    if (!formData.titulo && file.name) {
      const fileName = file.name.replace('.pdf', '').replace(/[-_]/g, ' ');
      setFormData(prev => ({
        ...prev,
        titulo: fileName
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar título
    if (!formData.titulo.trim()) {
      newErrors.titulo = 'El título es requerido';
    } else if (formData.titulo.trim().length < 5) {
      newErrors.titulo = 'El título debe tener al menos 5 caracteres';
    } else if (formData.titulo.trim().length > 200) {
      newErrors.titulo = 'El título no puede exceder 200 caracteres';
    }

    // Validar autor
    if (!formData.autor.trim()) {
      newErrors.autor = 'El autor es requerido';
    } else if (formData.autor.trim().length < 3) {
      newErrors.autor = 'El nombre del autor debe tener al menos 3 caracteres';
    }

    // Validar archivo
    if (!selectedFile) {
      newErrors.file = 'Debe seleccionar un documento para subir';
    }

    // Validar descripción si se proporciona
    if (formData.descripcion && formData.descripcion.length > 1000) {
      newErrors.descripcion = 'La descripción no puede exceder 1000 caracteres';
    }

    // Validar abstract si se proporciona
    if (formData.abstract && formData.abstract.length > 2000) {
      newErrors.abstract = 'El abstract no puede exceder 2000 caracteres';
    }

    // Validar fecha de publicación
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formDataToSend = new FormData();
      
      // Agregar archivo
      formDataToSend.append('file', selectedFile);
      
      // Agregar campos del formulario
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          formDataToSend.append(key, formData[key]);
        }
      });

      const data = await apiService.documents.create(formDataToSend);

      setUploadProgress(100);
      success('Documento subido exitosamente');
      navigate(`/docs/${data.document.id}`);
    } catch (err) {
      console.error('Error subiendo documento:', err);
      error(err.message || 'Error al subir el documento. Inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAuthenticated || !isResearcher()) {
    return null;
  }

  return (
    <div className="new-document-page">
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-section">
            <h1>Subir Nuevo Documento</h1>
            <p className="page-subtitle">
              Comparte tu investigación con la comunidad académica
            </p>
          </div>
        </div>

        <div className="upload-form-container">
          <form onSubmit={handleSubmit} className="upload-form">
            {/* Sección de archivo */}
            <div className="form-section">
              <h3 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                Archivo del Documento
              </h3>
              
              <div className="file-upload-area">
                <input
                  type="file"
                  id="file-input"
                  accept=".pdf,.doc,.docx,.txt,.rtf,.odt"
                  onChange={handleFileChange}
                  className="file-input-hidden"
                  disabled={isUploading}
                />
                
                <label htmlFor="file-input" className={`file-upload-label ${selectedFile ? 'has-file' : ''}`}>
                  {selectedFile ? (
                    <div className="file-info">
                      <div className="file-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                      </div>
                      <div className="file-details">
                        <div className="file-name">{selectedFile.name}</div>
                        <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                        <div className="file-status">✓ Archivo listo para subir</div>
                      </div>
                    </div>
                  ) : (
                    <div className="upload-prompt">
                      <div className="upload-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,11L16,15H13V19H11V15H8L12,11Z"/>
                        </svg>
                      </div>
                      <div className="upload-text">
                        <strong>Selecciona un documento</strong>
                        <p>PDF, DOC, DOCX, TXT, RTF o ODT</p>
                        <small>Máximo 50MB</small>
                      </div>
                    </div>
                  )}
                </label>
                
                {errors.file && <div className="error-message">{errors.file}</div>}
              </div>
            </div>

            {/* Información básica */}
            <div className="form-section">
              <h3 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
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
                    disabled={isUploading}
                    maxLength="200"
                  />
                  {errors.titulo && <div className="error-message">{errors.titulo}</div>}
                  {formData.titulo.trim() && !errors.titulo && (
                    <div className="success-message">✓ Título válido</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="autor" className="form-label required">
                    Autor
                  </label>
                  <input
                    type="text"
                    id="autor"
                    name="autor"
                    value={formData.autor}
                    onChange={handleInputChange}
                    className={`form-input ${errors.autor ? 'error' : formData.autor.trim() ? 'valid' : ''}`}
                    placeholder="Nombre del autor del documento"
                    disabled={isUploading}
                  />
                  {errors.autor && <div className="error-message">{errors.autor}</div>}
                  {formData.autor.trim() && !errors.autor && (
                    <div className="success-message">✓ Autor válido</div>
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
                    disabled={isUploading}
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
                    disabled={isUploading}
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
                  disabled={isUploading}
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
                  disabled={isUploading}
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

            {/* Etiquetas y clasificación */}
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
                  disabled={isUploading}
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
                        disabled={isUploading}
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
                    disabled={isUploading}
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

            {/* Información adicional */}
            <div className="info-section">
              <div className="info-cards-grid">
                <div className="info-card">
                  <div className="info-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"/>
                    </svg>
                  </div>
                  <div className="info-content">
                    <h4>Calidad Académica</h4>
                    <p>Asegúrate de que tu documento cumpla con estándares académicos y esté correctamente citado.</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z"/>
                    </svg>
                  </div>
                  <div className="info-content">
                    <h4>Seguridad y Privacidad</h4>
                    <p>Tus documentos están protegidos. Solo los usuarios autorizados podrán acceder según tu configuración.</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.46,13.97L5.82,21L12,17.27Z"/>
                    </svg>
                  </div>
                  <div className="info-content">
                    <h4>Visibilidad Académica</h4>
                    <p>Comparte tu investigación con una comunidad global de investigadores y académicos.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar durante upload */}
            {isUploading && (
              <div className="upload-progress">
                <div className="progress-info">
                  <span>Subiendo documento...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/docs')}
                className="btn btn-outline btn-lg"
                disabled={isUploading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isUploading || !selectedFile}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,1A11,11 0 1,0 23,12A11,11 0 0,0 12,1M12,19A7,7 0 1,1 19,12A7,7 0 0,1 12,19Z" opacity="0.25"/>
                      <path d="M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12H21A9,9 0 0,0 12,3Z"/>
                    </svg>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/>
                    </svg>
                    Subir Documento
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

export default NewDocumentPage;