# Firebase refresh loop fix

The infinite refresh was caused by Firebase Hosting `cleanUrls` changing URLs like `login.html` into `/login`, while the app router only recognized `login.html`.

Fixed in this version:

- `getCurrentPage()` now treats `/login` and `login.html` as the same page.
- `goTo()` now avoids redirecting if the user is already on the target page.
- `firebase.json` now sets `cleanUrls: false` to avoid Firebase rewriting HTML routes.
- `index.html` now has only one redirect script.

Deploy with:

```bash
firebase deploy --only hosting
```

Then hard-refresh the browser:

```text
Ctrl + Shift + R
```
