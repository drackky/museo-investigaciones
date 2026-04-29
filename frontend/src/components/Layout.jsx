import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = ({ children, className = '', showSidebar = false }) => {
  return (
    <div className={`app-layout ${className}`}>
      <Header />
      
      <div className="layout-body">
        {showSidebar && <Sidebar />}
        
        <main className="main-content">
          <div className="content-wrapper">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;