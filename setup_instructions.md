# シフト管理システム MySQL移行 セットアップ手順

## 1. データベース作成（コアサーバー管理画面）

### データベース作成
1. コアサーバーの管理画面にログイン
2. 「データベース」→「MySQL追加」
3. データベース名を入力（例：`shift_management`）
4. データベースを作成

### データベースユーザー作成
1. 「MySQLユーザー追加」
2. ユーザー名・パスワードを設定
3. 作成したデータベースへの権限を付与

## 2. スキーマ・初期データ投入

### phpMyAdmin または MySQL コマンドライン
1. 作成したデータベースに接続
2. `/database/schema.sql` の内容をすべて実行
   - テーブル作成
   - 初期データ投入（管理者、テスト従業員、テスト行事）

## 3. API設定変更

### config.php の設定変更
`/public_html/api/config.php` の以下の値を実際の値に変更：

```php
private $host = 'localhost';           // コアサーバーのDBホスト
private $database = 'your_db_name';    // 作成したデータベース名
private $username = 'your_db_user';    // データベースユーザー名  
private $password = 'your_db_pass';    // データベースパスワード
```

### 実際の値例（コアサーバー）
```php
private $host = 'mysqlXXX.coreserver.jp';
private $database = 'your_account_shift_management';
private $username = 'your_account_dbuser';
private $password = 'your_secure_password';
```

## 4. ファイルアップロード

### FTPでアップロード
以下のファイルをサーバーにアップロード：

```
public_html/
├── api/
│   ├── config.php       # ← データベース設定済み
│   ├── auth.php
│   ├── employees.php
│   ├── events.php
│   └── shifts.php
├── js/
│   ├── api-client.js    # ← 新規追加
│   └── [既存のJSファイル群]
└── [既存のHTMLファイル群]
```

## 5. フロントエンド修正

### HTMLファイルへのスクリプト追加
各HTMLファイルの `<head>` セクションに追加：

```html
<script src="js/api-client.js"></script>
```

### 既存JSファイルの修正が必要
以下のファイルで `localStorage` を `apiClient` に置き換える必要があります：

1. `js/employee-master.js`
2. `js/event-master.js`
3. `js/input.js`
4. `js/shift-create.js`
5. `js/shift-view.js`
6. `js/monthly-events.js`
7. `js/login.js`

### 修正例（employee-master.js）
```javascript
// 変更前
const employees = dataManager.getEmployees();

// 変更後
const employees = await apiClient.getEmployees();
```

## 6. 動作確認

### 基本動作テスト
1. ブラウザで `/login.html` にアクセス
2. テストアカウントでログイン：
   - 管理者: `admin` / `admin123`
   - 従業員: `emp001` / `emp123`

### API動作テスト
ブラウザの開発者ツールで以下をテスト：
```javascript
// 認証テスト
apiClient.login('admin', 'admin123');

// データ取得テスト
apiClient.getEmployees();
apiClient.getEvents();
```

## 7. データ移行（既存データがある場合）

### localStorage から MySQL への移行
既存のlocalStorageデータがある場合：

```javascript
// ブラウザのコンソールで実行
// 従業員データ移行
const localEmployees = JSON.parse(localStorage.getItem('employeeMaster') || '[]');
for (const emp of localEmployees) {
    const apiEmp = dataConverter.employeeToApi(emp);
    await apiClient.saveEmployee(apiEmp);
}

// 行事データ移行
const localEvents = JSON.parse(localStorage.getItem('eventMaster') || '[]');
for (const event of localEvents) {
    const apiEvent = dataConverter.eventToApi(event);
    await apiClient.saveEvent(apiEvent);
}
```

## 8. 本番環境設定

### セキュリティ設定
`config.php` で本番環境用に変更：

```php
// エラー表示を無効化
error_reporting(0);
ini_set('display_errors', 0);

// CORS設定を必要に応じて制限
header('Access-Control-Allow-Origin: https://yourdomain.com');
```

## 9. トラブルシューティング

### よくあるエラー
1. **データベース接続エラー**
   - `config.php` の接続情報を確認
   - コアサーバーでデータベース・ユーザーが正しく作成されているか確認

2. **API 404エラー**
   - `/api/` フォルダとPHPファイルがアップロードされているか確認
   - `.htaccess` ファイルの設定確認

3. **CORS エラー**
   - `config.php` のCORS設定を確認
   - ブラウザの開発者ツールでエラー詳細を確認

### デバッグ方法
```javascript
// ブラウザのコンソールでAPI直接テスト
fetch('/api/employees.php')
  .then(response => response.json())
  .then(data => console.log(data));
```

## 10. 今後の機能拡張

### マルチテナント対応準備
将来的な複数会社対応のため、以下を検討：

1. `companies` テーブル追加
2. 各テーブルに `company_id` カラム追加
3. URL/サブドメインによる会社識別
4. セッション管理の強化

この手順に従って設定することで、localStorageベースのシステムからMySQL APIベースのシステムに移行できます。