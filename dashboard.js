let estoqueChart;
let currentFilteredItems = [];

async function atualizarDashboard(filtroCategoria = 'todos', filtroStatus = 'todos', dataInicio = null, dataFim = null) {
    const itens = await getItems();
    const tbody = document.getElementById('dashboardBody');
    tbody.innerHTML = '';

    const itensFiltrados = itens.filter(item => {
        // Filtro de categoria
        const passouCategoria = 
            filtroCategoria === 'todos' ||
            filtroCategoria === item.categoria ||
            (filtroCategoria.startsWith('medicamentos-') && 
             item.categoria === 'medicamentos' && 
             item.subcategoria === filtroCategoria.split('-')[1]);
        
        if (!passouCategoria) return false;
        
        // Filtro de status
        if (filtroStatus !== 'todos') {
            const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
            if (filtroStatus === 'critico' && diasDisponiveis > 15) return false;
            if (filtroStatus === 'alerta' && (diasDisponiveis <= 15 || diasDisponiveis > 30)) return false;
            if (filtroStatus === 'normal' && diasDisponiveis <= 30) return false;
        }
        
        // Filtro de data
        if (dataInicio && dataFim) {
            const itemDate = item.timestamp ? new Date(item.timestamp.seconds * 1000) : new Date();
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59); // Set to end of day
            
            if (itemDate < inicio || itemDate > fim) return false;
        }
        
        return true;
    });

    // Ordenar itens por nome em ordem alfabética
    itensFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));

    // Atualizar tabela
    itensFiltrados.forEach(item => {
        const consumoMensal = item.consumoDiario * 30;
        const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
        
        let statusClass = '';
        if (diasDisponiveis <= 15) {
            statusClass = 'status-critico';
        } else if (diasDisponiveis <= 30) {
            statusClass = 'status-alerta';
        } else {
            statusClass = 'status-ok';
        }

        const tr = document.createElement('tr');
        tr.className = statusClass;
        tr.innerHTML = `
            <td>${item.codigo}</td>
            <td>${getCategoriaText(item.categoria, item.subcategoria)}</td>
            <td>${item.nome}</td>
            <td>${item.consumoDiario}</td>
            <td>${consumoMensal}</td>
            <td>${item.estoque}</td>
            <td>${diasDisponiveis}</td>
            <td>${getStatusText(diasDisponiveis)}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-btn me-1" data-id="${item.id}">Editar</button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update the filtered items for PDF generation
    currentFilteredItems = itensFiltrados;

    // Adicionar event listeners para os botões de editar e excluir
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemId = this.getAttribute('data-id');
            window.location.href = `index.html?edit=${itemId}`;
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const itemId = this.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir este item?')) {
                // Get item data before deletion for history
                const oldItem = await getItemById(itemId);
                
                const success = await deleteItem(itemId);
                if (success) {
                    // Save delete history
                    await saveUpdateHistory(itemId, oldItem, null, "delete");
                    alert('Item excluído com sucesso!');
                    atualizarDashboard(filtroCategoria, filtroStatus, dataInicio, dataFim);
                } else {
                    alert('Erro ao excluir item. Tente novamente.');
                }
            }
        });
    });

    // Atualizar gráfico
    atualizarGrafico(itensFiltrados);
}

function atualizarGrafico(itens) {
    const ctx = document.getElementById('estoqueChart').getContext('2d');
    
    if (estoqueChart) {
        estoqueChart.destroy();
    }

    // On mobile, limit the items displayed to improve readability
    let displayedItems = itens;
    if (window.innerWidth < 768 && itens.length > 10) {
        displayedItems = itens.slice(0, 10);
    }

    const dados = {
        labels: displayedItems.map(item => {
            // Shorter labels on mobile
            if (window.innerWidth < 768) {
                return item.nome.length > 15 ? item.nome.substring(0, 15) + '...' : item.nome;
            }
            return `${item.codigo} - ${item.nome}`;
        }),
        datasets: [
            {
                label: 'Dias de Estoque',
                type: 'bar',
                data: displayedItems.map(item => Math.floor(item.estoque / item.consumoDiario)),
                backgroundColor: displayedItems.map(item => {
                    const dias = Math.floor(item.estoque / item.consumoDiario);
                    if (dias <= 15) return 'rgba(255, 99, 132, 0.5)';
                    if (dias <= 30) return 'rgba(255, 205, 86, 0.5)';
                    return 'rgba(75, 192, 192, 0.5)';
                }),
                borderColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                borderRadius: 6
            },
            {
                label: 'Consumo Diário',
                type: 'line',
                data: displayedItems.map(item => item.consumoDiario),
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                yAxisID: 'y1'
            },
            {
                label: 'Nível Crítico (15 dias)',
                type: 'line',
                data: displayedItems.map(item => item.consumoDiario * 15),
                borderColor: 'rgb(255, 0, 0)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                yAxisID: 'y1'
            }
        ]
    };

    estoqueChart = new Chart(ctx, {
        type: 'bar',
        data: dados,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Análise de Estoque por Item',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: window.innerWidth < 768 ? 'top' : 'bottom',
                    labels: {
                        boxWidth: window.innerWidth < 768 ? 10 : 40,
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#000',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 10,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Dias de Estoque',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawBorder: false
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Quantidade',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
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

function getStatusText(dias) {
    if (dias <= 15) return 'Crítico';
    if (dias <= 30) return 'Alerta';
    return 'Normal';
}

document.getElementById('filtroCategoria').addEventListener('change', function() {
    const filtroCategoria = document.getElementById('filtroCategoria').value;
    const filtroStatus = document.getElementById('filtroStatus').value;
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;
    atualizarDashboard(filtroCategoria, filtroStatus, dataInicio, dataFim);
});

document.getElementById('filtroStatus').addEventListener('change', function() {
    const filtroCategoria = document.getElementById('filtroCategoria').value;
    const filtroStatus = document.getElementById('filtroStatus').value;
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;
    atualizarDashboard(filtroCategoria, filtroStatus, dataInicio, dataFim);
});

function gerarRelatorioPDF() {
    // Check if jsPDF is loaded
    if (typeof jspdf === 'undefined') {
        alert('Biblioteca PDF não carregada. Tente novamente.');
        return;
    }
    
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;
    
    const filtroCategoria = document.getElementById('filtroCategoria').value;
    const filtroStatus = document.getElementById('filtroStatus').value;
    
    // Create new PDF document
    const doc = new jspdf.jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(0, 51, 153);
    doc.text('Relatório de Controle de Estoque Hospitalar', 14, 20);
    
    // Add metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
    
    // Add filter information
    doc.setFontSize(12);
    doc.setTextColor(0);
    let filterText = 'Filtros aplicados: ';
    
    // Category filter
    if (filtroCategoria !== 'todos') {
        const categoriaText = document.getElementById('filtroCategoria').options[document.getElementById('filtroCategoria').selectedIndex].text;
        filterText += `Categoria: ${categoriaText}, `;
    }
    
    // Status filter
    if (filtroStatus !== 'todos') {
        const statusText = document.getElementById('filtroStatus').options[document.getElementById('filtroStatus').selectedIndex].text;
        filterText += `Status: ${statusText}, `;
    }
    
    // Date filter
    if (dataInicio && dataFim) {
        filterText += `Período: ${dataInicio} a ${dataFim}`;
    } else {
        filterText += 'Sem filtro de período';
    }
    
    doc.text(filterText, 14, 40);
    
    // Table headers
    const headers = [['Código', 'Nome do Item', 'Estoque', 'Consumo Diário', 'Disponibilidade', 'Status']];
    
    // Table data
    const data = currentFilteredItems.map(item => {
        const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
        return [
            item.codigo,
            item.nome,
            item.estoque,
            item.consumoDiario,
            `${diasDisponiveis} dias`,
            getStatusText(diasDisponiveis)
        ];
    });
    
    // Generate table - autoTable will automatically create new pages as needed
    doc.autoTable({
        startY: 50,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: {
            fillColor: [0, 102, 204],
            textColor: 255,
            fontStyle: 'bold',
        },
        margin: { top: 50, bottom: 30 },
        didDrawPage: function(data) {
            // Header on each page
        },
        didDrawCell: (data) => {
            // Add color to status cells
            if (data.section === 'body' && data.column.index === 5) {
                const status = data.cell.text[0];
                if (status === 'Crítico') {
                    doc.setFillColor(255, 200, 200);
                } else if (status === 'Alerta') {
                    doc.setFillColor(255, 243, 200);
                } else if (status === 'Normal') {
                    doc.setFillColor(200, 255, 200);
                }
                
                doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                doc.setTextColor(0);
                doc.text(status, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
                    align: 'center',
                    baseline: 'middle'
                });
            }
        }
    });
    
    // Add summary on a new page if the table is too big
    const lastY = doc.lastAutoTable.finalY || 50;
    let yPos = lastY + 15;
    
    // If we're near the bottom of the page, start a new page for the summary
    if (yPos > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage();
        yPos = 20; // Reset position for the new page
    }
    
    // Add summary
    const totalItems = currentFilteredItems.length;
    const criticoItems = currentFilteredItems.filter(item => Math.floor(item.estoque / item.consumoDiario) <= 15).length;
    const alertaItems = currentFilteredItems.filter(item => {
        const dias = Math.floor(item.estoque / item.consumoDiario);
        return dias > 15 && dias <= 30;
    }).length;
    const normalItems = currentFilteredItems.filter(item => Math.floor(item.estoque / item.consumoDiario) > 30).length;
    
    doc.setFontSize(14);
    doc.setTextColor(0, 51, 153);
    doc.text('Resumo do Relatório', 14, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total de itens: ${totalItems}`, 14, yPos); yPos += 8;
    doc.text(`Itens em estado Crítico: ${criticoItems} (${Math.round(criticoItems/totalItems*100)}%)`, 14, yPos); yPos += 8;
    doc.text(`Itens em estado de Alerta: ${alertaItems} (${Math.round(alertaItems/totalItems*100)}%)`, 14, yPos); yPos += 8;
    doc.text(`Itens em estado Normal: ${normalItems} (${Math.round(normalItems/totalItems*100)}%)`, 14, yPos);
    
    // Function to create chart title and explanation
    function addChartTitleAndExplanation(title, explanation1, explanation2 = null, yPosition = 30) {
        doc.setFontSize(16);
        doc.setTextColor(0, 51, 153);
        doc.text(title, 14, yPosition);
        
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text(explanation1, 14, yPosition + 10);
        if (explanation2) {
            doc.text(explanation2, 14, yPosition + 16);
        }
    }
    
    // GRÁFICO 1: DISTRIBUIÇÃO DE STATUS
    doc.addPage();
    addChartTitleAndExplanation(
        'Análise Gráfica do Estoque: Distribuição de Status', 
        'Este gráfico demonstra a proporção de itens em cada categoria de status (Crítico, Alerta e Normal),',
        'permitindo uma visualização rápida da saúde geral do estoque hospitalar.'
    );
    
    // Create a canvas for the pie chart with modern styling
    const canvasPie = document.createElement('canvas');
    canvasPie.width = 1000;
    canvasPie.height = 800;
    document.body.appendChild(canvasPie);
    
    // Create pie chart with modern styling
    new Chart(canvasPie.getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['Crítico', 'Alerta', 'Normal'],
            datasets: [{
                data: [criticoItems, alertaItems, normalItems],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.9)',
                    'rgba(255, 205, 86, 0.9)',
                    'rgba(75, 192, 192, 0.9)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 205, 86, 1)', 
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 20,
                        padding: 15,
                        font: { 
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Distribuição de Status dos Itens',
                    font: { 
                        size: 18, 
                        weight: 'bold',
                        family: 'Arial'
                    },
                    padding: {
                        top: 10,
                        bottom: 30
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#000',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    boxWidth: 10,
                    boxHeight: 10,
                    usePointStyle: true
                }
            }
        }
    });
    
    // Add the chart to PDF, centered on the page with proper margins
    setTimeout(() => {
        const imgData = canvasPie.toDataURL('image/png');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 40; // 20px margin on each side
        const imgHeight = imgWidth * 0.7; // Maintain aspect ratio
        const imgX = (pageWidth - imgWidth) / 2;
        const imgY = 50; // Start below the title
        
        doc.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
        
        // GRÁFICO 2: TOP 10 ITEMS CRÍTICOS
        doc.addPage();
        addChartTitleAndExplanation(
            'Análise de Itens Críticos: Top 10', 
            'Este gráfico apresenta os 10 itens com menor disponibilidade em dias de estoque.',
            'Priorize a reposição destes itens para evitar rupturas no atendimento aos pacientes.'
        );
        
        // Create horizontal bar chart for critical items
        const canvasBar = document.createElement('canvas');
        canvasBar.width = 1200;
        canvasBar.height = 800;
        document.body.appendChild(canvasBar);
        
        // Get top 10 critical items sorted by availability
        const top10Critical = [...currentFilteredItems]
            .sort((a, b) => Math.floor(a.estoque / a.consumoDiario) - Math.floor(b.estoque / b.consumoDiario))
            .slice(0, 10);
        
        const ctx = canvasBar.getContext('2d');
        const barGradient = ctx.createLinearGradient(0, 0, 800, 0);
        barGradient.addColorStop(0, 'rgba(255, 99, 132, 0.9)');
        barGradient.addColorStop(0.5, 'rgba(255, 99, 132, 0.7)');
        barGradient.addColorStop(1, 'rgba(255, 99, 132, 0.5)');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10Critical.map(item => item.nome.length > 25 ? item.nome.substring(0, 25) + '...' : item.nome),
                datasets: [{
                    label: 'Dias de Estoque Restantes',
                    data: top10Critical.map(item => Math.floor(item.estoque / item.consumoDiario)),
                    backgroundColor: barGradient,
                    borderRadius: 6,
                    barPercentage: 0.7,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        labels: {
                            font: { 
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Top 10 Itens Críticos (por dias de estoque)',
                        font: { 
                            size: 18, 
                            weight: 'bold',
                            family: 'Arial'
                        },
                        padding: {
                            top: 10,
                            bottom: 30
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#000',
                        bodyColor: '#000',
                        bodyFont: {
                            size: 14
                        },
                        borderColor: '#ddd',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `${context.raw} dias disponíveis`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Dias Disponíveis',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
        
        // Add chart to PDF
        setTimeout(() => {
            const imgData = canvasBar.toDataURL('image/png');
            const imgWidth = pageWidth - 40;
            const imgHeight = imgWidth * 0.7;
            const imgX = (pageWidth - imgWidth) / 2;
            const imgY = 50;
            
            doc.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
            
            // GRÁFICO 3: DISTRIBUIÇÃO POR CATEGORIA
            doc.addPage();
            addChartTitleAndExplanation(
                'Análise por Categoria de Produtos', 
                'Este gráfico mostra a distribuição dos itens por categoria, permitindo uma',
                'visualização da diversidade do inventário e a proporção de cada tipo de item no estoque.'
            );
            
            // Create doughnut chart for category distribution
            const canvasDoughnut = document.createElement('canvas');
            canvasDoughnut.width = 1000;
            canvasDoughnut.height = 800;
            document.body.appendChild(canvasDoughnut);
            
            // Count items by category
            const categoryCounts = {};
            currentFilteredItems.forEach(item => {
                const categoryKey = getCategoriaText(item.categoria, item.subcategoria);
                categoryCounts[categoryKey] = (categoryCounts[categoryKey] || 0) + 1;
            });
            
            // Create modern doughnut chart
            new Chart(canvasDoughnut.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categoryCounts),
                    datasets: [{
                        data: Object.values(categoryCounts),
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(255, 205, 86, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                            'rgba(153, 102, 255, 0.8)',
                            'rgba(255, 159, 64, 0.8)',
                            'rgba(109, 99, 255, 0.8)'
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(255, 205, 86, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(255, 159, 64, 1)',
                            'rgba(109, 99, 255, 1)'
                        ],
                        borderWidth: 2,
                        hoverOffset: 15,
                        borderRadius: 3,
                        spacing: 3
                    }]
                },
                options: {
                    responsive: false,
                    cutout: '50%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: { 
                                    size: 14
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Distribuição de Itens por Categoria',
                            font: { 
                                size: 18, 
                                weight: 'bold',
                                family: 'Arial'
                            },
                            padding: {
                                top: 10,
                                bottom: 30
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            titleColor: '#000',
                            bodyColor: '#000',
                            borderColor: '#ddd',
                            borderWidth: 1,
                            usePointStyle: true,
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw;
                                    const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} itens (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            
            // Add chart to PDF
            setTimeout(() => {
                const imgData = canvasDoughnut.toDataURL('image/png');
                const imgWidth = pageWidth - 40;
                const imgHeight = imgWidth * 0.7;
                const imgX = (pageWidth - imgWidth) / 2;
                const imgY = 50;
                
                doc.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
                
                // GRÁFICO 4: TOP 5 CONSUMO
                doc.addPage();
                addChartTitleAndExplanation(
                    'Análise de Consumo vs Estoque', 
                    'Este gráfico compara o consumo diário e o estoque atual dos 5 itens mais utilizados.',
                    'Itens com alto consumo e baixo estoque precisam de atenção especial no planejamento de compras.'
                );
                
                // Create grouped bar chart for consumption analysis
                const canvasBar2 = document.createElement('canvas');
                canvasBar2.width = 1200;
                canvasBar2.height = 800;
                document.body.appendChild(canvasBar2);
                
                // Get top 5 items with highest consumption
                const top5Consumption = [...currentFilteredItems]
                    .sort((a, b) => b.consumoDiario - a.consumoDiario)
                    .slice(0, 5);
                
                const ctx2 = canvasBar2.getContext('2d');
                const consumptionGradient = ctx2.createLinearGradient(0, 0, 0, 400);
                consumptionGradient.addColorStop(0, 'rgba(54, 162, 235, 0.9)');
                consumptionGradient.addColorStop(1, 'rgba(54, 162, 235, 0.5)');
                
                const stockGradient = ctx2.createLinearGradient(0, 0, 0, 400);
                stockGradient.addColorStop(0, 'rgba(75, 192, 192, 0.9)');
                stockGradient.addColorStop(1, 'rgba(75, 192, 192, 0.5)');
                
                new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: top5Consumption.map(item => item.nome.length > 20 ? item.nome.substring(0, 20) + '...' : item.nome),
                        datasets: [{
                            label: 'Consumo Diário',
                            data: top5Consumption.map(item => item.consumoDiario),
                            backgroundColor: consumptionGradient,
                            borderRadius: 6,
                            barPercentage: 0.6,
                            categoryPercentage: 0.4,
                            order: 1
                        }, {
                            label: 'Estoque Atual',
                            data: top5Consumption.map(item => item.estoque),
                            backgroundColor: stockGradient,
                            borderRadius: 6,
                            barPercentage: 0.6,
                            categoryPercentage: 0.4,
                            order: 2
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                align: 'center',
                                labels: {
                                    padding: 20,
                                    usePointStyle: true,
                                    pointStyle: 'rectRounded',
                                    font: { 
                                        size: 14,
                                        weight: 'bold'
                                    }
                                }
                            },
                            title: {
                                display: true,
                                text: 'Top 5 Itens com Maior Consumo Diário',
                                font: { 
                                    size: 18, 
                                    weight: 'bold',
                                    family: 'Arial'
                                },
                                padding: {
                                    top: 10,
                                    bottom: 30
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                titleColor: '#000',
                                bodyColor: '#000',
                                borderColor: '#ddd',
                                borderWidth: 1
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    font: {
                                        size: 12,
                                        weight: 'bold'
                                    }
                                }
                            },
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                },
                                title: {
                                    display: true,
                                    text: 'Quantidade',
                                    font: {
                                        size: 14,
                                        weight: 'bold'
                                    }
                                }
                            }
                        }
                    }
                });
                
                // Add chart to PDF
                setTimeout(() => {
                    const imgData = canvasBar2.toDataURL('image/png');
                    const imgWidth = pageWidth - 40;
                    const imgHeight = imgWidth * 0.7;
                    const imgX = (pageWidth - imgWidth) / 2;
                    const imgY = 50;
                    
                    doc.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
                    
                    // Remove temporary canvases
                    document.body.removeChild(canvasPie);
                    document.body.removeChild(canvasBar);
                    document.body.removeChild(canvasDoughnut);
                    document.body.removeChild(canvasBar2);
                    
                    // Add recommendations page
                    doc.addPage();
                    yPos = 20;
                    
                    // Add recommendations
                    doc.setFontSize(16);
                    doc.setTextColor(0, 51, 153);
                    doc.text('Recomendações', 14, yPos);
                    yPos += 15;
                    
                    doc.setFontSize(12);
                    doc.setTextColor(0);
                    
                    doc.setFontSize(12);
                    doc.setTextColor(60, 60, 60);
                    doc.text('Com base na análise dos dados apresentados neste relatório, recomendamos:', 14, yPos);
                    yPos += 15;
                    
                    if (criticoItems > 0) {
                        doc.setTextColor(204, 0, 0);
                        doc.text(`• Atenção aos ${criticoItems} itens em estado crítico que necessitam reposição urgente.`, 14, yPos);
                        yPos += 10;
                    }
                    
                    if (alertaItems > 0) {
                        doc.setTextColor(204, 102, 0);
                        doc.text(`• Planejar a reposição dos ${alertaItems} itens em estado de alerta nos próximos dias.`, 14, yPos);
                        yPos += 10;
                    }
                    
                    doc.setTextColor(0, 102, 0);
                    doc.text(`• ${normalItems} itens estão com estoque adequado para mais de 30 dias.`, 14, yPos);
                    yPos += 20;
                    
                    // Add purchase recommendations table
                    yPos = checkPageBreak(yPos, 100, doc); // Check if we need a page break
                    
                    doc.setFontSize(16);
                    doc.setTextColor(0, 51, 153);
                    doc.text('Sugestão de Compra (para estoque mínimo de 45 dias)', 14, yPos);
                    yPos += 10;
                    
                    doc.setFontSize(11);
                    doc.setTextColor(60, 60, 60);
                    doc.text('A tabela abaixo apresenta uma sugestão de quantidades a serem adquiridas para garantir', 14, yPos);
                    doc.text('uma cobertura de estoque de pelo menos 45 dias para todos os itens.', 14, yPos + 6);
                    yPos += 20;
                    
                    // Filter items that need replenishment (less than 45 days of stock)
                    const itemsToReplenish = currentFilteredItems.filter(item => {
                        const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
                        return diasDisponiveis < 45;
                    });
                    
                    if (itemsToReplenish.length > 0) {
                        // Table headers for purchase recommendations
                        const purchaseHeaders = [['Código', 'Nome do Item', 'Estoque Atual', 'Consumo Diário', 'Disponibilidade', 'Quantidade a Comprar']];
                        
                        // Table data for purchase recommendations
                        const purchaseData = itemsToReplenish.map(item => {
                            const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
                            const diasFaltantes = 45 - diasDisponiveis;
                            const quantidadeComprar = diasFaltantes > 0 ? Math.ceil(diasFaltantes * item.consumoDiario) : 0;
                            
                            return [
                                item.codigo,
                                item.nome,
                                item.estoque,
                                item.consumoDiario,
                                `${diasDisponiveis} dias`,
                                quantidadeComprar
                            ];
                        });
                        
                        // Generate purchase recommendations table
                        doc.autoTable({
                            startY: yPos,
                            head: purchaseHeaders,
                            body: purchaseData,
                            theme: 'grid',
                            headStyles: {
                                fillColor: [0, 102, 153],
                                textColor: 255,
                                fontStyle: 'bold',
                            },
                            columnStyles: {
                                5: {
                                    fontStyle: 'bold',
                                    textColor: [204, 0, 0]
                                }
                            }
                        });
                    } else {
                        doc.setTextColor(0, 102, 0);
                        doc.text('Todos os itens possuem estoque adequado para mais de 45 dias.', 14, yPos);
                    }
                    
                    // Add footer to each page
                    const pageCount = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setFontSize(10);
                        doc.setTextColor(100);
                        doc.text(`Página ${i} de ${pageCount} - Controle de Estoque Hospitalar - Farmacêutico Fernando Carneiro`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 20, {
                            align: 'center'
                        });
                    }
                    
                    // Save PDF
                    const fileName = `relatorio-estoque-${dataInicio || 'geral'}-a-${dataFim || 'geral'}.pdf`;
                    doc.save(fileName);
                }, 300);
            }, 300);
        }, 300);
    }, 300);
}

