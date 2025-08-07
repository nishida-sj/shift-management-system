<?php
/**
 * データベース接続設定
 * コアサーバー用MySQL接続設定
 */

// エラー表示設定（本番環境では無効化）
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS設定（同一ドメインでの使用を想定）
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// プリフライトリクエストへの対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// データベース接続設定
class Database {
    private static $instance = null;
    private $connection;
    
    // !! 重要：実際の値に変更してください !!2025年8月7日変更
    private $host = 'localhost';           // コアサーバーのDBホスト
    private $database = 'nishidasj_shift';    // 作成したデータベース名
    private $username = 'nishidasj_shift';    // データベースユーザー名
    private $password = 'NishidaSJ';    // データベースパスワード
    
    private function __construct() {
        try {
            $dsn = "mysql:host={$this->host};dbname={$this->database};charset=utf8mb4";
            $this->connection = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            error_log('Database connection failed: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'データベース接続エラー']);
            exit();
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
}

// ユーティリティ関数
function sendJsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function sendErrorResponse($message, $status = 400) {
    sendJsonResponse(['error' => $message], $status);
}

function getJsonInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendErrorResponse('Invalid JSON format');
    }
    return $input;
}

// 入力値検証
function validateRequired($data, $fields) {
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            $missing[] = $field;
        }
    }
    if (!empty($missing)) {
        sendErrorResponse('必須項目が不足しています: ' . implode(', ', $missing));
    }
}

// 日付検証
function validateDate($year, $month, $day = null) {
    if (!is_numeric($year) || !is_numeric($month) || $year < 2020 || $year > 2030 || $month < 1 || $month > 12) {
        sendErrorResponse('無効な年月です');
    }
    if ($day !== null && (!is_numeric($day) || $day < 1 || $day > 31)) {
        sendErrorResponse('無効な日付です');
    }
}

// 時間検証
function validateTime($time) {
    if (!preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $time)) {
        sendErrorResponse('無効な時間形式です（HH:MM）');
    }
}

?>