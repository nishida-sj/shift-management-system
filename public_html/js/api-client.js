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

    async saveEmployee(employee) {
        if (employee.employee_code) {
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

    // 月間行事予定
    async getMonthlyEvents(year, month) {
        return this.get('/shifts.php', {
            type: 'monthly_events',
            year,
            month
        });
    }

    async saveMonthlyEvents(year, month, events) {
        return this.post('/shifts.php', {
            type: 'monthly_events',
            year,
            month,
            events
        });
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
        if (localEmployee.conditions && localEmployee.conditions.weeklySchedule) {
            Object.keys(localEmployee.conditions.weeklySchedule).forEach(day => {
                const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                availableDays.push(dayNames[parseInt(day)]);
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
            work_limit_per_day: localEmployee.conditions?.maxHoursPerDay || 8,
            work_limit_per_month: (localEmployee.conditions?.maxDaysPerWeek || 5) * 4 * (localEmployee.conditions?.maxHoursPerDay || 8)
        };
    }

    // API形式からlocalStorage形式への変換（従業員）
    static employeeFromApi(apiEmployee) {
        const weeklySchedule = {};
        const dayMap = {'日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6};
        
        if (apiEmployee.available_days) {
            apiEmployee.available_days.forEach(dayName => {
                const dayNum = dayMap[dayName];
                if (dayNum !== undefined && apiEmployee.preferred_time_start && apiEmployee.preferred_time_end) {
                    weeklySchedule[dayNum] = [`${apiEmployee.preferred_time_start}-${apiEmployee.preferred_time_end}`];
                }
            });
        }

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

        return {
            event_id: localEvent.id,
            event_name: localEvent.name,
            office_required: officeReq.length > 0 ? officeReq[0].count : 0,
            office_time_start: officeReq.length > 0 ? officeReq[0].time.split('-')[0] : null,
            office_time_end: officeReq.length > 0 ? officeReq[0].time.split('-')[1] : null,
            kitchen_required: kitchenReq.length > 0 ? kitchenReq[0].count : 0,
            kitchen_time_start: kitchenReq.length > 0 ? kitchenReq[0].time.split('-')[0] : null,
            kitchen_time_end: kitchenReq.length > 0 ? kitchenReq[0].time.split('-')[1] : null
        };
    }

    // API形式からlocalStorage形式への変換（行事）
    static eventFromApi(apiEvent) {
        const requirements = {};

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

        return {
            id: apiEvent.event_id,
            name: apiEvent.event_name,
            requirements
        };
    }

    // 休み希望の変換
    static requestsToApi(localRequests) {
        const apiRequests = {};
        Object.keys(localRequests).forEach(day => {
            const request = localRequests[day];
            apiRequests[day] = {
                isOff: request.isOff || 0,
                preferredStartTime: request.preferredStartTime || null,
                preferredEndTime: request.preferredEndTime || null
            };
        });
        return apiRequests;
    }

    static requestsFromApi(apiRequests) {
        const localRequests = {};
        apiRequests.forEach(request => {
            localRequests[request.day] = {
                isOff: request.is_off_requested,
                preferredStartTime: request.preferred_time_start,
                preferredEndTime: request.preferred_time_end
            };
        });
        return localRequests;
    }

    // ユーティリティメソッド
    static extractFirstTimeStart(conditions) {
        if (!conditions?.weeklySchedule) return null;
        const firstDay = Object.values(conditions.weeklySchedule)[0];
        if (firstDay && firstDay.length > 0) {
            return firstDay[0].split('-')[0];
        }
        return null;
    }

    static extractFirstTimeEnd(conditions) {
        if (!conditions?.weeklySchedule) return null;
        const firstDay = Object.values(conditions.weeklySchedule)[0];
        if (firstDay && firstDay.length > 0) {
            return firstDay[0].split('-')[1];
        }
        return null;
    }
}

// グローバルインスタンス
window.apiClient = new ApiClient();
window.dataConverter = DataConverter;