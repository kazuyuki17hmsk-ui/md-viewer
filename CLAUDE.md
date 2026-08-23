# MDビューアアプリ プロジェクト

Kindleライクな読書体験でMarkdownファイル(翻訳原稿・研究ノート)を閲覧するためのWebアプリ。

開発計画の全文は @docs/md_viewer_development_plan.md を参照。

## 技術方針(要点)

- 単一HTMLファイル(`index.html`)+ 素のJavaScript。フレームワーク不使用
- Chromebook: File System Access API(`showDirectoryPicker`)でフォルダを直接参照
- スマホ: `<input type="file">` で個別インポート → IndexedDBにコピー保存
- しおり・既読位置: localStorage(即時キャッシュ)+ JSONエクスポート/インポート(バックアップ・端末間同期)
- Markdownレンダリング: `marked.js` 等の軽量ライブラリ

## 実装ステップと進捗

計画書 §7 のステップに対応。完了したら `[x]` に更新すること。
MVP(§7の1-9)は完了。現在は Phase 3(計画書 §9)。

- [x] 1. 基本UI(本棚一覧画面 + ビューア画面)の骨格
- [x] 2. Chromebook向けフォルダ読み込み(File System Access API)
- [x] 3. Markdownレンダリング + フォントサイズ調整
- [x] 4. しおり機能(追加・一覧・ジャンプ)+ localStorage永続化
- [x] 5. ファイル内検索機能
- [x] 6. 選択テキストのWeb検索ボタン(2026-08-23に削除。実使用で不要だった)
- [x] 7. スマホ向けファイルインポート(IndexedDB)
- [x] 8. JSONエクスポート/インポート(バックアップ)機能
- [x] 9. 動作確認・微調整(スマホ実機でのGoogle Drive連携・ヘッダーレイアウト調整含む)

## MVP後に追加した機能

- 目次(TOC): 見出し一覧パネルからジャンプ
- 選択テキストから文中検索へのジャンプ(同じ語句の別出現箇所へワンクリック移動。脚注参照等で活用)
- Google Drive連携: OAuth 2.0(Client ID: Google Cloud Console発行済み)経由でDrive上の`.md`をフォルダ単位で直接参照。`https://`オリジンが必須のためfile://では動作しない。file://の事前判定・`error_callback`・120秒タイムアウト・401自動リトライを実装済み(2026-08-16)

## 開発環境

- Chromebook(ChromeOS / Crostini Linux)上で作業
- 動作確認は主にChromeブラウザで手動確認(自動テストは現状未整備)。Google Drive連携等の実機依存機能はスマホ実機で確認
- ビルドツール・パッケージマネージャは現状不要(単一HTMLファイルのため)
- **公開先**: GitHub Pages https://kazuyuki17hmsk-ui.github.io/md-viewer/ (リポジトリ: https://github.com/kazuyuki17hmsk-ui/md-viewer 、パブリック。アプリコードのみを含み翻訳原稿本体は含めない)

## データモデル(P0-2で刷新。2026-08-16)

- **`bookId`**: ファイル名を正規化した安定ID(`makeBookId()`)。読み込み経路(fs/idb/drive)が違っても同じ本として扱う。`relPath`は表示・ソート用にのみ残す
- **位置は文字オフセット**: 本文プレーンテキスト先頭からの文字数で保存。フォントサイズ・画面幅・端末が変わってもズレない
- **注釈(annotation)モデル**: しおり・メモ・(将来の)ハイライトを1モデルに統合。`{ id, bookId, type, start, end, quote, prefix, suffix, color, note, createdAt, updatedAt, deleted }`。削除は物理削除せず`deleted`フラグ(tombstone)
- **localStorageキー**: `mdViewer.annotations` / `mdViewer.readingPositions.v2` / `mdViewer.migratedBooks`。旧キー(`mdViewer.bookmarks`, `mdViewer.readingPositions`)は**読み取り専用で残す**(ロールバック用)
- **遅延マイグレーション**: 本を開いた時に旧px位置を実測して文字オフセットへ変換(`migrateLegacyBook()`)。`migratedBooks`で二重変換を防ぐ
- **バックアップはマージ方式**: 注釈`id`単位で`updatedAt`の新しい方を採用。version 1(旧形式)のJSONは旧キーへ取り込み、次回オープン時に自動変換される

