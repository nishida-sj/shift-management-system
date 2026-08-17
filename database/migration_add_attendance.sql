-- 勤怠管理機能 追加マイグレーション
-- 作成日: 2026-06-25
-- 実行は1回のみ（カラム/テーブルが既に存在する場合はエラーになります）

-- 1) 従業員マスタに勤怠用コードを追加（勤怠/給与システムの社員コードと突き合わせる用）
ALTER TABLE employees
    ADD COLUMN attendance_code VARCHAR(50) NULL AFTER employee_code;

-- 2) 打刻データ（1従業員・1日につき1レコード）
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_code VARCHAR(50) NOT NULL,
    work_date DATE NOT NULL,
    clock_in TIME NULL,       -- 出勤打刻（サーバー時刻・分単位）
    clock_out TIME NULL,      -- 退勤打刻（サーバー時刻・分単位）
    reason VARCHAR(255) NULL,  -- 事由（休憩なし等の備考）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_code) REFERENCES employees (employee_code) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_workdate (employee_code, work_date)
);

CREATE INDEX idx_attendance_workdate ON attendance_records (work_date);
