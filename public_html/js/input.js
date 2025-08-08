$(document).ready(function() {
    let currentDate = new Date();
    let currentUser = null;
    
    // ログインチェック
    checkLogin();
    
    // 初期表示
    async function initialize() {
        await renderCalendar();
    }
    initialize();
    
    // 月移動ボタン
    $('#prev-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        await renderCalendar();
    });
    
    $('#next-month').on('click', async function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        await renderCalendar();
    });
    
    // 保存ボタン
    $('#save-btn').on('click', function() {
        saveShiftPreferences();
    });
    
    // クリアボタン
    $('#clear-btn').on('click', function() {
        if (confirm('全ての入力をクリアしますか？')) {
            clearAllPreferences();
        }
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
        
        // ユーザー名を表示
        const displayName = getUserDisplayName(user.username);
        $('#current-user').text('従業員: ' + displayName);
    }
    
    // ユーザー表示名を取得
    function getUserDisplayName(username) {
        const employee = dataManager.getEmployee(username);
        return employee ? employee.name : username;
    }
    
    // カレンダー描画
    async function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 月表示を更新
        $('#current-month').text(year + '年' + (month + 1) + '月のシフト希望');
        
        // 月の最初と最後の日を取得
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        let calendarHtml = '<div class="date-grid">';
        
        // 各日のカレンダーアイテムを生成
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const dateString = formatDate(date);
            
            // 土日祝日の判定
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = isWeekend; // 簡易的に土日を祝日扱い
            
            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const dayClass = isHoliday ? 'holiday' : (isWeekend ? 'weekend' : '');
            
            calendarHtml += `
                <div class="date-item ${dayClass}">
                    <div class="date-number">${day}</div>
                    <div class="day-name">(${dayNames[dayOfWeek]})</div>
                    <select class="shift-select" data-date="${dateString}" style="margin-bottom: 5px;">
                        <option value="">選択なし</option>
                        <option value="off">休み</option>
                        <option value="custom">時間帯指定</option>
                    </select>
                    <div class="custom-time-container" data-date="${dateString}" style="display: none; margin-top: 5px;">
                        <div style="display: flex; align-items: center; gap: 5px; font-size: 12px;">
                            <input type="text" class="timepicker start-time" placeholder="09:00" 
                                   style="width: 50px; padding: 2px; text-align: center; font-size: 11px;">
                            <span>～</span>
                            <input type="text" class="timepicker end-time" placeholder="17:00" 
                                   style="width: 50px; padding: 2px; text-align: center; font-size: 11px;">
                        </div>
                    </div>
                </div>
            `;
        }
        
        calendarHtml += '</div>';
        $('#calendar-container').html(calendarHtml);
        
        // 時間帯指定の表示切り替えイベント
        $('.shift-select').on('change', function() {
            const customContainer = $(this).siblings('.custom-time-container');
            if ($(this).val() === 'custom') {
                customContainer.show();
                // 時間帯がまだ入力されていない場合はフォーカス
                if (!customContainer.find('.start-time').val()) {
                    customContainer.find('.start-time').focus();
                }
            } else {
                customContainer.hide();
                customContainer.find('.timepicker').val('');
            }
        });
        
        // timepickerを初期化
        initializeTimePickers();
        
        // 従業員の固定条件を反映（保存済みデータも同時に復元）
        await loadEmployeeConditions();
    }
    
    // timepicker初期化
    function initializeTimePickers() {
        $('.timepicker').timepicker({
            'timeFormat': 'H:i',
            'interval': 30,
            'minTime': '6:00',
            'maxTime': '23:00',
            'defaultTime': '9:00',
            'startTime': '6:00',
            'dynamic': false,
            'dropdown': true,
            'scrollbar': true,
            'step': 30
        });
        
        // 終了時間が開始時間より前にならないよう制御
        $('.start-time').on('changeTime', function() {
            const container = $(this).closest('.custom-time-container');
            const endTimePicker = container.find('.end-time');
            const startTime = $(this).val();
            
            if (startTime) {
                // 開始時間の30分後を最小終了時間として設定
                const startMinutes = timeStringToMinutes(startTime);
                const minEndMinutes = startMinutes + 30;
                const minEndTime = minutesToTimeString(minEndMinutes);
                
                endTimePicker.timepicker('option', 'minTime', minEndTime);
                
                // 現在の終了時間が開始時間より前の場合、自動調整
                const currentEndTime = endTimePicker.val();
                if (currentEndTime && timeStringToMinutes(currentEndTime) <= startMinutes) {
                    endTimePicker.val(minEndTime);
                }
            }
        });
    }
    
    // 時間文字列を分に変換
    function timeStringToMinutes(timeString) {
        if (!timeString) return 0;
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 分を時間文字列に変換
    function minutesToTimeString(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    
    // シフト希望の保存
    async function saveShiftPreferences() {
        const preferences = {};
        let hasData = false;
        let hasError = false;
        
        $('.shift-select').each(function() {
            const date = $(this).data('date');
            const value = $(this).val();
            const customContainer = $(this).siblings('.custom-time-container');
            
            console.log(`データ収集: ${date} => "${value}"`);
            
            if (value === 'custom') {
                const startTime = customContainer.find('.start-time').val();
                const endTime = customContainer.find('.end-time').val();
                
                console.log(`カスタム時間帯: ${date} => 開始:${startTime}, 終了:${endTime}`);
                
                if (startTime && endTime) {
                    // 時間帯の妥当性チェック
                    if (timeStringToMinutes(startTime) >= timeStringToMinutes(endTime)) {
                        showError(`${date}: 終了時間は開始時間より後にしてください。`);
                        hasError = true;
                        return false;
                    }
                    
                    const customTime = `${startTime}-${endTime}`;
                    preferences[date] = customTime;
                    hasData = true;
                    console.log(`✓ カスタム時間帯保存: ${date} => "${customTime}"`);
                } else if (startTime || endTime) {
                    showError(`${date}: 開始時間と終了時間の両方を入力してください。`);
                    hasError = true;
                    return false;
                } else {
                    console.log(`⚠️ カスタム選択だが時間帯未入力: ${date}`);
                }
            } else if (value) {
                preferences[date] = value;
                hasData = true;
                console.log(`✓ 固定値保存: ${date} => "${value}"`);
            } else {
                console.log(`- 選択無し: ${date}`);
            }
        });
        
        if (hasError) {
            return;
        }
        
        if (!hasData) {
            showError('保存するデータがありません。');
            return;
        }
        
        // API経由で保存
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        try {
            console.log('=== シフト希望保存開始 ===');
            console.log('保存対象データ:', preferences);
            
            // データをAPI形式に変換
            const apiRequests = dataConverter.requestsToApi(preferences);
            console.log('API形式に変換したデータ:', apiRequests);
            
            await apiClient.saveShiftRequests(currentUser.username, year, month, apiRequests);
            console.log('保存完了');
            showSuccess('シフト希望を保存しました。');
        } catch (error) {
            console.error('シフト希望保存エラー:', error);
            console.error('エラー詳細:', {
                message: error.message,
                status: error.status,
                responseText: error.responseText,
                stack: error.stack
            });
            
            let errorMessage = 'シフト希望の保存に失敗しました。';
            if (error.message) {
                errorMessage += ' エラー: ' + error.message;
            }
            showError(errorMessage);
        }
    }
    
    // 時間帯マスタから時間帯を取得
    function getMasterTimeSlots() {
        if (typeof dataManager !== 'undefined' && dataManager.getShiftConditions) {
            const conditions = dataManager.getShiftConditions();
            return conditions.timeSlots || [
                '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00',
                '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00'
            ];
        }
        // フォールバック用の固定値
        return [
            '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00',
            '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00'
        ];
    }
    
    // 時間帯形式の検証
    function validateTimeFormat(timeString) {
        // 基本的な時間帯形式をチェック: HH:MM-HH:MM
        const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timePattern.test(timeString);
    }
    
    // 全てクリア
    async function clearAllPreferences() {
        $('.shift-select').val('');
        $('.custom-time-container').hide();
        $('.timepicker').val('');
        
        // API経由でクリア
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        try {
            const emptyApiRequests = dataConverter.requestsToApi({});
            await apiClient.saveShiftRequests(currentUser.username, year, month, emptyApiRequests);
            showSuccess('全ての入力をクリアしました。');
        } catch (error) {
            console.error('シフト希望クリアエラー:', error);
            showError('シフト希望のクリアに失敗しました。');
        }
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
    
    // 従業員の固定条件を反映
    async function loadEmployeeConditions() {
        const employee = dataManager.getEmployee(currentUser.username);
        if (!employee) return;
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        // API経由で保存済みのシフト希望を取得
        let preferences = {};
        try {
            console.log('=== シフト希望データ取得開始 ===');
            console.log('従業員コード:', currentUser.username);
            console.log('年月:', year, month);
            
            const apiRequests = await apiClient.getShiftRequests(currentUser.username, year, month);
            console.log('API生データ:', apiRequests);
            
            preferences = dataConverter.requestsFromApi(apiRequests);
            console.log('変換後データ:', preferences);
            console.log('変換後データのキー数:', Object.keys(preferences).length);
        } catch (error) {
            console.error('シフト希望読み込みエラー:', error);
            // エラー時はローカルストレージから読み込み
            preferences = dataManager.getEmployeeRequests(currentUser.username, year, month);
            console.log('localStorage経由で読み込んだデータ:', preferences);
        }
        
        $('.shift-select').each(function() {
            const date = $(this).data('date');
            const dayOfWeek = new Date(date).getDay();
            const selectElement = $(this);
            const customContainer = selectElement.siblings('.custom-time-container');
            const savedValue = preferences[date] || '';
            
            // 曜日別出勤可能時間をチェック
            const daySchedule = employee.conditions.weeklySchedule && employee.conditions.weeklySchedule[dayOfWeek];
            
            if (!daySchedule || daySchedule.length === 0) {
                // 出勤不可曜日は選択肢を制限
                selectElement.html('<option value="">選択なし</option><option value="off">休み</option>');
                selectElement.prop('disabled', true);
                selectElement.closest('.date-item').addClass('unavailable-day');
                selectElement.closest('.date-item').css('background-color', '#f5f5f5');
                selectElement.val(savedValue === 'off' ? 'off' : ''); // 休みの場合は保持
            } else {
                // 利用可能な時間帯を表示（「終日」対応も含む）
                let options = '<option value="">選択なし</option><option value="off">休み</option><option value="custom">時間帯指定</option>';
                
                // 時間帯マスタから取得した時間帯も追加（従業員の設定との共通部分）
                const masterTimeSlots = getMasterTimeSlots();
                const availableSlots = new Set();
                
                // 従業員設定の時間帯を追加
                daySchedule.forEach(time => {
                    if (time !== '終日') {
                        availableSlots.add(time);
                    }
                });
                
                // 「終日」設定の場合は、時間帯マスタの全時間帯を追加
                if (daySchedule.includes('終日')) {
                    masterTimeSlots.forEach(time => {
                        availableSlots.add(time);
                    });
                }
                
                // 重複を排除してオプションを作成
                Array.from(availableSlots).sort().forEach(time => {
                    options += `<option value="${time}">${time}</option>`;
                });
                
                selectElement.html(options);
                
                // 保存済みの値を復元
                console.log(`日付: ${date}, 保存済み値: "${savedValue}", 曜日設定:`, daySchedule);
                
                if (savedValue === 'off') {
                    selectElement.val('off');
                } else if (savedValue && Array.from(availableSlots).includes(savedValue)) {
                    // 登録済み時間帯の場合
                    selectElement.val(savedValue);
                    console.log(`✓ 登録済み時間帯として復元: ${savedValue}`);
                } else if (savedValue && validateTimeFormat(savedValue)) {
                    // カスタム時間帯の場合
                    selectElement.val('custom');
                    customContainer.show();
                    
                    // 時間帯を分解してtimepickerに設定
                    const [startTime, endTime] = savedValue.split('-');
                    customContainer.find('.start-time').val(startTime);
                    customContainer.find('.end-time').val(endTime);
                    console.log(`✓ カスタム時間帯として復元: ${startTime}-${endTime}`);
                } else if (savedValue) {
                    console.log(`⚠️ 認識できない保存値: "${savedValue}"`);
                    // 解釈できない値の場合は空にする
                    selectElement.val('');
                }
            }
        });
    }
});