# localStorage排除とデータベース移行 - デプロイ手順

## 概要
各マスタ管理ページでlocalStorageに保存されていたデータをすべてデータベース保存に移行しました。
これにより、どの端末からアクセスしても同じデータが表示されるようになります。

## 変更対象ページ
- company-master.html
- employee-master.html  
- business-type-master.html
- event-master.html
- employee-order-master.html
- shift-conditions.html
- shift-create.html

## デプロイ手順

### 1. データベースマイグレーション実行
以下のSQLファイルをMySQLで実行してテーブルを追加してください：

```bash
mysql -u [username] -p [database_name] < database/migration_add_master_data_tables.sql
```

### 2. ファイルのアップロード
以下のファイルを本番サーバーにアップロードしてください：

**新規追加ファイル：**
- `database/migration_add_master_data_tables.sql`
- `public_html/api/shift-conditions-api.php`
- `public_html/api/company-info-api.php`
- `public_html/api/employee-orders-api.php`

**更新ファイル：**
- `public_html/js/api-client.js`
- `public_html/js/shift-conditions.js`
- `public_html/js/employee-order-master.js`
- `public_html/js/data-manager.js`（警告メッセージ追加）

### 3. 動作確認
各マスタ管理ページにアクセスして以下を確認：

1. **シフト条件設定** (`shift-conditions.html`)
   - 条件設定が正しく読み込まれること
   - 設定変更・保存が正常に動作すること

2. **会社マスタ** (`company-master.html`)
   - 会社情報が正しく読み込まれること
   - 情報更新・保存が正常に動作すること

3. **従業員並び順マスタ** (`employee-order-master.html`)
   - 従業員一覧が正しく表示されること
   - ドラッグ&ドロップで並び順変更ができること
   - 保存が正常に動作すること

4. **業務区分マスタ** (`business-type-master.html`)
   - 業務区分一覧が正しく表示されること（既存のAPIを使用）

5. **行事マスタ** (`event-master.html`)
   - 行事一覧が正しく表示されること（既存のAPIを使用）

6. **従業員マスタ** (`employee-master.html`)
   - 従業員一覧が正しく表示されること（既存のAPIを使用）

### 4. 複数端末での確認
異なる端末・ブラウザからアクセスして、同じデータが表示されることを確認してください。

## 変更内容詳細

### 新規テーブル
- `shift_conditions` - シフト条件設定
- `business_types` - 業務区分マスタ（既存の業務区分機能を拡張）
- `company_info` - 会社情報
- `employee_orders` - 従業員並び順

### JavaScript変更
- localStorage使用箇所をすべてAPI呼び出しに変更
- エラー時のフォールバック処理を削除（一元的なデータ管理のため）
- DataManager.jsに非推奨警告を追加（後方互換性維持）

### API拡張
- api-client.jsに新しいAPIエンドポイント用のメソッドを追加
- 会社マスタAPIのエンドポイントを新しいAPIに変更

## 注意事項
- 既存のlocalStorageデータは読み込まれなくなります
- 初回アクセス時はデフォルト値が使用されます
- 各ページでデータを再設定・保存する必要がある場合があります

## トラブルシューティング
1. **データが表示されない場合**
   - データベースマイグレーションが正しく実行されているか確認
   - APIエンドポイントファイルが正しくアップロードされているか確認

2. **保存ができない場合**
   - データベース接続設定を確認
   - PHPのエラーログを確認

3. **古いデータが表示される場合**
   - ブラウザのキャッシュをクリア
   - ハードリフレッシュ（Ctrl+F5）を実行