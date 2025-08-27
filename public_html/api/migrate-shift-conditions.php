<?php
/**
 * シフト条件テーブル構造修正マイグレーション実行
 * URL: /api/migrate-shift-conditions.php
 */

require_once 'config.php';

// エラー表示を有効化（デバッグ用）
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>シフト条件テーブル構造修正マイグレーション</h2>\n";

try {
    $db = Database::getInstance()->getConnection();
    
    echo "<p>データベース接続: 成功</p>\n";
    
    // shift_conditionsテーブルの構造をチェック
    echo "<h3>1. 現在のshift_conditionsテーブル構造チェック</h3>\n";
    
    // テーブルが存在するかチェック
    $tableCheck = $db->query("SHOW TABLES LIKE 'shift_conditions'");
    if ($tableCheck->rowCount() == 0) {
        echo "<p style='color: red;'>❌ shift_conditionsテーブルが存在しません</p>\n";
        echo "<p>新規作成します...</p>\n";
        $needMigration = true;
    } else {
        // テーブル構造をチェック
        $columns = $db->query("SHOW COLUMNS FROM shift_conditions");
        $columnList = [];
        foreach ($columns as $col) {
            $columnList[] = $col['Field'];
        }
        
        echo "<p>既存カラム: " . implode(', ', $columnList) . "</p>\n";
        
        // JSON形式のカラムが存在するかチェック
        $needMigration = !in_array('time_slots', $columnList) || 
                         !in_array('basic_settings', $columnList) ||
                         !in_array('priorities', $columnList) ||
                         !in_array('warnings', $columnList);
        
        if ($needMigration) {
            echo "<p style='color: orange;'>⚠️ 旧構造のテーブルです。JSON形式に変更します...</p>\n";
        } else {
            echo "<p style='color: green;'>✅ 既にJSON形式の新構造です</p>\n";
        }
    }
    
    if ($needMigration) {
        echo "<h3>2. マイグレーション実行</h3>\n";
        
        $db->beginTransaction();
        
        // 既存テーブルをバックアップ
        try {
            $backupCheck = $db->query("SHOW TABLES LIKE 'shift_conditions_backup'");
            if ($backupCheck->rowCount() == 0) {
                echo "<p>既存テーブルをバックアップ中...</p>\n";
                $db->exec("RENAME TABLE shift_conditions TO shift_conditions_backup");
                echo "<p>✅ バックアップ完了</p>\n";
            } else {
                echo "<p>⚠️ バックアップテーブルが既に存在します。既存テーブルを削除...</p>\n";
                $db->exec("DROP TABLE shift_conditions");
            }
        } catch (Exception $e) {
            if (strpos($e->getMessage(), "doesn't exist") !== false) {
                echo "<p>既存テーブルなし、新規作成します</p>\n";
            } else {
                throw $e;
            }
        }
        
        // 新しいテーブルを作成
        echo "<p>新しいshift_conditionsテーブルを作成中...</p>\n";
        $createTable = "
            CREATE TABLE shift_conditions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                basic_settings JSON COMMENT '基本設定（JSON形式）',
                time_slots JSON COMMENT '時間帯マスタ（JSON形式）',
                priorities JSON COMMENT '優先度設定（JSON形式）',
                warnings JSON COMMENT '警告設定（JSON形式）',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ";
        $db->exec($createTable);
        echo "<p>✅ テーブル作成完了</p>\n";
        
        // 初期データを挿入
        echo "<p>初期データを挿入中...</p>\n";
        $insertData = "
            INSERT INTO shift_conditions (basic_settings, time_slots, priorities, warnings) VALUES (
                '{\"minRestHours\": 1, \"maxConsecutiveDays\": 6, \"minRestDaysAfterConsecutive\": 1}',
                '[\"09:00-13:00\", \"09:30-14:00\", \"09:30-16:00\", \"10:00-14:00\", \"10:00-16:00\", \"13:00-17:00\", \"14:00-18:00\", \"09:00-17:00\"]',
                '{\"prioritizeMainBusiness\": true, \"respectOffRequests\": true, \"respectTimePreferences\": true, \"balanceWorkload\": false}',
                '{\"warnConditionViolation\": true, \"warnConsecutiveWork\": true, \"warnInsufficientRest\": true}'
            )
        ";
        $db->exec($insertData);
        echo "<p>✅ 初期データ挿入完了</p>\n";
        
        $db->commit();
        echo "<p style='color: green;'>✅ マイグレーション完了</p>\n";
    }
    
    // 最終確認
    echo "<h3>3. 最終確認</h3>\n";
    $stmt = $db->query("SELECT * FROM shift_conditions LIMIT 1");
    $data = $stmt->fetch();
    
    if ($data) {
        echo "<p style='color: green;'>✅ データ確認OK</p>\n";
        echo "<p>時間帯マスタ: " . htmlspecialchars($data['time_slots']) . "</p>\n";
        echo "<p>基本設定: " . htmlspecialchars($data['basic_settings']) . "</p>\n";
        echo "<p>優先度設定: " . htmlspecialchars($data['priorities']) . "</p>\n";
        echo "<p>警告設定: " . htmlspecialchars($data['warnings']) . "</p>\n";
    } else {
        echo "<p style='color: red;'>❌ データが見つかりません</p>\n";
    }
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    echo "<p style='color: red;'>❌ エラー: " . htmlspecialchars($e->getMessage()) . "</p>\n";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>\n";
}

echo "<hr>\n";
echo "<p><a href='../shift-create.html'>シフト作成画面に戻る</a></p>\n";
echo "<p><em>マイグレーション完了後は、このファイルを削除することを推奨します。</em></p>\n";
?>