import nltk
from typing import List, Dict

# Download NLTK data required for sentence tokenization
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    import ssl
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)

def fixed_size_chunking(text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
    """Splits text into fixed-size chunks of words with overlap."""
    words = text.split()
    chunks = []
    
    if not words:
        return []
        
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
            
    return chunks

def sentence_aware_chunking(text: str, max_words: int = 512) -> List[str]:
    """Splits text without cutting sentences in half."""
    sentences = nltk.tokenize.sent_tokenize(text)
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence_length = len(sentence.split())
        
        # If a single sentence is larger than max_words, we must split it by words
        if sentence_length > max_words:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_length = 0
            # Force split large sentence
            words = sentence.split()
            for i in range(0, len(words), max_words):
                chunks.append(" ".join(words[i:i + max_words]))
            continue
            
        if current_length + sentence_length > max_words:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_length = sentence_length
        else:
            current_chunk.append(sentence)
            current_length += sentence_length
            
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return chunks

def heading_aware_chunking(elements: List[Dict]) -> List[str]:
    """
    Groups paragraphs under their respective headings.
    Expects input like: [{"tag": "h1", "text": "Header"}, {"tag": "p", "text": "Content"}]
    """
    chunks = []
    current_heading = ""
    current_text = []
    
    for el in elements:
        tag = el.get("tag", "").lower()
        text = el.get("text", "").strip()
        
        if not text:
            continue
            
        if tag in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            # Save previous chunk
            if current_text:
                prefix = f"[{current_heading}] " if current_heading else ""
                chunks.append(prefix + " ".join(current_text))
                
            current_heading = text
            current_text = []
        else:
            current_text.append(text)
            
    # Add final chunk
    if current_text:
        prefix = f"[{current_heading}] " if current_heading else ""
        chunks.append(prefix + " ".join(current_text))
        
    return chunks

def semantic_chunking(paragraphs: List[str], threshold: float = 0.3) -> List[str]:
    """
    Groups paragraphs using TF-IDF cosine similarity.
    Groups sequential paragraphs if they are semantically similar.
    """
    if not paragraphs:
        return []
    if len(paragraphs) == 1:
        return paragraphs
        
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        # Filter empty paragraphs
        paras = [p.strip() for p in paragraphs if len(p.strip()) > 10]
        if len(paras) <= 1:
            return paras
            
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(paras)
        
        chunks = []
        current_chunk = [paras[0]]
        
        for i in range(1, len(paras)):
            # Calculate similarity between current paragraph and the previous one
            sim = cosine_similarity(tfidf_matrix[i-1:i], tfidf_matrix[i:i+1])[0][0]
            
            if sim >= threshold:
                current_chunk.append(paras[i])
            else:
                chunks.append(" ".join(current_chunk))
                current_chunk = [paras[i]]
                
        if current_chunk:
            chunks.append(" ".join(current_chunk))
            
        return chunks
    except ImportError:
        print("scikit-learn not installed, falling back to fixed size chunking")
        return fixed_size_chunking(" ".join(paragraphs))

def apply_chunking(text_or_elements, strategy="sentence", **kwargs):
    if strategy == "fixed":
        return fixed_size_chunking(text_or_elements, **kwargs)
    elif strategy == "sentence":
        return sentence_aware_chunking(text_or_elements, **kwargs)
    elif strategy == "heading":
        return heading_aware_chunking(text_or_elements)
    elif strategy == "semantic":
        if isinstance(text_or_elements, str):
            paragraphs = text_or_elements.split('\n\n')
        else:
            paragraphs = text_or_elements
        return semantic_chunking(paragraphs, **kwargs)
    else:
        # Fallback to semantic chunking instead of a giant blob
        print(f"Unknown chunking strategy '{strategy}', falling back to 'semantic'")
        if isinstance(text_or_elements, str):
            paragraphs = text_or_elements.split('\n\n')
        else:
            paragraphs = text_or_elements
        return semantic_chunking(paragraphs, **kwargs)
