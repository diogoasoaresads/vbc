import { Storage } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa telas baseado no estado de autenticação
    checkAuth();

    // Eventos do Formulário de Login
    setupLoginForm();

    // Eventos de Navegação por Abas
    setupTabNavigation();

    // Eventos de Ações de Leads (Busca, Filtros, Exportação)
    setupCrmEvents();

    // Eventos de Modais
    setupModalEvents();

    // Eventos de Configurações
    setupSettingsForms();

    // Eventos de Gerência de Usuários
    setupUserForms();
});

// --- CONTROLE DE AUTENTICAÇÃO ---
function checkAuth() {
    const currentUser = Storage.getCurrentUser();
    const loginScreen = document.getElementById('loginScreen');
    const adminPanel = document.getElementById('adminPanel');

    if (currentUser) {
        // Logado
        loginScreen.style.display = 'none';
        adminPanel.style.display = 'grid';
        document.getElementById('currentAdminName').textContent = currentUser.name;
        
        // Inicializa dados do painel (assíncronos)
        renderLeads();
        loadSettingsInputs();
        renderAdmins();
    } else {
        // Deslogado
        loginScreen.style.display = 'flex';
        adminPanel.style.display = 'none';
    }
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginErrorMsg = document.getElementById('loginErrorMsg');
    const btnLogout = document.getElementById('btnLogout');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            const success = await Storage.login(username, password);
            if (success) {
                loginErrorMsg.style.display = 'none';
                loginForm.reset();
                checkAuth();
            } else {
                loginErrorMsg.style.display = 'block';
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await Storage.logout();
            checkAuth();
        });
    }
}

// --- NAVEGAÇÃO POR ABAS ---
function setupTabNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('pageTitle');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove ativa de todos os links
            sidebarLinks.forEach(l => l.classList.remove('active'));
            // Adiciona ativo no clicado
            link.classList.add('active');

            // Troca de aba
            const targetTabId = link.getAttribute('data-target');
            tabContents.forEach(tab => {
                tab.classList.remove('active');
                if (tab.id === targetTabId) {
                    tab.classList.add('active');
                }
            });

            // Atualiza título da página
            if (targetTabId === 'tab-leads') {
                pageTitle.textContent = 'Gestão de Leads (CRM)';
                renderLeads(); // Recarrega leads ao voltar
            } else if (targetTabId === 'tab-config-whatsapp') {
                pageTitle.textContent = 'Configurar WhatsApp & Geral';
                loadSettingsInputs();
            } else if (targetTabId === 'tab-config-users') {
                pageTitle.textContent = 'Gerenciamento de Administradores';
                renderAdmins();
            }
        });
    });
}

// --- CRM: LEADS ---
let currentLeads = [];

