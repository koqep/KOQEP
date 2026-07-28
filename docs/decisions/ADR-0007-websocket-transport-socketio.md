# ADR-0007: WebSocket transport — Socket.IO, not native WebSocket

**Date:** 2026-07-28
**Status:** Accepted

## Context
*M0'ın WS round-trip görevi bir gerçek zamanlı transport seçimi gerektirdi — bu seçim hem sunucu hem her istemciyi (web, ileride mobil) etkiler ve sonradan değiştirmesi pahalıdır.*

NestJS'te iki resmi seçenek var: `@nestjs/platform-ws` (tarayıcının native WebSocket API'siyle birebir konuşan, minimal bağımlılık) ve `@nestjs/platform-socket.io` (kendi protokolü olan, reconnect/heartbeat/room broadcast hazır gelen bir kütüphane). `ARCHITECTURE.md` presence/typing gibi özellikleri zaten planlıyor; ADR-0002 mobil istemcinin API'yi sıfırdan yeniden yazmadan tüketebilmesini şart koşuyor.

## Decision
Socket.IO seçildi (`@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io-client`). Otomatik reconnect, heartbeat ve oda (room) API'leri hazır geliyor; presence/typing gibi ileride eklenecek özellikler için tekrar altyapı kurmaya gerek kalmıyor.

## Alternatives considered
- **Native WebSocket (`@nestjs/platform-ws`)** — rejected: daha minimal bağımlılık, ama reconnect/heartbeat/room mantığı elle yazılmalı; `ARCHITECTURE.md`'de zaten planlanan presence/typing özellikleri için bu işin ileride tekrar yapılması gerekirdi.

## Consequences
- Positive: reconnect/heartbeat/room broadcast hazır; presence/typing gibi gelecek özellikler için ek altyapı gerekmiyor.
- Cost / risk accepted: Socket.IO kendi protokolü — istemciler tarayıcının native WebSocket API'sini değil, `socket.io-client`'ı kullanmak zorunda. Mobil istemci geldiğinde de socket.io'nun mobil-uyumlu client'ı gerekecek (React Native destekleniyor, ADR-0002'yi bozmuyor).
- Cost to reverse later: yüksek — native ws'e geçmek hem gateway'i hem her istemcinin (web + gelecekteki mobil) bağlantı/reconnect mantığını yeniden yazmayı gerektirir. Şimdi doğru seçmek sonraki pahalı bir geri dönüşü önlüyor.
