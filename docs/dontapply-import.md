# DontApply import: practice interview Q and A in EchoTalk

Status: v1, 2026-11-23. Tracking issue: issue 5 in this repo. DontApply side: DontApply issue 48.

A DontApply user clicks "Study in EchoTalk" on an interview Q and A note. DontApply creates a one-time token
and opens EchoTalk with it. EchoTalk fetches the Q and A content once, stores it on the device, and practices it
from the first question to the last.

## Flow

1. DontApply opens `https://alisolphp.github.io/EchoTalk/#import=<token>` in a new tab
   (the mirror `https://alisol.ir/EchoTalk/` works the same).
   The token is in the URL **fragment**, so it is not sent to the EchoTalk web server and not in its logs.
2. EchoTalk reads the token and **removes it from the address bar immediately** (before any network call).
3. EchoTalk sends `POST https://dontapply.club/api/echotalk/import` with the token as the raw request body.
4. DontApply returns the collection as JSON and **expires the token on the first request**, whether or not
   EchoTalk can parse the answer.
5. EchoTalk validates and sanitizes the JSON, computes a content key, and adds the collection to the user's list
   unless the same key is already there.
6. Practice starts at question 1 and runs in order to the last question.

## Fetch contract (what DontApply must provide)

| Item | Requirement |
|------|-------------|
| URL | `POST https://dontapply.club/api/echotalk/import`. HTTPS only. The host is fixed in EchoTalk (`IMPORT_ENDPOINT`); the token never chooses the host. |
| Request | Body is the token only, `Content-Type: text/plain;charset=UTF-8`. This is a CORS "simple request": **no preflight**, so one request equals one token use. EchoTalk sends no cookies (`credentials: omit`), no referrer, `cache: no-store`, and does not follow redirects. |
| Token | URL-safe characters `[A-Za-z0-9_-]`, 32 to 128 long, random, single use, short expiry (suggested 15 minutes), bound to one note. Not derived from user data. |
| Success | `200`, `Content-Type: application/json`, body in the format below. Send `Cache-Control: no-store`. |
| Unknown, used or expired token | `404` or `410` with no body details. The same answer for all three, so a token cannot be probed. |
| Rate limited | `429`. |
| CORS | `Access-Control-Allow-Origin` set to the exact EchoTalk origin(s): `https://alisolphp.github.io` and `https://alisol.ir` (no `*`; no credentials). |
| Size | Body at most **256 KiB**; EchoTalk rejects larger answers (by `Content-Length` and while streaming). |
| Time | EchoTalk gives up after 15 seconds in total (connection and reading the body). |
| Privacy | No user id, email, name, job or company in the JSON or in any URL. Do not log the token body in access logs. |

Rate limits on the DontApply endpoint (per address and per token) are DontApply's job; EchoTalk makes exactly one
request per link.

## Import format v1

```json
{
  "schemaVersion": 1,
  "type": "qa-collection",
  "title": "Backend engineer interview",
  "lang": "en-US",
  "items": [
    { "question": "Tell me about yourself.", "answer": "I build and run APIs ..." }
  ]
}
```

| Field | Rules |
|-------|-------|
| `schemaVersion` | Must be `1`. |
| `type` | Must be `"qa-collection"`. |
| `title` | String, 1 to 120 characters after sanitizing. |
| `lang` | Optional BCP-47-like tag (`en-US`, `de-DE`). Default `en-US`. If it is one of EchoTalk's supported languages, practice (text-to-speech) uses it. |
| `items` | Array of 1 to 200 objects, in practice order. |
| `items[].question` | String, 1 to 500 characters. Shown on top, never read aloud. |
| `items[].answer` | String, 1 to 2000 characters. This is the text the user practices; EchoTalk reads it aloud. |

Anything invalid (wrong type, empty field, too long, too many items) rejects the whole payload. Unknown fields are
ignored and never stored.

### Content key

EchoTalk computes the key itself: SHA-256 (hex) of the canonical JSON of the sanitized title and items (language
excluded). On pages without Web Crypto (non-HTTPS) a weaker local hash is used instead; it only serves duplicate detection on the device. DontApply does not send a key. The same content always gives the same key, so importing it again does
not create a duplicate; practice still starts from question 1.

## Sanitizing (all imported text)

All text is treated as plain text. Before storage EchoTalk:

- normalizes to Unicode NFC and collapses spaces;
- removes control characters, zero-width characters and bidi override characters;
- removes `<` and `>` (no HTML tag can form);
- replaces straight double quotes with typographic quotes (no breaking out of HTML attributes).

At display time the question, title and list are written with `textContent`, and the places in EchoTalk that build
HTML from sentences (sentence words, recordings and practices lists) now escape their input.

## Errors

The user sees one short, fixed message per case (invalid link, expired or used link, network, timeout, too many
attempts, too large, unreadable or unsupported notes). Messages never contain the token, the URL or server text.
EchoTalk does not log the token or the payload.

## Storage and practice behavior

- IndexedDB database `EchoTalkDB`, version 4, object store `collections` (key = content key).
- Practice: for each item the answer becomes the practice sentence and the question is shown above it. Practice
  settings (mode, repetitions, speed) are the user's own. After each question the user chooses "Next question";
  in auto-skip mode EchoTalk advances by itself. The resume point is saved; "My Q&A Collections" in For You lists
  collections with Start, Continue, From the start and Delete.
- If `lang` is supported, the app language switches to it for the practice (saved like any language change).

## Not in v1

Markdown or HTML in answers, images or audio, per-question language, multiple collections per link, and re-fetching
a link. A used link cannot be reopened; the user clicks "Study in EchoTalk" again in DontApply, and the content key
prevents a duplicate.
