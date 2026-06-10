import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  FileText, 
  Search, 
  Database, 
  MessageSquare, 
  Code,
  Globe,
  Lock,
  Zap,
  Shield,
  Cpu
} from 'lucide-react';

const Hero = () => (
  <header className="hero">
    <h1>Every tool you need to work with LLMs in one place</h1>
    <p>
      Every tool you need for web scraping, document ingestion, and local NLP, at your fingertips. 
      All are 100% FREE, private, and run locally!
    </p>
  </header>
);

const ToolCard = ({ icon: Icon, title, description, path }) => {
  const navigate = useNavigate();
  return (
    <div className="tool-card" onClick={() => path && navigate(path)}>
      <div className="icon-container">
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
};

const tools = [
  {
    icon: Globe,
    title: "Web Scraper",
    description: "Extract data from any website. Bypasses CAPTCHAs and handles dynamic content locally.",
    path: "/scrape"
  },
  {
    icon: FileText,
    title: "Document Ingestion",
    description: "Parse PDFs, Docs, and CSVs. Smart chunking and metadata extraction made easy.",
    path: "/ingest"
  },
  {
    icon: Database,
    title: "Vector DB (Chroma)",
    description: "Semantic search engine to query your scraped and parsed data instantly.",
    path: "/vectordb"
  },
  {
    icon: MessageSquare,
    title: "Chat with Data",
    description: "Ask questions about your scraped data or ingested documents seamlessly.",
    path: "/nlp"
  },
  {
    icon: Search,
    title: "Web Search API",
    description: "Perform large-scale search queries and aggregate results without paid APIs.",
    path: "/search"
  },
  {
    icon: Code,
    title: "Developer SDKs",
    description: "Integrate the ilovellm pipeline directly into your Python or Node.js applications.",
    path: "/sdk"
  },
  {
    icon: Lock,
    title: "100% Offline Mode",
    description: "Keep your data secure. Zero data leaves your machine. GDPR compliant.",
    path: "/offline"
  }
];

const InfoSection = () => (
  <section style={{ padding: '4rem 2rem', backgroundColor: '#fff', textAlign: 'center' }}>
    <h2 style={{ fontSize: '2rem', marginBottom: '3rem', color: '#2d3748' }}>Why Choose ilovellm?</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ flex: '1 1 300px', padding: '1rem' }}>
        <Zap size={40} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Lightning Fast</h3>
        <p style={{ color: '#718096' }}>Built on a high-concurrency Node.js backend to process thousands of requests per minute.</p>
      </div>
      <div style={{ flex: '1 1 300px', padding: '1rem' }}>
        <Shield size={40} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>100% Private</h3>
        <p style={{ color: '#718096' }}>All data parsing and model inference happens securely on your own hardware.</p>
      </div>
      <div style={{ flex: '1 1 300px', padding: '1rem' }}>
        <Cpu size={40} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Local AI Power</h3>
        <p style={{ color: '#718096' }}>Harness the power of open-source models without worrying about expensive API bills.</p>
      </div>
    </div>
  </section>
);

const Dashboard = () => {
  return (
    <div className="dashboard-page">
      <Hero />
      <main className="tool-grid">
        {tools.map((tool, index) => (
          <ToolCard 
            key={index} 
            icon={tool.icon} 
            title={tool.title} 
            description={tool.description} 
            path={tool.path}
          />
        ))}
      </main>
      <InfoSection />
    </div>
  );
};

export default Dashboard;
