-- 行事複数時間帯要件カラム追加マイグレーション
-- 実行日: 2025-08-07

-- 1. requirements カラムを追加
ALTER TABLE events ADD COLUMN requirements JSON COMMENT '業務区分別複数時間帯要件 {"office":[{"time":"09:00-17:00","count":2}],"cooking":[{"time":"08:00-16:00","count":1}]}';

-- 2. 確認用クエリ（実行後にデータを確認）
-- SELECT event_id, event_name, office_required, office_time_start, office_time_end, kitchen_required, kitchen_time_start, kitchen_time_end, requirements FROM events;