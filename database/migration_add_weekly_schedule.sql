-- 曜日別時間帯カラム追加マイグレーション
-- 実行日: 2025-08-07

-- 1. weekly_schedule カラムを追加
ALTER TABLE employees ADD COLUMN weekly_schedule JSON COMMENT '曜日別時間帯 {"月":["09:00-17:00"],"火":["09:30-16:00"]}';

-- 2. 確認用クエリ（実行後にデータを確認）
-- SELECT employee_code, name, available_days, preferred_time_start, preferred_time_end, weekly_schedule FROM employees;