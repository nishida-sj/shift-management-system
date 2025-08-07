@echo off
echo シフト管理システム デプロイスクリプト
echo =====================================

REM FTP設定（実際の値に変更してください）
set FTP_SERVER=your-server.coreserver.jp
set FTP_USER=your_username
set FTP_PASS=your_password

REM WinSCPを使用したFTP同期（WinSCPがインストールされている場合）
if exist "C:\Program Files (x86)\WinSCP\WinSCP.com" (
    echo WinSCPを使用してデプロイ中...
    "C:\Program Files (x86)\WinSCP\WinSCP.com" ^
    /command ^
    "open ftp://%FTP_USER%:%FTP_PASS%@%FTP_SERVER%" ^
    "synchronize remote public_html /public_html -delete" ^
    "synchronize remote database /database -delete" ^
    "exit"
    echo デプロイ完了
) else (
    echo WinSCPが見つかりません
    echo 手動でFTPアップロードしてください
    pause
)

pause