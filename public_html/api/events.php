<?php
/**
 * 行事マスタ API
 * GET /api/events.php - 全行事取得
 * POST /api/events.php - 行事追加
 * PUT /api/events.php - 行事更新
 * DELETE /api/events.php?event_id=xxx - 行事削除
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
    case 'PUT':
        handlePut($db);
        break;
    case 'DELETE':
        handleDelete($db);
        break;
    default:
        sendErrorResponse('Method not allowed', 405);
}

function handleGet($db) {
    try {
        $stmt = $db->query("SELECT * FROM events ORDER BY event_id");
        $events = $stmt->fetchAll();
        
        foreach ($events as &$event) {
            if ($event['requirements']) {
                $event['requirements'] = json_decode($event['requirements'], true);
            }
        }
        
        sendJsonResponse($events);
    } catch (PDOException $e) {
        error_log('Event fetch error: ' . $e->getMessage());
        sendErrorResponse('行事データの取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['event_name']);
    
    // 時間形式チェック
    if (isset($input['office_time_start']) && !empty($input['office_time_start'])) {
        validateTime($input['office_time_start']);
    }
    if (isset($input['office_time_end']) && !empty($input['office_time_end'])) {
        validateTime($input['office_time_end']);
    }
    if (isset($input['kitchen_time_start']) && !empty($input['kitchen_time_start'])) {
        validateTime($input['kitchen_time_start']);
    }
    if (isset($input['kitchen_time_end']) && !empty($input['kitchen_time_end'])) {
        validateTime($input['kitchen_time_end']);
    }
    
    try {
        $sql = "INSERT INTO events (event_name, office_required, office_time_start, office_time_end,
                kitchen_required, kitchen_time_start, kitchen_time_end, requirements) 
                VALUES (:event_name, :office_required, :office_time_start, :office_time_end,
                :kitchen_required, :kitchen_time_start, :kitchen_time_end, :requirements)";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'event_name' => $input['event_name'],
            'office_required' => $input['office_required'] ?? 0,
            'office_time_start' => $input['office_time_start'] ?? null,
            'office_time_end' => $input['office_time_end'] ?? null,
            'kitchen_required' => $input['kitchen_required'] ?? 0,
            'kitchen_time_start' => $input['kitchen_time_start'] ?? null,
            'kitchen_time_end' => $input['kitchen_time_end'] ?? null,
            'requirements' => isset($input['requirements']) ? json_encode($input['requirements'], JSON_UNESCAPED_UNICODE) : null
        ]);
        
        $event_id = $db->lastInsertId();
        sendJsonResponse(['message' => '行事を追加しました', 'event_id' => $event_id], 201);
        
    } catch (PDOException $e) {
        error_log('Event insert error: ' . $e->getMessage());
        sendErrorResponse('行事の追加に失敗しました', 500);
    }
}

function handlePut($db) {
    $input = getJsonInput();
    
    // 必須項目チェック
    validateRequired($input, ['event_id', 'event_name']);
    
    // 時間形式チェック
    if (isset($input['office_time_start']) && !empty($input['office_time_start'])) {
        validateTime($input['office_time_start']);
    }
    if (isset($input['office_time_end']) && !empty($input['office_time_end'])) {
        validateTime($input['office_time_end']);
    }
    if (isset($input['kitchen_time_start']) && !empty($input['kitchen_time_start'])) {
        validateTime($input['kitchen_time_start']);
    }
    if (isset($input['kitchen_time_end']) && !empty($input['kitchen_time_end'])) {
        validateTime($input['kitchen_time_end']);
    }
    
    try {
        $sql = "UPDATE events SET event_name = :event_name, office_required = :office_required, 
                office_time_start = :office_time_start, office_time_end = :office_time_end,
                kitchen_required = :kitchen_required, kitchen_time_start = :kitchen_time_start, 
                kitchen_time_end = :kitchen_time_end, requirements = :requirements, updated_at = CURRENT_TIMESTAMP
                WHERE event_id = :event_id";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'event_id' => $input['event_id'],
            'event_name' => $input['event_name'],
            'office_required' => $input['office_required'] ?? 0,
            'office_time_start' => $input['office_time_start'] ?? null,
            'office_time_end' => $input['office_time_end'] ?? null,
            'kitchen_required' => $input['kitchen_required'] ?? 0,
            'kitchen_time_start' => $input['kitchen_time_start'] ?? null,
            'kitchen_time_end' => $input['kitchen_time_end'] ?? null,
            'requirements' => isset($input['requirements']) ? json_encode($input['requirements'], JSON_UNESCAPED_UNICODE) : null
        ]);
        
        if ($stmt->rowCount() === 0) {
            sendErrorResponse('指定された行事IDが見つかりません', 404);
        }
        
        sendJsonResponse(['message' => '行事情報を更新しました']);
        
    } catch (PDOException $e) {
        error_log('Event update error: ' . $e->getMessage());
        sendErrorResponse('行事情報の更新に失敗しました', 500);
    }
}

function handleDelete($db) {
    if (!isset($_GET['event_id'])) {
        sendErrorResponse('行事IDが指定されていません');
    }
    
    try {
        $stmt = $db->prepare("DELETE FROM events WHERE event_id = :event_id");
        $stmt->execute(['event_id' => $_GET['event_id']]);
        
        if ($stmt->rowCount() === 0) {
            sendErrorResponse('指定された行事IDが見つかりません', 404);
        }
        
        sendJsonResponse(['message' => '行事を削除しました']);
        
    } catch (PDOException $e) {
        error_log('Event delete error: ' . $e->getMessage());
        sendErrorResponse('行事の削除に失敗しました', 500);
    }
}
?>