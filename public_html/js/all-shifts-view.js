$(document).ready(function() {
    let currentDate = new Date();
    let employees = [];
    let confirmedShifts = {};
    let shiftStatus = 'draft';
    let monthlyEvents = {};
    
    // 初期表示
    async function initialize() {
        await loadData();
        renderShiftTable();
        updateStatusDisplay();
        loadNotes();
    }
    
    initialize();
    
    // 月移動ボタン
    $('#prev-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        await loadData();
        renderShiftTable();
        updateStatusDisplay();
        loadNotes();
    });
    
    $('#next-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        await loadData();
        renderShiftTable();
        updateStatusDisplay();
        loadNotes();
    });
    
    // データを読み込み
    async function loadData() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        $('#current-month').text(`${year}年${month}月のシフト`);
        
        try {
            // 従業員データ読み込み
            const apiEmployees = await apiClient.getEmployees();
            employees = apiEmployees.map(emp => dataConverter.employeeFromApi(emp));
            
            // 確定シフトデータ読み込み
            const apiShifts = await apiClient.getConfirmedShifts(year, month).catch(err => {
                console.error('確定シフト取得エラー:', err);
                return [];
            });
            
            // 確定シフトデータをローカル形式に変換
            confirmedShifts = {};
            if (apiShifts && Array.isArray(apiShifts)) {
                console.log(`${apiShifts.length}件のシフトデータを処理中`);
                apiShifts.forEach(shift => {
                    // ネストした構造で格納: confirmedShifts[employeeCode][dateString] = shiftInfo
                    if (!confirmedShifts[shift.employee_code]) {
                        confirmedShifts[shift.employee_code] = {};
                    }
                    
                    // 日付文字列を生成 (YYYY-MM-DD形式)
                    const dateString = `${shift.year}-${String(shift.month).padStart(2, '0')}-${String(shift.day).padStart(2, '0')}`;
                    
                    confirmedShifts[shift.employee_code][dateString] = {
                        time_start: shift.time_start,
                        time_end: shift.time_end,
                        is_violation: shift.is_violation,
                        business_type: shift.business_type
                    };
                });
            }
            
            // シフト状態読み込み
            const apiStatus = await apiClient.getShiftStatus(year, month).catch(err => {
                console.error('シフト状態取得エラー:', err);
                return { is_confirmed: 0 };
            });
            shiftStatus = apiStatus.is_confirmed ? 'confirmed' : 'draft';
            
            // 月間行事予定読み込み
            const eventsResponse = await fetch(`/api/monthly-events.php?year=${year}&month=${month}`).catch(err => {
                console.error('月間行事予定取得エラー:', err);
                return { ok: false };
            });
            
            if (eventsResponse.ok) {
                monthlyEvents = await eventsResponse.json();
            } else {
                monthlyEvents = {};
            }
            
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            showError('データの読み込みに失敗しました。');
        }
    }
    
    // シフト表を描画（縦：日付・行事、横：従業員名）
    function renderShiftTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let tableHtml = `
            <table class="shift-table table table-bordered">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="width: 100px; position: sticky; left: 0; background: #f8f9fa; z-index: 10;">日付・行事</th>
        `;
        
        // 従業員名ヘッダー（並び順マスタに従って）
        const orderedEmployees = getOrderedEmployees(employees);
        orderedEmployees.forEach(employee => {
            tableHtml += `
                <th style="width: 80px; text-align: center; font-size: 11px;">
                    ${employee.name}<br>
                    <small style="color: #666;">${employee.businessTypes?.[0]?.code || ''}</small>
                </th>
            `;
        });
        
        tableHtml += '</tr></thead><tbody>';
        
        // 日付行
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayName = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            // 行事名を取得
            const eventInfo = monthlyEvents[dateKey];
            const eventName = eventInfo ? eventInfo.event_name : '';
            
            let rowStyle = isWeekend ? 'background-color: #ffeaea;' : '';
            
            tableHtml += `
                <tr style="${rowStyle}">
                    <td style="position: sticky; left: 0; background: ${isWeekend ? '#ffeaea' : 'white'}; z-index: 5; font-weight: bold; padding: 8px; font-size: 12px;">
                        ${day}日(${dayName})<br>
                        ${eventName ? `<small style="color: #007bff;">${eventName}</small>` : ''}
                    </td>
            `;
            
            // 各従業員のシフトセル（並び順マスタに従って）
            orderedEmployees.forEach(employee => {
                const shift = confirmedShifts[employee.code]?.[dateKey];
                
                let cellContent = '';
                let cellStyle = 'text-align: center; padding: 4px; font-size: 11px;';
                
                if (isWeekend) {
                    cellStyle += ' background-color: #ffeaea;';
                }
                
                if (shift && shift.time_start && shift.time_end) {
                    const timeStart = shift.time_start.substring(0, 5); // HH:MM
                    const timeEnd = shift.time_end.substring(0, 5);
                    cellContent = `${timeStart}<br>${timeEnd}`;
                    cellStyle += ' background-color: #d4edda; border-left: 3px solid #28a745;';
                    
                    if (shift.is_violation) {
                        cellStyle += ' background-color: #f8d7da; border-left-color: #dc3545;';
                    }
                } else {
                    cellContent = '-';
                    cellStyle += ' color: #999;';
                }
                
                tableHtml += `<td style="${cellStyle}">${cellContent}</td>`;
            });
            
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table>';
        
        $('#shift-table-container').html(tableHtml);
    }
    
    // 状態表示を更新
    function updateStatusDisplay() {
        const $statusDiv = $('#shift-status');
        
        if (shiftStatus === 'confirmed') {
            $statusDiv.removeClass('alert-warning').addClass('alert-success');
            $statusDiv.html('<strong>確定済み:</strong> このシフトは確定されています。');
            $statusDiv.show();
        } else {
            $statusDiv.removeClass('alert-success').addClass('alert-warning');
            $statusDiv.html('<strong>未確定:</strong> このシフトは未確定です。');
            $statusDiv.show();
        }
    }
    
    // 備考を読み込み
    async function loadNotes() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        try {
            const response = await fetch(`/api/shifts.php?type=notes&year=${year}&month=${month}`);
            if (response.ok) {
                const notes = await response.json();
                if (notes && notes.notes) {
                    $('#shift-notes').text(notes.notes);
                    $('#notes-section').show();
                } else {
                    $('#notes-section').hide();
                }
            } else {
                $('#notes-section').hide();
            }
        } catch (error) {
            console.error('備考読み込みエラー:', error);
            $('#notes-section').hide();
        }
    }
    
    // エラー表示
    function showError(message) {
        const $errorDiv = $('#shift-status');
        $errorDiv.removeClass('alert-success alert-warning').addClass('alert-danger');
        $errorDiv.html(`<strong>エラー:</strong> ${message}`);
        $errorDiv.show();
    }
    
    // 従業員を統一並び順マスタに従って並び替え
    function getOrderedEmployees(employees) {
        try {
            const employeeOrders = dataManager.getEmployeeOrders();
            const orderedEmployees = [];
            const usedEmployees = new Set();
            
            // 統一並び順がある場合は使用
            if (employeeOrders && employeeOrders.unified && Array.isArray(employeeOrders.unified)) {
                employeeOrders.unified.forEach(empCode => {
                    const employee = employees.find(emp => emp.code === empCode);
                    if (employee && !usedEmployees.has(empCode)) {
                        orderedEmployees.push(employee);
                        usedEmployees.add(empCode);
                    }
                });
            }
            
            // 並び順が設定されていない従業員をデフォルト順序で追加
            employees.forEach(employee => {
                if (!usedEmployees.has(employee.code)) {
                    orderedEmployees.push(employee);
                }
            });
            
            return orderedEmployees;
        } catch (error) {
            console.error('従業員並び順取得エラー:', error);
            // エラー時はデフォルト順序（従業員コード順）
            return [...employees].sort((a, b) => a.code.localeCompare(b.code));
        }
    }
});