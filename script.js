let editingItemId = null;

function toggleSubcategoria() {
    const categoria = document.getElementById('categoria').value;
    const subcategoriaDiv = document.getElementById('subcategoriaDiv');
    const subcategoriaSelect = document.getElementById('subcategoria');
    
    if (categoria === 'medicamentos') {
        subcategoriaDiv.style.display = 'block';
        subcategoriaSelect.required = true;
    } else {
        subcategoriaDiv.style.display = 'none';
        subcategoriaSelect.required = false;
    }
}

// Função para carregar os detalhes de um item para edição
async function loadItemForEdit(id) {
    const item = await getItemById(id);
    if (!item) return;
    
    document.getElementById('codigo').value = item.codigo;
    document.getElementById('nome').value = item.nome;
    document.getElementById('categoria').value = item.categoria;
    document.getElementById('consumoDiario').value = item.consumoDiario;
    document.getElementById('estoque').value = item.estoque;
    
    toggleSubcategoria();
    
    if (item.categoria === 'medicamentos' && item.subcategoria) {
        document.getElementById('subcategoria').value = item.subcategoria;
    }
    
    // Mudar texto do botão de cadastrar para atualizar
    const submitButton = document.querySelector('#itemForm button[type="submit"]');
    submitButton.textContent = 'Atualizar';
    
    // Adicionar botão de cancelar
    if (!document.getElementById('cancelEdit')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancelEdit';
        cancelBtn.className = 'btn btn-secondary me-2';
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('click', resetForm);
        submitButton.parentNode.insertBefore(cancelBtn, submitButton);
    }
}

function resetForm() {
    document.getElementById('itemForm').reset();
    toggleSubcategoria();
    editingItemId = null;
    
    // Restaurar botão de cadastro
    const submitButton = document.querySelector('#itemForm button[type="submit"]');
    submitButton.textContent = 'Cadastrar';
    
    // Remover botão de cancelar
    const cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) cancelBtn.remove();
    
    // Limpar parâmetro da URL
    const url = new URL(window.location);
    url.searchParams.delete('edit');
    window.history.pushState({}, '', url);
}

document.getElementById('itemForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const categoria = document.getElementById('categoria').value;
    
    const item = {
        codigo: document.getElementById('codigo').value,
        categoria: categoria,
        subcategoria: categoria === 'medicamentos' ? document.getElementById('subcategoria').value : null,
        nome: document.getElementById('nome').value,
        consumoDiario: parseFloat(document.getElementById('consumoDiario').value),
        estoque: parseFloat(document.getElementById('estoque').value)
    };

    let success;
    
    if (editingItemId) {
        // Get old item data for history
        const oldItem = await getItemById(editingItemId);
        
        // Atualizar item existente
        success = await updateItem(editingItemId, item);
        if (success) {
            // Save update history
            await saveUpdateHistory(editingItemId, oldItem, item, "update");
            alert('Item atualizado com sucesso!');
            resetForm();
        } else {
            alert('Erro ao atualizar item. Tente novamente.');
        }
    } else {
        // Adicionar timestamp para novos itens
        item.timestamp = firebase.firestore.FieldValue.serverTimestamp();
        // Cadastrar novo item
        success = await saveItem(item);
        if (success) {
            // We need to get the new item ID to log history
            const newItems = await getItems();
            const newItem = newItems.find(i => i.codigo === item.codigo && i.nome === item.nome);
            if (newItem) {
                await saveUpdateHistory(newItem.id, null, item, "create");
            }
            alert('Item cadastrado com sucesso!');
            resetForm();
        } else {
            alert('Erro ao cadastrar item. Tente novamente.');
        }
    }
});

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
        
        toggleSubcategoria(); // Initialize the subcategoria visibility
        
        // Verificar se há um item para editar na URL
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        
        if (editId) {
            editingItemId = editId;
            loadItemForEdit(editId);
        }
        
        // Add logout button
        addLogoutButton();
    });
});