async function renderLeads() {
    try {
        currentLeads = await Storage.getLeads();
        
        // Atualiza estatísticas no topo
        updateCRMStats(currentLeads);

        const searchVal = document.getElementById('crmSearch').value.toLowerCase();
        const statusFilter = document.getElementById('crmFilterStatus').value;
        const interestFilter = document.getElementById('crmFilterInterest').value;

        const leadsTableBody = document.getElementById('leadsTableBody');
        const crmEmptyState = document.getElementById('crmEmptyState');
        
        leadsTableBody.innerHTML = '';

        // Filtragem
        const filteredLeads = currentLeads.filter(lead => {
            const matchesSearch = lead.name.toLowerCase().includes(searchVal) || 
                                  lead.phone.toLowerCase().includes(searchVal) || 
                                  lead.email.toLowerCase().includes(searchVal);
                                  
            const matchesStatus = statusFilter === '' || lead.status === statusFilter;
            const matchesInterest = interestFilter === '' || lead.interest === interestFilter;

            return matchesSearch && matchesStatus && matchesInterest;
        });

        // Ordena por data (mais recentes primeiro)
        filteredLeads.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredLeads.length === 0) {
            crmEmptyState.style.display = 'block';
            return;
        } else {
            crmEmptyState.style.display = 'none';
        }

        filteredLeads.forEach(lead => {
            const tr = document.createElement('tr');
            
            // Formata data
            const formattedDate = new Date(lead.date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Nome da opção de interesse formatada
            const interestMap = {
                'futevolei': 'Futevôlei',
                'beachtennis': 'Beach Tennis',
                'funcional': 'Funcional',
                'aluguel': 'Aluguel Quadra',
                'churrasqueira': 'Churrasqueira',
                'ambos': 'Múltiplos'
            };
            const interestLabel = interestMap[lead.interest] || lead.interest;

            const cleanPhone = lead.phone.replace(/\D/g, '');

            tr.innerHTML = `
                <td><strong>${lead.name}</strong></td>
                <td>
                    <a href="https://wa.me/${cleanPhone}" target="_blank" class="table-wa-link">
                        <i class="fa-brands fa-whatsapp text-green"></i> ${lead.phone}
                    </a>
                </td>
                <td>${lead.email}</td>
                <td><span class="interest-badge">${interestLabel}</span></td>
                <td>${formattedDate}</td>
                <td>
                    <select class="status-select-inline" data-id="${lead.id}">
                        <option value="Novo" ${lead.status === 'Novo' ? 'selected' : ''}>Novo</option>
                        <option value="Em Atendimento" ${lead.status === 'Em Atendimento' ? 'selected' : ''}>Em Atendimento</option>
                        <option value="Convertido" ${lead.status === 'Convertido' ? 'selected' : ''}>Convertido</option>
                        <option value="Perdido" ${lead.status === 'Perdido' ? 'selected' : ''}>Perdido</option>
                    </select>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon-table btn-notes" data-id="${lead.id}" title="Ver Anotações">
                            <i class="fa-regular fa-clipboard"></i>
                        </button>
                        <button class="btn-icon-table btn-delete" data-id="${lead.id}" title="Excluir Lead">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            // Modifica classe de acordo com status para fins estéticos no seletor
            const statusSelect = tr.querySelector('.status-select-inline');
            updateSelectClass(statusSelect);

            // Evento de alteração de status
            statusSelect.addEventListener('change', async (e) => {
                const leadId = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                try {
                    await Storage.updateLeadStatus(leadId, newStatus);
                    updateSelectClass(e.target);
                    // Recarrega estatísticas sem precisar renderizar a tabela inteira
                    updateCRMStats(await Storage.getLeads());
                } catch (error) {
                    alert('Erro ao atualizar status do lead: ' + error.message);
                }
            });

            // Evento para abrir anotações
            tr.querySelector('.btn-notes').addEventListener('click', () => {
                openNotesModal(lead.id, lead.name, lead.notes);
            });

            // Evento para excluir
            tr.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm(`Tem certeza que deseja excluir o lead ${lead.name}?`)) {
                    try {
                        await Storage.deleteLead(lead.id);
                        renderLeads();
                    } catch (error) {
                        alert('Erro ao excluir lead: ' + error.message);
                    }
                }
            });

            leadsTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Erro ao renderizar leads:', err);
    }
}

function updateSelectClass(selectElement) {
    selectElement.className = 'status-select-inline status-badge ';
    const val = selectElement.value;
    if (val === 'Novo') selectElement.classList.add('status-novo');
    else if (val === 'Em Atendimento') selectElement.classList.add('status-atendimento');
    else if (val === 'Convertido') selectElement.classList.add('status-convertido');
    else if (val === 'Perdido') selectElement.classList.add('status-perdido');
}

function updateCRMStats(leads) {
    const total = leads.length;
    const novos = leads.filter(l => l.status === 'Novo').length;
    const convertidos = leads.filter(l => l.status === 'Convertido').length;

    document.getElementById('stat-total-leads').textContent = total;
    document.getElementById('stat-new-leads').textContent = novos;
    document.getElementById('stat-converted-leads').textContent = convertidos;
}

function setupCrmEvents() {
    const crmSearch = document.getElementById('crmSearch');
    const crmFilterStatus = document.getElementById('crmFilterStatus');
    const crmFilterInterest = document.getElementById('crmFilterInterest');
    const btnExportCSV = document.getElementById('btnExportCSV');

    if (crmSearch) crmSearch.addEventListener('input', renderLeads);
    if (crmFilterStatus) crmFilterStatus.addEventListener('change', renderLeads);
    if (crmFilterInterest) crmFilterInterest.addEventListener('change', renderLeads);

    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', exportLeadsToCSV);
    }
}

// Exporta base de Leads para CSV compatível com Excel brasileiro (separado por ponto e vírgula)
async function exportLeadsToCSV() {
    try {
        const leads = await Storage.getLeads();
        if (leads.length === 0) {
            alert('Não há leads cadastrados para exportar.');
            return;
        }

        let csvContent = '\uFEFF'; // BOM para UTF-8 (corrige acentuação no Excel)
        csvContent += 'Nome;WhatsApp;E-mail;Interesse;Data Cadastro;Status;Anotações\n';

        leads.forEach(lead => {
            const formattedDate = new Date(lead.date).toLocaleString('pt-BR');
            const interestMap = {
                'futevolei': 'Futevôlei',
                'beachtennis': 'Beach Tennis',
                'funcional': 'Funcional',
                'aluguel': 'Aluguel Quadra',
                'churrasqueira': 'Churrasqueira',
                'ambos': 'Múltiplos'
            };
            const interestLabel = interestMap[lead.interest] || lead.interest;
            
            // Limpa notas de possíveis quebras de linha para não corromper o CSV
            const cleanNotes = lead.notes.replace(/[\r\n]+/g, ' ').replace(/;/g, ',');
            
            csvContent += `"${lead.name}";"${lead.phone}";"${lead.email}";"${interestLabel}";"${formattedDate}";"${lead.status}";"${cleanNotes}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `leads_varanda_beach_club_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        alert('Erro ao exportar leads: ' + err.message);
    }
}

// --- MODAL DE NOTAS ---
const notesModal = document.getElementById('notesModal');
const modalNotesLeadName = document.getElementById('modalNotesLeadName');
const modalNotesLeadId = document.getElementById('modalNotesLeadId');
const modalNotesTextarea = document.getElementById('modalNotesTextarea');
const closeNotesModalBtn = document.getElementById('closeNotesModalBtn');

function openNotesModal(leadId, leadName, leadNotes) {
    if (notesModal) {
        modalNotesLeadId.value = leadId;
        modalNotesLeadName.textContent = leadName;
        modalNotesTextarea.value = leadNotes;
        notesModal.classList.add('show');
    }
}

function closeNotesModal() {
    if (notesModal) {
        notesModal.classList.remove('show');
    }
}

function setupModalEvents() {
    if (closeNotesModalBtn) {
        closeNotesModalBtn.addEventListener('click', closeNotesModal);
    }

    window.addEventListener('click', (e) => {
        if (e.target === notesModal) {
            closeNotesModal();
        }
    });

    const leadNotesForm = document.getElementById('leadNotesForm');
    if (leadNotesForm) {
        leadNotesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const leadId = modalNotesLeadId.value;
            const notes = modalNotesTextarea.value;
            
            try {
                await Storage.updateLeadNotes(leadId, notes);
                closeNotesModal();
                renderLeads(); // Atualiza tabela para persistir visualmente
            } catch (err) {
                alert('Erro ao atualizar notas: ' + err.message);
            }
        });
    }
}

