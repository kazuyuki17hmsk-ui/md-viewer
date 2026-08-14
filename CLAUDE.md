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

- [x] 1. 基本UI(本棚一覧画面 + ビューア画面)の骨格
- [x] 2. Chromebook向けフォルダ読み込み(File System Access API)
- [x] 3. Markdownレンダリング + フォントサイズ調整
- [x] 4. しおり機能(追加・一覧・ジャンプ)+ localStorage永続化
- [x] 5. ファイル内検索機能
- [x] 6. 選択テキストのWeb検索ボタン
- [x] 7. スマホ向けファイルインポート(IndexedDB)
- [x] 8. JSONエクスポート/インポート(バックアップ)機能
- [ ] 9. 動作確認・微調整

## 開発環境

- Chromebook(ChromeOS / Crostini Linux)上で作業
- 動作確認は主にChromeブラウザで手動確認(自動テストは現状未整備)
- ビルドツール・パッケージマネージャは現状不要(単一HTMLファイルのため)

## 未決定事項(実装しながら判断)

- 見開き/ページめくり型か連続スクロール型か
- 既存の翻訳MDファイル(FREUD_訳語集など)の見出し構造に合わせた表示スタイル調整

## コーディング方針

- 変更は小さく刻み、各ステップごとに動作確認してから次に進む
- 新しい判断が必要になった場合は、この計画から逸脱する前に一度立ち止まって確認する
