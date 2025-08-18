$(document).ready(function() {
    let currentDate = new Date();
    let employees = [];
    let currentShift = {};
    let shiftStatus = 'draft';
    
    // 初期表示
    initialize();
    
    // 初期化関数
    async function initialize() {
        await loadData();
        renderShiftTable();
        renderSummaryTable();
        await loadNotes();
        updateStatusDisplay();
    }

    // 月移動ボタン
    $('#prev-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        await loadData();
        renderShiftTable();
        renderSummaryTable();
        await loadNotes();
        updateStatusDisplay();
    });
    
    $('#next-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        await loadData();
        renderShiftTable();
        renderSummaryTable();
        await loadNotes();
        updateStatusDisplay();
    });
    
    // 印刷ボタン
    $('#print-btn').on('click', function() {
        openPrintPreview();
    });
    
    // CSVエクスポートボタン
    $('#export-csv-btn').on('click', function() {
        exportToCSV();
    });
    
    // データ読み込み
    async function loadData() {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            console.log('確定シフト閲覧: データ読み込み開始', { year, month });
            
            // APIから並行してデータを取得
            const [apiEmployees, apiShifts, apiStatus] = await Promise.all([
                apiClient.getEmployees(),
                apiClient.getConfirmedShifts(year, month).catch(err => {
                    console.error('確定シフト閲覧: 確定シフト取得エラー:', err);
                    return []; // エラー時は空配列
                }),
                apiClient.getShiftStatus(year, month).catch(err => {
                    console.error('確定シフト閲覧: シフト状態取得エラー:', err);
                    return { is_confirmed: 0 }; // エラー時はデフォルト値
                })
            ]);
            
            console.log('確定シフト閲覧: API従業員データ:', apiEmployees);
            console.log('確定シフト閲覧: API確定シフトデータ:', apiShifts);
            console.log('確定シフト閲覧: APIシフト状態:', apiStatus);
            
            // 従業員データを変換
            employees = apiEmployees.map(emp => dataConverter.employeeFromApi(emp));
            
            // 確定シフトデータをローカル形式に変換
            currentShift = {};
            console.log('確定シフト閲覧: APIシフトデータ詳細:', {
                type: typeof apiShifts,
                isArray: Array.isArray(apiShifts),
                length: apiShifts ? apiShifts.length : 'N/A',
                data: apiShifts
            });
            
            if (apiShifts && Array.isArray(apiShifts)) {
                console.log(`確定シフト閲覧: ${apiShifts.length}件のシフトデータを処理中`);
                apiShifts.forEach((shift, index) => {
                    console.log(`確定シフト閲覧: シフト${index + 1}:`, shift);
                    const key = `${shift.employee_code}_${shift.day}`;
                    currentShift[key] = {
                        employeeCode: shift.employee_code,
                        day: shift.day,
                        timeStart: shift.time_start,
                        timeEnd: shift.time_end,
                        businessType: shift.business_type,
                        isViolation: shift.is_violation === 1
                    };
                    console.log(`確定シフト閲覧: 作成されたキー "${key}":`, currentShift[key]);
                });
            } else {
                console.warn('確定シフト閲覧: APIシフトデータが配列ではないか、空です');
            }
            
            // シフト状態を変換
            shiftStatus = apiStatus.is_confirmed === 1 ? 'confirmed' : 'draft';
            
            console.log('確定シフト閲覧: 変換後従業員データ:', employees);
            console.log('確定シフト閲覧: 変換後シフトデータ:', currentShift);
            console.log('確定シフト閲覧: シフト状態:', shiftStatus);
            
        } catch (error) {
            console.error('確定シフト閲覧: データ読み込みエラー:', error);
            
            // フォールバック: ローカルデータを使用
            employees = dataManager.getEmployees();
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            currentShift = dataManager.getConfirmedShift(year, month);
            shiftStatus = dataManager.getShiftStatus(year, month);
            
            console.log('確定シフト閲覧: フォールバック - ローカルデータを使用');
            showError('データの読み込みに失敗しました。ローカルデータを表示しています。');
        }
    }
    
    // ステータス表示更新
    function updateStatusDisplay() {
        const statusEl = $('#shift-status');
        
        if (shiftStatus === 'confirmed') {
            statusEl.removeClass('alert-danger').addClass('alert-success');
            statusEl.text('このシフトは確定済みです。').show();
        } else {
            statusEl.removeClass('alert-success').addClass('alert-danger');
            statusEl.text('このシフトはまだ下書き状態です。').show();
        }
    }
    
    // シフト表描画
    function renderShiftTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        console.log('確定シフト閲覧: シフト表描画開始', { year, month: month + 1 });
        console.log('確定シフト閲覧: currentShiftの内容:', currentShift);
        console.log('確定シフト閲覧: currentShiftのキー数:', Object.keys(currentShift).length);
        
        // 月表示を更新
        $('#current-month').text(year + '年' + (month + 1) + '月の確定シフト');
        
        if (Object.keys(currentShift).length === 0) {
            console.warn('確定シフト閲覧: シフトデータが空のため表示なし');
            $('#shift-table-container').html('<p style="text-align: center; color: #666; padding: 40px;">このシフトデータはありません。</p>');
            return;
        }
        
        console.log('確定シフト閲覧: シフトデータが存在、表描画を開始');
        
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        
        let tableHtml = '<table class="table calendar-table">';
        
        // 従業員を並び順マスタに従って並び替え
        const orderedEmployees = getOrderedEmployees(employees);
        
        // ヘッダー行（従業員名）
        tableHtml += '<thead><tr><th style="min-width: 120px;">日付・行事</th><th style="min-width: 100px;">備考</th>';
        orderedEmployees.forEach(employee => {
            const mainBusinessType = getMainBusinessTypeName(employee);
            tableHtml += `<th style="min-width: 80px; text-align: center;">${employee.name}<br><small style="color: #666;">(${mainBusinessType})</small></th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        // 各日の行
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const dateString = formatDate(date);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // 行事情報を取得
            const eventId = dataManager.getMonthlyEvents(year, month + 1)[dateString];
            const eventMaster = dataManager.getEvents();
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
            
            // 備考列（閲覧のみなので表示のみ）
            const notes = dataManager.getShiftNotes(year, month + 1);
            const dateNote = notes.dates && notes.dates[dateString] ? notes.dates[dateString] : '';
            tableHtml += `<td style="font-size: 12px; color: #666;">${dateNote}</td>`;
            
            // 各従業員のシフト（並び順マスタの順序で）
            orderedEmployees.forEach(employee => {
                const shift = currentShift[employee.code] ? currentShift[employee.code][dateString] : '';
                const shiftDisplay = formatShiftDisplay(shift);
                
                // 条件違反チェック
                const isViolation = checkShiftViolation(employee, dateString, shift);
                const violationStyle = isViolation ? 'color: red; font-weight: bold;' : '';
                
                tableHtml += `<td style="text-align: center; ${violationStyle}">${shiftDisplay}</td>`;
            });
            
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table>';
        $('#shift-table-container').html(tableHtml);
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
        
        return true; // 条件に合わない
    }
    
    // 時間帯が重複するかチェック
    function isTimeOverlap(timeRange1, timeRange2) {
        try {
            const [start1, end1] = timeRange1.split('-').map(t => timeToMinutes(t));
            const [start2, end2] = timeRange2.split('-').map(t => timeToMinutes(t));
            
            return start1 < end2 && end1 > start2;
        } catch (error) {
            return false;
        }
    }
    
    // 時間を分に変換
    function timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 集計テーブル描画
    function renderSummaryTable() {
        if (Object.keys(currentShift).length === 0) {
            $('#summary-table-container').html('<p style="color: #666;">シフトデータがないため、集計できません。</p>');
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        let summaryHtml = '<table class="table"><thead><tr>';
        summaryHtml += '<th>従業員名</th><th>業務区分</th><th>出勤日数</th><th>休日数</th><th>総勤務時間</th></tr></thead><tbody>';
        
        // 従業員を並び順マスタに従って並び替え
        const orderedEmployees = getOrderedEmployees(employees);
        
        orderedEmployees.forEach(employee => {
            const stats = calculateEmployeeStats(employee.code);
            const businessType = formatEmployeeBusinessTypes(employee.businessTypes);
            
            summaryHtml += `
                <tr>
                    <td>${employee.name}</td>
                    <td>${businessType}</td>
                    <td>${stats.workDays}日</td>
                    <td>${stats.offDays}日</td>
                    <td>${stats.totalHours}時間</td>
                </tr>
            `;
        });
        
        summaryHtml += '</tbody></table>';
        $('#summary-table-container').html(summaryHtml);
    }
    
    // 従業員統計計算
    function calculateEmployeeStats(employeeCode) {
        const shifts = currentShift[employeeCode] || {};
        let workDays = 0;
        let offDays = 0;
        let totalHours = 0;
        
        const hoursMap = {
            '9:00-13:00': 4,
            '9:30-14:00': 4.5,
            '9:30-16:00': 6.5,
            '10:00-14:00': 4,
            '10:00-16:00': 6,
            '13:00-17:00': 4,
            '14:00-18:00': 4
        };
        
        Object.values(shifts).forEach(shift => {
            if (shift && shift !== '') {
                workDays++;
                totalHours += hoursMap[shift] || 0;
            } else {
                offDays++;
            }
        });
        
        return { workDays, offDays, totalHours };
    }
    
    // 備考読み込み
    async function loadNotes() {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const apiNotes = await apiClient.getShiftNotes(year, month);
            console.log('確定シフト閲覧: API備考データ:', apiNotes);
            
            if (apiNotes.notes && apiNotes.notes.trim() !== '') {
                $('#shift-notes').text(apiNotes.notes);
                $('#notes-section').show();
            } else {
                $('#notes-section').hide();
            }
        } catch (error) {
            console.error('確定シフト閲覧: 備考読み込みエラー:', error);
            
            // フォールバック: ローカルデータを使用
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const notes = dataManager.getShiftNotes(year, month);
            
            if (notes.general && notes.general.trim() !== '') {
                $('#shift-notes').text(notes.general);
                $('#notes-section').show();
            } else {
                $('#notes-section').hide();
            }
        }
    }
    
    // エラーメッセージ表示
    function showError(message) {
        console.error('確定シフト閲覧エラー:', message);
        // エラー表示要素がある場合は表示
        const errorEl = $('#error-message');
        if (errorEl.length > 0) {
            errorEl.text(message).show();
            setTimeout(function() {
                errorEl.fadeOut();
            }, 5000);
        }
    }
    
    // CSVエクスポート
    function exportToCSV() {
        if (Object.keys(currentShift).length === 0) {
            alert('エクスポートするシフトデータがありません。');
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        
        let csvContent = '\uFEFF'; // BOM for Excel
        csvContent += `${year}年${month}月 確定シフト表\n\n`;
        
        // ヘッダー
        csvContent += '従業員名,業務区分';
        for (let day = 1; day <= lastDay; day++) {
            csvContent += `,${day}日`;
        }
        csvContent += ',出勤日数,総勤務時間\n';
        
        // 従業員を並び順マスタに従って並び替え
        const orderedEmployees = getOrderedEmployees(employees);
        
        // データ行
        orderedEmployees.forEach(employee => {
            const businessType = formatEmployeeBusinessTypes(employee.businessTypes);
            const stats = calculateEmployeeStats(employee.code);
            
            csvContent += `${employee.name},"${businessType}"`;
            
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month - 1, day);
                const dateString = formatDate(date);
                const shift = currentShift[employee.code] ? currentShift[employee.code][dateString] : '';
                const displayValue = shift || '休み';
                csvContent += `,${displayValue}`;
            }
            
            csvContent += `,${stats.workDays}日,${stats.totalHours}時間\n`;
        });
        
        // 備考を追加
        const notes = dataManager.getShiftNotes(year, month);
        if (notes.general && notes.general.trim() !== '') {
            csvContent += `\n備考\n${notes.general}\n`;
        }
        
        // ファイルダウンロード
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `confirmed_shift_${year}_${String(month).padStart(2, '0')}.csv`;
        link.click();
    }
    
    // 従業員の業務区分をフォーマット
    function formatEmployeeBusinessTypes(businessTypes) {
        if (!businessTypes || businessTypes.length === 0) {
            return '未設定';
        }
        
        const businessTypesList = dataManager.getBusinessTypes();
        return businessTypes.map(bt => {
            const businessType = businessTypesList.find(master => master.code === bt.code);
            const name = businessType ? businessType.name : bt.code;
            return bt.isMain ? `${name}(メイン)` : `${name}(サブ)`;
        }).join(', ');
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
        const lastDay = new Date(year, month, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const title = `${year}年${month}月 確定シフト表`;
        
        // 従業員を並び順マスタに従って並び替え
        const orderedEmployees = getOrderedEmployees(employees);
        const employeeCount = orderedEmployees.length;
        
        // 従業員数に応じたレイアウト設定
        const layoutConfig = getLayoutConfig(employeeCount);
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body { 
                        font-family: 'MS Gothic', monospace;
                        margin: 0;
                        padding: 0;
                        font-size: ${layoutConfig.baseFontSize}px;
                        line-height: 1.2;
                    }
                    h1 { 
                        text-align: center;
                        margin: 0 0 10px 0;
                        font-size: ${layoutConfig.titleFontSize}px;
                        font-weight: bold;
                    }
                    table { 
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }
                    th, td { 
                        border: 1px solid #000;
                        padding: ${layoutConfig.cellPadding}px;
                        text-align: center;
                        font-size: ${layoutConfig.cellFontSize}px;
                        vertical-align: middle;
                        word-wrap: break-word;
                        overflow: hidden;
                    }
                    th {
                        background-color: #f0f0f0;
                        font-weight: bold;
                    }
                    .date-column {
                        width: ${layoutConfig.dateColumnWidth};
                        font-size: ${layoutConfig.dateFontSize}px;
                    }
                    .notes-column {
                        width: ${layoutConfig.notesColumnWidth};
                        font-size: ${layoutConfig.notesFontSize}px;
                    }
                    .employee-column {
                        width: ${layoutConfig.employeeColumnWidth};
                    }
                    .weekend {
                        background-color: #ffe6e6;
                    }
                    .violation {
                        color: red;
                        font-weight: bold;
                    }
                    .event-name {
                        color: #e67e22;
                        font-size: ${layoutConfig.eventFontSize}px;
                        display: block;
                        margin-top: 2px;
                    }
                    .employee-name {
                        font-size: ${layoutConfig.employeeNameFontSize}px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
        `;
        
        // シフト表を生成
        html += generatePrintShiftTable(orderedEmployees, year, month, lastDay, dayNames);
        
        html += `
            </body>
            </html>
        `;
        
        return html;
    }
    
    // 従業員数に応じたレイアウト設定
    function getLayoutConfig(employeeCount) {
        const configs = {
            1: {
                baseFontSize: 14,
                titleFontSize: 18,
                cellFontSize: 12,
                cellPadding: 6,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '80%',
                dateFontSize: 11,
                eventFontSize: 9,
                notesFontSize: 10,
                employeeNameFontSize: 11
            },
            2: {
                baseFontSize: 13,
                titleFontSize: 17,
                cellFontSize: 11,
                cellPadding: 5,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '20%',
                dateFontSize: 10,
                eventFontSize: 8,
                notesFontSize: 9,
                employeeNameFontSize: 10
            },
            3: {
                baseFontSize: 12,
                titleFontSize: 16,
                cellFontSize: 10,
                cellPadding: 4,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '13.33%',
                dateFontSize: 9,
                eventFontSize: 7,
                notesFontSize: 8,
                employeeNameFontSize: 9
            },
            4: {
                baseFontSize: 11,
                titleFontSize: 15,
                cellFontSize: 9,
                cellPadding: 3,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '10%',
                dateFontSize: 8,
                eventFontSize: 6,
                notesFontSize: 7,
                employeeNameFontSize: 8
            },
            5: {
                baseFontSize: 10,
                titleFontSize: 14,
                cellFontSize: 8,
                cellPadding: 2,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '8%',
                dateFontSize: 7,
                eventFontSize: 5,
                notesFontSize: 6,
                employeeNameFontSize: 7
            },
            6: {
                baseFontSize: 9,
                titleFontSize: 13,
                cellFontSize: 7,
                cellPadding: 2,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '6.67%',
                dateFontSize: 6,
                eventFontSize: 4,
                notesFontSize: 5,
                employeeNameFontSize: 6
            },
            7: {
                baseFontSize: 8,
                titleFontSize: 12,
                cellFontSize: 6,
                cellPadding: 1,
                dateColumnWidth: '12%',
                notesColumnWidth: '8%',
                employeeColumnWidth: '5.71%',
                dateFontSize: 5,
                eventFontSize: 4,
                notesFontSize: 4,
                employeeNameFontSize: 5
            }
        };
        
        // 7名を超える場合は7名用の設定を使用
        return configs[Math.min(employeeCount, 7)] || configs[7];
    }
    
    // 印刷用シフト表生成
    function generatePrintShiftTable(orderedEmployees, year, month, lastDay, dayNames) {
        let tableHtml = '<table>';
        
        // ヘッダー行
        tableHtml += '<thead><tr><th class="date-column">日付・行事</th><th class="notes-column">備考</th>';
        orderedEmployees.forEach(employee => {
            tableHtml += `<th class="employee-column">`;
            tableHtml += `<span class="employee-name">${employee.name}</span>`;
            tableHtml += `</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        // 各日の行
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay();
            const dateString = formatDate(date);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // 行事情報を取得
            const eventId = dataManager.getMonthlyEvents(year, month)[dateString];
            const eventMaster = dataManager.getEvents();
            const event = eventId ? eventMaster.find(e => e.id === eventId) : null;
            const eventName = event ? event.name : '';
            
            const rowClass = isWeekend ? ' class="weekend"' : '';
            
            tableHtml += `<tr${rowClass}>`;
            
            // 日付・行事列
            tableHtml += `<td class="date-column${isWeekend ? ' weekend' : ''}">`;
            tableHtml += `${day}日(${dayNames[dayOfWeek]})`;
            if (eventName) {
                tableHtml += `<span class="event-name">${eventName}</span>`;
            }
            tableHtml += '</td>';
            
            // 備考列
            const notes = dataManager.getShiftNotes(year, month);
            const dateNote = notes.dates && notes.dates[dateString] ? notes.dates[dateString] : '';
            tableHtml += `<td class="notes-column">${dateNote}</td>`;
            
            // 各従業員のシフト
            orderedEmployees.forEach(employee => {
                const shift = currentShift[employee.code] ? currentShift[employee.code][dateString] : '';
                const shiftDisplay = shift || '-';
                
                // 条件違反チェック
                const isViolation = shift ? checkShiftViolation(employee, dateString, shift) : false;
                const violationClass = isViolation ? ' violation' : '';
                
                tableHtml += `<td class="employee-column${violationClass}">${shiftDisplay}</td>`;
            });
            
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table>';
        return tableHtml;
    }
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
});