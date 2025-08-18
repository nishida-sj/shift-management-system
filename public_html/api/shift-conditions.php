<?php
/**
 * シフト条件設定 API
 * GET /api/shift-conditions.php - シフト条件取得
 * POST /api/shift-conditions.php - シフト条件保存
 */

require_once 'config.php';

$db = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($db);
        break;
    case 'POST':
        handlePost($db);
        break;
    default:
        sendErrorResponse('Method not allowed', 405);
}

function handleGet($db) {
    try {
        // シフト条件テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        $stmt = $db->prepare("SELECT * FROM shift_conditions ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $conditions = $stmt->fetch();
        
        if ($conditions) {
            // JSON文字列をデコード
            $result = [
                'basicSettings' => json_decode($conditions['basic_settings'], true),
                'timeSlots' => json_decode($conditions['time_slots'], true),
                'priorities' => json_decode($conditions['priorities'], true),
                'warnings' => json_decode($conditions['warnings'], true)
            ];
            sendJsonResponse($result);
        } else {
            // デフォルト値を返す
            $defaultSettings = getDefaultSettings();
            sendJsonResponse($defaultSettings);
        }
    } catch (PDOException $e) {
        error_log('Shift conditions fetch error: ' . $e->getMessage());
        sendErrorResponse('シフト条件の取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['basicSettings', 'timeSlots', 'priorities', 'warnings']);
    
    try {
        // シフト条件テーブルが存在しない場合は作成
        createTableIfNotExists($db);
        
        // JSON文字列に変換
        $basicSettings = json_encode($input['basicSettings']);
        $timeSlots = json_encode($input['timeSlots']);
        $priorities = json_encode($input['priorities']);
        $warnings = json_encode($input['warnings']);
        
        // 既存データがあるかチェック
        $stmt = $db->prepare("SELECT id FROM shift_conditions ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $existing = $stmt->fetch();
        
        if ($existing) {
            // 更新
            $sql = "UPDATE shift_conditions SET 
                    basic_settings = :basic_settings, 
                    time_slots = :time_slots, 
                    priorities = :priorities, 
                    warnings = :warnings,
                    updated_at = NOW()
                    WHERE id = :id";
            $params = [
                'basic_settings' => $basicSettings,
                'time_slots' => $timeSlots,
                'priorities' => $priorities,
                'warnings' => $warnings,
                'id' => $existing['id']
            ];
        } else {
            // 新規作成
            $sql = "INSERT INTO shift_conditions (basic_settings, time_slots, priorities, warnings, created_at, updated_at) 
                    VALUES (:basic_settings, :time_slots, :priorities, :warnings, NOW(), NOW())";
            $params = [
                'basic_settings' => $basicSettings,
                'time_slots' => $timeSlots,
                'priorities' => $priorities,
                'warnings' => $warnings
            ];
        }
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        sendJsonResponse(['success' => true, 'message' => 'シフト条件を保存しました']);
        
    } catch (PDOException $e) {
        error_log('Shift conditions save error: ' . $e->getMessage());
        sendErrorResponse('シフト条件の保存に失敗しました', 500);
    }
}

function createTableIfNotExists($db) {
    $sql = "CREATE TABLE IF NOT EXISTS shift_conditions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        basic_settings JSON NOT NULL COMMENT '基本設定 {\"minRestHours\":1,\"maxConsecutiveDays\":6,\"minRestDaysAfterConsecutive\":1}',
        time_slots JSON NOT NULL COMMENT '時間帯設定 [\"9:00-13:00\",\"9:30-14:00\",...]',
        priorities JSON NOT NULL COMMENT '優先度設定 {\"prioritizeMainBusiness\":true,\"respectOffRequests\":true,...}',
        warnings JSON NOT NULL COMMENT '警告設定 {\"warnConditionViolation\":true,\"warnConsecutiveWork\":true,...}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) COMMENT='シフト条件設定'";
    
    $db->exec($sql);
}

function getDefaultSettings() {
    return [
        'basicSettings' => [
            'minRestHours' => 1,
            'maxConsecutiveDays' => 6,
            'minRestDaysAfterConsecutive' => 1
        ],
        'timeSlots' => [
            '9:00-13:00',
            '9:30-14:00',
            '9:30-16:00',
            '10:00-14:00',
            '10:00-16:00',
            '13:00-17:00',
            '14:00-18:00',
            '9:00-17:00'
        ],
        'priorities' => [
            'prioritizeMainBusiness' => true,
            'respectOffRequests' => true,
            'respectTimePreferences' => true,
            'balanceWorkload' => false
        ],
        'warnings' => [
            'warnConditionViolation' => true,
            'warnConsecutiveWork' => true,
            'warnInsufficientRest' => true
        ]
    ];
}
?>