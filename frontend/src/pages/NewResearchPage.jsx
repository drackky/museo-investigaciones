import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';

const NewResearchPage = () => {
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    institucion: '',
    prioridad: 'media',
    fecha_inicio: '',
    fecha_fin_estimada: '',
    presupuesto: '',
    objetivos: '',
    metodologia: '',
    area_investigacion: '',
    tipo_estudio: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formProgress, setFormProgress] = useState(0);
  
  const { isAuthenticated, isResearcher, user } = useAuth();
  const { error, success } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !isResearcher()) {
      navigate('/research');
      return;
    }

    // Pre-cargar datos del usuario
    if (user) {
      setFormData(prev => ({
        ...prev,
        institucion: user.institucion || ''
      }));
    }
  }, [isAuthenticated, isResearcher, user, navigate]);

  // Calcular progreso del formulario
  useEffect(() => {
    const requiredFields = ['titulo', 'descripcion'];
    const optionalFields = ['institucion', 'objetivos', 'metodologia', 'area_investigacion', 'tipo_estudio', 'fecha_inicio', 'fecha_fin_estimada', 'presupuesto'];
    const totalFields = requiredFields.length + optionalFields.length;
    
    let filledFields = 0;
    requiredFields.forEach(field => {
      if (formData[field]?.trim()) filledFields++;
    });
    optionalFields.forEach(field => {
      if (formData[field]?.toString().trim()) filledFields++;
    });
    
    setFormProgress((filledFields / totalFields) * 100);
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error del campo
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
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    }

    if (formData.fecha_inicio && formData.fecha_fin_estimada) {
      const inicio = new Date(formData.fecha_inicio);
      const fin = new Date(formData.fecha_fin_estimada);
      if (fin <= inicio) {
        newErrors.fecha_fin_estimada = 'La fecha de fin debe ser posterior a la de inicio';
      }
    }

    if (formData.presupuesto && isNaN(parseFloat(formData.presupuesto))) {
      newErrors.presupuesto = 'El presupuesto debe ser un número válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        presupuesto: formData.presupuesto ? parseFloat(formData.presupuesto) : null
      };

      // Limpiar campos vacíos
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          submitData[key] = null;
        }
      });

      const token = localStorage.getItem('token');
      // Intentar primero con API Gateway
      let response = await fetch('http://localhost:5000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const data = await response.json();
        success('Investigación creada exitosamente');
        navigate(`/research`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la investigación');
      }
    } catch (err) {
      console.error('Error creando investigación:', err);
      error(err.message || 'Error al crear la investigación. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || !isResearcher()) {
    return null;
  }

  return (
    <div className="new-research-page">
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-section">
            <h1>Nueva Investigación</h1>
            <p className="page-subtitle">
              Inicia un nuevo proyecto de investigación y gestiona su progreso
            </p>
          </div>
        </div>

        <div className="upload-form-container">
          <form onSubmit={handleSubmit} className="upload-form">
            {/* Información básica */}
            <div className="form-section">
              <h3 className="section-title">Información General</h3>
              
              <div className="form-group">
                <label htmlFor="titulo" className="form-label required">
                  Título de la Investigación
                </label>
                <input
                  type="text"
                  id="titulo"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleInputChange}
                  className={`form-input ${errors.titulo ? 'error' : ''}`}
                  placeholder="Ejemplo: Análisis de cerámicas precolombinas en la región andina"
                  disabled={isSubmitting}
                />
                {errors.titulo && <div className="error-message">{errors.titulo}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="descripcion" className="form-label required">
                  Descripción del Proyecto
                </label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  className={`form-textarea ${errors.descripcion ? 'error' : ''}`}
                  rows="6"
                  placeholder="Describe los objetivos, metodología y alcance de la investigación..."
                  disabled={isSubmitting}
                />
                {errors.descripcion && <div className="error-message">{errors.descripcion}</div>}
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
                  className="form-input"
                  placeholder="Universidad, museo u organización responsable"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Configuración del proyecto */}
            <div className="form-section">
              <h3 className="section-title">Planificación</h3>
              
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="prioridad" className="form-label">
                    Prioridad
                  </label>
                  <select
                    id="prioridad"
                    name="prioridad"
                    value={formData.prioridad}
                    onChange={handleInputChange}
                    className="form-select"
                    disabled={isSubmitting}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="presupuesto" className="form-label">
                    Presupuesto (USD)
                  </label>
                  <input
                    type="number"
                    id="presupuesto"
                    name="presupuesto"
                    value={formData.presupuesto}
                    onChange={handleInputChange}
                    className={`form-input ${errors.presupuesto ? 'error' : ''}`}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    disabled={isSubmitting}
                  />
                  {errors.presupuesto && <div className="error-message">{errors.presupuesto}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="fecha_inicio" className="form-label">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    id="fecha_inicio"
                    name="fecha_inicio"
                    value={formData.fecha_inicio}
                    onChange={handleInputChange}
                    className="form-input"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fecha_fin_estimada" className="form-label">
                    Fecha de Finalización Estimada
                  </label>
                  <input
                    type="date"
                    id="fecha_fin_estimada"
                    name="fecha_fin_estimada"
                    value={formData.fecha_fin_estimada}
                    onChange={handleInputChange}
                    className={`form-input ${errors.fecha_fin_estimada ? 'error' : ''}`}
                    disabled={isSubmitting}
                  />
                  {errors.fecha_fin_estimada && <div className="error-message">{errors.fecha_fin_estimada}</div>}
                </div>
              </div>
            </div>

            {/* Información sobre el flujo de trabajo */}
            <div className="info-section">
              <div className="info-card">
                <div className="info-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                  </svg>
                </div>
                <div className="info-content">
                  <h4>Gestión de Investigaciones</h4>
                  <p>Una vez creada la investigación, podrás:</p>
                  <ul>
                    <li>Crear y gestionar tickets/tareas específicas</li>
                    <li>Invitar colaboradores al proyecto</li>
                    <li>Hacer seguimiento del progreso</li>
                    <li>Asociar documentos y colecciones</li>
                    <li>Generar reportes de avance</li>
                  </ul>
                </div>
              </div>

              <div className="priority-info">
                <h4>Niveles de Prioridad:</h4>
                <div className="priority-grid">
                  <div className="priority-item priority-baja">
                    <span className="priority-label">Baja</span>
                    <small>Investigaciones de largo plazo, sin urgencia</small>
                  </div>
                  <div className="priority-item priority-media">
                    <span className="priority-label">Media</span>
                    <small>Proyectos regulares con plazos estándar</small>
                  </div>
                  <div className="priority-item priority-alta">
                    <span className="priority-label">Alta</span>
                    <small>Proyectos importantes con plazos ajustados</small>
                  </div>
                  <div className="priority-item priority-critica">
                    <span className="priority-label">Crítica</span>
                    <small>Investigaciones urgentes o con financiación limitada</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/research')}
                className="btn btn-outline btn-lg"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
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
                    Crear Investigación
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

export default NewResearchPage;