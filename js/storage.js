/**
 * Módulo de armazenamento modificado para consumir a API centralizada do servidor Express.
 * Mantém a interface original do objeto Storage, usando chamadas assíncronas (fetch).
 */

const STORAGE_KEYS = {
    TOKEN: 'varanda_token',
    CURRENT_USER: 'varanda_current_user'
};

// Auxiliar para montar cabeçalhos com token de autenticação
function getHeaders() {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Auxiliar para lidar com respostas de erro
async function handleResponse(response) {
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Ocorreu um erro na requisição do servidor.');
    }
    return response.json();
}

export const Storage = {
    // --- LEADS ---
    async getLeads() {
        try {
            const res = await fetch('/api/leads', {
                method: 'GET',
                headers: getHeaders()
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao buscar leads:', error);
            throw error;
        }
    },

    async addLead(lead) {
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lead)
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao adicionar lead:', error);
            throw error;
        }
    },

    async updateLeadStatus(leadId, newStatus) {
        try {
            const res = await fetch(`/api/leads/${leadId}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao atualizar status do lead:', error);
            throw error;
        }
    },

    async updateLeadNotes(leadId, notes) {
        try {
            const res = await fetch(`/api/leads/${leadId}/notes`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ notes })
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao atualizar notas do lead:', error);
            throw error;
        }
    },

    async deleteLead(leadId) {
        try {
            const res = await fetch(`/api/leads/${leadId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao deletar lead:', error);
            throw error;
        }
    },

    // --- CONFIGURAÇÕES ---
    async getSettings() {
        try {
            const res = await fetch('/api/settings');
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            // Retorna um padrão temporário em caso de falha de conexão
            return {
                whatsappNumber: '5511999999999',
                whatsappMessage: 'Olá! Vim pelo site.',
                businessName: 'Varanda Beach Club',
                classPrice: 'R$ 150/mês',
                courtPrice: 'R$ 80/hora'
            };
        }
    },

    async saveSettings(settings) {
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(settings)
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            throw error;
        }
    },

    // --- USUÁRIOS ---
    async getUsers() {
        try {
            const res = await fetch('/api/users', {
                method: 'GET',
                headers: getHeaders()
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao buscar administradores:', error);
            throw error;
        }
    },

    async addUser(user) {
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(user)
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao adicionar administrador:', error);
            throw error;
        }
    },

    async deleteUser(username) {
        try {
            const res = await fetch(`/api/users/${username}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            return await handleResponse(res);
        } catch (error) {
            console.error('Erro ao deletar administrador:', error);
            throw error;
        }
    },

    // --- AUTENTICAÇÃO ---
    async login(username, password) {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                return false;
            }

            const data = await res.json();
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
            return true;
        } catch (error) {
            console.error('Erro no login:', error);
            return false;
        }
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: getHeaders()
            }).catch(() => {});
        } finally {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
    },

    getCurrentUser() {
        // Retorna o usuário cacheado localmente para exibição síncrona
        const userStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return userStr ? JSON.parse(userStr) : null;
    }
};
