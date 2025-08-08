<?php
/**
 * シフト関連 API
 * GET /api/shifts.php?type=requests&employee_code=xxx&year=2025&month=1 - 従業員希望取得
 * GET /api/shifts.php?type=confirmed&year=2025&month=1 - 確定シフト取得
 * GET /api/shifts.php?type=monthly_events&year=2025&month=1 - 月間行事予定取得
 * GET /api/shifts.php?type=status&year=2025&month=1 - シフト状態取得
 * GET /api/shifts.php?type=notes&year=2025&month=1 - シフト備考取得
 * POST /api/shifts.php - データ保存（複数タイプ対応）
 * PUT /api/shifts.php - データ更新
 * DELETE /api/shifts.php - データ削除
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
    $type = $_GET['type'] ?? '';
    
    switch ($type) {
        case 'requests':
            getShiftRequests($db);
            break;
        case 'confirmed':
            getConfirmedShifts($db);
            break;
        case 'monthly_events':
            getMonthlyEvents($db);
            break;
        case 'status':
            getShiftStatus($db);
            break;
        case 'notes':
            getShiftNotes($db);
            break;
        default:
            sendErrorResponse('typeパラメータが必要です');
    }
}

function getShiftRequests($db) {
    $employee_code = $_GET['employee_code'] ?? '';
    $year = $_GET['year'] ?? '';
    $month = $_GET['month'] ?? '';
    
    if (empty($employee_code) || empty($year) || empty($month)) {
        sendErrorResponse('employee_code, year, monthパラメータが必要です');
    }
    
    validateDate($year, $month);
    
    try {
        $sql = "SELECT * FROM shift_requests 
                WHERE employee_code = :employee_code AND year = :year AND month = :month
                ORDER BY day";
        $stmt = $db->prepare($sql);
        $stmt->execute(['employee_code' => $employee_code, 'year' => $year, 'month' => $month]);
        $requests = $stmt->fetchAll();
        
        sendJsonResponse($requests);
    } catch (PDOException $e) {
        error_log('Shift requests fetch error: ' . $e->getMessage());
        sendErrorResponse('休み希望データの取得に失敗しました', 500);
    }
}

function getConfirmedShifts($db) {
    $year = $_GET['year'] ?? '';
    $month = $_GET['month'] ?? '';
    
    if (empty($year) || empty($month)) {
        sendErrorResponse('year, monthパラメータが必要です');
    }
    
    validateDate($year, $month);
    
    try {
        $sql = "SELECT cs.*, e.name, e.business_type as employee_business_type 
                FROM confirmed_shifts cs
                JOIN employees e ON cs.employee_code = e.employee_code
                WHERE cs.year = :year AND cs.month = :month
                ORDER BY cs.day, cs.employee_code";
        $stmt = $db->prepare($sql);
        $stmt->execute(['year' => $year, 'month' => $month]);
        $shifts = $stmt->fetchAll();
        
        sendJsonResponse($shifts);
    } catch (PDOException $e) {
        error_log('Confirmed shifts fetch error: ' . $e->getMessage());
        sendErrorResponse('確定シフトデータの取得に失敗しました', 500);
    }
}

function getMonthlyEvents($db) {
    $year = $_GET['year'] ?? '';
    $month = $_GET['month'] ?? '';
    
    if (empty($year) || empty($month)) {
        sendErrorResponse('year, monthパラメータが必要です');
    }
    
    validateDate($year, $month);
    
    try {
        $sql = "SELECT me.*, e.event_name, e.office_required, e.office_time_start, e.office_time_end,
                e.kitchen_required, e.kitchen_time_start, e.kitchen_time_end
                FROM monthly_events me
                JOIN events e ON me.event_id = e.event_id
                WHERE me.year = :year AND me.month = :month
                ORDER BY me.day";
        $stmt = $db->prepare($sql);
        $stmt->execute(['year' => $year, 'month' => $month]);
        $events = $stmt->fetchAll();
        
        sendJsonResponse($events);
    } catch (PDOException $e) {
        error_log('Monthly events fetch error: ' . $e->getMessage());
        sendErrorResponse('月間行事予定データの取得に失敗しました', 500);
    }
}

function getShiftStatus($db) {
    $year = $_GET['year'] ?? '';
    $month = $_GET['month'] ?? '';
    
    if (empty($year) || empty($month)) {
        sendErrorResponse('year, monthパラメータが必要です');
    }
    
    validateDate($year, $month);
    
    try {
        $stmt = $db->prepare("SELECT * FROM shift_status WHERE year = :year AND month = :month");
        $stmt->execute(['year' => $year, 'month' => $month]);
        $status = $stmt->fetch();
        
        if (!$status) {
            sendJsonResponse(['year' => (int)$year, 'month' => (int)$month, 'is_confirmed' => 0]);
        } else {
            sendJsonResponse($status);
        }
    } catch (PDOException $e) {
        error_log('Shift status fetch error: ' . $e->getMessage());
        sendErrorResponse('シフト状態データの取得に失敗しました', 500);
    }
}

function getShiftNotes($db) {
    $year = $_GET['year'] ?? '';
    $month = $_GET['month'] ?? '';
    
    if (empty($year) || empty($month)) {
        sendErrorResponse('year, monthパラメータが必要です');
    }
    
    validateDate($year, $month);
    
    try {
        $stmt = $db->prepare("SELECT * FROM shift_notes WHERE year = :year AND month = :month");
        $stmt->execute(['year' => $year, 'month' => $month]);
        $notes = $stmt->fetch();
        
        if (!$notes) {
            sendJsonResponse(['year' => (int)$year, 'month' => (int)$month, 'notes' => '']);
        } else {
            sendJsonResponse($notes);
        }
    } catch (PDOException $e) {
        error_log('Shift notes fetch error: ' . $e->getMessage());
        sendErrorResponse('シフト備考データの取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    $type = $input['type'] ?? '';
    
    switch ($type) {
        case 'requests':
            saveShiftRequests($db, $input);
            break;
        case 'confirmed':
            saveConfirmedShifts($db, $input);
            break;
        case 'monthly_events':
            saveMonthlyEvents($db, $input);
            break;
        case 'status':
            saveShiftStatus($db, $input);
            break;
        case 'notes':
            saveShiftNotes($db, $input);
            break;
        default:
            sendErrorResponse('typeが指定されていません');
    }
}

function saveShiftRequests($db, $input) {
    error_log('=== saveShiftRequests開始 ===');
    error_log('Input data: ' . json_encode($input));
    
    validateRequired($input, ['employee_code', 'year', 'month', 'requests']);
    validateDate($input['year'], $input['month']);
    
    try {
        $db->beginTransaction();
        
        // 既存データ削除
        error_log('既存データ削除開始: ' . $input['employee_code'] . ', ' . $input['year'] . '-' . $input['month']);
        $stmt = $db->prepare("DELETE FROM shift_requests WHERE employee_code = :employee_code AND year = :year AND month = :month");
        $stmt->execute(['employee_code' => $input['employee_code'], 'year' => $input['year'], 'month' => $input['month']]);
        error_log('削除された行数: ' . $stmt->rowCount());
        
        // 新データ挿入
        $sql = "INSERT INTO shift_requests (employee_code, year, month, day, is_off_requested, preferred_time_start, preferred_time_end) 
                VALUES (:employee_code, :year, :month, :day, :is_off_requested, :preferred_time_start, :preferred_time_end)";
        $stmt = $db->prepare($sql);
        
        $insertCount = 0;
        foreach ($input['requests'] as $day => $request) {
            error_log('処理中のリクエスト - Day: ' . $day . ', Request: ' . json_encode($request));
            
            if (!empty($request)) {
                $params = [
                    'employee_code' => $input['employee_code'],
                    'year' => $input['year'],
                    'month' => $input['month'],
                    'day' => $day,
                    'is_off_requested' => $request['isOff'] ?? 0,
                    'preferred_time_start' => $request['preferredStartTime'] ?? null,
                    'preferred_time_end' => $request['preferredEndTime'] ?? null
                ];
                
                error_log('挿入パラメータ: ' . json_encode($params));
                $stmt->execute($params);
                $insertCount++;
            }
        }
        
        error_log('挿入された行数: ' . $insertCount);
        $db->commit();
        error_log('トランザクション完了');
        
        sendJsonResponse(['message' => '休み希望を保存しました']);
        
    } catch (PDOException $e) {
        $db->rollBack();
        error_log('PDOException: ' . $e->getMessage());
        error_log('PDOException Code: ' . $e->getCode());
        error_log('Stack trace: ' . $e->getTraceAsString());
        sendErrorResponse('休み希望の保存に失敗しました', 500);
    } catch (Exception $e) {
        $db->rollBack();
        error_log('Exception: ' . $e->getMessage());
        error_log('Stack trace: ' . $e->getTraceAsString());
        sendErrorResponse('予期しないエラーが発生しました', 500);
    }
}

function saveConfirmedShifts($db, $input) {
    validateRequired($input, ['year', 'month', 'shifts']);
    validateDate($input['year'], $input['month']);
    
    try {
        $db->beginTransaction();
        
        // 既存データ削除
        $stmt = $db->prepare("DELETE FROM confirmed_shifts WHERE year = :year AND month = :month");
        $stmt->execute(['year' => $input['year'], 'month' => $input['month']]);
        
        // 新データ挿入
        $sql = "INSERT INTO confirmed_shifts (employee_code, year, month, day, time_start, time_end, business_type, is_violation) 
                VALUES (:employee_code, :year, :month, :day, :time_start, :time_end, :business_type, :is_violation)";
        $stmt = $db->prepare($sql);
        
        foreach ($input['shifts'] as $shift) {
            $stmt->execute([
                'employee_code' => $shift['employee_code'],
                'year' => $input['year'],
                'month' => $input['month'],
                'day' => $shift['day'],
                'time_start' => $shift['time_start'] ?? null,
                'time_end' => $shift['time_end'] ?? null,
                'business_type' => $shift['business_type'] ?? null,
                'is_violation' => $shift['is_violation'] ?? 0
            ]);
        }
        
        $db->commit();
        sendJsonResponse(['message' => '確定シフトを保存しました']);
        
    } catch (PDOException $e) {
        $db->rollBack();
        error_log('Confirmed shifts save error: ' . $e->getMessage());
        sendErrorResponse('確定シフトの保存に失敗しました', 500);
    }
}

function saveMonthlyEvents($db, $input) {
    validateRequired($input, ['year', 'month', 'events']);
    validateDate($input['year'], $input['month']);
    
    try {
        $db->beginTransaction();
        
        // 既存データ削除
        $stmt = $db->prepare("DELETE FROM monthly_events WHERE year = :year AND month = :month");
        $stmt->execute(['year' => $input['year'], 'month' => $input['month']]);
        
        // 新データ挿入
        $sql = "INSERT INTO monthly_events (year, month, day, event_id) VALUES (:year, :month, :day, :event_id)";
        $stmt = $db->prepare($sql);
        
        foreach ($input['events'] as $day => $event_id) {
            if (!empty($event_id)) {
                $stmt->execute([
                    'year' => $input['year'],
                    'month' => $input['month'],
                    'day' => $day,
                    'event_id' => $event_id
                ]);
            }
        }
        
        $db->commit();
        sendJsonResponse(['message' => '月間行事予定を保存しました']);
        
    } catch (PDOException $e) {
        $db->rollBack();
        error_log('Monthly events save error: ' . $e->getMessage());
        sendErrorResponse('月間行事予定の保存に失敗しました', 500);
    }
}

function saveShiftStatus($db, $input) {
    validateRequired($input, ['year', 'month', 'is_confirmed']);
    validateDate($input['year'], $input['month']);
    
    try {
        $sql = "INSERT INTO shift_status (year, month, is_confirmed) VALUES (:year, :month, :is_confirmed)
                ON DUPLICATE KEY UPDATE is_confirmed = :is_confirmed, updated_at = CURRENT_TIMESTAMP";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'year' => $input['year'],
            'month' => $input['month'],
            'is_confirmed' => $input['is_confirmed']
        ]);
        
        sendJsonResponse(['message' => 'シフト状態を保存しました']);
        
    } catch (PDOException $e) {
        error_log('Shift status save error: ' . $e->getMessage());
        sendErrorResponse('シフト状態の保存に失敗しました', 500);
    }
}

function saveShiftNotes($db, $input) {
    validateRequired($input, ['year', 'month']);
    validateDate($input['year'], $input['month']);
    
    try {
        $sql = "INSERT INTO shift_notes (year, month, notes) VALUES (:year, :month, :notes)
                ON DUPLICATE KEY UPDATE notes = :notes, updated_at = CURRENT_TIMESTAMP";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'year' => $input['year'],
            'month' => $input['month'],
            'notes' => $input['notes'] ?? ''
        ]);
        
        sendJsonResponse(['message' => 'シフト備考を保存しました']);
        
    } catch (PDOException $e) {
        error_log('Shift notes save error: ' . $e->getMessage());
        sendErrorResponse('シフト備考の保存に失敗しました', 500);
    }
}

function handlePut($db) {
    handlePost($db); // 同じ処理
}

function handleDelete($db) {
    $type = $_GET['type'] ?? '';
    $year = $_GET['year'] ?? '';
    $month = $_GET['month'] ?? '';
    
    if (empty($type) || empty($year) || empty($month)) {
        sendErrorResponse('type, year, monthパラメータが必要です');
    }
    
    validateDate($year, $month);
    
    try {
        switch ($type) {
            case 'confirmed':
                $stmt = $db->prepare("DELETE FROM confirmed_shifts WHERE year = :year AND month = :month");
                break;
            case 'monthly_events':
                $stmt = $db->prepare("DELETE FROM monthly_events WHERE year = :year AND month = :month");
                break;
            default:
                sendErrorResponse('無効なtypeです');
        }
        
        $stmt->execute(['year' => $year, 'month' => $month]);
        sendJsonResponse(['message' => 'データを削除しました']);
        
    } catch (PDOException $e) {
        error_log('Delete error: ' . $e->getMessage());
        sendErrorResponse('データの削除に失敗しました', 500);
    }
}
?>