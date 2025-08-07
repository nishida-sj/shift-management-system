# シフト管理システム - MySQL版

## 概要
従業員のシフト管理システム。HTML/CSS/jQuery + PHP/MySQL構成。

## 自動デプロイ
- GitHub Actions によりmainブランチへのpush時に自動デプロイ
- コアサーバーにFTP経由でファイル同期

## セットアップ
1. `database/schema.sql` をMySQLで実行
2. `public_html/api/config.php` でDB接続情報を設定
3. GitHubリポジトリのSecretsでFTP情報を設定

## 開発フロー
1. ローカルで修正
2. `git push origin main`
3. 自動でサーバーにデプロイ