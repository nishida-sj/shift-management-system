-- 従業員マスタにシフト優先区分フィールドを追加
-- シフト自動作成時に勤務時間均等化よりも優先される従業員を指定

ALTER TABLE employees ADD COLUMN shift_priority TINYINT DEFAULT 0 COMMENT 'シフト優先区分 (0:通常, 1:優先)';

-- インデックス追加
CREATE INDEX idx_employees_shift_priority ON employees (shift_priority);