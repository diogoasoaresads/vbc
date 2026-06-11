import { Storage } from './storage.js';

// Variáveis Globais do CRM
let currentLeads = [];
let activeLeadId = null;
let currentView = 'table'; // 'table' ou 'kanban'

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa telas baseado no estado de autenticação
    checkAuth();

    // Eventos do Formulário de Login
    setupLoginForm();

    // Eventos de Navegação por Abas
    setupTabNavigation();

    // Eventos de Ações de Leads (Busca, Filtros, Exportação, Alternar Visualização)
    setupCrmEvents();

    // Eventos do Drawer Lateral (Gaveta)
    setupDrawerEvents();

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
        refreshCRMData();
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

            // Fechar drawer caso mude de aba
            closeDrawer();

            // Atualiza título da página
            if (targetTabId === 'tab-leads') {
                pageTitle.textContent = 'Gestão de Leads (CRM)';
                refreshCRMData(); 
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

// --- CRM: CORE DATA CONTROLLER ---
async function refreshCRMData() {
    try {
        currentLeads = await Storage.getLeads();
        updateCRMStats(currentLeads);
        
        if (currentView === 'table') {
            renderLeadsTable();
        } else {
            renderLeadsKanban();
        }
    } catch (err) {
        console.error('Erro ao atualizar dados do CRM:', err);
    }
}

function updateCRMStats(leads) {
    const total = leads.length;
    const novos = leads.filter(l => l.status === 'Novo').length;
    const convertidos = leads.filter(l => l.status === 'Convertido').length;

    // Cálculo da taxa de conversão (Convertidos / Total)
    const rate = total > 0 ? Math.round((convertidos / total) * 100) : 0;

    document.getElementById('stat-total-leads').textContent = total;
    document.getElementById('stat-new-leads').textContent = novos;
    document.getElementById('stat-conversion-rate').textContent = `${rate}%`;
}

// Filtragem compartilhada (Tabela e Kanban)
function getFilteredLeads() {
    const searchVal = document.getElementById('crmSearch').value.toLowerCase();
    const statusFilter = document.getElementById('crmFilterStatus').value;
    const interestFilter = document.getElementById('crmFilterInterest').value;

    return currentLeads.filter(lead => {
        const matchesSearch = lead.name.toLowerCase().includes(searchVal) || 
                              lead.phone.toLowerCase().includes(searchVal) || 
                              lead.email.toLowerCase().includes(searchVal);
                              
        const matchesStatus = statusFilter === '' || lead.status === statusFilter;
        const matchesInterest = interestFilter === '' || lead.interest === interestFilter;

        return matchesSearch && matchesStatus && matchesInterest;
    });
}

// --- RENDERIZAR TABELA ---
function renderLeadsTable() {
    const filteredLeads = getFilteredLeads();
    const leadsTableBody = document.getElementById('leadsTableBody');
    const crmEmptyState = document.getElementById('crmEmptyState');
    
    leadsTableBody.innerHTML = '';

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
        tr.setAttribute('data-id', lead.id);
        
        // Formata data
        const formattedDate = new Date(lead.date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

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
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="table-wa-link" onclick="event.stopPropagation();">
                    <i class="fa-brands fa-whatsapp text-green"></i> ${lead.phone}
                </a>
            </td>
            <td>${lead.email}</td>
            <td><span class="interest-badge">${interestLabel}</span></td>
            <td>${formattedDate}</td>
            <td>
                <span class="status-badge status-${lead.status.toLowerCase().replace(' ', '-')}">${lead.status}</span>
            </td>
            <td>
                <div class="table-actions" onclick="event.stopPropagation();">
                    <select class="status-select-inline" data-id="${lead.id}">
                        <option value="Novo" ${lead.status === 'Novo' ? 'selected' : ''}>Novo</option>
                        <option value="Em Atendimento" ${lead.status === 'Em Atendimento' ? 'selected' : ''}>Em Atendimento</option>
                        <option value="Convertido" ${lead.status === 'Convertido' ? 'selected' : ''}>Convertido</option>
                        <option value="Perdido" ${lead.status === 'Perdido' ? 'selected' : ''}>Perdido</option>
                    </select>
                    <button class="btn-icon-table btn-delete" data-id="${lead.id}" title="Excluir Lead">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        // Evento de clique na linha abre a gaveta (drawer)
        tr.addEventListener('click', () => {
            openDrawer(lead);
        });

        // Evento de alteração de status rápida na tabela
        const statusSelect = tr.querySelector('.status-select-inline');
        statusSelect.addEventListener('change', async (e) => {
            const leadId = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            try {
                await Storage.updateLeadStatus(leadId, newStatus);
                refreshCRMData();
            } catch (error) {
                alert('Erro ao atualizar status: ' + error.message);
            }
        });

        // Evento para excluir rápido na tabela
        tr.querySelector('.btn-delete').addEventListener('click', async (e) => {
            if (confirm(`Tem certeza que deseja excluir o lead ${lead.name}?`)) {
                try {
                    await Storage.deleteLead(lead.id);
                    refreshCRMData();
                } catch (error) {
                    alert('Erro ao excluir: ' + error.message);
                }
            }
        });

        leadsTableBody.appendChild(tr);
    });
}

