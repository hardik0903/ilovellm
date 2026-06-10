import React, { useState } from 'react';
import { Code, Copy, Check, Play, Terminal, ChevronDown, ChevronRight, Globe, FileText, Database, Search } from 'lucide-react';

const endpoints = [
  {
    category: 'Web Scraping',
    icon: Globe,
    items: [
      {
        method: 'POST',
        path: '/api/scrape',
        server: 'Node.js · port 3000',
        description: 'Scrape any website with stealth anti-detection. Extracts text, images, videos, and links.',
        body: { url: 'https://example.com' },
        python: `import requests

response = requests.post("http://127.0.0.1:3000/api/scrape", json={
    "url": "https://example.com"
})

data = response.json()
print(data["data"]["title"])
print(f"Found {len(data['data']['images'])} images")
print(f"Extracted {len(data['data']['context'])} text nodes")`,
        node: `const response = await fetch("http://127.0.0.1:3000/api/scrape", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" })
});

const data = await response.json();
console.log(data.data.title);
console.log(\`Found \${data.data.images.length} images\`);
console.log(\`Extracted \${data.data.context.length} text nodes\`);`
      }
    ]
  },
  {
    category: 'Document Ingestion',
    icon: FileText,
    items: [
      {
        method: 'POST',
        path: '/api/ingest',
        server: 'Node.js · port 3000',
        description: 'Parse PDF, DOCX, TXT, or CSV files. Returns chunked text ready for downstream processing.',
        body: 'FormData with file',
        python: `import requests

with open("document.pdf", "rb") as f:
    response = requests.post(
        "http://127.0.0.1:3000/api/ingest",
        files={"file": ("document.pdf", f, "application/pdf")}
    )

data = response.json()
print(f"Parsed {data['data']['totalChunks']} chunks")
for chunk in data["data"]["chunks"][:3]:
    print(chunk[:100])`,
        node: `const fs = require("fs");
const FormData = require("form-data");

const form = new FormData();
form.append("file", fs.createReadStream("document.pdf"));

const response = await fetch("http://127.0.0.1:3000/api/ingest", {
  method: "POST",
  body: form
});

const data = await response.json();
console.log(\`Parsed \${data.data.totalChunks} chunks\`);`
      },
      {
        method: 'POST',
        path: '/api/ingest-advanced',
        server: 'Python · port 8000',
        description: 'Advanced PDF parsing with table extraction, image extraction, and smart chunking.',
        body: 'FormData with file',
        python: `import requests

with open("report.pdf", "rb") as f:
    response = requests.post(
        "http://127.0.0.1:8000/api/ingest-advanced",
        files={"file": ("report.pdf", f, "application/pdf")}
    )

data = response.json()["data"]
print(f"Text chunks: {len(data['text_chunks'])}")
print(f"Tables found: {len(data['tables'])}")
print(f"Images extracted: {len(data['images'])}")`,
        node: `const fs = require("fs");
const FormData = require("form-data");

const form = new FormData();
form.append("file", fs.createReadStream("report.pdf"));

const response = await fetch("http://127.0.0.1:8000/api/ingest-advanced", {
  method: "POST",
  body: form
});

const data = await response.json();
console.log(\`Text chunks: \${data.data.text_chunks.length}\`);
console.log(\`Tables found: \${data.data.tables.length}\`);
console.log(\`Images extracted: \${data.data.images.length}\`);`
      }
    ]
  },
  {
    category: 'Vector Database',
    icon: Database,
    items: [
      {
        method: 'POST',
        path: '/api/vector/store',
        server: 'Python · port 8000',
        description: 'Store text chunks with metadata into the local ChromaDB vector database.',
        body: { chunks: ['chunk 1 text...', 'chunk 2 text...'], source: 'my_document.pdf' },
        python: `import requests

chunks = [
    "Machine learning is a subset of AI...",
    "Neural networks are inspired by biological neurons...",
    "Deep learning uses multiple layers of abstraction..."
]

response = requests.post("http://127.0.0.1:8000/api/vector/store", json={
    "chunks": chunks,
    "source": "ai_textbook.pdf"
})

print(response.json())  # {"success": true, "inserted": 3}`,
        node: `const response = await fetch("http://127.0.0.1:8000/api/vector/store", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chunks: [
      "Machine learning is a subset of AI...",
      "Neural networks are inspired by biological neurons...",
      "Deep learning uses multiple layers of abstraction..."
    ],
    source: "ai_textbook.pdf"
  })
});

const data = await response.json();
console.log(\`Inserted \${data.inserted} chunks\`);`
      },
      {
        method: 'POST',
        path: '/api/vector/query',
        server: 'Python · port 8000',
        description: 'Perform semantic search across stored documents. Returns chunks ranked by similarity.',
        body: { query: 'What is deep learning?', n_results: 5 },
        python: `import requests

response = requests.post("http://127.0.0.1:8000/api/vector/query", json={
    "query": "What is deep learning?",
    "n_results": 3
})

results = response.json()["results"]
for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
    print(f"[{meta['source']}] {doc[:80]}...")`,
        node: `const response = await fetch("http://127.0.0.1:8000/api/vector/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "What is deep learning?",
    n_results: 3
  })
});

const { results } = await response.json();
results.documents[0].forEach((doc, i) => {
  console.log(\`[\${results.metadatas[0][i].source}] \${doc.slice(0, 80)}...\`);
});`
      }
    ]
  },
  {
    category: 'Web Search',
    icon: Search,
    items: [
      {
        method: 'POST',
        path: '/api/search',
        server: 'Python · port 8000',
        description: 'Search the web via DuckDuckGo. No API keys required.',
        body: { query: 'latest AI trends 2024', max_results: 10 },
        python: `import requests

response = requests.post("http://127.0.0.1:8000/api/search", json={
    "query": "latest AI trends 2024",
    "max_results": 5
})

for result in response.json()["results"]:
    print(f"{result['title']}")
    print(f"  {result['href']}")
    print(f"  {result['body'][:100]}...")
    print()`,
        node: `const response = await fetch("http://127.0.0.1:8000/api/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "latest AI trends 2024",
    max_results: 5
  })
});

const { results } = await response.json();
results.forEach(r => {
  console.log(r.title);
  console.log(\`  \${r.href}\`);
  console.log(\`  \${r.body.slice(0, 100)}...\`);
});`
      }
    ]
  }
];

