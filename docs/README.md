# Yaju-Tube
恐らく淫夢といった例のアレ発のPeertubeの再生プレイヤーアプリです。<br>
名前とアイコン画像は適当です。

<div align="center">

<p>・Github Pages<br>
<a href="https://pyu224.github.io/Yaju-Tube/">https://pyu224.github.io/Yaju-Tube/</a></p>

<p>・Repository<br>
<a href="https://github.com/PYU224/Yaju-Tube">https://github.com/PYU224/Yaju-Tube</a></p>

<p>・Download<br>
<a href="https://github.com/PYU224/Yaju-Tube/releases">https://github.com/PYU224/Yaju-Tube/releases</a></p>

</div>

## 概要
<div align="center">

<p><img alt="peertube player app 真夏の夜の淫夢 例のアレ" src="./sample.png" width="320" height="552"></p>

</div>

<p>これはPeertubeの公式アプリが重くて使えなかったので、AIに頼りつつ独力で何かできないかと思って適当に作ってみたPeertubeの動画再生アプリです。</p>
<p>一応動きますがまだまだ開発途中です。<br>
主にここのIssueでバグ報告やリクエストを受け付けています。</p>
### ソースからのビルド

## ソースからのビルド

### 要件
- Node.js 16 以上と npm
- JDK 17 以上
- Android SDK

### ビルド手順
```bash
# リポジトリのクローン
git clone https://github.com/PYU224/Yaju-Tube.git
cd Yaju-Tube

# 依存関係のインストール（開発用依存関係も含む）
npm install

# Web アプリケーションのビルド
npm run build

# アイコンとスプラッシュ画像の生成
npx @capacitor/assets generate

# Capacitor との同期
npx cap sync android

# Android APK のビルド
cd android
./gradlew assembleRelease
```

## ロードマップ
まずは安定して動くようにしたいです。<br>
<p>安定して動くようになったらApkファイルをF-Droidに登録して配布する形になります。<br>
<a href="https://f-droid.org/ja/">https://f-droid.org/ja/</a></p>

### 重要度：高
- ループ再生のON・OFF
- マイリスト機能（設定も込みでインポート・エクスポート機能付きを想定）
- ~~横向きの全画面といったYoutubeやPeertubeの公式アプリみたいに動画の向きの切り替えができるように~~
- ~~動画のソート順を新しい順以外も選択できるように~~

### 重要度：中
- インスタンスへのログイン機能
- コメント欄の閲覧と書き込み
- ~~ライトモードとダークモード~~（追加完了）
- 多言語訳（英語はほぼ完了）
- ~~動画一覧の表示方法を設定で変更できるように~~

### 重要度：低
- ライブチャットのコメント欄の閲覧と書き込み（Peertubeの拡張機能だから後回し）
- Youtubeやニコニコ動画を広告なしで閲覧できる機能（多分難しい）
- Peertubeのインスタンスを選んで動画を投稿する機能（アプリで動画を投稿する場合は投稿制限にも配慮する必要があるはず）
- XMRのマイニング（面白そうだが弊害が多そう）

## 連絡先
- リンク集<br>
https://linksta.cc/@pyu224

## ライセンス
GPL-3.0です。