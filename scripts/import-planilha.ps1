param(
  [string]$Path = "$env:USERPROFILE\Desktop\SUCESSO DO CLIENTE 2026.xlsx",
  [string]$OutputPath = "database\seed-sucesso-cliente-2026.sql"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Normalize-Key([string]$Value) {
  if (-not $Value) { return "" }
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $withoutMarks = [Text.RegularExpressions.Regex]::Replace($normalized, "\p{Mn}", "")
  return ([Text.RegularExpressions.Regex]::Replace($withoutMarks, "[^a-zA-Z0-9]+", " ")).Trim().ToUpperInvariant()
}

function Sql-Text($Value) {
  if ($null -eq $Value -or "$Value".Trim() -eq "") { return "null" }
  return "'" + ("$Value".Trim() -replace "'", "''") + "'"
}

function Sql-Number($Value) {
  if ($null -eq $Value -or "$Value".Trim() -eq "") { return "null" }
  $n = 0.0
  if ([double]::TryParse(("$Value" -replace ",", "."), [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
    return $n.ToString([Globalization.CultureInfo]::InvariantCulture)
  }
  return "null"
}

function Sql-Date($Value) {
  if ($null -eq $Value -or "$Value".Trim() -eq "") { return "null" }
  $text = "$Value".Trim()
  $serial = 0.0
  if ([double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$serial)) {
    return Sql-Text(([DateTime]"1899-12-30").AddDays([int][math]::Floor($serial)).ToString("yyyy-MM-dd"))
  }
  $date = [DateTime]::MinValue
  if ([DateTime]::TryParse($text, [Globalization.CultureInfo]::GetCultureInfo("pt-BR"), [Globalization.DateTimeStyles]::None, [ref]$date)) {
    return Sql-Text($date.ToString("yyyy-MM-dd"))
  }
  return "null"
}

function Cell-Column([string]$Ref) {
  return ([Text.RegularExpressions.Regex]::Match($Ref, "^[A-Z]+")).Value
}

function Cell-Value($Cell, $Ns, $SharedStrings) {
  $type = $Cell.GetAttribute("t")
  $v = $Cell.SelectSingleNode("x:v", $Ns)
  if ($type -eq "inlineStr") {
    $texts = $Cell.SelectNodes(".//x:t", $Ns) | ForEach-Object { $_."#text" }
    return ($texts -join "")
  }
  if (-not $v) { return $null }
  $raw = $v.InnerText
  if ($type -eq "s" -and $raw -ne "") { return $SharedStrings[[int]$raw] }
  return $raw
}

function Read-SharedStrings($Zip) {
  $entry = $Zip.GetEntry("xl/sharedStrings.xml")
  if (-not $entry) { return @() }
  $reader = [IO.StreamReader]::new($entry.Open())
  [xml]$xml = $reader.ReadToEnd()
  $reader.Close()
  $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
  $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  return @($xml.SelectNodes("//x:si", $ns) | ForEach-Object {
    ($_.SelectNodes(".//x:t", $ns) | ForEach-Object { $_."#text" }) -join ""
  })
}

function Read-Value($Row, $Names) {
  foreach ($name in $Names) {
    $k = Normalize-Key $name
    if ($Row.ContainsKey($k)) { return $Row[$k] }
  }
  return $null
}

$zip = [IO.Compression.ZipFile]::OpenRead($Path)
try {
  $shared = Read-SharedStrings $zip
  [xml]$workbook = ([IO.StreamReader]::new($zip.GetEntry("xl/workbook.xml").Open())).ReadToEnd()
  [xml]$rels = ([IO.StreamReader]::new($zip.GetEntry("xl/_rels/workbook.xml.rels").Open())).ReadToEnd()

  $wbNs = [Xml.XmlNamespaceManager]::new($workbook.NameTable)
  $wbNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  $wbNs.AddNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")

  $relMap = @{}
  foreach ($rel in $rels.Relationships.Relationship) { $relMap[$rel.Id] = $rel.Target }

  $lines = [Collections.Generic.List[string]]::new()
  $lines.Add("begin;")
  $count = 0

  foreach ($sheet in $workbook.SelectNodes("//x:sheet", $wbNs)) {
    $sheetName = $sheet.name
    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $target = $relMap[$rid]
    $sheetPath = if ($target.StartsWith("/")) { $target.TrimStart("/") } else { "xl/$target" }
    $entry = $zip.GetEntry($sheetPath)
    if (-not $entry) { continue }

    [xml]$sheetXml = ([IO.StreamReader]::new($entry.Open())).ReadToEnd()
    $ns = [Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
    $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

    $rows = $sheetXml.SelectNodes("//x:sheetData/x:row", $ns)
    if ($rows.Count -lt 2) { continue }

    $headers = @{}
    foreach ($cell in $rows[0].SelectNodes("x:c", $ns)) {
      $headers[(Cell-Column $cell.r)] = Normalize-Key (Cell-Value $cell $ns $shared)
    }

    foreach ($rowNode in $rows | Select-Object -Skip 1) {
      $row = @{}
      foreach ($cell in $rowNode.SelectNodes("x:c", $ns)) {
        $col = Cell-Column $cell.r
        if ($headers.ContainsKey($col) -and $headers[$col]) {
          $row[$headers[$col]] = Cell-Value $cell $ns $shared
        }
      }

      $pedido = Read-Value $row @("N DO PEDIDO", "NUMERO DO PEDIDO")
      $cliente = Read-Value $row @("CLIENTE")
      $produto = Read-Value $row @("DESCRICAO DO PRODUTO")
      if (-not $pedido -and -not $cliente -and -not $produto) { continue }

      $statusValue = Read-Value $row @("STATUS", "STATUS ACOMPANHAMENTO")
      if (-not $statusValue) { $statusValue = "ABERTO" }

      $values = @(
        (Sql-Date (Read-Value $row @("DATA DA SOLI"))),
        (Sql-Text $pedido),
        (Sql-Text $cliente),
        (Sql-Text (Read-Value $row @("COD PRODUTO"))),
        (Sql-Text $produto),
        (Sql-Number (Read-Value $row @("QUANTIDADE"))),
        (Sql-Number (Read-Value $row @("VALOR UNITARIO"))),
        (Sql-Number (Read-Value $row @("VALOR TOTAL"))),
        (Sql-Text (Read-Value $row @("SOLICITACAO MOTIVO", "QUAL A SOLICITACAO"))),
        (Sql-Text (Read-Value $row @("SETOR", "SETOR RESPONSAVEL"))),
        (Sql-Text (Read-Value $row @("RESPONSAVEL"))),
        (Sql-Text (Read-Value $row @("PROXIMA ACAO", "RESOLUCAO COM CLIENTE"))),
        (Sql-Text $statusValue),
        (Sql-Text (Read-Value $row @("NOVO PEDIDO"))),
        (Sql-Text (Read-Value $row @("CLIENTE TEM DESCONTO"))),
        (Sql-Text (Read-Value $row @("VENDEDOR"))),
        (Sql-Text (Read-Value $row @("DESCRICAO DA SITUACAO", "INFORMACOES GERAIS"))),
        (Sql-Text $sheetName),
        $rowNode.r
      )

      $sql = "insert into cscx_atendimentos (data_solicitacao, numero_pedido, cliente, codigo_produto, descricao_produto, quantidade, valor_unitario, valor_total, motivo, setor, responsavel, proxima_acao, status, novo_pedido, cliente_tem_desconto, vendedor, descricao_situacao, origem_planilha_aba, origem_linha) values ($($values -join ', ')) on conflict (origem_planilha_aba, origem_linha) where origem_planilha_aba is not null and origem_linha is not null do update set data_solicitacao = excluded.data_solicitacao, numero_pedido = excluded.numero_pedido, cliente = excluded.cliente, codigo_produto = excluded.codigo_produto, descricao_produto = excluded.descricao_produto, quantidade = excluded.quantidade, valor_unitario = excluded.valor_unitario, valor_total = excluded.valor_total, motivo = excluded.motivo, setor = excluded.setor, responsavel = excluded.responsavel, proxima_acao = excluded.proxima_acao, status = excluded.status, novo_pedido = excluded.novo_pedido, cliente_tem_desconto = excluded.cliente_tem_desconto, vendedor = excluded.vendedor, descricao_situacao = excluded.descricao_situacao;"
      $lines.Add($sql)
      $count++
    }
  }

  $lines.Add("commit;")
  New-Item -ItemType Directory -Force (Split-Path $OutputPath -Parent) | Out-Null
  Set-Content -Path $OutputPath -Value $lines -Encoding UTF8
  Write-Host "SQL gerado em $OutputPath com $count linhas."
}
finally {
  $zip.Dispose()
}
