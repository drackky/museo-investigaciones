import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import FileManager from '../components/FileManager';

const ResearchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [investigacion, setInvestigacion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvestigacion();
  }, [id]);

  const loadInvestigacion = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await apiService.get(`/investigations/${id}`);
      setInvestigacion(data.investigation);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Investigación no encontrada');
      } else {
        console.error('Error cargando investigación:', err);
        setError('Error de conexión con el servidor');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const coloresPrioridad = { baja: '#28a745', media: '#ffc107', alta: '#fd7e14', critica: '#dc3545' };
  const coloresEstado = { planificacion: '#6c757d', en_progreso: '#007bff', revision: '#ffc107', completada: '#28a745', pausada: '#fd7e14' };
  const coloresTicketEstado = { pendiente: '#6c757d', en_progreso: '#007bff', en_revision: '#ffc107', completado: '#28a745', cancelado: '#dc3545' };
  const coloresTicketTipo = { tarea: '#007bff', bug: '#dc3545', mejora: '#28a745', investigacion: '#6f42c1' };

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#666' }}>
        Cargando investigación...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => navigate('/research')} style={{ padding: '8px 16px', background: '#1E4D8C', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 16 }}>
          ← Volver a Investigaciones
        </button>
        <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
          <h3 style={{ color: '#dc3545' }}>{error}</h3>
        </div>
      </div>
    );
  }

  if (!investigacion) return null;

  const inv = investigacion;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/research')} style={{ padding: '8px 16px', background: 'transparent', color: '#1E4D8C', border: '1px solid #1E4D8C', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          ← Volver a Investigaciones
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: `4px solid ${coloresPrioridad[inv.prioridad] || '#ccc'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#888', fontFamily: 'monospace' }}>{inv.codigo}</span>
              <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 'bold', background: coloresEstado[inv.estado] || '#ccc', color: '#fff' }}>
                {inv.estado?.replace('_', ' ')}
              </span>
              <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, background: coloresPrioridad[inv.prioridad] + '22', color: coloresPrioridad[inv.prioridad], fontWeight: 'bold' }}>
                {inv.prioridad}
              </span>
            </div>
            <h1 style={{ margin: '0 0 8px', color: '#1E4D8C', fontSize: 24 }}>{inv.titulo}</h1>
            {inv.descripcion && <p style={{ margin: '0 0 16px', color: '#666', fontSize: 15, lineHeight: 1.5 }}>{inv.descripcion}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 140 }}>
            <div style={{ fontSize: 13, color: '#888' }}>Progreso</div>
            <div style={{ width: 140, height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${inv.progreso || 0}%`, height: '100%', background: '#1E4D8C', borderRadius: 5 }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1E4D8C' }}>{inv.progreso || 0}%</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee', fontSize: 13, color: '#888' }}>
          {inv.institucion && <span>🏛️ <strong>Institución:</strong> {inv.institucion}</span>}
          {inv.fecha_inicio && <span>📅 <strong>Inicio:</strong> {inv.fecha_inicio}</span>}
          {inv.fecha_fin_estimada && <span>🏁 <strong>Fin estimado:</strong> {inv.fecha_fin_estimada}</span>}
          {inv.fecha_fin_real && <span>✅ <strong>Fin real:</strong> {inv.fecha_fin_real}</span>}
          {inv.presupuesto != null && <span>💰 <strong>Presupuesto:</strong> ${Number(inv.presupuesto).toLocaleString()}</span>}
          <span>👥 <strong>Colaboradores:</strong> {inv.total_colaboradores}</span>
          <span>🎫 <strong>Tickets:</strong> {inv.total_tickets}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1E4D8C', fontSize: 16 }}>👥 Miembros</h3>
          {inv.members && inv.members.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inv.members.map(member => (
                <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, color: '#333' }}>Usuario #{member.user_id}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: member.rol === 'principal' ? '#1E4D8C' : '#6c757d', color: '#fff' }}>
                    {member.rol}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#888', fontSize: 14, margin: 0 }}>No hay miembros registrados</p>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1E4D8C', fontSize: 16 }}>🎫 Tickets</h3>
          {inv.tickets && inv.tickets.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inv.tickets.slice(0, 10).map(ticket => (
                <div key={ticket.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: (coloresTicketTipo[ticket.tipo] || '#6c757d') + '22', color: coloresTicketTipo[ticket.tipo] || '#6c757d' }}>
                      {ticket.tipo}
                    </span>
                    <span style={{ fontSize: 13, color: '#888', fontFamily: 'monospace' }}>{ticket.codigo}</span>
                    <span style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.titulo}</span>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 'bold', background: (coloresTicketEstado[ticket.estado] || '#6c757d') + '22', color: coloresTicketEstado[ticket.estado] || '#6c757d', whiteSpace: 'nowrap' }}>
                    {ticket.estado?.replace('_', ' ')}
                  </span>
                </div>
              ))}
              {inv.tickets.length > 10 && (
                <p style={{ textAlign: 'center', color: '#888', fontSize: 12, margin: '8px 0 0' }}>
                  ...y {inv.tickets.length - 10} ticket(s) más
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#888', fontSize: 14, margin: 0 }}>No hay tickets registrados</p>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <FileManager investigationId={id} />
      </div>
    </div>
  );
};

export default ResearchDetailPage;
