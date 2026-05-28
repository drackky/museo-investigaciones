import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextSimple';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';

const ResearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [investigaciones, setInvestigaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [formData, setFormData] = useState({
    titulo: '', descripcion: '', prioridad: 'media',
    fecha_inicio: '', fecha_fin_estimada: '', institucion: ''
  });
  const [stats, setStats] = useState({ investigaciones_activas: 0, tickets_completados: 0, total_colaboradores: 0 });

  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

  useEffect(() => {
    loadInvestigaciones();
    loadStats();
  }, []);

  const loadInvestigaciones = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.research.getAll();
      setInvestigaciones(data.investigaciones || []);
    } catch (err) {
      console.error('Error cargando investigaciones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiService.get('/research/dashboard');
      setStats(data.stats || {});
    } catch (err) {
      console.error('Error cargando stats:', err);
    }
  };

  const handleCrear = async () => {
    if (!formData.titulo.trim()) {
      setMensaje('❌ El título es requerido');
      return;
    }
    try {
      await apiService.research.create(formData);
      setMensaje('✅ Investigación creada exitosamente');
      setShowForm(false);
      setFormData({ titulo: '', descripcion: '', prioridad: 'media', fecha_inicio: '', fecha_fin_estimada: '', institucion: '' });
      loadInvestigaciones();
      loadStats();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error de conexión';
      setMensaje('❌ ' + errorMsg);
    }
  };

  const coloresPrioridad = { baja: '#28a745', media: '#ffc107', alta: '#fd7e14', critica: '#dc3545' };
  const coloresEstado = { planificacion: '#6c757d', en_progreso: '#007bff', revision: '#ffc107', completada: '#28a745', pausada: '#fd7e14' };

  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };

  return (
    <div className="research-page" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, color: '#1E4D8C' }}>Investigaciones</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>Gestiona tus proyectos de investigación</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setMensaje(''); }}
          style={{ padding: '10px 20px', background: '#1E4D8C', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
          {showForm ? 'Cancelar' : '+ Nueva Investigación'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Investigaciones Activas', value: stats.investigaciones_activas || 0, color: '#1E4D8C' },
          { label: 'Tickets Completados',     value: stats.tickets_completados || 0,    color: '#28a745' },
          { label: 'Colaboradores',           value: stats.total_colaboradores || 0,    color: '#fd7e14' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderTop: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ color: '#666', fontSize: 14 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#1E4D8C' }}>Nueva Investigación</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Título *</label>
              <input style={inputStyle} value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} placeholder="Título de la investigación" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Descripción</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Descripción del proyecto..." />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Institución</label>
              <input style={inputStyle} value={formData.institucion} onChange={e => setFormData({...formData, institucion: e.target.value})} placeholder="Institución" />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Prioridad</label>
              <select style={inputStyle} value={formData.prioridad} onChange={e => setFormData({...formData, prioridad: e.target.value})}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Fecha inicio</label>
              <input type="date" style={inputStyle} value={formData.fecha_inicio} onChange={e => setFormData({...formData, fecha_inicio: e.target.value})} />
            </div>
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Fecha fin estimada</label>
              <input type="date" style={inputStyle} value={formData.fecha_fin_estimada} onChange={e => setFormData({...formData, fecha_fin_estimada: e.target.value})} />
            </div>
          </div>
          {mensaje && (
            <div style={{ marginTop: 12, padding: '8px 16px', background: mensaje.includes('✅') ? '#e8f5e9' : '#ffebee', borderRadius: 8, fontSize: 14 }}>
              {mensaje}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleCrear} style={{ padding: '10px 20px', background: '#1E4D8C', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>Crear Investigación</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>Cargando investigaciones...</div>
      ) : investigaciones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
          <h3 style={{ color: '#1E4D8C' }}>No tienes investigaciones aún</h3>
          <p style={{ color: '#666' }}>Crea tu primera investigación con el botón de arriba</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {investigaciones.map(inv => (
            <div key={inv.id} onClick={() => navigate(`/research/${inv.id}`)} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: `4px solid ${coloresPrioridad[inv.prioridad] || '#ccc'}`, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{inv.codigo}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 'bold', background: coloresEstado[inv.estado] || '#ccc', color: '#fff' }}>
                      {inv.estado?.replace('_', ' ')}
                    </span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, background: coloresPrioridad[inv.prioridad] + '22', color: coloresPrioridad[inv.prioridad], fontWeight: 'bold' }}>
                      {inv.prioridad}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 8px', color: '#1E4D8C' }}>{inv.titulo}</h3>
                  {inv.descripcion && <p style={{ margin: '0 0 8px', color: '#666', fontSize: 14 }}>{inv.descripcion}</p>}
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#888' }}>
                    {inv.institucion && <span>🏛️ {inv.institucion}</span>}
                    {inv.fecha_inicio && <span>📅 Inicio: {inv.fecha_inicio}</span>}
                    {inv.fecha_fin_estimada && <span>🏁 Fin estimado: {inv.fecha_fin_estimada}</span>}
                    <span>👥 {inv.total_colaboradores} colaborador(es)</span>
                    <span>🎫 {inv.total_tickets} ticket(s)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>Progreso</div>
                  <div style={{ width: 120, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${inv.progreso || 0}%`, height: '100%', background: '#1E4D8C', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1E4D8C' }}>{inv.progreso || 0}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResearchPage;