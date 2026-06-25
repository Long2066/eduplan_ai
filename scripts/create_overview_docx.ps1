$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'docs'
$outFile = Join-Path $outDir 'EDUPLAN_AI_SO_DO_TONG_QUAN.docx'

if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()

$wdStory = 6
$wdAlignCenter = 1
$wdAlignLeft = 0
$wdOrientLandscape = 1
$wdPreferredWidthPercent = 2

$doc.PageSetup.Orientation = $wdOrientLandscape
$doc.PageSetup.TopMargin = 36
$doc.PageSetup.BottomMargin = 36
$doc.PageSetup.LeftMargin = 36
$doc.PageSetup.RightMargin = 36

function Move-End {
  $selection = $word.Selection
  $selection.EndKey($wdStory) | Out-Null
  return $selection
}

function Add-Paragraph($text, $size = 12, $bold = $false, $color = 0, $align = 0) {
  $selection = Move-End
  $selection.Font.Name = 'Times New Roman'
  $selection.Font.Size = $size
  $selection.Font.Bold = [int]$bold
  $selection.Font.Color = $color
  $selection.ParagraphFormat.Alignment = $align
  $selection.TypeText($text)
  $selection.TypeParagraph()
}

function Add-SectionTitle($text) {
  Add-Paragraph $text 16 $true 16737792 $wdAlignLeft
}

function Set-Cell($cell, $text, $bgColor, $fontSize = 12, $bold = $true) {
  $cell.Range.Text = $text
  $cell.Range.Font.Name = 'Times New Roman'
  $cell.Range.Font.Size = $fontSize
  $cell.Range.Font.Bold = [int]$bold
  $cell.Range.Font.Color = 0
  $cell.Shading.BackgroundPatternColor = $bgColor
  $cell.Range.ParagraphFormat.Alignment = $wdAlignCenter
  $cell.VerticalAlignment = 1
}

function Add-Spacer {
  Add-Paragraph '' 6 $false 0 $wdAlignLeft
}

Add-Paragraph 'SO DO TONG QUAN CONG CU EDUPLAN AI' 22 $true 16737792 $wdAlignCenter
Add-Paragraph 'Web app tao ke hoach bai day theo Cong van 2345, co OCR anh SGK/PDF, AI sinh giao an, kiem tra chat luong va xuat Word/PDF dep.' 12 $false 4210752 $wdAlignCenter
Add-Spacer

Add-SectionTitle '1. So do cau truc tong quan'
Add-Paragraph 'Nhin tu trai sang phai: giao vien nhap du lieu, web app xu ly giao dien, backend goi AI/OCR, kiem tra chat luong, sau do xuat file.' 11 $false 4210752 $wdAlignLeft

$selection = Move-End
$table = $doc.Tables.Add($selection.Range, 3, 7)
$table.Borders.Enable = $true
$table.PreferredWidthType = $wdPreferredWidthPercent
$table.PreferredWidth = 100

Set-Cell $table.Cell(1,1) "GIAO VIEN`r`nNhap bai hoc`r`nUpload SGK/PDF" 10213375 11 $true
Set-Cell $table.Cell(1,2) '->' 16777215 18 $true
Set-Cell $table.Cell(1,3) "WEB APP`r`nForm nhap lieu`r`nPreview dep`r`nToolbar tinh chinh" 16774638 11 $true
Set-Cell $table.Cell(1,4) '->' 16777215 18 $true
Set-Cell $table.Cell(1,5) "BACKEND API`r`nValidate`r`nGenerate`r`nRefine`r`nExport" 16770764 11 $true
Set-Cell $table.Cell(1,6) '->' 16777215 18 $true
Set-Cell $table.Cell(1,7) "AI / OCR`r`nGemini Vision`r`nGPT nano / mini / full" 15400938 11 $true

Set-Cell $table.Cell(2,1) '' 16777215 10 $false
Set-Cell $table.Cell(2,2) '' 16777215 10 $false
Set-Cell $table.Cell(2,3) 'v' 16777215 18 $true
Set-Cell $table.Cell(2,4) '' 16777215 10 $false
Set-Cell $table.Cell(2,5) 'v' 16777215 18 $true
Set-Cell $table.Cell(2,6) '' 16777215 10 $false
Set-Cell $table.Cell(2,7) 'v' 16777215 18 $true

Set-Cell $table.Cell(3,1) "LUU NHAP`r`nAutosave`r`nVersion history" 16448250 11 $true
Set-Cell $table.Cell(3,2) '<-' 16777215 18 $true
Set-Cell $table.Cell(3,3) "PREVIEW GIAO AN`r`nMau sac dep`r`nBang 2 cot GV/HS" 16774638 11 $true
Set-Cell $table.Cell(3,4) '<-' 16777215 18 $true
Set-Cell $table.Cell(3,5) "QUALITY CHECK`r`nDu 5 phan`r`nDung 2 cot`r`nCo danh gia" 13434879 11 $true
Set-Cell $table.Cell(3,6) '->' 16777215 18 $true
Set-Cell $table.Cell(3,7) "DAU RA`r`nWord .docx`r`nPDF`r`nCopy noi dung" 14940415 11 $true

Add-Spacer

