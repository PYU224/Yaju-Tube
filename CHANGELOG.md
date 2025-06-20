# Version 1.~ 

## 1.0
- YoutubeやPeertubeの公式アプリのように、全画面表示時は自動的に横向きになるように改良
- ~~多分いらない機能ですがXMRのマイニング機能を追加しました。デフォルトではOFFですが設定画面でONにした場合、視聴者のマシンのリソースを少しお借りして、私にお布施として少しだけXMRが入ってきます~~外部のマイニングスクリプトに不具合があるので無しにしました
- 動画再生の位置を画面上部にまた変更、動画再生画面の下に動画の説明文を表示できるようにしました
- ダークテーマの挙動修正
- 動画一覧の並び替え機能とフィルタ機能（ローカル動画のみを抽出）を実装しました

# Version 0.~ (Test Version)

## 0.2
- 動画視聴時にプレーヤーの位置が一番上にあって使いにくかったので中央で再生するよう修正
- インスタンスの追加時に「 https://example.com/ 」のような記述でも追加できるよう改良
- 設定画面で英語版も選べるようしました

## 0.1
- とりあえず公開
- 本体のIonicの問題で設定画面のOptionを選択する際、「Blocked aria-hidden on an element because its descendant retained focus. The focus must not be hidden from assistive technology users. Avoid using aria-hidden on a focused element or its ancestor. Consider using the inert attribute instead, which will also prevent focus.」という警告が出るのでそこは気にしないでください（ https://github.com/ionic-team/ionic-framework/issues/30240 ）