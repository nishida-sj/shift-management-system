<?php
/**
 * 全従業員のシフト希望取得API
 * GET /api/all-shift-requests.php?year=2024&month=8 - 全従業員のシフト希望取得
 */

require_once 'config.php';

$db = Database::getInstance()->getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$year = $_GET['year'] ?? null;
$month = $_GET['month'] ?? null;

if (!$year || !$month) {
    sendErrorResponse('year, month パラメータが必要です');
}

// 日付検証
validateDate((int)$year, (int)$month);

try {
    $sql = "SELECT sr.*, e.name as employee_name, e.business_type
            FROM shift_requests sr 
            LEFT JOIN employees e ON sr.employee_code = e.employee_code 
            WHERE sr.year = :year AND sr.month = :month 
            AND (sr.is_off_requested = 1 OR sr.preferred_time_start IS NOT NULL OR sr.preferred_time_end IS NOT NULL)
            ORDER BY e.name, sr.day";
    
    $stmt = $db->prepare($sql);
    $stmt->execute([
        'year' => (int)$year,
        'month' => (int)$month
    ]);
    
    $requests = $stmt->fetchAll();
    
    // 従業員ごとにグループ化
    $groupedRequests = [];
    foreach ($requests as $request) {
        $employeeCode = $request['employee_code'];
        $employeeName = $request['employee_name'];
        
        if (!isset($groupedRequests[$employeeCode])) {
            $groupedRequests[$employeeCode] = [
                'employee_code' => $employeeCode,
                'employee_name' => $employeeName,
                'business_type' => $request['business_type'],
                'requests' => []
            ];
        }
        
        $groupedRequests[$employeeCode]['requests'][] = [
            'day' => (int)$request['day'],
            'is_off_requested' => (bool)$request['is_off_requested'],
            'preferred_time_start' => $request['preferred_time_start'],
            'preferred_time_end' => $request['preferred_time_end']
        ];
    }
    
    // 配列に変換
    $result = array_values($groupedRequests);
    
    sendJsonResponse($result);
    
} catch (PDOException $e) {
    error_log('全従業員シフト希望取得エラー: ' . $e->getMessage());
    sendErrorResponse('シフト希望の取得に失敗しました', 500);
}
?>