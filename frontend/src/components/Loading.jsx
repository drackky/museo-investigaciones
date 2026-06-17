import React from 'react';

// Spinner básico
export const Spinner = ({ size = 'medium', className = '' }) => {
  return (
    <div className={`spinner spinner-${size} ${className}`}>
      <div className="spinner-circle"></div>
    </div>
  );
};

// Loading overlay completo
export const LoadingOverlay = ({ isLoading, message = 'Cargando...', children }) => {
  if (!isLoading) {
    return children;
  }

  return (
    <div className="loading-overlay-container">
      {children && (
        <div className="loading-overlay-content">
          {children}
        </div>
      )}
      <div className="loading-overlay">
        <div className="loading-content">
          <Spinner size="large" />
          <p className="loading-message">{message}</p>
        </div>
      </div>
    </div>
  );
};

// Loading inline
export const LoadingInline = ({ message = 'Cargando...', size = 'medium' }) => {
  return (
    <div className="loading-inline">
      <Spinner size={size} />
      <span className="loading-message">{message}</span>
    </div>
  );
};

// Loading para botones
export const ButtonLoading = ({ isLoading, children, loadingText = 'Cargando...' }) => {
  return (
    <>
      {isLoading && <Spinner size="small" className="button-spinner" />}
      <span className={isLoading ? 'button-loading-text' : ''}>
        {isLoading ? loadingText : children}
      </span>
    </>
  );
};

// Loading skeleton para listas
export const SkeletonItem = ({ lines = 1, withAvatar = false }) => {
  return (
    <div className="skeleton-item">
      {withAvatar && <div className="skeleton-avatar"></div>}
      <div className="skeleton-content">
        {Array.from({ length: lines }, (_, i) => (
          <div 
            key={i} 
            className={`skeleton-line ${i === lines - 1 ? 'skeleton-line-short' : ''}`}
          ></div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonList = ({ items = 3, linesPerItem = 2, withAvatars = false }) => {
  return (
    <div className="skeleton-list">
      {Array.from({ length: items }, (_, i) => (
        <SkeletonItem 
          key={i} 
          lines={linesPerItem} 
          withAvatar={withAvatars}
        />
      ))}
    </div>
  );
};

// Loading para cards
export const SkeletonCard = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header"></div>
      <div className="skeleton-card-content">
        <div className="skeleton-line"></div>
        <div className="skeleton-line"></div>
        <div className="skeleton-line skeleton-line-short"></div>
      </div>
      <div className="skeleton-card-actions">
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
      </div>
    </div>
  );
};

// Loading page completo
export const LoadingPage = ({ message = 'Cargando página...' }) => {
  return (
    <div className="loading-page">
      <div className="loading-page-content">
        <Spinner size="large" />
        <h2 className="loading-page-title">{message}</h2>
        <p className="loading-page-subtitle">Por favor espera un momento</p>
      </div>
    </div>
  );
};

// Hook para manejar estados de loading
export const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [loadingMessage, setLoadingMessage] = React.useState('');

  const startLoading = (message = 'Cargando...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setLoadingMessage('');
  };

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading
  };
};

export default {
  Spinner,
  LoadingOverlay,
  LoadingInline,
  ButtonLoading,
  SkeletonItem,
  SkeletonList,
  SkeletonCard,
  LoadingPage,
  useLoading
};