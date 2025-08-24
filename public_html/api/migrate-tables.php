<?php
/**
 * データベーステーブル作成用スクリプト
 * localStorage移行のための必要テーブルを作成
 */

require_once 'config.php';

try {
    $db = Database::getInstance()->getConnection();
    
    // レスポンス用の配列
    $results = [];
    
    echo "<h1>データベーステーブル作成</h1>\n";
    echo "<pre>\n";
    
    // 1. シフト条件設定テーブル
    try {
        $sql = "CREATE TABLE IF NOT EXISTS shift_conditions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            condition_data JSON NOT NULL COMMENT 'シフト条件設定データ（JSON形式）',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) COMMENT='シフト条件設定'";
        $db->exec($sql);
        echo "✓ shift_conditions テーブルを作成しました\n";
        $results['shift_conditions'] = 'OK';
        
        // 初期データがない場合は挿入
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM shift_conditions");
        $stmt->execute();
        $count = $stmt->fetch()['count'];
        
        if ($count == 0) {
            $defaultData = '{
                "basicSettings": {
                    "minRestHours": 1,
                    "maxConsecutiveDays": 6,
                    "minRestDaysAfterConsecutive": 1
                },
                "timeSlots": [
                    "9:00-13:00",
                    "9:30-14:00",
                    "9:30-16:00",
                    "10:00-14:00",
                    "10:00-16:00",
                    "13:00-17:00",
                    "14:00-18:00",
                    "9:00-17:00"
                ],
                "priorities": {
                    "prioritizeMainBusiness": true,
                    "respectOffRequests": true,
                    "respectTimePreferences": true,
                    "balanceWorkload": false
                },
                "warnings": {
                    "warnConditionViolation": true,
                    "warnConsecutiveWork": true,
                    "warnInsufficientRest": true
                }
            }';
            $stmt = $db->prepare("INSERT INTO shift_conditions (condition_data) VALUES (?)");
            $stmt->execute([$defaultData]);
            echo "✓ shift_conditions に初期データを挿入しました\n";
        }
        
    } catch (Exception $e) {
        echo "✗ shift_conditions テーブル作成エラー: " . $e->getMessage() . "\n";
        $results['shift_conditions'] = 'ERROR: ' . $e->getMessage();
    }
    
    // 2. 会社情報テーブル
    try {
        $sql = "CREATE TABLE IF NOT EXISTS company_info (
            id INT PRIMARY KEY AUTO_INCREMENT,
            company_data JSON NOT NULL COMMENT '会社情報データ（JSON形式）',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) COMMENT='会社情報'";
        $db->exec($sql);
        echo "✓ company_info テーブルを作成しました\n";
        $results['company_info'] = 'OK';
        
        // 初期データがない場合は挿入
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM company_info");
        $stmt->execute();
        $count = $stmt->fetch()['count'];
        
        if ($count == 0) {
            $defaultData = '{
                "name": "サンプル会社",
                "address": "〒000-0000 東京都",
                "phone": "03-0000-0000",
                "email": "info@example.com"
            }';
            $stmt = $db->prepare("INSERT INTO company_info (company_data) VALUES (?)");
            $stmt->execute([$defaultData]);
            echo "✓ company_info に初期データを挿入しました\n";
        }
        
    } catch (Exception $e) {
        echo "✗ company_info テーブル作成エラー: " . $e->getMessage() . "\n";
        $results['company_info'] = 'ERROR: ' . $e->getMessage();
    }
    
    // 3. 従業員並び順テーブル
    try {
        $sql = "CREATE TABLE IF NOT EXISTS employee_orders (
            id INT PRIMARY KEY AUTO_INCREMENT,
            business_type_code VARCHAR(50) NOT NULL,
            order_data JSON NOT NULL COMMENT '従業員並び順データ（JSON形式）',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_business_type (business_type_code)
        ) COMMENT='従業員並び順'";
        $db->exec($sql);
        echo "✓ employee_orders テーブルを作成しました\n";
        
        // インデックス作成
        $sql = "CREATE INDEX IF NOT EXISTS idx_employee_orders_business_type ON employee_orders (business_type_code)";
        $db->exec($sql);
        echo "✓ employee_orders インデックスを作成しました\n";
        $results['employee_orders'] = 'OK';
        
    } catch (Exception $e) {
        echo "✗ employee_orders テーブル作成エラー: " . $e->getMessage() . "\n";
        $results['employee_orders'] = 'ERROR: ' . $e->getMessage();
    }
    
    // 4. business_types テーブル（念のため）
    try {
        $sql = "CREATE TABLE IF NOT EXISTS business_types (
            code VARCHAR(50) PRIMARY KEY COMMENT '業務区分コード',
            name VARCHAR(100) NOT NULL COMMENT '業務区分名',
            description TEXT COMMENT '説明',
            build_order INT DEFAULT 999 COMMENT 'シフト構築順序',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) COMMENT='業務区分マスタ'";
        $db->exec($sql);
        echo "✓ business_types テーブルを確認しました\n";
        $results['business_types'] = 'OK';
        
    } catch (Exception $e) {
        echo "✗ business_types テーブルエラー: " . $e->getMessage() . "\n";
        $results['business_types'] = 'ERROR: ' . $e->getMessage();
    }
    
    echo "\n=== 作成完了 ===\n";
    echo "作成されたテーブル:\n";
    foreach ($results as $table => $status) {
        echo "- $table: $status\n";
    }
    
    echo "\n次のAPIエンドポイントが利用可能になりました:\n";
    echo "- /api/shift-conditions-api.php\n";
    echo "- /api/company-info-api.php\n";
    echo "- /api/employee-orders-api.php\n";
    
    echo "</pre>\n";
    
} catch (Exception $e) {
    echo "<h1>エラー</h1>\n";
    echo "<pre>データベース接続エラー: " . $e->getMessage() . "</pre>\n";
}
?>