import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => (
  <nav className="navbar">
    <Link to="/" className="nav-brand">
      <img src="/logo.png" alt="I Love LLM" style={{ height: '50px' }} />
    </Link>
    <div className="nav-links">
      <Link to="/scrape" className="nav-link">Scrape</Link>
      <Link to="/ingest" className="nav-link">Ingest</Link>
      <Link to="/finetune" className="nav-link">Fine-Tune Studio</Link>
      <Link to="/vectordb" className="nav-link">Vector DB</Link>
      <Link to="/health" className="nav-link">System Health</Link>
      <Link to="/nlp" className="nav-link">NLP</Link>
      <Link to="/search" className="nav-link">Search</Link>
      <Link to="/sdk" className="nav-link">SDK</Link>
      <Link to="/offline" className="nav-link">Offline</Link>
    </div>
    <div className="nav-actions">
      <button className="btn btn-login">Log in</button>
      <button className="btn btn-signup">Sign up</button>
    </div>
  </nav>
);

export default Navbar;
