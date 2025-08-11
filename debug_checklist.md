# 複数業務区分問題 デバッグチェックリスト

## 1. データベースマイグレーションの確認

### 実行すべきSQL（再実行確認）
```sql
-- カラムの存在確認
DESCRIBE employees;

-- または
SHOW COLUMNS FROM employees LIKE '%business%';

-- データの確認
SELECT employee_code, name, business_type, business_types 
FROM employees 
LIMIT 3;
```

### 予想される結果
- `business_types` カラムが JSON型で存在する
- `business_types` に値が入っている（NULLでない）

## 2. PHPエラーログの確認

### チェック項目
- `=== 全従業員取得 (最初の従業員の生データ) ===`
- `business_types: NULL` かどうか
- カラム名一覧に `business_types` が含まれるか

### 確認コマンド例
```bash
tail -f /path/to/php/error.log
```

## 3. 考えられる問題とその対策

### 問題1: マイグレーション未実行
**症状**: `business_types` カラムが存在しない
**対策**: マイグレーションSQLを再実行

### 問題2: カラムは存在するがデータがNULL
**症状**: `business_types: NULL`
**対策**: UPDATEクエリでデータを移行

### 問題3: JSONデコードエラー
**症状**: `business_types` は存在するがデコードできない
**対策**: JSON形式の確認と修正

### 問題4: フロントエンドでの型変換エラー
**症状**: APIは正常だがブラウザでエラー
**対策**: JavaScript側のバグ修正

## 4. 修正用SQL

### カラム追加（未実行の場合）
```sql
ALTER TABLE employees ADD COLUMN business_types JSON COMMENT '複数業務区分';
```

### データ移行（NULLの場合）
```sql
UPDATE employees 
SET business_types = CASE 
    WHEN business_type = '事務' THEN '[{"code":"office","isMain":true}]'
    WHEN business_type = '調理' THEN '[{"code":"cooking","isMain":true}]'
    ELSE '[{"code":"office","isMain":true}]'
END
WHERE business_types IS NULL;
```

### NOT NULL制約追加
```sql
ALTER TABLE employees MODIFY COLUMN business_types JSON NOT NULL;
```