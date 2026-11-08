param([ValidateSet('painel','servidor','visao','camera')][string]$Parte='painel')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $MyInvocation.MyCommand.Path
$localTools=Join-Path (Split-Path -Parent $repo) 'toolchain'
switch($Parte){
 'painel' {Set-Location (Join-Path $repo 'dashboard-web');if(!(Test-Path node_modules)){npm.cmd ci};npm.cmd run dev -- --host 127.0.0.1 --port 3001 --strictPort}
 'servidor' {
  Set-Location (Join-Path $repo 'backend')
  $bundledJava=Get-ChildItem (Join-Path $localTools 'java') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if($bundledJava){$env:JAVA_HOME=$bundledJava.FullName;$java=Join-Path $env:JAVA_HOME 'bin/java.exe'}else{$java='java'}
  if(!(Test-Path target/assistmob-backend-1.0.0.jar)){
   $maven=Join-Path $localTools 'apache-maven-3.9.9/bin/mvn.cmd';if(!(Test-Path $maven)){$maven='mvn.cmd'};& $maven --batch-mode package
   if($LASTEXITCODE -ne 0){throw 'Não foi possível preparar o servidor.'}
  }
  & $java '-Duser.timezone=America/Sao_Paulo' -jar target/assistmob-backend-1.0.0.jar --spring.profiles.active=local --server.address=127.0.0.1
 }
 default {
  $python=Join-Path (Split-Path -Parent $repo) 'vision-venv/Scripts/python.exe'
  Set-Location (Join-Path $repo 'vision-service')
  if(!(Test-Path $python)){$python=Join-Path $PWD '.venv/Scripts/python.exe';if(!(Test-Path $python)){py -3.11 -m venv .venv;& $python -m pip install -r requirements.txt}}
  if($Parte -eq 'visao'){& $python -m uvicorn app.main:app --host 127.0.0.1 --port 8001}else{& $python -m app.worker}
 }
}
