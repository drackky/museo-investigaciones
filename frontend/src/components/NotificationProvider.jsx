import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Context para notificaciones
const NotificationContext = createContext();

// Tipos de notificaciones
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Reducer para manejar notificaciones
const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: []
      };
    
    default:
      return state;
  }
};

// Provider de notificaciones
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: []
  });

  const addNotification = (message, type = NOTIFICATION_TYPES.INFO, duration = 5000) => {
    const id = Date.now() + Math.random();
    
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id,
        message,
        type,
        timestamp: new Date()
      }
    });

    // Auto-remove después del tiempo especificado
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    dispatch({
      type: 'REMOVE_NOTIFICATION',
      payload: id
    });
  };

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  // Métodos de conveniencia
  const success = (message, duration) => addNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
  const error = (message, duration = 8000) => addNotification(message, NOTIFICATION_TYPES.ERROR, duration);
  const warning = (message, duration) => addNotification(message, NOTIFICATION_TYPES.WARNING, duration);
  const info = (message, duration) => addNotification(message, NOTIFICATION_TYPES.INFO, duration);

  const value = {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Hook para usar notificaciones
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications debe ser usado dentro de NotificationProvider');
  }
  return context;
};

// Componente individual de notificación
const NotificationItem = ({ notification, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 300); // Pequeño delay para la animación

    return () => clearTimeout(timer);
  }, [onRemove]);

  const getIcon = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
          </svg>
        );
      case NOTIFICATION_TYPES.ERROR:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        );
      case NOTIFICATION_TYPES.WARNING:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
          </svg>
        );
    }
  };

  return (
    <div className={`notification notification-${notification.type}`}>
      <div className="notification-icon">
        {getIcon()}
      </div>
      <div className="notification-content">
        <p className="notification-message">{notification.message}</p>
      </div>
      <button 
        className="notification-close"
        onClick={onRemove}
        aria-label="Cerrar notificación"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
        </svg>
      </button>
    </div>
  );
};

// Container de notificaciones
const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

export default NotificationProvider;