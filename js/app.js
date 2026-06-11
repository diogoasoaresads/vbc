import { Storage } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
    // Carregar configurações de WhatsApp e Preços
    loadDynamicSettings();

    // Menu Mobile
    setupMobileMenu();

    // Scroll Header Effect
    setupHeaderScroll();

    // Configurar Modais
    setupModalEvents();

    // Submissão de Formulários
    setupFormSubmissions();
});

// Carrega dados dinâmicos do LocalStorage e exibe nos elementos
async function loadDynamicSettings() {
    const settings = await Storage.getSettings();

    // Exibe preços configurados
    const displayClassPrice = document.getElementById('display-class-price');
    const displayCourtPrice = document.getElementById('display-court-price');
    
    if (displayClassPrice && settings.classPrice) {
        displayClassPrice.textContent = settings.classPrice;
    }
    if (displayCourtPrice && settings.courtPrice) {
        displayCourtPrice.textContent = settings.courtPrice;
    }

    // Configura o link do Botão Flutuante do WhatsApp
    const whatsappFloatingBtn = document.getElementById('whatsappFloatingBtn');
    if (whatsappFloatingBtn) {
        const url = getWhatsAppLink(settings.whatsappNumber, settings.whatsappMessage);
        whatsappFloatingBtn.href = url;
    }
}

// Gera URL do WhatsApp
function getWhatsAppLink(number, text) {
    // Remove caracteres não numéricos
    const cleanNumber = number.replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${cleanNumber}?text=${encodedText}`;
}

// Configura o Menu Mobile (Hambúrguer)
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.className = 'fa-solid fa-xmark';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        });

        // Fecha o menu ao clicar em algum link
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                menuToggle.querySelector('i').className = 'fa-solid fa-bars';
            });
        });
    }
}

// Efeito de rolagem no cabeçalho
function setupHeaderScroll() {
    const header = document.querySelector('.main-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Atualiza link ativo no menu baseado no scroll
        updateActiveLink();
    });
}

// Atualiza a classe ativa do link do menu ao rolar
function updateActiveLink() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let currentSectionId = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            currentSectionId = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSectionId}`) {
            link.classList.add('active');
        }
    });
}

// Controla exibição do Modal
const leadModal = document.getElementById('leadModal');
const modalTitleText = document.getElementById('modal-title-text');
const modalSourceDetail = document.getElementById('modal-source-detail');
const modalInterestSelect = document.getElementById('modal-interest');

// Expõe funções de modal para o escopo global (usado nos botões onclick)
window.openLeadModal = function(interestType, detail = '') {
    if (leadModal) {
        leadModal.classList.add('show');
        
        // Customiza o título do modal
        if (interestType === 'aulas') {
            modalTitleText.textContent = 'Garantir minha vaga nas Aulas';
            modalInterestSelect.value = 'aulas';
        } else if (interestType === 'aluguel') {
            modalTitleText.textContent = 'Reservar Horário de Quadra';
            modalInterestSelect.value = 'aluguel';
        } else {
            modalTitleText.textContent = 'Fazer Pré-Cadastro';
            modalInterestSelect.value = 'ambos';
        }
        
        modalSourceDetail.value = detail;
    }
};

window.closeLeadModal = function() {
    if (leadModal) {
        leadModal.classList.remove('show');
    }
};

function setupModalEvents() {
    // Fecha clicando fora do card
    window.addEventListener('click', (event) => {
        if (event.target === leadModal) {
            closeLeadModal();
        }
    });
}

// Configura o envio de formulários e integração com o CRM e WhatsApp
function setupFormSubmissions() {
    const heroLeadForm = document.getElementById('heroLeadForm');
    const modalLeadForm = document.getElementById('modalLeadForm');

    // Form 1: Formulário Rápido na Hero
    if (heroLeadForm) {
        heroLeadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('hero-name').value;
            const phone = document.getElementById('hero-phone').value;
            const interest = document.getElementById('hero-interest').value;

            const newLead = {
                name,
                phone,
                email: 'Não informado',
                interest,
                notes: 'Enviado pelo formulário rápido da página inicial.'
            };

            handleLeadSubmission(newLead, heroLeadForm);
        });
    }

    // Form 2: Formulário detalhado do Modal
    if (modalLeadForm) {
        modalLeadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('modal-name').value;
            const phone = document.getElementById('modal-phone').value;
            const email = document.getElementById('modal-email').value;
            const interest = document.getElementById('modal-interest').value;
            const detail = modalSourceDetail.value;

            const newLead = {
                name,
                phone,
                email,
                interest,
                notes: detail ? `Interesse específico: ${detail}.` : 'Enviado via modal de contato.'
            };

            handleLeadSubmission(newLead, modalLeadForm, true);
        });
    }
}

// Processa o lead, salva no CRM e abre WhatsApp
async function handleLeadSubmission(leadData, formElement, isModal = false) {
    try {
        // 1. Salva no CRM centralizado (Node.js API)
        await Storage.addLead(leadData);

        // 2. Busca número de WhatsApp configurado
        const settings = await Storage.getSettings();

        // 3. Constrói mensagem personalizada para o WhatsApp
        const interestMap = {
            'futevolei': 'Aulas de Futevôlei',
            'beachtennis': 'Aulas de Beach Tennis',
            'funcional': 'Treino Funcional na Areia',
            'aluguel': 'Aluguel de Quadras',
            'churrasqueira': 'Aluguel de Churrasqueira',
            'ambos': 'Múltiplos Interesses'
        };
        let interestName = interestMap[leadData.interest] || leadData.interest;
                       
        let customizedMessage = `Olá! Acabei de me cadastrar no site do Varandas Beach Club.\n\n` +
                                `*Meus Dados:*\n` +
                                `- Nome: ${leadData.name}\n` +
                                `- WhatsApp: ${leadData.phone}\n` +
                                `- E-mail: ${leadData.email}\n` +
                                `- Interesse: ${interestName}\n\n` +
                                `Gostaria de prosseguir com o atendimento!`;

        const waUrl = getWhatsAppLink(settings.whatsappNumber, customizedMessage);

        // 4. Redireciona para o WhatsApp
        window.open(waUrl, '_blank');

        // 5. Feedback visual ao usuário
        alert('Cadastro realizado com sucesso! Estamos redirecionando você para o nosso WhatsApp.');
        
        // Limpa e fecha
        formElement.reset();
        if (isModal) {
            closeLeadModal();
        }
    } catch (error) {
        console.error('Erro ao processar cadastro:', error);
        alert('Houve um erro ao realizar seu cadastro. Por favor, tente novamente.');
    }
}
