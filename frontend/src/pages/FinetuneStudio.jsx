import React, { useState, useRef, useEffect } from 'react';
import './FinetuneStudio.css'; // Pure Vanilla CSS
import { 
  UploadCloud, Settings, Database, Play, Loader, CheckCircle, 
  AlertTriangle, TrendingDown, Cpu, FileText, BarChart2, Zap,
  Download, Code, Activity, ShieldAlert, ArrowRight, Save, LayoutTemplate,
  Info, ChevronDown, ChevronUp, Sparkles, MessageSquare, Binary
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const FinetuneStudio = () => {
  // Navigation State
  const [currentStep, setCurrentStep] = useState(1);
  const maxStepReached = useRef(1);

  // Global State
  const [file, setFile] = useState(null);
  const [filepath, setFilepath] = useState('');
  const [columns, setColumns] = useState([]);
  const [inputCol, setInputCol] = useState('');
  const [outputCol, setOutputCol] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stage 1 & 2: Diagnosis & Quality
  const [analysis, setAnalysis] = useState(null);
  
  // Stage 3: Prepare & Format
  const [targetFormat, setTargetFormat] = useState('chatml');
  const [formatPreview, setFormatPreview] = useState([]);
  const [labelSuggestions, setLabelSuggestions] = useState([]);

  // Stage 4: Config
  const [recipe, setRecipe] = useState('assistant');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modelId, setModelId] = useState('Qwen/Qwen2.5-0.5B-Instruct');
  const [epochs, setEpochs] = useState(1);
  const [lr, setLr] = useState(0.0002);
  const [batchSize, setBatchSize] = useState(1);
  const [loraRank, setLoraRank] = useState(8);
  const [useEval, setUseEval] = useState(true);

  // Stage 5 & 6: Training & Eval
  const [trainingState, setTrainingState] = useState({
    is_training: false, current_epoch: 0, total_epochs: 0,
    current_step: 0, max_steps: 0, loss: 0.0,
    loss_history: [], eval_metrics: null, status: 'Idle', error: null, output_dir: null
  });

  const fileInputRef = useRef(null);

  // Poll status globally
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/finetune/status');
        const data = await res.json();
        setTrainingState(data);
        
        // Auto-restore step 5 if we discover a background job is running
        if (data.is_training && currentStep < 5) {
          maxStepReached.current = Math.max(maxStepReached.current, 5);
          setCurrentStep(5);
        }
        
        if (!data.is_training && data.status === 'Training Completed Successfully!') {
          maxStepReached.current = Math.max(maxStepReached.current, 6);
        }
      } catch (err) {
        console.error("Failed to fetch training status:", err);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [currentStep]);

  // Stage 1: Upload
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://localhost:8000/api/finetune/upload', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setColumns(data.columns);
        setFilepath(data.filepath);
        if (data.preview) setPreviewData(data.preview);
        if (data.columns.length >= 2) {
          setInputCol(data.columns[0]);
          setOutputCol(data.columns[1]);
        }
      } else {
        throw new Error(data.detail);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Analyze
  const handleAnalyze = async () => {
    if (!inputCol || !outputCol) return setError("Please select input and output columns.");
    if (inputCol === outputCol) return setError("Input and Output columns must be different.");
    
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('filepath', filepath);
    formData.append('input_col', inputCol);
    formData.append('output_col', outputCol);

    try {
      const res = await fetch('http://localhost:8000/api/finetune/analyze', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data);
        maxStepReached.current = Math.max(maxStepReached.current, 2);
        setCurrentStep(2);
      } else {
        throw new Error(data.detail);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stage 3: Convert & Label
  const handleConvert = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append('filepath', filepath);
    formData.append('input_col', inputCol);
    formData.append('output_col', outputCol);
    formData.append('target_format', targetFormat);

    try {
      const res = await fetch('http://localhost:8000/api/finetune/convert', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setFormatPreview(data.preview);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestLabels = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append('filepath', filepath);
    formData.append('input_col', inputCol);
    formData.append('output_col', outputCol);

    try {
      const res = await fetch('http://localhost:8000/api/finetune/label', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setLabelSuggestions(data.suggestions);
      } else {
        setError(data.detail || "No empty rows needed labeling!");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 3) handleConvert();
  }, [targetFormat, currentStep]);

  // Stage 4: Train
  const handleStartTraining = async () => {
    const formData = new FormData();
    formData.append('filepath', filepath);
    formData.append('input_col', inputCol);
    formData.append('output_col', outputCol);
    formData.append('model_id', modelId);
    formData.append('batch_size', batchSize);
    formData.append('lr', lr);
    formData.append('epochs', epochs);
    formData.append('lora_rank', loraRank);
    formData.append('target_format', targetFormat);
    formData.append('use_eval', useEval);

    try {
      const res = await fetch('http://localhost:8000/api/finetune/start', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.detail);
      maxStepReached.current = Math.max(maxStepReached.current, 5);
      setCurrentStep(5);
    } catch (err) {
      setError(err.message);
    }
  };

  // Stage 6: Export
  const handleExport = () => {
    window.open('http://localhost:8000/api/finetune/export', '_blank');
  };

  const applyRecipe = (type) => {
    setRecipe(type);
    if (type === 'classifier') {
      setModelId('HuggingFaceTB/SmolLM-360M-Instruct');
      setTargetFormat('classification');
      setEpochs(3);
    } else if (type === 'assistant') {
      setModelId('Qwen/Qwen2.5-0.5B-Instruct');
      setTargetFormat('chatml');
      setEpochs(1);
    } else if (type === 'json') {
      setModelId('Qwen/Qwen2.5-0.5B-Instruct');
      setTargetFormat('json-extraction');
      setEpochs(2);
    }
  };

  const steps = [
    { num: 1, title: 'Upload Data', icon: <UploadCloud size={18} /> },
    { num: 2, title: 'Diagnosis', icon: <Activity size={18} /> },
    { num: 3, title: 'Data Prep', icon: <LayoutTemplate size={18} /> },
    { num: 4, title: 'Train Model', icon: <Settings size={18} /> },
    { num: 5, title: 'Live Monitor', icon: <BarChart2 size={18} /> },
    { num: 6, title: 'Deploy', icon: <Zap size={18} /> },
  ];

  return (
    <div className="pipeline-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon"><Cpu size={24} /></div>
          <h2>Fine-Tune Studio</h2>
        </div>
        <div className="step-list">
          {steps.map(step => (
            <div 
              key={step.num}
              className={`step-item ${currentStep === step.num ? 'active' : ''} ${step.num > maxStepReached.current ? 'locked' : ''} ${step.num < currentStep ? 'completed' : ''}`}
              onClick={() => step.num <= maxStepReached.current && setCurrentStep(step.num)}
            >
              <div className="step-indicator">
                {step.num < currentStep ? <CheckCircle size={14} /> : step.num}
              </div>
              <span>{step.title}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main UI Area */}
      <main className="main-content">
        <header className="content-header">
          <h1>{steps.find(s => s.num === currentStep)?.title}</h1>
          <p>
            {currentStep === 1 && "Start by providing the data you want the AI to learn from."}
            {currentStep === 2 && "We analyzed your data to see if training is the best approach."}
            {currentStep === 3 && "Let's format your data so the AI can understand it perfectly."}
            {currentStep === 4 && "Tell us what you want to build, and we'll handle the heavy ML math."}
            {currentStep === 5 && "Watch your model get smarter in real time."}
          </p>
          {loading && <div style={{ color: '#2563eb', fontWeight: 'bold', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader size={18} className="spin" /> Processing...
          </div>}
        </header>

        {error && (
          <div className="warning-banner">
            <h4><AlertTriangle size={20} /> Something went wrong</h4>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <div>
          {/* STAGE 1: UPLOAD & MAP */}
          {currentStep === 1 && (
            <>
              <div className="stage-card">
                <h3><UploadCloud color="#3b82f6"/> 1. Upload your CSV or JSONL file</h3>
                <div className={`dropzone ${file ? 'has-file' : ''}`} onClick={() => fileInputRef.current.click()}>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.json,.jsonl" style={{ display: 'none' }} />
                  {file ? (
                    <div>
                      <div className="dropzone-icon"><FileText size={32} /></div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{file.name}</span>
                      <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Click to replace file</p>
                    </div>
                  ) : (
                    <div>
                      <div className="dropzone-icon"><UploadCloud size={32} /></div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Click to browse your files</span>
                      <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Accepted formats: .csv, .jsonl (Max 50MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {columns.length > 0 && (
                <div className="stage-card">
                  <h3><Database color="#6366f1"/> 2. Tell us about your data</h3>
                  <p style={{ color: '#64748b', marginBottom: '2rem' }}>Which columns contain the information you want the AI to learn?</p>
                  
                  {previewData.length > 0 && (
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {columns.slice(0,4).map(c => <th key={c}>{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, idx) => (
                            <tr key={idx}>
                              {columns.slice(0,4).map(c => <td key={c}>{row[c]?.toString() || '-'}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="form-grid">
                    <div className="form-group">
                      <label><div className="step-indicator" style={{ background: '#dbeafe', color: '#2563eb' }}>A</div> What is the User asking?</label>
                      <p>This is the input data, like a user's question, a document, or a prompt.</p>
                      <select className="modern-select" value={inputCol} onChange={e => setInputCol(e.target.value)}>
                        <option value="">-- Select Input Column --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label><div className="step-indicator" style={{ background: '#dcfce7', color: '#16a34a' }}>B</div> How should the AI respond?</label>
                      <p>This is the ideal output, like the perfect answer, a summary, or a category label.</p>
                      <select className="modern-select" value={outputCol} onChange={e => setOutputCol(e.target.value)}>
                        <option value="">-- Select Output Column --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <button onClick={handleAnalyze} disabled={!inputCol || !outputCol || loading} className="primary-btn">
                    Analyze my data <ArrowRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* STAGE 2: DIAGNOSIS */}
          {currentStep === 2 && analysis && (
            <>
              <div className={`alert-box ${analysis.suitability.fine_tuning_needed === true ? 'success' : 'warning'}`}>
                <div style={{ color: analysis.suitability.fine_tuning_needed === true ? '#16a34a' : '#ca8a04' }}>
                  {analysis.suitability.fine_tuning_needed === true ? <CheckCircle size={48} /> : <AlertTriangle size={48} />}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                    {analysis.suitability.fine_tuning_needed === true ? 'Great news! Fine-tuning is highly recommended.' : 'Wait! Fine-tuning might not be the best choice.'}
                  </h2>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', lineHeight: 1.5 }}>{analysis.suitability.reason}</p>
                  
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem' }}>
                    <div>
                      <div className="label" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Detected Data Type</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{analysis.suitability.task_type}</div>
                    </div>
                    <div>
                      <div className="label" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Best Approach</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{analysis.suitability.best_option}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stage-card">
                <h3><Activity color="#a855f7"/> Data Quality Report</h3>
                
                <div className="metric-grid">
                  <div className="metric-card">
                    <Database size={24} color="#3b82f6" />
                    <span className="value">{analysis.quality.total_rows}</span>
                    <span className="label">Total Rows</span>
                  </div>
                  <div className="metric-card">
                    <FileText size={24} color="#a855f7" />
                    <span className="value">{analysis.quality.unique_outputs}</span>
                    <span className="label">Unique Answers</span>
                  </div>
                  <div className="metric-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                    <ShieldAlert size={24} color="#ef4444" />
                    <span className="value" style={{ color: '#991b1b' }}>{analysis.quality.missing_values}</span>
                    <span className="label" style={{ color: '#b91c1c' }}>Missing Values</span>
                  </div>
                  <div className="metric-card" style={{ background: '#fefce8', borderColor: '#fef08a' }}>
                    <AlertTriangle size={24} color="#ca8a04" />
                    <span className="value" style={{ color: '#854d0e' }}>{analysis.quality.duplicates}</span>
                    <span className="label" style={{ color: '#a16207' }}>Exact Duplicates</span>
                  </div>
                </div>

                {analysis.quality.warnings.length > 0 && (
                  <div className="warning-banner">
                    <h4><AlertTriangle size={20} /> Action Required</h4>
                    <p style={{ color: '#b91c1c', marginBottom: '1rem', marginTop: 0 }}>We found some messy data. If you train the AI on bad data, it will give bad answers. Please review these warnings:</p>
                    <ul>
                      {analysis.quality.warnings.map((w, i) => (
                        <li key={i} style={{ marginBottom: '0.5rem' }}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button onClick={() => { maxStepReached.current = Math.max(maxStepReached.current, 3); setCurrentStep(3); }} className="primary-btn">
                  Looks good, continue to Preparation <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

          {/* STAGE 3: PREPARE */}
          {currentStep === 3 && (
            <>
              <div className="stage-card">
                <h3><LayoutTemplate color="#3b82f6"/> AI Format Converter</h3>
                <p style={{ color: '#64748b', marginBottom: '2rem' }}>AI models expect data to look a very specific way. We will automatically wrap your data in the correct syntax so you don't have to write any code.</p>
                
                <div className="recipe-grid">
                  <div className={`recipe-card ${targetFormat === 'chatml' ? 'active' : ''}`} onClick={() => setTargetFormat('chatml')}>
                    <MessageSquare size={28} />
                    <h4>Conversational AI</h4>
                    <p>(Recommended) Formats data as a dialogue between a User and an AI Assistant.</p>
                  </div>
                  <div className={`recipe-card ${targetFormat === 'classification' ? 'active' : ''}`} onClick={() => setTargetFormat('classification')}>
                    <BarChart2 size={28} />
                    <h4>Categorizer</h4>
                    <p>Formats data to teach the AI to pick exactly one label or category.</p>
                  </div>
                  <div className={`recipe-card ${targetFormat === 'instruction-response' ? 'active' : ''}`} onClick={() => setTargetFormat('instruction-response')}>
                    <Code size={28} />
                    <h4>Instruction Follower</h4>
                    <p>Classic Alpaca format for completing complex instructions.</p>
                  </div>
                </div>

                <div className="code-block">
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Binary size={14}/> Under the hood preview (First 3 rows)
                  </div>
                  {formatPreview.length > 0 
                    ? formatPreview.map((f, i) => `Sample ${i+1}:\n${f || "Empty Row Detected! Ensure your CSV isn't blank."}`).join('\n\n')
                    : "Loading preview..."}
                </div>
              </div>

              <div className="stage-card" style={{ background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div>
                    <h3><Sparkles color="#6366f1"/> AI Labeling Assistant</h3>
                    <p style={{ color: '#64748b', margin: 0 }}>If your dataset has blank answers, our AI can try to guess the missing labels by looking at similar rows!</p>
                  </div>
                  <button onClick={handleSuggestLabels} disabled={loading} className="secondary-btn" style={{ background: '#4f46e5', color: 'white' }}>
                    <Sparkles size={16} /> Auto-fill blank rows
                  </button>
                </div>
                
                {labelSuggestions.length > 0 && (
                  <div className="data-table-wrapper" style={{ background: 'white' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Row</th>
                          <th style={{ width: '50%' }}>Input Text</th>
                          <th>AI Suggestion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labelSuggestions.map(s => (
                          <tr key={s.index}>
                            <td style={{ fontWeight: 800 }}>#{s.index}</td>
                            <td>{s.input}</td>
                            <td><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>{s.suggested_label}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <button onClick={() => { maxStepReached.current = Math.max(maxStepReached.current, 4); setCurrentStep(4); }} className="primary-btn" style={{ marginTop: '2rem' }}>
                  Proceed to Training <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

          {/* STAGE 4: CONFIGURE & TRAIN */}
          {currentStep === 4 && (
            <div className="stage-card">
              <h2 style={{ fontSize: '2rem', fontWeight: 900, textAlign: 'center', margin: '0 0 0.5rem 0' }}>What do you want to build?</h2>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '1.1rem', marginBottom: '3rem' }}>Don't worry about the complex math. Just pick what you want the AI to do, and we will configure the model architecture for you.</p>

              <div className="recipe-grid">
                <div className={`recipe-card ${recipe === 'assistant' ? 'active' : ''}`} onClick={() => applyRecipe('assistant')}>
                  <div style={{ color: '#2563eb', marginBottom: '1rem' }}><MessageSquare size={32} /></div>
                  <h4>A Chat Assistant</h4>
                  <p>Trains a model to hold a natural conversation and answer questions based on your data.</p>
                </div>
                <div className={`recipe-card ${recipe === 'classifier' ? 'active' : ''}`} onClick={() => applyRecipe('classifier')}>
                  <div style={{ color: '#16a34a', marginBottom: '1rem' }}><BarChart2 size={32} /></div>
                  <h4>A Text Classifier</h4>
                  <p>Trains a model to perfectly categorize text into your predefined buckets (like Sentiment).</p>
                </div>
                <div className={`recipe-card ${recipe === 'json' ? 'active' : ''}`} onClick={() => applyRecipe('json')}>
                  <div style={{ color: '#9333ea', marginBottom: '1rem' }}><Code size={32} /></div>
                  <h4>A Data Extractor</h4>
                  <p>Trains a model to read messy text and accurately spit out structured JSON data.</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '2rem', marginTop: '2rem' }}>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="advanced-toggle">
                  <Settings size={16} /> 
                  {showAdvanced ? "Hide Advanced ML Settings" : "Show Advanced ML Settings"}
                  {showAdvanced ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>

                {showAdvanced && (
                  <div className="advanced-settings">
                    <div className="form-grid" style={{ background: 'transparent', border: 'none', padding: 0, marginBottom: 0 }}>
                      <div className="form-group">
                        <label className="setting-label">Base Foundation Model</label>
                        <select className="modern-select" value={modelId} onChange={e => setModelId(e.target.value)}>
                          <option value="Qwen/Qwen2.5-0.5B-Instruct">Qwen2.5 0.5B (Smarter, Recommended)</option>
                          <option value="HuggingFaceTB/SmolLM-360M-Instruct">SmolLM 360M (Very Fast, Good for Laptops)</option>
                          <option value="HuggingFaceTB/SmolLM-135M-Instruct">SmolLM 135M (Tiny, Use only for simple tasks)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="setting-label">Learning Rate</label>
                        <p>How big of a step it takes when learning</p>
                        <input type="number" step="0.0001" className="modern-input" value={lr} onChange={e => setLr(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label className="setting-label">Epochs</label>
                        <p>How many times it reads the whole dataset</p>
                        <input type="number" className="modern-input" value={epochs} onChange={e => setEpochs(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label className="setting-label">LoRA Rank</label>
                        <p>How many neurons we actually fine-tune</p>
                        <select className="modern-select" value={loraRank} onChange={e => setLoraRank(Number(e.target.value))}>
                          <option value={4}>4 (Faster, Uses less RAM)</option>
                          <option value={8}>8 (Balanced standard)</option>
                          <option value={16}>16 (Higher Quality, Slower)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="info-text" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <input type="checkbox" id="useEval" checked={useEval} onChange={e => setUseEval(e.target.checked)} style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer' }} />
                <div>
                  <label htmlFor="useEval" style={{ fontWeight: 800, color: '#1e40af', cursor: 'pointer' }}>Test my model automatically when it finishes (Recommended)</label>
                  <p style={{ margin: '0.5rem 0 0 0' }}>We will hide 10% of your data from the AI during training. After it finishes, we will test it on that hidden data to prove it actually learned.</p>
                </div>
              </div>

              <button 
                onClick={handleStartTraining}
                disabled={trainingState.is_training}
                className="primary-btn"
                style={{ marginTop: '3rem', padding: '1.5rem', fontSize: '1.25rem', background: trainingState.is_training ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
              >
                {trainingState.is_training ? <><Loader className="spin" /> Training job is active...</> : <><Play fill="white" size={24} /> Launch Training Job Now</>}
              </button>
            </div>
          )}

          {/* STAGE 5: EVALUATE */}
          {currentStep === 5 && (
            <div className="dark-dashboard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><Activity color="#60a5fa" size={36}/> Live Training Monitor</h2>
                  <p>Watch your model's error rate (Loss) drop in real time.</p>
                  
                  {/* Status indicator with explanation for long CPU loads */}
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <span style={{ color: trainingState.status.includes('Loading model') ? '#f59e0b' : '#38bdf8' }}>Status:</span> 
                    {trainingState.status}
                  </div>
                  {trainingState.status.includes('Loading model') && (
                    <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: '500px' }}>
                      <Info size={14} style={{ display: 'inline', marginBottom: '-2px' }}/> Downloading foundation model weights to your local machine. Since you are running on a CPU, this can take 2-5 minutes depending on internet speed.
                    </p>
                  )}
                </div>
              </div>

              {trainingState.error && (
                <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: '12px', marginTop: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <AlertTriangle size={20} /> <strong>{trainingState.error}</strong>
                </div>
              )}

              <div className="stat-row">
                <div className="dark-stat">
                  <div className="label"><LayoutTemplate size={14} style={{ display: 'inline', marginBottom: '-2px' }}/> Current Epoch</div>
                  <div className="value">{trainingState.current_epoch} <span style={{ fontSize: '1.5rem', color: '#64748b' }}>/ {trainingState.total_epochs}</span></div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Times it has read the whole dataset</div>
                </div>
                <div className="dark-stat">
                  <div className="label"><Settings size={14} style={{ display: 'inline', marginBottom: '-2px' }}/> Global Step</div>
                  <div className="value">{trainingState.current_step} <span style={{ fontSize: '1.5rem', color: '#64748b' }}>/ {trainingState.max_steps}</span></div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Individual learning updates made</div>
                </div>
                <div className="dark-stat" style={{ borderColor: '#3b82f6' }}>
                  <div className="label" style={{ color: '#60a5fa' }}><TrendingDown size={14} style={{ display: 'inline', marginBottom: '-2px' }}/> Training Loss</div>
                  <div className="value" style={{ color: 'white' }}>{trainingState.loss.toFixed(4)}</div>
                  <div style={{ fontSize: '0.8rem', color: '#60a5fa', marginTop: '0.5rem' }}>Lower is better. Represents AI confusion.</div>
                </div>
              </div>

              {trainingState.max_steps > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    <span>Progress</span>
                    <span>{Math.round((trainingState.current_step / trainingState.max_steps) * 100)}%</span>
                  </div>
                  <div style={{ height: '12px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #a855f7)', width: `${Math.min(100, (trainingState.current_step / trainingState.max_steps) * 100)}%`, transition: 'width 0.5s ease-out' }}></div>
                  </div>
                </div>
              )}

              {trainingState.loss_history.length > 0 && (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trainingState.loss_history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="step" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#f8fafc' }} 
                        itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="loss" stroke="#3b82f6" strokeWidth={4} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* STAGE 6: DEPLOY */}
          {currentStep === 6 && (
            <div className="stage-card" style={{ textAlign: 'center', padding: '5rem 3rem' }}>
              <div style={{ background: '#2563eb', width: '100px', height: '100px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 2rem auto', transform: 'rotate(5deg)' }}>
                <CheckCircle size={56} />
              </div>
              <h2 style={{ fontSize: '3rem', fontWeight: 900, margin: '0 0 1rem 0' }}>Your Custom AI is Ready.</h2>
              <p style={{ color: '#64748b', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto 4rem auto' }}>The LoRA adapters have been successfully trained and saved directly to your local file system. It's time to put your AI to work.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'left' }}>
                <div style={{ background: '#f8fafc', padding: '2.5rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ background: '#dbeafe', color: '#2563eb', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <Download size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem 0' }}>Download Weights</h3>
                  <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>Export the raw LoRA adapter weights, configuration files, and custom tokenizer dictionary as a single portable ZIP archive.</p>
                  <button onClick={handleExport} className="primary-btn" style={{ background: 'white', color: '#0f172a', border: '2px solid #e2e8f0' }}>
                    <Save size={20} /> Download .ZIP Archive
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '2.5rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ background: '#e0e7ff', color: '#4f46e5', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <Code size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem 0' }}>Python API Integration</h3>
                  <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.6 }}>Load this model instantly into any Python application using the standard HuggingFace PEFT library.</p>
                  <div className="code-block" style={{ margin: 0 }}>
                    <span style={{ color: '#c084fc' }}>from</span> peft <span style={{ color: '#c084fc' }}>import</span> AutoPeftModelForCausalLM{'\n\n'}
                    <span style={{ color: '#64748b' }}># Load your local model</span>{'\n'}
                    model = AutoPeftModelForCausalLM.from_pretrained({'\n'}
                    {'    '}<span style={{ color: '#fde047' }}>"./models/adapters"</span>,{'\n'}
                    {'    '}device_map=<span style={{ color: '#fde047' }}>"cpu"</span>{'\n'}
                    )
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinetuneStudio;