const pythonPipeline = `import requests

# === Full RAG Pipeline: Search → Scrape → Store → Query ===

# 1. Search the web
search = requests.post("http://127.0.0.1:8000/api/search", json={
    "query": "transformer architecture explained",
    "max_results": 3
}).json()

# 2. Scrape and ingest each result
for article in search["results"]:
    scraped = requests.post("http://127.0.0.1:3000/api/scrape", json={
        "url": article["href"]
    }).json()
    
    if scraped["success"]:
        chunks = [n["text"] for n in scraped["data"]["context"] if len(n["text"]) > 20]
        requests.post("http://127.0.0.1:8000/api/vector/store", json={
            "chunks": chunks, "source": article["href"]
        })
        print(f"✓ Ingested {len(chunks)} chunks")

# 3. Query your knowledge base
results = requests.post("http://127.0.0.1:8000/api/vector/query", json={
    "query": "How does self-attention work?",
    "n_results": 3
}).json()

for doc in results["results"]["documents"][0]:
    print(doc[:200])`;

const nodePipeline = `// === Full RAG Pipeline: Search → Scrape → Store → Query ===

// 1. Search the web
const search = await fetch("http://127.0.0.1:8000/api/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "transformer architecture explained", max_results: 3 })
}).then(r => r.json());

// 2. Scrape and ingest each result
for (const article of search.results) {
  const scraped = await fetch("http://127.0.0.1:3000/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: article.href })
  }).then(r => r.json());

  if (scraped.success) {
    const chunks = scraped.data.context.map(n => n.text).filter(t => t.length > 20);
    await fetch("http://127.0.0.1:8000/api/vector/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks, source: article.href })
    });
    console.log(\`✓ Ingested \${chunks.length} chunks\`);
  }
}

// 3. Query your knowledge base
const results = await fetch("http://127.0.0.1:8000/api/vector/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "How does self-attention work?", n_results: 3 })
}).then(r => r.json());

results.results.documents[0].forEach(doc => console.log(doc.slice(0, 200)));`;

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="sdk-copy-btn" data-copied={copied}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

