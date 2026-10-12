AI EMAIL SPAM CLASSIFIER  -  React.js (CDN) + Ollama Cloud API
================================================================

Frontend : React 18 loaded from CDN (no Vite, no bundler, no build step)
AI engine: Ollama Cloud API (https://ollama.com/api/chat)  - or local Ollama
Backend  : a ~100-line Node.js file (server.js, no npm packages, no Python)

WHY A SMALL NODE SERVER?
Your Ollama API key is a secret. If the browser called Ollama directly, the key
would be visible to anyone using the page, and cloud CORS rules could block it.
server.js keeps the key in .env and forwards requests for you.

SETUP
1. Install Node.js 18 or newer: https://nodejs.org/
2. Create an API key: https://ollama.com/settings/keys
3. Copy ".env.example" to ".env" and paste your key:
       OLLAMA_API_KEY=your_key_here
4. In this folder run:
       node server.js
   (or: npm start)
5. Open http://localhost:3000, paste an email, click "Analyze email".

CHANGING THE MODEL
Edit OLLAMA_MODEL in .env and restart. To list cloud models:
       curl https://ollama.com/api/tags
Default: gpt-oss:120b

USING LOCAL OLLAMA INSTEAD (optional)
In .env set:
       OLLAMA_HOST=http://localhost:11434
       OLLAMA_MODEL=llama3.2
No key is needed. Run "ollama pull llama3.2" first.

FILES
server.js          Node server: static files + /api/chat proxy
public/index.html  Loads React, ReactDOM, Babel from CDN
public/app.js      React UI, prompt, response parsing
public/styles.css  Responsive design
.env.example       Settings template (copy to .env)

TROUBLESHOOTING
- "OLLAMA_API_KEY is missing"   -> create .env (step 3) and restart.
- 401/403 error                 -> the key is wrong or revoked.
- 404 model not found           -> change OLLAMA_MODEL to a model from /api/tags.
- Blank page                    -> CDN scripts need internet access.
- JSON/label error              -> try a different model; structured output varies.
- Port in use                   -> set PORT=3001 in .env.

SECURITY
- Never commit or share your .env file.
- Do not paste passwords, tokens, or confidential emails into the app.
- With Ollama Cloud, email text is sent to Ollama's servers (unlike local mode).
- Results are advisory; false positives and negatives are possible.
- This is an educational prototype, not an email security gateway.
