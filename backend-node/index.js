const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/ingest', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        let textContent = '';
        const ext = req.file.originalname.split('.').pop().toLowerCase();

        if (ext === 'pdf') {
            const data = await pdfParse(req.file.buffer);
            textContent = data.text;
        } else if (ext === 'docx') {
            const data = await mammoth.extractRawText({ buffer: req.file.buffer });
            textContent = data.value;
        } else if (ext === 'txt' || ext === 'csv') {
            textContent = req.file.buffer.toString('utf8');
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or CSV.' });
        }

        // Basic chunking logic (split by paragraphs or double newlines)
        const chunks = textContent.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 0);

        res.json({
            success: true,
            data: {
                filename: req.file.originalname,
                sizeBytes: req.file.size,
                type: ext,
                totalChunks: chunks.length,
                preview: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
                chunks: chunks
            }
        });
    } catch (error) {
        console.error('Ingestion error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to parse document' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', service: 'ilovellm-backend-node', speed: 'high-stealth-advanced' });
});

app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    let browser = null;
    try {
        console.log(`Starting advanced scrape for: ${url}`);
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
        });
        
        const page = await browser.newPage();
        
        // Optimize speed by blocking only fonts, but keep images to ensure lazy-loaders trigger
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Auto-scroll to trigger lazy loading of images
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight - window.innerHeight || totalHeight > 10000){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extract Advanced Context
        const pageData = await page.evaluate(() => {
            // 1. Basic Meta
            const title = document.title;
            const metaDesc = document.querySelector('meta[name="description"]');
            const description = metaDesc ? metaDesc.content : '';

            // 2. Extract All Images
            const images = Array.from(document.querySelectorAll('img'))
                .map(img => ({
                    src: img.src || img.getAttribute('data-src'),
                    alt: img.alt || ''
                }))
                .filter(img => img.src && !img.src.startsWith('data:image')); // filter out tiny base64 inline icons

            // 3. Extract All Videos
            const videos = Array.from(document.querySelectorAll('video'))
                .map(vid => ({
                    src: vid.src || (vid.querySelector('source') ? vid.querySelector('source').src : ''),
                    poster: vid.poster || ''
                }))
                .filter(vid => vid.src);

            // 4. Extract Structured Text Context (Headers and Paragraphs)
            const textNodes = Array.from(document.querySelectorAll('h1, h2, h3, p, article'))
                .map(el => ({
                    tag: el.tagName.toLowerCase(),
                    text: el.innerText.trim()
                }))
                .filter(node => node.text.length > 0);

            // 5. Extract all meaningful Links
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => ({
                    href: a.href,
                    text: a.innerText.trim()
                }))
                .filter(link => link.href && link.href.startsWith('http') && link.text.length > 0);

            return {
                title,
                description,
                images: Array.from(new Set(images.map(JSON.stringify))).map(JSON.parse), // deduplicate
                videos: Array.from(new Set(videos.map(JSON.stringify))).map(JSON.parse),
                textNodes,
                links: Array.from(new Set(links.map(JSON.stringify))).map(JSON.parse)
            };
        });

        const html = await page.content();
        
        res.json({
            success: true,
            data: {
                title: pageData.title,
                description: pageData.description,
                bytes: html.length,
                images: pageData.images,
                videos: pageData.videos,
                context: pageData.textNodes,
                links: pageData.links
            }
        });
    } catch (error) {
        console.error('Scraping error:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to scrape the target URL' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Advanced Stealth Node.js backend running on http://localhost:${PORT}`);
});
