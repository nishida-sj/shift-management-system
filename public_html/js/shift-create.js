$(document).ready(function() {
    let currentDate = new Date();
    let employees = [];
    let eventMaster = [];
    let monthlyEvents = {};
    let currentShift = {};
    let shiftCellBackgrounds = {};
    let shiftStatus = 'draft';
    let editingCell = null;
    
    console.log('シフト作成: ページ読み込み開始');
    console.log('apiClient利用可能:', typeof apiClient !== 'undefined');
    console.log('dataConverter利用可能:', typeof dataConverter !== 'undefined');
    
    // 初期表示
    async function initialize() {
        await loadData();
        await renderShiftTable();
        updateStatusDisplay();
        loadNotes();
        loadShiftRequestsSidebar();
        loadShiftRequestsSidebar();
    }
    
    initialize();
    
    // 月移動ボタン
    $('#prev-month').on('click', async function() {
        await saveCurrentShift();
        currentDate.setMonth(currentDate.getMonth() - 1);
        await loadData();
        await renderShiftTable();
        updateStatusDisplay();
        loadNotes();
        loadShiftRequestsSidebar();
    });
    
    $('#next-month').on('click', async function() {
        await saveCurrentShift();
        currentDate.setMonth(currentDate.getMonth() + 1);
        await loadData();
        await renderShiftTable();
        updateStatusDisplay();
        loadNotes();
        loadShiftRequestsSidebar();
    });
    
    // 操作ボタン
    $('#auto-create-btn').on('click', function() {
        autoCreateShift();
    });
    
    $('#save-draft-btn').on('click', async function() {
        await saveCurrentShift();
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
    
    // Excelエクスポート
    $('#excel-export-btn').on('click', async function() {
        await exportToExcel();
    });
    
    // 備考保存
    $('#save-notes-btn').on('click', function() {
        saveNotes();
    });
    
    // 出勤統計ボタン
    $('#show-month-end-stats').on('click', async function() {
        await showAttendanceStats('month-end');
    });
    
    $('#show-closing-date-stats').on('click', async function() {
        await showAttendanceStats('closing-date');
    });
    
    // シフト編集モーダル
    $('#save-shift-edit-btn').on('click', async function() {
        await saveShiftEdit();
    });
    
    $('#cancel-shift-edit-btn').on('click', function() {
        closeShiftEditModal();
    });
    
    // データ読み込み
    async function loadData() {
        try {
            console.log('シフト作成: データ読み込み開始');
            
            // APIから従業員、行事マスタ、月間行事予定を取得
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const [apiEmployees, apiEvents, apiMonthlyEvents] = await Promise.all([
                apiClient.getEmployees(),
                apiClient.getEvents(),
                apiClient.getMonthlyEvents(year, month)
            ]);
            
            employees = apiEmployees.map(emp => dataConverter.employeeFromApi(emp));
            eventMaster = apiEvents.map(event => dataConverter.eventFromApi(event));
            
            // APIから取得した月間行事予定を変換
            monthlyEvents = convertMonthlyEventsFromApi(apiMonthlyEvents);
            
            console.log('シフト作成: 取得した従業員数:', employees.length);
            console.log('シフト作成: 取得した行事数:', eventMaster.length);
            console.log('シフト作成: 取得した月間行事予定:', Object.keys(monthlyEvents).length);
            
            // APIから確定シフトと状態を取得
            const [apiShifts, apiStatus] = await Promise.all([
                apiClient.getConfirmedShifts(year, month).catch(() => []),
                apiClient.getShiftStatus(year, month).catch(() => ({ is_confirmed: 0 }))
            ]);
            
            console.log('シフト作成: API確定シフトデータ:', apiShifts);
            console.log('シフト作成: APIシフト状態:', apiStatus);
            
            // 確定シフトデータをローカル形式に変換
            currentShift = {};
            if (apiShifts && Array.isArray(apiShifts)) {
                apiShifts.forEach(shift => {
                    // ネストした構造で格納: currentShift[employeeCode][dateString] = "timeStart-timeEnd"
                    if (!currentShift[shift.employee_code]) {
                        currentShift[shift.employee_code] = {};
                    }
                    
                    // 日付文字列を生成 (YYYY-MM-DD形式)
                    const dateString = `${shift.year}-${String(shift.month).padStart(2, '0')}-${String(shift.day).padStart(2, '0')}`;
                    
                    // 時間範囲文字列を生成 (HH:MM-HH:MM形式)
                    const timeStart = shift.time_start.substring(0, 5); // HH:MM:SS -> HH:MM
                    const timeEnd = shift.time_end.substring(0, 5);     // HH:MM:SS -> HH:MM
                    currentShift[shift.employee_code][dateString] = `${timeStart}-${timeEnd}`;
                    
                    console.log(`シフト作成: 設定 ${shift.employee_code}[${dateString}] = "${timeStart}-${timeEnd}"`);
                });
            }
            
            // シフト状態を変換
            shiftStatus = apiStatus.is_confirmed === 1 ? 'confirmed' : 'draft';
            
            console.log('シフト作成: 変換後currentShift:', currentShift);
            console.log('シフト作成: 変換後shiftStatus:', shiftStatus);
            
            // 空のシフトデータを初期化
            if (Object.keys(currentShift).length === 0) {
                initializeEmptyShift();
            }
            
            // セル背景色データを読み込み
            shiftCellBackgrounds = dataManager.getShiftCellBackgrounds(year, month);
            
        } catch (error) {
            console.error('シフト作成: データ取得エラー:', error);
            
            // エラー時はフォールバック
            employees = dataManager.getEmployees();
            eventMaster = dataManager.getEvents();
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            // エラー時はlocalStorageからフォールバック
            monthlyEvents = dataManager.getMonthlyEvents(year, month);
            currentShift = dataManager.getConfirmedShift(year, month);
            shiftStatus = dataManager.getShiftStatus(year, month);
            
            if (Object.keys(currentShift).length === 0) {
                initializeEmptyShift();
            }
            
            shiftCellBackgrounds = dataManager.getShiftCellBackgrounds(year, month);
            
            showError('データ取得に失敗しました。ローカルデータを使用します。');
        }
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
    async function saveCurrentShift() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        try {
            // APIに保存（確定シフトデータをAPI形式に変換）
            const apiShifts = [];
            Object.keys(currentShift).forEach(employeeCode => {
                const employeeShifts = currentShift[employeeCode];
                Object.keys(employeeShifts).forEach(dateString => {
                    const timeRange = employeeShifts[dateString];
                    if (timeRange && timeRange.includes('-')) {
                        const [yearStr, monthStr, dayStr] = dateString.split('-');
                        const day = parseInt(dayStr);
                        const [timeStart, timeEnd] = timeRange.split('-');
                        
                        apiShifts.push({
                            employee_code: employeeCode,
                            year: year,
                            month: month,
                            day: day,
                            time_start: timeStart + ':00',
                            time_end: timeEnd + ':00',
                            business_type: '事務',
                            is_violation: 0
                        });
                    }
                });
            });
            
            console.log('シフト保存: APIに保存するデータ:', apiShifts);
            await apiClient.saveConfirmedShifts(year, month, apiShifts);
            console.log('シフト保存: API保存完了');
            
        } catch (error) {
            console.error('シフト保存: API保存エラー:', error);
            // エラー時はローカルストレージにフォールバック
        }
        
        // ローカルストレージにも保存（バックアップ・後方互換性）
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
    async function renderShiftTable() {
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
        const orderedEmployees = await getOrderedEmployees(employees);
        console.log('shift-create: renderShiftTable - 並び替え後の従業員順序:', orderedEmployees.map(emp => emp.name));
        
        // ヘッダー行（従業員名）
        tableHtml += '<thead><tr><th style="min-width: 120px;">日付・行事</th><th style="min-width: 100px;">備考</th>';
        orderedEmployees.forEach((employee, index) => {
            tableHtml += `<th style="min-width: 80px;">${employee.name}</th>`;
            console.log(`shift-create: ヘッダー${index + 1}: ${employee.name}`);
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
                
                // 条件違反チェック（同期版を使用）
                const isViolation = checkShiftViolationSync(employee, dateString, shift);
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
        $('.shift-cell').on('click', async function() {
            if (shiftStatus === 'confirmed') {
                showError('確定済みのシフトは編集できません。確定解除してから編集してください。');
                return;
            }
            
            const employeeCode = $(this).data('employee');
            const date = $(this).data('date');
            await openShiftEditModal(employeeCode, date);
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
    async function checkShiftViolation(employee, dateString, shift) {
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
        // 注意: この関数は個別のセル編集時に呼ばれるため、リアルタイムでAPI取得する
        // 将来的にはキャッシュ機構を検討
        let requests = {};
        try {
            const apiRequests = await apiClient.getShiftRequests(employee.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
            requests = dataConverter.requestsFromApi(apiRequests);
        } catch (error) {
            // エラー時はlocalStorageからフォールバック
            requests = dataManager.getEmployeeRequests(employee.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
        }
        
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
    
    // 月間行事予定のAPI形式をlocalStorage形式に変換
    function convertMonthlyEventsFromApi(apiMonthlyEvents) {
        console.log('月間行事予定API変換:', apiMonthlyEvents);
        
        // APIレスポンスが既に日付をキーとした連想配列になっている
        const converted = {};
        Object.keys(apiMonthlyEvents).forEach(dateKey => {
            const eventData = apiMonthlyEvents[dateKey];
            converted[dateKey] = eventData.event_id;
        });
        
        console.log('変換結果:', converted);
        return converted;
    }
    
    // シフト条件違反チェック（同期版 - 表描画用）
    function checkShiftViolationSync(employee, dateString, shift) {
        if (!shift) return false;
        
        // シフト条件設定を取得
        const shiftConditions = dataManager.getShiftConditions();
        if (!shiftConditions || !shiftConditions.warnings) {
            return false; // 設定がない場合は警告を表示しない
        }
        
        const date = new Date(dateString);
        const dayOfWeek = date.getDay();
        
        // 従業員の勤務条件違反チェック
        if (shiftConditions.warnings.warnConditionViolation) {
            // 曜日別出勤可能時間チェック
            if (!employee.conditions.weeklySchedule || !employee.conditions.weeklySchedule[dayOfWeek]) {
                return true; // その曜日は出勤不可
            }
            
            // 「終日」が設定されている場合はどの時間帯でもOK
            if (employee.conditions.weeklySchedule[dayOfWeek].includes('終日')) {
                return false;
            }
            
            // 時間範囲包含チェック（固定時間帯）
            const daySchedule = employee.conditions.weeklySchedule[dayOfWeek];
            for (const availableTime of daySchedule) {
                if (availableTime === '終日') continue;
                
                if (isTimeRangeIncluded(shift, availableTime)) {
                    return false; // 範囲内なので条件違反ではない
                }
            }
            
            // 従業員の時間帯希望チェック（localStorageのみ - 同期処理）
            const requests = dataManager.getEmployeeRequests(employee.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
            const employeePreference = requests[dateString];
            
            if (employeePreference && employeePreference !== 'off' && employeePreference !== '') {
                // カスタム時間帯の場合、重複チェック
                if (isTimeOverlap(employeePreference, shift)) {
                    return false; // 希望時間帯と重複していれば問題なし
                }
            }
            
            // 条件に合わない場合は警告
            return true;
        }
        
        // 連続勤務日数チェック
        if (shiftConditions.warnings.warnConsecutiveWork) {
            const consecutiveDays = calculateConsecutiveWorkDays(employee.code, dateString);
            const maxConsecutive = shiftConditions.basicSettings?.maxConsecutiveDays || 6;
            if (consecutiveDays > maxConsecutive) {
                return true;
            }
        }
        
        // 休憩時間不足チェック
        if (shiftConditions.warnings.warnInsufficientRest) {
            const hasInsufficientRest = checkInsufficientRest(employee.code, dateString, shift, shiftConditions);
            if (hasInsufficientRest) {
                return true;
            }
        }
        
        return false;
    }
    
    // 連続勤務日数を計算
    function calculateConsecutiveWorkDays(employeeCode, targetDateString) {
        let consecutiveDays = 0;
        const targetDate = new Date(targetDateString);
        
        // 過去方向に連続勤務日数をカウント
        for (let i = 0; i < 10; i++) { // 最大10日まで遡る
            const checkDate = new Date(targetDate);
            checkDate.setDate(targetDate.getDate() - i);
            const checkDateString = formatDate(checkDate);
            
            if (currentShift[employeeCode] && currentShift[employeeCode][checkDateString]) {
                consecutiveDays++;
            } else {
                break;
            }
        }
        
        return consecutiveDays;
    }
    
    // 休憩時間不足チェック
    function checkInsufficientRest(employeeCode, dateString, shift, shiftConditions) {
        const minRestHours = shiftConditions.basicSettings?.minRestHours || 1;
        const date = new Date(dateString);
        
        // 前日と翌日のシフトをチェック
        const prevDate = new Date(date);
        prevDate.setDate(date.getDate() - 1);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        
        const prevDateString = formatDate(prevDate);
        const nextDateString = formatDate(nextDate);
        
        const prevShift = currentShift[employeeCode]?.[prevDateString];
        const nextShift = currentShift[employeeCode]?.[nextDateString];
        
        // 簡略化した休憩時間チェック（実際の業務要件に応じて調整）
        if (prevShift && shift) {
            const prevEndTime = prevShift.split('-')[1];
            const currentStartTime = shift.split('-')[0];
            if (prevEndTime && currentStartTime) {
                const restHours = calculateRestHours(prevEndTime, currentStartTime);
                if (restHours < minRestHours) {
                    return true;
                }
            }
        }
        
        if (shift && nextShift) {
            const currentEndTime = shift.split('-')[1];
            const nextStartTime = nextShift.split('-')[0];
            if (currentEndTime && nextStartTime) {
                const restHours = calculateRestHours(currentEndTime, nextStartTime);
                if (restHours < minRestHours) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // 休憩時間を計算
    function calculateRestHours(endTime, startTime) {
        const endMinutes = timeToMinutes(endTime);
        const startMinutes = timeToMinutes(startTime);
        
        // 翌日開始の場合を考慮（24時間を加算）
        const restMinutes = startMinutes >= endMinutes ? 
            startMinutes - endMinutes : 
            (24 * 60 + startMinutes) - endMinutes;
        
        return restMinutes / 60;
    }
    
    // シフト自動作成
    async function autoCreateShift() {
        if (!confirm('現在のシフトデータを削除して自動作成しますか？')) {
            return;
        }
        
        showInfo('シフトを自動作成中...');
        
        try {
            // シフト条件設定を取得
            const shiftConditions = dataManager.getShiftConditions();
            console.log('シフト条件設定:', shiftConditions);
            
            // 条件設定チェック
            if (!validateShiftConditions(shiftConditions)) {
                showError('シフト条件設定が正しく読み込めませんでした。');
                return;
            }
            
            // 初期化
            initializeEmptyShift();
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();
            
            // 従業員の勤務時間統計初期化
            const workStats = initializeWorkStats();
            
            let successCount = 0;
            let skipCount = 0;
            
            // 各日ごとに処理
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month, day);
                const dateString = formatDate(date);
                const dayOfWeek = date.getDay();
                
                // 行事情報を取得
                const eventId = monthlyEvents[dateString];
                if (!eventId) {
                    console.log(`${dateString}: 行事予定なし、スキップ`);
                    continue;
                }
                
                const event = eventMaster.find(e => e.id === eventId);
                if (!event) {
                    console.log(`${dateString}: 行事ID ${eventId} が見つかりません、スキップ`);
                    continue;
                }
                
                console.log(`${dateString}: ${event.name} のシフト作成開始`);
                
                // この日のシフト作成を試行
                const dayResult = await createDayShiftAdvanced(
                    employees, dateString, event, dayOfWeek, shiftConditions, workStats
                );
                
                if (dayResult) {
                    successCount++;
                    console.log(`${dateString}: シフト作成成功`);
                } else {
                    skipCount++;
                    console.log(`${dateString}: 条件が合わず、スキップ`);
                }
            }
            
            await renderShiftTable();
            await saveCurrentShift();
            
            showSuccess(`シフト自動作成完了: ${successCount}日作成、${skipCount}日スキップ`);
            
        } catch (error) {
            console.error('シフト自動作成エラー:', error);
            showError('シフト自動作成に失敗しました: ' + error.message);
        }
    }
    
    // シフト条件設定の検証
    function validateShiftConditions(conditions) {
        return conditions && 
               conditions.priorities && 
               conditions.warnings && 
               conditions.basicSettings &&
               Array.isArray(conditions.timeSlots);
    }
    
    // 勤務統計の初期化
    function initializeWorkStats() {
        const stats = {};
        employees.forEach(emp => {
            stats[emp.code] = {
                totalHours: 0,
                totalDays: 0,
                consecutiveDays: 0,
                lastWorkDate: null
            };
        });
        return stats;
    }
    
    // 高度な1日のシフト作成（要件に基づく）
    async function createDayShiftAdvanced(employees, dateString, event, dayOfWeek, shiftConditions, workStats) {
        console.log(`=== ${dateString} のシフト作成開始 ===`);
        
        // シフト希望データを事前に取得
        const shiftRequests = {};
        for (const emp of employees) {
            try {
                const apiRequests = await apiClient.getShiftRequests(emp.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
                shiftRequests[emp.code] = dataConverter.requestsFromApi(apiRequests);
            } catch (error) {
                shiftRequests[emp.code] = dataManager.getEmployeeRequests(emp.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
            }
        }
        
        // 条件設定に基づく利用可能従業員の絞り込み
        console.log(`=== ${dateString} 利用可能従業員の絞り込み開始 ===`);
        console.log(`総従業員数: ${employees.length}`);
        
        const availableEmployees = filterAvailableEmployees(employees, dateString, dayOfWeek, shiftRequests, shiftConditions);
        
        console.log(`利用可能従業員数: ${availableEmployees.length}/${employees.length}`);
        
        if (availableEmployees.length === 0) {
            console.log('❌ 利用可能な従業員がいません');
            return false;
        }
        
        console.log(`✅ 利用可能従業員: ${availableEmployees.map(e => e.name).join(', ')}`);
        
        let assigned = false;
        
        // 各業務区分の要件を構築順で処理
        console.log(`=== ${dateString} 要件処理開始 ===`);
        console.log(`行事要件:`, JSON.stringify(event.requirements, null, 2));
        
        if (event.requirements) {
            // 業務区分マスタを取得
            const businessTypes = dataManager.getBusinessTypes();
            
            // 業務区分を構築順でソート
            const sortedBusinessTypeCodes = Object.keys(event.requirements).sort((a, b) => {
                const btA = businessTypes.find(bt => bt.code === a);
                const btB = businessTypes.find(bt => bt.code === b);
                
                const orderA = btA?.buildOrder || 999;
                const orderB = btB?.buildOrder || 999;
                
                return orderA - orderB;
            });
            
            console.log(`業務区分処理順序:`, sortedBusinessTypeCodes);
            
            sortedBusinessTypeCodes.forEach(businessTypeCode => {
                const requirements = event.requirements[businessTypeCode];
                const businessType = businessTypes.find(bt => bt.code === businessTypeCode);
                const buildOrder = businessType?.buildOrder || 999;
                
                console.log(`\n--- 業務区分: ${businessType?.name || businessTypeCode} (構築順: ${buildOrder}) ---`);
                
                requirements.forEach((req, reqIndex) => {
                    const requiredTime = req.time;
                    const requiredCount = req.count;
                    
                    console.log(`📋 要件 ${reqIndex + 1}: ${businessTypeCode} ${requiredTime} ${requiredCount}人必要`);
                    
                    // Step1: メイン業務として該当する従業員を優先取得
                    const mainEmployees = availableEmployees.filter(emp => {
                        // 既に配置済みでないかチェック
                        if (currentShift[emp.code][dateString]) {
                            return false;
                        }
                        // メイン業務区分チェック
                        return emp.businessTypes && emp.businessTypes.some(bt => 
                            bt.code === businessTypeCode && bt.isMain === true
                        );
                    });
                    
                    console.log(`  メイン従業員数: ${mainEmployees.length}人`);
                    console.log(`  メイン従業員: ${mainEmployees.map(e => e.name).join(', ') || 'なし'}`);
                    
                    let assignedCount = 0;
                    
                    // メイン業務従業員を優先配置
                    if (mainEmployees.length > 0) {
                        const sortedMainEmployees = sortEmployeesByPriority(
                            mainEmployees, businessTypeCode, dateString, 
                            shiftRequests, workStats, shiftConditions
                        );
                        
                        for (const emp of sortedMainEmployees) {
                            if (assignedCount >= requiredCount) break;
                            
                            console.log(`  🔍 ${emp.name}(メイン) の配置可能性をチェック中...`);
                            
                            if (canAssignEmployee(emp, dateString, requiredTime, shiftRequests, shiftConditions)) {
                                currentShift[emp.code][dateString] = requiredTime;
                                updateWorkStats(workStats, emp.code, dateString, requiredTime);
                                assignedCount++;
                                assigned = true;
                                
                                console.log(`  ✅ ${emp.name}(メイン) を ${requiredTime} に配置 (${assignedCount}/${requiredCount})`);
                            } else {
                                console.log(`  ❌ ${emp.name}(メイン) は配置不可`);
                            }
                        }
                    }
                    
                    // Step2: 不足分をサブ業務従業員で補完
                    if (assignedCount < requiredCount) {
                        const subEmployees = availableEmployees.filter(emp => {
                            // 既に配置済みでないかチェック
                            if (currentShift[emp.code][dateString]) {
                                return false;
                            }
                            // サブ業務区分チェック
                            return emp.businessTypes && emp.businessTypes.some(bt => 
                                bt.code === businessTypeCode && bt.isMain !== true
                            );
                        });
                        
                        console.log(`  サブ従業員数: ${subEmployees.length}人`);
                        console.log(`  サブ従業員: ${subEmployees.map(e => e.name).join(', ') || 'なし'}`);
                        
                        if (subEmployees.length > 0) {
                            const sortedSubEmployees = sortEmployeesByPriority(
                                subEmployees, businessTypeCode, dateString, 
                                shiftRequests, workStats, shiftConditions
                            );
                            
                            for (const emp of sortedSubEmployees) {
                                if (assignedCount >= requiredCount) break;
                                
                                console.log(`  🔍 ${emp.name}(サブ) の配置可能性をチェック中...`);
                                
                                if (canAssignEmployee(emp, dateString, requiredTime, shiftRequests, shiftConditions)) {
                                    currentShift[emp.code][dateString] = requiredTime;
                                    updateWorkStats(workStats, emp.code, dateString, requiredTime);
                                    assignedCount++;
                                    assigned = true;
                                    
                                    console.log(`  ✅ ${emp.name}(サブ) を ${requiredTime} に配置 (${assignedCount}/${requiredCount})`);
                                } else {
                                    console.log(`  ❌ ${emp.name}(サブ) は配置不可`);
                                }
                            }
                        }
                    }
                    
                    if (assignedCount < requiredCount) {
                        console.log(`  ⚠️ ${businessTypeCode} ${requiredTime}: 必要${requiredCount}人, 配置${assignedCount}人 (${requiredCount - assignedCount}人不足)`);
                    } else {
                        console.log(`  ✅ ${businessTypeCode} ${requiredTime}: 必要${requiredCount}人, 配置${assignedCount}人 (充足)`);
                    }
                });
            });
        }
        
        return assigned;
    }
    
    // 条件に基づく利用可能従業員の絞り込み
    function filterAvailableEmployees(employees, dateString, dayOfWeek, shiftRequests, shiftConditions) {
        console.log(`--- 従業員フィルタリング開始 (曜日: ${dayOfWeek}) ---`);
        
        return employees.filter(emp => {
            console.log(`🔍 ${emp.name} のチェック開始:`);
            
            // 曜日別出勤可能時間チェック
            if (!emp.conditions.weeklySchedule || !emp.conditions.weeklySchedule[dayOfWeek]) {
                console.log(`  ❌ ${emp.name}: 曜日${dayOfWeek}の勤務時間設定なし`);
                return false;
            }
            
            const daySchedule = emp.conditions.weeklySchedule[dayOfWeek];
            console.log(`  ✅ ${emp.name}: 曜日${dayOfWeek}の勤務可能時間 = ${JSON.stringify(daySchedule)}`);
            
            // 休み希望チェック（条件設定で有効な場合）
            if (shiftConditions.priorities.respectOffRequests) {
                const requests = shiftRequests[emp.code] || {};
                if (requests[dateString] === 'off') {
                    console.log(`  ❌ ${emp.name}: ${dateString} に休み希望`);
                    return false;
                }
                console.log(`  ✅ ${emp.name}: 休み希望なし (希望: "${requests[dateString] || '設定なし'}")`);
            }
            
            // 週最大労働日数チェック
            if (emp.conditions.maxDaysPerWeek) {
                const weekStart = getWeekStart(new Date(dateString));
                const weekWorkDays = countWeekWorkDays(emp.code, weekStart);
                if (weekWorkDays >= emp.conditions.maxDaysPerWeek) {
                    console.log(`  ❌ ${emp.name}: 週最大労働日数 ${emp.conditions.maxDaysPerWeek} 日を超過 (現在: ${weekWorkDays}日)`);
                    return false;
                }
                console.log(`  ✅ ${emp.name}: 週労働日数OK (${weekWorkDays}/${emp.conditions.maxDaysPerWeek}日)`);
            }
            
            console.log(`  ✅ ${emp.name}: 全条件クリア - 利用可能`);
            return true;
        });
    }
    
    // 従業員を優先順位でソート
    function sortEmployeesByPriority(employees, businessTypeCode, dateString, shiftRequests, workStats, shiftConditions) {
        return employees.sort((a, b) => {
            let scoreA = 0, scoreB = 0;
            
            // シフト優先区分を最優先で処理（勤務時間均等化より優先）
            if (a.shiftPriority) scoreA += 1000;
            if (b.shiftPriority) scoreB += 1000;
            
            // メイン業務区分優先
            if (shiftConditions.priorities.prioritizeMainBusiness) {
                if (hasMainBusinessType(a, businessTypeCode)) scoreA += 100;
                if (hasMainBusinessType(b, businessTypeCode)) scoreB += 100;
            }
            
            // 勤務時間均等化（シフト優先区分でない従業員のみに適用）
            if (shiftConditions.priorities.balanceWorkload) {
                const hoursA = workStats[a.code]?.totalHours || 0;
                const hoursB = workStats[b.code]?.totalHours || 0;
                
                // シフト優先区分の従業員は勤務時間均等化の影響を受けない
                if (!a.shiftPriority) scoreA += (50 - hoursA);
                if (!b.shiftPriority) scoreB += (50 - hoursB);
            }
            
            // 時間帯希望考慮（この段階では基本的な適合性のみ）
            if (shiftConditions.priorities.respectTimePreferences) {
                const requestsA = shiftRequests[a.code] || {};
                const requestsB = shiftRequests[b.code] || {};
                
                if (requestsA[dateString] && requestsA[dateString] !== 'off') scoreA += 20;
                if (requestsB[dateString] && requestsB[dateString] !== 'off') scoreB += 20;
            }
            
            console.log(`優先順位計算: ${a.name}(${scoreA}) vs ${b.name}(${scoreB}) [優先区分: ${a.shiftPriority}/${b.shiftPriority}]`);
            
            return scoreB - scoreA; // 降順
        });
    }
    
    // 従業員を特定の時間帯に配置可能かチェック
    function canAssignEmployee(employee, dateString, requiredTime, shiftRequests, shiftConditions) {
        const date = new Date(dateString);
        const dayOfWeek = date.getDay();
        
        // 曜日別出勤可能時間チェック
        if (!employee.conditions.weeklySchedule || !employee.conditions.weeklySchedule[dayOfWeek]) {
            console.log(`${employee.name}: 曜日${dayOfWeek}の勤務時間設定なし`);
            return false;
        }
        
        const daySchedule = employee.conditions.weeklySchedule[dayOfWeek];
        console.log(`${employee.name}: 曜日${dayOfWeek}の勤務可能時間 = ${JSON.stringify(daySchedule)}`);
        
        // 「終日」設定チェック
        if (daySchedule.includes('終日')) {
            console.log(`${employee.name}: 終日設定あり → OK`);
            return true;
        }
        
        // 時間範囲包含チェック（固定時間帯）
        for (const availableTime of daySchedule) {
            if (availableTime === '終日') continue;
            
            if (isTimeRangeIncluded(requiredTime, availableTime)) {
                console.log(`${employee.name}: ${requiredTime} が ${availableTime} に含まれる → OK`);
                return true;
            }
        }
        
        // 時間帯希望チェック（条件設定で有効な場合）
        if (shiftConditions.priorities.respectTimePreferences) {
            const requests = shiftRequests[employee.code] || {};
            const employeePreference = requests[dateString];
            
            if (employeePreference && employeePreference !== 'off' && employeePreference !== '') {
                if (isTimeOverlap(employeePreference, requiredTime)) {
                    console.log(`${employee.name}: 希望時間帯 ${employeePreference} と ${requiredTime} が重複 → OK`);
                    return true;
                }
            }
        }
        
        console.log(`${employee.name}: ${requiredTime} は利用可能時間に含まれない → NG`);
        return false;
    }
    
    // 勤務統計を更新
    function updateWorkStats(workStats, employeeCode, dateString, shift) {
        if (!workStats[employeeCode]) return;
        
        const hours = calculateShiftHours(shift);
        workStats[employeeCode].totalHours += hours;
        workStats[employeeCode].totalDays += 1;
        workStats[employeeCode].lastWorkDate = dateString;
        
        // 連続勤務日数の更新ロジックは簡略化（必要に応じて拡張）
    }
    
    // 週の開始日を取得（月曜日）
    function getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を週開始とする
        return new Date(d.setDate(diff));
    }
    
    // 週の勤務日数をカウント
    function countWeekWorkDays(employeeCode, weekStart) {
        let count = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateString = formatDate(date);
            
            if (currentShift[employeeCode] && currentShift[employeeCode][dateString]) {
                count++;
            }
        }
        return count;
    }
    
    // 1日のシフト作成（メイン業務優先ロジック）
    async function createDayShift(employees, dateString, event, dayOfWeek) {
        // シフト希望データを事前に取得
        const shiftRequests = {};
        console.log('=== 全従業員のシフト希望データ取得開始 ===');
        for (const emp of employees) {
            try {
                console.log(`🔍 従業員 ${emp.name} (${emp.code}) のシフト希望を取得中...`);
                const apiRequests = await apiClient.getShiftRequests(emp.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
                console.log(`API生データ (${emp.code}):`, apiRequests);
                
                shiftRequests[emp.code] = dataConverter.requestsFromApi(apiRequests);
                console.log(`変換後データ (${emp.code}):`, shiftRequests[emp.code]);
                
                // 休み希望をハイライト
                const offDays = Object.keys(shiftRequests[emp.code]).filter(date => shiftRequests[emp.code][date] === 'off');
                if (offDays.length > 0) {
                    console.log(`📅 ${emp.name} の休み希望: ${offDays.join(', ')}`);
                } else {
                    console.log(`📅 ${emp.name}: 休み希望なし`);
                }
            } catch (error) {
                console.error(`❌ 従業員 ${emp.code} のシフト希望取得エラー:`, error);
                // エラー時はlocalStorageからフォールバック
                shiftRequests[emp.code] = dataManager.getEmployeeRequests(emp.code, currentDate.getFullYear(), currentDate.getMonth() + 1);
                console.log(`フォールバック (${emp.code}):`, shiftRequests[emp.code]);
            }
        }
        console.log('=== 全従業員のシフト希望データ取得完了 ===');
        
        // 利用可能な従業員を取得
        const availableEmployees = employees.filter(emp => {
            // 曜日別出勤可能時間チェック
            if (!emp.conditions.weeklySchedule || !emp.conditions.weeklySchedule[dayOfWeek]) {
                return false;
            }
            
            // 休み希望チェック
            const requests = shiftRequests[emp.code] || {};
            if (requests[dateString] === 'off') {
                console.log(`従業員 ${emp.name} は ${dateString} に休み希望`);
                return false;
            }
            
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
                    canWorkAtTime(emp, dayOfWeek, requiredTime, dateString, shiftRequests) &&
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
                        canWorkAtTime(emp, dayOfWeek, requiredTime, dateString, shiftRequests) &&
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
    function canWorkAtTime(employee, dayOfWeek, requiredTime, dateString, shiftRequests) {
        console.log(`🔍 canWorkAtTime: ${employee.name} の ${dateString} ${requiredTime} 勤務可能性チェック`);
        
        // 休み希望チェック（最重要）
        const requests = shiftRequests[employee.code] || {};
        const employeeRequest = requests[dateString];
        
        if (employeeRequest === 'off') {
            console.log(`  ❌ ${employee.name}: ${dateString} に休み希望あり`);
            return false;
        }
        
        // 曜日別出勤可能時間をチェック
        if (!employee.conditions.weeklySchedule || !employee.conditions.weeklySchedule[dayOfWeek]) {
            console.log(`  ❌ ${employee.name}: 曜日${dayOfWeek}の勤務時間設定なし`);
            return false;
        }
        
        const daySchedule = employee.conditions.weeklySchedule[dayOfWeek];
        
        // 「終日」が設定されている場合はどの時間帯でもOK
        if (daySchedule.includes('終日')) {
            console.log(`  ✅ ${employee.name}: 終日設定あり → OK`);
            return true;
        }
        
        // 時間範囲包含チェック（固定時間帯）
        for (const availableTime of daySchedule) {
            if (availableTime === '終日') continue;
            
            if (isTimeRangeIncluded(requiredTime, availableTime)) {
                console.log(`  ✅ ${employee.name}: ${requiredTime} が ${availableTime} に含まれる → OK`);
                return true;
            }
        }
        
        // 従業員の時間帯希望をチェック（カスタム希望時間帯）
        console.log(`  🔍 ${employee.name}: カスタム時間帯希望をチェック "${employeeRequest || '設定なし'}"`);
        
        if (employeeRequest && employeeRequest !== 'off' && employeeRequest !== '') {
            console.log(`  🔍 ${employee.name}: カスタム希望 "${employeeRequest}" と要求 "${requiredTime}" の重複チェック`);
            
            // カスタム時間帯の場合、重複チェック
            if (isTimeOverlap(employeeRequest, requiredTime)) {
                console.log(`  ✅ ${employee.name}: カスタム希望と要求時間が重複 → OK`);
                return true;
            } else {
                console.log(`  ❌ ${employee.name}: カスタム希望と要求時間が重複しない`);
            }
        }
        
        console.log(`  ❌ ${employee.name}: すべての条件を満たさない → NG`);
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
    
    // 時間範囲が包含されるかチェック（requiredTimeがavailableTime内に完全に含まれるか）
    function isTimeRangeIncluded(requiredTime, availableTime) {
        try {
            const [reqStart, reqEnd] = requiredTime.split('-').map(t => timeToMinutes(t));
            const [availStart, availEnd] = availableTime.split('-').map(t => timeToMinutes(t));
            
            // 包含判定：必要時間の開始が利用可能時間の開始以降で、必要時間の終了が利用可能時間の終了以前
            return reqStart >= availStart && reqEnd <= availEnd;
        } catch (error) {
            console.error('時間範囲包含チェックエラー:', error);
            return false;
        }
    }
    
    // 時間を分に変換
    function timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 従業員を統一並び順マスタに従って並び替え
    async function getOrderedEmployees(employees) {
        try {
            console.log('shift-create: getOrderedEmployees開始');
            console.log('shift-create: 入力従業員数:', employees.length);
            
            // APIから最新の並び順を取得
            const employeeOrders = await apiClient.getEmployeeOrders();
            console.log('shift-create: 取得した並び順データ:', employeeOrders);
            
            const orderedEmployees = [];
            const usedEmployees = new Set();
            
            // 統一並び順がある場合は使用
            if (employeeOrders && employeeOrders.unified && Array.isArray(employeeOrders.unified)) {
                console.log('shift-create: 統一並び順を使用:', employeeOrders.unified);
                
                employeeOrders.unified.forEach(empCode => {
                    const employee = employees.find(emp => emp.code === empCode);
                    if (employee && !usedEmployees.has(empCode)) {
                        orderedEmployees.push(employee);
                        usedEmployees.add(empCode);
                        console.log(`shift-create: 並び順追加: ${empCode} -> ${employee.name}`);
                    } else {
                        console.log(`shift-create: 従業員が見つからないかすでに追加済み: ${empCode}`);
                    }
                });
            } else {
                console.log('shift-create: 統一並び順が見つかりません、デフォルト順序を使用');
            }
            
            // 並び順が設定されていない従業員をデフォルト順序で追加
            employees.forEach(employee => {
                if (!usedEmployees.has(employee.code)) {
                    orderedEmployees.push(employee);
                    console.log(`shift-create: デフォルト追加: ${employee.code} -> ${employee.name}`);
                }
            });
            
            console.log('shift-create: 最終並び順:', orderedEmployees.map(emp => `${emp.code}:${emp.name}`));
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
    async function openShiftEditModal(employeeCode, date) {
        const employee = employees.find(emp => emp.code === employeeCode);
        const currentShiftTime = currentShift[employeeCode] ? currentShift[employeeCode][date] : '';
        const currentBgColor = shiftCellBackgrounds[employeeCode] ? shiftCellBackgrounds[employeeCode][date] : '';
        
        $('#edit-employee-name').text(employee.name);
        $('#edit-date').text(formatDateForDisplay(date));
        
        // 時間帯マスタから選択肢を生成
        await populateShiftTimeOptions();
        
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
        $('#edit-shift-time').on('change', async function() {
            const newShift = $(this).val();
            if (!newShift) {
                $('#warning-message').hide();
                return;
            }
            
            const employee = employees.find(emp => emp.code === editingCell.employeeCode);
            const isViolation = await checkShiftViolation(employee, editingCell.date, newShift);
            
            if (isViolation) {
                $('#warning-message').text('この設定は従業員の条件に合いません。保存しても赤字で表示されます。').show();
            } else {
                $('#warning-message').hide();
            }
        });
    }
    
    // シフト編集保存
    async function saveShiftEdit() {
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
        
        await renderShiftTable();
        closeShiftEditModal();
        showSuccess('シフトを更新しました。');
    }
    
    // シフト確定
    async function confirmShift() {
        if (!confirm('シフトを確定しますか？確定後は個別修正ができなくなります。')) {
            return;
        }
        
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            console.log('シフト確定: 開始', { year, month });
            console.log('シフト確定: currentShiftの内容:', currentShift);
            console.log('シフト確定: currentShiftのキー数:', Object.keys(currentShift).length);
            console.log('シフト確定: currentShiftのキー一覧:', Object.keys(currentShift));
            
            // 確定シフトデータをAPI形式に変換
            const apiShifts = [];
            Object.keys(currentShift).forEach((employeeCode, empIndex) => {
                const employeeShifts = currentShift[employeeCode];
                console.log(`シフト確定: 従業員${empIndex + 1} "${employeeCode}"のシフト:`, employeeShifts);
                
                Object.keys(employeeShifts).forEach((dateString, dateIndex) => {
                    const timeRange = employeeShifts[dateString];
                    console.log(`シフト確定: 日付${dateIndex + 1} "${dateString}" = "${timeRange}"`);
                    
                    if (timeRange && timeRange.includes('-')) {
                        // 日付文字列から年月日を抽出
                        const [yearStr, monthStr, dayStr] = dateString.split('-');
                        const day = parseInt(dayStr);
                        
                        // 時間範囲を分割
                        const [timeStart, timeEnd] = timeRange.split('-');
                        
                        // APIデータ形式に変換
                        const apiShift = {
                            employee_code: employeeCode,
                            year: year,
                            month: month,
                            day: day,
                            time_start: timeStart + ':00', // HH:MM:SS形式に
                            time_end: timeEnd + ':00',     // HH:MM:SS形式に
                            business_type: '事務', // デフォルト値
                            is_violation: 0 // デフォルト値
                        };
                        
                        apiShifts.push(apiShift);
                        console.log(`シフト確定: APIデータに追加:`, apiShift);
                    } else {
                        console.warn(`シフト確定: 日付 "${dateString}" の時間範囲 "${timeRange}" が無効です`);
                    }
                });
            });
            
            console.log('シフト確定: API形式シフトデータ:', apiShifts);
            console.log('シフト確定: API形式シフトデータ件数:', apiShifts.length);
            
            if (apiShifts.length === 0) {
                console.warn('シフト確定: シフトデータが空です');
                showError('確定するシフトデータがありません。シフトを作成してから確定してください。');
                return;
            }
            
            // APIに保存（並行実行）
            await Promise.all([
                apiClient.saveConfirmedShifts(year, month, apiShifts),
                apiClient.saveShiftStatus(year, month, 1) // 1 = confirmed
            ]);
            
            // ローカルストレージにも保存（後方互換性）
            dataManager.saveShiftStatus(year, month, 'confirmed');
            shiftStatus = 'confirmed';
            
            await saveCurrentShift();
            updateStatusDisplay();
            showSuccess('シフトを確定しました。データベースに保存されました。');
            
        } catch (error) {
            console.error('シフト確定エラー:', error);
            showError('シフトの確定に失敗しました。再度お試しください。');
        }
    }
    
    // 確定解除
    async function unconfirmShift() {
        if (!confirm('シフトの確定を解除しますか？解除後は個別修正が可能になります。')) {
            return;
        }
        
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            // APIで状態を下書きに変更
            await apiClient.saveShiftStatus(year, month, 0); // 0 = draft
            
            // ローカルストレージも更新（後方互換性）
            dataManager.saveShiftStatus(year, month, 'draft');
            shiftStatus = 'draft';
            
            updateStatusDisplay();
            showSuccess('シフトの確定を解除しました。');
            
        } catch (error) {
            console.error('シフト確定解除エラー:', error);
            showError('シフトの確定解除に失敗しました。再度お試しください。');
        }
    }
    
    // 印刷プレビューを開く
    function openPrintPreview() {
        window.print();
    }
    
    // Excelエクスポート機能
    async function exportToExcel() {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const daysInMonth = new Date(year, month, 0).getDate();
            const orderedEmployees = await getOrderedEmployees(employees);
            
            // ワークブックとワークシートを作成
            const wb = XLSX.utils.book_new();
            const wsData = [];
            
            // ヘッダー行を作成（縦レイアウト: 日付が縦、従業員が横）
            const headerRow = ['日付'];
            orderedEmployees.forEach(employee => {
                headerRow.push(employee.name);
            });
            wsData.push(headerRow);
            
            // 各日付のデータ行を作成
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month - 1, day);
                const dayName = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
                const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                
                const row = [`${day}日(${dayName})`];
                
                // 各従業員のシフトを追加
                orderedEmployees.forEach(employee => {
                    const shiftTime = currentShift[employee.code] ? currentShift[employee.code][dateString] : '';
                    
                    let cellValue = '';
                    if (shiftTime && shiftTime.trim() !== '') {
                        // currentShiftは "09:00-17:00" 形式の文字列
                        cellValue = shiftTime;
                    } else {
                        cellValue = '休';
                    }
                    
                    row.push(cellValue);
                });
                
                wsData.push(row);
            }
            
            // ワークシートを作成
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // 列幅を設定
            const colWidths = [{wch: 12}]; // 日付列
            orderedEmployees.forEach(() => {
                colWidths.push({wch: 12}); // 各従業員列
            });
            ws['!cols'] = colWidths;
            
            // ワークシートをワークブックに追加
            XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月シフト`);
            
            // ファイル名を生成
            const filename = `シフト_${year}年${month.toString().padStart(2, '0')}月.xlsx`;
            
            // ファイルを書き出し
            XLSX.writeFile(wb, filename);
            
            showSuccess('Excelファイルをエクスポートしました。');
            
        } catch (error) {
            console.error('Excelエクスポートエラー:', error);
            showError('Excelエクスポートに失敗しました。');
        }
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
    async function showAttendanceStats(type) {
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
        const orderedEmployees = await getOrderedEmployees(employees);
        
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
    async function populateShiftTimeOptions() {
        try {
            // APIからシフト条件を取得
            const shiftConditions = await apiClient.getShiftConditions();
            const timeSlots = shiftConditions.timeSlots || [];
            
            let optionsHtml = '<option value="">休み</option>';
            
            // 時間帯マスタから選択肢を生成
            timeSlots.forEach(timeSlot => {
                optionsHtml += `<option value="${timeSlot}">${timeSlot}</option>`;
            });
            
            // 「終日」オプションを追加
            optionsHtml += '<option value="終日">終日</option>';
            
            $('#edit-shift-time').html(optionsHtml);
        } catch (error) {
            console.error('時間帯選択肢生成エラー:', error);
            // エラー時は基本的な選択肢のみ
            $('#edit-shift-time').html('<option value="">休み</option><option value="終日">終日</option>');
        }
    }
    
    // サイドバーにシフト希望を表示
    async function loadShiftRequestsSidebar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        try {
            const response = await fetch(`/api/all-shift-requests.php?year=${year}&month=${month}`);
            const shiftRequests = await response.json();
            
            let sidebarHtml = '';
            
            if (shiftRequests.length === 0) {
                sidebarHtml = '<p style="color: #666; text-align: center; padding: 20px;">シフト希望はありません</p>';
            } else {
                shiftRequests.forEach(emp => {
                    if (emp.requests.length > 0) {
                        sidebarHtml += `
                            <div style="margin-bottom: 20px; border-bottom: 1px solid #dee2e6; padding-bottom: 15px;">
                                <h4 style="color: #495057; font-size: 14px; margin-bottom: 8px;">
                                    ${emp.employee_name} (${emp.business_type})
                                </h4>
                        `;
                        
                        emp.requests.forEach(req => {
                            const requestType = req.is_off_requested ? 
                                '<span style="color: #dc3545; font-weight: bold;">休み</span>' :
                                `<span style="color: #007bff;">${req.preferred_time_start || ''}-${req.preferred_time_end || ''}</span>`;
                            
                            sidebarHtml += `
                                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; padding: 2px 0;">
                                    <span>${req.day}日</span>
                                    <span>${requestType}</span>
                                </div>
                            `;
                        });
                        
                        sidebarHtml += '</div>';
                    }
                });
            }
            
            $('#shift-requests-content').html(sidebarHtml);
            
        } catch (error) {
            console.error('シフト希望読み込みエラー:', error);
            $('#shift-requests-content').html('<p style="color: #dc3545; text-align: center; padding: 20px;">読み込みエラー</p>');
        }
    }
});