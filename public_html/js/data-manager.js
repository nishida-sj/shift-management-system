// データ管理用のJavaScript
// localStorageを使ってマスタデータと業務データを管理

class DataManager {
    constructor() {
        this.initializeDefaultData();
    }
    
    // 初期データの設定
    initializeDefaultData() {
        // 業務区分マスタの初期化
        if (!localStorage.getItem('businessTypeMaster')) {
            const defaultBusinessTypes = [
                {
                    code: 'office',
                    name: '事務業務',
                    description: 'デスクワーク中心の業務'
                },
                {
                    code: 'cooking',
                    name: '調理業務',
                    description: 'キッチンでの調理・準備業務'
                },
                {
                    code: 'cleaning',
                    name: '清掃業務',
                    description: '施設の清掃・管理業務'
                },
                {
                    code: 'sales',
                    name: '販売業務',
                    description: '接客・販売業務'
                }
            ];
            localStorage.setItem('businessTypeMaster', JSON.stringify(defaultBusinessTypes));
        }

        // 従業員マスタの初期化
        if (!localStorage.getItem('employeeMaster')) {
            const defaultEmployees = [
                {
                    code: 'emp001',
                    name: '山田太郎',
                    businessTypes: [
                        { code: 'office', isMain: true },
                        { code: 'sales', isMain: false }
                    ],
                    password: 'emp123',
                    conditions: {
                        // 曜日別の出勤可能時間（0:日曜日 ～ 6:土曜日）
                        weeklySchedule: {
                            1: ['9:30-16:00'], // 月曜日
                            2: ['9:30-16:00'], // 火曜日
                            3: ['9:30-16:00'], // 水曜日
                            4: ['9:30-16:00'], // 木曜日
                            5: ['9:30-16:00']  // 金曜日
                        },
                        maxHoursPerDay: 8,
                        maxDaysPerWeek: 5
                    }
                },
                {
                    code: 'emp002',
                    name: '田中花子',
                    businessTypes: [
                        { code: 'cooking', isMain: true }
                    ],
                    password: 'emp456',
                    conditions: {
                        weeklySchedule: {
                            1: ['9:00-13:00', '10:00-14:00'], // 月曜日
                            2: ['9:00-13:00', '10:00-14:00'], // 火曜日
                            3: ['9:00-13:00', '10:00-14:00'], // 水曜日
                            4: ['9:00-13:00', '10:00-14:00'], // 木曜日
                            5: ['9:00-13:00', '10:00-14:00'], // 金曜日
                            6: ['9:00-13:00']  // 土曜日
                        },
                        maxHoursPerDay: 6,
                        maxDaysPerWeek: 5
                    }
                },
                {
                    code: 'emp003',
                    name: '佐藤次郎',
                    businessTypes: [
                        { code: 'office', isMain: true },
                        { code: 'cleaning', isMain: false }
                    ],
                    password: 'emp789',
                    conditions: {
                        weeklySchedule: {
                            2: ['10:00-16:00'], // 火曜日
                            3: ['10:00-16:00'], // 水曜日
                            4: ['10:00-16:00'], // 木曜日
                            5: ['10:00-16:00'], // 金曜日
                            6: ['10:00-16:00']  // 土曜日
                        },
                        maxHoursPerDay: 8,
                        maxDaysPerWeek: 4
                    }
                }
            ];
            localStorage.setItem('employeeMaster', JSON.stringify(defaultEmployees));
        }
        
        // 行事マスタの初期化
        if (!localStorage.getItem('eventMaster')) {
            const defaultEvents = [
                {
                    id: 'ev001',
                    name: '通常業務',
                    requirements: {
                        office: [
                            { time: '9:30-16:00', count: 1 },
                            { time: '10:00-16:00', count: 1 }
                        ],
                        cooking: [
                            { time: '9:00-13:00', count: 1 },
                            { time: '10:00-14:00', count: 1 }
                        ]
                    }
                },
                {
                    id: 'ev002',
                    name: '会議日',
                    requirements: {
                        office: [
                            { time: '9:00-17:00', count: 2 }
                        ],
                        cooking: [
                            { time: '9:00-13:00', count: 1 }
                        ]
                    }
                },
                {
                    id: 'ev003',
                    name: 'イベント',
                    requirements: {
                        office: [
                            { time: '9:30-16:00', count: 2 },
                            { time: '10:00-16:00', count: 1 }
                        ],
                        cooking: [
                            { time: '9:00-13:00', count: 1 },
                            { time: '9:30-14:00', count: 1 },
                            { time: '10:00-14:00', count: 1 }
                        ]
                    }
                }
            ];
            localStorage.setItem('eventMaster', JSON.stringify(defaultEvents));
        }
        
        // シフト条件マスタの初期化
        if (!localStorage.getItem('shiftConditions')) {
            const defaultConditions = {
                timeSlots: [
                    '9:00-13:00',
                    '9:30-14:00',
                    '9:30-16:00',
                    '10:00-14:00',
                    '10:00-16:00',
                    '13:00-17:00',
                    '14:00-18:00'
                ],
                businessTypes: [
                    { code: 'office', name: '事務業務' },
                    { code: 'cooking', name: '調理業務' }
                ]
            };
            localStorage.setItem('shiftConditions', JSON.stringify(defaultConditions));
        }
    }
    
    // 従業員マスタ取得
    getEmployees() {
        return JSON.parse(localStorage.getItem('employeeMaster') || '[]');
    }
    
    // 従業員マスタ保存
    saveEmployees(employees) {
        localStorage.setItem('employeeMaster', JSON.stringify(employees));
    }
    
