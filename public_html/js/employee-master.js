$(document).ready(function() {
    let currentEmployees = [];
    let businessTypes = [];
    let editingIndex = -1;
    
    // 初期表示
    loadData();
    
    // 新規追加ボタン
    $('#add-employee-btn').on('click', function() {
        openModal('新規従業員追加');
        clearForm();
        editingIndex = -1;
    });
    
    // キャンセルボタン
    $('#cancel-btn').on('click', function() {
        closeModal();
    });
    
    // フォーム送信
    $('#employee-form').on('submit', function(e) {
        e.preventDefault();
        saveEmployee();
    });
    
    // 業務区分追加ボタン
    $('#add-business-type-btn').on('click', function() {
        addBusinessTypeRow();
    });
    
    // 業務区分削除ボタン（動的要素用）
    $(document).on('click', '.remove-business-type-btn', function() {
        $(this).closest('.business-type-row').remove();
        updateMainBusinessTypeOptions();
    });
    
    // メイン業務区分変更時の処理
    $(document).on('change', '.main-business-type', function() {
        updateMainBusinessTypeOptions();
    });
    
    // 曜日時間追加ボタン（動的要素用）
    $(document).on('click', '.add-day-time-btn', function() {
        const day = $(this).data('day');
        addDayTimeRow(day);
    });
    
    // 曜日時間削除ボタン（動的要素用）
    $(document).on('click', '.remove-day-time-btn', function() {
        $(this).closest('.day-time-row').remove();
    });
    
    // データを読み込み
    async function loadData() {
        try {
            const apiEmployees = await apiClient.getEmployees();
            console.log('API従業員データ:', apiEmployees); // デバッグ用ログ
            
            currentEmployees = apiEmployees.map(emp => {
                try {
                    return dataConverter.employeeFromApi(emp);
                } catch (conversionError) {
                    console.error('従業員データ変換エラー:', conversionError, emp);
                    // 変換エラーの場合、基本データのみで作成
                    return {
                        code: emp.employee_code,
                        name: emp.name,
                        businessTypes: [{
                            code: emp.business_type === '調理' ? 'cooking' : 'office',
                            isMain: true
                        }],
                        password: emp.password,
                        conditions: {
                            weeklySchedule: {},
                            maxHoursPerDay: emp.work_limit_per_day || 8,
                            maxDaysPerWeek: 5
                        }
                    };
                }
            });
            
            businessTypes = dataManager.getBusinessTypes(); // 業務区分は従来通り
            renderEmployeeList();
        } catch (error) {
            console.error('従業員データ取得エラー:', error);
            alert('従業員データの取得に失敗しました。詳細はコンソールを確認してください。');
        }
    }
    
    // 従業員一覧を描画
    function renderEmployeeList() {
        let html = '<table class="table"><thead><tr>';
        html += '<th>従業員コード</th><th>氏名</th><th>業務区分</th><th>出勤可能曜日・時間</th><th>操作</th>';
        html += '</tr></thead><tbody>';
        
        currentEmployees.forEach((employee, index) => {
            const businessTypeText = formatBusinessTypes(employee.businessTypes);
            const weeklyScheduleText = formatWeeklySchedule(employee.conditions.weeklySchedule);
            
            html += `
                <tr>
                    <td>${employee.code}</td>
                    <td>${employee.name}</td>
                    <td>${businessTypeText}</td>
                    <td>${weeklyScheduleText}</td>
                    <td>
                        <button class="btn btn-primary edit-btn" data-index="${index}" style="margin-right: 5px;">編集</button>
                        <button class="btn btn-secondary delete-btn" data-index="${index}">削除</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        $('#employee-list').html(html);
        
        // イベントハンドラ設定
        $('.edit-btn').on('click', function() {
            const index = $(this).data('index');
            editEmployee(index);
        });
        
        $('.delete-btn').on('click', function() {
            const index = $(this).data('index');
            deleteEmployee(index);
        });
    }
    
    // 業務区分をフォーマット
    function formatBusinessTypes(employeeBusinessTypes) {
        if (!employeeBusinessTypes || employeeBusinessTypes.length === 0) {
            return '未設定';
        }
        
        return employeeBusinessTypes.map(bt => {
            const businessType = businessTypes.find(master => master.code === bt.code);
            const name = businessType ? businessType.name : bt.code;
            return bt.isMain ? `<strong>${name}(メイン)</strong>` : `${name}(サブ)`;
        }).join('<br>');
    }
    
    // 週間スケジュールをフォーマット
    function formatWeeklySchedule(weeklySchedule) {
        if (!weeklySchedule || Object.keys(weeklySchedule).length === 0) {
            return '未設定';
        }
        
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const scheduleText = [];
        
        for (let day = 0; day <= 6; day++) {
            if (weeklySchedule[day] && weeklySchedule[day].length > 0) {
                const times = weeklySchedule[day].join(', ');
                scheduleText.push(`${dayNames[day]}: ${times}`);
            }
        }
        
        return scheduleText.length > 0 ? scheduleText.join('<br>') : '未設定';
    }
    
    // モーダルを開く
    function openModal(title) {
        $('#modal-title').text(title);
        $('#employee-modal').show();
        
        // モーダルを開くたびに最新の時間帯マスタを反映
        updateExistingTimeSlots();
    }
    
    // 既存の時間帯選択肢を更新
    function updateExistingTimeSlots() {
        const timeSlots = getTimeSlots();
        
        $('.day-time-select').each(function() {
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
        $('#employee-modal').hide();
    }
    
    // フォームをクリア
    function clearForm() {
        $('#emp-code').val('').prop('readonly', false);
        $('#emp-name').val('');
        $('#emp-password').val('');
        $('#max-hours-per-day').val('8');
        $('#max-days-per-week').val('5');
        
        // 業務区分をリセット
        $('#business-types-container').empty();
        addBusinessTypeRow();
        
        // 曜日別スケジュールをリセット
        initializeWeeklySchedule();
    }
    
    // 従業員編集
    function editEmployee(index) {
        const employee = currentEmployees[index];
        editingIndex = index;
        
        openModal('従業員情報編集');
        
        $('#emp-code').val(employee.code).prop('readonly', true);
        $('#emp-name').val(employee.name);
        $('#emp-password').val(employee.password);
        $('#max-hours-per-day').val(employee.conditions.maxHoursPerDay);
        $('#max-days-per-week').val(employee.conditions.maxDaysPerWeek);
        
        // 業務区分を設定
        $('#business-types-container').empty();
        if (employee.businessTypes && employee.businessTypes.length > 0) {
            employee.businessTypes.forEach(bt => {
                addBusinessTypeRow(bt.code, bt.isMain);
            });
        } else {
            addBusinessTypeRow();
        }
        
        // 曜日別スケジュールを設定
        initializeWeeklySchedule(employee.conditions.weeklySchedule);
    }
    
    // 従業員削除
    async function deleteEmployee(index) {
        const employee = currentEmployees[index];
        if (confirm(`${employee.name}さんを削除しますか？\nこの操作は取り消せません。`)) {
            try {
                await apiClient.deleteEmployee(employee.code);
                currentEmployees.splice(index, 1);
                renderEmployeeList();
                showSuccess('従業員を削除しました。');
            } catch (error) {
                console.error('従業員削除エラー:', error);
                showError('従業員削除に失敗しました。');
            }
        }
    }
    
    // 業務区分行を追加
    function addBusinessTypeRow(selectedCode = '', isMain = false) {
        let businessTypeOptions = '<option value="">選択してください</option>';
        businessTypes.forEach(bt => {
            const selected = bt.code === selectedCode ? 'selected' : '';
            businessTypeOptions += `<option value="${bt.code}" ${selected}>${bt.name}</option>`;
        });
        
        const html = `
            <div class="business-type-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <div style="flex: 2;">
                    <select class="form-control business-type-select">
                        ${businessTypeOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label>
                        <input type="radio" name="main-business-type" class="main-business-type" ${isMain ? 'checked' : ''}>
                        メイン
                    </label>
                </div>
                <div>
                    <button type="button" class="btn btn-secondary remove-business-type-btn">削除</button>
                </div>
            </div>
        `;
        $('#business-types-container').append(html);
        updateMainBusinessTypeOptions();
    }
    
    // メイン業務区分オプションを更新
    function updateMainBusinessTypeOptions() {
        const businessTypeRows = $('#business-types-container .business-type-row');
        
        // 最低1つはメインが必要
        if (businessTypeRows.length > 0) {
            const checkedRadios = $('.main-business-type:checked');
            if (checkedRadios.length === 0) {
                // メインが選択されていない場合は最初の行をメインにする
                businessTypeRows.first().find('.main-business-type').prop('checked', true);
            }
        }
    }
    
    // 週間スケジュールを初期化
    function initializeWeeklySchedule(scheduleData = {}) {
        const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
        let html = '';
        
        for (let day = 0; day <= 6; day++) {
            html += `
                <div class="card" style="margin-bottom: 15px; padding: 15px;">
                    <h5 style="color: #2c3e50; margin-bottom: 10px;">${dayNames[day]}</h5>
                    <div id="day-${day}-times">
                        <!-- 時間帯はJavaScriptで生成 -->
                    </div>
                    <button type="button" class="btn btn-primary add-day-time-btn" data-day="${day}">時間帯追加</button>
                </div>
            `;
        }
        
        $('#weekly-schedule-container').html(html);
        
        // 各曜日の時間帯を設定
        for (let day = 0; day <= 6; day++) {
            const dayTimes = scheduleData[day] || [];
            if (dayTimes.length > 0) {
                dayTimes.forEach(time => {
                    addDayTimeRow(day, time);
                });
            }
        }
    }
    
    // 時間帯オプションをシフト条件設定から取得
    function getTimeSlots() {
        if (typeof dataManager !== 'undefined' && dataManager.getShiftConditions) {
            const conditions = dataManager.getShiftConditions();
            const timeSlots = conditions.timeSlots || [
                '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00',
                '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00'
            ];
            // 従業員マスタでは「終日」を先頭に追加
            return ['終日'].concat(timeSlots);
        }
        // フォールバック用の固定値
        return [
            '終日', '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00', 
            '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00'
        ];
    }

    // 曜日の時間帯行を追加
    function addDayTimeRow(day, selectedTime = '') {
        const timeOptions = getTimeSlots();
        
        let timeOptionsHtml = '<option value="">選択してください</option>';
        timeOptions.forEach(time => {
            const selected = time === selectedTime ? 'selected' : '';
            timeOptionsHtml += `<option value="${time}" ${selected}>${time}</option>`;
        });
        
        const html = `
            <div class="day-time-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <select class="form-control day-time-select" style="flex: 1;">
                    ${timeOptionsHtml}
                </select>
                <button type="button" class="btn btn-secondary remove-day-time-btn">削除</button>
            </div>
        `;
        
        $(`#day-${day}-times`).append(html);
    }
    
    // 従業員保存
    async function saveEmployee() {
        // 入力値取得
        const code = $('#emp-code').val().trim();
        const name = $('#emp-name').val().trim();
        const password = $('#emp-password').val().trim();
        const maxHoursPerDay = parseInt($('#max-hours-per-day').val()) || 8;
        const maxDaysPerWeek = parseInt($('#max-days-per-week').val()) || 5;
        
        // バリデーション
        if (!code || !name || !password) {
            showError('全ての必須項目を入力してください。');
            return;
        }
        
        // 業務区分を取得
        const employeeBusinessTypes = [];
        $('.business-type-row').each(function() {
            const businessTypeCode = $(this).find('.business-type-select').val();
            const isMain = $(this).find('.main-business-type').is(':checked');
            
            if (businessTypeCode) {
                employeeBusinessTypes.push({
                    code: businessTypeCode,
                    isMain: isMain
                });
            }
        });
        
        if (employeeBusinessTypes.length === 0) {
            showError('業務区分を1つ以上選択してください。');
            return;
        }
        
        // メイン業務区分が1つだけかチェック
        const mainBusinessTypes = employeeBusinessTypes.filter(bt => bt.isMain);
        if (mainBusinessTypes.length !== 1) {
            showError('メイン業務区分を1つ選択してください。');
            return;
        }
        
        // 週間スケジュールを取得
        const weeklySchedule = {};
        for (let day = 0; day <= 6; day++) {
            const dayTimes = [];
            $(`#day-${day}-times .day-time-select`).each(function() {
                const time = $(this).val();
                if (time && !dayTimes.includes(time)) {
                    dayTimes.push(time);
                }
            });
            if (dayTimes.length > 0) {
                weeklySchedule[day] = dayTimes;
            }
        }
        
        // 従業員データを作成
        const employeeData = {
            code: code,
            name: name,
            businessTypes: employeeBusinessTypes,
            password: password,
            conditions: {
                weeklySchedule: weeklySchedule,
                maxHoursPerDay: maxHoursPerDay,
                maxDaysPerWeek: maxDaysPerWeek
            }
        };
        
        // 保存
        try {
            // API形式に変換
            const apiEmployee = dataConverter.employeeToApi(employeeData);
            
            if (editingIndex === -1) {
                // 新規追加
                await apiClient.saveEmployee(apiEmployee, false);
                showSuccess('新規従業員を追加しました。');
            } else {
                // 更新
                await apiClient.saveEmployee(apiEmployee, true);
                showSuccess('従業員情報を更新しました。');
            }
            
            // データを再読み込み
            await loadData();
            closeModal();
        } catch (error) {
            console.error('従業員保存エラー:', error);
            showError('従業員の保存に失敗しました。');
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