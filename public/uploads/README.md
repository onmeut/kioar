# Kioar local uploads

When S3 environment variables (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_BUCKET`) are **not** set, `uploadPublicImage`
falls back to writing files here and serving them under `/uploads/…`.

This folder is kept in git via `.gitkeep`. Generated files are ignored
via the `.gitignore` rule below.
