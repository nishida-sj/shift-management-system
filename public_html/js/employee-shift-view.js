$(document).ready(function() {
    let currentDate = new Date();
    let currentUser = null;
    let currentShift = {};
    let shiftStatus = 'draft';
    let eventMaster = [];
    let monthlyEvents = {};
    
    // ログインチェック
    checkLogin();
    
    // 初期表示
    async function initialize() {
        await loadData();
        renderShiftTable();
        renderEmployeeSummary();
        loadNotes();
        updateStatusDisplay();
    }
    
    initialize();
    
    // 月移動ボタン
    $('#prev-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        await loadData();
        renderShiftTable();
        renderEmployeeSummary();
        loadNotes();
        updateStatusDisplay();
    });
    
    $('#next-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        await loadData();
        renderShiftTable();
        renderEmployeeSummary();
        loadNotes();
        updateStatusDisplay();
    });
    
    // ログインチェック
    function checkLogin() {
        const userData = localStorage.getItem('shiftApp_user');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }
        
        const user = JSON.parse(userData);
        if (user.userType !== 'employee') {
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        
        // ユーザー名を表示（非同期で取得）
        updateUserDisplayName();
    }
    
    // ユーザー表示名を更新（API経由）
    async function updateUserDisplayName() {
        try {
            // まずcurrentUserに名前があるかチェック
            if (currentUser.name) {
                $('#current-user').text('従業員: ' + currentUser.name);
                return;
            }
            
            // API経由で従業員データを取得
            const apiEmployees = await apiClient.getEmployees();
            const apiEmployee = apiEmployees.find(emp => 
                emp.employee_code === currentUser.username || 
                emp.employee_code === `emp${currentUser.username}` ||
                emp.name === currentUser.name
            );
            
            if (apiEmployee) {
                $('#current-user').text('従業員: ' + apiEmployee.name);
                // currentUserにも名前を保存
                currentUser.name = apiEmployee.name;
            } else {
                // フォールバック: localStorageから取得
                const employee = dataManager.getEmployee(currentUser.username);
                const displayName = employee ? employee.name : currentUser.username;
                $('#current-user').text('従業員: ' + displayName);
            }
        } catch (error) {
            console.error('従業員名取得エラー:', error);
            // エラー時はusernameを表示
            $('#current-user').text('従業員: ' + currentUser.username);
        }
    }
    
    // データ読み込み
    async function loadData() {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            console.log(`employee-shift-view: API経由でデータ読み込み開始 ${year}/${month}`);
            
            // API経由でデータを取得
            const [apiEvents, apiMonthlyEvents, apiShift] = await Promise.all([
                apiClient.getEvents(),
                apiClient.getMonthlyEvents(year, month),
                apiClient.getShift(year, month)
            ]);
            
            // データを変換
            eventMaster = dataConverter.convertEvents(apiEvents);
            monthlyEvents = dataConverter.convertMonthlyEvents(apiMonthlyEvents);
            
            console.log('employee-shift-view: API経由シフトデータ:', apiShift);
            
            if (apiShift && apiShift.shift_data && apiShift.status) {
                currentShift = JSON.parse(apiShift.shift_data);
                shiftStatus = apiShift.status;
                console.log('employee-shift-view: 確定シフトデータ取得成功');
                console.log('employee-shift-view: シフトステータス:', shiftStatus);
                console.log('employee-shift-view: 現在ユーザー:', currentUser.username);
                console.log('employee-shift-view: 現在ユーザーのシフト:', currentShift[currentUser.username]);
            } else {
                console.log('employee-shift-view: 確定シフトデータなし、初期化');
                currentShift = {};
                shiftStatus = 'draft';
            }
            
        } catch (error) {
            console.error('employee-shift-view: API経由データ読み込みエラー:', error);
            // フォールバック：dataManagerを使用
            console.log('employee-shift-view: dataManagerを使用してフォールバック');
            eventMaster = dataManager.getEvents();
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            monthlyEvents = dataManager.getMonthlyEvents(year, month);
            currentShift = dataManager.getConfirmedShift(year, month);
            shiftStatus = dataManager.getShiftStatus(year, month);
        }
    }
    
    // ステータス表示更新
    function updateStatusDisplay() {
        const statusEl = $('#shift-status');
        
        if (shiftStatus === 'confirmed') {
            statusEl.removeClass('alert-danger').addClass('alert-success');
            statusEl.text('このシフトは確定済みです。').show();
        } else {
            statusEl.removeClass('alert-success').addClass('alert-warning');
            statusEl.text('このシフトはまだ下書き状態です。確定後に正式なシフトとなります。').show();
        }
    }
    
    // シフト表描画（従業員個人用）
    function renderShiftTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 月表示を更新
        $('#current-month').text(year + '年' + (month + 1) + '月の確定シフト');
        
        if (Object.keys(currentShift).length === 0 || !currentShift[currentUser.username]) {
            $('#shift-table-container').html('<p style="text-align: center; color: #666; padding: 40px;">このシフトデータはありません。</p>');
            return;
        }
        
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const userShifts = currentShift[currentUser.username] || {};
        
        let tableHtml = '<table class="table calendar-table">';
        
        // ヘッダー行
        tableHtml += '<thead><tr><th style="min-width: 80px;">日付</th><th style="min-width: 100px;">曜日</th><th style="min-width: 100px;">行事</th><th style="min-width: 120px;">勤務時間</th></tr></thead><tbody>';
        
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
            
            const shift = userShifts[dateString] || '';
            
            // 条件違反チェック
            const employee = dataManager.getEmployee(currentUser.username);
            const isViolation = checkShiftViolation(employee, dateString, shift);
            
            const rowClass = isWeekend ? 'style="background-color: #fff5f5;"' : '';
            const shiftStyle = isViolation ? 'color: red; font-weight: bold;' : '';
            const shiftDisplay = formatShiftDisplay(shift);
            
            tableHtml += `<tr ${rowClass}>`;
            tableHtml += `<td style="text-align: center; font-weight: bold;">${day}</td>`;
            tableHtml += `<td style="text-align: center;">${dayNames[dayOfWeek]}</td>`;
            tableHtml += `<td style="text-align: center; color: #e67e22;">${eventName}</td>`;
            tableHtml += `<td style="text-align: center; ${shiftStyle}">${shiftDisplay}</td>`;
            tableHtml += '</tr>';
        }
        
        tableHtml += '</tbody></table>';
        $('#shift-table-container').html(tableHtml);
    }
    
    // シフト表示フォーマット
    function formatShiftDisplay(shift) {
        if (!shift) return '<span style="color: #999;">-</span>';
        return `<span>${shift}</span>`;
    }
    
    // シフト条件違反チェック
    function checkShiftViolation(employee, dateString, shift) {
        if (!shift || !employee) return false;
        
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
    
    // 従業員統計描画
    function renderEmployeeSummary() {
        if (Object.keys(currentShift).length === 0 || !currentShift[currentUser.username]) {
            $('#employee-summary').html('<p style="color: #666;">シフトデータがないため、統計を表示できません。</p>');
            return;
        }
        
        const stats = calculateEmployeeStats(currentUser.username);
        const employee = dataManager.getEmployee(currentUser.username);
        const businessType = employee ? formatEmployeeBusinessTypes(employee.businessTypes) : '未設定';
        
        let summaryHtml = '<div class="row">';
        
        summaryHtml += `
            <div class="col-md-3">
                <div class="summary-card" style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5 style="color: #27ae60; margin-bottom: 10px;">出勤日数</h5>
                    <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${stats.workDays}日</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="summary-card" style="background-color: #ffeaa7; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5 style="color: #f39c12; margin-bottom: 10px;">休日数</h5>
                    <div style="font-size: 24px; font-weight: bold; color: #f39c12;">${stats.offDays}日</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="summary-card" style="background-color: #dfe6e9; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5 style="color: #636e72; margin-bottom: 10px;">総勤務時間</h5>
                    <div style="font-size: 24px; font-weight: bold; color: #636e72;">${stats.totalHours}時間</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="summary-card" style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; text-align: center;">
                    <h5 style="color: #3498db; margin-bottom: 10px;">業務区分</h5>
                    <div style="font-size: 14px; font-weight: bold; color: #3498db;">${businessType}</div>
                </div>
            </div>
        `;
        
        summaryHtml += '</div>';
        $('#employee-summary').html(summaryHtml);
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
            '14:00-18:00': 4,
            '9:00-17:00': 8
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
    
    // 備考読み込み
    function loadNotes() {
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
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
});