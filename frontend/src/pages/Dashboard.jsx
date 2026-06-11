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

const ToolCard = ({ img, title, description, path }) => {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => path && navigate(path)}
      style={{ 
        backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer',
        transition: 'transform 0.2s', border: '1px solid #e2e8f0'
      }}
      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <img src={img} alt={title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderBottom: '1px solid #e2e8f0' }} />
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#1e293b' }}>{title}</h3>
        <p style={{ margin: 0, color: '#64748b' }}>{description}</p>
      </div>
    </div>
  );
};

const tools = [
  {
    img: "/Photos/WebScraper.png",
    title: "Web Scraper",
    description: "Extract data from any website. Bypasses CAPTCHAs and handles dynamic content locally.",
    path: "/scrape"
  },
  {
    img: "/Photos/DocumentIngestion.png",
    title: "Document Ingestion",
    description: "Parse PDFs, Docs, and CSVs. Smart chunking and metadata extraction made easy.",
    path: "/ingest"
  },
  {
    img: "/Photos/VectorStore.png",
    title: "Vector DB (Chroma)",
    description: "Semantic search engine to query your scraped and parsed data instantly.",
    path: "/vectordb"
  },
  {
    img: "/Photos/ChatWithData.png",
    title: "Chat with Data",
    description: "Ask questions about your scraped data or ingested documents seamlessly.",
    path: "/nlp"
  },
  {
    img: "/Photos/WebSearchAPI.png",
    title: "Web Search API",
    description: "Perform large-scale search queries and aggregate results without paid APIs.",
    path: "/search"
  },
  {
    img: "/Photos/DeveloperSDKs.png",
    title: "Developer SDKs",
    description: "Integrate the ilovellm pipeline directly into your Python or Node.js applications.",
    path: "/sdk"
  },
  {
    img: "/Photos/100%OfflineMode.png",
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

const AppHubSection = () => {
  const navigate = useNavigate();
  const apps = [
    { title: "Research Assistant", img: "/Phtos/ResearchAssistant.png", path: "/app/research", desc: "Scrape papers & ask questions." },
    { title: "Price Intelligence", img: "/Phtos/Ecommerce.png", path: "/app/ecommerce", desc: "Track competitor pricing automatically." },
    { title: "Job Market Analyzer", img: "/Phtos/JobMarketAnalyzer.png", path: "/app/jobs", desc: "Extract skills & salaries from job boards." },
    { title: "Legal Document Analyzer", img: "/Phtos/LegalDocument.png", path: "/app/legal", desc: "Summarize & flag contract clauses." },
    { title: "News Bias Detector", img: "/Phtos/NewsAggregator.png", path: "/app/news", desc: "Aggregate news & analyze sentiment." },
    { title: "Customer Review Insights", img: "/Phtos/CustomerReview.png", path: "/app/reviews", desc: "Extract pain points from reviews." },
    { title: "Government Data Monitor", img: "/Phtos/Government.png", path: "/app/gov", desc: "Track public tenders & policy changes." }
  ];

  return (
    <section style={{ padding: '4rem 2rem', backgroundColor: '#f8fafc' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '2.5rem', color: '#0f172a', fontWeight: '800' }}>Automated Applications Hub</h2>
        <p style={{ color: '#64748b', fontSize: '1.2rem' }}>Ready-to-use solutions powered by the underlying iLoveLLM primitives.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {apps.map((app, i) => (
          <div 
            key={i} 
            onClick={() => navigate(app.path)}
            style={{ 
              backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer',
              transition: 'transform 0.2s', border: '1px solid #e2e8f0'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <img src={app.img} alt={app.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderBottom: '1px solid #e2e8f0' }} />
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#1e293b' }}>{app.title}</h3>
              <p style={{ margin: 0, color: '#64748b' }}>{app.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const Dashboard = () => {
  return (
    <div className="dashboard-page">
      <Hero />
      <AppHubSection />
      <div style={{ textAlign: 'center', padding: '4rem 2rem 1rem 2rem' }}>
        <h2 style={{ fontSize: '2rem', color: '#2d3748' }}>Underlying Primitive Tools</h2>
        <p style={{ color: '#718096' }}>Build your own pipelines using our core services.</p>
      </div>
      <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '1200px', margin: '0 auto', padding: '0 2rem 4rem 2rem' }}>
        {tools.map((tool, index) => (
          <ToolCard 
            key={index} 
            img={tool.img} 
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
