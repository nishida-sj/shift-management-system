$(document).ready(function() {
    let currentDate = new Date();
    let employees = [];
    let allShiftRequests = {};
    let filteredData = [];
    let editingRequest = null;
    
    console.log('管理者シフト希望管理: ページ読み込み開始');
    
    // 初期表示
    initialize();
    
    // 月移動ボタン
    $('#prev-month').on('click', function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadData();
    });
    
    $('#next-month').on('click', function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadData();
    });
    
    // データ更新ボタン
    $('#refresh-data-btn').on('click', function() {
        loadData();
    });
    
    // フィルター変更
    $('#employee-filter, #status-filter').on('change', function() {
        applyFilters();
        renderShiftRequestsTable();
    });
    
    // 統計表示ボタン
    $('#show-statistics-btn').on('click', function() {
        toggleStatistics();
    });
    
    // CSV出力ボタン
    $('#export-csv-btn').on('click', function() {
        exportToCSV();
    });
    
    // 編集モーダル関連
    $('#edit-request-type').on('change', function() {
        const requestType = $(this).val();
        if (requestType === 'custom') {
            $('#custom-time-section').show();
        } else {
            $('#custom-time-section').hide();
        }
    });
    
    $('#edit-request-form').on('submit', function(e) {
        e.preventDefault();
        saveShiftRequest();
    });
    
    $('#delete-request-btn').on('click', function() {
        deleteShiftRequest();
    });
    
    $('#cancel-edit-btn').on('click', function() {
        closeEditModal();
    });
    
    // 初期化
    async function initialize() {
        await loadData();
    }
    
    // データ読み込み
    async function loadData() {
        try {
            console.log('データ読み込み開始');
            showInfo('データを読み込み中...');
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            // 従業員データを取得
            employees = await apiClient.getEmployees();
            console.log('取得した従業員数:', employees.length);
            
            // 全従業員のシフト希望を取得
            allShiftRequests = {};
            const requestPromises = employees.map(async (emp) => {
                try {
                    console.log(`=== ${emp.name} のデータ取得開始 ===`);
                    const apiRequests = await apiClient.getShiftRequests(emp.employee_code, year, month);
                    console.log(`${emp.name} のAPI生データ:`, apiRequests);
                    
                    // APIレスポンスを日付キー形式に変換
                    const requests = dataConverter.requestsFromApi(apiRequests);
                    console.log(`${emp.name} の変換後データ:`, requests);
                    
                    allShiftRequests[emp.employee_code] = requests;
                    return { employee_code: emp.employee_code, requests };
                } catch (error) {
                    console.warn(`従業員 ${emp.employee_code} のシフト希望取得エラー:`, error);
                    allShiftRequests[emp.employee_code] = {};
                    return { employee_code: emp.employee_code, requests: {} };
                }
            });
            
            await Promise.all(requestPromises);
            console.log('シフト希望データ取得完了:', allShiftRequests);
            
            updateUI();
            hideMessage();
            
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            showError('データの読み込みに失敗しました。');
        }
    }
    
    // UI更新
    function updateUI() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        $('#current-month').text(`${year}年${month}月のシフト希望`);
        
        // 従業員フィルター更新
        updateEmployeeFilter();
        
        // データフィルタリング
        applyFilters();
        
        // テーブル描画
        renderShiftRequestsTable();
    }
    
    // 従業員フィルター更新
    function updateEmployeeFilter() {
        const $filter = $('#employee-filter');
        const currentValue = $filter.val();
        
        $filter.empty().append('<option value="">全従業員</option>');
        
        employees.forEach(emp => {
            $filter.append(`<option value="${emp.employee_code}">${emp.name} (${emp.employee_code})</option>`);
        });
        
        if (currentValue) {
            $filter.val(currentValue);
        }
    }
    
    // フィルター適用
    function applyFilters() {
        const employeeFilter = $('#employee-filter').val();
        const statusFilter = $('#status-filter').val();
        
        filteredData = [];
        
        console.log('フィルター適用開始:', { employeeFilter, statusFilter });
        
        employees.forEach(emp => {
            // 従業員フィルター
            if (employeeFilter && emp.employee_code !== employeeFilter) {
                return;
            }
            
            const requests = allShiftRequests[emp.employee_code] || {};
            
            // 各日のデータを作成
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();
            
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month, day);
                const dateString = formatDate(date);
                const request = requests[dateString] || '';
                
                // ステータス判定
                let status = 'no-request';
                if (request === 'off') {
                    status = 'off';
                } else if (request && request !== '') {
                    status = 'requested';
                }
                
                // ステータスフィルター
                if (statusFilter && statusFilter !== status) {
                    continue; // return ではなく continue を使用
                }
                
                filteredData.push({
                    employee: emp,
                    date: dateString,
                    dateObj: date,
                    request: request,
                    status: status
                });
            }
        });
        
        console.log(`フィルター適用結果: ${filteredData.length}件 (employee: ${employeeFilter || 'all'}, status: ${statusFilter || 'all'})`);
    }
    
    // シフト希望テーブル描画
    function renderShiftRequestsTable() {
        let html = '<table class="table" style="font-size: 12px;"><thead>';
        html += '<tr style="background-color: #34495e; color: white;">';
        html += '<th>従業員</th><th>日付</th><th>曜日</th><th>希望</th><th>ステータス</th><th>操作</th>';
        html += '</tr></thead><tbody>';
        
        if (filteredData.length === 0) {
            html += '<tr><td colspan="6" style="text-align: center; color: #666;">該当するデータがありません</td></tr>';
        } else {
            filteredData.forEach(data => {
                const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                const dayName = dayNames[data.dateObj.getDay()];
                const isWeekend = data.dateObj.getDay() === 0 || data.dateObj.getDay() === 6;
                
                let statusText = '';
                let statusColor = '';
                
                switch (data.status) {
                    case 'requested':
                        statusText = '希望あり';
                        statusColor = '#2ecc71';
                        break;
                    case 'off':
                        statusText = '休み希望';
                        statusColor = '#e74c3c';
                        break;
                    default:
                        statusText = '希望なし';
                        statusColor = '#95a5a6';
                }
                
                const requestDisplay = data.request || '（なし）';
                const weekendStyle = isWeekend ? 'background-color: #fff5f5;' : '';
                
                html += `<tr style="${weekendStyle}">`;
                html += `<td><strong>${data.employee.name}</strong><br><small style="color: #666;">${data.employee.employee_code}</small></td>`;
                html += `<td>${data.dateObj.getDate()}日</td>`;
                html += `<td style="${isWeekend ? 'color: #e74c3c; font-weight: bold;' : ''}">${dayName}</td>`;
                html += `<td>${requestDisplay}</td>`;
                html += `<td><span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></td>`;
                html += `<td><button class="btn btn-primary edit-request-btn" data-employee="${data.employee.employee_code}" data-date="${data.date}" style="font-size: 11px;">編集</button></td>`;
                html += '</tr>';
            });
        }
        
        html += '</tbody></table>';
        
        // ページング情報
        if (filteredData.length > 0) {
            html += `<div style="margin-top: 10px; text-align: center; color: #666;">`;
            html += `表示中: ${filteredData.length} 件`;
            html += `</div>`;
        }
        
        $('#shift-requests-container').html(html);
        
        // 編集ボタンイベント
        $('.edit-request-btn').on('click', function() {
            const employeeCode = $(this).data('employee');
            const date = $(this).data('date');
            openEditModal(employeeCode, date);
        });
    }
    
    // 統計表示切り替え
    function toggleStatistics() {
        const $panel = $('#statistics-panel');
        
        if ($panel.is(':visible')) {
            $panel.hide();
            $('#show-statistics-btn').text('統計表示');
        } else {
            generateStatistics();
            $panel.show();
            $('#show-statistics-btn').text('統計非表示');
        }
    }
    
    // 統計生成
    function generateStatistics() {
        const stats = {
            totalRequests: 0,
            offRequests: 0,
            customRequests: 0,
            noRequests: 0,
            employeeStats: {}
        };
        
        employees.forEach(emp => {
            stats.employeeStats[emp.employee_code] = {
                name: emp.name,
                total: 0,
                off: 0,
                custom: 0,
                none: 0
            };
        });
        
        filteredData.forEach(data => {
            const empCode = data.employee.employee_code;
            
            stats.totalRequests++;
            stats.employeeStats[empCode].total++;
            
            switch (data.status) {
                case 'off':
                    stats.offRequests++;
                    stats.employeeStats[empCode].off++;
                    break;
                case 'requested':
                    stats.customRequests++;
                    stats.employeeStats[empCode].custom++;
                    break;
                default:
                    stats.noRequests++;
                    stats.employeeStats[empCode].none++;
            }
        });
        
        let html = '<div style="display: flex; gap: 20px;">';
        
        // 全体統計
        html += '<div style="flex: 1;">';
        html += '<h5>全体統計</h5>';
        html += `<p>総件数: <strong>${stats.totalRequests}</strong></p>`;
        html += `<p>休み希望: <strong style="color: #e74c3c;">${stats.offRequests}</strong></p>`;
        html += `<p>カスタム希望: <strong style="color: #2ecc71;">${stats.customRequests}</strong></p>`;
        html += `<p>希望なし: <strong style="color: #95a5a6;">${stats.noRequests}</strong></p>`;
        html += '</div>';
        
        // 従業員別統計
        html += '<div style="flex: 2;">';
        html += '<h5>従業員別統計</h5>';
        html += '<div style="max-height: 200px; overflow-y: auto;">';
        
        Object.keys(stats.employeeStats).forEach(empCode => {
            const empStats = stats.employeeStats[empCode];
            if (empStats.total > 0) {
                html += `<div style="margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 3px;">`;
                html += `<strong>${empStats.name}</strong>: `;
                html += `合計${empStats.total} `;
                html += `(休み${empStats.off}, カスタム${empStats.custom}, なし${empStats.none})`;
                html += `</div>`;
            }
        });
        
        html += '</div></div>';
        html += '</div>';
        
        $('#statistics-content').html(html);
    }
    
    // 編集モーダル開く
    function openEditModal(employeeCode, date) {
        const employee = employees.find(emp => emp.employee_code === employeeCode);
        if (!employee) {
            showError('従業員が見つかりません。');
            return;
        }
        
        const requests = allShiftRequests[employeeCode] || {};
        const currentRequest = requests[date] || '';
        
        editingRequest = {
            employeeCode: employeeCode,
            date: date,
            employee: employee,
            currentRequest: currentRequest
        };
        
        // 従業員情報表示
        const dateObj = new Date(date);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const displayDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日(${dayNames[dateObj.getDay()]})`;
        
        $('#edit-employee-info').html(`
            <strong>${employee.name}</strong> (${employeeCode})<br>
            <span style="color: #666;">${displayDate}</span>
        `);
        
        // フォーム設定
        if (currentRequest === 'off') {
            $('#edit-request-type').val('off');
            $('#custom-time-section').hide();
        } else if (currentRequest && currentRequest !== '') {
            $('#edit-request-type').val('custom');
            $('#edit-custom-time').val(currentRequest);
            $('#custom-time-section').show();
        } else {
            $('#edit-request-type').val('');
            $('#custom-time-section').hide();
        }
        
        $('#edit-request-modal').show();
    }
    
    // 編集モーダル閉じる
    function closeEditModal() {
        $('#edit-request-modal').hide();
        editingRequest = null;
    }
    
    // シフト希望保存
    async function saveShiftRequest() {
        if (!editingRequest) return;
        
        const requestType = $('#edit-request-type').val();
        let requestValue = '';
        
        if (requestType === 'off') {
            requestValue = 'off';
        } else if (requestType === 'custom') {
            requestValue = $('#edit-custom-time').val().trim();
            if (!requestValue) {
                showError('カスタム時間を入力してください。');
                return;
            }
            
            // 時間形式チェック
            if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(requestValue)) {
                showError('時間の形式が正しくありません。HH:MM-HH:MM の形式で入力してください。');
                return;
            }
        }
        
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            // 時間データを秒付き形式に変換
            let startTime = null;
            let endTime = null;
            if (requestType === 'custom') {
                const [start, end] = requestValue.split('-');
                startTime = start + ':00';  // HH:MM:SS形式に変換
                endTime = end + ':00';      // HH:MM:SS形式に変換
            }
            
            console.log('管理者保存データ:', {
                employeeCode: editingRequest.employeeCode,
                year, month, day: new Date(editingRequest.date).getDate(),
                isOff: requestValue === 'off',
                startTime, endTime
            });

            await apiClient.saveShiftRequest(
                editingRequest.employeeCode,
                year,
                month,
                new Date(editingRequest.date).getDate(),
                requestValue === 'off' ? true : false,
                startTime,
                endTime
            );
            
            showSuccess('シフト希望を保存しました。');
            closeEditModal();
            await loadData(); // データ再読み込み
            
        } catch (error) {
            console.error('シフト希望保存エラー:', error);
            showError('シフト希望の保存に失敗しました。');
        }
    }
    
    // シフト希望削除
    async function deleteShiftRequest() {
        if (!editingRequest) return;
        
        if (!confirm('このシフト希望を削除しますか？')) {
            return;
        }
        
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const day = new Date(editingRequest.date).getDate();
            
            await apiClient.deleteShiftRequest(editingRequest.employeeCode, year, month, day);
            
            showSuccess('シフト希望を削除しました。');
            closeEditModal();
            await loadData(); // データ再読み込み
            
        } catch (error) {
            console.error('シフト希望削除エラー:', error);
            showError('シフト希望の削除に失敗しました。');
        }
    }
    
    // CSV出力
    function exportToCSV() {
        if (filteredData.length === 0) {
            showError('出力するデータがありません。');
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        // CSVヘッダー
        let csv = 'UTF-8 BOM\n';
        csv += '従業員コード,従業員名,日付,曜日,シフト希望,ステータス\n';
        
        // データ行
        filteredData.forEach(data => {
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const dayName = dayNames[data.dateObj.getDay()];
            
            let statusText = '';
            switch (data.status) {
                case 'requested': statusText = '希望あり'; break;
                case 'off': statusText = '休み希望'; break;
                default: statusText = '希望なし';
            }
            
            const requestDisplay = data.request || '';
            
            csv += `"${data.employee.employee_code}","${data.employee.name}","${data.dateObj.getDate()}","${dayName}","${requestDisplay}","${statusText}"\n`;
        });
        
        // ファイルダウンロード
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `shift-requests-${year}-${String(month).padStart(2, '0')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('CSVファイルをダウンロードしました。');
    }
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // メッセージ表示関数
    function showSuccess(message) {
        $('#success-message').text(message).show();
        setTimeout(() => $('#success-message').fadeOut(), 3000);
    }
    
    function showError(message) {
        $('#error-message').text(message).show();
        setTimeout(() => $('#error-message').fadeOut(), 5000);
    }
    
    function showInfo(message) {
        // 簡易的な情報表示
        console.log('Info:', message);
    }
    
    function hideMessage() {
        $('#success-message, #error-message').hide();
    }
});