<?php
require_once 'config.php';

try {
    $db = Database::getInstance()->getConnection();
    echo "<h1>テーブル確認</h1><pre>\n";
    
    // テーブル一覧を取得
    $stmt = $db->prepare("SHOW TABLES");
    $stmt->execute();
    $tables = $stmt->fetchAll();
    
    echo "データベース内のテーブル:\n";
    foreach ($tables as $table) {
        $tableName = array_values($table)[0];
        echo "- $tableName\n";
    }
    
    // 各テーブルの構造確認
    $targetTables = ['shift_conditions', 'company_info', 'employee_orders'];
    
    foreach ($targetTables as $tableName) {
        echo "\n=== $tableName テーブル構造 ===\n";
        try {
            $stmt = $db->prepare("DESCRIBE $tableName");
            $stmt->execute();
            $columns = $stmt->fetchAll();
            
            foreach ($columns as $column) {
                echo $column['Field'] . " | " . $column['Type'] . " | " . $column['Null'] . " | " . $column['Key'] . "\n";
            }
            
            // レコード数確認
            $stmt = $db->prepare("SELECT COUNT(*) as count FROM $tableName");
            $stmt->execute();
            $count = $stmt->fetch()['count'];
            echo "レコード数: $count\n";
            
        } catch (Exception $e) {
            echo "エラー: " . $e->getMessage() . "\n";
        }
    }
    
    echo "</pre>";
    
} catch (Exception $e) {
    echo "<h1>データベース接続エラー</h1>";
    echo "<pre>" . $e->getMessage() . "</pre>";
}
?>