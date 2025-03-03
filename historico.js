let historicoData = [];

async function carregarHistorico() {
    const historico = await getUpdateHistory();
    historicoData = historico;
    filtrarHistorico();
}

function filtrarHistorico() {
    const filtroItem = document.getElementById('filtroItem').value.toLowerCase();
    const filtroAcao = document.getElementById('filtroAcao').value;
    
    const filtrados = historicoData.filter(entry => {
        const matchesItemName = entry.itemName && entry.itemName.toLowerCase().includes(filtroItem);
        const matchesAction = filtroAcao === 'todos' || entry.action === filtroAcao;
        return matchesItemName && matchesAction;
    });
    
    exibirHistorico(filtrados);
}

function exibirHistorico(historico) {
    const tbody = document.getElementById('historicoBody');
    tbody.innerHTML = '';
    
    if (historico.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4" class="text-center">Nenhum registro encontrado</td>';
        tbody.appendChild(tr);
        return;
    }
    
    historico.forEach(entry => {
        const tr = document.createElement('tr');
        
        // Definir classe de linha baseado na ação
        if (entry.action === 'create') {
            tr.className = 'table-success';
        } else if (entry.action === 'delete') {
            tr.className = 'table-danger';
        } else if (entry.action === 'update') {
            tr.className = 'table-warning';
        }
        
        // Traduzir ação para português
        let acaoTexto = 'Desconhecida';
        switch(entry.action) {
            case 'create': acaoTexto = 'Criação'; break;
            case 'update': acaoTexto = 'Atualização'; break;
            case 'delete': acaoTexto = 'Exclusão'; break;
        }
        
        tr.innerHTML = `
            <td>${entry.formattedDate || 'Data não disponível'}</td>
            <td>${entry.itemName || 'Item desconhecido'}</td>
            <td>${acaoTexto}</td>
            <td>
                <button class="btn btn-sm btn-info ver-detalhes" data-id="${entry.id}">
                    Ver Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Adicionar event listeners para botões de detalhes
    document.querySelectorAll('.ver-detalhes').forEach(btn => {
        btn.addEventListener('click', function() {
            const entryId = this.getAttribute('data-id');
            const entry = historico.find(h => h.id === entryId);
            mostrarDetalhes(entry);
        });
    });
}

function mostrarDetalhes(entry) {
    const modalBody = document.getElementById('detalhesModalBody');
    const modalTitle = document.getElementById('detalhesModalLabel');
    
    let acaoTexto = 'Desconhecida';
    switch(entry.action) {
        case 'create': acaoTexto = 'Criação'; break;
        case 'update': acaoTexto = 'Atualização'; break;
        case 'delete': acaoTexto = 'Exclusão'; break;
    }
    
    modalTitle.textContent = `${acaoTexto} - ${entry.itemName}`;
    
    let conteudo = `
        <div class="mb-3">
            <strong>Data e Hora:</strong> ${entry.formattedDate || 'Data não disponível'}
        </div>
        <div class="mb-3">
            <strong>Usuário:</strong> ${entry.user || 'Não informado'}
        </div>
    `;
    
    // Mostrar detalhes específicos baseado na ação
    if (entry.action === 'create') {
        conteudo += `
            <div class="mb-3">
                <strong>Detalhes do Item Criado:</strong>
                <ul class="list-group mt-2">
                    <li class="list-group-item"><strong>Código:</strong> ${entry.newValues?.codigo || 'N/A'}</li>
                    <li class="list-group-item"><strong>Nome:</strong> ${entry.newValues?.nome || 'N/A'}</li>
                    <li class="list-group-item"><strong>Categoria:</strong> ${getCategoriaText(entry.newValues?.categoria, entry.newValues?.subcategoria) || 'N/A'}</li>
                    <li class="list-group-item"><strong>Consumo Diário:</strong> ${entry.newValues?.consumoDiario || 'N/A'}</li>
                    <li class="list-group-item"><strong>Estoque Inicial:</strong> ${entry.newValues?.estoque || 'N/A'}</li>
                </ul>
            </div>
        `;
    } else if (entry.action === 'update') {
        const changes = getChanges(entry.oldValues, entry.newValues);
        conteudo += `
            <div class="mb-3">
                <strong>Alterações Realizadas:</strong>
                <div class="table-responsive mt-2">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Campo</th>
                                <th>Valor Anterior</th>
                                <th>Novo Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${changes.map(change => `
                                <tr>
                                    <td>${change.field}</td>
                                    <td>${change.oldValue}</td>
                                    <td>${change.newValue}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (entry.action === 'delete') {
        conteudo += `
            <div class="mb-3">
                <strong>Detalhes do Item Excluído:</strong>
                <ul class="list-group mt-2">
                    <li class="list-group-item"><strong>Código:</strong> ${entry.oldValues?.codigo || 'N/A'}</li>
                    <li class="list-group-item"><strong>Nome:</strong> ${entry.oldValues?.nome || 'N/A'}</li>
                    <li class="list-group-item"><strong>Categoria:</strong> ${getCategoriaText(entry.oldValues?.categoria, entry.oldValues?.subcategoria) || 'N/A'}</li>
                    <li class="list-group-item"><strong>Consumo Diário:</strong> ${entry.oldValues?.consumoDiario || 'N/A'}</li>
                    <li class="list-group-item"><strong>Estoque Final:</strong> ${entry.oldValues?.estoque || 'N/A'}</li>
                </ul>
            </div>
        `;
    }
    
    modalBody.innerHTML = conteudo;
    
    // Exibir o modal
    const modal = new bootstrap.Modal(document.getElementById('detalhesModal'));
    modal.show();
}

function getChanges(oldValues, newValues) {
    if (!oldValues || !newValues) return [];
    
    const changes = [];
    const fields = {
        'codigo': 'Código',
        'nome': 'Nome',
        'categoria': 'Categoria',
        'subcategoria': 'Subcategoria',
        'consumoDiario': 'Consumo Diário',
        'estoque': 'Estoque'
    };
    
    for (const key in fields) {
        if (oldValues[key] !== newValues[key]) {
            let oldDisplay = oldValues[key];
            let newDisplay = newValues[key];
            
            // Format category and subcategory
            if (key === 'categoria') {
                oldDisplay = getCategoriaText(oldValues[key], null);
                newDisplay = getCategoriaText(newValues[key], null);
            } else if (key === 'subcategoria') {
                if (oldValues.categoria === 'medicamentos' && newValues.categoria === 'medicamentos') {
                    oldDisplay = oldValues[key] ? getSubcategoriaText(oldValues[key]) : 'Não especificado';
                    newDisplay = newValues[key] ? getSubcategoriaText(newValues[key]) : 'Não especificado';
                } else {
                    continue; // Skip if not applicable
                }
            }
            
            changes.push({
                field: fields[key],
                oldValue: oldDisplay !== null && oldDisplay !== undefined ? oldDisplay : 'Não especificado',
                newValue: newDisplay !== null && newDisplay !== undefined ? newDisplay : 'Não especificado'
            });
        }
    }
    
    return changes;
}

function getCategoriaText(categoria, subcategoria) {
    const categorias = {
        'medicamentos': 'Medicamentos Estratégicos',
        'materiais': 'Materiais Estratégicos',
        'dietas': 'Dietas Estratégicas'
    };
    
    if (categoria === 'medicamentos' && subcategoria) {
        const subcategorias = {
            'psicotropicos': ' (Psicotrópicos)',
            'antibioticos': ' (Antibióticos)',
            'vasoativas': ' (Drogas Vasoativas)'
        };
        return categorias[categoria] + (subcategorias[subcategoria] || '');
    }
    
    return categorias[categoria] || categoria;
}

function getSubcategoriaText(subcategoria) {
    const subcategorias = {
        'psicotropicos': 'Psicotrópicos',
        'antibioticos': 'Antibióticos',
        'vasoativas': 'Drogas Vasoativas'
    };
    return subcategorias[subcategoria] || subcategoria;
}

// Add logout button to the navigation bar
function addLogoutButton() {
  const navbarNav = document.getElementById('navbarNav');
  const logoutLi = document.createElement('li');
  logoutLi.className = 'nav-item ms-3';
  
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-outline-light';
  logoutBtn.textContent = 'Sair';
  logoutBtn.addEventListener('click', () => {
    firebase.auth().signOut().then(() => {
      window.location.href = 'login.html';
    });
  });
  
  logoutLi.appendChild(logoutBtn);
  navbarNav.appendChild(logoutLi);
}

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            // User is not signed in, redirect to login page
            window.location.href = 'login.html';
            return;
        }
        
        // User is signed in, load history
        carregarHistorico();
        
        // Add logout button
        addLogoutButton();
    });
});

// Event listeners
document.getElementById('filtroItem').addEventListener('input', filtrarHistorico);
document.getElementById('filtroAcao').addEventListener('change', filtrarHistorico);