// --- RENDERIZAR KANBAN ---
function renderLeadsKanban() {
    const filteredLeads = getFilteredLeads();
    
    // Mapeamento dos wrappers de cards
    const columns = {
        'Novo': {
            wrapper: document.getElementById('cards-novo'),
            count: document.getElementById('count-novo'),
            leads: []
        },
        'Em Atendimento': {
            wrapper: document.getElementById('cards-atendimento'),
            count: document.getElementById('count-atendimento'),
            leads: []
        },
        'Convertido': {
            wrapper: document.getElementById('cards-convertido'),
            count: document.getElementById('count-convertido'),
            leads: []
        },
        'Perdido': {
            wrapper: document.getElementById('cards-perdido'),
            count: document.getElementById('count-perdido'),
            leads: []
        }
    };

    // Limpa wrappers
    for (const key in columns) {
        columns[key].wrapper.innerHTML = '';
        columns[key].leads = [];
    }

    // Distribui os leads pelas colunas correspondentes
    filteredLeads.forEach(lead => {
        if (columns[lead.status]) {
            columns[lead.status].leads.push(lead);
        }
    });

    // Renderiza cada card nas colunas
    const interestMap = {
        'futevolei': 'Futevôlei',
        'beachtennis': 'Beach Tennis',
        'funcional': 'Funcional',
        'aluguel': 'Aluguel',
        'churrasqueira': 'Churrasqueira',
        'ambos': 'Múltiplos'
    };

    for (const status in columns) {
        const col = columns[status];
        col.count.textContent = col.leads.length;

        if (col.leads.length === 0) {
            col.wrapper.innerHTML = `
                <div class="empty-state" style="padding: 20px 0; font-size: 0.85rem;">
                    <p>Sem leads</p>
                </div>
            `;
            continue;
        }

        // Ordena mais recentes no topo
        col.leads.sort((a, b) => new Date(b.date) - new Date(a.date));

        col.leads.forEach(lead => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.setAttribute('data-id', lead.id);

            const formattedDate = new Date(lead.date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit'
            });
            const interestLabel = interestMap[lead.interest] || lead.interest;

            card.innerHTML = `
                <h5>${lead.name}</h5>
                <span class="interest-badge">${interestLabel}</span>
                <div class="kanban-card-meta">
                    <span class="kanban-card-date"><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
                    <span><i class="fa-brands fa-whatsapp text-green"></i></span>
                </div>
            `;

            // Clique no card abre a gaveta (drawer)
            card.addEventListener('click', () => {
                openDrawer(lead);
            });

            col.wrapper.appendChild(card);
        });
    }
}

