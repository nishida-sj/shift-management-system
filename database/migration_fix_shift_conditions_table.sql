-- シフト条件テーブル構造修正のためのマイグレーション
-- 作成日: 2025-08-26
-- shift_conditionsテーブルの構造を最新API仕様に合わせて修正

-- 既存のshift_conditionsテーブルをバックアップ用に名前変更
RENAME TABLE shift_conditions TO shift_conditions_backup;

-- 新しいshift_conditionsテーブルを作成
CREATE TABLE shift_conditions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    basic_settings JSON COMMENT '基本設定（JSON形式）',
    time_slots JSON COMMENT '時間帯マスタ（JSON形式）',
    priorities JSON COMMENT '優先度設定（JSON形式）',
    warnings JSON COMMENT '警告設定（JSON形式）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 初期データを挿入
INSERT INTO shift_conditions (basic_settings, time_slots, priorities, warnings) VALUES (
    '{"minRestHours": 1, "maxConsecutiveDays": 6, "minRestDaysAfterConsecutive": 1}',
    '["09:00-13:00", "09:30-14:00", "09:30-16:00", "10:00-14:00", "10:00-16:00", "13:00-17:00", "14:00-18:00", "09:00-17:00"]',
    '{"prioritizeMainBusiness": true, "respectOffRequests": true, "respectTimePreferences": true, "balanceWorkload": false}',
    '{"warnConditionViolation": true, "warnConsecutiveWork": true, "warnInsufficientRest": true}'
);

-- バックアップテーブルを削除（必要に応じて手動で削除）
-- DROP TABLE shift_conditions_backup;