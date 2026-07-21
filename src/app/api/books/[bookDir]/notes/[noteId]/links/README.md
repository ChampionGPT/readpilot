# note annotation links API

This folder owns the note-to-annotation reference endpoint.

- `GET`: returns all annotation links for the note.
- `POST`: atomically sends an annotation into a Cornell section. The database validates that note and annotation belong to the same book, appends text and inserts the exact link only once, then returns `{ created, note, links }`.
- `DELETE`: removes one exact note + annotation + section link.

GET, POST, and DELETE first resolve `bookDir` to the owning book and reject notes addressed through another book URL. POST then delegates consistency and idempotency to `sendAnnotationToNote` in `src/lib/db.ts`; clients must lock editing, await a successful local editor flush, abort on flush failure, and must not emulate the operation with separate note and link requests.
