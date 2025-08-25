$(document).ready(async function() {
    let currentSettings = getDefaultSettings();
    
    // 初期表示
    await loadSettings();
    renderTimeSlots();
    
    // 保存ボタン
    $('#save-btn').on('click', function() {
        saveSettings();
    });
    
    // リセットボタン
    $('#reset-btn').on('click', function() {
        if (confirm('設定をデフォルト値に戻しますか？')) {
            resetToDefault();
        }
    });
    
    // 時間帯追加ボタン
    $('#add-time-slot-btn').on('click', function() {
        addTimeSlot();
    });
    
    // 時間帯削除ボタン（動的要素用）
    $(document).on('click', '.remove-time-slot-btn', function() {
        if (confirm('この時間帯を削除しますか？')) {
            $(this).closest('.time-slot-row').remove();
        }
    });
    
    // デフォルト設定を取得
    function getDefaultSettings() {
        return {
            basicSettings: {
                minRestHours: 1,
                maxConsecutiveDays: 6,
                minRestDaysAfterConsecutive: 1
            },
            timeSlots: [
                '09:00-13:00',
                '09:30-14:00',
                '09:30-16:00',
                '10:00-14:00',
                '10:00-16:00',
                '13:00-17:00',
                '14:00-18:00',
                '09:00-17:00'
            ],
            priorities: {
                prioritizeMainBusiness: true,
                respectOffRequests: true,
                respectTimePreferences: true,
                balanceWorkload: false
            },
            warnings: {
                warnConditionViolation: true,
                warnConsecutiveWork: true,
                warnInsufficientRest: true
            }
        };
    }
    
    // 設定を読み込み
    async function loadSettings() {
        try {
            console.log('シフト条件: API呼び出し開始');
            currentSettings = await apiClient.getShiftConditions();
            console.log('シフト条件: API応答データ:', JSON.stringify(currentSettings, null, 2));
            console.log('シフト条件: timeSlots詳細:', currentSettings.timeSlots);
            
            // 各時間帯の詳細をログ出力
            if (currentSettings.timeSlots && Array.isArray(currentSettings.timeSlots)) {
                currentSettings.timeSlots.forEach((slot, index) => {
                    console.log(`shift-conditions: timeSlot[${index}]: "${slot}" (length: ${slot.length})`);
                });
            }
            
            // APIデータの構造検証
            if (!currentSettings.basicSettings || !currentSettings.timeSlots) {
                throw new Error('API応答データの構造が不正です');
            }
            
            console.log('シフト条件: API経由でのデータ読み込み成功');
        } catch (error) {
            console.error('シフト条件取得エラー:', error);
            // デフォルト設定を使用
            currentSettings = getDefaultSettings();
            console.log('シフト条件: デフォルト設定を使用:', currentSettings);
            showError('シフト条件の読み込みに失敗しました。デフォルト設定を使用します。');
        }
        
        // フォームに値を設定
        $('#min-rest-hours').val(currentSettings.basicSettings.minRestHours);
        $('#max-consecutive-days').val(currentSettings.basicSettings.maxConsecutiveDays);
        $('#min-rest-days-after-consecutive').val(currentSettings.basicSettings.minRestDaysAfterConsecutive);
        
        $('#prioritize-main-business').prop('checked', currentSettings.priorities.prioritizeMainBusiness);
        $('#respect-off-requests').prop('checked', currentSettings.priorities.respectOffRequests);
        $('#respect-time-preferences').prop('checked', currentSettings.priorities.respectTimePreferences);
        $('#balance-workload').prop('checked', currentSettings.priorities.balanceWorkload);
        
        $('#warn-condition-violation').prop('checked', currentSettings.warnings.warnConditionViolation);
        $('#warn-consecutive-work').prop('checked', currentSettings.warnings.warnConsecutiveWork);
        $('#warn-insufficient-rest').prop('checked', currentSettings.warnings.warnInsufficientRest);
    }
    
    // 時間帯一覧を描画
    function renderTimeSlots() {
        console.log('shift-conditions: renderTimeSlots開始');
        console.log('shift-conditions: 描画対象の時間帯:', currentSettings.timeSlots);
        
        let html = '';
        currentSettings.timeSlots.forEach((timeSlot, index) => {
            console.log(`shift-conditions: 時間帯[${index}]を描画: "${timeSlot}"`);
            html += createTimeSlotRow(timeSlot, index);
        });
        $('#time-slots-container').html(html);
        console.log('shift-conditions: renderTimeSlots完了');
    }
    
    // 時間を正規化（H:mm → HH:mm）
    function normalizeTime(timeString) {
        if (!timeString) return '';
        
        // HH:mm:ss形式の場合は時:分だけ取得
        if (timeString.includes(':')) {
            const parts = timeString.split(':');
            const hours = parts[0].padStart(2, '0');
            const minutes = parts[1] || '00';
            return `${hours}:${minutes}`;
        }
        
        return timeString;
    }

    // 時間帯行を作成
    function createTimeSlotRow(timeSlot = '', index = -1) {
        console.log(`shift-conditions: createTimeSlotRow呼び出し - timeSlot: "${timeSlot}"`);
        
        const timeSlotParts = timeSlot.split('-');
        const startTime = normalizeTime(timeSlotParts[0] || '');
        const endTime = normalizeTime(timeSlotParts[1] || '');
        
        console.log(`shift-conditions: 時間帯分解 - parts: [${timeSlotParts.join(', ')}]`);
        console.log(`shift-conditions: 正規化結果 - startTime: "${startTime}", endTime: "${endTime}"`);
        
        return `
            <div class="time-slot-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <div style="flex: 1;">
                    <label>開始時間</label>
                    <input type="time" class="form-control start-time" value="${startTime}" style="width: 120px;">
                </div>
                <div style="flex: 1;">
                    <label>終了時間</label>
                    <input type="time" class="form-control end-time" value="${endTime}" style="width: 120px;">
                </div>
                <div style="flex: 2;">
                    <label>表示名</label>
                    <input type="text" class="form-control time-display" value="${timeSlot}" placeholder="例: 09:00-13:00" readonly>
                </div>
                <div>
                    <button type="button" class="btn btn-secondary remove-time-slot-btn" style="margin-top: 25px;">削除</button>
                </div>
            </div>
        `;
    }
    
    // 時間帯を追加
    function addTimeSlot() {
        const html = createTimeSlotRow();
        $('#time-slots-container').append(html);
        
        // 新しく追加された行のイベントハンドラを設定
        const newRow = $('#time-slots-container .time-slot-row').last();
        setupTimeSlotEvents(newRow);
    }
    
    // 時間帯行のイベントを設定
    function setupTimeSlotEvents(row) {
        row.find('.start-time, .end-time').on('change', function() {
            const startTime = row.find('.start-time').val();
            const endTime = row.find('.end-time').val();
            
            if (startTime && endTime) {
                // 表示名は09:00形式で統一（ゼロパディング有り）
                const displayValue = `${startTime}-${endTime}`;
                row.find('.time-display').val(displayValue);
            }
        });
    }
    
    // 既存の時間帯行にイベントを設定
    $(document).on('change', '.start-time, .end-time', function() {
        const row = $(this).closest('.time-slot-row');
        const startTime = row.find('.start-time').val();
        const endTime = row.find('.end-time').val();
        
        if (startTime && endTime) {
            // 表示名は09:00形式で統一（ゼロパディング有り）
            const displayValue = `${startTime}-${endTime}`;
            row.find('.time-display').val(displayValue);
        }
    });
    
    // 設定を保存
    async function saveSettings() {
        try {
            // 基本設定を取得
            currentSettings.basicSettings = {
                minRestHours: parseInt($('#min-rest-hours').val()) || 1,
                maxConsecutiveDays: parseInt($('#max-consecutive-days').val()) || 6,
                minRestDaysAfterConsecutive: parseInt($('#min-rest-days-after-consecutive').val()) || 1
            };
            
            // 時間帯を取得
            const timeSlots = [];
            $('.time-slot-row').each(function() {
                const startTime = $(this).find('.start-time').val();
                const endTime = $(this).find('.end-time').val();
                
                console.log(`shift-conditions: 処理中の時間帯 - start: "${startTime}", end: "${endTime}"`);
                
                if (startTime && endTime) {
                    // 保存時は09:00形式で統一（ゼロパディング有り）
                    const timeSlotString = `${startTime}-${endTime}`;
                    
                    console.log(`shift-conditions: 時間帯保存 - "${startTime}-${endTime}"`);
                    console.log(`shift-conditions: 最終的な時間帯文字列: "${timeSlotString}"`);
                    
                    timeSlots.push(timeSlotString);
                }
            });
            
            if (timeSlots.length === 0) {
                showError('時間帯を1つ以上設定してください。');
                return;
            }
            
            currentSettings.timeSlots = timeSlots;
            
            // 優先度設定を取得
            currentSettings.priorities = {
                prioritizeMainBusiness: $('#prioritize-main-business').is(':checked'),
                respectOffRequests: $('#respect-off-requests').is(':checked'),
                respectTimePreferences: $('#respect-time-preferences').is(':checked'),
                balanceWorkload: $('#balance-workload').is(':checked')
            };
            
            // 警告設定を取得
            currentSettings.warnings = {
                warnConditionViolation: $('#warn-condition-violation').is(':checked'),
                warnConsecutiveWork: $('#warn-consecutive-work').is(':checked'),
                warnInsufficientRest: $('#warn-insufficient-rest').is(':checked')
            };
            
            // APIで保存
            console.log('シフト条件保存: APIに送信するデータ:', currentSettings);
            await apiClient.saveShiftConditions(currentSettings);
            console.log('シフト条件保存: API保存成功');
            
            // 後方互換性のためローカルストレージにも保存
            
            showSuccess('設定を保存しました。');
            
        } catch (error) {
            console.error('設定保存エラー:', error);
            showError('設定の保存に失敗しました。');
        }
    }
    
    // デフォルトに戻す
    function resetToDefault() {
        currentSettings = getDefaultSettings();
        loadSettings();
        renderTimeSlots();
        showSuccess('設定をデフォルト値に戻しました。');
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
    
    // データマネージャーに設定取得関数を追加（後方互換性）
    if (typeof dataManager !== 'undefined') {
        // 同期版：既存コードとの互換性のため
        dataManager.getShiftConditions = function() {
            const saved = localStorage.getItem('shiftApp_shiftConditions');
            return saved ? JSON.parse(saved) : getDefaultSettings();
        };
        
        // 非同期版：新しいAPI対応
        dataManager.getShiftConditionsAsync = async function() {
            try {
                const apiData = await apiClient.getShiftConditions();
                // APIから取得した場合はlocalStorageにも保存（キャッシュ）
                localStorage.setItem('shiftApp_shiftConditions', JSON.stringify(apiData));
                return apiData;
            } catch (error) {
                console.warn('API経由でのシフト条件取得に失敗、localStorageを使用:', error);
                const saved = localStorage.getItem('shiftApp_shiftConditions');
                return saved ? JSON.parse(saved) : getDefaultSettings();
            }
        };
        
        dataManager.saveShiftConditions = async function(settings) {
            try {
                await apiClient.saveShiftConditions(settings);
            } catch (error) {
                console.warn('API経由でのシフト条件保存に失敗、localStorageに保存:', error);
            }
            // 常にlocalStorageにも保存（後方互換性）
            localStorage.setItem('shiftApp_shiftConditions', JSON.stringify(settings));
        };
    }
});