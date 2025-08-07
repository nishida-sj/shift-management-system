$(document).ready(function() {
    let currentDate = new Date();
    let currentUser = null;
    let employees = [];
    let shiftData = {};
    
    // ログインチェック
    checkLogin();
    
    // 従業員データとダミーシフトデータの初期化
    initializeData();
    
    // 初期表示
    renderShiftTable();
    renderSummaryTable();
    
    // 月移動ボタン
    $('#prev-month').on('click', function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderShiftTable();
        renderSummaryTable();
    });
    
    $('#next-month').on('click', function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderShiftTable();
        renderSummaryTable();
    });
    
    // CSVエクスポートボタン
    $('#export-btn').on('click', function() {
        exportToCSV();
    });
    
    // ログインチェック
    function checkLogin() {
        const userData = localStorage.getItem('shiftApp_user');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }
        
        const user = JSON.parse(userData);
        currentUser = user;
        
        // ユーザー情報表示
        if (user.userType === 'admin') {
            $('#current-user').text('管理者: ' + user.username);
        } else {
            $('#current-user').text('従業員: ' + getUserDisplayName(user.username));
        }
    }
    
    // ユーザー表示名を取得
    function getUserDisplayName(username) {
        const userNames = {
            emp001: '山田太郎',
            emp002: '田中花子',
            emp003: '佐藤次郎'
        };
        return userNames[username] || username;
    }
    
    // データ初期化
    function initializeData() {
        employees = [
            { id: 'emp001', name: '山田太郎' },
            { id: 'emp002', name: '田中花子' },
            { id: 'emp003', name: '佐藤次郎' }
        ];
        
        // ダミーシフトデータを生成
        generateDummyShiftData();
    }
    
    // ダミーシフトデータ生成
    function generateDummyShiftData() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthKey = `${year}-${month + 1}`;
        
        if (shiftData[monthKey]) return; // 既に生成済み
        
        shiftData[monthKey] = {};
        
        const lastDay = new Date(year, month + 1, 0).getDate();
        const shiftPatterns = ['9-13', '13-17', '17-21', '9-17', '13-21', 'off'];
        
        employees.forEach(employee => {
            shiftData[monthKey][employee.id] = {};
            
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month, day);
                const dayOfWeek = date.getDay();
                const dateString = formatDate(date);
                
                // 土日は休みになりやすく設定
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    if (Math.random() < 0.7) {
                        shiftData[monthKey][employee.id][dateString] = 'off';
                    } else {
                        shiftData[monthKey][employee.id][dateString] = shiftPatterns[Math.floor(Math.random() * (shiftPatterns.length - 1))];
                    }
                } else {
                    // 平日は勤務が多め
                    if (Math.random() < 0.85) {
                        shiftData[monthKey][employee.id][dateString] = shiftPatterns[Math.floor(Math.random() * (shiftPatterns.length - 1))];
                    } else {
                        shiftData[monthKey][employee.id][dateString] = 'off';
                    }
                }
            }
        });
    }
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // シフト表描画
    function renderShiftTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthKey = `${year}-${month + 1}`;
        
        // 月表示を更新
        $('#current-month').text(year + '年' + (month + 1) + '月の確定シフト');
        
        // ダミーデータ生成
        generateDummyShiftData();
        
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        
        let tableHtml = '<table class="table calendar-table">';
        
        // ヘッダー行（日付）
        tableHtml += '<thead><tr><th style="min-width: 120px;">従業員名</th>';
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const cellClass = isWeekend ? 'style="background-color: #ffe6e6;"' : '';
            
            tableHtml += `<th ${cellClass}>${day}<br><small>(${dayNames[dayOfWeek]})</small></th>`;
        }
        tableHtml += '</tr></thead><tbody>';
        
        // 各従業員の行
        employees.forEach(employee => {
            tableHtml += '<tr>';
            tableHtml += `<td class="employee-name">${employee.name}</td>`;
            
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month, day);
                const dayOfWeek = date.getDay();
                const dateString = formatDate(date);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const cellClass = isWeekend ? 'style="background-color: #fff5f5;"' : '';
                
                const shift = shiftData[monthKey][employee.id][dateString];
                const shiftDisplay = formatShiftDisplay(shift);
                
                tableHtml += `<td ${cellClass}>${shiftDisplay}</td>`;
            }
            
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        $('#shift-table-container').html(tableHtml);
    }
    
    // シフト表示フォーマット
    function formatShiftDisplay(shift) {
        if (!shift) return '-';
        if (shift === 'off') return '<span style="color: #e74c3c;">休</span>';
        
        const timeMap = {
            '9-13': '9:00-13:00',
            '13-17': '13:00-17:00',
            '17-21': '17:00-21:00',
            '9-17': '9:00-17:00',
            '13-21': '13:00-21:00',
            '9-21': '9:00-21:00'
        };
        
        return `<span style="color: #27ae60; font-size: 11px;">${timeMap[shift] || shift}</span>`;
    }
    
    // 集計テーブル描画
    function renderSummaryTable() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthKey = `${year}-${month + 1}`;
        
        let summaryHtml = '<table class="table"><thead><tr>';
        summaryHtml += '<th>従業員名</th><th>出勤日数</th><th>休日数</th><th>総勤務時間</th></tr></thead><tbody>';
        
        employees.forEach(employee => {
            const stats = calculateEmployeeStats(employee.id, monthKey);
            summaryHtml += `
                <tr>
                    <td>${employee.name}</td>
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
    function calculateEmployeeStats(employeeId, monthKey) {
        const shifts = shiftData[monthKey][employeeId];
        let workDays = 0;
        let offDays = 0;
        let totalHours = 0;
        
        const hoursMap = {
            '9-13': 4,
            '13-17': 4,
            '17-21': 4,
            '9-17': 8,
            '13-21': 8,
            '9-21': 12
        };
        
        Object.values(shifts).forEach(shift => {
            if (shift === 'off') {
                offDays++;
            } else if (shift && shift !== '') {
                workDays++;
                totalHours += hoursMap[shift] || 0;
            }
        });
        
        return { workDays, offDays, totalHours };
    }
    
    // CSVエクスポート
    function exportToCSV() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthKey = `${year}-${month + 1}`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        
        let csvContent = '\uFEFF'; // BOM for Excel
        csvContent += `${year}年${month + 1}月 確定シフト\n\n`;
        
        // ヘッダー
        csvContent += '従業員名';
        for (let day = 1; day <= lastDay; day++) {
            csvContent += `,${day}日`;
        }
        csvContent += '\n';
        
        // データ行
        employees.forEach(employee => {
            csvContent += employee.name;
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(year, month, day);
                const dateString = formatDate(date);
                const shift = shiftData[monthKey][employee.id][dateString];
                const displayValue = shift === 'off' ? '休み' : (shift ? shift.replace('-', ':00-') + ':00' : '');
                csvContent += `,${displayValue}`;
            }
            csvContent += '\n';
        });
        
        // ファイルダウンロード
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `shift_${year}_${String(month + 1).padStart(2, '0')}.csv`;
        link.click();
    }
});