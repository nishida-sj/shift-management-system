<?php
/**
 * 勤怠 打刻修正申請API
 * GET  /api/attendance-requests.php?employee_code=xxx&year=YYYY&month=MM - 従業員の月次申請一覧
 * GET  /api/attendance-requests.php?status=pending                       - 未承認の申請一覧（管理者）
 * GET  /api/attendance-requests.php?year=YYYY&month=MM                   - 月次の全申請（管理者）
 * POST /api/attendance-requests.php  { employee_code, work_date, clock_in?, clock_out?, break_none, reason? }
 *      - 申請の登録（同一従業員・同一日の未承認申請がある場合は上書き）
 * PUT  /api/attendance-requests.php  { id, status:'approved'|'rejected', admin_comment? }
 *      - 承認・却下（承認時は attendance_records に反映）
 */

require_once 'config.php';
date_default_timezone_set('Asia/Tokyo');

$db = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

ensureRequestTable($db);

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

/**
 * テーブルが無い環境でも動くよう自動作成する
 * （migration_add_attendance_requests.sql と同じ定義）
 */
function ensureRequestTable($db) {
    try {
        $check = $db->query("SHOW TABLES LIKE 'attendance_requests'");
        if ($check->rowCount() > 0) {
            return;
        }

        $db->exec("CREATE TABLE attendance_requests (
            id INT PRIMARY KEY AUTO_INCREMENT,
            employee_code VARCHAR(50) NOT NULL,
            work_date DATE NOT NULL,
            clock_in TIME NULL,
            clock_out TIME NULL,
            break_none TINYINT NOT NULL DEFAULT 0,
            reason VARCHAR(255) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            admin_comment VARCHAR(255) NULL,
            reviewed_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_code) REFERENCES employees (employee_code) ON DELETE CASCADE,
            INDEX idx_req_status (status),
            INDEX idx_req_employee_date (employee_code, work_date)
        )");
        error_log('attendance_requestsテーブルを自動作成しました');
    } catch (PDOException $e) {
        error_log('attendance_requestsテーブル作成エラー: ' . $e->getMessage());
        sendErrorResponse('申請テーブルの準備に失敗しました', 500);
    }
}

function handleGet($db) {
    $employee_code = $_GET['employee_code'] ?? null;
    $year = $_GET['year'] ?? null;
    $month = $_GET['month'] ?? null;
    $status = $_GET['status'] ?? null;

    try {
        $sql = "SELECT r.*, e.name FROM attendance_requests r
                JOIN employees e ON r.employee_code = e.employee_code";
        $where = [];
        $params = [];

        if ($employee_code) {
            $where[] = 'r.employee_code = :c';
            $params['c'] = $employee_code;
        }

        if ($year && $month) {
            validateDate($year, $month);
            $start = sprintf('%04d-%02d-01', $year, $month);
            $end = date('Y-m-t', strtotime($start));
            $where[] = 'r.work_date BETWEEN :s AND :e';
            $params['s'] = $start;
            $params['e'] = $end;
        }

        if ($status) {
            if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
                sendErrorResponse('statusが不正です');
            }
            $where[] = 'r.status = :st';
            $params['st'] = $status;
        }

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY r.work_date DESC, r.id DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        sendJsonResponse($stmt->fetchAll());
    } catch (PDOException $e) {
        error_log('Attendance request get error: ' . $e->getMessage());
        sendErrorResponse('申請データの取得に失敗しました', 500);
    }
}

