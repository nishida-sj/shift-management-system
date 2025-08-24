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
        $stmt = $db->prepare("SELECT condition_data FROM shift_conditions ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result) {
            sendJsonResponse(json_decode($result['condition_data'], true));
        } else {
            // デフォルト設定を返す
            $defaultSettings = [
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
        
        // データを JSON 形式で保存
        $conditionData = json_encode($input, JSON_UNESCAPED_UNICODE);
        
        // 既存のレコードを削除して新しいレコードを挿入
        $db->beginTransaction();
        
        // 既存データを削除
        $stmt = $db->prepare("DELETE FROM shift_conditions");
        $stmt->execute();
        
        // 新しいデータを挿入
        $stmt = $db->prepare("INSERT INTO shift_conditions (condition_data) VALUES (?)");
        $stmt->execute([$conditionData]);
        
        $db->commit();
        sendJsonResponse(['success' => true, 'message' => 'シフト条件を保存しました']);
        
    } catch (Exception $e) {
        $db->rollback();
        error_log('シフト条件保存エラー: ' . $e->getMessage());
        sendErrorResponse('シフト条件の保存に失敗しました', 500);
    }
}
?>