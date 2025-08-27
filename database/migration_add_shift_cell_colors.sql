-- シフトセル背景色管理のためのマイグレーション
-- 作成日: 2025-08-27
-- confirmed_shiftsテーブルに背景色カラムを追加

-- confirmed_shiftsテーブルに背景色カラムを追加
ALTER TABLE confirmed_shifts 
ADD COLUMN cell_background_color VARCHAR(20) COMMENT 'セル背景色 (orange, yellow, green, blue, pink)';