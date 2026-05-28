import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import apiService from '../services/apiService';

const NewCollectionPage = () => {
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    is_publica: true,
    tags: '',
    area_tematica: '',
    periodo_historico: '',
    idioma: 'español'
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formProgress, setFormProgress] = useState(0);
  
  const { isAuthenticated, isResearcher } = useAuth();
  const { error, success } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !isResearcher()) {
      navigate('/cols');
      return;
    }
  }, [isAuthenticated, isResearcher, navigate]);

  // Calcular progreso del formulario
  useEffect(() => {
    const requiredFields = ['titulo', 'descripcion'];
    const optionalFields = ['area_tematica', 'periodo_historico', 'tags'];
    const totalFields = requiredFields.length + optionalFields.length + (selectedImage ? 1 : 0);
    
    let filledFields = 0;
    requiredFields.forEach(field => {
      if (formData[field]?.trim()) filledFields++;
    });
    optionalFields.forEach(field => {
      if (formData[field]?.trim()) filledFields++;
    });
    if (selectedImage) filledFields++;
    
    setFormProgress((filledFields / totalFields) * 100);
  }, [formData, selectedImage]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        portada: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP, BMP, TIFF, SVG)'
      }));
      setSelectedImage(null);
      setImagePreview(null);
      return;
    }

    // Validar tamaño (15MB máximo)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setErrors(prev => ({
        ...prev,
        portada: 'La imagen no puede superar los 15MB'
      }));
      setSelectedImage(null);
      setImagePreview(null);
      return;
    }

    setSelectedImage(file);
    setErrors(prev => ({
      ...prev,
      portada: null
    }));

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setErrors(prev => ({
      ...prev,
      portada: null
    }));
    
    // Limpiar input file
    const fileInput = document.getElementById('image-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'El título es requerido';
    } else if (formData.titulo.trim().length < 3) {
      newErrors.titulo = 'El título debe tener al menos 3 caracteres';
    } else if (formData.titulo.trim().length > 200) {
      newErrors.titulo = 'El título no puede exceder 200 caracteres';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    } else if (formData.descripcion.trim().length < 10) {
      newErrors.descripcion = 'La descripción debe tener al menos 10 caracteres';
    } else if (formData.descripcion.trim().length > 2000) {
      newErrors.descripcion = 'La descripción no puede exceder 2000 caracteres';
    }

    if (formData.tags && formData.tags.split(',').some(tag => tag.trim().length > 50)) {
      newErrors.tags = 'Cada etiqueta no puede exceder 50 caracteres';
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

    try {
      const formDataToSend = new FormData();
      
      // Agregar imagen si existe
      if (selectedImage) {
        formDataToSend.append('portada', selectedImage);
      }
      
      // Agregar campos del formulario
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          formDataToSend.append(key, formData[key]);
        }
      });

      const data = await apiService.collections.create(formDataToSend);
      success('Colección creada exitosamente');
      navigate(`/cols/${data.collection.id}`);
    } catch (err) {
      console.error('Error creando colección:', err);
      error(err.message || 'Error al crear la colección. Inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
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
    <div className="new-collection-page">
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-section">
            <h1>Nueva Colección</h1>
            <p className="page-subtitle">
              Organiza documentos relacionados en una colección temática
            </p>
            <div className="form-progress">
              <div className="progress-label">Progreso del formulario: {Math.round(formProgress)}%</div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${formProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="upload-form-container">
          <form onSubmit={handleSubmit} className="upload-form">
            {/* Imagen de portada */}
            <div className="form-section">
              <h3 className="section-title">Imagen de Portada (Opcional)</h3>
              
              <div className="image-upload-area">
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" className="preview-image" />
                    <div className="image-info">
                      <div className="image-details">
                        <div className="image-name">{selectedImage.name}</div>
                        <div className="image-size">{formatFileSize(selectedImage.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="btn btn-danger btn-small"
                        disabled={isUploading}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      id="image-input"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="file-input-hidden"
                      disabled={isUploading}
                    />
                    
                    <label htmlFor="image-input" className="image-upload-label">
                      <div className="upload-prompt">
                        <div className="upload-icon">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/>
                          </svg>
                        </div>
                        <div className="upload-text">
                          <strong>Selecciona una imagen</strong>
                          <p>JPG, PNG, GIF, WebP, BMP, TIFF, SVG</p>
                          <small>Máximo 15MB</small>
                        </div>
                      </div>
                    </label>
                  </>
                )}
                
                {errors.portada && <div className="error-message">{errors.portada}</div>}
              </div>
            </div>

            {/* Información básica */}
            <div className="form-section">
              <h3 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                Información Básica
              </h3>
              
              <div className="form-group">
                <label htmlFor="titulo" className="form-label required">
                  Título de la Colección
                  <span className="field-counter">{formData.titulo.length}/200</span>
                </label>
                <input
                  type="text"
                  id="titulo"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleInputChange}
                  className={`form-input ${errors.titulo ? 'error' : formData.titulo.trim() ? 'valid' : ''}`}
                  placeholder="Ejemplo: Manuscritos Medievales de León"
                  disabled={isUploading}
                  maxLength="200"
                />
                {errors.titulo && <div className="error-message">{errors.titulo}</div>}
                {formData.titulo.trim() && !errors.titulo && (
                  <div className="success-message">✓ Título válido</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="descripcion" className="form-label required">
                  Descripción Detallada
                  <span className="field-counter">{formData.descripcion.length}/2000</span>
                </label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  className={`form-textarea ${errors.descripcion ? 'error' : formData.descripcion.trim().length >= 10 ? 'valid' : ''}`}
                  rows="6"
                  placeholder="Describe el tema, contexto histórico, tipo de documentos y objetivos de esta colección..."
                  disabled={isUploading}
                  maxLength="2000"
                />
                {errors.descripcion && <div className="error-message">{errors.descripcion}</div>}
                {formData.descripcion.trim().length >= 10 && !errors.descripcion && (
                  <div className="success-message">✓ Descripción completa</div>
                )}
                <small className="form-help">
                  Una descripción detallada mejora la visibilidad y comprensión de tu colección
                </small>
              </div>
            </div>

            {/* Información temática */}
            <div className="form-section">
              <h3 className="section-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.63,5.84C17.27,5.33 16.67,5 16,5L5,5.01C3.9,5.01 3,5.9 3,7V17C3,18.1 3.9,19 5,19H16C16.67,19 17.27,18.67 17.63,18.16L22,12L17.63,5.84Z"/>
                </svg>
                Clasificación Temática
              </h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="area_tematica" className="form-label">
                    Área Temática
                  </label>
                  <select
                    id="area_tematica"
                    name="area_tematica"
                    value={formData.area_tematica}
                    onChange={handleInputChange}
                    className={`form-select ${formData.area_tematica ? 'valid' : ''}`}
                    disabled={isUploading}
                  >
                    <option value="">Selecciona un área</option>
                    <option value="historia">Historia</option>
                    <option value="arqueologia">Arqueología</option>
                    <option value="antropologia">Antropología</option>
                    <option value="arte">Arte y Cultura</option>
                    <option value="literatura">Literatura</option>
                    <option value="ciencias">Ciencias</option>
                    <option value="religion">Religión y Filosofía</option>
                    <option value="politica">Política y Derecho</option>
                    <option value="economia">Economía y Comercio</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="periodo_historico" className="form-label">
                    Período Histórico
                  </label>
                  <input
                    type="text"
                    id="periodo_historico"
                    name="periodo_historico"
                    value={formData.periodo_historico}
                    onChange={handleInputChange}
                    className={`form-input ${formData.periodo_historico.trim() ? 'valid' : ''}`}
                    placeholder="Ej: Siglo XV-XVI, Época Colonial, Contemporáneo"
                    disabled={isUploading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="idioma" className="form-label">
                    Idioma Principal
                  </label>
                  <select
                    id="idioma"
                    name="idioma"
                    value={formData.idioma}
                    onChange={handleInputChange}
                    className="form-select valid"
                    disabled={isUploading}
                  >
                    <option value="español">Español</option>
                    <option value="latin">Latín</option>
                    <option value="catalán">Catalán</option>
                    <option value="gallego">Gallego</option>
                    <option value="euskera">Euskera</option>
                    <option value="árabe">Árabe</option>
                    <option value="hebreo">Hebreo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tags" className="form-label">
                  Etiquetas (separadas por comas)
                </label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className={`form-input ${formData.tags.trim() ? 'valid' : ''} ${errors.tags ? 'error' : ''}`}
                  placeholder="medieval, manuscritos, religión, historia"
                  disabled={isUploading}
                />
                {errors.tags && <div className="error-message">{errors.tags}</div>}
                <small className="form-help">
                  Las etiquetas ayudan a otros investigadores a encontrar tu colección
                </small>
              </div>

              <div className="form-group">
                <div className="checkbox-group enhanced">
                  <input
                    type="checkbox"
                    id="is_publica"
                    name="is_publica"
                    checked={formData.is_publica}
                    onChange={handleInputChange}
                    className="form-checkbox"
                    disabled={isUploading}
                  />
                  <label htmlFor="is_publica" className="checkbox-label">
                    <div className="checkbox-icon">
                      {formData.is_publica ? (
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
                      <strong>Colección pública</strong>
                      <small>{formData.is_publica ? 'Visible para todos los usuarios' : 'Solo visible para ti'}</small>
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
                      <path d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V5H19V19Z"/>
                    </svg>
                  </div>
                  <div className="info-content">
                    <h4>Organización Inteligente</h4>
                    <p>Agrupa documentos por tema, período histórico o cualquier criterio académico relevante.</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M15.5,8A1.5,1.5 0 0,0 14,9.5A1.5,1.5 0 0,0 15.5,11A1.5,1.5 0 0,0 17,9.5A1.5,1.5 0 0,0 15.5,8M10,17L15.5,12L13,9.5L10,12.5L8.5,11L6,13.5L10,17Z"/>
                    </svg>
                  </div>
                  <div className="info-content">
                    <h4>Colaboración Académica</h4>
                    <p>Facilita el descubrimiento y la colaboración entre investigadores con intereses similares.</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                    </svg>
                  </div>
                  <div className="info-content">
                    <h4>Descubrimiento Mejorado</h4>
                    <p>Las etiquetas y metadatos mejoran la visibilidad y facilitan la búsqueda temática.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/cols')}
                className="btn btn-outline btn-lg"
                disabled={isUploading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,1A11,11 0 1,0 23,12A11,11 0 0,0 12,1M12,19A7,7 0 1,1 19,12A7,7 0 0,1 12,19Z" opacity="0.25"/>
                      <path d="M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12H21A9,9 0 0,0 12,3Z"/>
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                    </svg>
                    Crear Colección
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

export default NewCollectionPage;