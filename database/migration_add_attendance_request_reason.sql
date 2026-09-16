-- 勤怠 打刻修正申請に事由コードを追加するマイグレーション
-- 「事由なし / 休憩なし」に加えて「有給」を申請できるようにする
--
-- 注意: api/attendance-requests.php が列未作成時に自動でALTERするため、
--       このSQLの手動実行は必須ではない（記録・手動適用用）
--
-- 事由コードは attendance_records.reason と同じ値を使う
--   '21' = 休憩なし
--   '10' = 有給（勤務しない日のため出勤・退勤時刻を持たない）
--   NULL = 事由なし

ALTER TABLE attendance_requests
    ADD COLUMN reason_code VARCHAR(10) NULL AFTER break_none;

-- 既存の「休憩なし」申請を事由コードへ移行する
UPDATE attendance_requests
    SET reason_code = '21'
    WHERE break_none = 1 AND reason_code IS NULL;
