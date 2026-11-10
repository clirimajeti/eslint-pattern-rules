# shop-web

- Orders move from draft to paid to shipped; only the backend changes an order's state.
- Browser storage only through `src/shared/storage.ts` (`readSetting`, `writeSetting`), never `localStorage` directly (ADR 0007).