// --- SETUP DOS FILTROS E ALTERNAÇÃO DE VISUALIZAÇÃO ---
function setupCrmEvents() {
    const crmSearch = document.getElementById('crmSearch');
    const crmFilterStatus = document.getElementById('crmFilterStatus');
    const crmFilterInterest = document.getElementById('crmFilterInterest');
    const btnExportCSV = document.getElementById('btnExportCSV');
    
    // Toggles de View
    const btnViewTable = document.getElementById('btnViewTable');
    const btnViewKanban = document.getElementById('btnViewKanban');
    const tableContainer = document.getElementById('leadsTableContainer');
    const kanbanContainer = document.getElementById('leadsKanbanContainer');

    if (crmSearch) crmSearch.addEventListener('input', refreshCRMData);
    if (crmFilterStatus) crmFilterStatus.addEventListener('change', refreshCRMData);
    if (crmFilterInterest) crmFilterInterest.addEventListener('change', refreshCRMData);

    if (btnExportCSV) btnExportCSV.addEventListener('click', exportLeadsToCSV);

    // Eventos de alternância de view
    if (btnViewTable && btnViewKanban) {
        btnViewTable.addEventListener('click', () => {
            currentView = 'table';
            btnViewTable.classList.add('active');
            btnViewKanban.classList.remove('active');
            tableContainer.style.display = 'block';
            kanbanContainer.style.display = 'none';
            refreshCRMData();
        });

        btnViewKanban.addEventListener('click', () => {
            currentView = 'kanban';
            btnViewKanban.classList.add('active');
            btnViewTable.classList.remove('active');
            tableContainer.style.display = 'none';
            kanbanContainer.style.display = 'block';
            refreshCRMData();
        });
    }
}

// Exporta para CSV
async function exportLeadsToCSV() {
    try {
        const leads = await Storage.getLeads();
        if (leads.length === 0) {
            alert('Não há leads cadastrados para exportar.');
            return;
        }

        let csvContent = '\uFEFF'; 
        csvContent += 'Nome;WhatsApp;E-mail;Interesse;Data Cadastro;Status;Anotações\n';

        const interestMap = {
            'futevolei': 'Futevôlei',
            'beachtennis': 'Beach Tennis',
            'funcional': 'Funcional',
            'aluguel': 'Aluguel Quadra',
            'churrasqueira': 'Churrasqueira',
            'ambos': 'Múltiplos'
        };

        leads.forEach(lead => {
            const formattedDate = new Date(lead.date).toLocaleString('pt-BR');
            const interestLabel = interestMap[lead.interest] || lead.interest;
            const cleanNotes = lead.notes.replace(/[\r\n]+/g, ' ').replace(/;/g, ',');
            
            csvContent += `"${lead.name}";"${lead.phone}";"${lead.email}";"${interestLabel}";"${formattedDate}";"${lead.status}";"${cleanNotes}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `leads_varandas_beach_club_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        alert('Erro ao exportar leads: ' + err.message);
    }
}

// --- DRAWER DE DETALHES DO LEAD (GAVETA LATERAL) ---
const leadDrawer = document.getElementById('leadDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');

function openDrawer(lead) {
    if (!leadDrawer || !drawerOverlay) return;

    activeLeadId = lead.id;

    // Atualiza badges e classes de status
    const statusBadge = document.getElementById('drawerLeadStatusBadge');
    statusBadge.textContent = lead.status;
    statusBadge.className = `status-badge status-${lead.status.toLowerCase().replace(' ', '-')}`;

    // Atualiza Textos Básicos
    document.getElementById('drawerLeadName').textContent = lead.name;
    
    const formattedDate = new Date(lead.date).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('drawerLeadDate').textContent = `Cadastrado em ${formattedDate}`;
    
    document.getElementById('drawerDetailPhone').textContent = lead.phone;
    document.getElementById('drawerDetailEmail').textContent = lead.email;

    const interestMap = {
        'futevolei': 'Aulas de Futevôlei',
        'beachtennis': 'Aulas de Beach Tennis',
        'funcional': 'Treino Funcional na Areia',
        'aluguel': 'Aluguel de Quadras',
        'churrasqueira': 'Aluguel de Churrasqueira',
        'ambos': 'Múltiplos Interesses'
    };
    document.getElementById('drawerDetailInterest').textContent = interestMap[lead.interest] || lead.interest;

    // Dropdown de Status
    document.getElementById('drawerStatusSelect').value = lead.status;

    // Notas de atendimento
    document.getElementById('drawerNotesTextarea').value = lead.notes;

    // Links de Ação Rápida
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const waText = encodeURIComponent(`Olá ${lead.name}! Aqui é do Varandas Beach Club, tudo bem?`);
    document.getElementById('btnDrawerWhatsApp').href = `https://wa.me/${cleanPhone}?text=${waText}`;
    document.getElementById('btnDrawerEmail').href = `mailto:${lead.email}?subject=Varandas%20Beach%20Club`;

    // Exibe a gaveta e overlay com animação
    leadDrawer.classList.add('open');
    drawerOverlay.classList.add('open');
}

function closeDrawer() {
    if (leadDrawer && drawerOverlay) {
        leadDrawer.classList.remove('open');
        drawerOverlay.classList.remove('open');
        activeLeadId = null;
    }
}

function setupDrawerEvents() {
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    // Atalho tecla ESC para fechar gaveta
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDrawer();
        }
    });

    // Form de Notas do Drawer
    const drawerNotesForm = document.getElementById('drawerNotesForm');
    if (drawerNotesForm) {
        drawerNotesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeLeadId) return;

            const notes = document.getElementById('drawerNotesTextarea').value;
            try {
                await Storage.updateLeadNotes(activeLeadId, notes);
                alert('Anotações salvas com sucesso!');
                // Atualiza dados e recarrega os leads para sincronizar a memória local
                const updatedLeads = await Storage.getLeads();
                const updatedLead = updatedLeads.find(l => l.id === activeLeadId);
                currentLeads = updatedLeads;
                
                if (updatedLead) {
                    // Atualiza a gaveta com o novo dado sem precisar fechá-la
                    document.getElementById('drawerNotesTextarea').value = updatedLead.notes;
                }
                
                // Atualiza visualizações em background
                if (currentView === 'table') renderLeadsTable();
                else renderLeadsKanban();
            } catch (err) {
                alert('Erro ao salvar observações: ' + err.message);
            }
        });
    }

    // Select de Status no Drawer
    const drawerStatusSelect = document.getElementById('drawerStatusSelect');
    if (drawerStatusSelect) {
        drawerStatusSelect.addEventListener('change', async (e) => {
            if (!activeLeadId) return;

            const newStatus = e.target.value;
            try {
                await Storage.updateLeadStatus(activeLeadId, newStatus);
                
                // Atualiza crachá superior do drawer
                const badge = document.getElementById('drawerLeadStatusBadge');
                badge.textContent = newStatus;
                badge.className = `status-badge status-${newStatus.toLowerCase().replace(' ', '-')}`;

                refreshCRMData();
            } catch (err) {
                alert('Erro ao atualizar status: ' + err.message);
            }
        });
    }

    // Botão de Exclusão no Drawer
    const btnDrawerDeleteLead = document.getElementById('btnDrawerDeleteLead');
    if (btnDrawerDeleteLead) {
        btnDrawerDeleteLead.addEventListener('click', async () => {
            if (!activeLeadId) return;
            const leadName = document.getElementById('drawerLeadName').textContent;

            if (confirm(`Tem certeza que deseja excluir o lead ${leadName} definitivamente?`)) {
                try {
                    await Storage.deleteLead(activeLeadId);
                    closeDrawer();
                    refreshCRMData();
                } catch (err) {
                    alert('Erro ao excluir lead: ' + err.message);
                }
            }
        });
    }
}

