import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContextSimple';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const HomePage = () => {
  const { isAuthenticated, user, isResearcher } = useAuth();
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Fix para los iconos de Leaflet
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });

  // Icono personalizado para museos
  const museumIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="45" viewBox="0 0 32 45">
        <path fill="#2563eb" stroke="#ffffff" stroke-width="2" d="M16 0C9.373 0 4 5.373 4 12c0 8.75 12 25 12 25s12-16.25 12-25c0-6.627-5.373-12-12-12zm0 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
      </svg>
    `),
    iconSize: [32, 45],
    iconAnchor: [16, 45],
    popupAnchor: [0, -45]
  });

  // Centro del mapa: Plaza 14 de Septiembre, Cochabamba
  const mapCenter = [-17.3935, -66.1570];

  // Museos y sitios culturales de Cochabamba
  const culturalSites = [
    {
      id: 1,
      name: 'Museo Arqueológico de la UMSS',
      position: [-17.3939, -66.1461],
      type: 'Museo Arqueológico',
      description: 'Colección de piezas arqueológicas de las culturas precolombinas'
    },
    {
      id: 2,
      name: 'Palacio Portales',
      position: [-17.3780, -66.1734],
      type: 'Museo Histórico',
      description: 'Museo histórico en una mansión de estilo europeo con jardines'
    },
    {
      id: 3,
      name: 'Museo de Historia Natural Alcide d\'Orbigny',
      position: [-17.3851, -66.1469],
      type: 'Museo de Ciencias Naturales',
      description: 'Colecciones de flora, fauna y paleontología de Bolivia'
    },
    {
      id: 4,
      name: 'Centro Cultural Pedagógico Simón I. Patiño',
      position: [-17.3794, -66.1727],
      type: 'Centro Cultural',
      description: 'Eventos culturales, exposiciones y actividades artísticas'
    },
    {
      id: 5,
      name: 'Museo de la Catedral Metropolitana',
      position: [-17.3936, -66.1571],
      type: 'Museo Religioso',
      description: 'Arte religioso colonial y objetos históricos de la catedral'
    },
    {
      id: 6,
      name: 'Casa Museo Martín Cárdenas',
      position: [-17.3912, -66.1523],
      type: 'Casa Museo',
      description: 'Homenaje al botánico boliviano, con biblioteca especializada'
    },
    {
      id: 7,
      name: 'Museo de Bellas Artes - Casa de la Cultura',
      position: [-17.3940, -66.1578],
      type: 'Museo de Arte',
      description: 'Colección de arte boliviano y exposiciones temporales'
    }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Museo de <span className="hero-accent">Investigaciones</span>
            </h1>
            <p className="hero-description">
              Plataforma digital profesional para la gestión, preservación y acceso 
              a documentos históricos y colecciones de investigación especializada.
            </p>
            
            <div className="hero-actions">
              {!isAuthenticated ? (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Comenzar Ahora
                  </Link>
                  <Link to="/docs" className="btn btn-outline btn-lg">
                    Explorar Documentos
                  </Link>
                </>
              ) : (
                <div className="welcome-section">
                  <div className="welcome-card">
                    <div className="welcome-avatar">
                      {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="welcome-content">
                      <h3>Bienvenido, {user?.nombre || 'Usuario'}</h3>
                      <p>
                        {isResearcher() 
                          ? 'Continúa tu trabajo de investigación' 
                          : 'Explora la biblioteca digital del museo'
                        }
                      </p>
                      {!isResearcher() && (
                        <span className="user-role-badge">Acceso como Invitado</span>
                      )}
                    </div>
                  </div>
                  <div className="quick-actions">
                    <Link to="/docs" className="btn btn-primary">
                      {isResearcher() ? 'Mis Documentos' : 'Explorar Documentos'}
                    </Link>
                    <Link to="/cols" className="btn btn-secondary">
                      {isResearcher() ? 'Mis Colecciones' : 'Ver Colecciones'}
                    </Link>
                    {isResearcher() && (
                      <Link to="/research" className="btn btn-outline">
                        Investigaciones
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="hero-card">
              <div className="card-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
              </div>
              <h3>Gestión Digital</h3>
              <p>Sistema profesional para documentos de investigación</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="section-header">
            <h2>Características Principales</h2>
            <p>Herramientas profesionales para investigadores y académicos</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
              </div>
              <h3>Gestión de Documentos</h3>
              <p>Sube, organiza y gestiona documentos con metadatos detallados y control de versiones.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,4A1,1 0 0,0 2,5V9A1,1 0 0,0 3,10H7A1,1 0 0,0 8,9V5A1,1 0 0,0 7,4H3M10,4A1,1 0 0,0 9,5V9A1,1 0 0,0 10,10H14A1,1 0 0,0 15,9V5A1,1 0 0,0 14,4H10M17,4A1,1 0 0,0 16,5V9A1,1 0 0,0 17,10H21A1,1 0 0,0 22,9V5A1,1 0 0,0 21,4H17M3,12A1,1 0 0,0 2,13V17A1,1 0 0,0 3,18H7A1,1 0 0,0 8,17V13A1,1 0 0,0 7,12H3M10,12A1,1 0 0,0 9,13V17A1,1 0 0,0 10,18H14A1,1 0 0,0 15,17V13A1,1 0 0,0 14,12H10M17,12A1,1 0 0,0 16,13V17A1,1 0 0,0 17,18H21A1,1 0 0,0 22,17V13A1,1 0 0,0 21,12H17Z"/>
                </svg>
              </div>
              <h3>Colecciones Temáticas</h3>
              <p>Organiza documentos en colecciones con descripciones detalladas y acceso controlado.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                </svg>
              </div>
              <h3>Búsqueda Avanzada</h3>
              <p>Sistema potente con filtros por tipo, fecha, autor y contenido de texto completo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cultural Sites Map Section */}
      <section className="map-section">
        <div className="map-container-wrapper">
          <div className="section-header">
            <h2>Museos y Sitios Culturales de Cochabamba</h2>
            <p>Explora los principales espacios culturales e históricos de la ciudad</p>
          </div>
          
          <div className="map-wrapper">
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              style={{ width: '100%', height: '500px', borderRadius: '12px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {culturalSites.map((site) => (
                <Marker 
                  key={site.id} 
                  position={site.position}
                  icon={museumIcon}
                >
                  <Popup>
                    <div className="map-popup-content">
                      <h3>{site.name}</h3>
                      <p className="popup-type">{site.type}</p>
                      <p className="popup-description">{site.description}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="sites-legend">
            <h3>Sitios Destacados</h3>
            <div className="sites-grid">
              {culturalSites.map((site) => (
                <div 
                  key={site.id} 
                  className="site-card"
                  onClick={() => setSelectedMarker(site)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="site-marker">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#2563eb">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                  <div className="site-info">
                    <h4>{site.name}</h4>
                    <p>{site.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;