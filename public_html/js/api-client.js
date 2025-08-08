// APIクライアント
// localStorage から MySQL API への移行用

class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.cache = new Map(); // シンプルなキャッシュ
    }

    // HTTP リクエスト共通処理
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // GET リクエスト
    async get(endpoint, params = {}) {
        const searchParams = new URLSearchParams(params);
        const fullEndpoint = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
        return this.request(fullEndpoint, { method: 'GET' });
    }

    // POST リクエスト
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT リクエスト
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE リクエスト
    async delete(endpoint, params = {}) {
        const searchParams = new URLSearchParams(params);
        const fullEndpoint = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
        return this.request(fullEndpoint, { method: 'DELETE' });
    }

    // 認証
    async login(username, password) {
        return this.post('/auth.php', { username, password });
    }

    // 従業員マスタ
    async getEmployees() {
        return this.get('/employees.php');
    }

    async getEmployee(employee_code, includePassword = false) {
        return this.get('/employees.php', { 
            employee_code, 
            include_password: includePassword 
        });
    }

    async saveEmployee(employee, isUpdate = false) {
        if (isUpdate) {
            return this.put('/employees.php', employee);
        } else {
            return this.post('/employees.php', employee);
        }
    }

    async deleteEmployee(employee_code) {
        return this.delete('/employees.php', { employee_code });
    }

    // 行事マスタ
    async getEvents() {
        return this.get('/events.php');
    }

    async saveEvent(event) {
        if (event.event_id) {
            return this.put('/events.php', event);
        } else {
            return this.post('/events.php', event);
        }
    }

    async deleteEvent(event_id) {
        return this.delete('/events.php', { event_id });
    }

    // 休み希望
    async getShiftRequests(employee_code, year, month) {
        return this.get('/shifts.php', {
            type: 'requests',
            employee_code,
            year,
            month
        });
    }

    async saveShiftRequests(employee_code, year, month, requests) {
        return this.post('/shifts.php', {
            type: 'requests',
            employee_code,
            year,
            month,
            requests
        });
    }

    // 確定シフト
    async getConfirmedShifts(year, month) {
        return this.get('/shifts.php', {
            type: 'confirmed',
            year,
            month
        });
    }

    async saveConfirmedShifts(year, month, shifts) {
        return this.post('/shifts.php', {
            type: 'confirmed',
            year,
            month,
            shifts
        });
    }

    // 月間行事予定（新しいAPIエンドポイント）
    async getMonthlyEvents(year, month) {
        return this.get('/monthly-events.php', { year, month });
    }

    async saveMonthlyEvent(year, month, day, event_id) {
        return this.post('/monthly-events.php', {
            year,
            month,
            day,
            event_id
        });
    }

    async deleteMonthlyEvent(year, month, day, event_id = null) {
        const params = { year, month, day };
        if (event_id) {
            params.event_id = event_id;
        }
        return this.delete('/monthly-events.php', params);
    }

    // シフト状態
    async getShiftStatus(year, month) {
        return this.get('/shifts.php', {
            type: 'status',
            year,
            month
        });
    }

    async saveShiftStatus(year, month, is_confirmed) {
        return this.post('/shifts.php', {
            type: 'status',
            year,
            month,
            is_confirmed
        });
    }

    // シフト備考
    async getShiftNotes(year, month) {
        return this.get('/shifts.php', {
            type: 'notes',
            year,
            month
        });
    }

    async saveShiftNotes(year, month, notes) {
        return this.post('/shifts.php', {
            type: 'notes',
            year,
            month,
            notes
        });
    }
}

// データ形式変換ユーティリティ
class DataConverter {
    // localStorage形式からAPI形式への変換（従業員）
    static employeeToApi(localEmployee) {
        const availableDays = [];
        const weeklySchedule = {};
        
        if (localEmployee.conditions && localEmployee.conditions.weeklySchedule) {
            Object.keys(localEmployee.conditions.weeklySchedule).forEach(day => {
                const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                const dayName = dayNames[parseInt(day)];
                availableDays.push(dayName);
                
                // 曜日別時間帯をweekly_scheduleに設定
                weeklySchedule[dayName] = localEmployee.conditions.weeklySchedule[day];
            });
        }

        // メイン業務区分を取得
        let businessType = '事務';
        if (localEmployee.businessTypes) {
            const mainBusiness = localEmployee.businessTypes.find(bt => bt.isMain);
            if (mainBusiness) {
                businessType = mainBusiness.code === 'cooking' ? '調理' : '事務';
            }
        }

        return {
            employee_code: localEmployee.code,
            name: localEmployee.name,
            business_type: businessType,
            password: localEmployee.password,
            available_days: availableDays,
            preferred_time_start: this.extractFirstTimeStart(localEmployee.conditions),
            preferred_time_end: this.extractFirstTimeEnd(localEmployee.conditions),
            weekly_schedule: weeklySchedule, // 新しい曜日別時間帯
            work_limit_per_day: localEmployee.conditions?.maxHoursPerDay || 8,
            work_limit_per_month: (localEmployee.conditions?.maxDaysPerWeek || 5) * 4 * (localEmployee.conditions?.maxHoursPerDay || 8)
        };
    }

