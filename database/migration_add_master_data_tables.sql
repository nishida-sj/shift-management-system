-- マスタデータ管理用テーブル追加のためのマイグレーション
-- 作成日: 2025-08-24
-- localStorage使用箇所をデータベース保存に移行するための追加テーブル

-- 1. シフト条件設定テーブル
CREATE TABLE shift_conditions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    condition_data JSON NOT NULL COMMENT 'シフト条件設定データ（JSON形式）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 業務区分マスタテーブル
CREATE TABLE business_types (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 会社情報テーブル
CREATE TABLE company_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_data JSON NOT NULL COMMENT '会社情報データ（JSON形式）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. 従業員並び順テーブル
CREATE TABLE employee_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    business_type_code VARCHAR(50) NOT NULL,
    order_data JSON NOT NULL COMMENT '従業員並び順データ（JSON形式）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_business_type (business_type_code)
);

-- 5. シフト条件の初期データを挿入
INSERT INTO shift_conditions (condition_data) VALUES (
    '{
        "basicSettings": {
            "minRestHours": 1,
            "maxConsecutiveDays": 6,
            "minRestDaysAfterConsecutive": 1
        },
        "timeSlots": [
            "9:00-13:00",
            "9:30-14:00",
            "9:30-16:00",
            "10:00-14:00",
            "10:00-16:00",
            "13:00-17:00",
            "14:00-18:00",
            "9:00-17:00"
        ],
        "priorities": {
            "prioritizeMainBusiness": true,
            "respectOffRequests": true,
            "respectTimePreferences": true,
            "balanceWorkload": false
        },
        "warnings": {
            "warnConditionViolation": true,
            "warnConsecutiveWork": true,
            "warnInsufficientRest": true
        }
    }'
);

-- 6. 業務区分の初期データを挿入
INSERT INTO business_types (code, name, description) VALUES
('office', '事務業務', 'デスクワーク中心の業務'),
('cooking', '調理業務', 'キッチンでの調理・準備業務'),
('cleaning', '清掃業務', '施設の清掃・管理業務'),
('sales', '販売業務', '接客・販売業務');

-- 7. 会社情報の初期データを挿入
INSERT INTO company_info (company_data) VALUES (
    '{
        "name": "サンプル会社",
        "address": "〒000-0000 東京都",
        "phone": "03-0000-0000",
        "email": "info@example.com"
    }'
);

-- 8. インデックス作成
CREATE INDEX idx_employee_orders_business_type ON employee_orders (business_type_code);