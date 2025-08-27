<?php
/**
 * セル背景色カラム追加マイグレーション実行
 * URL: /api/migrate-cell-colors.php
 */

require_once 'config.php';

// エラー表示を有効化（デバッグ用）
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>シフトセル背景色マイグレーション</h2>\n";

try {
    $db = Database::getInstance()->getConnection();
    
    echo "<p>データベース接続: 成功</p>\n";
    
    // confirmed_shiftsテーブルにcell_background_colorカラムが存在するかチェック
    echo "<h3>1. カラム存在チェック</h3>\n";
    $columnCheck = $db->query("SHOW COLUMNS FROM confirmed_shifts LIKE 'cell_background_color'");
    $hasColorColumn = $columnCheck->rowCount() > 0;
    
    if ($hasColorColumn) {
        echo "<p style='color: green;'>✅ cell_background_colorカラムは既に存在します</p>\n";
    } else {
        echo "<p style='color: orange;'>⚠️ cell_background_colorカラムが存在しません。追加します...</p>\n";
        
        // カラム追加SQL実行
        echo "<h3>2. カラム追加実行</h3>\n";
        $alterSql = "ALTER TABLE confirmed_shifts 
                     ADD COLUMN cell_background_color VARCHAR(20) COMMENT 'セル背景色 (orange, yellow, green, blue, pink)'";
        
        echo "<pre>実行SQL: " . htmlspecialchars($alterSql) . "</pre>\n";
        
        $db->exec($alterSql);
        echo "<p style='color: green;'>✅ cell_background_colorカラムを追加しました</p>\n";
    }
    
    // 最終確認
    echo "<h3>3. 最終確認</h3>\n";
    $finalCheck = $db->query("SHOW COLUMNS FROM confirmed_shifts LIKE 'cell_background_color'");
    if ($finalCheck->rowCount() > 0) {
        $columnInfo = $finalCheck->fetch();
        echo "<p style='color: green;'>✅ マイグレーション完了</p>\n";
        echo "<p>カラム情報: " . htmlspecialchars(json_encode($columnInfo)) . "</p>\n";
    } else {
        echo "<p style='color: red;'>❌ マイグレーションに失敗しました</p>\n";
    }
    
    // テーブル構造を表示
    echo "<h3>4. confirmed_shiftsテーブル構造</h3>\n";
    $columns = $db->query("SHOW COLUMNS FROM confirmed_shifts");
    echo "<table border='1' cellpadding='5'>\n";
    echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>\n";
    foreach ($columns as $column) {
        echo "<tr>";
        echo "<td>" . htmlspecialchars($column['Field']) . "</td>";
        echo "<td>" . htmlspecialchars($column['Type']) . "</td>";
        echo "<td>" . htmlspecialchars($column['Null']) . "</td>";
        echo "<td>" . htmlspecialchars($column['Key']) . "</td>";
        echo "<td>" . htmlspecialchars($column['Default'] ?? 'NULL') . "</td>";
        echo "<td>" . htmlspecialchars($column['Extra']) . "</td>";
        echo "</tr>\n";
    }
    echo "</table>\n";
    
} catch (Exception $e) {
    echo "<p style='color: red;'>❌ エラー: " . htmlspecialchars($e->getMessage()) . "</p>\n";
    echo "<p>詳細: " . htmlspecialchars($e->getTraceAsString()) . "</p>\n";
}

echo "<hr>\n";
echo "<p><a href='../shift-create.html'>シフト作成画面に戻る</a></p>\n";
echo "<p><em>マイグレーション完了後は、このファイルを削除することを推奨します。</em></p>\n";
?>