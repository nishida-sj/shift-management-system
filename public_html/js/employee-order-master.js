$(document).ready(function() {
    let currentBusinessTypes = [];
    let employees = [];
    let currentBusinessType = null;
    let currentOrders = {};
    let sortableInstance = null;
    
    // 初期表示
    loadData();
    
    // 保存ボタン
    $('#save-order-btn').on('click', function() {
        saveEmployeeOrder();
    });
    
    // リセットボタン
    $('#reset-order-btn').on('click', function() {
        if (confirm('現在の業務区分の並び順をデフォルトに戻しますか？')) {
            resetCurrentBusinessTypeOrder();
        }
    });
    
    // データを読み込み
    async function loadData() {
        try {
            const dataManager = new DataManager();
            currentBusinessTypes = dataManager.getBusinessTypes();
            currentOrders = dataManager.getEmployeeOrders();
            
            // APIから現在有効な従業員を取得
            const apiEmployees = await apiClient.getEmployees();
            employees = apiEmployees.map(emp => dataConverter.employeeFromApi(emp));
            
            console.log('従業員並び順: APIから従業員データを取得:', employees.length, '名');
            
            renderBusinessTypeTabs();
            
            // 最初の業務区分を選択
            if (currentBusinessTypes.length > 0) {
                selectBusinessType(currentBusinessTypes[0].code);
            }
        } catch (error) {
            console.error('従業員データ取得エラー:', error);
            alert('従業員データの取得に失敗しました。');
        }
    }
    
    // 業務区分タブを描画
    function renderBusinessTypeTabs() {
        let tabsHtml = '';
        
        currentBusinessTypes.forEach(businessType => {
            const activeClass = currentBusinessType === businessType.code ? 'active' : '';
            tabsHtml += `
                <button class="business-type-tab ${activeClass}" data-business-type="${businessType.code}"
                        style="padding: 10px 20px; border: 1px solid #ddd; background: ${activeClass ? '#3498db' : '#f8f9fa'}; 
                               color: ${activeClass ? 'white' : '#333'}; border-radius: 5px; cursor: pointer;">
                    ${businessType.name}
                </button>
            `;
        });
        
        $('#business-type-tabs').html(tabsHtml);
        
        // タブクリックイベント
        $('.business-type-tab').on('click', function() {
            const businessTypeCode = $(this).data('business-type');
            selectBusinessType(businessTypeCode);
        });
    }
    
    // 業務区分を選択
    function selectBusinessType(businessTypeCode) {
        // 現在の並び順を保存
        if (currentBusinessType && sortableInstance) {
            saveCurrentOrder();
        }
        
        currentBusinessType = businessTypeCode;
        
        // タブの表示を更新
        $('.business-type-tab').removeClass('active').css({
            'background': '#f8f9fa',
            'color': '#333'
        });
        $(`.business-type-tab[data-business-type="${businessTypeCode}"]`).addClass('active').css({
            'background': '#3498db',
            'color': 'white'
        });
        
        renderEmployeeList(businessTypeCode);
    }
    
    // 従業員リストを描画
    function renderEmployeeList(businessTypeCode) {
        // 該当業務区分をメインとする従業員を取得
        const mainEmployees = employees.filter(emp => 
            emp.businessTypes && emp.businessTypes.some(bt => bt.code === businessTypeCode && bt.isMain)
        );
        
        if (mainEmployees.length === 0) {
            $('#employee-order-container').html(`
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h4>該当する従業員がいません</h4>
                    <p>「${getBusinessTypeName(businessTypeCode)}」をメイン業務とする従業員が登録されていません。</p>
                </div>
            `);
            return;
        }
        
        // 保存済みの並び順を取得、なければデフォルト順序
        let orderedEmployees;
        if (currentOrders[businessTypeCode]) {
            // 保存済み順序で並び替え
            orderedEmployees = [];
            currentOrders[businessTypeCode].forEach(empCode => {
                const emp = mainEmployees.find(e => e.code === empCode);
                if (emp) orderedEmployees.push(emp);
            });
            // 新しく追加された従業員があれば末尾に追加
            mainEmployees.forEach(emp => {
                if (!orderedEmployees.find(e => e.code === emp.code)) {
                    orderedEmployees.push(emp);
                }
            });
        } else {
            // デフォルト順序（従業員コード順）
            orderedEmployees = [...mainEmployees].sort((a, b) => a.code.localeCompare(b.code));
        }
        
        let listHtml = `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #2c3e50;">${getBusinessTypeName(businessTypeCode)} - 従業員並び順</h3>
                <p style="color: #666; font-size: 14px; margin-top: 5px;">
                    ドラッグ&ドロップで順序を変更できます（${orderedEmployees.length}名）
                </p>
            </div>
            <ul id="sortable-employee-list" style="list-style: none; padding: 0; margin: 0;">
        `;
        
        orderedEmployees.forEach((employee, index) => {
            const subBusinessTypes = employee.businessTypes
                .filter(bt => !bt.isMain)
                .map(bt => getBusinessTypeName(bt.code))
                .join(', ');
                
            listHtml += `
                <li class="employee-item" data-employee-code="${employee.code}" 
                    style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 15px; 
                           margin-bottom: 10px; cursor: move; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center;">
                            <div class="drag-handle" style="margin-right: 15px; color: #bdc3c7; font-size: 18px;">
                                ⋮⋮
                            </div>
                            <div>
                                <div style="font-weight: bold; font-size: 16px; color: #2c3e50;">
                                    ${index + 1}. ${employee.name}
                                </div>
                                <div style="font-size: 12px; color: #7f8c8d; margin-top: 2px;">
                                    ID: ${employee.code}
                                    ${subBusinessTypes ? ` | サブ業務: ${subBusinessTypes}` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="color: #27ae60; font-weight: bold;">
                            メイン
                        </div>
                    </div>
                </li>
            `;
        });
        
        listHtml += '</ul>';
        $('#employee-order-container').html(listHtml);
        
        // Sortable.jsを初期化
        initializeSortable();
    }
    
    // Sortable.jsを初期化
    function initializeSortable() {
        const el = document.getElementById('sortable-employee-list');
        if (el) {
            if (sortableInstance) {
                sortableInstance.destroy();
            }
            
            sortableInstance = Sortable.create(el, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                handle: '.drag-handle',
                onEnd: function(evt) {
                    updateOrderNumbers();
                }
            });
        }
    }
    
    // 順序番号を更新
    function updateOrderNumbers() {
        $('#sortable-employee-list .employee-item').each(function(index) {
            $(this).find('div[style*="font-weight: bold"]').html(
                `${index + 1}. ${$(this).find('div[style*="font-weight: bold"]').text().replace(/^\d+\.\s*/, '')}`
            );
        });
    }
    
    // 現在の並び順を保存（メモリ内）
    function saveCurrentOrder() {
        if (!currentBusinessType) return;
        
        const order = [];
        $('#sortable-employee-list .employee-item').each(function() {
            order.push($(this).data('employee-code'));
        });
        
        currentOrders[currentBusinessType] = order;
    }
    
    // 従業員並び順を保存（localStorage）
    function saveEmployeeOrder() {
        // 現在の並び順を保存
        saveCurrentOrder();
        
        // 削除された従業員を並び順設定から除外
        cleanupOrdersForDeletedEmployees();
        
        try {
            const dataManager = new DataManager();
            dataManager.saveEmployeeOrders(currentOrders);
            showSuccess('従業員並び順を保存しました。');
        } catch (error) {
            console.error('並び順保存エラー:', error);
            showError('並び順の保存に失敗しました。');
        }
    }

    // 削除された従業員を並び順設定から除外
    function cleanupOrdersForDeletedEmployees() {
        const currentEmployeeCodes = employees.map(emp => emp.code);
        
        Object.keys(currentOrders).forEach(businessTypeCode => {
            currentOrders[businessTypeCode] = currentOrders[businessTypeCode].filter(empCode => 
                currentEmployeeCodes.includes(empCode)
            );
        });
    }
    
    // 現在の業務区分の並び順をリセット
    function resetCurrentBusinessTypeOrder() {
        if (!currentBusinessType) return;
        
        // デフォルト順序で再描画
        delete currentOrders[currentBusinessType];
        renderEmployeeList(currentBusinessType);
        showSuccess('並び順をデフォルトに戻しました。');
    }
    
    // 業務区分名を取得
    function getBusinessTypeName(code) {
        const businessType = currentBusinessTypes.find(bt => bt.code === code);
        return businessType ? businessType.name : code;
    }
    
    // 成功メッセージ表示
    function showSuccess(message) {
        $('#success-message').text(message).show();
        setTimeout(function() {
            $('#success-message').fadeOut();
        }, 3000);
    }
    
    // エラーメッセージ表示
    function showError(message) {
        $('#error-message').text(message).show();
        setTimeout(function() {
            $('#error-message').fadeOut();
        }, 5000);
    }
});

// CSSスタイルをページに追加
$('<style>').text(`
    .sortable-ghost {
        opacity: 0.4;
        background: #f8f9fa !important;
    }
    
    .sortable-chosen {
        background: #e3f2fd !important;
        transform: scale(1.02);
    }
    
    .sortable-drag {
        background: #fff !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    }
    
    .employee-item:hover {
        background: #f8f9fa !important;
        border-color: #3498db !important;
    }
    
    .drag-handle:hover {
        color: #3498db !important;
    }
`).appendTo('head');