# Backup da versão estável do Argos Orbis TV — 1.0.149

Snapshot de recuperação criado em 2026-11-25, antes da próxima atualização meteorológica.

## Referência imutável do código original
- Repositório: https://github.com/helbermoura2/Monitor-Global
- Commit-base preservado: a9f36ba0339f2452b1ec4937101373b902fb2a5f
- Branch de recuperação: backup/android-tv-stable-1.0.149-2026-11-25

## APK estável publicado
- Versão: 1.0.149
- versionCode: 10149
- applicationId: top.monitorglobal.tv.preview
- APK: https://monitorglobal.top/downloads/monitor-global-tv-1.0.149.apk
- SHA-256 do APK: 07efda0ea804cae25d1c0787f716c6c35c8cb698446a74f393a49943b7ad476c
- SHA-256 do certificado de assinatura: 1e11295641c7701f909a73683eda7b9fefc62504a20730c5785bdfe22e0d5b82

## Manifesto e build preservados
- android-tv/distribution/stable.json — blob SHA: 3eb1cd62ad4da4fa0f8aa978192a395489cb5071
- android-tv/app/build.gradle — blob SHA: 48776c44fb9d478262ead4e53b29d3e0af81a20d
- android-tv/signing/identity.json — blob SHA: 2cb202b574a57b48f48cefaf311f8b28149b70a6

## Política de recuperação
O APK de atualização deve manter o mesmo applicationId e identidade de assinatura compatível com a instalação existente, e usar versionCode superior a 10149. Não substituir a versão estável até validar build, assinatura, hash e manifesto. Em caso de regressão, restaurar a distribuição 1.0.149 e seu APK correspondente; não exigir desinstalação do aplicativo para o procedimento normal de atualização.
