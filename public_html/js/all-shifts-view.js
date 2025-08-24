$(document).ready(function() {
    let currentDate = new Date();
    let employees = [];
    let confirmedShifts = {};
    let shiftStatus = 'draft';
    
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
            const shiftResponse = await fetch(`/api/shifts.php?type=confirmed&year=${year}&month=${month}`);
            if (shiftResponse.ok) {
                confirmedShifts = await shiftResponse.json();
            } else {
                confirmedShifts = {};
            }
            
            // シフト状態読み込み
            const statusResponse = await fetch(`/api/shifts.php?type=status&year=${year}&month=${month}`);
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                shiftStatus = statusData.is_confirmed ? 'confirmed' : 'draft';
            } else {
                shiftStatus = 'draft';
            }
            
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            showError('データの読み込みに失敗しました。');
        }
    }
    
    // シフト表を描画
    function renderShiftTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let tableHtml = `
            <table class="shift-table table table-bordered">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="width: 120px; position: sticky; left: 0; background: #f8f9fa; z-index: 10;">従業員</th>
        `;
        
        // 日付ヘッダー
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayName = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            tableHtml += `
                <th style="width: 80px; text-align: center; ${isWeekend ? 'background-color: #ffeaea;' : ''}">
                    ${day}<br>
                    <small style="color: #666;">${dayName}</small>
                </th>
            `;
        }
        
        tableHtml += '</tr></thead><tbody>';
        
        // 従業員行
        employees.forEach(employee => {
            tableHtml += `
                <tr>
                    <td style="position: sticky; left: 0; background: white; z-index: 5; font-weight: bold; padding: 8px;">
                        ${employee.name}<br>
                        <small style="color: #666;">${employee.businessTypes?.[0]?.code || ''}</small>
                    </td>
            `;
            
            // 日付セル
            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const shift = confirmedShifts[employee.code]?.[dateKey];
                const date = new Date(year, month - 1, day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                
                let cellContent = '';
                let cellStyle = 'text-align: center; padding: 4px; font-size: 12px;';
                
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
            }
            
            tableHtml += '</tr>';
        });
        
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
});