    // 従業員取得（コード指定）
    getEmployee(code) {
        const employees = this.getEmployees();
        return employees.find(emp => emp.code === code);
    }
    
    // 業務区分マスタ取得
    getBusinessTypes() {
        return JSON.parse(localStorage.getItem('businessTypeMaster') || '[]');
    }
    
    // 業務区分マスタ保存
    saveBusinessTypes(businessTypes) {
        localStorage.setItem('businessTypeMaster', JSON.stringify(businessTypes));
    }
    
    // 業務区分取得（コード指定）
    getBusinessType(code) {
        const businessTypes = this.getBusinessTypes();
        return businessTypes.find(bt => bt.code === code);
    }
    
    // 行事マスタ取得
    getEvents() {
        return JSON.parse(localStorage.getItem('eventMaster') || '[]');
    }
    
    // 行事マスタ保存
    saveEvents(events) {
        localStorage.setItem('eventMaster', JSON.stringify(events));
    }
    
    // シフト条件取得
    getShiftConditions() {
        const saved = localStorage.getItem('shiftApp_shiftConditions');
        if (saved) {
            const conditions = JSON.parse(saved);
            console.log('data-manager: 時間帯マスタから取得:', conditions.timeSlots);
            return conditions;
        }
        // デフォルト値を返す
        const defaultConditions = {
            basicSettings: {
                minRestHours: 1,
                maxConsecutiveDays: 6,
                minRestDaysAfterConsecutive: 1
            },
            timeSlots: [
                '9:00-13:00', '9:30-14:00', '9:30-16:00', '10:00-14:00',
                '10:00-16:00', '13:00-17:00', '14:00-18:00', '9:00-17:00'
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
        console.log('data-manager: デフォルト時間帯を使用:', defaultConditions.timeSlots);
        return defaultConditions;
    }
    
    // 従業員並び順取得
    getEmployeeOrders() {
        const saved = localStorage.getItem('shiftApp_employeeOrders');
        return saved ? JSON.parse(saved) : {};
    }
    
    // 従業員並び順保存
    saveEmployeeOrders(orders) {
        localStorage.setItem('shiftApp_employeeOrders', JSON.stringify(orders));
    }

    // 月間行事予定取得
    getMonthlyEvents(year, month) {
        const key = `monthlyEvents_${year}_${month}`;
        return JSON.parse(localStorage.getItem(key) || '{}');
    }
    
    // 月間行事予定保存
    saveMonthlyEvents(year, month, events) {
        const key = `monthlyEvents_${year}_${month}`;
        localStorage.setItem(key, JSON.stringify(events));
    }
    
    // 休み希望取得
    getEmployeeRequests(employeeCode, year, month) {
        const key = `shiftRequests_${employeeCode}_${year}_${month}`;
        return JSON.parse(localStorage.getItem(key) || '{}');
    }
    
    // 休み希望保存
    saveEmployeeRequests(employeeCode, year, month, requests) {
        const key = `shiftRequests_${employeeCode}_${year}_${month}`;
        localStorage.setItem(key, JSON.stringify(requests));
    }
    
    // 確定シフト取得
    getConfirmedShift(year, month) {
        const key = `confirmedShift_${year}_${month}`;
        return JSON.parse(localStorage.getItem(key) || '{}');
    }
    
    // 確定シフト保存
    saveConfirmedShift(year, month, shift) {
        const key = `confirmedShift_${year}_${month}`;
        localStorage.setItem(key, JSON.stringify(shift));
    }
    
    // シフト確定状態取得
    getShiftStatus(year, month) {
        const key = `shiftStatus_${year}_${month}`;
        const status = localStorage.getItem(key);
        return status || 'draft'; // draft, confirmed
    }
    
    // シフト確定状態保存
    saveShiftStatus(year, month, status) {
        const key = `shiftStatus_${year}_${month}`;
        localStorage.setItem(key, status);
    }
    
    // 備考取得
    getShiftNotes(year, month) {
        const key = `shiftNotes_${year}_${month}`;
        return JSON.parse(localStorage.getItem(key) || '{}');
    }
    
    // 備考保存
    saveShiftNotes(year, month, notes) {
        const key = `shiftNotes_${year}_${month}`;
        localStorage.setItem(key, JSON.stringify(notes));
    }
    
    // セル背景色取得
    getShiftCellBackgrounds(year, month) {
        const key = `shiftCellBackgrounds_${year}_${month}`;
        return JSON.parse(localStorage.getItem(key) || '{}');
    }
    
    // セル背景色保存
    saveShiftCellBackgrounds(year, month, backgrounds) {
        const key = `shiftCellBackgrounds_${year}_${month}`;
        localStorage.setItem(key, JSON.stringify(backgrounds));
    }
    
    // 会社情報取得
    getCompanyInfo() {
        const saved = localStorage.getItem('shiftApp_companyInfo');
        return saved ? JSON.parse(saved) : {};
    }
    
    // 会社情報保存
    saveCompanyInfo(companyInfo) {
        localStorage.setItem('shiftApp_companyInfo', JSON.stringify(companyInfo));
    }
    
    // 時間文字列を分に変換
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 分を時間文字列に変換
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    // 時間範囲の重複チェック
    isTimeOverlap(time1, time2) {
        const [start1, end1] = time1.split('-').map(t => this.timeToMinutes(t));
        const [start2, end2] = time2.split('-').map(t => this.timeToMinutes(t));
        
        return !(end1 <= start2 || end2 <= start1);
    }
    
    // 勤務時間計算
    calculateWorkHours(timeRange) {
        const [start, end] = timeRange.split('-').map(t => this.timeToMinutes(t));
        return (end - start) / 60;
    }
}

// グローバルインスタンス
window.dataManager = new DataManager();