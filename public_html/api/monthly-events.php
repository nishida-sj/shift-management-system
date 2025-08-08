<?php
/**
 * 月間行事予定 API
 * GET /api/monthly-events.php?year=2024&month=8 - 指定月の行事予定取得
 * POST /api/monthly-events.php - 月間行事予定登録・更新
 * DELETE /api/monthly-events.php?year=2024&month=8&day=1&event_id=1 - 指定行事予定削除
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
    case 'DELETE':
        handleDelete($db);
        break;
    default:
        sendErrorResponse('Method not allowed', 405);
}

function handleGet($db) {
    // 年月指定チェック
    if (!isset($_GET['year']) || !isset($_GET['month'])) {
        sendErrorResponse('年月の指定が必要です');
    }
    
    $year = (int)$_GET['year'];
    $month = (int)$_GET['month'];
    
    // 日付検証
    validateDate($year, $month);
    
    try {
        $sql = "SELECT me.*, e.event_name 
                FROM monthly_events me 
                LEFT JOIN events e ON me.event_id = e.event_id 
                WHERE me.year = :year AND me.month = :month 
                ORDER BY me.day";
        
        $stmt = $db->prepare($sql);
        $stmt->execute(['year' => $year, 'month' => $month]);
        $events = $stmt->fetchAll();
        
        // 日付をキーとした連想配列に変換
        $monthlyEvents = [];
        foreach ($events as $event) {
            $dateKey = sprintf('%04d-%02d-%02d', $event['year'], $event['month'], $event['day']);
            $monthlyEvents[$dateKey] = [
                'event_id' => (int)$event['event_id'],
                'event_name' => $event['event_name'],
                'year' => (int)$event['year'],
                'month' => (int)$event['month'],
                'day' => (int)$event['day'],
                'created_at' => $event['created_at']
            ];
        }
        
        sendJsonResponse($monthlyEvents);
        
    } catch (PDOException $e) {
        error_log('Monthly events fetch error: ' . $e->getMessage());
        sendErrorResponse('月間行事予定の取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['year', 'month', 'day', 'event_id']);
    
    $year = (int)$input['year'];
    $month = (int)$input['month'];
    $day = (int)$input['day'];
    $event_id = (int)$input['event_id'];
    
    // 日付検証
    validateDate($year, $month, $day);
    
    // イベントIDの存在確認
    $eventStmt = $db->prepare("SELECT event_id FROM events WHERE event_id = :event_id");
    $eventStmt->execute(['event_id' => $event_id]);
    if (!$eventStmt->fetch()) {
        sendErrorResponse('指定された行事IDが存在しません', 400);
    }
    
    try {
        // 既存データがある場合は更新、ない場合は挿入
        $sql = "INSERT INTO monthly_events (year, month, day, event_id) 
                VALUES (:year, :month, :day, :event_id)
                ON DUPLICATE KEY UPDATE event_id = :event_id, updated_at = CURRENT_TIMESTAMP";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'year' => $year,
            'month' => $month,
            'day' => $day,
            'event_id' => $event_id
        ]);
        
        sendJsonResponse(['message' => '月間行事予定を登録しました'], 201);
        
    } catch (PDOException $e) {
        error_log('Monthly events insert error: ' . $e->getMessage());
        if ($e->getCode() == 23000) { // 重複エラー
            sendErrorResponse('指定した日付に既に行事予定が登録されています', 400);
        }
        sendErrorResponse('月間行事予定の登録に失敗しました', 500);
    }
}

function handleDelete($db) {
    // パラメータチェック
    if (!isset($_GET['year']) || !isset($_GET['month']) || !isset($_GET['day'])) {
        sendErrorResponse('年月日の指定が必要です');
    }
    
    $year = (int)$_GET['year'];
    $month = (int)$_GET['month'];
    $day = (int)$_GET['day'];
    
    // 日付検証
    validateDate($year, $month, $day);
    
    try {
        $sql = "DELETE FROM monthly_events WHERE year = :year AND month = :month AND day = :day";
        
        // event_idが指定されている場合は、特定の行事のみ削除
        if (isset($_GET['event_id'])) {
            $sql .= " AND event_id = :event_id";
        }
        
        $stmt = $db->prepare($sql);
        $params = ['year' => $year, 'month' => $month, 'day' => $day];
        
        if (isset($_GET['event_id'])) {
            $params['event_id'] = (int)$_GET['event_id'];
        }
        
        $stmt->execute($params);
        
        if ($stmt->rowCount() === 0) {
            sendErrorResponse('指定された行事予定が見つかりません', 404);
        }
        
        sendJsonResponse(['message' => '月間行事予定を削除しました']);
        
    } catch (PDOException $e) {
        error_log('Monthly events delete error: ' . $e->getMessage());
        sendErrorResponse('月間行事予定の削除に失敗しました', 500);
    }
}
?>