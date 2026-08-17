<?php
/**
 * 勤怠（打刻）API
 * GET  /api/attendance.php?employee_code=xxx&date=YYYY-MM-DD  - 指定日の打刻取得
 * GET  /api/attendance.php?year=YYYY&month=MM[&employee_code=xxx] - 月次の打刻取得
 * POST /api/attendance.php  { employee_code, type:'in'|'out', reason? } - 打刻（サーバー時刻で記録）
 * PUT  /api/attendance.php  { employee_code, work_date, clock_in?, clock_out?, reason? } - 管理者修正
 */

require_once 'config.php';
date_default_timezone_set('Asia/Tokyo');

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
    default:
        sendErrorResponse('Method not allowed', 405);
}

// 期間（YYYY-MM-DD）の検証
function validateDateRange($start, $end) {
    foreach (['開始日' => $start, '終了日' => $end] as $label => $d) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
            sendErrorResponse($label . 'の形式が不正です（YYYY-MM-DD）');
        }
        list($y, $m, $day) = array_map('intval', explode('-', $d));
        if (!checkdate($m, $day, $y)) {
            sendErrorResponse($label . 'に存在しない日付が指定されています');
        }
    }
    if ($start > $end) {
        sendErrorResponse('開始日が終了日より後になっています');
    }
}

function handleGet($db) {
    $employee_code = $_GET['employee_code'] ?? null;
    $date = $_GET['date'] ?? null;
    $year = $_GET['year'] ?? null;
    $month = $_GET['month'] ?? null;
    $start = $_GET['start'] ?? null;
    $end = $_GET['end'] ?? null;

    try {
        if ($employee_code && $date) {
            // 指定従業員・指定日の1件
            $stmt = $db->prepare("SELECT * FROM attendance_records WHERE employee_code = :c AND work_date = :d");
            $stmt->execute(['c' => $employee_code, 'd' => $date]);
            sendJsonResponse($stmt->fetch() ?: null);
        } elseif (($start && $end) || ($year && $month)) {
            // 期間指定（日単位）または月次（管理者・出力プレビュー用）
            if ($start && $end) {
                validateDateRange($start, $end);
            } else {
                validateDate($year, $month);
                $start = sprintf('%04d-%02d-01', $year, $month);
                $end = date('Y-m-t', strtotime($start));
            }

            if ($employee_code) {
                $stmt = $db->prepare(
                    "SELECT a.*, e.name, e.attendance_code FROM attendance_records a
                     JOIN employees e ON a.employee_code = e.employee_code
                     WHERE a.employee_code = :c AND a.work_date BETWEEN :s AND :e
                     ORDER BY a.work_date"
                );
                $stmt->execute(['c' => $employee_code, 's' => $start, 'e' => $end]);
            } else {
                $stmt = $db->prepare(
                    "SELECT a.*, e.name, e.attendance_code FROM attendance_records a
                     JOIN employees e ON a.employee_code = e.employee_code
                     WHERE a.work_date BETWEEN :s AND :e
                     ORDER BY e.employee_code, a.work_date"
                );
                $stmt->execute(['s' => $start, 'e' => $end]);
            }
            sendJsonResponse($stmt->fetchAll());
        } else {
            sendErrorResponse('employee_code+date、start+end もしくは year+month を指定してください');
        }
    } catch (PDOException $e) {
        error_log('Attendance get error: ' . $e->getMessage());
        sendErrorResponse('勤怠データの取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    validateRequired($input, ['employee_code', 'type']);

    $code = $input['employee_code'];
    $type = $input['type']; // 'in' | 'out'
    $reason = isset($input['reason']) && $input['reason'] !== '' ? $input['reason'] : null;

    if (!in_array($type, ['in', 'out'], true)) {
        sendErrorResponse('type は in または out を指定してください');
    }

    // 時刻・日付はサーバー基準（丸めなし・分単位）
    $date = date('Y-m-d');
    $now = date('H:i:s');

    try {
        // 当日レコードを確保
        $stmt = $db->prepare("SELECT * FROM attendance_records WHERE employee_code = :c AND work_date = :d");
        $stmt->execute(['c' => $code, 'd' => $date]);
        $rec = $stmt->fetch();

        if (!$rec) {
            $ins = $db->prepare("INSERT INTO attendance_records (employee_code, work_date) VALUES (:c, :d)");
            $ins->execute(['c' => $code, 'd' => $date]);
        }

        $col = ($type === 'in') ? 'clock_in' : 'clock_out';
        $sql = "UPDATE attendance_records SET {$col} = :t" . ($reason !== null ? ", reason = :r" : "") .
               " WHERE employee_code = :c AND work_date = :d";
        $params = ['t' => $now, 'c' => $code, 'd' => $date];
        if ($reason !== null) {
            $params['r'] = $reason;
        }
        $up = $db->prepare($sql);
        $up->execute($params);

        // 更新後のレコードを返す
        $stmt->execute(['c' => $code, 'd' => $date]);
        sendJsonResponse([
            'message' => ($type === 'in' ? '出勤' : '退勤') . 'を記録しました（' . substr($now, 0, 5) . '）',
            'record' => $stmt->fetch()
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() == '23000') {
            sendErrorResponse('従業員コードが存在しません');
        }
        error_log('Attendance post error: ' . $e->getMessage());
        sendErrorResponse('打刻に失敗しました', 500);
    }
}

function handlePut($db) {
    // 管理者による打刻修正
    $input = getJsonInput();
    validateRequired($input, ['employee_code', 'work_date']);

    $clock_in = isset($input['clock_in']) && $input['clock_in'] !== '' ? $input['clock_in'] : null;
    $clock_out = isset($input['clock_out']) && $input['clock_out'] !== '' ? $input['clock_out'] : null;
    $reason = isset($input['reason']) && $input['reason'] !== '' ? $input['reason'] : null;

    if ($clock_in !== null) validateTime($clock_in);
    if ($clock_out !== null) validateTime($clock_out);

    try {
        // レコードがなければ作成
        $check = $db->prepare("SELECT id FROM attendance_records WHERE employee_code = :c AND work_date = :d");
        $check->execute(['c' => $input['employee_code'], 'd' => $input['work_date']]);
        if (!$check->fetch()) {
            $ins = $db->prepare("INSERT INTO attendance_records (employee_code, work_date) VALUES (:c, :d)");
            $ins->execute(['c' => $input['employee_code'], 'd' => $input['work_date']]);
        }

        $up = $db->prepare(
            "UPDATE attendance_records SET clock_in = :in, clock_out = :out, reason = :r, updated_at = CURRENT_TIMESTAMP
             WHERE employee_code = :c AND work_date = :d"
        );
        $up->execute([
            'in' => $clock_in,
            'out' => $clock_out,
            'r' => $reason,
            'c' => $input['employee_code'],
            'd' => $input['work_date']
        ]);
        sendJsonResponse(['message' => '勤怠を更新しました']);
    } catch (PDOException $e) {
        error_log('Attendance put error: ' . $e->getMessage());
        sendErrorResponse('勤怠の更新に失敗しました', 500);
    }
}
?>
