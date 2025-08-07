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
    
    // 曜日の時間帯行を追加
    function addDayTimeRow(day, selectedTime = '') {
        const timeOptions = [
            '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00', 
            '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00'
        ];
        
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
    function saveEmployee() {
        // 入力値取得
        const code = $('#emp-code').val().trim();
        const name = $('#emp-name').val().trim();
        const password = $('#emp-password').val().trim();
        const maxHoursPerDay = parseInt($('#max-hours-per-day').val());
        const maxDaysPerWeek = parseInt($('#max-days-per-week').val());
        
        // バリデーション
        if (!code || !name || !password) {
            showError('全ての必須項目を入力してください。');
            return;
        }
        
        // 従業員コードの重複チェック（新規の場合）
        if (editingIndex === -1) {
            const existingEmployee = currentEmployees.find(emp => emp.code === code);
            if (existingEmployee) {
                showError('この従業員コードは既に使用されています。');
                return;
            }
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
        if (editingIndex === -1) {
            // 新規追加
            currentEmployees.push(employeeData);
            showSuccess('新規従業員を追加しました。');
        } else {
            // 更新
            currentEmployees[editingIndex] = employeeData;
            showSuccess('従業員情報を更新しました。');
        }
        
        dataManager.saveEmployees(currentEmployees);
        renderEmployeeList();
        closeModal();
    }