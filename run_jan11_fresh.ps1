param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

Set-Location "C:\Users\echoe\OneDrive\Desktop\cashkids\Earn-It"

$localTsx = "node_modules\.bin\tsx.ps1"
if (Test-Path $localTsx) {
    & $localTsx "server/cli/sports app 1.ts" @Args
} else {
    npx --yes tsx "server/cli/sports app 1.ts" @Args
}
