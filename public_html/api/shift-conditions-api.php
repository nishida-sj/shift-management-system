<?php
require_once 'config.php';

$db = Database::getInstance()->getConnection();

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        getShiftConditions($db);
        break;
    case 'POST':
        saveShiftConditions($db);
        break;
    default:
        sendErrorResponse('不正なリクエストメソッドです', 405);
}

function getShiftConditions($db) {
    try {
        $stmt = $db->prepare("SELECT basic_settings, time_slots, priorities, warnings FROM shift_conditions ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result) {
            $settings = [
                'basicSettings' => json_decode($result['basic_settings'] ?: '{}', true),
                'timeSlots' => json_decode($result['time_slots'] ?: '[]', true),
                'priorities' => json_decode($result['priorities'] ?: '{}', true),
                'warnings' => json_decode($result['warnings'] ?: '{}', true)
            ];
            sendJsonResponse($settings);
        } else {
            // デフォルト設定を返す
            $defaultSettings = [
                'basicSettings' => [
                    'minRestHours' => 1,
                    'maxConsecutiveDays' => 6,
                    'minRestDaysAfterConsecutive' => 1
                ],
                'timeSlots' => [
                    '09:00-13:00',
                    '09:30-14:00',
                    '09:30-16:00',
                    '10:00-14:00',
                    '10:00-16:00',
                    '13:00-17:00',
                    '14:00-18:00',
                    '09:00-17:00'
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
            sendJsonResponse($defaultSettings);
        }
    } catch (Exception $e) {
        error_log('シフト条件取得エラー: ' . $e->getMessage());
        sendErrorResponse('シフト条件の取得に失敗しました', 500);
    }
}

function saveShiftConditions($db) {
    try {
        $input = getJsonInput();
        
        // 必須フィールドのバリデーション
        if (!isset($input['basicSettings']) || !isset($input['timeSlots']) || 
            !isset($input['priorities']) || !isset($input['warnings'])) {
            sendErrorResponse('必須項目が不足しています');
        }
        
        // 各セクションをJSON形式で保存
        $basicSettings = json_encode($input['basicSettings'], JSON_UNESCAPED_UNICODE);
        $timeSlots = json_encode($input['timeSlots'], JSON_UNESCAPED_UNICODE);
        $priorities = json_encode($input['priorities'], JSON_UNESCAPED_UNICODE);
        $warnings = json_encode($input['warnings'], JSON_UNESCAPED_UNICODE);
        
        // 既存のレコードを削除して新しいレコードを挿入
        $db->beginTransaction();
        
        // 既存データを削除
        $stmt = $db->prepare("DELETE FROM shift_conditions");
        $stmt->execute();
        
        // 新しいデータを挿入
        $stmt = $db->prepare("INSERT INTO shift_conditions (basic_settings, time_slots, priorities, warnings) VALUES (?, ?, ?, ?)");
        $stmt->execute([$basicSettings, $timeSlots, $priorities, $warnings]);
        
        $db->commit();
        sendJsonResponse(['success' => true, 'message' => 'シフト条件を保存しました']);
        
    } catch (Exception $e) {
        $db->rollback();
        error_log('シフト条件保存エラー: ' . $e->getMessage());
        sendErrorResponse('シフト条件の保存に失敗しました', 500);
    }
}
?>