# BSC Candidate CRM — Installation Guide

Complete setup guide for deploying the BSC Candidate CRM on **GitHub Pages** (frontend) + **Google Apps Script** (backend) + **Google Sheets** (database).

---

## File Structure

```
bsc-crm/
├── index.html                  ← redirects to login.html
├── login.html
├── dashboard.html
├── candidates.html
├── interview-panel.html
├── offer-process.html
├── onboarding.html
├── employee-exit.html
├── candidate-entry.html        ← public QR form (no login)
├── css/
│   └── shared.css
├── js/
│   ├── config.js               ← ★ paste Script URL here
│   └── shared.js
├── backend/
│   └── code.gs                 ← Google Apps Script
└── README.md
```

---

## Step 1 — Create the Google Sheet

1. Go to **[sheets.google.com](https://sheets.google.com)** and create a new blank spreadsheet.
2. Name it **BSC Candidate CRM**.
3. Copy the Sheet ID from the URL bar:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit
   ```
4. Keep this tab open — you'll need the ID in Step 2.

---

## Step 2 — Set Up Google Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**.
2. Delete all existing code in the editor.
3. Open `backend/code.gs` from this project and **paste the entire contents** into the Apps Script editor.
4. On **line 11**, replace the placeholder with your Sheet ID:
   ```javascript
   const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';  // ← paste here
   ```
5. Click **Save** (Ctrl+S).

### Run Setup Function (creates all sheet tabs automatically)

6. In the function dropdown at the top, select **`setupSheets`**.
7. Click **Run ▶**.
8. When prompted, click **Review Permissions → Allow**.
9. Wait for the success alert — all 9 sheet tabs are now created with headers.

> **Default login credentials seeded by setupSheets:**
> | Username | Password | Role |
> |---|---|---|
> | hr@bsctextiles.com | bsc@2026 | HR |
> | fm@bsctextiles.com | bsc@2026 | Floor Manager |
> | manager@bsctextiles.com | bsc@2026 | Manager |
> | admin@bsctextiles.com | bsc@2026 | Admin |
>
> ⚠️ **Change these passwords immediately** in the Users sheet after first login.

---

## Step 3 — Deploy Apps Script as Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon ⚙ next to "Type" and select **Web app**.
3. Fill in the settings:
   - **Description:** BSC CRM v1.0
   - **Execute as:** Me
   - **Who has access:** Anyone (even anonymous)
4. Click **Deploy**.
5. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## Step 4 — Connect Frontend to Backend

1. Open `js/config.js` in this project.
2. On **line 4**, replace the placeholder with your Web App URL:
   ```javascript
   SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_ACTUAL_ID/exec',
   ```
3. Save the file.

> **Without this step the app still works** — it uses built-in sample data. Connect the URL when you're ready to use live data.

---

## Step 5 — Create `index.html` redirect

Create a file called `index.html` in the root folder with this content:

```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=login.html">
</head>
<body>Redirecting…</body>
</html>
```

---

## Step 6 — Deploy to GitHub Pages

1. Create a free account at **[github.com](https://github.com)** if you don't have one.
2. Click **New Repository**.
   - Repository name: `bsc-crm` (or any name)
   - Visibility: **Public** (required for free GitHub Pages)
   - Click **Create repository**
3. Upload your files using one of these methods:

### Option A — GitHub Desktop (easiest)
1. Download **[GitHub Desktop](https://desktop.github.com)**.
2. Clone your new repository to your computer.
3. Copy all project files into the cloned folder.
4. In GitHub Desktop: commit the changes and **Push to origin**.

### Option B — Drag & Drop on GitHub.com
1. Open your repository on GitHub.
2. Click **Add file → Upload files**.
3. Drag and drop all project files and folders.
4. Click **Commit changes**.

4. Enable GitHub Pages:
   - Go to your repository → **Settings → Pages**
   - Under **Branch**, select `main` → folder `/` (root)
   - Click **Save**

5. Your app will be live at:
   ```
   https://YOUR_USERNAME.github.io/bsc-crm/
   ```
   (Takes 1–3 minutes to go live after first deploy)

---

## Step 7 — Set Up QR Code for Walk-in Form

The candidate entry form is accessible at:
```
https://YOUR_USERNAME.github.io/bsc-crm/candidate-entry.html?src=walkin
```

The `?src=walkin` parameter pre-fills the source as Walk-in.

**Generate a QR code:**
1. Go to **[qr-code-generator.com](https://www.qr-code-generator.com)** (free).
2. Paste your candidate-entry URL.
3. Download the QR code PNG.
4. Print and place at the Walk-in counter.

**Other source parameters:**
| URL Parameter | Source Label |
|---|---|
| `?src=walkin` | Walk-in |
| `?src=ref` | Employee Reference |
| `?src=online` | Online Apply |

---

## Step 8 — Add Interview Questions to Sheet

1. Open the **Interview_Questions** tab in your Google Sheet.
2. Add questions in this format:

| Designation | Question ID | Question | Type | Max Score | Options |
|---|---|---|---|---|---|
| Sales Executive | 1 | Communication skills | score | 10 | |
| Sales Executive | 2 | Retail experience | score | 15 | |
| All | 1 | Can join immediately? | select | 0 | Yes,After 1 week,After 1 month |

- **Type = `score`**: Shows a number input (0–Max Score)
- **Type = `select`**: Shows a dropdown (Options column = comma-separated)
- **Designation = `All`**: Question appears for every designation

---

## Step 9 — Add Staff Logins

1. Open the **Users** tab in your Google Sheet.
2. Add rows for each staff member:

| Username | Password | Role | Active |
|---|---|---|---|
| staff@bsc.com | yourpassword | HR | TRUE |
| floor1@bsc.com | yourpassword | Floor Manager | TRUE |

- **Role options:** `HR`, `Floor Manager`, `Manager`, `Admin`
- Set **Active** to `TRUE` to enable login, `FALSE` to disable.

> ⚠️ For production use, consider adding password hashing in `code.gs`. The default implementation uses plain text for simplicity.

---

## Updating the App

When you make changes to any HTML/JS/CSS file:

1. Upload the changed files to your GitHub repository (drag & drop or GitHub Desktop).
2. GitHub Pages automatically updates — usually within 1 minute.
3. If the Apps Script backend changes, re-deploy: **Deploy → Manage deployments → Create new version**.

---

## Page Reference

| Page | URL | Who Can Access |
|---|---|---|
| Login | `/login.html` | Everyone |
| Dashboard | `/dashboard.html` | HR, Admin |
| Candidates | `/candidates.html` | HR, Admin |
| Interview Panel | `/interview-panel.html` | HR, Floor Manager, Manager, Admin |
| Offer Process | `/offer-process.html` | HR, Admin |
| Onboarding | `/onboarding.html` | HR, Admin |
| Employee Exit | `/employee-exit.html` | HR, Admin |
| Entry Form (QR) | `/candidate-entry.html` | Public — no login |

---

## Troubleshooting

**"CORS error" when submitting the entry form**
→ In Apps Script, re-deploy and make sure "Who has access" is set to **Anyone**.

**Changes not showing on GitHub Pages**
→ Wait 2–3 minutes and hard-refresh your browser (Ctrl+Shift+R).

**Login not working**
→ Check the Users sheet: confirm username matches exactly (case-insensitive), role matches the role button selected, and Active = TRUE.

**Apps Script says "Script function not found"**
→ Make sure you pasted the full `code.gs` content and saved before deploying.

**Data not saving to sheet**
→ Confirm `SHEET_ID` in `code.gs` is correct (no spaces, no quotes around it other than the ones in the code).

---

## Support

For issues or customisation, review `js/config.js` for all configurable values, and `backend/code.gs` for all data operations.

*BSC Candidate CRM v1.0 — Built for BSC The Textile Mall*
