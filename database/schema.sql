-- シフト管理システム MySQLスキーマ
-- 作成日: 2025-08-07

-- データベース作成（実際の作成はコアサーバー管理画面で実施）
-- CREATE DATABASE shift_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 従業員マスタ
CREATE TABLE employees (
    employee_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    business_type ENUM('事務', '調理') NOT NULL,
    password VARCHAR(255) NOT NULL,
    available_days JSON, -- 出勤可能曜日 ["月","火","水"]
    preferred_time_start TIME,
    preferred_time_end TIME,
    work_limit_per_day INT DEFAULT 8, -- 1日あたりの勤務時間制限(時間)
    work_limit_per_month INT DEFAULT 160, -- 月あたりの勤務時間制限(時間)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 行事マスタ
CREATE TABLE events (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    event_name VARCHAR(100) NOT NULL,
    office_required INT DEFAULT 0, -- 事務業務必要人数
    office_time_start TIME,
    office_time_end TIME,
    kitchen_required INT DEFAULT 0, -- 調理業務必要人数
    kitchen_time_start TIME,
    kitchen_time_end TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 月間行事予定
CREATE TABLE monthly_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    year INT NOT NULL,
    month INT NOT NULL,
    day INT NOT NULL,
    event_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_date (year, month, day, event_id)
);

-- 従業員の休み希望
CREATE TABLE shift_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_code VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    day INT NOT NULL,
    is_off_requested TINYINT DEFAULT 0, -- 0:出勤希望, 1:休み希望
    preferred_time_start TIME,
    preferred_time_end TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_code) REFERENCES employees (employee_code) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_date (employee_code, year, month, day)
);

-- 確定シフト
CREATE TABLE confirmed_shifts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_code VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    day INT NOT NULL,
    time_start TIME,
    time_end TIME,
    business_type ENUM('事務', '調理'),
    is_violation TINYINT DEFAULT 0, -- 0:条件OK, 1:条件違反
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_code) REFERENCES employees (employee_code) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_shift_date (employee_code, year, month, day)
);

-- シフト状態管理
CREATE TABLE shift_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    year INT NOT NULL,
    month INT NOT NULL,
    is_confirmed TINYINT DEFAULT 0, -- 0:未確定, 1:確定
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_month (year, month)
);

-- シフト備考
CREATE TABLE shift_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    year INT NOT NULL,
    month INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_note_month (year, month)
);

-- 管理者ユーザー
CREATE TABLE admin_users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_monthly_events_date ON monthly_events (year, month, day);
CREATE INDEX idx_shift_requests_employee_date ON shift_requests (employee_code, year, month, day);
CREATE INDEX idx_confirmed_shifts_date ON confirmed_shifts (year, month, day);
CREATE INDEX idx_confirmed_shifts_employee_date ON confirmed_shifts (employee_code, year, month, day);

-- 初期データ挿入

-- 管理者アカウント
INSERT INTO admin_users (username, password) VALUES ('admin', 'admin123');

-- テスト従業員データ
INSERT INTO employees (employee_code, name, business_type, password, available_days, preferred_time_start, preferred_time_end) VALUES
('emp001', '山田太郎', '事務', 'emp123', '["月","火","水","木","金"]', '09:00', '17:00'),
('emp002', '田中花子', '調理', 'emp456', '["月","火","水","木","金","土"]', '08:00', '16:00'),
('emp003', '佐藤次郎', '事務', 'emp789', '["火","水","木","金","土"]', '10:00', '18:00');

-- テスト行事データ
INSERT INTO events (event_name, office_required, office_time_start, office_time_end, kitchen_required, kitchen_time_start, kitchen_time_end) VALUES
('通常業務', 2, '09:00', '17:00', 1, '08:00', '16:00'),
('特別イベント', 3, '08:00', '18:00', 2, '07:00', '17:00'),
('会議日', 1, '10:00', '15:00', 1, '09:00', '14:00');