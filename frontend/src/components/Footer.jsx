import React from 'react';

const Footer = () => (
  <footer style={{
    backgroundColor: '#1a202c',
    color: '#a0aec0',
    padding: '3rem 2rem',
    textAlign: 'center',
    marginTop: '4rem'
  }}>
    <div style={{ marginBottom: '1rem' }}>
      <img src="/logo2.png" alt="I Love LLM" style={{ height: '40px', filter: 'brightness(200%)' }} />
    </div>
    <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
      Developed by <strong>Hardik Pandey</strong>
    </p>
    <p>
      <a 
        href="https://hardikpandey.in" 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ color: '#63b3ed', textDecoration: 'none', fontWeight: 'bold' }}
      >
        Visit my Portfolio: hardikpandey.in
      </a>
    </p>
    <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#4a5568' }}>
      © {new Date().getFullYear()} ilovellm. All rights reserved. Open-source local AI pipeline.
    </p>
  </footer>
);

export default Footer;