// Helper function to check if we need a page break
function checkPageBreak(yPos, requiredSpace, doc) {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        return 20; // Reset position for the new page
    }
    return yPos;
}

document.getElementById('dataInicio').addEventListener('change', function() {
    const dataInicio = this.value;
    const dataFim = document.getElementById('dataFim').value;
    const filtroCategoria = document.getElementById('filtroCategoria').value;
    const filtroStatus = document.getElementById('filtroStatus').value;
    
    if (dataFim && new Date(dataInicio) > new Date(dataFim)) {
        alert('A data inicial não pode ser posterior à data final');
        this.value = '';
        return;
    }
    
    if (dataInicio && dataFim) {
        atualizarDashboard(filtroCategoria, filtroStatus, dataInicio, dataFim);
    }
});

document.getElementById('dataFim').addEventListener('change', function() {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = this.value;
    const filtroCategoria = document.getElementById('filtroCategoria').value;
    const filtroStatus = document.getElementById('filtroStatus').value;
    
    if (dataInicio && new Date(dataInicio) > new Date(dataFim)) {
        alert('A data final não pode ser anterior à data inicial');
        this.value = '';
        return;
    }
    
    if (dataInicio && dataFim) {
        atualizarDashboard(filtroCategoria, filtroStatus, dataInicio, dataFim);
    }
});

// PDF generation button
document.getElementById('gerarPDF').addEventListener('click', gerarRelatorioPDF);

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
        
        // User is signed in, load dashboard
        atualizarDashboard();
        
        // Add logout button
        addLogoutButton();
    });
});