// --- ABA 2: CONFIGURAÇÕES ---
async function loadSettingsInputs() {
    try {
        const settings = await Storage.getSettings();

        // WhatsApp Form
        document.getElementById('config-wa-number').value = settings.whatsappNumber;
        document.getElementById('config-wa-message').value = settings.whatsappMessage;

        // General Config Form
        document.getElementById('config-business-name').value = settings.businessName || 'Varanda Beach Club';
        document.getElementById('config-class-price').value = settings.classPrice || 'R$ 150/mês';
        document.getElementById('config-court-price').value = settings.courtPrice || 'R$ 80/hora';
    } catch (err) {
        console.error('Erro ao carregar configurações nas inputs:', err);
    }
}

function setupSettingsForms() {
    const whatsappConfigForm = document.getElementById('whatsappConfigForm');
    const generalConfigForm = document.getElementById('generalConfigForm');

    if (whatsappConfigForm) {
        whatsappConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const settings = await Storage.getSettings();
                
                settings.whatsappNumber = document.getElementById('config-wa-number').value.trim();
                settings.whatsappMessage = document.getElementById('config-wa-message').value;

                await Storage.saveSettings(settings);
                alert('Configurações do WhatsApp salvas com sucesso!');
            } catch (err) {
                alert('Erro ao salvar configurações do WhatsApp: ' + err.message);
            }
        });
    }

    if (generalConfigForm) {
        generalConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const settings = await Storage.getSettings();

                settings.businessName = document.getElementById('config-business-name').value.trim();
                settings.classPrice = document.getElementById('config-class-price').value.trim();
                settings.courtPrice = document.getElementById('config-court-price').value.trim();

                await Storage.saveSettings(settings);
                alert('Configurações gerais salvas com sucesso! As alterações serão exibidas na Landing Page.');
            } catch (err) {
                alert('Erro ao salvar configurações gerais: ' + err.message);
            }
        });
    }
}

// --- ABA 3: ADMINISTRADORES ---
async function renderAdmins() {
    try {
        const users = await Storage.getUsers();
        const adminsTableBody = document.getElementById('adminsTableBody');
        
        if (!adminsTableBody) return;
        
        adminsTableBody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${user.name}</strong></td>
                <td>@${user.username}</td>
                <td>
                    <button class="btn-icon-table btn-delete btn-delete-user" data-username="${user.username}" title="Remover Administrador">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            tr.querySelector('.btn-delete-user').addEventListener('click', async (e) => {
                const username = e.currentTarget.getAttribute('data-username');
                
                // Impede auto-exclusão do usuário logado no momento para segurança
                const currentUser = Storage.getCurrentUser();
                if (currentUser && currentUser.username.toLowerCase() === username.toLowerCase()) {
                    alert('Você não pode excluir o usuário que está logado no momento!');
                    return;
                }

                if (confirm(`Tem certeza que deseja excluir o administrador @${username}?`)) {
                    try {
                        await Storage.deleteUser(username);
                        renderAdmins();
                    } catch (error) {
                        alert(error.message);
                    }
                }
            });

            adminsTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Erro ao listar administradores:', err);
    }
}

function setupUserForms() {
    const newUserForm = document.getElementById('newUserForm');
    
    if (newUserForm) {
        newUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('new-user-name').value.trim();
            const username = document.getElementById('new-user-username').value.trim().toLowerCase();
            const password = document.getElementById('new-user-password').value;

            try {
                await Storage.addUser({ name, username, password });
                alert(`Administrador @${username} adicionado com sucesso!`);
                newUserForm.reset();
                renderAdmins();
            } catch (error) {
                alert(error.message);
            }
        });
    }
}
