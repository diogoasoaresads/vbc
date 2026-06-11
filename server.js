const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.db');

// Middleware para JSON
app.use(express.json());

// --- SISTEMA DE ARMAZENAMENTO (SQLITE DATABASE) ---

// Garante que a pasta 'data' existe
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Conexão com o Banco de Dados
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados SQLite:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite com sucesso.');
    }
});

// Helpers para transformar métodos do SQLite em Promises
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this); // Retorna o contexto (inclui this.changes e this.lastID)
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Inicialização das tabelas e carga inicial de dados padrão
async function initDb() {
    try {
        // Tabela de Usuários (Administradores)
        await dbRun(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                name TEXT NOT NULL
            )
        `);

        // Tabela de Configurações (Garante apenas 1 linha com CHECK constraint)
        await dbRun(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                whatsappNumber TEXT NOT NULL,
                whatsappMessage TEXT NOT NULL,
                businessName TEXT NOT NULL,
                classPrice TEXT NOT NULL,
                courtPrice TEXT NOT NULL
            )
        `);

        // Tabela de Leads
        await dbRun(`
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                interest TEXT NOT NULL,
                date TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT
            )
        `);

        // Cria o usuário padrão caso o banco esteja vazio
        const adminUser = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
        if (!adminUser) {
            await dbRun('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', ['admin', 'admin123', 'Administrador Principal']);
            console.log('Usuário admin padrão inserido no SQLite.');
        }

        // Cria as configurações padrão se não existirem
        const settingsRow = await dbGet('SELECT * FROM settings WHERE id = 1');
        if (!settingsRow) {
            await dbRun(`
                INSERT INTO settings (id, whatsappNumber, whatsappMessage, businessName, classPrice, courtPrice)
                VALUES (1, ?, ?, ?, ?, ?)
            `, [
                '5521971475005',
                'Olá! Vim pelo site do Varandas Beach Club e gostaria de informações sobre aulas/aluguel de quadra.',
                'Varandas Beach Club',
                'R$ 150/mês',
                'R$ 80/hora'
            ]);
            console.log('Configurações padrão inseridas no SQLite.');
        }

    } catch (err) {
        console.error('Erro ao inicializar tabelas do banco SQLite:', err);
    }
}

initDb();

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
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // Executa de hora em hora

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
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    try {
        const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = ? AND password = ?', [username.toLowerCase(), password]);

        if (!user) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
        }

        // Gera token simples
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        SESSIONS[token] = {
            user: { username: user.username, name: user.name },
            expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
        };

        res.json({ token, user: { username: user.username, name: user.name } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao autenticar no servidor.' });
    }
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

// 2. Leads
app.post('/api/leads', async (req, res) => {
    const { name, phone, email, interest, notes } = req.body;
    if (!name || !phone || !interest) {
        return res.status(400).json({ error: 'Nome, WhatsApp e Interesse são obrigatórios.' });
    }

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

    try {
        await dbRun(`
            INSERT INTO leads (id, name, phone, email, interest, date, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [newLead.id, newLead.name, newLead.phone, newLead.email, newLead.interest, newLead.date, newLead.status, newLead.notes]);

        res.status(201).json(newLead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar lead no banco de dados SQLite.' });
    }
});

app.get('/api/leads', requireAuth, async (req, res) => {
    try {
        const leads = await dbAll('SELECT * FROM leads');
        res.json(leads);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao consultar leads no SQLite.' });
    }
});

app.put('/api/leads/:id/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: 'Status é obrigatório.' });
    }

    try {
        const result = await dbRun('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        const updatedLead = await dbGet('SELECT * FROM leads WHERE id = ?', [id]);
        res.json(updatedLead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar status do lead no SQLite.' });
    }
});

app.put('/api/leads/:id/notes', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    try {
        const result = await dbRun('UPDATE leads SET notes = ? WHERE id = ?', [notes, id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        const updatedLead = await dbGet('SELECT * FROM leads WHERE id = ?', [id]);
        res.json(updatedLead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar notas do lead no SQLite.' });
    }
});

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await dbRun('DELETE FROM leads WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir lead no SQLite.' });
    }
});

// 3. Configurações
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await dbGet('SELECT whatsappNumber, whatsappMessage, businessName, classPrice, courtPrice FROM settings WHERE id = 1');
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar configurações no SQLite.' });
    }
});

app.put('/api/settings', requireAuth, async (req, res) => {
    const { whatsappNumber, whatsappMessage, businessName, classPrice, courtPrice } = req.body;
    try {
        const current = await dbGet('SELECT * FROM settings WHERE id = 1');

        await dbRun(`
            UPDATE settings
            SET whatsappNumber = ?, whatsappMessage = ?, businessName = ?, classPrice = ?, courtPrice = ?
            WHERE id = 1
        `, [
            whatsappNumber || current.whatsappNumber,
            whatsappMessage || current.whatsappMessage,
            businessName || current.businessName,
            classPrice || current.classPrice,
            courtPrice || current.courtPrice
        ]);

        const updated = await dbGet('SELECT whatsappNumber, whatsappMessage, businessName, classPrice, courtPrice FROM settings WHERE id = 1');
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar configurações no SQLite.' });
    }
});

// 4. Administradores
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const users = await dbAll('SELECT username, name FROM users');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar administradores no SQLite.' });
    }
});

app.post('/api/users', requireAuth, async (req, res) => {
    const { name, username, password } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
    }

    try {
        const existing = await dbGet('SELECT * FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ error: 'Usuário já cadastrado.' });
        }

        await dbRun('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', [username, password, name]);
        res.status(201).json({ username, name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar administrador no SQLite.' });
    }
});

app.delete('/api/users/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
    try {
        const users = await dbAll('SELECT * FROM users');
        if (users.length <= 1) {
            return res.status(400).json({ error: 'Não é possível remover o único administrador cadastrado.' });
        }

        const result = await dbRun('DELETE FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Administrador não encontrado.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir administrador no SQLite.' });
    }
});

// --- SERVIR ARQUIVOS ESTÁTICOS COM SEGURANÇA ---
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Servir qualquer arquivo raiz estático autorizado
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
    console.log(`Servidor rodando com SQLite na porta ${PORT}`);
    console.log(`Site: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
});