// --- ABA 2: CONFIGURAÇÕES ---
async function loadSettingsInputs() {
    try {
        const settings = await Storage.getSettings();

        // Contato e Localização Form
        document.getElementById('config-wa-number').value = settings.whatsappNumber || '';
        document.getElementById('config-wa-message').value = settings.whatsappMessage || '';
        document.getElementById('config-business-address').value = settings.businessAddress || '';
        document.getElementById('config-instagram-url').value = settings.instagramUrl || '';
        document.getElementById('config-business-email').value = settings.businessEmail || '';

        // Preços, Horários e Avisos Form
        document.getElementById('config-business-name').value = settings.businessName || '';
        document.getElementById('config-class-schedules').value = settings.classSchedules || '';
        document.getElementById('config-business-hours').value = settings.businessHours || '';
        document.getElementById('config-class-price').value = settings.classPrice || '';
        document.getElementById('config-beachtennis-price').value = settings.beachTennisPrice || '';
        document.getElementById('config-functional-price').value = settings.functionalPrice || '';
        document.getElementById('config-court-price').value = settings.courtPrice || '';
        document.getElementById('config-alert-active').value = settings.alertBarActive !== undefined ? settings.alertBarActive : 0;
        document.getElementById('config-alert-text').value = settings.alertBarText || '';

        // Aparência e Textos do Site Form
        document.getElementById('config-hero-badge').value = settings.heroBadge || '';
        document.getElementById('config-hero-title').value = settings.heroTitle || '';
        document.getElementById('config-hero-desc').value = settings.heroDescription || '';
        document.getElementById('config-about-title').value = settings.aboutTitle || '';
        document.getElementById('config-about-text1').value = settings.aboutText1 || '';
        document.getElementById('config-about-text2').value = settings.aboutText2 || '';

        // SEO & Extras Form
        document.getElementById('config-seo-title').value = settings.seoTitle || '';
        document.getElementById('config-seo-desc').value = settings.seoDescription || '';
        document.getElementById('config-churrasqueira-price').value = settings.churrasqueiraPrice || '';
        document.getElementById('config-google-maps').value = settings.googleMapsLink || '';
    } catch (err) {
        console.error('Erro ao carregar configurações nas inputs:', err);
    }
}

