const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Middleware para JSON
app.use(express.json());

// --- SISTEMA DE ARMAZENAMENTO (JSON FILE DB) ---
const DEFAULT_DB = {
    leads: [],
    settings: {
        whatsappNumber: '5521971475005',
        whatsappMessage: 'Olá! Vim pelo site do Varandas Beach Club e gostaria de informações sobre aulas/aluguel de quadra.',
        businessName: 'Varandas Beach Club',
        classPrice: 'R$ 150/mês',
        courtPrice: 'R$ 80/hora'
    },
    users: [
        {
            username: 'admin',
            password: 'admin123',
            name: 'Administrador Principal'
        }
    ]
};

// Garante que a pasta 'data' existe e o arquivo 'database.json' também
function initDb() {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
        console.log('Banco de dados JSON inicializado com sucesso.');
    }
}

initDb();

function readDb() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao ler banco de dados:', error);
        return DEFAULT_DB;
    }
}

function writeDb(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Erro ao gravar banco de dados:', error);
    }
}

// --- SISTEMA DE SESSÃO EM MEMÓRIA ---
const SESSIONS = {};

function cleanExpiredSessions() {
    const now = Date.now();
    for (const token in SESSIONS) {
        if (SESSIONS[token].expires < now) {
            delete SESSIONS[token];
        }
    }
}
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // Executa a cada hora

// Middleware de Autenticação
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }

    const token = authHeader.split(' ')[1];
    const session = SESSIONS[token];

    if (!session || session.expires < Date.now()) {
        return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
    }

    req.user = session.user;
    next();
}

// --- ROTAS DA API ---

// 1. Autenticação (Login / Logout)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const db = readDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Gera um token simples
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    SESSIONS[token] = {
        user: { username: user.username, name: user.name },
        expires: Date.now() + 24 * 60 * 60 * 1000 // Expira em 24h
    };

    res.json({ token, user: { username: user.username, name: user.name } });
});

app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        delete SESSIONS[token];
    }
    res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// 2. Leads (Público e Autenticado)
app.post('/api/leads', (req, res) => {
    const { name, phone, email, interest, notes } = req.body;
    if (!name || !phone || !interest) {
        return res.status(400).json({ error: 'Nome, WhatsApp e Interesse são obrigatórios.' });
    }

    const db = readDb();
    const newLead = {
        id: Date.now().toString(),
        name,
        phone,
        email: email || 'Não informado',
        interest,
        date: new Date().toISOString(),
        status: 'Novo',
        notes: notes || ''
    };

    db.leads.push(newLead);
    writeDb(db);

    res.status(201).json(newLead);
});

app.get('/api/leads', requireAuth, (req, res) => {
    const db = readDb();
    res.json(db.leads);
});

app.put('/api/leads/:id/status', requireAuth, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: 'Status é obrigatório.' });
    }

    const db = readDb();
    const lead = db.leads.find(l => l.id === id);

    if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    lead.status = status;
    writeDb(db);
    res.json(lead);
});

app.put('/api/leads/:id/notes', requireAuth, (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    const db = readDb();
    const lead = db.leads.find(l => l.id === id);

    if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    lead.notes = notes;
    writeDb(db);
    res.json(lead);
});

app.delete('/api/leads/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const db = readDb();
    
    const initialLength = db.leads.length;
    db.leads = db.leads.filter(l => l.id !== id);

    if (db.leads.length === initialLength) {
        return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    writeDb(db);
    res.json({ success: true });
});

// 3. Configurações (Público e Autenticado)
app.get('/api/settings', (req, res) => {
    const db = readDb();
    res.json(db.settings);
});

app.put('/api/settings', requireAuth, (req, res) => {
    const { whatsappNumber, whatsappMessage, businessName, classPrice, courtPrice } = req.body;
    const db = readDb();

    db.settings = {
        whatsappNumber: whatsappNumber || db.settings.whatsappNumber,
        whatsappMessage: whatsappMessage || db.settings.whatsappMessage,
        businessName: businessName || db.settings.businessName,
        classPrice: classPrice || db.settings.classPrice,
        courtPrice: courtPrice || db.settings.courtPrice
    };

    writeDb(db);
    res.json(db.settings);
});

// 4. Administradores (Autenticado)
app.get('/api/users', requireAuth, (req, res) => {
    const db = readDb();
    // Remove as senhas por segurança ao enviar a lista
    const safeUsers = db.users.map(u => ({ username: u.username, name: u.name }));
    res.json(safeUsers);
});

app.post('/api/users', requireAuth, (req, res) => {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
    }

    const db = readDb();
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Usuário já cadastrado.' });
    }

    db.users.push({ name, username, password });
    writeDb(db);
    res.status(201).json({ username, name });
});

app.delete('/api/users/:username', requireAuth, (req, res) => {
    const { username } = req.params;
    const db = readDb();

    if (db.users.length <= 1) {
        return res.status(400).json({ error: 'Não é possível remover o único administrador cadastrado.' });
    }

    const initialLength = db.users.length;
    db.users = db.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());

    if (db.users.length === initialLength) {
        return res.status(404).json({ error: 'Administrador não encontrado.' });
    }

    writeDb(db);
    res.json({ success: true });
});

// --- SERVIR ARQUIVOS ESTÁTICOS COM SEGURANÇA ---
// Não expõe a pasta "data" nem o Dockerfile ou package.json diretamente
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Qualquer outro arquivo raiz que for estático (ex: admin.html se acessado via /admin.html)
app.get('/:file', (req, res, next) => {
    const allowedRootFiles = ['index.html', 'admin.html', 'favicon.ico'];
    if (allowedRootFiles.includes(req.params.file)) {
        res.sendFile(path.join(__dirname, req.params.file));
    } else {
        next();
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse o site em: http://localhost:${PORT}`);
    console.log(`Acesse o admin em: http://localhost:${PORT}/admin`);
});
