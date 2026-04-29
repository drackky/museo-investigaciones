import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';
import { ButtonLoading } from '../components/Loading';
import { validateEmail, validatePassword } from '../utils';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    tipo: 'invitado' // Por defecto invitado
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const { register, isLoading } = useAuth();
  const { error, success } = useNotifications();
  const navigate = useNavigate();

  // Validar formulario completo en tiempo real
  useEffect(() => {
    const isValid = Object.keys(errors).length === 0 && 
                   formData.nombre.trim() && 
                   formData.email.trim() && 
                   formData.password.trim() && 
                   formData.confirmPassword.trim() &&
                   validateEmail(formData.email) && 
                   formData.password.length >= 8 &&
                   formData.password === formData.confirmPassword;
    setIsFormValid(isValid);
  }, [formData, errors]);

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^A-Za-z0-9]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Calcular fortaleza de contraseña
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    
    // Validar en tiempo real si el campo ya fue tocado
    if (touched[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const validateField = (fieldName, value) => {
    const newErrors = { ...errors };

    switch (fieldName) {
      case 'nombre':
        if (!value.trim()) {
          newErrors.nombre = 'El nombre es requerido';
        } else if (value.trim().length < 2) {
          newErrors.nombre = 'El nombre debe tener al menos 2 caracteres';
        } else if (value.trim().length > 50) {
          newErrors.nombre = 'El nombre es demasiado largo';
        } else if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(value.trim())) {
          newErrors.nombre = 'El nombre solo puede contener letras y espacios';
        } else {
          delete newErrors.nombre;
        }
        break;

      case 'email':
        if (!value.trim()) {
          newErrors.email = 'El email es requerido';
        } else if (!validateEmail(value)) {
          newErrors.email = 'Ingresa un email válido (ej: usuario@dominio.com)';
        } else {
          delete newErrors.email;
        }
        break;

      case 'password':
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.isValid) {
          newErrors.password = passwordValidation.message;
        } else {
          delete newErrors.password;
        }
        
        // Re-validar confirmación de contraseña si ya existe
        if (formData.confirmPassword && formData.confirmPassword !== value) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else if (formData.confirmPassword && formData.confirmPassword === value) {
          delete newErrors.confirmPassword;
        }
        break;

      case 'confirmPassword':
        if (!value.trim()) {
          newErrors.confirmPassword = 'Confirma tu contraseña';
        } else if (formData.password !== value) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        } else {
          delete newErrors.confirmPassword;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    } else if (formData.nombre.trim().length < 2) {
      newErrors.nombre = 'El nombre debe tener al menos 2 caracteres';
    } else if (formData.nombre.trim().length > 50) {
      newErrors.nombre = 'El nombre es demasiado largo';
    } else if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(formData.nombre.trim())) {
      newErrors.nombre = 'El nombre solo puede contener letras y espacios';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Ingresa un email válido (ej: usuario@dominio.com)';
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.message;
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await register({
        nombre: formData.nombre.trim(),
        email: formData.email.trim(),
        password: formData.password,
        tipo: formData.tipo
      });
      
      success('¡Registro exitoso! Bienvenido al Museo de Investigaciones.');
      navigate('/');
    } catch (err) {
      error(err.message || 'Error al crear la cuenta. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15,14C17.67,14 23,15.33 23,18V20H7V18C7,15.33 12.33,14 15,14M15,12A4,4 0 0,1 11,8A4,4 0 0,1 15,4A4,4 0 0,1 19,8A4,4 0 0,1 15,12M5,9.59L7.12,7.46L8.54,8.88L6.41,11L8.54,13.12L7.12,14.54L5,12.41L2.88,14.54L1.46,13.12L3.59,11L1.46,8.88L2.88,7.46L5,9.59Z"/>
              </svg>
            </div>
            <h1 className="auth-title">Únete al museo</h1>
            <p className="auth-subtitle">
              Crea tu cuenta para acceder al Museo de Investigaciones Documentales
            </p>
            
            <div className="auth-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${isFormValid ? 100 : 0}%` }}></div>
              </div>
              <span className="progress-text">
                {isFormValid ? 'Formulario completo' : 'Completa los campos requeridos'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="nombre" className="form-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                </svg>
                Nombre Completo
              </label>
              <div className="input-with-icon">
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`form-input ${errors.nombre ? 'error' : touched.nombre && !errors.nombre ? 'success' : ''}`}
                  placeholder="Ingresa tu nombre completo"
                  disabled={isLoading}
                  autoComplete="name"
                />
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                  </svg>
                </div>
                {touched.nombre && !errors.nombre && formData.nombre && (
                  <div className="input-success-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                    </svg>
                  </div>
                )}
              </div>
              {errors.nombre && (
                <div className="form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                  </svg>
                  {errors.nombre}
                </div>
              )}
              {touched.nombre && !errors.nombre && formData.nombre && (
                <div className="form-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                  </svg>
                  Nombre válido
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
                </svg>
                Correo electrónico
              </label>
              <div className="input-with-icon">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`form-input ${errors.email ? 'error' : touched.email && !errors.email ? 'success' : ''}`}
                  placeholder="Ingresa tu email"
                  disabled={isLoading}
                  autoComplete="email"
                />
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
                  </svg>
                </div>
                {touched.email && !errors.email && formData.email && (
                  <div className="input-success-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                    </svg>
                  </div>
                )}
              </div>
              {errors.email && (
                <div className="form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                  </svg>
                  {errors.email}
                </div>
              )}
              {touched.email && !errors.email && formData.email && (
                <div className="form-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                  </svg>
                  Email válido
                </div>
              )}
            </div>

            <div className="info-card">
              <div className="info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A1.5,1.5 0 0,1 10.5,15.5A1.5,1.5 0 0,1 12,14A1.5,1.5 0 0,1 13.5,15.5A1.5,1.5 0 0,1 12,17M14,11V9A2,2 0 0,0 12,7A2,2 0 0,0 10,9V11A1,1 0 0,0 9,12A1,1 0 0,0 10,13H14A1,1 0 0,0 15,12A1,1 0 0,0 14,11Z"/>
                </svg>
              </div>
              <div className="info-content">
                <h3>Cuenta de Invitado</h3>
                <p>Te estás registrando como <strong>invitado</strong>. Tendrás acceso a visualizar documentos públicos y explorar las colecciones del museo.</p>
                <p><small>Para obtener permisos de investigador, contacta al administrador del museo.</small></p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
                </svg>
                Contraseña
              </label>
              <div className="input-with-icon">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`form-input ${errors.password ? 'error' : touched.password && !errors.password ? 'success' : ''}`}
                  placeholder="Crea una contraseña segura"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
                  </svg>
                </div>
                <button
                  type="button"
                  className="input-icon-button password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    {showPassword ? (
                      <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z"/>
                    ) : (
                      <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                    )}
                  </svg>
                </button>
              </div>
              
              {/* Indicador de fortaleza de contraseña */}
              {formData.password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div 
                      className={`strength-fill ${passwordStrength >= 75 ? 'strong' : passwordStrength >= 50 ? 'medium' : 'weak'}`}
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                  <span className={`strength-text ${passwordStrength >= 75 ? 'strong' : passwordStrength >= 50 ? 'medium' : 'weak'}`}>
                    {passwordStrength >= 75 ? 'Contraseña fuerte' : passwordStrength >= 50 ? 'Contraseña media' : 'Contraseña débil'}
                  </span>
                </div>
              )}

              {errors.password && (
                <div className="form-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                  </svg>
                  {errors.password}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmar Contraseña
              </label>
              <div className="input-with-icon">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  placeholder="Confirma tu contraseña"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="input-icon-button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    {showConfirmPassword ? (
                      <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z"/>
                    ) : (
                      <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                    )}
                  </svg>
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="form-error">{errors.confirmPassword}</span>
              )}
            </div>

            <button 
              type="submit" 
              className={`btn btn-primary btn-full ${!isFormValid && !isLoading ? 'btn-disabled' : ''}`}
              disabled={isLoading || !isFormValid}
            >
              <ButtonLoading isLoading={isLoading} loadingText="Creando cuenta...">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15,14C17.67,14 23,15.33 23,18V20H7V18C7,15.33 12.33,14 15,14M15,12A4,4 0 0,1 11,8A4,4 0 0,1 15,4A4,4 0 0,1 19,8A4,4 0 0,1 15,12M5,9.59L7.12,7.46L8.54,8.88L6.41,11L8.54,13.12L7.12,14.54L5,12.41L2.88,14.54L1.46,13.12L3.59,11L1.46,8.88L2.88,7.46L5,9.59Z"/>
                </svg>
                Crear Cuenta
              </ButtonLoading>
            </button>
            
            {!isFormValid && (Object.keys(touched).length > 0) && (
              <div className="form-hint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                Completa todos los campos correctamente para crear tu cuenta
              </div>
            )}
          </form>

          <div className="auth-footer">
            <p>
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="auth-link">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;