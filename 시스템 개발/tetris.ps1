# PowerShell console Tetris
# Move: Left/Right, rotate: Up, soft drop: Down, hard drop: Space, quit: Esc

$ErrorActionPreference = 'Stop'
$width = 10
$height = 20
$board = New-Object 'int[,]' $height, $width
$shapes = @(
    @('0,1', '1,1', '2,1', '3,1'), # I
    @('1,0', '2,0', '1,1', '2,1'), # O
    @('1,0', '0,1', '1,1', '2,1'), # T
    @('1,0', '2,0', '0,1', '1,1'), # S
    @('0,0', '1,0', '1,1', '2,1'), # Z
    @('0,0', '0,1', '1,1', '2,1'), # J
    @('2,0', '0,1', '1,1', '2,1')  # L
)

function Get-Cells($shape, [int]$rotation, [int]$originX, [int]$originY) {
    foreach ($cell in $shape) {
        $parts = $cell.Split(',')
        $x = [int]$parts[0]
        $y = [int]$parts[1]
        if ($shape[0] -ne '1,0' -or $shape[1] -ne '2,0' -or $shape[2] -ne '1,1') {
            for ($turn = 0; $turn -lt $rotation; $turn++) {
                $oldX = $x
                $x = 2 - $y
                $y = $oldX
            }
        }
        ,@(($originX + $x), ($originY + $y))
    }
}

function Test-Position($shape, [int]$rotation, [int]$x, [int]$y) {
    foreach ($cell in (Get-Cells $shape $rotation $x $y)) {
        $cx = [int]$cell[0]
        $cy = [int]$cell[1]
        if ($cx -lt 0 -or $cx -ge $width -or $cy -ge $height) { return $false }
        if ($cy -ge 0 -and $board[$cy, $cx] -ne 0) { return $false }
    }
    return $true
}

function Draw-Game {
    $active = @{}
    foreach ($cell in (Get-Cells $shape $rotation $pieceX $pieceY)) {
        if ($cell[1] -ge 0) { $active["$($cell[0]),$($cell[1])"] = $true }
    }
    [Console]::SetCursorPosition(0, 0)
    [Console]::WriteLine(('TETRIS  Score: {0}  Lines: {1}' -f $score, $cleared).PadRight(36))
    [Console]::WriteLine('+' + ('--' * $width) + '+')
    for ($y = 0; $y -lt $height; $y++) {
        [Console]::Write('|')
        for ($x = 0; $x -lt $width; $x++) {
            if ($active.ContainsKey("$x,$y")) { [Console]::BackgroundColor = 'Cyan' }
            elseif ($board[$y, $x] -ne 0) { [Console]::BackgroundColor = 'DarkCyan' }
            else { [Console]::BackgroundColor = 'Black' }
            [Console]::Write('  ')
        }
        [Console]::BackgroundColor = 'Black'
        [Console]::WriteLine('|')
    }
    [Console]::WriteLine('+' + ('--' * $width) + '+')
    [Console]::WriteLine('Arrows: move/rotate/drop  Space: hard drop  Esc: quit')
}

function New-Piece {
    $script:shape = $shapes[(Get-Random -Minimum 0 -Maximum $shapes.Count)]
    $script:rotation = 0
    $script:pieceX = 3
    $script:pieceY = -1
    return (Test-Position $shape $rotation $pieceX $pieceY)
}

function Lock-Piece {
    foreach ($cell in (Get-Cells $shape $rotation $pieceX $pieceY)) {
        if ($cell[1] -lt 0) { return $false }
        $board[[int]$cell[1], [int]$cell[0]] = 1
    }
    $removed = 0
    for ($y = $height - 1; $y -ge 0; $y--) {
        $full = $true
        for ($x = 0; $x -lt $width; $x++) {
            if ($board[$y, $x] -eq 0) { $full = $false; break }
        }
        if ($full) {
            for ($copyY = $y; $copyY -gt 0; $copyY--) {
                for ($x = 0; $x -lt $width; $x++) { $board[$copyY, $x] = $board[($copyY - 1), $x] }
            }
            for ($x = 0; $x -lt $width; $x++) { $board[0, $x] = 0 }
            $removed++
            $y++
        }
    }
    $script:cleared += $removed
    $script:score += @(0, 100, 300, 500, 800)[$removed]
    return (New-Piece)
}

try {
    if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) {
        throw '대화형 터미널에서 실행해 주세요.'
    }
    [Console]::CursorVisible = $false
    [Console]::Clear()
    $score = 0
    $cleared = 0
    $running = New-Piece
    $lastFall = [DateTime]::UtcNow
    while ($running) {
        while ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true).Key
            switch ($key) {
                'LeftArrow'  { if (Test-Position $shape $rotation ($pieceX - 1) $pieceY) { $pieceX-- } }
                'RightArrow' { if (Test-Position $shape $rotation ($pieceX + 1) $pieceY) { $pieceX++ } }
                'UpArrow' {
                    $nextRotation = ($rotation + 1) % 4
                    foreach ($offset in @(0, -1, 1, -2, 2)) {
                        if (Test-Position $shape $nextRotation ($pieceX + $offset) $pieceY) {
                            $pieceX += $offset
                            $rotation = $nextRotation
                            break
                        }
                    }
                }
                'DownArrow' { if (Test-Position $shape $rotation $pieceX ($pieceY + 1)) { $pieceY++; $score++ } }
                'Spacebar' {
                    while (Test-Position $shape $rotation $pieceX ($pieceY + 1)) { $pieceY += 1; $score += 2 }
                    $running = Lock-Piece
                    $lastFall = [DateTime]::UtcNow
                }
                'Escape' { $running = $false }
            }
            if (-not $running) { break }
        }
        if (-not $running) { break }
        $delay = [Math]::Max(100, 600 - 25 * [Math]::Floor($cleared / 10))
        if (([DateTime]::UtcNow - $lastFall).TotalMilliseconds -ge $delay) {
            if (Test-Position $shape $rotation $pieceX ($pieceY + 1)) { $pieceY++ }
            else { $running = Lock-Piece }
            $lastFall = [DateTime]::UtcNow
        }
        Draw-Game
        Start-Sleep -Milliseconds 35
    }
    Draw-Game
    [Console]::WriteLine("Game over! Score: $score")
}
finally {
    [Console]::BackgroundColor = 'Black'
    [Console]::CursorVisible = $true
}