## ハンドル永続化 + 「読書中」本棚(P1-1で実装。2026-08-16)

- **fsハンドル**: `FileSystemDirectoryHandle`をIndexedDB(`dirHandles`ストア)に保存。起動時に`queryPermission({mode:'read'})`を確認し、許可済みなら自動再走査。失効時は本棚に案内バナーを出し、ボタン押下(ユーザー操作起点)で`requestPermission()`を呼ぶ
- **Driveキャッシュ**: 最後に読み込んだDriveフォルダのファイル一覧(メタデータのみ)を`mdViewer.driveCache`に保存し、起動時に認証なしで本棚へ復元。ファイルを開く時だけ既存の`driveFetchWithAuth`が遅延認証する。Driveパネルにも「前回のフォルダ」から直接更新できるショートカットを表示
- **本棚セクション**: 「読書中(ピン留め)」「最近読んだ(直近5件)」「すべて」に分割。ピン留め状態は`mdViewer.pinnedBooks`、閲覧日時は`mdViewer.lastOpenedAt`(ともに端末ローカル・バックアップJSON対象外)
- 「戻る」ボタンで本棚に戻る際に`renderBookshelf()`を呼び直し、直前に開いた本を「最近読んだ」へ反映する

## ビューアUI(P1-2で再構成。2026-08-16)

- **操作系はボトムバーに集約**(本棚/目次/検索/しおり/A-/A+ の6ボタン等幅)。全端末共通で、
  内側を`max-width: 720px`にして本文・シートと幅を揃える。ヘッダーはタイトルのみ
- **パネルはボトムシート**(`position: fixed` + `.sheet`)。**本文の高さを一切奪わない**のが要点。
  旧実装は`flex: 0 0 auto`の兄弟要素で、開くたびに本文が縮んでいた
- **シート開閉は`openSheet()`/`closeAllSheets()`/`toggleSheet()`に集約**。3つは排他。
  背景タップ・Escapeで閉じる。`closeAllSheets()`は必ず`closeSearch()`を経由する
  (検索ハイライトを`renderedHTML`へ戻す処理があるため)
- **本文タップでUIトグル**(`chrome-hidden`)。**タッチ操作のみ**有効(マウスのクリックは
  文字選択と区別できないため無効)。トグル時は`getOffsetAtViewportTop()`→`scrollToOffset()`で
  読書位置を保つ(リフローでずれるため)
- **`getOffsetAtViewportTop()`は実測中だけシート・背景の`pointer-events`を切る**。
  背景が画面全体を覆うので、これがないと`caretRangeFromPoint`が本文に届かず
  「しおりシートを開いたまま現在位置にしおりを追加」ができない

## ハイライト + メモ(P2-1で実装。2026-08-16)

- **レイヤー再構築**: `rebuildContentLayers()`が「素のHTML(`renderedHTML`) → 注釈ハイライト
  (`applyAnnotationHighlights()`) → 検索ハイライト」の順で毎回組み立てる。`highlightMatches()`/
  `closeSearch()`は必ずこれを経由するため、検索を閉じてもハイライトは消えない
- **複数ノードにまたがる範囲の描画**: `applyRanges()`が本文プレーンテキスト上の非重複区間を
  複数のテキストノードにまたがって`<mark>`で囲む(`highlightMatches()`の単一ノード限定の
  正規表現方式とは別実装。選択範囲は`<em>`等のインライン要素境界をまたぎうるため)
- **色は4色**(`yellow`/`green`/`blue`/`pink`)。選択ツールバーの「ハイライト」ボタンで
  既定色(yellow)で即座に作成し、直後にポップオーバー(色スウォッチ・メモ入力・削除)を表示。
  本文中の既存ハイライトをタップ/クリックすると同じポップオーバーが再度開く
- **本文タップでのUIトグル(P1-2)は`mark.hl`の上では発火しない**。
  `e.target.closest('a, mark.hl')`で除外し、`click`イベント側のポップオーバー処理に譲る
- **注釈一覧パネル**(旧「しおりパネル」を拡張): 色ドット表示・色/種別フィルタ・
  メモ編集(`prompt()`)・Markdown書き出し(`書き出し`ボタン)を追加。しおり(`type:'bookmark'`)と
  ハイライト(`type:'highlight'`)を同じ一覧で扱う
  → **2026-08-23に分離**(後述「しおりとハイライトのパネル分離」)。データモデルは統合のまま
- ハイライトの位置も`start`/`end`の文字オフセットで保存し、既存の`resolveAnchor()`で
  本文編集後のズレを補正する(しおりと同じ仕組みをそのまま流用)

## Drive自動同期(P2-2で実装。2026-08-16)

- **appDataFolderに本ごと1ファイル**(`ann-<URIエンコードしたbookId>.json`)。全体を1ファイルにすると
  端末間の衝突が頻発するため。`spaces=appDataFolder`で一覧を取り、`name → fileId`の索引を作る
- **スコープは同期をONにした時だけ広げる**。`getCurrentDriveScope()`が`driveSyncEnabled`を見て
  `drive.readonly`(+`drive.appdata`)を返し、スコープが変わると`initTokenClient`を作り直す。
  こうしないと、同期を使わないユーザーにまで再同意を強いることになる。原稿への書き込み権限は不要
- **必ず pull → マージ → push の順**(`syncBook()`)。先にpushすると他端末の新しい変更を
  古いデータで潰す。マージは`mergeAnnotationList()`/`mergeReadingPosition()`に集約し、
  バックアップJSONのインポートと**同じ関数**を使う(注釈id単位で`updatedAt`の新しい方を採用)
- **安全弁**: ローカルの注釈が0件かつ既読位置なしの時は、リモートにデータがあってもpushしない。
  削除はtombstoneで残るので配列が完全に空になるのは異常(データ消失事故)の兆候
- **署名比較でムダな書き込みを省く**(`syncSignature()`。id+updatedAt+deletedの一覧を比較)
- **自動同期はトークンがある間だけ**。`scheduleSync()`は`driveAccessToken`が無ければ何もしない
  (認証ポップアップはユーザー操作起点でないとブラウザにブロックされるため)。
  変更時はdebounce 6秒でpush、本を開いた時は`pullBookInBackground()`が裏でpull
- `syncInProgress`フラグで、マージ時の`saveAnnotations()`がまた同期を予約する再帰を防ぐ
- 既読位置はpullでマージするが**スクロールはしない**(読書中に画面が飛ぶのを避けるため)

## オフライン対応・自己ホスト(P3で実装。2026-08-16)

- **`marked.js`(v18.0.9)と`DOMPurify`(v3.4.13)を`vendor/`に自己ホスト**(バージョン固定)。
  CDN依存を解消し、Service Workerでのプリキャッシュを可能にした。
  GISスクリプト(`accounts.google.com/gsi/client`)だけはGoogle側の生きた認証ライブラリのため
  自己ホストしない(Drive連携はもともとオフライン非対応)
- **サニタイズ**: `renderMarkdown()`が`DOMPurify.sanitize(marked.parse(text))`を通す。
  MD内の生HTML(`<script>`・`onerror`属性・`javascript:`リンク等)を除去する。
  `viewerContent.innerHTML`への代入はこの1箇所のみ(他は空文字列クリアか静的文字列)
- **PWA**: `manifest.json` + `sw.js`(ルート直下、Service Workerの仕様上ファイル分離が必須)。
  GitHub Pagesが`/md-viewer/`サブパス配信のため、**相対パスのみ**使用(絶対パスは壊れる)。
  `sw.js`は同一オリジンのGETのみcache-first、他オリジン(Google API等)は素通し。
  キャッシュ名にバージョン文字列(`md-viewer-v1`)を持たせ、`activate`で旧キャッシュを削除
- アイコン(`icons/`)はPillowで生成した簡易な開いた本のグリフ(ブランドカラー`#6b4f3b`)

## 注釈データの永続化(P3でIndexedDBへ移行。2026-08-16)

- **write-throughキャッシュ**: `annotations`/`readingPositions`/`migratedBooks`はメモリ上の
  プレーンオブジェクトのまま(読み取り・ミューテーション箇所は無変更)。永続化の書き込み先だけ
  `mdViewerDB`の新ストア`kv`(keyPath: `key`。`IDB_VERSION`を2→3)に切り替えた
  (localStorageの5MB上限対策)
- 書き込みは`saveAnnotations()` / `persistReadingPositions()` / `persistMigratedBooks()`に集約
  (内部で`saveIdbKV()`→`idbKvSet()`)
- **初回だけの移行**: `loadPersistedOrMigrate()`がIndexedDBに値が無ければlocalStorageの
  既存値を複製する。`init()`で本棚描画より前に完了させる。**localStorage側は削除しない**
  (P0-2以来の「ロールバック用に旧データを残す」方針を踏襲)

## iOSでの表示崩れと実機デバッグ(2026-08-17に修正)

iPhone SE(iOS Chrome)で1.7MB・約62万字のMDを開くと、本文が画面幅に収まらず右端で切れ、
フォント拡大縮小も効かないように見える症状が出ていた。Chromebook・Kindle Fireでは再現しない。

- **原因はiOS WebKitのテキスト自動拡大**(Text Size Adjust)。長文ページでWebKitが
  font-sizeを独自に再計算し、JS側の`viewerContent.style.fontSize`を上書きする。
  `html, body`に`-webkit-text-size-adjust: 100%`を指定して抑止する。
  iOSはSafariもChromeも同じWebKitなので、ブラウザを変えても回避できない
- **フォントボタンは壊れていなかった**。下限14px・初期値18pxのため、A-を押せる回数が
  ちょうど2回しかなかっただけ。「2段階しか効かない」という症状は正常動作で、
  文字が巨大化していたため効いていないように見えていた
- **`sw.js`の`CACHE_NAME`を上げ忘れると修正が実機に届かない**。Service Workerがcache-firstのため、
  プッシュしても古い`index.html`が配信され続ける。**この取り違えで「修正が効かない」と
  誤診し、無駄な仮説を重ねた**。index.htmlを変えたら必ず`CACHE_NAME`と`APP_VERSION`を上げること
- **版数表示と診断機能**: 本棚タイトル横に`APP_VERSION`を表示する。実機には開発者ツールが
  ないため、「修正が効いていない」のか「更新が届いていない」のかをこれで切り分ける。
  版数表示またはビューアのタイトルを**3回連続タップ**(1.5秒以内)すると、実測の
  font-size・`visualViewport.scale`・`scrollWidth`等をalertで表示する。
  **長押しは使わない**——iOSではテキストの長押しが文字選択メニューを起動して
  `pointercancel`が飛び、長押し判定が成立しない

## 選択ツールバーのドック表示(2026-08-19)

iPhone・Kindle Fireで文字列を選択すると、OSの「コピー」等のネイティブメニューが
選択範囲に密着して出るため、同じ位置に浮かせていた選択ツールバー
(Web検索/文中検索/ハイライト)と重なって押せなかった。

- **タッチ操作の時だけ画面下端にドックする**(`dockElement()` / `undockElement()`)。
  ネイティブメニューは選択範囲を追うので、下端に固定すれば構造的に重ならない。
  マウス操作(Chromebook)は従来通り選択範囲の近くに浮かせる
- **判定は`lastPointerWasTouch`**。`viewerContent`の`pointerdown`(capture)と`touchend`で更新する。
  `(pointer: coarse)`のメディアクエリだとタッチ対応Chromebookで常時ドックになるため使わない
- **下端位置は`dockBottomPx()`が実測**する。ボトムバーの`getBoundingClientRect().height`の
  上に置き、バーが非表示(`chrome-hidden`)の時はバーの`padding-bottom`
  (= `env(safe-area-inset-bottom)`)を読んで安全領域を確保する
- **ソフトキーボードに追従**: `visualViewport`の`resize`/`scroll`で
  `window.innerHeight - vv.height - vv.offsetTop`をキーボード高とみなして再配置する
  (ハイライトのメモ入力がキーボードに隠れるのを防ぐ)
- ハイライトのポップオーバーも同じ理由・同じ仕組みでタッチ時はドックする

## Google認証の頻度を下げる(2026-08-19)

アプリを開き直すたび・Driveフォルダを変えるたびに認証画面(しばしば2段階認証)が出ていた。
原因は2つあり、両方を潰した。

- **`prompt`を明示していなかった**。GISの`requestAccessToken()`は省略時の既定が
  `'select_account consent'`で、**毎回アカウント選択+同意画面**を出す仕様。
  `{ prompt: '' }`(「初回だけ同意画面、以降は無音で発行」)を明示的に渡す。
  これが2段階認証まで誘発していた主因
- **トークンをメモリにしか持っていなかった**。アクセストークンの寿命は1時間あるのに、
  リロード・アプリ再起動で毎回捨てていた。IndexedDBの`kv`ストア(`driveToken`キー。
  `{ accessToken, scopes, expiresAt }`)に保存し、`restoreDriveTokenOnce()`で復元する

その上で、認証を「ユーザーが待たされる場面」から外した。

- **`ensureDriveToken({interactive})`が唯一の入口**。①保存済みトークンが生きていれば即返す
  → ②同意の記録(`mdViewer.driveConsentedScope`)があれば`prompt:''`で無音再取得
  → ③それでも駄目な時だけ、**ユーザー操作起点の呼び出しに限り**認証画面を出す。
  `driveFetchWithAuth()`・`appDataUpload()`・`ensureSyncToken()`は全てここを通る
- **起動時に`warmUpDriveToken()`で先回りする**。前回Driveを使っていた形跡
  (`driveCache`があるか同期がON)があり、かつ同意済みの時だけ裏でトークンを用意する。
  Driveを使わない人に起動しただけで認証を走らせない。GISは`async defer`で読み込まれるため
  `waitForGis()`で最大15秒待つ
- **期限の5分前に裏で取り直す**(`scheduleDriveTokenRefresh()`)。加えて`visibilitychange`でも
  確認する(バックグラウンドのタブではタイマーが遅延・停止するため)
- **有効判定は5分のマージン付き**(`driveTokenIsUsable()`)。期限ぎりぎりのトークンで
  処理を始めると途中で401になる。スコープの充足(`scopeListCovers()`)も同じ関数で見るので、
  同期をONにした時に**トークンを捨てる必要がない**(appdataまで同意済みなら無音で通る)
- **同時実行の抑止**: `driveTokenRequestPromise`で認証リクエストを1本に束ねる
  (ポップアップの二重表示を防ぐ)
- **`prompt:''`が失敗した時の逃げ道**: 別アカウントでログインし直した場合などに備え、
  Driveパネルのエラーに「アカウントを選び直す」ボタンを出す
  (`showDriveMessage({showAccountSwitch:true})` → `prompt:'select_account consent'`)
- 自動同期は「トークンがある間だけ」から「**無音で取れるなら取る**」に変更した。
  `runPendingSync()`は失敗時に対象を`pendingSyncBooks`へ戻すので、送信漏れが起きない
- 3回タップの診断表示にトークン残り時間・同意済みスコープ・同期ON/OFFを追加した
  (トークン本体は表示しない)

## しおりとハイライトのパネル分離(2026-08-23)

実使用の結果、「注釈」1パネルにしおりとハイライトを混在させる設計は使いにくかった。
用途が違う(しおり=位置の目印、ハイライト=引用+考察)ため、シートを分けた。

- **ボトムバーは7ボタン**(本棚/目次/検索/しおり/ハイライト/A-/A+)。A-・A+を`flex: 0 0 40px`の
  固定幅にして、その分をラベルの長い「ハイライト」へ回す。420px以下では文字を`0.7rem`に落とす。
  iPhone SE(375px)で7つとも折り返し・見切れなしを実測で確認
- **しおりパネル**: 従来通り1行表示・`prompt()`での1行メモ編集。色フィルタは外した
  (しおりに色は無いため)
- **ハイライトパネル**(`#highlight-panel` / `renderHighlightList()`): 引用を色付きの縦罫+
  最大6行(`-webkit-line-clamp`)で見せ、その下にメモをカードとして表示する。
  メモは`white-space: pre-wrap`で改行を保持し、**タップするとその場でtextareaに変わる**
  (`startNoteEdit()`。blurで保存、Escapeで取り消し)。色フィルタと書き出しはこちらへ移した
- **選択ツールバーのポップオーバーのメモも`<textarea>`に変更**(旧`<input type="text">`)。
  ハイライトのメモは1行では足りない
- **更新の起点は`renderAnnotationLists()`に集約**(2つのリストを両方描き直す)。
  本を開いた時・バックアップ取り込み・Drive同期・注釈削除はここを通す。
  片方だけ更新すればよい箇所(しおり追加・色変更等)は個別の関数を直接呼ぶ
- **書き出しは種別ごと**(`exportAnnotationsMarkdown(type)`)。
  ファイル名も`-bookmarks-`/`-highlights-`で分かれる
- **シートをソフトキーボードの上へ逃がす**(`repositionDockedElements()`内)。
  シートは`bottom: 0`固定なので、キーボードが出るとメモ編集欄が隠れる。
  `visualViewport`で測ったキーボード高だけ`translateY`する。
  `closeAllSheets()`でインラインの`transform`を消さないと、閉じるアニメーション(CSS)を潰す
- **Web検索ボタンは削除**(使われていなかった)。選択ツールバーは「文中検索」「ハイライト」の2つ
- ついでに、色スウォッチ以外(`.filter-dot` / `.ann-dot`)に色が付いていなかった不具合を修正した
  (`.hl-swatch.hl-yellow`のように`.hl-swatch`と組でしかCSSが当たっていなかった)

## データ保護・検索の負荷対策(2026-08-23)

- **`navigator.storage.persist()`をinit()末尾で要求**する。iOS SafariのITP等は、
  しばらく操作の無いサイトのIndexedDBを容量確保のため削除することがある。
  原稿・注釈・Driveトークンが全部そこに入っているため、削除対象から外れるよう要求する
  (却下されても実害はないので結果は見ない)。ローカルのhttp.serverでは`persisted()`が`false`のまま
  ということもあった(サイトの利用実績・PWAインストール等の判定はブラウザ側のヒューリスティクス次第で、
  リクエストしたからといって必ず許可されるわけではない)
- **既読位置・同期待ちを`visibilitychange`(hidden)でもflushする**。
  モバイルはタブを切り替えるとOSがプロセスごと終了させることが多く、`beforeunload`だけでは
  既読位置がスクロールのdebounce(300ms)を待つ間に失われうる。同期(`pendingSyncBooks`)も
  debounceのタイマーを待たず`runPendingSync()`を即座に呼ぶ(バックグラウンド化する前に
  fetchを開始できる可能性を上げるため。完了を待てるわけではない)
- **検索にdebounce(250ms)・最小文字数(2文字)・上限件数(500件)を追加**(`highlightMatches()`)。
  対策前は`input`のたびに全文字を再スキャンして`<mark>`を作り直しており、62万字級の原稿で
  頻出語(「これ」等)を検索すると固まりかねなかった。上限到達後は該当ノードへの正規表現適用
  そのものを止める(`searchTruncated`フラグ)ため、残り文書量に関わらず打ち切り後は軽い。
  件数表示は`12/500+`のように上限到達を示す
- **日本語IME変換中は検索しない**(`compositionstart`/`compositionend`)。変換中も`input`は
  何度も発火するため、確定するまで待ってから検索する(debounceだけでは変換の途中経過にも
  反応してしまう)

## アプリ更新の通知トースト(2026-08-23)

SWがcache-firstのため、プッシュしても「次に開いた時」まで更新が届かない。
「修正が効いていないのか、更新が届いていないのか」の切り分けを版数表示だけに頼らず、
更新が用意できた時点でその場で知らせる。

- **`sw.js`の`install`から`skipWaiting()`を外した**。これが設計の要。呼ぶと、開いている画面
  (古いindex.html)のままSWだけが新しくなるちぐはぐな状態になり、知らせる機会も無くなる。
  新しいSWは`waiting`で待機させ、**ユーザーが「再読み込み」を押した時だけ**
  `SKIP_WAITING`メッセージで交代する(`sw.js`に`message`ハンドラを追加)
- **リロードするのは「自分が押した結果の交代」だけ**(`promoted`フラグ)。`controllerchange`は
  初回インストールの`clients.claim()`でも別タブ発の交代でも飛ぶため、無条件にリロードすると
  読書中に画面が飛ぶ。ここを間違えるとリロードの往復になり、実機では切り分けが極めて困難
- **初回インストールでは出さない**。`installed`になった時点で`navigator.serviceWorker.controller`が
  あるか(=既に古いSWに制御されているか)で「更新」と「初回」を区別する
- **`register()`に`updateViaCache: 'none'`**を渡す。`sw.js`自体がHTTPキャッシュから返ると
  更新の検出が丸ごと遅れる(GitHub Pagesのキャッシュヘッダの影響を受けなくする)
- **復帰時にも更新を確認する**。ホーム画面から起動したPWAはバックグラウンドから戻っても
  ページを読み込み直さないため、`visibilitychange`(visible)で`registration.update()`を呼ぶ。
  ネットワークを使うので1時間に1回まで
- **トーストは画面下端**(`positionUpdateToast()`が`dockBottomPx()`で実測、ボトムバーの上)。
  当初は上端に置いたが、**ビューアのタイトルを完全に覆って3回タップの診断が使えなくなる**
  ため下端へ移した
- 空振り対策として、`controllerchange`が来ない環境向けに3秒のフォールバックリロードを置く。
  空振りしても「古い版のままトーストが再度出る」だけでループにはならない
- **移行期の注意**: 実機に届いている旧SW(v7以前)にはこの仕組みが無いため、
  **v9への更新自体は従来通り「次に開いた時」に届く**。トーストが機能するのはv9以降の更新から

## 既知の制約と技術的負債

- Drive連携は`https://`オリジン必須。ローカルの`index.html`を直接開いた場合、Driveパネルが理由と公開版URLを案内する
- **ブラウザのOAuthではリフレッシュトークンを持てない**(GISのトークンモデルの制約)。
  アクセストークンの上限は1時間なので、「認証ゼロ」にはできない。無音再取得で
  ユーザーに見えなくしているだけで、Googleのセッション自体が切れれば再ログインは必要
- **`prompt:''`の無音再取得はブラウザのCookie制限に依存する**。iOS Safari/ChromeのITPや
  サードパーティCookieのブロックが強い環境では無音取得が失敗し、対話的な認証に落ちうる。
  その場合でも保存済みトークン(1時間)は効くので、頻度は下がる
- アクセストークンをIndexedDBに平文で保存している。同一オリジンからしか読めず、
  スコープも`drive.readonly`(+`drive.appdata`)に限られるが、XSSが成立すれば読み出される。
  `renderMarkdown()`のDOMPurifyがその最後の防壁になっている
- ピン留め・最近読んだはバックアップJSON/Drive同期の対象外(端末ローカルの閲覧履歴のため)
- iOSの表示崩れ修正は`-webkit-text-size-adjust`・`#viewer-content`の幅指定・`overflow-wrap`を
  同時にデプロイしたため、**どれが決め手だったかは厳密には未確定**。診断値(font-size一致・
  横スクロールなし)からテキスト自動拡大が主因とみているが、切り分けには実機での再検証が必要

## 次の優先順位

詳細は @docs/md_viewer_development_plan.md §9 を参照。

- ~~P0-2 データモデル刷新~~ → **完了(2026-08-16)**
- ~~P1-1 フォルダ/ファイルハンドルの永続化 + 「読書中」本棚~~ → **完了(2026-08-16)**
- ~~P1-2 モバイルUI再構成~~ → **完了(2026-08-16)**
- ~~P2-1 ハイライト + メモ~~ → **完了(2026-08-16)**
- ~~P2-2 Drive `appDataFolder` による自動同期~~ → **完了(2026-08-16)**
- ~~P3 `marked`自己ホスト + PWA化、サニタイズ、注釈データのIndexedDB移行~~ → **完了(2026-08-16)**

Phase 3(計画書 §9)のロードマップはこれで全項目完了。次の課題は §8「未決定事項」や新規要望を参照。

## 見出し表示の調整(2026-08-16)

実際の翻訳原稿(`~/freud-translation`, `~/lacan-translation`。本リポジトリには含まない)を
`~`以下から直接読み、見出し構造を確認した上で調整した。

- **h1〜h6を明示的にスタイリング**(従来h4以下は未指定でブラウザ既定サイズに頼っていた)。
  h3以下は章立てというより症例史・注番号などの細かい区切りに使われることが多いため
  (フロイト訳の実データで確認)、上位見出しより余白を詰めて本文との連続感を持たせる
- **「番号だけの見出し」を検出して減光表示**(`isHeadingMarker()` / `.heading-marker`)。
  `## I.` `### 1.` `### A.` のような、症例史や理論篇の下位区切りに頻出するパターン
  (`^[0-9]+\.?$` 等の正規表現)を検出し、アクセントカラーの章見出しと同じ扱いにせず
  本文寄りの控えめな見た目にする
- **目次(TOC)に文脈を補完**: 番号だけの見出しは目次に並んでも「III.」がどこを指すか
  分からないため、`buildToc()`が直近の上位見出しを前置する(例:「症例史 › III.」)。
  `ancestorByLevel`で見出しレベルごとに直近の非マーカー見出しテキストを追跡する
- ラカン訳(見出しがフラットで`#`+`##`のみ、番号だけの見出しなし)でも誤検出なし・
  回帰なしを確認済み
- **脚注ブロックの改行保持**: `> 【注1】...` `> 【注2】...` のように空行なしで連続する
  引用行は、CommonMarkの仕様上1つの`<p>`に結合され(改行は保持されるが表示上は空白に
  折りたたまれる)、脚注同士が見分けられなくなっていた。`#viewer-content blockquote p`に
  `white-space: pre-line`を指定し、DOM構造を変えずCSS1行で解決(実データで最大8件の
  連続脚注を確認・修正)。空行区切りで別`<p>`になっている引用(訳注ラベル等)は元々
  無関係なので影響なし

## 未決定事項(実装しながら判断)

- ~~見開き/ページめくり型か連続スクロール型か~~ → 連続スクロール型で実装済み
- ~~既存の翻訳MDファイルの見出し構造に合わせた表示スタイル調整~~ → 上記の通り実装済み(2026-08-16)

## コーディング方針

- 変更は小さく刻み、各ステップごとに動作確認してから次に進む
- 新しい判断が必要になった場合は、この計画から逸脱する前に一度立ち止まって確認する
