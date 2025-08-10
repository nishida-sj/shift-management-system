-- 従業員の複数業務区分サポートのためのマイグレーション
-- 作成日: 2025-08-10

-- 1. 新しいbusiness_typesフィールドを追加（JSON形式）
ALTER TABLE employees ADD COLUMN business_types JSON COMMENT '複数業務区分 [{"code":"office","isMain":true},{"code":"cooking","isMain":false}]';

-- 2. 既存のbusiness_type値をbusiness_typesに移行
UPDATE employees 
SET business_types = CASE 
    WHEN business_type = '事務' THEN '[{"code":"office","isMain":true}]'
    WHEN business_type = '調理' THEN '[{"code":"cooking","isMain":true}]'
    ELSE '[{"code":"office","isMain":true}]'
END;

-- 3. 新しいフィールドをNOT NULLに変更
ALTER TABLE employees MODIFY COLUMN business_types JSON NOT NULL;

-- 4. 後方互換性のため、既存のbusiness_typeフィールドは保持
-- （将来のリリースで削除予定）
ALTER TABLE employees ADD COLUMN business_type_legacy ENUM('事務', '調理') COMMENT '旧業務区分フィールド（後方互換性）';
UPDATE employees SET business_type_legacy = business_type;

-- 5. shift_priorityフィールドが存在しない場合は追加
-- （他のマイグレーションで既に追加済みの可能性があるため、エラーは無視）
-- ALTER TABLE employees ADD COLUMN shift_priority TINYINT DEFAULT 0 COMMENT 'シフト優先区分';