Add-SectionTitle '2. Luong hoat dong chinh'
$selection = Move-End
$flow = $doc.Tables.Add($selection.Range, 8, 3)
$flow.Borders.Enable = $true
$flow.PreferredWidthType = $wdPreferredWidthPercent
$flow.PreferredWidth = 100

Set-Cell $flow.Cell(1,1) 'Buoc' 16774638 12 $true
Set-Cell $flow.Cell(1,2) 'Khoi xu ly' 16774638 12 $true
Set-Cell $flow.Cell(1,3) 'Mo ta de hieu' 16774638 12 $true

Set-Cell $flow.Cell(2,1) '1' 16777215 12 $true
Set-Cell $flow.Cell(2,2) 'Nhap lieu' 10213375 12 $true
Set-Cell $flow.Cell(2,3) 'Giao vien nhap mon, lop, ten bai, so tiet, yeu cau can dat, boi canh day hoc va co the upload anh SGK/PDF.' 16777215 11 $false

Set-Cell $flow.Cell(3,1) '2' 16777215 12 $true
Set-Cell $flow.Cell(3,2) 'OCR' 15400938 12 $true
Set-Cell $flow.Cell(3,3) 'Gemini Vision doc anh/PDF thanh van ban. Nguoi dung duoc xem va sua text OCR truoc khi tao giao an.' 16777215 11 $false

Set-Cell $flow.Cell(4,1) '3' 16777215 12 $true
Set-Cell $flow.Cell(4,2) 'Lam sach text' 15400938 12 $true
Set-Cell $flow.Cell(4,3) 'GPT nano sua loi OCR, chuan hoa dau cau, xuong dong, nhung khong tu them noi dung moi.' 16777215 11 $false

Set-Cell $flow.Cell(5,1) '4' 16777215 12 $true
Set-Cell $flow.Cell(5,2) 'Sinh giao an' 15400938 12 $true
Set-Cell $flow.Cell(5,3) 'GPT mini sinh giao an JSON theo CV2345. GPT full chi dung cho thi giang/demo hoac khi chat luong chua dat.' 16777215 11 $false

Set-Cell $flow.Cell(6,1) '5' 16777215 12 $true
Set-Cell $flow.Cell(6,2) 'Kiem tra chat luong' 13434879 12 $true
Set-Cell $flow.Cell(6,3) 'He thong kiem tra du 5 phan, dung bang 2 cot GV/HS, co danh gia, co dieu chinh va phu hop hoan canh giang day.' 16777215 11 $false

Set-Cell $flow.Cell(7,1) '6' 16777215 12 $true
Set-Cell $flow.Cell(7,2) 'Preview va tinh chinh' 16774638 12 $true
Set-Cell $flow.Cell(7,3) 'Giao an hien thi dep tren web. Nguoi dung co the rut gon, chi tiet hon, them nang luc so, chuyen sang thi giang.' 16777215 11 $false

Set-Cell $flow.Cell(8,1) '7' 16777215 12 $true
Set-Cell $flow.Cell(8,2) 'Xuat file' 14940415 12 $true
Set-Cell $flow.Cell(8,3) 'Xuat Word/PDF voi Times New Roman 13, tieu de mau, bang 2 cot ro, kho A4, khong loi font tieng Viet.' 16777215 11 $false

Add-Spacer

Add-SectionTitle '3. Chu giai mau'
$selection = Move-End
$legend = $doc.Tables.Add($selection.Range, 6, 2)
$legend.Borders.Enable = $true
$legend.PreferredWidthType = $wdPreferredWidthPercent
$legend.PreferredWidth = 75

Set-Cell $legend.Cell(1,1) 'Mau vang' 10213375 11 $true
Set-Cell $legend.Cell(1,2) 'Nguoi dung / giao vien' 16777215 11 $false
Set-Cell $legend.Cell(2,1) 'Mau xanh duong' 16774638 11 $true
Set-Cell $legend.Cell(2,2) 'Giao dien web: form, preview, toolbar' 16777215 11 $false
Set-Cell $legend.Cell(3,1) 'Mau tim' 16770764 11 $true
Set-Cell $legend.Cell(3,2) 'Backend API: validate, generate, refine, export' 16777215 11 $false
Set-Cell $legend.Cell(4,1) 'Mau xanh la' 15400938 11 $true
Set-Cell $legend.Cell(4,2) 'AI/OCR providers: Gemini Vision, GPT models' 16777215 11 $false
Set-Cell $legend.Cell(5,1) 'Mau cam' 14940415 11 $true
Set-Cell $legend.Cell(5,2) 'Dau ra: DOCX, PDF, copy noi dung' 16777215 11 $false
Set-Cell $legend.Cell(6,1) 'Mau xam' 16448250 11 $true
Set-Cell $legend.Cell(6,2) 'Luu nhap, autosave, version history' 16777215 11 $false

Add-Spacer
Add-Paragraph 'Ket luan: EduPlan AI gom 5 lop chinh: nhap lieu, xu ly AI/OCR, kiem tra chat luong, hien thi preview dep va xuat file Word/PDF.' 12 $true 4210752 $wdAlignLeft

if (Test-Path $outFile) {
  Remove-Item $outFile -Force
}

$doc.SaveAs2($outFile, 16)
$doc.Close()
$word.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

Write-Output $outFile
