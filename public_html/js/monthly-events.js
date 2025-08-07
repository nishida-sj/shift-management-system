$(document).ready(function() {
    let currentDate = new Date();
    let eventMaster = [];
    let monthlyEvents = {};
    
    // 初期表示
    loadData();
    renderCalendar();
    renderEventMasterList();
    
    // 月移動ボタン
    $('#prev-month').on('click', function() {
        saveCurrentMonth();
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadData();
        renderCalendar();
    });
    
    $('#next-month').on('click', function() {
        saveCurrentMonth();
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadData();
        renderCalendar();
    });
    
    // 保存ボタン
    $('#save-btn').on('click', function() {
        saveCurrentMonth();
        showSuccess('月間行事予定を保存しました。');
    });
    
    // 全てクリアボタン
    $('#clear-month-btn').on('click', function() {
        if (confirm('この月の全ての行事予定をクリアしますか？')) {
            clearAllEvents();
        }
    });
    
    // データ読み込み
    function loadData() {
        eventMaster = dataManager.getEvents();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        monthlyEvents = dataManager.getMonthlyEvents(year, month);
    }
    
    // 現在の月のデータを保存
    function saveCurrentMonth() {
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
        eventMaster.forEach(event => {
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
            
            if (eventId) {
                const event = eventMaster.find(e => e.id === eventId);
                if (event) {
                    let infoText = '';
                    
                    // 事務業務要件
                    if (event.requirements.office && event.requirements.office.length > 0) {
                        infoText += '<div style="color: #2980b9;"><strong>事務:</strong>';
                        event.requirements.office.forEach(req => {
                            infoText += `<br>${req.time}(${req.count}人)`;
                        });
                        infoText += '</div>';
                    }
                    
                    // 調理業務要件
                    if (event.requirements.cooking && event.requirements.cooking.length > 0) {
                        infoText += '<div style="color: #e67e22; margin-top: 5px;"><strong>調理:</strong>';
                        event.requirements.cooking.forEach(req => {
                            infoText += `<br>${req.time}(${req.count}人)`;
                        });
                        infoText += '</div>';
                    }
                    
                    infoContainer.html(infoText);
                } else {
                    infoContainer.html('<span style="color: #e74c3c;">行事が見つかりません</span>');
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