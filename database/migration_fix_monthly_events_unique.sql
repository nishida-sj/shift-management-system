-- 月間行事予定テーブルの UNIQUE KEY 制約を修正
-- 同一日に複数イベントではなく、同一日に1つのイベントのみを許可するように修正

-- 既存の制約を削除
ALTER TABLE monthly_events DROP INDEX unique_event_date;

-- 新しい制約を追加（year, month, day のみでユニーク）
ALTER TABLE monthly_events ADD UNIQUE KEY unique_date (year, month, day);