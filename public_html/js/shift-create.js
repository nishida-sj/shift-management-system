$(document).ready(function() {
    let currentDate = new Date();
    let employees = [];
    let eventMaster = [];
    let monthlyEvents = {};
    let currentShift = {};
    let shiftCellBackgrounds = {};
    let shiftStatus = 'draft';
    let editingCell = null;
    
    // 初期表示
    loadData();
    renderShiftTable();
    updateStatusDisplay();
    loadNotes();
    
    // 月移動ボタン
    $('#prev-month').on('click', function() {
        saveCurrentShift();
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadData();
        renderShiftTable();
        updateStatusDisplay();
        loadNotes();
    });
    
    $('#next-month').on('click', function() {
        saveCurrentShift();
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadData();
        renderShiftTable();
        updateStatusDisplay();
        loadNotes();
    });
    
    // 操作ボタン
    $('#auto-create-btn').on('click', function() {
        autoCreateShift();
    });
    
    $('#save-draft-btn').on('click', function() {
        saveCurrentShift();
        showSuccess('下書きを保存しました。');
    });
    
    $('#confirm-shift-btn').on('click', function() {
        confirmShift();
    });
    
    $('#unconfirm-shift-btn').on('click', function() {
        unconfirmShift();
    });
    
    $('#print-preview-btn').on('click', function() {
        openPrintPreview();
    });
    
    // 備考保存
    $('#save-notes-btn').on('click', function() {
        saveNotes();
    });
    
    // 出勤統計ボタン
    $('#show-month-end-stats').on('click', function() {
        showAttendanceStats('month-end');
    });
    
    $('#show-closing-date-stats').on('click', function() {
        showAttendanceStats('closing-date');
    });
    
    // シフト編集モーダル
    $('#save-shift-edit-btn').on('click', function() {
        saveShiftEdit();
    });
    
    $('#cancel-shift-edit-btn').on('click', function() {
        closeShiftEditModal();
    });
    
    // データ読み込み
    function loadData() {
        employees = dataManager.getEmployees();
        eventMaster = dataManager.getEvents();
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        monthlyEvents = dataManager.getMonthlyEvents(year, month);
        currentShift = dataManager.getConfirmedShift(year, month);
        shiftStatus = dataManager.getShiftStatus(year, month);
        
        // 空のシフトデータを初期化
        if (Object.keys(currentShift).length === 0) {
            initializeEmptyShift();
        }
        
        // セル背景色データを読み込み
        shiftCellBackgrounds = dataManager.getShiftCellBackgrounds(year, month);
    }
    
    // 空のシフトデータを初期化
    function initializeEmptyShift() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        
        currentShift = {};
        shiftCellBackgrounds = {};
        employees.forEach(employee => {
            currentShift[employee.code] = {};
            shiftCellBackgrounds[employee.code] = {};
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month, day);
                const dateString = formatDate(date);
                currentShift[employee.code][dateString] = '';
                shiftCellBackgrounds[employee.code][dateString] = '';
            }
        });
    }
    
    // 現在のシフトを保存
    function saveCurrentShift() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        dataManager.saveConfirmedShift(year, month, currentShift);
        dataManager.saveShiftCellBackgrounds(year, month, shiftCellBackgrounds);
    }
    
    // ステータス表示更新
    function updateStatusDisplay() {
        const statusEl = $('#shift-status');
        
        if (shiftStatus === 'confirmed') {
            statusEl.removeClass('alert-danger').addClass('alert-success');
            statusEl.text('このシフトは確定済みです。').show();
            $('#confirm-shift-btn').hide();
            $('#unconfirm-shift-btn').show();
            $('#print-preview-btn').show();
        } else {
            statusEl.removeClass('alert-success').addClass('alert-danger');
            statusEl.text('このシフトは下書き状態です。').show();
            $('#confirm-shift-btn').show();
            $('#unconfirm-shift-btn').hide();
            $('#print-preview-btn').hide();
        }
    }
    
    // シフト表描画（縦：日付・行事、横：従業員）
    function renderShiftTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 月表示を更新
        $('#current-month').text(year + '年' + (month + 1) + '月のシフト');
        
        if (Object.keys(currentShift).length === 0) {
            initializeEmptyShift();
        }
        
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        
        let tableHtml = '<table class="table calendar-table">';
        
        // 従業員を並び順マスタに従って並び替え
        const orderedEmployees = getOrderedEmployees(employees);
        
        // ヘッダー行（従業員名）
        tableHtml += '<thead><tr><th style="min-width: 120px;">日付・行事</th><th style="min-width: 100px;">備考</th>';
        orderedEmployees.forEach(employee => {
            tableHtml += `<th style="min-width: 80px;">${employee.name}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        // 各日の行
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const dateString = formatDate(date);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // 行事情報を取得
            const eventId = monthlyEvents[dateString];
            const event = eventId ? eventMaster.find(e => e.id === eventId) : null;
            const eventName = event ? event.name : '';
            
            const rowClass = isWeekend ? 'style="background-color: #fff5f5;"' : '';
            
            tableHtml += `<tr ${rowClass}>`;
            
            // 日付・行事列
            const dayClass = isWeekend ? 'style="background-color: #ffe6e6; font-weight: bold;"' : '';
            tableHtml += `<td ${dayClass}>`;
            tableHtml += `${day}日(${dayNames[dayOfWeek]})`;
            if (eventName) {
                tableHtml += `<br><small style="color: #e67e22;">${eventName}</small>`;
            }
            tableHtml += '</td>';
            
            // 備考列
            tableHtml += `<td>`;
            tableHtml += `<input type="text" class="form-control date-note" data-date="${dateString}" placeholder="備考" style="font-size: 12px; padding: 4px;">`;
            tableHtml += '</td>';
            
            // 各従業員のシフト（並び順マスタの順序で）
            orderedEmployees.forEach(employee => {
                const shift = currentShift[employee.code] ? currentShift[employee.code][dateString] : '';
                const shiftDisplay = formatShiftDisplay(shift);
                
                // 条件違反チェック
                const isViolation = checkShiftViolation(employee, dateString, shift);
                const violationStyle = isViolation ? 'color: red; font-weight: bold;' : '';
                
                // セル背景色を取得
                const cellBgColor = shiftCellBackgrounds[employee.code] ? shiftCellBackgrounds[employee.code][dateString] : '';
                const bgStyle = getCellBackgroundStyle(cellBgColor);
                
                tableHtml += `<td class="shift-cell" data-employee="${employee.code}" data-date="${dateString}" style="cursor: pointer; text-align: center; ${violationStyle} ${bgStyle}">${shiftDisplay}</td>`;
            });
            
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table>';
        $('#shift-table-container').html(tableHtml);
        
        // 備考の読み込み
        loadDateNotes();
        
        // セルクリックイベント
        $('.shift-cell').on('click', function() {
            if (shiftStatus === 'confirmed') {
                showError('確定済みのシフトは編集できません。確定解除してから編集してください。');
                return;
            }
            
            const employeeCode = $(this).data('employee');
            const date = $(this).data('date');
            openShiftEditModal(employeeCode, date);
        });
        
        // 備考入力イベント
        $('.date-note').on('change', function() {
            saveDateNotes();
        });
    }
    
    // シフト表示フォーマット
    function formatShiftDisplay(shift) {
        if (!shift) return '-';
        return `<span style="font-size: 11px;">${shift}</span>`;
    }
    
    // シフト条件違反チェック
    function checkShiftViolation(employee, dateString, shift) {
        if (!shift) return false;
        
        const date = new Date(dateString);
        const dayOfWeek = date.getDay();
        
        // 曜日別出勤可能時間チェック
        if (!employee.conditions.weeklySchedule || !employee.conditions.weeklySchedule[dayOfWeek]) {
            return true; // その曜日は出勤不可
        }
        
        // 「終日」が設定されている場合はどの時間帯でもOK
        if (employee.conditions.weeklySchedule[dayOfWeek].includes('終日')) {
            return false;
        }
        
        // 固定時間帯チェック
        if (employee.conditions.weeklySchedule[dayOfWeek].includes(shift)) {
            return false;
        }
        
        // 従業員の時間帯希望チェック（カスタム入力含む）
        const requests = dataManager.getEmployeeRequests(employee.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
        const employeePreference = requests[dateString];
        
        if (employeePreference && employeePreference !== 'off' && employeePreference !== '') {
            // カスタム時間帯の場合、重複チェック
            if (isTimeOverlap(employeePreference, shift)) {
                return false; // 希望時間帯と重複していれば問題なし
            }
        }
        
        // TODO: 週の勤務日数制限、1日の勤務時間制限もチェック
        
        return true; // 条件に合わない
    }
    
    // シフト自動作成
    function autoCreateShift() {
        if (!confirm('現在のシフトデータを削除して自動作成しますか？')) {
            return;
        }
        
        showInfo('シフトを自動作成中...');
        
        // 初期化
        initializeEmptyShift();
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        
        let successCount = 0;
        let skipCount = 0;
        
        // 各日ごとに処理
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dateString = formatDate(date);
            const dayOfWeek = date.getDay();
            
            // 行事情報を取得
            const eventId = monthlyEvents[dateString];
            if (!eventId) continue;
            
            const event = eventMaster.find(e => e.id === eventId);
            if (!event) continue;
            
            // この日のシフト作成を試行
            const dayResult = createDayShift(employees, dateString, event, dayOfWeek);
            if (dayResult) {
                successCount++;
            } else {
                skipCount++;
            }
        }
        
        renderShiftTable();
        saveCurrentShift();
        
        showSuccess(`シフト自動作成完了: ${successCount}日作成、${skipCount}日スキップ`);
    }
    
    // 1日のシフト作成（メイン業務優先ロジック）
    function createDayShift(employees, dateString, event, dayOfWeek) {
        // 利用可能な従業員を取得
        const availableEmployees = employees.filter(emp => {
            // 曜日別出勤可能時間チェック
            if (!emp.conditions.weeklySchedule || !emp.conditions.weeklySchedule[dayOfWeek]) {
                return false;
            }
            
            // 休み希望チェック
            const requests = dataManager.getEmployeeRequests(emp.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
            if (requests[dateString] === 'off') return false;
            
            return true;
        });
        
        let assigned = false;
        
        // 各業務区分の要件を処理
        Object.keys(event.requirements).forEach(businessTypeCode => {
            const requirements = event.requirements[businessTypeCode];
            
            requirements.forEach(req => {
                const requiredTime = req.time;
                const requiredCount = req.count;
                
                // Step 1: メイン業務として該当する従業員を優先配置
                const mainEmployees = availableEmployees.filter(emp => 
                    hasMainBusinessType(emp, businessTypeCode) &&
                    canWorkAtTime(emp, dayOfWeek, requiredTime, dateString) &&
                    !currentShift[emp.code][dateString] // 既に配置済みでない
                );
                
                let assignedCount = 0;
                
                // メイン業務従業員を優先配置
                for (let i = 0; i < Math.min(requiredCount, mainEmployees.length); i++) {
                    currentShift[mainEmployees[i].code][dateString] = requiredTime;
                    assignedCount++;
                    assigned = true;
                }
                
                // Step 2: 不足分をサブ業務従業員で補完
                if (assignedCount < requiredCount) {
                    const subEmployees = availableEmployees.filter(emp => 
                        hasSubBusinessType(emp, businessTypeCode) &&
                        canWorkAtTime(emp, dayOfWeek, requiredTime, dateString) &&
                        !currentShift[emp.code][dateString] // 既に配置済みでない
                    );
                    
                    const remainingCount = requiredCount - assignedCount;
                    for (let i = 0; i < Math.min(remainingCount, subEmployees.length); i++) {
                        currentShift[subEmployees[i].code][dateString] = requiredTime;
                        assignedCount++;
                        assigned = true;
                    }
                }
                
                // デバッグ情報
                console.log(`${dateString} ${businessTypeCode} ${requiredTime}: 必要${requiredCount}人, 配置${assignedCount}人`);
            });
        });
        
        return assigned;
    }
    
    // メイン業務として該当業務区分を持っているかチェック
    function hasMainBusinessType(employee, businessTypeCode) {
        return employee.businessTypes && 
               employee.businessTypes.some(bt => bt.code === businessTypeCode && bt.isMain);
    }
    
    // サブ業務として該当業務区分を持っているかチェック
    function hasSubBusinessType(employee, businessTypeCode) {
        return employee.businessTypes && 
               employee.businessTypes.some(bt => bt.code === businessTypeCode && !bt.isMain);
    }
    
    // 従業員が指定時間帯に勤務可能かチェック（カスタム時間帯対応含む）
    function canWorkAtTime(employee, dayOfWeek, requiredTime, dateString) {
        // 曜日別出勤可能時間をチェック
        if (!employee.conditions.weeklySchedule || !employee.conditions.weeklySchedule[dayOfWeek]) {
            return false;
        }
        
        const daySchedule = employee.conditions.weeklySchedule[dayOfWeek];
        
        // 「終日」が設定されている場合はどの時間帯でもOK
        if (daySchedule.includes('終日')) {
            return true;
        }
        
        // 固定時間帯にマッチするかチェック
        if (daySchedule.includes(requiredTime)) {
            return true;
        }
        
        // 従業員の時間帯希望をチェック（カスタム入力含む）
        const requests = dataManager.getEmployeeRequests(employee.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
        const employeePreference = requests[dateString];
        
        if (employeePreference && employeePreference !== 'off' && employeePreference !== '') {
            // カスタム時間帯の場合、重複チェック
            if (isTimeOverlap(employeePreference, requiredTime)) {
                return true;
            }
        }
        
        return false;
    }
    
    // 時間帯が重複するかチェック
    function isTimeOverlap(timeRange1, timeRange2) {
        try {
            const [start1, end1] = timeRange1.split('-').map(t => timeToMinutes(t));
            const [start2, end2] = timeRange2.split('-').map(t => timeToMinutes(t));
            
            // 重複判定：開始時間が相手の終了時間より前で、終了時間が相手の開始時間より後
            return start1 < end2 && end1 > start2;
        } catch (error) {
            console.error('時間帯重複チェックエラー:', error);
            return false;
        }
    }
    
    // 時間を分に変換
    function timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 従業員を並び順マスタに従って並び替え
    function getOrderedEmployees(employees) {
        try {
            const employeeOrders = dataManager.getEmployeeOrders();
            const businessTypes = dataManager.getBusinessTypes();
            const orderedEmployees = [];
            const usedEmployees = new Set();
            
            // 各業務区分の順序で従業員を追加
            businessTypes.forEach(businessType => {
                const order = employeeOrders[businessType.code];
                if (order && Array.isArray(order)) {
                    order.forEach(empCode => {
                        const employee = employees.find(emp => emp.code === empCode);
                        if (employee && !usedEmployees.has(empCode)) {
                            orderedEmployees.push(employee);
                            usedEmployees.add(empCode);
                        }
                    });
                }
            });
            
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
    
    // メイン業務区分名を取得
    function getMainBusinessTypeName(employee) {
        if (!employee.businessTypes || employee.businessTypes.length === 0) {
            return '未設定';
        }
        
        const mainBusinessType = employee.businessTypes.find(bt => bt.isMain);
        if (!mainBusinessType) {
            return '未設定';
        }
        
        const businessTypes = dataManager.getBusinessTypes();
        const businessType = businessTypes.find(bt => bt.code === mainBusinessType.code);
        return businessType ? businessType.name : mainBusinessType.code;
    }
    
    // シフト編集モーダルを開く
    function openShiftEditModal(employeeCode, date) {
        const employee = employees.find(emp => emp.code === employeeCode);
        const currentShiftTime = currentShift[employeeCode] ? currentShift[employeeCode][date] : '';
        const currentBgColor = shiftCellBackgrounds[employeeCode] ? shiftCellBackgrounds[employeeCode][date] : '';
        
        $('#edit-employee-name').text(employee.name);
        $('#edit-date').text(formatDateForDisplay(date));
        
        // 時間帯マスタから選択肢を生成
        populateShiftTimeOptions();
        
        $('#edit-shift-time').val(currentShiftTime);
        $('#edit-cell-background').val(currentBgColor);
        
        editingCell = { employeeCode: employeeCode, date: date };
        
        // 警告チェック
        checkEditWarning();
        
        $('#shift-edit-modal').show();
    }
    
    // シフト編集モーダルを閉じる
    function closeShiftEditModal() {
        $('#shift-edit-modal').hide();
        editingCell = null;
    }
    
    // 編集時の警告チェック
    function checkEditWarning() {
        $('#edit-shift-time').on('change', function() {
            const newShift = $(this).val();
            if (!newShift) {
                $('#warning-message').hide();
                return;
            }
            
            const employee = employees.find(emp => emp.code === editingCell.employeeCode);
            const isViolation = checkShiftViolation(employee, editingCell.date, newShift);
            
            if (isViolation) {
                $('#warning-message').text('この設定は従業員の条件に合いません。保存しても赤字で表示されます。').show();
            } else {
                $('#warning-message').hide();
            }
        });
    }
    
    // シフト編集保存
    function saveShiftEdit() {
        if (!editingCell) return;
        
        const newShift = $('#edit-shift-time').val();
        const newBgColor = $('#edit-cell-background').val();
        
        if (!currentShift[editingCell.employeeCode]) {
            currentShift[editingCell.employeeCode] = {};
        }
        if (!shiftCellBackgrounds[editingCell.employeeCode]) {
            shiftCellBackgrounds[editingCell.employeeCode] = {};
        }
        
        currentShift[editingCell.employeeCode][editingCell.date] = newShift;
        shiftCellBackgrounds[editingCell.employeeCode][editingCell.date] = newBgColor;
        
        renderShiftTable();
        closeShiftEditModal();
        showSuccess('シフトを更新しました。');
    }
    
    // シフト確定
    function confirmShift() {
        if (!confirm('シフトを確定しますか？確定後は個別修正ができなくなります。')) {
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        dataManager.saveShiftStatus(year, month, 'confirmed');
        shiftStatus = 'confirmed';
        
        saveCurrentShift();
        updateStatusDisplay();
        showSuccess('シフトを確定しました。');
    }
    
    // 確定解除
    function unconfirmShift() {
        if (!confirm('シフトの確定を解除しますか？解除後は個別修正が可能になります。')) {
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        dataManager.saveShiftStatus(year, month, 'draft');
        shiftStatus = 'draft';
        
        updateStatusDisplay();
        showSuccess('シフトの確定を解除しました。');
    }
    
    // 印刷プレビューを開く
    function openPrintPreview() {
        const printWindow = window.open('', '_blank');
        const printHtml = generatePrintHtml();
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.print();
    }
    
    // 印刷用HTML生成
    function generatePrintHtml() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const title = `${year}年${month}月 確定シフト表`;
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body { font-family: sans-serif; margin: 20px; }
                    h1 { text-align: center; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 12px; }
                    .employee-name { background-color: #f0f0f0; font-weight: bold; }
                    .weekend { background-color: #ffe6e6; }
                    .violation { color: red; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                ${$('#shift-table-container').html()}
            </body>
            </html>
        `;
        
        return html;
    }
    
    // 備考読み込み
    function loadNotes() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const notes = dataManager.getShiftNotes(year, month);
        $('#shift-notes').val(notes.general || '');
    }
    
    // 日付ごとの備考を読み込み
    function loadDateNotes() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const notes = dataManager.getShiftNotes(year, month);
        
        $('.date-note').each(function() {
            const date = $(this).data('date');
            if (notes.dates && notes.dates[date]) {
                $(this).val(notes.dates[date]);
            }
        });
    }
    
    // 日付ごとの備考を保存
    function saveDateNotes() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const existingNotes = dataManager.getShiftNotes(year, month);
        
        const dateNotes = {};
        $('.date-note').each(function() {
            const date = $(this).data('date');
            const note = $(this).val().trim();
            if (note) {
                dateNotes[date] = note;
            }
        });
        
        const notes = {
            general: existingNotes.general || '',
            dates: dateNotes
        };
        
        dataManager.saveShiftNotes(year, month, notes);
    }
    
    // 備考保存
    function saveNotes() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const existingNotes = dataManager.getShiftNotes(year, month);
        
        const notes = { 
            general: $('#shift-notes').val(),
            dates: existingNotes.dates || {}
        };
        dataManager.saveShiftNotes(year, month, notes);
        showSuccess('備考を保存しました。');
    }
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 表示用日付フォーマット
    function formatDateForDisplay(dateString) {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayName = dayNames[date.getDay()];
        return `${month}月${day}日(${dayName})`;
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
        $('#shift-status').removeClass('alert-success alert-danger').addClass('alert-info').text(message).show();
    }
    
    // セル背景色スタイルを取得
    function getCellBackgroundStyle(colorCode) {
        const colors = {
            'orange': 'background-color: #fff3cd;',
            'yellow': 'background-color: #fffbf0;',
            'green': 'background-color: #d4edda;',
            'blue': 'background-color: #cce7ff;',
            'pink': 'background-color: #f8d7da;'
        };
        return colors[colorCode] || '';
    }
    
    // 出勤統計を表示
    function showAttendanceStats(type) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const companyInfo = dataManager.getCompanyInfo();
        
        // 統計計算期間の設定
        let startDate, endDate, title;
        
        if (type === 'month-end') {
            // 月初から月末まで
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
            title = `${year}年${month + 1}月の出勤統計（月初～月末）`;
        } else {
            // 月初から締め日まで
            const closingDate = companyInfo.closingDate || 'end-of-month';
            startDate = new Date(year, month, 1);
            
            if (closingDate === 'end-of-month') {
                endDate = new Date(year, month + 1, 0);
            } else {
                const closingDay = parseInt(closingDate);
                endDate = new Date(year, month, closingDay);
                // 締め日が月末を超える場合は月末まで
                const monthLastDay = new Date(year, month + 1, 0).getDate();
                if (closingDay > monthLastDay) {
                    endDate = new Date(year, month + 1, 0);
                }
            }
            
            const closingText = closingDate === 'end-of-month' ? '月末' : `${closingDate}日`;
            title = `${year}年${month + 1}月の出勤統計（月初～${closingText}）`;
        }
        
        // 従業員を並び順マスタに従って並び替え
        const orderedEmployees = getOrderedEmployees(employees);
        
        // 統計を計算
        const stats = calculateAttendanceStats(orderedEmployees, startDate, endDate);
        
        // 統計表を描画
        renderAttendanceStats(stats, title);
        
        // ボタンの状態を更新
        $('#show-month-end-stats, #show-closing-date-stats').removeClass('btn-primary').addClass('btn-secondary');
        $(`#show-${type}-stats`).removeClass('btn-secondary').addClass('btn-primary');
        
        // 統計エリアを表示
        $('#attendance-stats').show();
    }
    
    // 出勤統計を計算
    function calculateAttendanceStats(employees, startDate, endDate) {
        const stats = [];
        
        employees.forEach(employee => {
            let workDays = 0;
            let totalHours = 0;
            const workDetails = [];
            
            // 指定期間内の各日をチェック
            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
                const dateString = formatDate(date);
                const shift = currentShift[employee.code] ? currentShift[employee.code][dateString] : '';
                
                if (shift && shift !== '') {
                    workDays++;
                    const hours = calculateShiftHours(shift);
                    totalHours += hours;
                    
                    workDetails.push({
                        date: dateString,
                        shift: shift,
                        hours: hours
                    });
                }
            }
            
            stats.push({
                employee: employee,
                workDays: workDays,
                totalHours: totalHours,
                averageHours: workDays > 0 ? (totalHours / workDays) : 0,
                workDetails: workDetails
            });
        });
        
        return stats;
    }
    
    // シフト時間を計算（時間）
    function calculateShiftHours(shift) {
        if (!shift || shift === '') return 0;
        
        try {
            const [startTime, endTime] = shift.split('-');
            if (!startTime || !endTime) return 0;
            
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);
            
            return (endMinutes - startMinutes) / 60;
        } catch (error) {
            console.error('シフト時間計算エラー:', error);
            return 0;
        }
    }
    
    // 出勤統計表を描画
    function renderAttendanceStats(stats, title) {
        let html = `
            <h4 style="color: #2c3e50; margin-bottom: 20px;">${title}</h4>
            <table class="table" style="background: white; border-radius: 5px;">
                <thead>
                    <tr style="background-color: #34495e; color: white;">
                        <th style="min-width: 120px;">従業員名</th>
                        <th style="min-width: 80px;">出勤日数</th>
                        <th style="min-width: 100px;">総勤務時間</th>
                        <th style="min-width: 100px;">平均勤務時間</th>
                        <th style="min-width: 200px;">備考</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalWorkDays = 0;
        let totalWorkHours = 0;
        
        stats.forEach(stat => {
            totalWorkDays += stat.workDays;
            totalWorkHours += stat.totalHours;
            
            const averageHoursText = stat.averageHours > 0 ? stat.averageHours.toFixed(1) + '時間' : '-';
            
            html += `
                <tr>
                    <td style="font-weight: bold;">${stat.employee.name}</td>
                    <td style="text-align: center;">${stat.workDays}日</td>
                    <td style="text-align: center;">${stat.totalHours.toFixed(1)}時間</td>
                    <td style="text-align: center;">${averageHoursText}</td>
                    <td style="font-size: 12px;">
                        ${stat.workDays > 0 ? `最多勤務: ${getMaxShiftHours(stat.workDetails)}時間` : '出勤なし'}
                    </td>
                </tr>
            `;
        });
        
        // 合計行
        html += `
                <tr style="background-color: #ecf0f1; font-weight: bold;">
                    <td>合計</td>
                    <td style="text-align: center;">${totalWorkDays}日</td>
                    <td style="text-align: center;">${totalWorkHours.toFixed(1)}時間</td>
                    <td style="text-align: center;">-</td>
                    <td>従業員${stats.length}名</td>
                </tr>
            </tbody>
        </table>
        `;
        
        $('#attendance-stats').html(html);
    }
    
    // 最大勤務時間を取得
    function getMaxShiftHours(workDetails) {
        if (workDetails.length === 0) return 0;
        return Math.max(...workDetails.map(detail => detail.hours)).toFixed(1);
    }
    
    // シフト時間選択肢を時間帯マスタから生成
    function populateShiftTimeOptions() {
        const shiftConditions = dataManager.getShiftConditions();
        const timeSlots = shiftConditions.timeSlots || [];
        
        let optionsHtml = '<option value="">休み</option>';
        
        // 時間帯マスタから選択肢を生成
        timeSlots.forEach(timeSlot => {
            optionsHtml += `<option value="${timeSlot}">${timeSlot}</option>`;
        });
        
        // 「終日」オプションを追加
        optionsHtml += '<option value="終日">終日</option>';
        
        $('#edit-shift-time').html(optionsHtml);
    }
});