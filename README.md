# Ward Christmas Memories

A survey, photo upload and slideshow builder for a ward Christmas party.

Families scan a QR code, answer three questions and add a family photo from their phone. No sign-in is needed. One menu click then turns the responses into a Google Slides deck with a slide for each family.

Built for the Summerhaze Ward. Everything ward-specific lives in two small `CONFIG` blocks, so it is quick to adapt for another ward.

## How it works

```
Family's phone
   │  opens the form (index.html, hosted on GitHub Pages)
   │  photo is shrunk on the phone, then sent with the answers
   ▼
Google Apps Script web app (apps-script/Code.gs, doPost)
   ├─► Google Sheet: one row per family ("Responses" tab)
   └─► Google Drive: one photo per family ("Ward Christmas Photos" folder)

Sheet menu  🎄 Christmas ▸ Build slideshow
   └─► Google Slides: title slide, one slide per family, closing slide
```

The form is hosted on GitHub Pages rather than served by Apps Script on purpose. A form served by Apps Script fails with a Drive access error for anyone signed in to more than one Google account in their browser. A page hosted elsewhere that posts to the script avoids the problem.

## What's in this repo

| File | Where it runs | What it is |
|---|---|---|
| `index.html` | GitHub Pages | The form families fill in |
| `nativity.jpg` | GitHub Pages and Google Drive | Header artwork on the form, and the title and closing slides |
| `apps-script/Code.gs` | Google Apps Script | Receives submissions, saves them, builds the slideshow |
| `apps-script/Index.html` | Google Apps Script | The original, plainer form that the script itself serves. Kept as a fallback; see [Notes](#notes) |

## Setup

Allow about 20 minutes. You need a Google account and a GitHub account. A shared ward Google account is a good choice, so the responses and photos don't end up in someone's personal Drive.

### 1. Copy this repo

Fork it, or create your own repo and upload the files. The repo has to be public for GitHub Pages on a free account.

### 2. Create the Sheet and add the script

1. Create a new Google Sheet, in the Google account that should own the responses.
2. Go to **Extensions → Apps Script**.
3. Paste the contents of `apps-script/Code.gs` over the default `Code.gs`.
4. Click **+ → HTML**, name the file `Index`, and paste in `apps-script/Index.html`.
5. Edit the `CONFIG` block at the top of `Code.gs` (see [Settings](#settings)). Set `FEATURE_IMAGE_FILE_ID` to `''` for now. Save.
6. Reload the Sheet. A **🎄 Christmas** menu appears.
7. Choose **🎄 Christmas → Run setup** and approve the permissions. Google shows an "unverified app" warning for your own scripts; choose **Advanced → Go to …** to continue.

Setup creates the `Responses` tab and a `Ward Christmas Photos` folder in Drive.

### 3. Deploy the script

1. In the Apps Script editor, choose **Deploy → New deployment → Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
3. Deploy, and copy the web app URL. It ends in `/exec`.

### 4. Point the form at your script

In `index.html`, edit the `CONFIG` block near the bottom of the file:

```js
var CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/…/exec',   // your URL from step 3
  WARD_NAME: 'Your Ward',
  PARTY_TITLE: 'Ward Christmas Party',
  DEADLINE_TEXT: 'Please respond by December 5'   // '' to hide
};
```

`SCRIPT_URL` is the one setting you must change. If you leave it as is, your families' responses go to the Summerhaze Ward's Sheet.

### 5. Turn on GitHub Pages

In the repo, go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then `main` and `/ (root)`. After a minute or so the form is live at `https://<your-username>.github.io/<repo-name>/`.

### 6. Add the artwork to the slideshow

1. Upload `nativity.jpg` to the Drive of the same Google account.
2. Copy its file ID: the part of the share link between `/d/` and `/view`.
3. Paste it into `FEATURE_IMAGE_FILE_ID` in `Code.gs` and save.

Leave it as `''` to build the title and closing slides without artwork.

### 7. Test it

1. Open your GitHub Pages URL on a phone and submit a test response.
2. Check that a row appears in the Sheet and the photo appears in the Drive folder.
3. Choose **🎄 Christmas → Build slideshow** and open the deck.

### 8. Share it

Make a QR code or short link for the GitHub Pages URL. If you use a link shortener, create the link while signed in, so you can change where it points later.

## Settings

### `index.html` (the form)

| Setting | What it does |
|---|---|
| `SCRIPT_URL` | Where submissions are sent. Your web app URL from step 3 |
| `WARD_NAME` | Shown above the form title |
| `PARTY_TITLE` | Shown under the form title |
| `DEADLINE_TEXT` | Shown in the red badge. `''` hides it |

### `Code.gs` (the script and slideshow)

| Setting | What it does |
|---|---|
| `WARD_NAME` | Shown on the title slide |
| `PARTY_TITLE` | Used to name the slideshow file |
| `DEADLINE_TEXT` | Only used by the fallback form |
| `FOLDER_NAME` | Name of the Drive folder created for photos |
| `SHEET_NAME` | Name of the responses tab |
| `MAX_ANSWER_CHARS` | Longest answer the script accepts. Keep it in step with `maxlength="400"` in `index.html` |
| `BG_COLOR`, `ACCENT_COLOR`, `TEXT_COLOR` | Slide colors |
| `TITLE_FONT`, `BODY_FONT` | Slide fonts. Any font available in Google Slides |
| `SLIDE_MODE` | `'combined'` puts the photo and answers on one slide per family. `'split'` gives each family a full-screen photo slide followed by an answers slide |
| `FEATURE_IMAGE_FILE_ID` | Drive file ID of the artwork for the title and closing slides. `''` for none |
| `LIGHTS` | `true` draws a string of Christmas lights along the bottom of every slide |

The ward name, party title and deadline are set in both files. Change them in both.

## Customizing

**Question wording.** Change it in three places:
- the three question `<label>`s in `index.html`
- `QUESTIONS` in `Code.gs`
- `LABELS` in `Code.gs`, the short headings shown above each answer on the slides

**Number of questions.** The form, the Sheet columns and the slide builder all assume exactly three. Adding or removing one means editing the code in `index.html` (the question cards and the `[0, 1, 2]` list in the submit handler) and in `Code.gs` (`HEADERS`, `submitResponse` and `buildSlideshow`).

**Scriptures and wording.** The form's intro text, Luke 2:11 and John 8:12 are plain text in `index.html`. The slide versions are in `buildSlideshow` in `Code.gs`, along with "Merry Christmas" and "from our ward family to yours".

**Form colors.** The `:root` block at the top of the `<style>` section in `index.html`.

**Artwork.** Replace `nativity.jpg` with your own image using the same file name, and update the credit line in the `<footer>` of `index.html`. If the image is missing, the form hides that space. The slides expect an image whose edges fade into the dark background, because it is placed without a frame.

## Running it

- **Review before you build.** Fix typos directly in the Sheet. To leave a family out, set their **Include?** cell to `FALSE`.
- **Rebuild any time.** Each build updates the same deck, so its link never changes and late responses are easy to add. If you delete the deck, the next build creates a new one.
- **Photo problems.** If a photo can't be loaded, the build finishes anyway and lists the affected families in the "Slideshow ready" dialog.
- **Storage.** Photos are shrunk to at most 1600 pixels on the long edge before upload, so each is a few hundred KB. A whole ward fits comfortably in a free Google account.

## Changing the script after it is deployed

- **Slideshow changes** (`CONFIG`, `LABELS`, layouts) take effect on the next build. No redeploy is needed.
- **Changes to how submissions are received** (`doPost`, `submitResponse`) need a new version: **Deploy → Manage deployments → Edit → Version: New version → Deploy**. This keeps the same URL.
- **Don't use "New deployment" for updates.** It creates a different URL, and the form would keep posting to the old one.

## Notes

- **The fallback form.** Opening the web app URL itself shows the original form from `apps-script/Index.html`. It works, but it has the multi-account problem described above and none of the Christmas styling. Share the GitHub Pages link, not the script URL.
- **Privacy.** Responses and photos are stored only in the Google account that owns the Sheet. Nothing is saved in this repo. The form is public, though: anyone with the link can submit, so check the Sheet before building.
- **Consent.** The form requires a checkbox giving permission to show the photo and answers at the party. Only rows marked `Yes` in **OK to Share** are included.
- **Photo formats.** The form converts photos to JPEG on the phone. If a phone's browser can't read a photo, the form asks for a different one.

## Artwork credit

*The Nativity* by Ted Henninger, courtesy of the [Gospel Media Library](https://www.churchofjesuschrist.org/media/image/mary-joseph-with-baby-jesus-f006e0d) of The Church of Jesus Christ of Latter-day Saints. The copy here has been toned to match the night-sky design. Check the Media Library's terms of use before reusing it for your own purpose.
