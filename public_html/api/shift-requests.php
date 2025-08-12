<?php
/**
 * シフト希望 API
 * GET /api/shift-requests.php?employee_code=xxx&year=2024&month=8 - 従業員のシフト希望取得
 * POST /api/shift-requests.php - シフト希望登録・更新
 * DELETE /api/shift-requests.php?employee_code=xxx&year=2024&month=8&day=1 - シフト希望削除
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
    $employee_code = $_GET['employee_code'] ?? null;
    $year = $_GET['year'] ?? null;
    $month = $_GET['month'] ?? null;
    
    if (!$employee_code || !$year || !$month) {
        sendErrorResponse('employee_code, year, month パラメータが必要です');
    }
    
    // 日付検証
    validateDate((int)$year, (int)$month);
    
    try {
        error_log('=== shift-requests.php GET処理開始 ===');
        error_log('検索条件: employee_code=' . $employee_code . ', year=' . $year . ', month=' . $month);
        
        $sql = "SELECT sr.*, e.name as employee_name 
                FROM shift_requests sr 
                LEFT JOIN employees e ON sr.employee_code = e.employee_code 
                WHERE sr.employee_code = :employee_code AND sr.year = :year AND sr.month = :month 
                ORDER BY sr.day";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'employee_code' => $employee_code,
            'year' => (int)$year,
            'month' => (int)$month
        ]);
        $requests = $stmt->fetchAll();
        
        error_log('データベースから取得した行数: ' . count($requests));
        if (count($requests) > 0) {
            error_log('最初のレコード: ' . json_encode($requests[0]));
        }
        
        // requestsFromApi関数と互換性を保つため、配列形式で返す（従来のshifts.php形式）
        sendJsonResponse($requests);
        
    } catch (PDOException $e) {
        error_log('Shift requests fetch error: ' . $e->getMessage());
        sendErrorResponse('シフト希望の取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    
    error_log('=== shift-requests.php POST処理開始 ===');
    error_log('受信データ: ' . json_encode($input));
    
    // 必須項目チェック
    validateRequired($input, ['employee_code', 'year', 'month', 'day']);
    
    $employee_code = $input['employee_code'];
    $year = (int)$input['year'];
    $month = (int)$input['month'];
    $day = (int)$input['day'];
    $is_off_requested = $input['is_off_requested'] ?? false;
    $preferred_time_start = $input['preferred_time_start'] ?? null;
    $preferred_time_end = $input['preferred_time_end'] ?? null;
    
    error_log('処理パラメータ: employee_code=' . $employee_code . ', date=' . $year . '-' . $month . '-' . $day);
    error_log('希望内容: is_off=' . ($is_off_requested ? 'true' : 'false') . ', start=' . $preferred_time_start . ', end=' . $preferred_time_end);
    
    // 日付検証
    validateDate($year, $month, $day);
    
    // 従業員コードの存在確認
    $empStmt = $db->prepare("SELECT employee_code FROM employees WHERE employee_code = :employee_code");
    $empStmt->execute(['employee_code' => $employee_code]);
    if (!$empStmt->fetch()) {
        sendErrorResponse('指定された従業員コードが存在しません', 400);
    }
    
    try {
        // 既存データがある場合は更新、ない場合は挿入
        $sql = "INSERT INTO shift_requests (employee_code, year, month, day, is_off_requested, preferred_time_start, preferred_time_end) 
                VALUES (:employee_code, :year, :month, :day, :is_off_requested, :preferred_time_start, :preferred_time_end)
                ON DUPLICATE KEY UPDATE 
                is_off_requested = VALUES(is_off_requested),
                preferred_time_start = VALUES(preferred_time_start),
                preferred_time_end = VALUES(preferred_time_end),
                updated_at = CURRENT_TIMESTAMP";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'employee_code' => $employee_code,
            'year' => $year,
            'month' => $month,
            'day' => $day,
            'is_off_requested' => $is_off_requested ? 1 : 0,
            'preferred_time_start' => $preferred_time_start,
            'preferred_time_end' => $preferred_time_end
        ]);
        
        error_log('データベース挿入完了: ' . $stmt->rowCount() . '行影響');
        error_log('=== shift-requests.php POST処理完了 ===');
        
        sendJsonResponse(['message' => 'シフト希望を登録しました'], 201);
        
    } catch (PDOException $e) {
        error_log('Shift request insert error: ' . $e->getMessage());
        sendErrorResponse('シフト希望の登録に失敗しました', 500);
    }
}

function handleDelete($db) {
    $employee_code = $_GET['employee_code'] ?? null;
    $year = $_GET['year'] ?? null;
    $month = $_GET['month'] ?? null;
    $day = $_GET['day'] ?? null;
    
    if (!$employee_code || !$year || !$month || !$day) {
        sendErrorResponse('employee_code, year, month, day パラメータが必要です');
    }
    
    // 日付検証
    validateDate((int)$year, (int)$month, (int)$day);
    
    try {
        $sql = "DELETE FROM shift_requests 
                WHERE employee_code = :employee_code AND year = :year AND month = :month AND day = :day";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'employee_code' => $employee_code,
            'year' => (int)$year,
            'month' => (int)$month,
            'day' => (int)$day
        ]);
        
        if ($stmt->rowCount() === 0) {
            sendErrorResponse('指定されたシフト希望が見つかりません', 404);
        }
        
        sendJsonResponse(['message' => 'シフト希望を削除しました']);
        
    } catch (PDOException $e) {
        error_log('Shift request delete error: ' . $e->getMessage());
        sendErrorResponse('シフト希望の削除に失敗しました', 500);
    }
}
?>