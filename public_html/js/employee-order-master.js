$(document).ready(function() {
    let employees = [];
    let currentOrder = [];
    let sortableInstance = null;
    
    console.log('従業員並び順: ページ読み込み開始');
    console.log('apiClient利用可能:', typeof apiClient !== 'undefined');
    console.log('dataConverter利用可能:', typeof dataConverter !== 'undefined');
    
    // 初期表示
    loadData();
    
    // 保存ボタン
    $('#save-order-btn').on('click', function() {
        saveEmployeeOrder();
    });
    
    // リセットボタン
    $('#reset-order-btn').on('click', function() {
        if (confirm('従業員の並び順をデフォルトに戻しますか？')) {
            resetEmployeeOrder();
        }
    });
    
    // データを読み込み
    async function loadData() {
        try {
            // APIから現在有効な従業員を取得
            console.log('従業員並び順: API呼び出し開始');
            const apiEmployees = await apiClient.getEmployees();
            console.log('従業員並び順: API生データ:', apiEmployees);
            
            // APIデータをdataConverter経由で変換を試み、失敗した場合は直接使用
            try {
                employees = apiEmployees.map(emp => dataConverter.employeeFromApi(emp));
                console.log('従業員並び順: dataConverter変換成功');
            } catch (conversionError) {
                console.warn('dataConverter変換失敗、直接データを使用:', conversionError);
                // 直接APIデータを使用（business_typesをbusinessTypesに変換）
                employees = apiEmployees.map(emp => ({
                    code: emp.employee_code,
                    name: emp.name,
                    businessTypes: [{ code: emp.business_type === '事務' ? 'office' : 'cooking', isMain: true }]
                }));
            }
            
            console.log('従業員並び順: 変換後データ:', employees);
            
            // 現在の並び順を取得（統一した並び順）
            try {
                const orderResponse = await apiClient.getEmployeeOrders();
                if (orderResponse && orderResponse.unified) {
                    currentOrder = orderResponse.unified;
                } else {
                    // デフォルト順序（従業員コード順）
                    currentOrder = employees.map(emp => emp.code).sort();
                }
            } catch (error) {
                console.warn('並び順取得エラー、デフォルト順序を使用:', error);
                currentOrder = employees.map(emp => emp.code).sort();
            }
            
            renderEmployeeList();
            
        } catch (error) {
            console.error('データ取得エラー:', error);
            showError('データの取得に失敗しました。ページをリロードしてください。');
        }
    }
    
    // 従業員リストを描画（統一リスト）
    function renderEmployeeList() {
        console.log('従業員リスト描画開始');
        console.log('現在の並び順:', currentOrder);
        
        // 現在の並び順に従って従業員を並べる
        const orderedEmployees = [];
        const usedEmployees = new Set();
        
        // 並び順リストに従って従業員を追加
        currentOrder.forEach(empCode => {
            const employee = employees.find(emp => emp.code === empCode);
            if (employee && !usedEmployees.has(empCode)) {
                orderedEmployees.push(employee);
                usedEmployees.add(empCode);
            }
        });
        
        // 並び順に含まれていない従業員を最後に追加
        employees.forEach(employee => {
            if (!usedEmployees.has(employee.code)) {
                orderedEmployees.push(employee);
            }
        });
        
        let listHtml = `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #2c3e50; margin-bottom: 15px;">全従業員並び順</h4>
                <p style="color: #666; font-size: 12px;">
                    ドラッグ&ドロップで順序を変更できます。この順序はすべてのシフト画面で使用されます。
                </p>
            </div>
            <div id="employee-sortable-list" style="border: 2px solid #ecf0f1; border-radius: 8px; padding: 20px; background: #fafbfc;">
        `;
        
        orderedEmployees.forEach((employee, index) => {
            const businessType = employee.businessTypes?.[0]?.code === 'office' ? '事務' : 
                               employee.businessTypes?.[0]?.code === 'cooking' ? '調理' : '不明';
            
            listHtml += `
                <div class="employee-item" data-employee-code="${employee.code}" 
                     style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; 
                            background: white; border: 1px solid #ddd; border-radius: 6px; cursor: move;">
                    <div style="width: 30px; height: 30px; background: #3498db; color: white; 
                               border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                               font-size: 12px; font-weight: bold; margin-right: 15px;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #2c3e50; margin-bottom: 2px;">
                            ${employee.name}
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            コード: ${employee.code} | 業務区分: ${businessType}
                        </div>
                    </div>
                    <div style="color: #95a5a6; font-size: 18px;">
                        ⋮⋮
                    </div>
                </div>
            `;
        });
        
        listHtml += '</div>';
        
        $('#employee-order-container').html(listHtml);
        
        // Sortable.jsを初期化
        if (sortableInstance) {
            sortableInstance.destroy();
        }
        
        sortableInstance = Sortable.create(document.getElementById('employee-sortable-list'), {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: function() {
                updateOrderNumbers();
            }
        });
        
        console.log('従業員リスト描画完了');
    }
    
    // 順序番号を更新
    function updateOrderNumbers() {
        $('#employee-sortable-list .employee-item').each(function(index) {
            $(this).find('div:first-child').text(index + 1);
        });
    }
    
    // 従業員並び順を保存
    async function saveEmployeeOrder() {
        try {
            // 現在のDOM順序から並び順を取得
            const newOrder = [];
            $('#employee-sortable-list .employee-item').each(function() {
                const empCode = $(this).data('employee-code');
                newOrder.push(empCode);
            });
            
            console.log('保存する並び順:', newOrder);
            
            // 統一した並び順として保存
            const orderData = {
                unified: newOrder
            };
            
            await apiClient.saveEmployeeOrders(orderData);
            
            currentOrder = newOrder;
            showSuccess('従業員の並び順を保存しました。');
            
        } catch (error) {
            console.error('並び順保存エラー:', error);
            showError('並び順の保存に失敗しました。');
        }
    }
    
    // デフォルト順序にリセット
    function resetEmployeeOrder() {
        // 従業員コード順にリセット
        const defaultOrder = employees.map(emp => emp.code).sort();
        currentOrder = defaultOrder;
        renderEmployeeList();
        showSuccess('並び順をデフォルト（従業員コード順）にリセットしました。');
    }
    
    // 成功メッセージ表示
    function showSuccess(message) {
        $('#success-message').text(message).show();
        $('#error-message').hide();
        setTimeout(() => {
            $('#success-message').fadeOut();
        }, 3000);
    }
    
    // エラーメッセージ表示
    function showError(message) {
        $('#error-message').text(message).show();
        $('#success-message').hide();
        setTimeout(() => {
            $('#error-message').fadeOut();
        }, 5000);
    }
});