# Argos Orbis Android Core

This Android library is the shared source of truth for protocol, forecast, date, flag and broadcast-visual components consumed by both Android TV and Android mobile builds.

## Consumers

- `android-tv`: includes this directory as Gradle project `:core`.
- `android-mobile`: includes the same project `:core`; the former `preparePhoneModels` source-copy task is retired.

## Compatibility boundary

The extracted Java sources temporarily retain the legacy Java package `top.monitorglobal.tv` so existing TV/mobile call sites and tests remain source-compatible during the structural extraction. The Android library namespace is `br.com.argosorbis.core`. Package migration is a separate, follow-up stage and must update both consumers together.

The TV install identity is deliberately independent of this module: `applicationId top.monitorglobal.tv.preview`, signing certificate, version code and official updater endpoints remain unchanged.

## Extracted components

Alert protocol and pairing, map frame, Brazilian date formatting, country flags, minute/hourly rain and weather models, weather briefing parsing/client, daily weather brief, São Paulo civil-defence feed, and the shared radar/logo/OLED broadcast rendering primitives.

The mobile asset preparation task continues to package the shared flag/font assets and explicitly includes the official logo bitmaps used by the extracted visual classes.
