import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContextSimple';
import { NotificationProvider } from './components/NotificationProvider';
import { Layout, PrivateRoute, PublicRoute, ResearcherGuard } from './components';

// Importar páginas reales
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import NewDocumentPage from './pages/NewDocumentPage';
import CollectionsPage from './pages/CollectionsPage';
import CollectionDetailPage from './pages/CollectionDetailPage';
import NewCollectionPage from './pages/NewCollectionPage';
import ProfilePage from './pages/ProfilePage';
import ResearchPage from './pages/ResearchPage';
import ResearchDetailPage from './pages/ResearchDetailPage';
import NewResearchPage from './pages/NewResearchPage';

// Import CSS perfectamente centrado
import './styles/centered.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <div className="App">
            <Routes>
              <Route path="/" element={<Layout showSidebar={false}><HomePage /></Layout>} />
              <Route path="/login" element={<PublicRoute redirectTo="/"><Layout showSidebar={false}><LoginPage /></Layout></PublicRoute>} />
              <Route path="/register" element={<PublicRoute redirectTo="/"><Layout showSidebar={false}><RegisterPage /></Layout></PublicRoute>} />
              <Route path="/docs" element={<Layout showSidebar={false}><DocumentsPage /></Layout>} />
              <Route path="/docs/new" element={<ResearcherGuard><Layout showSidebar={false}><NewDocumentPage /></Layout></ResearcherGuard>} />
              <Route path="/docs/:id" element={<Layout showSidebar={false}><DocumentDetailPage /></Layout>} />
              <Route path="/cols" element={<Layout showSidebar={false}><CollectionsPage /></Layout>} />
              <Route path="/cols/new" element={<ResearcherGuard><Layout showSidebar={false}><NewCollectionPage /></Layout></ResearcherGuard>} />
              <Route path="/cols/:id" element={<Layout showSidebar={false}><CollectionDetailPage /></Layout>} />
              <Route path="/profile" element={<PrivateRoute><Layout showSidebar={false}><ProfilePage /></Layout></PrivateRoute>} />
              <Route path="/research" element={<ResearcherGuard><Layout showSidebar={false}><ResearchPage /></Layout></ResearcherGuard>} />
              <Route path="/research/new" element={<ResearcherGuard><Layout showSidebar={false}><NewResearchPage /></Layout></ResearcherGuard>} />
              <Route path="/research/:id" element={<ResearcherGuard><Layout showSidebar={false}><ResearchDetailPage /></Layout></ResearcherGuard>} />
              
              {/* Ruta 404 */}
              <Route path="*" element={
                <Layout>
                  <div className="error-page">
                    <div className="error-content">
                      <h1>404</h1>
                      <h2>Página no encontrada</h2>
                      <p>La página que buscas no existe o ha sido movida.</p>
                      <a href="/" className="btn btn-primary">Volver al inicio</a>
                    </div>
                  </div>
                </Layout>
              } />
            </Routes>
          </div>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}



export default App;
