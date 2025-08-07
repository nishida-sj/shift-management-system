# PowerShell デプロイスクリプト
param(
    [string]$Server = "your-server.coreserver.jp",
    [string]$Username = "your_username",
    [string]$Password = "your_password"
)

Write-Host "シフト管理システム PowerShell デプロイ" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# FTP関数
function Upload-FTP {
    param(
        [string]$LocalPath,
        [string]$RemotePath,
        [string]$Server,
        [string]$Username,
        [string]$Password
    )
    
    try {
        $ftp = [System.Net.FtpWebRequest]::Create("ftp://$Server$RemotePath")
        $ftp.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $ftp.Credentials = New-Object System.Net.NetworkCredential($Username, $Password)
        $ftp.UseBinary = $true
        $ftp.UsePassive = $true
        
        $content = [System.IO.File]::ReadAllBytes($LocalPath)
        $ftp.ContentLength = $content.Length
        
        $requestStream = $ftp.GetRequestStream()
        $requestStream.Write($content, 0, $content.Length)
        $requestStream.Close()
        
        $response = $ftp.GetResponse()
        Write-Host "アップロード完了: $LocalPath -> $RemotePath" -ForegroundColor Yellow
        $response.Close()
    }
    catch {
        Write-Host "エラー: $LocalPath - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ファイル一覧取得
$files = Get-ChildItem -Path "public_html" -Recurse -File
foreach ($file in $files) {
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\public_html", "").Replace("\", "/")
    Upload-FTP -LocalPath $file.FullName -RemotePath "/public_html$relativePath" -Server $Server -Username $Username -Password $Password
}

Write-Host "デプロイ完了!" -ForegroundColor Green