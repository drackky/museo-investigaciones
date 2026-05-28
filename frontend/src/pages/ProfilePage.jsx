import React, { useState } from 'react';
import { useAuth } from '../context/AuthContextSimple';
import { apiService } from '../services/apiService';

const ProfilePage = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nombre: user?.nombre || '',
    institucion: user?.institucion || '',
  });
  const [mensaje, setMensaje] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      await apiService.users.updateProfile(formData);
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      localStorage.setItem('user_data', JSON.stringify({ ...userData, ...formData }));
      setMensaje('✅ Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (err) {
      setMensaje('❌ Error de conexión');
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Mi Perfil</h1>
        <p className="page-subtitle">Gestiona tu información personal</p>
      </div>

      <div className="profile-card" style={{ maxWidth: 600, margin: '0 auto', background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        
        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#1E4D8C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
              {user?.nombre?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{user?.nombre}</div>
          <div style={{ color: '#666', fontSize: 14 }}>{user?.email}</div>
          <span style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', background: user?.rol === 'investigador' ? '#1E4D8C' : '#6c757d', color: '#fff', borderRadius: 20, fontSize: 12 }}>
            {user?.rol || 'invitado'}
          </span>
        </div>

        {/* Campos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Nombre</label>
            {isEditing ? (
              <input
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            ) : (
              <div style={{ padding: '8px 12px', background: '#f5f7fa', borderRadius: 8 }}>{user?.nombre || '—'}</div>
            )}
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Email</label>
            <div style={{ padding: '8px 12px', background: '#f5f7fa', borderRadius: 8, color: '#666' }}>{user?.email || '—'}</div>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Institución</label>
            {isEditing ? (
              <input
                name="institucion"
                value={formData.institucion}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            ) : (
              <div style={{ padding: '8px 12px', background: '#f5f7fa', borderRadius: 8 }}>{user?.institucion || '—'}</div>
            )}
          </div>

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Rol</label>
            <div style={{ padding: '8px 12px', background: '#f5f7fa', borderRadius: 8, color: '#666' }}>{user?.rol || '—'}</div>
          </div>
        </div>

        {/* Mensaje */}
        {mensaje && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: mensaje.includes('✅') ? '#e8f5e9' : '#ffebee', borderRadius: 8, fontSize: 14 }}>
            {mensaje}
          </div>
        )}

        {/* Botones */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setMensaje(''); }} style={{ padding: '10px 20px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSave} style={{ padding: '10px 20px', background: '#1E4D8C', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                Guardar cambios
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} style={{ padding: '10px 20px', background: '#1E4D8C', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
              Editar perfil
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;