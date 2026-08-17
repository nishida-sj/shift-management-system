<?php
/**
 * 勤怠データ出力 API（kinmu.txt 形式）
 * GET /api/attendance-export.php?start=YYYY-MM-DD&end=YYYY-MM-DD[&fallback_code=1]
 * GET /api/attendance-export.php?year=YYYY&month=MM  （後方互換：当月1日〜末日）
 *
 * 形式（kinmu.txt）:
 *   - テキストファイル / カンマ区切り（可変長） / 改行コード CRLF
 *   - 項目順: 社員CD, 日付(yyyymmdd), 勤務区分, 事由1, 出勤, 退勤, ...（以降は省略）
 *   - 時刻は「分(hour*60+min)」で出力（例 9:00 -> 540, 18:00 -> 1080）
 *   - 事由1 は数字（休憩なし = 21）
 *
 * fallback_code=1 のとき、勤怠コード未設定の従業員は従業員コードを社員CDとして出力する
 */

require_once 'config.php';
date_default_timezone_set('Asia/Tokyo');

$db = Database::getInstance()->getConnection();

$start = $_GET['start'] ?? null;
$end = $_GET['end'] ?? null;
$year = $_GET['year'] ?? null;
$month = $_GET['month'] ?? null;
$fallbackCode = !empty($_GET['fallback_code']);

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

if ($start && $end) {
    validateDateRange($start, $end);
} elseif ($year && $month) {
    // 後方互換：年月指定は当月1日〜末日
    validateDate($year, $month);
    $start = sprintf('%04d-%02d-01', $year, $month);
    $end = date('Y-m-t', strtotime($start));
} else {
    sendErrorResponse('start と end（または year と month）を指定してください');
}

try {
    $stmt = $db->prepare(
        "SELECT e.attendance_code, e.name, a.employee_code, a.work_date, a.clock_in, a.clock_out, a.reason
         FROM attendance_records a
         JOIN employees e ON a.employee_code = e.employee_code
         WHERE a.work_date BETWEEN :s AND :e
         ORDER BY e.attendance_code, a.employee_code, a.work_date"
    );
    $stmt->execute(['s' => $start, 'e' => $end]);
    $rows = $stmt->fetchAll();
} catch (PDOException $e) {
    error_log('Attendance export error: ' . $e->getMessage());
    sendErrorResponse('勤怠データの出力に失敗しました', 500);
}

// 時刻(HH:MM:SS) -> 分(hour*60+min)。空は空文字
function timeToMinutes($t) {
    if (empty($t)) return '';
    $p = explode(':', $t);
    return (string)((int)$p[0] * 60 + (int)$p[1]);
}

$lines = [];
$skipped = []; // 勤怠コード未設定でスキップした従業員名
foreach ($rows as $r) {
    $cd = $r['attendance_code'];
    if ($cd === null || $cd === '') {
        // 社員CDは必須。未設定なら従業員コードで代用、それも不可なら行を出さない
        if ($fallbackCode) {
            $cd = $r['employee_code'];
        } else {
            $skipped[$r['employee_code']] = $r['name'];
            continue;
        }
    }
    $date = str_replace('-', '', $r['work_date']); // YYYYMMDD
    $reason = ($r['reason'] !== null && $r['reason'] !== '') ? $r['reason'] : '';
    $in = timeToMinutes($r['clock_in']);
    $out = timeToMinutes($r['clock_out']);

    // 社員CD, 日付, 勤務区分(空), 事由1, 出勤, 退勤
    $lines[] = $cd . ',' . $date . ',,' . $reason . ',' . $in . ',' . $out;
}

// 出力行が1件もない場合は、空ファイルを返さず理由をJSONで返す
if (count($lines) === 0) {
    if (count($rows) === 0) {
        sendErrorResponse('指定期間（' . $start . '〜' . $end . '）に打刻データがありません');
    }
    sendErrorResponse(
        '出力対象がありません。勤怠コード（社員CD）が未設定です: ' . implode('、', $skipped) .
        ' / 従業員マスタで勤怠用コードを設定するか、「勤怠コードがない場合は従業員コードで出力する」にチェックしてください'
    );
}

// kinmu.txt として出力（config.php が設定した JSON ヘッダーを上書き）
// 出力はASCII(数字・カンマ)のみのため文字コードの影響なし
header('Content-Type: text/plain; charset=Shift_JIS');
header('Content-Disposition: attachment; filename="kinmu.txt"');

// CRLF区切り（レコード末も改行）
echo implode("\r\n", $lines);
echo "\r\n";
exit();
?>