    // API形式からlocalStorage形式への変換（従業員）
    static employeeFromApi(apiEmployee) {
        let weeklySchedule = {};
        const dayMap = {'日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6};
        
        console.log('=== API従業員データ変換 ===');
        console.log('従業員名:', apiEmployee.name);
        
        // 新しいweekly_scheduleフィールドを優先的に使用
        if (apiEmployee.weekly_schedule) {
            console.log('weekly_scheduleデータを使用:', apiEmployee.weekly_schedule);
            
            Object.keys(apiEmployee.weekly_schedule).forEach(dayName => {
                const dayNum = dayMap[dayName];
                if (dayNum !== undefined && apiEmployee.weekly_schedule[dayName]) {
                    weeklySchedule[dayNum] = apiEmployee.weekly_schedule[dayName];
                    console.log(`✓ 曜日${dayNum}(${dayName})に時間設定:`, weeklySchedule[dayNum]);
                }
            });
        } else {
            // フォールバック: 従来のavailable_days + preferred_time_*を使用
            console.log('フォールバック: available_days + preferred_timeを使用');
            
            let availableDays = apiEmployee.available_days;
            if (typeof availableDays === 'string') {
                try {
                    availableDays = JSON.parse(availableDays);
                } catch (e) {
                    console.error('available_days JSON parse error:', e);
                    availableDays = [];
                }
            }
            
            if (availableDays && Array.isArray(availableDays)) {
                console.log('利用可能日:', availableDays);
                console.log('希望開始時間:', apiEmployee.preferred_time_start);
                console.log('希望終了時間:', apiEmployee.preferred_time_end);
                
                availableDays.forEach(dayName => {
                    const dayNum = dayMap[dayName];
                    console.log(`処理中: ${dayName} (番号: ${dayNum})`);
                    
                    if (dayNum !== undefined && apiEmployee.preferred_time_start && apiEmployee.preferred_time_end) {
                        // 秒を除去して HH:MM 形式に変換
                        const startTime = apiEmployee.preferred_time_start.substring(0, 5);
                        const endTime = apiEmployee.preferred_time_end.substring(0, 5);
                        const timeRange = `${startTime}-${endTime}`;
                        
                        weeklySchedule[dayNum] = [timeRange];
                        console.log(`✓ 曜日${dayNum}(${dayName})に時間設定: "${timeRange}"`);
                    }
                });
            }
        }
        
        console.log('最終的な週間スケジュール:', weeklySchedule);

        return {
            code: apiEmployee.employee_code,
            name: apiEmployee.name,
            businessTypes: [{
                code: apiEmployee.business_type === '調理' ? 'cooking' : 'office',
                isMain: true
            }],
            password: apiEmployee.password,
            conditions: {
                weeklySchedule,
                maxHoursPerDay: apiEmployee.work_limit_per_day || 8,
                maxDaysPerWeek: Math.floor((apiEmployee.work_limit_per_month || 160) / (apiEmployee.work_limit_per_day || 8) / 4)
            }
        };
    }

    // localStorage形式からAPI形式への変換（行事）
    static eventToApi(localEvent) {
        const officeReq = localEvent.requirements?.office || [];
        const kitchenReq = localEvent.requirements?.cooking || [];

        const apiEvent = {
            event_name: localEvent.name,
            // 後方互換性のため、最初の要件を従来フィールドにも設定
            office_required: officeReq.length > 0 ? officeReq[0].count : 0,
            office_time_start: officeReq.length > 0 ? officeReq[0].time.split('-')[0] : null,
            office_time_end: officeReq.length > 0 ? officeReq[0].time.split('-')[1] : null,
            kitchen_required: kitchenReq.length > 0 ? kitchenReq[0].count : 0,
            kitchen_time_start: kitchenReq.length > 0 ? kitchenReq[0].time.split('-')[0] : null,
            kitchen_time_end: kitchenReq.length > 0 ? kitchenReq[0].time.split('-')[1] : null,
            // 新しいJSONフィールドで全ての要件を送信
            requirements: localEvent.requirements
        };

        // IDがある場合のみevent_idを設定（更新の場合）
        if (localEvent.id) {
            apiEvent.event_id = localEvent.id;
        }

        return apiEvent;
    }

    // API形式からlocalStorage形式への変換（行事）
    static eventFromApi(apiEvent) {
        let requirements = {};

        // 新しいrequirementsフィールドを優先的に使用
        if (apiEvent.requirements) {
            requirements = apiEvent.requirements;
        } else {
            // フォールバック: 従来のフィールドから変換
            if (apiEvent.office_required > 0) {
                requirements.office = [{
                    time: `${apiEvent.office_time_start}-${apiEvent.office_time_end}`,
                    count: apiEvent.office_required
                }];
            }

            if (apiEvent.kitchen_required > 0) {
                requirements.cooking = [{
                    time: `${apiEvent.kitchen_time_start}-${apiEvent.kitchen_time_end}`,
                    count: apiEvent.kitchen_required
                }];
            }
        }

        return {
            id: apiEvent.event_id,
            name: apiEvent.event_name,
            requirements
        };
    }

    // 休み希望の変換
    static requestsToApi(localRequests) {
        console.log('=== requestsToApi: データ変換開始 ===');
        console.log('入力データ:', localRequests);
        
        const apiRequests = {};
        Object.keys(localRequests).forEach(dateString => {
            const request = localRequests[dateString];
            const date = new Date(dateString);
            const day = date.getDate();
            
            console.log(`処理中: ${dateString} (日: ${day}) => "${request}"`);
            
            if (request === 'off') {
                apiRequests[day] = {
                    isOff: 1,
                    preferredStartTime: null,
                    preferredEndTime: null
                };
                console.log(`✓ 日${day} => 休み希望`);
            } else if (request && request.includes('-')) {
                // 時間帯形式 "09:00-17:00"
                const [startTime, endTime] = request.split('-');
                apiRequests[day] = {
                    isOff: 0,
                    preferredStartTime: startTime + ':00', // HH:MM:SS形式にする
                    preferredEndTime: endTime + ':00'
                };
                console.log(`✓ 日${day} => 時間帯希望: ${startTime}:00-${endTime}:00`);
            } else if (request === 'custom') {
                // カスタム時間帯は別途処理される
                apiRequests[day] = {
                    isOff: 0,
                    preferredStartTime: null,
                    preferredEndTime: null
                };
                console.log(`✓ 日${day} => カスタム時間帯（空）`);
            } else if (request) {
                console.log(`⚠️ 日${day} => 認識できないリクエスト: "${request}"`);
            }
        });
        
        console.log('変換結果:', apiRequests);
        return apiRequests;
    }

    static requestsFromApi(apiRequests) {
        console.log('=== requestsFromApi: データ変換開始 ===');
        console.log('API生データ:', apiRequests);
        
        const localRequests = {};
        
        if (!apiRequests || !Array.isArray(apiRequests)) {
            console.log('APIレスポンスが無効またはからの配列');
            return localRequests;
        }
        
        apiRequests.forEach(request => {
            console.log('処理中のリクエスト:', request);
            
            const dateString = `${request.year}-${String(request.month).padStart(2, '0')}-${String(request.day).padStart(2, '0')}`;
            console.log('生成される日付文字列:', dateString);
            
            if (request.is_off_requested == 1) {
                localRequests[dateString] = 'off';
                console.log(`✓ ${dateString} => 'off' (休み希望)`);
            } else if (request.preferred_time_start && request.preferred_time_end) {
                // 時間を HH:MM-HH:MM 形式に変換
                const startTime = request.preferred_time_start.substring(0, 5);
                const endTime = request.preferred_time_end.substring(0, 5);
                localRequests[dateString] = `${startTime}-${endTime}`;
                console.log(`✓ ${dateString} => '${startTime}-${endTime}' (時間帯希望)`);
            } else {
                console.log(`⚠️ ${dateString} => データ不整合:`, {
                    is_off_requested: request.is_off_requested,
                    preferred_time_start: request.preferred_time_start,
                    preferred_time_end: request.preferred_time_end
                });
            }
        });
        
        console.log('変換結果:', localRequests);
        return localRequests;
    }

    // ユーティリティメソッド
    static extractFirstTimeStart(conditions) {
        if (!conditions?.weeklySchedule) return null;
        const firstDay = Object.values(conditions.weeklySchedule)[0];
        if (firstDay && firstDay.length > 0) {
            const timeRange = firstDay[0];
            if (timeRange.includes('-')) {
                return timeRange.split('-')[0];
            }
            return '09:00'; // デフォルト値
        }
        return null;
    }

    static extractFirstTimeEnd(conditions) {
        if (!conditions?.weeklySchedule) return null;
        const firstDay = Object.values(conditions.weeklySchedule)[0];
        if (firstDay && firstDay.length > 0) {
            const timeRange = firstDay[0];
            if (timeRange.includes('-')) {
                return timeRange.split('-')[1];
            }
            return '17:00'; // デフォルト値
        }
        return null;
    }
}

// グローバルインスタンス
window.apiClient = new ApiClient();
window.dataConverter = DataConverter;