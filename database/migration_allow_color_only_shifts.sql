-- 色だけを設定した空セル（勤務時間なし）を保存できるようにする
-- confirmed_shifts.time_start / time_end を NULL 許可に変更する
--
-- 背景:
--   schema.sql では time_start / time_end は NULL 許可だが、
--   api/shifts.php のテーブル自動作成では NOT NULL で作られていたため、
--   環境によって定義が食い違っている。本マイグレーションで NULL 許可に揃える。

-- セル背景色カラム（未適用の環境向け。適用済みならエラーになるので個別に実行すること）
-- ALTER TABLE confirmed_shifts ADD COLUMN cell_background_color VARCHAR(50) DEFAULT NULL;

ALTER TABLE confirmed_shifts MODIFY COLUMN time_start TIME NULL;
ALTER TABLE confirmed_shifts MODIFY COLUMN time_end TIME NULL;