const EndpointCard = ({ endpoint }) => {
  const [expanded, setExpanded] = useState(false);
  const [lang, setLang] = useState('python');

  return (
    <div className="sdk-endpoint-card">
      <div className="sdk-endpoint-header" onClick={() => setExpanded(!expanded)}>
        <div className="sdk-endpoint-left">
          {expanded ? <ChevronDown size={16} color="#718096" /> : <ChevronRight size={16} color="#718096" />}
          <span className="sdk-method-badge">{endpoint.method}</span>
          <code className="sdk-endpoint-path">{endpoint.path}</code>
        </div>
        <span className="sdk-endpoint-server">{endpoint.server}</span>
      </div>

      {expanded && (
        <div className="sdk-endpoint-body">
          <p className="sdk-endpoint-desc">{endpoint.description}</p>

          {typeof endpoint.body === 'object' && (
            <div className="sdk-request-body">
              <h4 className="sdk-label">Request Body</h4>
              <pre className="sdk-code-block sdk-code-light">
                <code>{JSON.stringify(endpoint.body, null, 2)}</code>
              </pre>
            </div>
          )}

          <div className="sdk-code-header">
            <div className="sdk-lang-toggle">
              <button className={lang === 'python' ? 'active' : ''} onClick={() => setLang('python')}>Python</button>
              <button className={lang === 'node' ? 'active' : ''} onClick={() => setLang('node')}>Node.js</button>
            </div>
            <CopyButton text={lang === 'python' ? endpoint.python : endpoint.node} />
          </div>
          <pre className="sdk-code-block sdk-code-dark">
            <code>{lang === 'python' ? endpoint.python : endpoint.node}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const APIPlayground = () => {
  const [url, setUrl] = useState('http://127.0.0.1:8000/api/search');
  const [method, setMethod] = useState('POST');
  const [bodyStr, setBodyStr] = useState('{\n  "query": "what is AI",\n  "max_results": 3\n}');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (method !== 'GET') opts.body = bodyStr;
      const res = await fetch(url, opts);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sdk-section-card">
      <div className="sdk-section-icon-row">
        <Terminal size={22} color="#304fba" />
        <h2>API Playground</h2>
      </div>
      <p className="sdk-section-sub">Test any endpoint live — results appear instantly below.</p>

      <div className="sdk-playground-controls">
        <select value={method} onChange={e => setMethod(e.target.value)} className="sdk-select">
          <option>GET</option>
          <option>POST</option>
        </select>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://127.0.0.1:8000/api/..." className="sdk-input" />
        <button onClick={handleRun} disabled={loading} className="sdk-run-btn">
          <Play size={16} /> {loading ? 'Running...' : 'Send'}
        </button>
      </div>

      {method !== 'GET' && (
        <textarea value={bodyStr} onChange={e => setBodyStr(e.target.value)} rows={5} className="sdk-textarea" />
      )}

      {response && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
            <CopyButton text={response} />
          </div>
          <pre className="sdk-code-block sdk-code-dark">
            <code>{response}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const SDKPage = () => {
  const [pipelineLang, setPipelineLang] = useState('python');

  return (
    <div className="sdk-page">
      <style>{sdkStyles}</style>

      {/* Hero */}
      <header className="sdk-hero">
        <Code size={56} color="#304fba" />
        <h1>Developer SDK</h1>
        <p>
          Integrate the entire ilovellm pipeline into your Python or Node.js apps.
          Every endpoint is REST — just use <code>fetch()</code> or <code>requests</code>.
        </p>
      </header>

      {/* Quick Start */}
      <div className="sdk-quickstart">
        <h2>Quick Start</h2>
        <div className="sdk-quickstart-grid">
          <div className="sdk-quickstart-step">
            <span className="sdk-step-num">1</span>
            <h3>Start Node.js Backend</h3>
            <code>cd backend-node && node index.js</code>
          </div>
          <div className="sdk-quickstart-step">
            <span className="sdk-step-num">2</span>
            <h3>Start Python Backend</h3>
            <code>cd backend && uvicorn main:app --port 8000</code>
          </div>
          <div className="sdk-quickstart-step">
            <span className="sdk-step-num">3</span>
            <h3>Call any endpoint</h3>
            <code>requests.post("http://127.0.0.1:8000/api/search", ...)</code>
          </div>
        </div>
      </div>

      {/* Full Pipeline */}
      <div className="sdk-section-card">
        <div className="sdk-section-icon-row">
          <Code size={22} color="#304fba" />
          <h2>Full RAG Pipeline</h2>
        </div>
        <p className="sdk-section-sub">Search → Scrape → Store → Query — in one script.</p>

        <div className="sdk-code-header">
          <div className="sdk-lang-toggle">
            <button className={pipelineLang === 'python' ? 'active' : ''} onClick={() => setPipelineLang('python')}>Python</button>
            <button className={pipelineLang === 'node' ? 'active' : ''} onClick={() => setPipelineLang('node')}>Node.js</button>
          </div>
          <CopyButton text={pipelineLang === 'python' ? pythonPipeline : nodePipeline} />
        </div>
        <pre className="sdk-code-block sdk-code-dark" style={{ maxHeight: '420px' }}>
          <code>{pipelineLang === 'python' ? pythonPipeline : nodePipeline}</code>
        </pre>
      </div>

      {/* Playground */}
      <APIPlayground />

      {/* API Reference */}
      <h2 className="sdk-ref-title">API Reference</h2>

      {endpoints.map((section, i) => (
        <div key={i} className="sdk-category">
          <div className="sdk-category-header">
            <section.icon size={20} color="#304fba" />
            <h3>{section.category}</h3>
          </div>
          <div className="sdk-endpoints-list">
            {section.items.map((ep, j) => (
              <EndpointCard key={j} endpoint={ep} />
            ))}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="sdk-footer-note">
        All APIs are <strong>100% local</strong> — your data never leaves your machine.
        No API keys, no rate limits, no subscriptions. Built by{' '}
        <a href="https://hardikpandey.in" target="_blank" rel="noreferrer">Hardik Pandey</a>.
      </div>
    </div>
  );
};

const sdkStyles = `
  .sdk-page {
    max-width: 960px;
    margin: 0 auto;
    padding: 3rem 2rem 4rem;
  }

  /* Hero */
  .sdk-hero {
    text-align: center;
    margin-bottom: 3rem;
  }
  .sdk-hero h1 {
    font-size: 2.5rem;
    font-weight: 800;
    color: #2d3748;
    margin: 1rem 0 0.75rem;
    letter-spacing: -0.5px;
  }
  .sdk-hero p {
    color: #718096;
    font-size: 1.15rem;
    max-width: 580px;
    margin: 0 auto;
    line-height: 1.7;
  }
  .sdk-hero code {
    background: #edf2f7;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 1rem;
  }

  /* Quick Start */
  .sdk-quickstart {
    background: #304fba;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
    color: #fff;
  }
  .sdk-quickstart h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 1.25rem;
  }
  .sdk-quickstart-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }
  .sdk-quickstart-step {
    background: rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 1.25rem;
    position: relative;
  }
  .sdk-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    font-size: 0.75rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
  }
  .sdk-quickstart-step h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .sdk-quickstart-step code {
    font-size: 0.85rem;
    opacity: 0.85;
    word-break: break-all;
  }

  /* Section card */
  .sdk-section-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  .sdk-section-icon-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.25rem;
  }
  .sdk-section-icon-row h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #2d3748;
    margin: 0;
  }
  .sdk-section-sub {
    color: #718096;
    font-size: 0.95rem;
    margin-bottom: 1.25rem;
  }

  /* Lang toggle */
  .sdk-lang-toggle {
    display: flex;
    gap: 0;
    background: #edf2f7;
    border-radius: 6px;
    overflow: hidden;
  }
  .sdk-lang-toggle button {
    padding: 0.35rem 1rem;
    border: none;
    background: transparent;
    font-weight: 600;
    font-size: 0.82rem;
    color: #718096;
    cursor: pointer;
    transition: all 0.15s;
  }
  .sdk-lang-toggle button.active {
    background: #304fba;
    color: #fff;
  }

  /* Code header */
  .sdk-code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  /* Code blocks */
  .sdk-code-block {
    border-radius: 8px;
    padding: 1.25rem;
    overflow: auto;
    font-size: 0.84rem;
    line-height: 1.65;
    margin: 0;
  }
  .sdk-code-light {
    background: #f8f9fa;
    color: #2d3748;
    border: 1px solid #e2e8f0;
  }
  .sdk-code-dark {
    background: #1e293b;
    color: #e2e8f0;
    border: 1px solid #334155;
  }

  /* Copy btn */
  .sdk-copy-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: #edf2f7;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.3rem 0.65rem;
    color: #718096;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .sdk-copy-btn:hover {
    background: #e2e8f0;
    color: #304fba;
  }
  .sdk-copy-btn[data-copied="true"] {
    color: #38a169;
    border-color: #c6f6d5;
    background: #f0fff4;
  }

  /* Playground */
  .sdk-playground-controls {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .sdk-select {
    padding: 0.65rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    font-weight: 700;
    font-size: 0.9rem;
    color: #2d3748;
    cursor: pointer;
    background: #f8f9fa;
  }
  .sdk-input {
    flex: 1;
    padding: 0.65rem 1rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .sdk-input:focus {
    border-color: #304fba;
  }
  .sdk-textarea {
    width: 100%;
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 0.85rem;
    resize: vertical;
    outline: none;
    margin-bottom: 1rem;
    background: #f8f9fa;
    transition: border-color 0.15s;
  }
  .sdk-textarea:focus {
    border-color: #304fba;
  }
  .sdk-run-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #304fba;
    color: #fff;
    border: none;
    padding: 0.65rem 1.5rem;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .sdk-run-btn:hover:not(:disabled) {
    background: #27419e;
  }
  .sdk-run-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* API Reference */
  .sdk-ref-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #2d3748;
    margin-bottom: 1.5rem;
  }

  .sdk-category {
    margin-bottom: 2rem;
  }
  .sdk-category-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }
  .sdk-category-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #2d3748;
    margin: 0;
  }
  .sdk-endpoints-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Endpoint card */
  .sdk-endpoint-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .sdk-endpoint-card:hover {
    box-shadow: 0 2px 8px rgba(48, 79, 186, 0.08);
  }
  .sdk-endpoint-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: background 0.1s;
  }
  .sdk-endpoint-header:hover {
    background: #f8f9fa;
  }
  .sdk-endpoint-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .sdk-method-badge {
    background: #304fba;
    color: #fff;
    padding: 0.15rem 0.55rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 800;
    font-family: monospace;
    letter-spacing: 0.5px;
  }
  .sdk-endpoint-path {
    font-size: 0.95rem;
    font-weight: 600;
    color: #2d3748;
  }
  .sdk-endpoint-server {
    font-size: 0.82rem;
    color: #a0aec0;
  }
  .sdk-endpoint-body {
    padding: 0 1.25rem 1.25rem;
    border-top: 1px solid #edf2f7;
  }
  .sdk-endpoint-desc {
    color: #4a5568;
    line-height: 1.6;
    margin: 1rem 0;
    font-size: 0.92rem;
  }
  .sdk-request-body {
    margin-bottom: 1rem;
  }
  .sdk-label {
    color: #718096;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  /* Footer */
  .sdk-footer-note {
    background: #f8f9fa;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    color: #718096;
    line-height: 1.6;
    margin-top: 1rem;
    font-size: 0.92rem;
  }
  .sdk-footer-note a {
    color: #304fba;
    font-weight: 700;
    text-decoration: none;
  }
  .sdk-footer-note a:hover {
    text-decoration: underline;
  }
`;

export default SDKPage;
