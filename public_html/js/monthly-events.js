$(document).ready(function() {
    let currentDate = new Date();
    let eventMaster = [];
    let monthlyEvents = {};
    
    console.log('月間行事予定: ページ読み込み開始');
    console.log('apiClient利用可能:', typeof apiClient !== 'undefined');
    console.log('dataConverter利用可能:', typeof dataConverter !== 'undefined');
    
    // 初期表示
    async function initialize() {
        await loadData();
        renderCalendar();
        renderEventMasterList();
    }
    
    initialize();
    
    // 月移動ボタン
    $('#prev-month').on('click', async function() {
        saveCurrentMonth();
        currentDate.setMonth(currentDate.getMonth() - 1);
        await loadData();
        renderCalendar();
        renderEventMasterList();
    });
    
    $('#next-month').on('click', async function() {
        saveCurrentMonth();
        currentDate.setMonth(currentDate.getMonth() + 1);
        await loadData();
        renderCalendar();
        renderEventMasterList();
    });
    
    // 保存ボタン
    $('#save-btn').on('click', async function() {
        await saveCurrentMonth();
        showSuccess('月間行事予定を保存しました。');
    });
    
    // 全てクリアボタン
    $('#clear-month-btn').on('click', function() {
        if (confirm('この月の全ての行事予定をクリアしますか？')) {
            clearAllEvents();
        }
    });
    
    // データ読み込み
    async function loadData() {
        try {
            console.log('月間行事予定: データ読み込み開始');
            
            // APIから行事マスタと月間行事予定を取得
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const [apiEvents, apiMonthlyEvents] = await Promise.all([
                apiClient.getEvents(),
                apiClient.getMonthlyEvents(year, month)
            ]);
            
            eventMaster = apiEvents.map(event => dataConverter.eventFromApi(event));
            console.log('月間行事予定: 取得した行事数:', eventMaster.length);
            
            // APIから取得した月間行事予定を変換
            monthlyEvents = convertMonthlyEventsFromApi(apiMonthlyEvents);
            console.log('月間行事予定: 取得した月間行事予定:', Object.keys(monthlyEvents).length);
            
        } catch (error) {
            console.error('月間行事予定: データ取得エラー:', error);
            
            // エラー時はlocalStorageからフォールバック
            eventMaster = dataManager.getEvents();
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            monthlyEvents = dataManager.getMonthlyEvents(year, month);
            
            showError('行事データの取得に失敗しました。ローカルデータを使用します。');
        }
    }
    
    // 現在の月のデータを保存
    async function saveCurrentMonth() {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            // 現在の設定を取得
            const newEvents = {};
            $('.event-select').each(function() {
                const date = $(this).data('date');
                const eventId = $(this).val();
                if (eventId) {
                    newEvents[date] = eventId;
                }
            });
            
            // 削除が必要な日付を特定
            const currentMonthEvents = await apiClient.getMonthlyEvents(year, month);
            const deletePromises = [];
            
            Object.keys(currentMonthEvents).forEach(dateKey => {
                if (!newEvents[dateKey]) {
                    // この日付の行事予定を削除
                    const date = new Date(dateKey);
                    deletePromises.push(
                        apiClient.deleteMonthlyEvent(year, month, date.getDate())
                    );
                }
            });
            
            // 追加・更新が必要な日付を特定
            const savePromises = [];
            Object.keys(newEvents).forEach(dateKey => {
                const date = new Date(dateKey);
                const eventId = newEvents[dateKey];
                savePromises.push(
                    apiClient.saveMonthlyEvent(year, month, date.getDate(), parseInt(eventId))
                );
            });
            
            // 削除・保存を実行
            await Promise.all([...deletePromises, ...savePromises]);
            
            // ローカルストレージも更新（フォールバック用）
            dataManager.saveMonthlyEvents(year, month, newEvents);
            
        } catch (error) {
            console.error('月間行事予定保存エラー:', error);
            // エラー時はローカルストレージのみ更新
            const events = {};
            $('.event-select').each(function() {
                const date = $(this).data('date');
                const eventId = $(this).val();
                if (eventId) {
                    events[date] = eventId;
                }
            });
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            dataManager.saveMonthlyEvents(year, month, events);
            
            showError('月間行事予定の保存に失敗しました。ローカル保存のみ実行しました。');
        }
    }
    
    // カレンダー描画
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 月表示を更新
        $('#current-month').text(year + '年' + (month + 1) + '月の行事予定');
        
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        
        let calendarHtml = '<div class="date-grid">';
        
        // 行事選択オプションを作成
        let eventOptions = '<option value="">選択なし</option>';
        console.log('カレンダー描画: 行事選択肢を作成中');
        eventMaster.forEach(event => {
            console.log(`  行事: ID=${event.id}(${typeof event.id}), 名前=${event.name}`);
            eventOptions += `<option value="${event.id}">${event.name}</option>`;
        });
        
        // 各日のカレンダーアイテムを生成
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            const dateString = formatDate(date);
            
            // 土日祝日の判定
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = isWeekend; // 簡易的に土日を祝日扱い
            
            const dayClass = isHoliday ? 'holiday' : (isWeekend ? 'weekend' : '');
            
            // 保存されている行事を取得
            const selectedEventId = monthlyEvents[dateString] || '';
            
            calendarHtml += `
                <div class="date-item ${dayClass}">
                    <div class="date-number">${day}</div>
                    <div class="day-name">(${dayNames[dayOfWeek]})</div>
                    <select class="event-select form-control" data-date="${dateString}" style="font-size: 12px;">
                        ${eventOptions}
                    </select>
                    <div class="event-info" style="margin-top: 10px; font-size: 11px; color: #666;">
                        <!-- 行事情報はJavaScriptで更新 -->
                    </div>
                </div>
            `;
        }
        
        calendarHtml += '</div>';
        $('#calendar-container').html(calendarHtml);
        
        // 保存されていた選択状態を復元
        $('.event-select').each(function() {
            const date = $(this).data('date');
            const savedEventId = monthlyEvents[date];
            if (savedEventId) {
                $(this).val(savedEventId);
            }
        });
        
        // 行事情報を更新
        updateEventInfo();
        
        // 行事選択時のイベントハンドラ
        $('.event-select').on('change', function() {
            updateEventInfo();
        });
    }
    
    // 行事情報を更新
    function updateEventInfo() {
        $('.event-select').each(function() {
            const eventId = $(this).val();
            const infoContainer = $(this).siblings('.event-info');
            
            console.log('行事情報更新: 選択されたID =', eventId, '(型:', typeof eventId, ')');
            
            if (eventId) {
                // IDの型変換を試す（文字列→数値、数値→文字列）
                const event = eventMaster.find(e => {
                    const match = e.id == eventId || e.id === eventId || e.id === parseInt(eventId) || e.id === String(eventId);
                    if (match) {
                        console.log('行事発見:', e.id, '(型:', typeof e.id, ') = ', e.name);
                    }
                    return match;
                });
                
                if (event) {
                    console.log('行事詳細:', event);
                    let infoText = '';
                    
                    // 事務業務要件
                    if (event.requirements && event.requirements.office && event.requirements.office.length > 0) {
                        infoText += '<div style="color: #2980b9;"><strong>事務:</strong>';
                        event.requirements.office.forEach(req => {
                            infoText += `<br>${req.time}(${req.count}人)`;
                        });
                        infoText += '</div>';
                    }
                    
                    // 調理業務要件
                    if (event.requirements && event.requirements.cooking && event.requirements.cooking.length > 0) {
                        infoText += '<div style="color: #e67e22; margin-top: 5px;"><strong>調理:</strong>';
                        event.requirements.cooking.forEach(req => {
                            infoText += `<br>${req.time}(${req.count}人)`;
                        });
                        infoText += '</div>';
                    }
                    
                    if (!infoText) {
                        infoText = '<div style="color: #666;">要件設定なし</div>';
                    }
                    
                    infoContainer.html(infoText);
                } else {
                    console.error('行事が見つかりません。利用可能な行事:', eventMaster.map(e => ({ id: e.id, type: typeof e.id, name: e.name })));
                    infoContainer.html('<span style="color: #e74c3c;">行事が見つかりません (ID: ' + eventId + ')</span>');
                }
            } else {
                infoContainer.html('');
            }
        });
    }
    
    // 行事マスタ一覧を描画
    function renderEventMasterList() {
        let html = '';
        
        if (eventMaster.length === 0) {
            html = '<p style="color: #666;">登録済みの行事がありません。先に「行事マスタ」で行事を登録してください。</p>';
        } else {
            eventMaster.forEach(event => {
                html += `<div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">`;
                html += `<strong>${event.name}</strong> (ID: ${event.id})<br>`;
                
                // 事務業務要件
                if (event.requirements.office && event.requirements.office.length > 0) {
                    html += '<span style="color: #2980b9;">事務業務: ';
                    html += event.requirements.office.map(req => `${req.time}(${req.count}人)`).join(', ');
                    html += '</span><br>';
                }
                
                // 調理業務要件
                if (event.requirements.cooking && event.requirements.cooking.length > 0) {
                    html += '<span style="color: #e67e22;">調理業務: ';
                    html += event.requirements.cooking.map(req => `${req.time}(${req.count}人)`).join(', ');
                    html += '</span>';
                }
                
                html += '</div>';
            });
        }
        
        $('#event-master-list').html(html);
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
    
    // 全ての行事をクリア
    function clearAllEvents() {
        $('.event-select').val('');
        updateEventInfo();
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        dataManager.saveMonthlyEvents(year, month, {});
        
        showSuccess('全ての行事予定をクリアしました。');
    }
    
    // 日付フォーマット
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
});