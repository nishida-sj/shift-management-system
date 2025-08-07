$(document).ready(function() {
    let currentEvents = [];
    let editingIndex = -1;
    
    // 時間帯オプションをシフト条件設定から取得
    function getTimeSlots() {
        if (typeof dataManager !== 'undefined' && dataManager.getShiftConditions) {
            const conditions = dataManager.getShiftConditions();
            console.log('行事マスタ: 時間帯マスタから取得:', conditions.timeSlots);
            return conditions.timeSlots || [
                '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00',
                '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00', '13:00-21:00'
            ];
        }
        console.log('行事マスタ: フォールバック値を使用');
        // フォールバック用の固定値
        return [
            '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00',
            '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00', '13:00-21:00'
        ];
    }
    
    // 初期表示
    loadEvents();
    
    // 新規追加ボタン
    $('#add-event-btn').on('click', function() {
        openModal('新規行事追加');
        clearForm();
        editingIndex = -1;
    });
    
    // キャンセルボタン
    $('#cancel-btn').on('click', function() {
        closeModal();
    });
    
    // フォーム送信
    $('#event-form').on('submit', function(e) {
        e.preventDefault();
        saveEvent();
    });
    
    // 要件追加ボタン
    $('#add-office-req-btn').on('click', function() {
        addRequirementRow('office');
    });
    
    $('#add-cooking-req-btn').on('click', function() {
        addRequirementRow('cooking');
    });
    
    // 要件削除ボタン（動的要素用）
    $(document).on('click', '.remove-req-btn', function() {
        $(this).closest('.requirement-row').remove();
    });
    
    // 行事一覧を読み込み
    async function loadEvents() {
        try {
            const apiEvents = await apiClient.getEvents();
            currentEvents = apiEvents.map(event => dataConverter.eventFromApi(event));
            renderEventList();
        } catch (error) {
            console.error('行事データ取得エラー:', error);
            alert('行事データの取得に失敗しました。');
        }
    }
    
    // 行事一覧を描画
    function renderEventList() {
        let html = '<table class="table"><thead><tr>';
        html += '<th>行事ID</th><th>行事名</th><th>事務業務要件</th><th>調理業務要件</th><th>操作</th>';
        html += '</tr></thead><tbody>';
        
        currentEvents.forEach((event, index) => {
            const officeReqs = formatRequirements(event.requirements.office);
            const cookingReqs = formatRequirements(event.requirements.cooking);
            
            html += `
                <tr>
                    <td>${event.id}</td>
                    <td>${event.name}</td>
                    <td>${officeReqs}</td>
                    <td>${cookingReqs}</td>
                    <td>
                        <button class="btn btn-primary edit-btn" data-index="${index}" style="margin-right: 5px;">編集</button>
                        <button class="btn btn-secondary delete-btn" data-index="${index}">削除</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        $('#event-list').html(html);
        
        // イベントハンドラ設定
        $('.edit-btn').on('click', function() {
            const index = $(this).data('index');
            editEvent(index);
        });
        
        $('.delete-btn').on('click', function() {
            const index = $(this).data('index');
            deleteEvent(index);
        });
    }
    
    // 要件をフォーマット
    function formatRequirements(requirements) {
        if (!requirements || requirements.length === 0) {
            return '設定なし';
        }
        
        return requirements.map(req => `${req.time} (${req.count}人)`).join('<br>');
    }
    
    // モーダルを開く
    function openModal(title) {
        $('#modal-title').text(title);
        $('#event-modal').show();
        
        // モーダルを開くたびに最新の時間帯マスタを反映
        updateExistingTimeSlots();
    }
    
    // 既存の時間帯選択肢を更新
    function updateExistingTimeSlots() {
        const timeSlots = getTimeSlots();
        
        $('.req-time').each(function() {
            const currentValue = $(this).val();
            let options = '<option value="">選択してください</option>';
            
            timeSlots.forEach(time => {
                const selected = time === currentValue ? 'selected' : '';
                options += `<option value="${time}" ${selected}>${time}</option>`;
            });
            
            $(this).html(options);
        });
    }
    
    // モーダルを閉じる
    function closeModal() {
        $('#event-modal').hide();
    }
    
    // フォームをクリア
    function clearForm() {
        $('#event-id').val('').prop('readonly', false);
        $('#event-name').val('');
        $('#office-requirements').empty();
        $('#cooking-requirements').empty();
        
        // デフォルトで1つずつ要件を追加
        addRequirementRow('office');
        addRequirementRow('cooking');
    }
    
    // 行事編集
    function editEvent(index) {
        const event = currentEvents[index];
        editingIndex = index;
        
        openModal('行事情報編集');
        
        $('#event-id').val(event.id).prop('readonly', true);
        $('#event-name').val(event.name);
        
        // 要件をクリア
        $('#office-requirements').empty();
        $('#cooking-requirements').empty();
        
        // 事務業務要件を設定
        if (event.requirements.office && event.requirements.office.length > 0) {
            event.requirements.office.forEach(req => {
                addRequirementRow('office', req.time, req.count);
            });
        } else {
            addRequirementRow('office');
        }
        
        // 調理業務要件を設定
        if (event.requirements.cooking && event.requirements.cooking.length > 0) {
            event.requirements.cooking.forEach(req => {
                addRequirementRow('cooking', req.time, req.count);
            });
        } else {
            addRequirementRow('cooking');
        }
    }
    
    // 行事削除
    async function deleteEvent(index) {
        const event = currentEvents[index];
        if (confirm(`行事「${event.name}」を削除しますか？\nこの操作は取り消せません。`)) {
            try {
                await apiClient.deleteEvent(event.id);
                currentEvents.splice(index, 1);
                renderEventList();
                showSuccess('行事を削除しました。');
            } catch (error) {
                console.error('行事削除エラー:', error);
                showError('行事削除に失敗しました。');
            }
        }
    }
    
    // 要件行を追加
    function addRequirementRow(businessType, selectedTime = '', count = 1) {
        const containerId = businessType === 'office' ? '#office-requirements' : '#cooking-requirements';
        
        let timeOptions = '<option value="">選択してください</option>';
        const timeSlots = getTimeSlots();
        console.log('行事マスタ: addRequirementRow で使用する時間帯:', timeSlots);
        timeSlots.forEach(time => {
            const selected = time === selectedTime ? 'selected' : '';
            timeOptions += `<option value="${time}" ${selected}>${time}</option>`;
        });
        
        const html = `
            <div class="requirement-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <div style="flex: 2;">
                    <label style="font-size: 12px; color: #666;">時間帯</label>
                    <select class="form-control req-time">
                        ${timeOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 12px; color: #666;">必要人数</label>
                    <input type="number" class="form-control req-count" min="1" max="10" value="${count}">
                </div>
                <div style="align-self: flex-end;">
                    <button type="button" class="btn btn-secondary remove-req-btn">削除</button>
                </div>
            </div>
        `;
        $(containerId).append(html);
    }
    
    // 行事保存
    async function saveEvent() {
        // 入力値取得
        const id = $('#event-id').val().trim();
        const name = $('#event-name').val().trim();
        
        // バリデーション
        if (!name) {
            showError('行事名を入力してください。');
            return;
        }
        
        // 事務業務要件を取得
        const officeRequirements = [];
        $('#office-requirements .requirement-row').each(function() {
            const time = $(this).find('.req-time').val();
            const count = parseInt($(this).find('.req-count').val());
            if (time && count > 0) {
                officeRequirements.push({ time: time, count: count });
            }
        });
        
        // 調理業務要件を取得
        const cookingRequirements = [];
        $('#cooking-requirements .requirement-row').each(function() {
            const time = $(this).find('.req-time').val();
            const count = parseInt($(this).find('.req-count').val());
            if (time && count > 0) {
                cookingRequirements.push({ time: time, count: count });
            }
        });
        
        if (officeRequirements.length === 0 && cookingRequirements.length === 0) {
            showError('事務業務または調理業務の要件を1つ以上設定してください。');
            return;
        }
        
        // 行事データを作成
        const eventData = {
            name: name,
            requirements: {
                office: officeRequirements,
                cooking: cookingRequirements
            }
        };
        
        // 更新の場合のみIDを設定
        if (editingIndex !== -1 && id) {
            eventData.id = id;
        }
        
        // 保存
        try {
            // API形式に変換
            const apiEvent = dataConverter.eventToApi(eventData);
            
            if (editingIndex === -1) {
                // 新規追加
                await apiClient.saveEvent(apiEvent);
                showSuccess('新規行事を追加しました。');
            } else {
                // 更新
                await apiClient.saveEvent(apiEvent);
                showSuccess('行事情報を更新しました。');
            }
            
            // データを再読み込み
            await loadEvents();
            closeModal();
        } catch (error) {
            console.error('行事保存エラー:', error);
            showError('行事の保存に失敗しました。');
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
});