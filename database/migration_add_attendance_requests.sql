-- 勤怠 打刻修正申請 追加マイグレーション
-- 従業員が出勤・退勤時刻／休憩なし・ありの変更を申請し、管理者が承認する
--
-- 注意: api/attendance-requests.php がテーブル未作成時に自動でCREATEするため、
--       このSQLの手動実行は必須ではない（記録・手動適用用）

CREATE TABLE IF NOT EXISTS attendance_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_code VARCHAR(50) NOT NULL,
    work_date DATE NOT NULL,
    clock_in TIME NULL,                 -- 申請する出勤時刻
    clock_out TIME NULL,                -- 申請する退勤時刻
    break_none TINYINT NOT NULL DEFAULT 0, -- 0:休憩あり, 1:休憩なし
    reason VARCHAR(255) NULL,           -- 申請理由（従業員が入力）
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / approved / rejected
    admin_comment VARCHAR(255) NULL,    -- 管理者コメント（却下理由など）
    reviewed_at TIMESTAMP NULL,         -- 承認・却下した日時
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_code) REFERENCES employees (employee_code) ON DELETE CASCADE,
    INDEX idx_req_status (status),
    INDEX idx_req_employee_date (employee_code, work_date)
);
