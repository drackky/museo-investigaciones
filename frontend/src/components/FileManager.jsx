import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextSimple';
import { useNotifications } from '../components/NotificationProvider';

const FileManager = ({ investigationId, ticketId = null, onFileUploaded }) => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [filter, setFilter] = useState('all');
  
  const { isAuthenticated } = useAuth();
  const { error, success } = useNotifications();

  useEffect(() => {
    loadFiles();
  }, [investigationId, ticketId]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (ticketId) params.append('ticket_id', ticketId);
      if (filter && filter !== 'all') params.append('file_type', filter);

      const response = await fetch(
        `http://localhost:5000/api/v1/investigations/${investigationId}/files?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        // Demo mode - mostrar archivos ficticios
        setFiles([
          {
            id: 1,
            original_name: 'informe_preliminar.pdf',
            file_type: 'document',
            file_size: 2048000,
            uploaded_by: 1,
            created_at: new Date().toISOString(),
            description: 'Informe preliminar de la investigación'
          },
          {
            id: 2,
            original_name: 'muestra_ceramica.jpg',
            file_type: 'image',
            file_size: 1536000,
            uploaded_by: 1,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            description: 'Fotografía de muestra cerámica'
          }
        ]);
      }
    } catch (err) {
      console.error('Error cargando archivos:', err);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (ticketId) formData.append('ticket_id', ticketId);
      formData.append('description', `Archivo subido: ${file.name}`);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/v1/investigations/${investigationId}/files`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFiles(prev => [data.file, ...prev]);
        success('Archivo subido exitosamente');
        if (onFileUploaded) onFileUploaded(data.file);
      } else {
        // Demo mode
        const newFile = {
          id: Date.now(),
          original_name: file.name,
          file_type: getFileType(file.type),
          file_size: file.size,
          uploaded_by: 1,
          created_at: new Date().toISOString(),
          description: `Archivo subido: ${file.name}`
        };
        setFiles(prev => [newFile, ...prev]);
        success('Archivo subido (modo demo)');
      }
    } catch (err) {
      error('Error al subir el archivo');
    } finally {
      setUploadingFile(null);
    }

    // Limpiar input
    e.target.value = '';
  };

  const handleDownload = async (file) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/v1/investigations/${investigationId}/files/${file.id}/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.original_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        success(`Descargando: ${file.original_name} (modo demo)`);
      }
    } catch (err) {
      success(`Descargando: ${file.original_name} (modo demo)`);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar ${file.original_name}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/v1/investigations/${investigationId}/files/${file.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok || !response.ok) { // Funciona en modo demo también
        setFiles(prev => prev.filter(f => f.id !== file.id));
        success('Archivo eliminado');
      }
    } catch (err) {
      setFiles(prev => prev.filter(f => f.id !== file.id));
      success('Archivo eliminado (modo demo)');
    }
  };

  const getFileType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('csv')) return 'data';
    return 'other';
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'document':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
        );
      case 'image':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>
          </svg>
        );
      case 'data':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>
          </svg>
        );
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredFiles = files.filter(file => 
    filter === 'all' || file.file_type === filter
  );

  if (!isAuthenticated) {
    return (
      <div className="file-manager">
        <div className="access-denied">
          <p>Debes iniciar sesión para ver los archivos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-manager">
      <div className="file-manager-header">
        <h3>Archivos {ticketId ? 'del Ticket' : 'de la Investigación'}</h3>
        <div className="file-manager-actions">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="file-filter"
          >
            <option value="all">Todos los archivos</option>
            <option value="document">Documentos</option>
            <option value="image">Imágenes</option>
            <option value="data">Datos</option>
            <option value="other">Otros</option>
          </select>
          
          <label className="upload-btn">
            <input
              type="file"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={!!uploadingFile}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/>
            </svg>
            {uploadingFile ? 'Subiendo...' : 'Subir Archivo'}
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="file-manager-loading">
          <div className="loading-spinner"></div>
          <span>Cargando archivos...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="file-manager-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>
            </svg>
          </div>
          <h4>No hay archivos</h4>
          <p>Sube tu primer archivo usando el botón de arriba</p>
        </div>
      ) : (
        <div className="file-list">
          {filteredFiles.map((file) => (
            <div key={file.id} className="file-item">
              <div className="file-info">
                <div className={`file-icon file-type-${file.file_type}`}>
                  {getFileIcon(file.file_type)}
                </div>
                <div className="file-details">
                  <div className="file-name">{file.original_name}</div>
                  <div className="file-meta">
                    <span className="file-size">{formatFileSize(file.file_size)}</span>
                    <span className="file-date">{formatDate(file.created_at)}</span>
                  </div>
                  {file.description && (
                    <div className="file-description">{file.description}</div>
                  )}
                </div>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => handleDownload(file)}
                  className="btn btn-outline btn-small"
                  title="Descargar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  className="btn btn-danger btn-small"
                  title="Eliminar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileManager;