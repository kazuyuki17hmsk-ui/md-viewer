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
- [x] 6. 選択テキストのWeb検索ボタン
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

## 既知の制約と技術的負債

- Drive連携は`https://`オリジン必須。ローカルの`index.html`を直接開いた場合、Driveパネルが理由と公開版URLを案内する
- `marked.js`がCDN依存 → オフライン不可。PWA化には自己ホストが前提
- 注釈データがlocalStorage依存(5MB上限)。超過時は`saveJSON()`が警告を出す(P3でIndexedDBへ移行予定)
- `marked.parse()`の結果を無サニタイズで`innerHTML`に入れている(自分の原稿のみなら実害は低い)
- ピン留め・最近読んだはバックアップJSON/Drive同期の対象外(端末ローカルの閲覧履歴のため)

## 次の優先順位

詳細は @docs/md_viewer_development_plan.md §9 を参照。

- ~~P0-2 データモデル刷新~~ → **完了(2026-08-16)**
- ~~P1-1 フォルダ/ファイルハンドルの永続化 + 「読書中」本棚~~ → **完了(2026-08-16)**
- ~~P1-2 モバイルUI再構成~~ → **完了(2026-08-16)**
- P2-1 ハイライト + メモ(`start`/`end`と再アンカーの土台は実装済み。レイヤー再構築関数が要る)
- P2-2 Drive `appDataFolder` による自動同期(`bookId`・tombstone・マージ処理は実装済み)
- P3 `marked`自己ホスト + PWA化(オフライン読書)、注釈データのIndexedDB移行

## 未決定事項(実装しながら判断)

- ~~見開き/ページめくり型か連続スクロール型か~~ → 連続スクロール型で実装済み
- 既存の翻訳MDファイル(FREUD_訳語集など)の見出し構造に合わせた表示スタイル調整

## コーディング方針

- 変更は小さく刻み、各ステップごとに動作確認してから次に進む
- 新しい判断が必要になった場合は、この計画から逸脱する前に一度立ち止まって確認する