function handlePost($db) {
    $input = getJsonInput();
    validateRequired($input, ['employee_code', 'work_date']);

    $clock_in = isset($input['clock_in']) && $input['clock_in'] !== '' ? $input['clock_in'] : null;
    $clock_out = isset($input['clock_out']) && $input['clock_out'] !== '' ? $input['clock_out'] : null;
    $break_none = !empty($input['break_none']) ? 1 : 0;
    $reason = isset($input['reason']) && $input['reason'] !== '' ? $input['reason'] : null;

    if ($clock_in === null && $clock_out === null) {
        sendErrorResponse('出勤時刻または退勤時刻のどちらかを入力してください');
    }
    if ($clock_in !== null) validateTime($clock_in);
    if ($clock_out !== null) validateTime($clock_out);

    // 出勤 > 退勤 の入力ミスを弾く（日をまたぐ勤務は想定しない）
    if ($clock_in !== null && $clock_out !== null && strtotime($clock_in) >= strtotime($clock_out)) {
        sendErrorResponse('退勤時刻は出勤時刻より後にしてください');
    }

    try {
        // 同じ日の未承認申請があれば上書きする（申請の作り直しを許可）
        $check = $db->prepare(
            "SELECT id FROM attendance_requests
             WHERE employee_code = :c AND work_date = :d AND status = 'pending'"
        );
        $check->execute(['c' => $input['employee_code'], 'd' => $input['work_date']]);
        $existing = $check->fetch();

        if ($existing) {
            $up = $db->prepare(
                "UPDATE attendance_requests
                 SET clock_in = :in, clock_out = :out, break_none = :bn, reason = :r,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id"
            );
            $up->execute([
                'in' => $clock_in,
                'out' => $clock_out,
                'bn' => $break_none,
                'r' => $reason,
                'id' => $existing['id']
            ]);
            sendJsonResponse(['message' => '申請を更新しました。承認をお待ちください。', 'id' => $existing['id']]);
            return;
        }

        $ins = $db->prepare(
            "INSERT INTO attendance_requests (employee_code, work_date, clock_in, clock_out, break_none, reason)
             VALUES (:c, :d, :in, :out, :bn, :r)"
        );
        $ins->execute([
            'c' => $input['employee_code'],
            'd' => $input['work_date'],
            'in' => $clock_in,
            'out' => $clock_out,
            'bn' => $break_none,
            'r' => $reason
        ]);

        sendJsonResponse([
            'message' => '申請しました。承認をお待ちください。',
            'id' => $db->lastInsertId()
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() == '23000') {
            sendErrorResponse('従業員コードが存在しません');
        }
        error_log('Attendance request post error: ' . $e->getMessage());
        sendErrorResponse('申請の登録に失敗しました', 500);
    }
}

function handlePut($db) {
    $input = getJsonInput();
    validateRequired($input, ['id', 'status']);

    $status = $input['status'];
    if (!in_array($status, ['approved', 'rejected'], true)) {
        sendErrorResponse('statusは approved または rejected を指定してください');
    }

    $admin_comment = isset($input['admin_comment']) && $input['admin_comment'] !== ''
        ? $input['admin_comment'] : null;

    try {
        $stmt = $db->prepare("SELECT * FROM attendance_requests WHERE id = :id");
        $stmt->execute(['id' => $input['id']]);
        $req = $stmt->fetch();

        if (!$req) {
            sendErrorResponse('申請が見つかりません', 404);
        }
        if ($req['status'] !== 'pending') {
            sendErrorResponse('この申請は既に処理済みです');
        }

        $db->beginTransaction();

        $up = $db->prepare(
            "UPDATE attendance_requests
             SET status = :st, admin_comment = :ac, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = :id"
        );
        $up->execute(['st' => $status, 'ac' => $admin_comment, 'id' => $req['id']]);

        // 承認時のみ打刻データへ反映
        if ($status === 'approved') {
            applyToAttendance($db, $req);
        }

        $db->commit();

        sendJsonResponse([
            'message' => $status === 'approved' ? '申請を承認しました' : '申請を却下しました'
        ]);
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('Attendance request put error: ' . $e->getMessage());
        sendErrorResponse('申請の処理に失敗しました', 500);
    }
}

/**
 * 承認された申請を attendance_records に反映する
 * 申請で未入力（NULL）の時刻は既存の打刻値を維持する
 * 休憩なしは既存仕様に合わせて reason コード '21' で表現する
 */
function applyToAttendance($db, $req) {
    $check = $db->prepare("SELECT * FROM attendance_records WHERE employee_code = :c AND work_date = :d");
    $check->execute(['c' => $req['employee_code'], 'd' => $req['work_date']]);
    $record = $check->fetch();

    if (!$record) {
        $ins = $db->prepare("INSERT INTO attendance_records (employee_code, work_date) VALUES (:c, :d)");
        $ins->execute(['c' => $req['employee_code'], 'd' => $req['work_date']]);
        $record = ['clock_in' => null, 'clock_out' => null];
    }

    $clock_in = $req['clock_in'] !== null ? $req['clock_in'] : $record['clock_in'];
    $clock_out = $req['clock_out'] !== null ? $req['clock_out'] : $record['clock_out'];
    $reason = ((int)$req['break_none'] === 1) ? '21' : null;

    $up = $db->prepare(
        "UPDATE attendance_records
         SET clock_in = :in, clock_out = :out, reason = :r, updated_at = CURRENT_TIMESTAMP
         WHERE employee_code = :c AND work_date = :d"
    );
    $up->execute([
        'in' => $clock_in,
        'out' => $clock_out,
        'r' => $reason,
        'c' => $req['employee_code'],
        'd' => $req['work_date']
    ]);
}
?>