function setupSettingsForms() {
    const whatsappConfigForm = document.getElementById('whatsappConfigForm');
    const generalConfigForm = document.getElementById('generalConfigForm');
    const siteTextsConfigForm = document.getElementById('siteTextsConfigForm');
    const seoLazerConfigForm = document.getElementById('seoLazerConfigForm');

    if (whatsappConfigForm) {
        whatsappConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const settings = await Storage.getSettings();
                
                settings.whatsappNumber = document.getElementById('config-wa-number').value.trim();
                settings.whatsappMessage = document.getElementById('config-wa-message').value;
                settings.businessAddress = document.getElementById('config-business-address').value.trim();
                settings.instagramUrl = document.getElementById('config-instagram-url').value.trim();
                settings.businessEmail = document.getElementById('config-business-email').value.trim();

                await Storage.saveSettings(settings);
                alert('Configurações de Contato salvas com sucesso!');
            } catch (err) {
                alert('Erro ao salvar configurações de contato: ' + err.message);
            }
        });
    }

    if (generalConfigForm) {
        generalConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const settings = await Storage.getSettings();

                settings.businessName = document.getElementById('config-business-name').value.trim();
                settings.classSchedules = document.getElementById('config-class-schedules').value.trim();
                settings.businessHours = document.getElementById('config-business-hours').value.trim();
                settings.classPrice = document.getElementById('config-class-price').value.trim();
                settings.beachTennisPrice = document.getElementById('config-beachtennis-price').value.trim();
                settings.functionalPrice = document.getElementById('config-functional-price').value.trim();
                settings.courtPrice = document.getElementById('config-court-price').value.trim();
                settings.alertBarActive = parseInt(document.getElementById('config-alert-active').value);
                settings.alertBarText = document.getElementById('config-alert-text').value.trim();

                await Storage.saveSettings(settings);
                alert('Configurações Gerais salvas com sucesso! As alterações já estão ativas no site.');
            } catch (err) {
                alert('Erro ao salvar configurações gerais: ' + err.message);
            }
        });
    }

    if (siteTextsConfigForm) {
        siteTextsConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const settings = await Storage.getSettings();

                settings.heroBadge = document.getElementById('config-hero-badge').value.trim();
                settings.heroTitle = document.getElementById('config-hero-title').value.trim();
                settings.heroDescription = document.getElementById('config-hero-desc').value.trim();
                settings.aboutTitle = document.getElementById('config-about-title').value.trim();
                settings.aboutText1 = document.getElementById('config-about-text1').value.trim();
                settings.aboutText2 = document.getElementById('config-about-text2').value.trim();

                await Storage.saveSettings(settings);
                alert('Textos do site salvos com sucesso! As alterações já estão ativas na página inicial.');
            } catch (err) {
                alert('Erro ao salvar textos do site: ' + err.message);
            }
        });
    }

    if (seoLazerConfigForm) {
        seoLazerConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const settings = await Storage.getSettings();

                settings.seoTitle = document.getElementById('config-seo-title').value.trim();
                settings.seoDescription = document.getElementById('config-seo-desc').value.trim();
                settings.churrasqueiraPrice = document.getElementById('config-churrasqueira-price').value.trim();
                settings.googleMapsLink = document.getElementById('config-google-maps').value.trim();

                await Storage.saveSettings(settings);
                alert('SEO e informações extras salvas com sucesso! As alterações já estão ativas.');
            } catch (err) {
                alert('Erro ao salvar configurações de SEO e extras: ' + err.message);
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
